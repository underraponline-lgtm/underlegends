/* ════════════════════════════════════════════════════════════════════
   EL HUB. Todo esto corre en el navegador de quien mira, y eso es el
   diseño entero.

   🔴 EL WORKER TIENE 10 ms DE CPU POR REQUEST — el límite que manda en
   todo el proyecto. Por eso acá no se pide nada calculado: se baja UN
   json ya masticado (`web:lobby`, lo escribe `bot/subir_web.py` una vez
   por ciclo) y el buscador, los filtros, el orden, el podio y el visor
   de tarjetas los hace esta máquina. Ordenar 200 filas en el navegador
   es gratis; ordenarlas en el Worker sale del presupuesto de todos.

   ⚠️ Y POR ESO LA PAGINA PUEDE CRECER SIN COSTAR NADA. Cloudflare Pages
   sirve estáticos **gratis e ilimitados**: el CSS, este archivo y las
   imágenes no tocan el presupuesto del Worker. Lo único que pasa por él
   es el json de 15 KB.

   ⚠️ SIN FRAMEWORK, A PROPOSITO. No hay build: los archivos que están en
   `bot/paginas/` son los que se sirven. Un paso de compilación sería una
   cosa más que puede quedar vieja sin avisar, que es el error que este
   repo documenta una y otra vez.

   ⚠️ Y NINGUNA SECCION SE DIBUJA VACIA. Cada `pinta*()` se apaga sola si
   no tiene con qué: es la regla de `CLAUDE.md` —*«sin dato no hay
   pieza»*— y evita media página de bloques diciendo «todavía nada»,
   que es peor que no tenerlos.
   ════════════════════════════════════════════════════════════════════ */
'use strict';

var D = null;
// ⚠️ `tocado` distingue «el orden por defecto» de «el que pidió quien
// mira». Sin eso, la subcategoría le pisaría el orden cada vez que se
// repinta la tabla — y repintar pasa al buscar y al filtrar.
var ORDEN = { col: 'pos', desc: false, tocado: false };
var FIL = { q: '', qc: '', sv: '', cc: '' };
var VISTAS = 24;

var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* `ar` -> la imagen de la bandera, no el emoji.

   🔴 EL EMOJI 🇦🇷 EN WINDOWS SON DOS LETRAS. No hay fuente de banderas y
   caía a «AR», «CO» — Dlx, 25/09/2026: «esto es una website, puedes poner
   literalmente una imagen pequeña de las banderas». Salen de
   `bot/paginas/banderas/`, que arma `herramientas/banderas_web.py` con la
   lista `PAIS` de acá abajo: la misma lista para el nombre y la imagen.

   ⚠️ UN PAIS QUE NO ESTA EN `PAIS` SIGUE SALIENDO COMO SIGLA. Una imagen
   que no existe dibuja el ícono de imagen rota, que es peor que dos
   letras; por eso sólo se pide la de los que se sabe que están. */
function bandera(cc) {
  cc = String(cc || '').trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(cc) || !PAIS[cc]) return '';
  return '<img class="bf" src="banderas/' + cc + '.png" alt="' + esc(PAIS[cc]) +
    '" title="' + esc(PAIS[cc]) + '" width="21" height="14" loading="lazy">';
}
function ccTexto(cc) {
  return bandera(cc) || esc(String(cc || '').toUpperCase());
}

var num = function (n) { return Number(n || 0).toLocaleString('es'); };

/* ── los ajustes de quien mira ────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «la hora que se muestre ahí que se adapte al usuario
   que esté en la página… en mi caso yo soy EST». Por defecto, la zona y el
   formato del dispositivo; desde Ajustes se pueden fijar.

   ⚠️ TODO EN `localStorage` Y SIEMPRE CON try: en una ventana privada o con
   los datos bloqueados no hay dónde guardar, y la página anda igual. */
function leerLS(k, def) {
  try {
    var v = localStorage.getItem(k);
    return v == null ? def : JSON.parse(v);
  } catch (e) { return def; }
}
function guardarLS(k, v) {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch (e) { /* sin dónde guardar: se sigue igual */ }
}
var AJ = leerLS('lg:ajustes', {}) || {};
var ZONAS = [['', 'La de este dispositivo'],
  ['America/New_York', 'Este de EE. UU. (Nueva York)'], ['America/Mexico_City', 'México'],
  ['America/Guatemala', 'Centroamérica'], ['America/Bogota', 'Colombia · Perú · Ecuador'],
  ['America/Caracas', 'Venezuela · Bolivia'], ['America/Santo_Domingo', 'Rep. Dominicana · Puerto Rico'],
  ['America/Santiago', 'Chile'], ['America/Argentina/Buenos_Aires', 'Argentina · Uruguay'],
  ['Europe/Madrid', 'España']];
function zona() {
  if (AJ.tz) return AJ.tz;
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
}
function opcTz(o) {
  o = o || {};
  if (AJ.tz) o.timeZone = AJ.tz;
  if (AJ.h12 === true || AJ.h12 === false) o.hour12 = AJ.h12;
  return o;
}
function fmtHora(d) {
  try { return new Date(d).toLocaleTimeString('es', opcTz({ hour: 'numeric', minute: '2-digit' })); }
  catch (e) { return ''; }
}
function fmtFecha(d, o) {
  try { return new Date(d).toLocaleDateString('es', opcTz(o || { day: 'numeric', month: 'short' })); }
  catch (e) { return ''; }
}
// «EDT», «GMT-3»: para que se lea que la hora es la de quien mira
function zonaCorta(d) {
  try {
    var o = { timeZoneName: 'short' };
    if (zona()) o.timeZone = zona();
    var p = new Intl.DateTimeFormat('en-US', o).formatToParts(d ? new Date(d) : new Date());
    return (p.filter(function (x) { return x.type === 'timeZoneName'; })[0] || {}).value || '';
  } catch (e) { return ''; }
}
/* 🔑 LA HORA CON TU BANDERA, NO CON «EDT». Dlx, 27/09/2026: *«que ahí
   aparezca la hora del evento pero con la bandera del país del usuario si
   está conectado en Discord, o con la zona local si no… porque al decir EDT
   o EST confunde a algunos»*. La hora sigue siendo la de quien mira; lo que
   cambia es cómo se dice de dónde es.

   ⚠️ LA BANDERA SÓLO SI ES LA HORA DE ESE PAÍS: si alguien de Argentina mira
   desde otra zona, o fijó otra en Ajustes, la hora que ve no es la de
   Argentina, y la bandera mentiría. Se comparan los desfases en ese
   instante —con el horario de verano incluido—; si no coinciden, «hora
   local». Para los países con varias zonas vale la principal. */
var ZONA_PAIS = { ar: 'America/Argentina/Buenos_Aires', bo: 'America/La_Paz', br: 'America/Sao_Paulo',
  cl: 'America/Santiago', co: 'America/Bogota', cr: 'America/Costa_Rica', cu: 'America/Havana',
  do: 'America/Santo_Domingo', ec: 'America/Guayaquil', es: 'Europe/Madrid', gt: 'America/Guatemala',
  hn: 'America/Tegucigalpa', mx: 'America/Mexico_City', ni: 'America/Managua', pa: 'America/Panama',
  pe: 'America/Lima', pr: 'America/Puerto_Rico', py: 'America/Asuncion', sv: 'America/El_Salvador',
  us: 'America/New_York', uy: 'America/Montevideo', ve: 'America/Caracas' };
function desfase(tz, d) {
  try {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric',
      day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(d).forEach(function (x) {
      p[x.type] = x.value;
    });
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) -
      Math.floor(d.getTime() / 60000) * 60000) / 60000);
  } catch (e) { return null; }
}
/* el país de quien mira: el de su Discord si entró, o el de quien eligió ser */
function ccMio() {
  var f = typeof yo === 'function' ? yo() : null;
  return String((DC && DC.cc) || (f && f.cc) || '').toLowerCase();
}
function etiquetaHora(d) {
  var t = d ? new Date(d) : new Date(), cc = ccMio(), tp = ZONA_PAIS[cc];
  if (cc && tp && bandera(cc)) {
    var mia = zona() ? desfase(zona(), t) : -t.getTimezoneOffset();
    if (mia != null && mia === desfase(tp, t)) {
      return '<span class="z-pais" title="Hora de ' + esc(nombrePais(cc)) + '">' + bandera(cc) + '</span>';
    }
  }
  return '<span class="z-loc" title="' + esc(zonaCorta(t)) + '">hora local</span>';
}
// el día de un instante en la zona de quien mira: 'AAAA-MM-DD'
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
function aplicarCalma() {
  document.documentElement.classList.toggle('calma', !!AJ.calma);
}
/* ⚠️ CON LA VERSIÓN DE ESA CARTA. La URL de R2 es estable a propósito, así
   que sin `?v=` el navegador puede mostrar la imagen que guardó aunque la
   carta ya se haya redibujado. La versión sale del sello del pipeline. */
// ⚠️ `cv` y `vj` viajan compactas, en el orden de `D.cartas` (ver
// `subir_web.py`); un lobby guardado de antes las trae como objeto y lista
var cartaIdx = function (cual) { return (D.cartas || []).indexOf(cual); };
var urlCarta = function (f, cual) {
  var v = typeof f.cv === 'string' ? f.cv.split('.')[cartaIdx(cual)] : (f.cv || {})[cual];
  return D.r2 + '/' + encodeURIComponent(f.k) + '/' + cual + '.webp' +
    (v ? '?v=' + v : '');
};
/* ¿La imagen de esa carta es de antes de los números de ahora? Ver
   `_versiones()` en bot/subir_web.py. */
var vieja = function (f, cual) {
  return typeof f.vj === 'string' ? cartaIdx(cual) >= 0 && f.vj.indexOf(String(cartaIdx(cual))) >= 0
    : (f.vj || []).indexOf(cual) >= 0;
};
var avisoCarta = function (f, cual) {
  var a = $('#vAviso');
  if (!a) {
    a = document.createElement('p');
    a.id = 'vAviso';
    a.className = 'aviso-carta';
    $('#vImg').parentNode.insertAdjacentElement('afterend', a);
  }
  a.hidden = !vieja(f, cual);
  a.textContent = '⏳ Esta tarjeta se está redibujando con los datos de ' +
    'ahora. Los números de abajo ya son los actuales.';
};
/* La clave de `comun/claves.py`: NFD, minúsculas, sólo letras y números de
   cualquier alfabeto, sin banderas. */
var normK = function (s) {
  return String(s || '').normalize('NFD').toLowerCase()
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/[^\p{L}\p{N}-]/gu, '');
};
var porK = function (k) {
  var t = D.tabla || [];
  var f = t.filter(function (x) { return x.k === k; })[0];
  if (f) return f;
  // 🔴 LOS LINKS VIEJOS. Hasta el 25/09/2026 la clave de la página era el
  // nombre en minúsculas —`mau kc`— y la de R2 y KV, `maukc`; ahora es una
  // sola (`_clave()` en bot/subir_web.py). Un `#/r/mau%20kc` guardado sigue
  // abriendo el perfil.
  var n = normK(k);
  return n ? t.filter(function (x) { return normK(x.k) === n; })[0] : undefined;
};
/* 🔑 «FUERA DE CONCURSO» (Dlx, 27/09/2026): quien no es miembro de la Liga
   —en DRA y verificado— sigue en el ranking con sus puntos y en su lugar
   por mérito, pero SIN NÚMERO. El puesto, el podio, los líderes y los
   récords son de los miembros. El dato lo pone el ciclo (`fc`, y `o` el
   orden por mérito entre todos); acá sólo se respeta. */
var oficiales = function () { return (D.tabla || []).filter(function (f) { return !f.fc; }); };
var FC = '<span class="fc-t" title="Fuera de concurso: todavía no es miembro de la Liga">&mdash;</span>';
var numPos = function (f) { return f && f.pos && !f.fc ? '#' + esc(f.pos) : '&mdash;'; };
var textoPos = function (f) {
  return f && f.fc ? 'Fuera de concurso' : f && f.pos && f.pos !== '—' ? '#' + esc(f.pos) + ' de la temporada'
    : 'Todavía sin eventos esta temporada';
};
/* 🔑 LA FILA DE QUIEN ENTRÓ CON DISCORD Y NO ESTÁ EN EL RANKING: tiene carta
   (la de Servidor no pide nada) pero ningún evento de la temporada. Sirve
   para el visor de «Mis tarjetas»; sus Bloqueadas van como cartas más. */
var filaCuenta = function (k) {
  if (!DC || !DC.clave || DC.clave !== k) return null;
  return { k: DC.clave, n: DC.rapero || DC.n, cc: DC.cc, sv: DC.sv, pos: '—', ovr: null,
    pts: 0, ev: DC.ev || 0, wr: '—',
    c: (DC.cs || []).concat((DC.bl || []).map(function (b) { return 'bloq-' + b; })) };
};
var apaga = function (sel) { var e = $(sel); if (e) e.hidden = true; };

/* Los nombres de país, para que la tabla no diga «AR». Sólo los que la
   liga usa; el resto cae a la sigla en mayúsculas, que es la verdad. */
var PAIS = {
  ar: 'Argentina', cl: 'Chile', co: 'Colombia', ve: 'Venezuela',
  mx: 'México', pe: 'Perú', es: 'España', ec: 'Ecuador', us: 'Estados Unidos',
  uy: 'Uruguay', py: 'Paraguay', bo: 'Bolivia', cr: 'Costa Rica',
  gt: 'Guatemala', hn: 'Honduras', ni: 'Nicaragua', pa: 'Panamá',
  pr: 'Puerto Rico', do: 'Rep. Dominicana', sv: 'El Salvador', cu: 'Cuba',
  no: 'Noruega', br: 'Brasil', ae: 'Emiratos'
};
var nombrePais = function (cc) {
  return PAIS[String(cc || '').toLowerCase()] || String(cc || '').toUpperCase();
};

/* ── el enrutado ────────────────────────────────────────────────────
   🔑 DESDE EL 01/10/2026 LA DIRECCIÓN ES DE VERDAD: `/freestyle-rap/ranking`
   (Dlx: «/freestyle-rap, put it like that, better»). Pero este archivo
   sigue hablando en `#/ranking`, a propósito: el script del principio de
   index.html (lo arma `web/montar.py`) traduce en un solo lugar —`rutaLG()`
   lee la ruta, `urlLG()` la escribe— y ataja los links `#/…`, así que un
   link que ya circula (`underlegends.pages.dev/#/tarjetas`) abre lo mismo.

   ⚠️ NADA SE DESCARGA AL CAMBIAR DE VISTA: Pages sirve esta misma página en
   cualquier dirección, y al tocar un link la dirección cambia sin recargar
   (`pushState`). El payload se baja UNA vez, como antes.

   ⚠️ CON `<base href="/">` UN `replaceState(null, '', '#/x')` DEJA LA
   DIRECCIÓN EN `/#/x`: para escribir una ruta, `urlDe()`.

   ⚠️ Y SE VUELVE ARRIBA AL CAMBIAR. Sin eso, entrar a «Tarjetas» desde
   el final del ranking te deja mirando la mitad de la galería sin
   entender por qué. */
function ruta() {
  return (window.rutaLG ? window.rutaLG() : (location.hash || '#/').replace(/^#\/?/, '')).split('?')[0];
}
// la dirección de una ruta: «#/ranking» -> «/freestyle-rap/ranking» (sin el script del principio, como antes)
function urlDe(r) {
  return window.urlLG ? window.urlLG(r) : '#/' + String(r || '').replace(/^#?\/?/, '');
}

// 🔑 `#/avisos` ES AHORA UN LUGAR ADENTRO DE «EVENTOS»: el botón de
// `/card` lleva ahí y no puede romperse. Se abre la vista y se baja hasta
// la campana.
// 🔑 `#/duelos` TAMBIÉN: Duelos pasó a ser un ranking (Dlx, 25/09/2026) y
// su lugar en el menú es del Pase. Los links viejos abren ese ranking.
var ALIAS = { avisos: 'eventos', duelos: 'ranking', llave: 'eventos' };

function ir() {
  // los menús de arriba se cierran al cambiar de página: quedaban abiertos
  // tapando la vista nueva si se navegaba sin tocar afuera. Y lo mismo el
  // visor de tarjetas y el de la llave: desde ahí ahora se abre un país o
  // una crew, y la página nueva quedaba abajo del visor.
  cerrarPops();
  if ($('#visor') && !$('#visor').hidden) cerrar();
  if ($('#visorLlave') && !$('#visorLlave').hidden) cerrarLlave();
  // 🔑 `#/r/<clave>` ES EL PERFIL: la vista es la primera parte y la
  // persona, el resto. Ver `pintaPerfil()`.
  var pedida = ruta(), partes = pedida.split('/');
  // `#/avisos/FFA` (el link de `/notify`) es `#/avisos` con un servidor:
  // el alias se busca también por la primera parte
  var r = ALIAS[pedida] || ALIAS[partes[0]] || partes[0];
  var hay = $$('.vista').some(function (v) { return v.dataset.vista === r; });
  if (!hay) { r = ''; }
  $$('.vista').forEach(function (v) { v.hidden = v.dataset.vista !== r; });
  // ⚠️ CON TRY: un `%` suelto en el link tiraba URIError y la vista quedaba
  // vacía, igual que en `volverDeDiscord()`
  var dec = function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } };
  if (r === 'r') pintaPerfil(dec(partes.slice(1).join('/')));
  if (r === 'crew') pintaCrew(dec(partes.slice(1).join('/')));
  if (r === 'pais') pintaPais(partes[1] || '');
  if (r === 'cambios') cargarCambios(pintaCambios);
  if (r === 'publicaciones') {
    if (MURO === null) pedirMuro();
    pintaMuro();
  }
  if (r === 'tienda' && D) {
    try { pintaTienda(); } catch (e) { console.error('[pintaTienda]', e); }
    if (!BILL) pedirBilletera(false);
  }
  if (r === 'tarjetas' && D) pintaCaraCmp();
  // 🔑 `#/llave/<número>` ABRE ESA LLAVE, encima del calendario. Dlx, 27/09/2026,
  // «me gusta todo»: el link de cada llave es para pegarlo en Discord.
  if (partes[0] === 'llave' && partes[1] && !abrirLlave(dec(partes[1])) &&
      String(partes[1]).indexOf('v:') !== 0) {
    llaveVieja(dec(partes[1]));
  }
  if (r !== 'eventos' || partes[0] !== 'llave') apaga('#evAviso');
  // 🔑 `#/ranking/<sub>` ABRE ESE RANKING: es lo que usan los «Ver todo» del
  // Inicio, y deja mandar el link de un ranking puntual.
  if (r === 'ranking') {
    var sb = pedida === 'duelos' ? 'duelos' : partes[1];
    if (sb && SUBS[sb] && sb !== SUB) elegirSub(sb);
  }
  $$('#nav a').forEach(function (a) {
    a.classList.toggle('on', a.getAttribute('href') === '#/' + r);
  });
  // 🔑 en el teléfono la barra se desliza: la opción de la vista abierta, a la vista
  var nav = $('#nav'), on = $('#nav a.on');
  if (nav && on && nav.scrollWidth > nav.clientWidth + 2) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  bordeNav();
  // Los paneles de la vista que se abre entran con su animación.
  //
  // 🔴 LA CLASE SE LLAMA `entro` Y NO `vista`, Y ESO NO ES ESTILO. Con el
  // mismo nombre para las dos cosas, `$$('.vista')` de la línea de arriba
  // empezaba a devolver también los paneles ya revelados —que no tienen
  // `data-vista`— y en la siguiente navegación los marcaba `hidden`:
  // cambiar de vista dos veces vaciaba la página. Un nombre que
  // significa dos cosas es un bug esperando su segundo clic.
  $$('.vista:not([hidden]) .blk').forEach(function (b) { b.classList.add('entro'); });
  var ancla = pedida !== r && (document.getElementById(pedida) ||
    (ALIAS[partes[0]] ? document.getElementById(partes[0]) : null));
  if (ancla) setTimeout(function () { ancla.scrollIntoView({ block: 'start' }); }, 40);
  else window.scrollTo(0, 0);
  var v = $$('.vista').filter(function (x) { return !x.hidden; })[0];
  var h = v && v.querySelector('h1');
  // ⚠️ SIN REPETIR EL NOMBRE. En Inicio el `<h1>` ES «Liga Global», así que
  // la pestaña decía «Liga Global · Liga Global — Under Legends». Se compara
  // normalizado porque el `<h1>` trae saltos y un `<em>` adentro.
  var t = (h ? h.textContent : '').replace(/\s+/g, ' ').trim();
  var base = 'Liga Global de Freestyle';
  document.title = (t && base.toLowerCase().indexOf(t.toLowerCase()) < 0)
    ? t + ' · ' + base : base;
}

/* ── la trama ─────────────────────────────────────────────────────── */
function trama() {
  var s = '';
  for (var i = 0; i < 12; i++) {
    s += '<i style="margin-left:' + (-((i * 7) % 26)) + '%">' +
         'UNDER LEGENDS '.repeat(7) + '</i>';
  }
  $('#trama').innerHTML = s;
}

/* ── la cuenta atrás ────────────────────────────────────────────────
   🔑 EL PAYLOAD TRAE EL INSTANTE, NO LOS MINUTOS. Se escribe una vez por
   hora: mandar «faltan 30 min» sería un contador que miente desde el
   segundo uno. El reloj es el de quien mira. */
/* 🔴 AL LLEGAR A CERO, EL EVENTO DEJA DE SER «LO QUE VIENE». Decía «EN VIVO»
   y se quedaba ahí con «Agregar a Google Calendar» y «Avisame» de algo que ya
   empezó (Dlx, con capturas, 27/09/2026). Ahora se redibuja lo que depende de
   la hora: el evento pasa a «En vivo» y el «próximo» es el siguiente. */
var RELOJ_CERO = false;
function empezo(e) {
  if (!e || e.sin_hora) return false;
  var t = Date.parse(String(e.cuando || '').replace(/Z$/, '') + 'Z');
  return !isNaN(t) && t <= Date.now();
}
function redibujarPorHora() {
  RELOJ_CERO = false;
  [pintaHero, pintaVivo, pintaEvCab, pintaYoPanel].forEach(function (f) {
    try { f(); } catch (e) { console.error('[' + f.name + ']', e); }
  });
}
function pintaRelojes() {
  var ahora = Date.now();
  $$('.reloj').forEach(function (el) {
    var t = Date.parse(el.dataset.t + 'Z');
    if (isNaN(t)) { el.textContent = ''; return; }
    var f = t - ahora;
    if (f <= 0) {
      el.textContent = 'EMPEZÓ';
      el.classList.add('vivo');
      if (!el.dataset.cero) { el.dataset.cero = '1'; RELOJ_CERO = true; }
      return;
    }
    el.classList.remove('vivo');
    var s = Math.floor(f / 1000), h = Math.floor(s / 3600),
        m = Math.floor(s % 3600 / 60), q = s % 60;
    var dd = function (n) { return (n < 10 ? '0' : '') + n; };
    el.textContent = h ? h + ':' + dd(m) + ':' + dd(q) : m + ':' + dd(q);
  });
  if (RELOJ_CERO) setTimeout(redibujarPorHora, 0);
}

/* ── cabecera ─────────────────────────────────────────────────────── */
function pintaHero() {
  var cartas = 0;
  (D.tabla || []).forEach(function (f) { cartas += (f.c || []).length; });
  $('#cRaperos').textContent = D.gente || (D.tabla || []).length;
  // 🔴 LOS EVENTOS JUGADOS, NO LAS PARTICIPACIONES. Sumaba el `ev` de cada
  // persona y decía «134 eventos» con siete jugados (auditoría del
  // 25/09/2026). El número viene contado: ver `eventos` en subir_web.py.
  $('#cEventos').textContent = D.eventos != null ? D.eventos : '—';
  // ⚠️ PAISES Y NO SERVIDORES. Hoy la T1 entera es de FFA, así que esa
  // cifra decía «1 SERVIDORES» —mal escrito y sin decir nada—. Los
  // servidores tienen su propia sección, con su color y sus puntos.
  var ps = (D.paises || []).length;
  $('#cPaises').textContent = ps || '—';
  $('#lPaises').textContent = ps === 1 ? 'país' : 'países';
  $('#cCartas').textContent = cartas;

  pintaCampeones();

  // ⚠️ SÓLO LO QUE NO EMPEZÓ: lo que empezó está en «En vivo» (`pintaVivo()`)
  var pr = (D.proximos || []).filter(function (e) { return !empezo(e); });
  $('#viene').hidden = !pr.length;
  if (!pr.length) return;
  // 🔑 EL PRIMERO, GRANDE; LOS DEMÁS, EN LISTA. Dlx, 27/09/2026: «¿editar lo
  // que se viene? se ve algo vacío». Con un solo evento anunciado —lo normal:
  // los servidores anuncian el mismo día— el bloque era un renglón. Ahora el
  // próximo lleva su servidor, el día y la hora de quien mira, la cuenta
  // atrás, los datos del anuncio y «Agregar a Google Calendar», que en el
  // teléfono sí anda (abre la app con el evento cargado).
  $('#eventos').innerHTML = vieneDestacado(pr[0]) + pr.slice(1).map(function (e) {
    // ⚠️ LA LINEA DE ABAJO SE ARMA CON LO QUE HAY. Servidor, cupos,
    // modalidad y premio son opcionales y la mayoría de los anuncios trae
    // dos o tres: `filter(Boolean)` evita los « · · » de los que faltan.
    var sub = [e.sv, e.cupos, e.modalidad, e.premios]
      .filter(Boolean).map(esc).join(' &middot; ');
    // 🔑 EL NOMBRE ES EL LINK AL ANUNCIO, cuando lo hay. Dlx lo pidió con
    // el link del canal; se usa el del **mensaje**, que además de abrir el
    // canal deja a la persona parada en el anuncio.
    //
    // ⚠️ `rel="noopener noreferrer"` y `target="_blank"`: sin `noopener`
    // la pestaña que se abre puede escribir sobre `window.opener`.
    var tit = e.link
      ? '<a href="' + esc(e.link) + '" target="_blank" rel="noopener ' +
        'noreferrer">' + esc(e.nombre) + '<i class="ir">&#8599;</i></a>'
      : esc(e.nombre);
    // 🔑 SIN HORA QUE SE PUEDA LEER, SIN CUENTA ATRÁS: «anunciado hace X».
    // Una cuenta atrás hacia la hora de publicación diría «EN VIVO» de algo
    // que todavía no empezó. Ver `sin_hora` en bot/subir_web.py.
    var der = e.sin_hora
      ? '<span class="hace">anunciado ' + esc(cuandoSe(e.cuando)) + '</span>'
      : '<span class="reloj" data-t="' + esc(e.cuando) + '">&middot;</span>';
    return '<div class="ev"><div><b>' + tit + etiquetaMult(e.sv, String(e.cuando || '').replace(/Z$/, '') + 'Z') +
      (esDorado(e) ? '<span class="xm oro">&#127775; dorado</span>' : '') +
      (esCopa(e) ? '<span class="xm oro">&#127942; Copa</span>' : '') +
      (e.ct ? '<span class="xm ct" title="Anunciado con 12 horas o más">&#128227;</span>' : '') +
      '</b><small>' + sub +
      '</small></div>' + der + '</div>';
  }).join('') + (pr.length < 2 ? '<p class="vi-mas">Los servidores suelen anunciar sus ' +
    'eventos el mismo día. Con los <a href="#/avisos">avisos</a> te enterás apenas sale uno.</p>' : '');
  pintaRelojes();
}
function vieneDestacado(e) {
  var t = String(e.cuando || '').replace(/Z$/, ''), iso = t + 'Z';
  var ir = function (tx) {
    return e.link ? '<a href="' + esc(e.link) + '" target="_blank" rel="noopener noreferrer">' + tx +
      '</a>' : tx;
  };
  var chips = [e.modalidad, e.cupos ? 'Cupos: ' + e.cupos : '', e.premios].filter(Boolean)
    .map(function (x) { return '<span class="vi-chip">' + esc(x) + '</span>'; }).join('');
  return '<div class="vi-prox" style="--c:' + esc(colorSv(e.sv)) + '">' +
    '<div class="vi-cab">' + logoSv(e.sv, 40) + '<div><span class="vi-sv">' + esc(nombreSv(e.sv)) +
      etiquetaMult(e.sv, iso) + (esDorado(e) ? '<span class="xm oro" title="El evento dorado de la semana: ' +
        'vale &times;3 encima de su multiplicador">&#127775; dorado</span>' : '') +
      (esCopa(e) ? '<span class="xm oro" title="La Copa de la Liga: vale &times;2">&#127942; Copa</span>' : '') +
      (e.ct ? '<span class="xm ct" title="Anunciado con 12 horas o más">&#128227; con tiempo</span>' : '') +
      '</span><b class="vi-n">' + ir(esc(e.nombre) + (e.link ? '<i class="ir">&#8599;</i>' : '')) +
      '</b></div></div>' +
    (e.sin_hora
      ? '<p class="vi-cuando"><span>Anunciado ' + esc(cuandoSe(e.cuando)) + '</span></p>'
      : '<div class="vi-cuando"><span>' + esc(fmtFecha(iso, { weekday: 'long', day: 'numeric',
          month: 'long' })) + ' &middot; <b>' + esc(fmtHora(iso)) + ' ' + etiquetaHora(iso) + '</b></span>' +
        '<span class="reloj" data-t="' + esc(t) + '">&middot;</span></div>') +
    (chips ? '<div class="vi-chips">' + chips + '</div>' : '') +
    '<div class="vi-acc">' +
      (e.sin_hora ? '' : '<a class="btn" href="' + esc(googleEv({ t: iso, n: e.nombre, sv: e.sv,
        link: e.link })) + '" target="_blank" rel="noopener noreferrer">&#128197; Agregar a Google Calendar</a>') +
      (e.link ? '<a class="btn sec" href="' + esc(e.link) + '" target="_blank" ' +
        'rel="noopener noreferrer">Ver el anuncio</a>' : '') +
      '<a class="btn sec" href="#/avisos">&#128276; Avisame</a>' +
    '</div></div>';
}

/* ── los dos campeones ─────────────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «al costado del campeón de la temporada poner entre
   paréntesis "actual", porque no acabó la temporada, y al costado poner el
   campeón del competitivo también».

   ⚠️ EL DEL COMPETITIVO PUEDE ESTAR VACANTE, y eso se dice: el rango pide
   su requisito de eventos y al arrancar la temporada no lo tiene nadie. Un
   hueco que explica por qué está vacío —y quién está más cerca— dice más
   que esconderlo. */
function reqDe(id) {
  var q = (D.requisitos || []).filter(function (x) { return x.id === id; })[0];
  var m = q && /(\d+)/.exec((q.pide || [])[0] || '');
  return m ? +m[1] : 0;
}
function campeon(f, cual, tit) {
  // ⚠️ SIN «(ACTUAL)»: Dlx lo pidió a las 6:30 y lo sacó a las 8 del mismo
  // 25/09/2026, «quita el (actual) que dice en inicio»
  // ⚠️ SIN EL NOMBRE DEBAJO. Dlx, 27/09/2026: «que digan Hassan y Makmah otra
  // vez cuando en la tarjeta sale el nombre es innecesario». El nombre sigue
  // en el `alt` y en el `title`, para quien no ve la imagen.
  return '<div class="hero-carta"><span class="corona">' + esc(tit) +
    '</span><button class="hc-marco" data-carta="' + esc(f.k) + '" title="' + esc(f.n) + '">' +
    '<img src="' + urlCarta(f, cual) + '" alt="Tarjeta de ' + esc(f.n) +
    '" width="300" height="438"></button></div>';
}
/* 🔑 «LÍDER» MIENTRAS SE JUEGA, «CAMPEÓN» CUANDO TERMINA. Dlx, 27/09/2026:
   «no son campeones todavía, son top 1». El rótulo sale de las fechas de
   la temporada (`D.fase`): el día después del cierre pasa solo a Campeón. */
function temporadaCerrada() {
  var t = D.fase && diaLocal(D.fase.termina);
  return !!t && Date.now() > t.getTime() + 86400000;
}
function pintaCampeones() {
  var T = oficiales(), h = [];
  var quien = temporadaCerrada() ? 'Campeón' : 'Líder';
  var uno = T[0];
  var comp = T.filter(function (f) { return f.rg; }).sort(function (a, b) {
    return (b.sc || 0) - (a.sc || 0);
  })[0];
  // 🔴 CADA UNO POR SU LADO. Si el líder de la temporada no tenía tarjeta
  // —sin verificar, por ejemplo— se escondían las dos, también la del
  // competitivo, que sí existía. Sin tarjeta, su lugar dice quién es y por qué.
  var sinCarta = function (f, tit) {
    return '<div class="hero-carta vacante"><span class="corona">' + esc(tit) + '</span>' +
      '<div class="hc-vacio"><p class="hc-cerca" data-k="' + esc(f.k) + '">' + quienEs(f, 34) + '</p>' +
      // 🔑 SIN VERIFICAR YA NO ES SIN TARJETA (las LIBRES, 29/09/2026): la
      // Temporada es de todos los que juegan estando en la Lista.
      '<p>Su tarjeta todavía no está.</p></div></div>';
  };
  if (uno) {
    h.push((uno.c || []).length ? campeon(uno, uno.c[0], quien + ' de la temporada')
      : sinCarta(uno, quien + ' de la temporada'));
  }
  if (comp && (comp.c || []).length) {
    h.push(campeon(comp, comp.c.indexOf('competitivo') >= 0 ? 'competitivo' : comp.c[0],
      quien + ' del competitivo'));
  } else if (comp) {
    h.push(sinCarta(comp, quien + ' del competitivo'));
  } else if (h.length) {
    var pide = reqDe('competitivo') || 10;
    var cerca = T.slice().sort(function (a, b) { return (b.ev || 0) - (a.ev || 0); })[0];
    h.push('<div class="hero-carta vacante"><span class="corona">' + quien + ' del competitivo</span>' +
      '<div class="hc-vacio"><span class="hc-candado" aria-hidden="true">&#128274;</span>' +
      '<b>Vacante</b><p>Se define a los <b>' + pide + ' eventos</b>, y todavía no llegó nadie.</p>' +
      (cerca ? '<p class="hc-cerca" data-k="' + esc(cerca.k) + '"><small>El más cerca</small>' +
        quienEs(cerca, 26) + '<u>' + (cerca.ev || 0) + ' de ' + pide + '</u></p>' : '') +
      '</div></div>');
  }
  if (!h.length) return;
  $('#campeones').innerHTML = h.join('');
  $('#campeones').classList.toggle('dos', h.length > 1);
  $('#campeones').hidden = false;
}

/* ── el servidor, con su logo ──────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «donde dice Freestyle For All poner el logo del
   servidor también». Un solo lugar para la pastilla: «Lo que pasó», el
   calendario y la cabecera de Eventos la usan igual. */
function logoSv(sv, tam) {
  var x = svDe(sv);
  return x.logo ? '<img class="sv-mini" src="' + esc(x.logo) + '" alt="" width="' + tam +
    '" height="' + tam + '" loading="lazy" decoding="async">' : '';
}
/* 🔑 LOS PUNTOS DE ASCENSO DE ESE RANGO, EN SU SERVIDOR. Dlx, 27/09/2026,
   con la tabla de Snake Rap: «Rango 4» dice poco sin saber que al 1° le da
   1.000. Son de SU ranking, no de la Liga. */
function puntosRango(sv, rg) {
  var t = svDe(sv).rangos, m = /^Rango (\w+)$/.exec(String(rg || ''));
  var ps = t && m && t[m[1]];
  return ps ? ps.map(function (p, i) { return (i < 3 ? (i + 1) + '°' : '4°') + ' ' + num(p); }).join(' · ') : '';
}
function tituloRango(sv, rg) {
  var p = puntosRango(sv, rg);
  return 'El rango de este evento en ' + nombreSv(sv) + (p ? ': ' + p + ' puntos de ascenso en ' +
    nombreSv(sv) + ' (no en la Liga)' : '');
}
/* ── los multiplicadores de la semana ──────────────────────────────────
   🔑 Dlx, 27/09/2026: «cada semana haya un multiplicador de puntos… FFA x1,
   Snake Rap 2x, URBF x5… debuffs también». Salen de `D.mult` (el sorteo de
   `bot/multiplicadores.py`) y valen para los Puntos de la Temporada: el
   Competitivo y el Most Wanted no cambian. */
function xMult(x) { return '&times;' + String(x).replace('.', ','); }
function claseMult(x) { return x < 1 ? 'baja' : x >= 5 ? 'x5' : x > 1 ? 'sube' : ''; }
/* el de un evento de ese servidor a esa hora, si cae en la semana sorteada */
function multDe(sv, cuando) {
  var M = D.mult;
  if (!M || !sv || !M.sv || M.sv[sv] == null) return null;
  var t = cuando ? new Date(cuando).getTime() : Date.now();
  return t >= new Date(M.ini).getTime() && t < new Date(M.fin).getTime() ? M.sv[sv] : null;
}
function etiquetaMult(sv, cuando) {
  var x = multDe(sv, cuando);
  return x == null || x === 1 ? '' : '<span class="xm ' + claseMult(x) + '" title="Esta semana los puntos de ' +
    'Temporada de ' + esc(nombreSv(sv)) + ' valen ' + String(x).replace('.', ',') + ' veces">' + xMult(x) + '</span>';
}
function pintaMult() {
  var M = D.mult, sec = $('#secMult');
  if (!sec) return;
  var svs = M && M.sv ? Object.keys(M.sv) : [];
  if (!svs.length || Date.now() >= new Date(M.fin).getTime()) { sec.hidden = true; return; }
  svs.sort(function (a, b) { return M.sv[b] - M.sv[a] || a.localeCompare(b); });
  $('#multBaj').innerHTML = 'Los puntos de Temporada de cada evento, hasta el ' +
    esc(fmtFecha(M.fin, { weekday: 'long' })) + ' a las ' + esc(fmtHora(M.fin)) + ' ' + etiquetaHora(M.fin) +
    '. El Competitivo no cambia.';
  $('#multLista').innerHTML = svs.map(function (sv) {
    var x = M.sv[sv], pr = (M.premios || {})[sv] || [];
    return '<div class="mt ' + claseMult(x) + '" style="--c:' + esc(colorSv(sv)) + '">' + logoSv(sv, 32) +
      // la sigla arriba y el número abajo: en un renglón, «Discord Rap Español»
      // se cortaba en «Discord Rap…» y hasta «FFA» quedaba en «F…»
      '<div class="mt-t"><span class="mt-n" title="' + esc(nombreSv(sv)) + '">' + esc(sv) + '</span><b>' +
      xMult(x) + '</b></div>' +
      (x < 1 ? '<small>debuff</small>' : x >= 5 ? '<small>jackpot</small>' : pr.length ? '<small class="gw">' +
        pr.map(function (p) {
          return p === 'guerra' ? 'ganó la guerra' : p === 'semillero' ? 'semillero'
            : p === 'votado' ? 'lo votó la gente' : esc(p);
        }).join(' + ') + '</small>' : '') +
      '</div>';
  }).join('');
  $('#multPremios').innerHTML = premiosMult(M);
  $('#multMeta').innerHTML = metaMult(M);
  sec.hidden = false;
  pintaMultPags();
}
/* cada regla, entera, está en la Guía: acá va lo de esta semana */
var GUIA_MULT = '<p class="nota mp-guia"><a href="#/guia">Cómo funciona cada uno, en la Guía &#8250;</a></p>';
/* un renglón de las páginas de abajo: el ícono, qué es y lo de esta semana */
function renglonMult(ico, que, txt) {
  return '<div class="mp-r"><span class="mp-i" aria-hidden="true">' + ico + '</span><div><b>' + que +
    '</b><span>' + txt + '</span></div></div>';
}
/* 🔑 LOS PREMIOS DE LA SEMANA, UN RENGLÓN CADA UNO. Dlx, 27/09/2026: «me
   gustan todas»; y el 28/09, «es demasiado»: eran párrafos. Las reglas
   viven en bot/multiplicadores.py; la Guía las explica enteras. */
function premiosMult(M) {
  var ls = [], dd = M.dorado, g = M.guerra, a = M.ant || {}, c = M.copa, o = M.organizadores || [];
  if (M.votado) {
    ls.push(renglonMult('&#128499;&#65039;', 'Lo votó la gente', '<b>' + esc(nombreSv(M.votado.sv)) + '</b> salió con ' +
      '&times;2 como mínimo (' + M.votado.votos + ' de ' + M.votado.de + ' votos)'));
  }
  if (dd) {
    ls.push(renglonMult('&#127775;', 'Evento dorado', dd.n
      ? '<b>' + esc(dd.nombre || '#' + dd.n) + '</b> (' + esc(nombreSv(dd.sv)) + ') valió &times;3'
      : 'el primer evento de <b>' + esc(nombreSv(dd.sv)) + '</b> desde el ' +
        esc(fmtFecha(dd.desde, { weekday: 'long', day: 'numeric' })) + ' vale <b>&times;3</b>'));
  }
  if (g && (g.pares || []).length) {
    ls.push(renglonMult('&#9876;&#65039;', 'Guerra de servidores', g.pares.map(function (p) {
      return esc(p[0]) + ' vs ' + esc(p[1]);
    }).join(' &middot; ') + ': el que más puntos hace por persona lleva &times;1,5 la semana que viene'));
  }
  if (c) {
    ls.push(renglonMult('&#127942;', 'Copa de la Liga', c.n
      ? '<b>' + esc(c.nombre || '#' + c.n) + '</b>, de ' + orgHtml(c.org, 18) + ', valió &times;2'
      : 'el próximo evento que organice ' + orgHtml(c.org, 18) + ' vale <b>&times;2</b>'));
  }
  if (o.length) {
    ls.push(renglonMult('&#127908;', 'Organizador de la semana', 'va primero ' + orgHtml(o[0][0], 18) + ', con ' +
      o[0][1] + ' raperos en ' + o[0][2] + (o[0][2] === 1 ? ' evento' : ' eventos') +
      ': organiza la Copa de la semana que viene'));
  }
  ls.push(renglonMult('&#127873;', 'Bonos', 'tu 2.º evento dentro de los 7 días del primero, <b>&times;1,5</b> &middot; ' +
    '3 servidores en la semana, <b>+1.500</b> &middot; 3 días distintos, <b>+1.000</b>'));
  // 🔑 LA SEMANA PASADA, EN UN RENGLÓN
  var ps = a.premios_semana || {}, pp = [];
  if (ps.figura) pp.push('figura <b>' + esc(ps.figura[0]) + '</b>');
  if (ps.revelacion) pp.push('revelación <b>' + esc(ps.revelacion[0]) + '</b>');
  if (ps.cazador) pp.push('cazador <b>' + esc(ps.cazador[0]) + '</b>');
  if (ps.servidor) pp.push('servidor <b>' + esc(nombreSv(ps.servidor[0])) + '</b>');
  if (a.guerra && (a.guerra.gana || []).length) {
    pp.push('ganaron la guerra <b>' + a.guerra.gana.map(function (s) { return esc(nombreSv(s)); }).join(' y ') + '</b>');
  }
  if (a.semillero && a.semillero.gana) pp.push('semillero <b>' + esc(nombreSv(a.semillero.gana)) + '</b>');
  if (pp.length) ls.push(renglonMult('&#127941;', 'La semana pasada', pp.join(' &middot; ')));
  return ls.join('') + GUIA_MULT;
}
/* 🔑 LA META DE COMUNIDAD, CON SUS BARRAS, Y EL SEMILLERO */
function metaMult(M) {
  var ls = [], me = M.metas, va = M.meta_va || {}, se = M.semillero;
  if (me && Object.keys(me).length) {
    ls.push(renglonMult('&#127919;', 'Meta de comunidad', 'si un servidor junta esta gente distinta en la semana, ' +
      'todos los que jugaron ahí suman <b>+10 %</b>') + '<span class="metas">' + Object.keys(me).sort(function (p, q) {
        return me[q] - me[p] || p.localeCompare(q);
      }).map(function (sv) {
        var n = va[sv] || 0, m = me[sv], ya = n >= m;
        return '<span class="meta' + (ya ? ' ok' : '') + '"><b>' + esc(sv) + '</b><i><u style="width:' +
          Math.min(100, Math.round(100 * n / m)) + '%"></u></i><small>' + n + '/' + m + (ya ? ' &#10003;' : '') +
          '</small></span>';
      }).join('') + '</span>');
  }
  var va1 = '';
  if (se && se.nuevos) {
    var r = Object.keys(se.nuevos).filter(function (s) { return se.nuevos[s] >= 3 && (se.gente || {})[s]; })
      .sort(function (p, q) { return se.nuevos[q] / se.gente[q] - se.nuevos[p] / se.gente[p]; });
    if (r.length) va1 = '. Va primero <b>' + esc(nombreSv(r[0])) + '</b>, con ' + se.nuevos[r[0]] + ' nuevos de ' +
      se.gente[r[0]];
  }
  ls.push(renglonMult('&#127793;', 'Semillero', 'el servidor que más gente trae por primera vez (en proporción, ' +
    '3 como mínimo) lleva <b>&times;1,5</b> la semana que viene' + va1));
  return ls.join('') + GUIA_MULT;
}
/* 🔑 LAS PÁGINAS DEL PANEL (Dlx, 28/09/2026: «A»): las mismas flechas y
   puntitos que el panel de la derecha. Una página sin nada —la votación
   cuando no hay ninguna abierta— no se cuenta. */
var MP = { pag: 0 };
function pintaMultPags() {
  var sec = $('#secMult');
  if (!sec) return;
  var todas = $$('#secMult .mp-pag');
  var pags = todas.filter(function (p) {
    return p.querySelector('#encX2') ? !$('#encX2').hidden : !!p.textContent.trim();
  });
  if (!pags.length) return;
  MP.pag = Math.max(0, Math.min(MP.pag, pags.length - 1));
  todas.forEach(function (p) { p.hidden = p !== pags[MP.pag]; });
  $('#mpTit').innerHTML = pags[MP.pag].dataset.tit || '';
  $('#mpDots').innerHTML = pags.map(function (p, i) {
    return '<button type="button" class="pn-dot' + (i === MP.pag ? ' on' : '') + '" data-mp="' + i +
      '" aria-label="Página ' + (i + 1) + '"></button>';
  }).join('');
  $('#mpNav').hidden = pags.length < 2;
  $('#mpAntes').disabled = MP.pag === 0;
  $('#mpDespues').disabled = MP.pag === pags.length - 1;
}
/* el próximo evento del organizador que tiene la Copa */
function claveOrg(s) {
  return String(s || '').replace(/^[@!\s]+/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '').toLowerCase();
}
function esCopa(e) {
  var c = D.mult && D.mult.copa;
  if (!c || c.n || !e.org || e.sin_hora || claveOrg(e.org) !== c.clave) return false;
  var t = function (x) { return new Date(String(x.cuando || '').replace(/Z$/, '') + 'Z').getTime(); };
  var fin = new Date(D.mult.fin).getTime();
  var cands = (D.proximos || []).filter(function (x) {
    return !x.sin_hora && x.org && claveOrg(x.org) === c.clave && t(x) < fin;
  }).sort(function (x, y) { return t(x) - t(y); });
  return cands[0] === e;
}
/* el próximo evento que puede ser el dorado: el primero de su servidor desde su día */
function esDorado(e) {
  var dd = D.mult && D.mult.dorado;
  if (!dd || dd.n || e.sv !== dd.sv || e.sin_hora) return false;
  var t = function (x) { return new Date(String(x.cuando || '').replace(/Z$/, '') + 'Z').getTime(); };
  var desde = new Date(dd.desde).getTime(), fin = new Date(D.mult.fin).getTime();
  var cands = (D.proximos || []).filter(function (x) {
    return x.sv === dd.sv && !x.sin_hora && t(x) >= desde && t(x) < fin;
  }).sort(function (x, y) { return t(x) - t(y); });
  return cands[0] === e;
}
function chipSv(sv) {
  return '<span class="chip-sv" style="--c:' + esc(colorSv(sv)) + '">' + logoSv(sv, 18) +
    esc(nombreSv(sv) || sv) + '</span>';
}

/* ── lo que acaba de pasar ────────────────────────────────────────── */
function pintaPasados() {
  // 🔑 LOS TRES MÁS NUEVOS, con quién organizó y quién ganó. Dlx,
  // 25/09/2026: «que se vea los 3 eventos más recientes en lo que pasó, y
  // que se vea más bonito… quizás nombrar al organizador también». El
  // resto está en «Eventos».
  var ps = (D.pasados || []).slice(0, 3);
  if (!ps.length) { apaga('#secPaso'); return; }
  $('#secPaso').hidden = false;
  $('#pasados').innerHTML = ps.map(function (e) {
    var L = e.llave && (D.llaves || {})[e.llave];
    var camp = L ? (L.tabla || []).filter(function (r) { return r[1] === 'Campeón'; })
      .map(function (r) {
        var f = porK(r[3] || kDe(r[0]));
        return f ? quienEs(f, 22) : conBanderas(r[0]);
      }) : [];
    var datos = [e.org ? 'Organizó ' + orgHtml(e.org, 18) : '',
      L && L.participantes ? L.participantes + ' raperos' : '',
      e.modalidad ? esc(e.modalidad) : ''].filter(Boolean).join(' &middot; ');
    // 🔑 EL RANGO DEL EVENTO, cuando el anuncio lo dice: es el de SU
    // servidor («aplica solo para el servidor local», Dlx 25/09/2026).
    var rg = e.rango ? '<span class="rg-ev" title="' + esc(tituloRango(e.sv, e.rango)) + '">' +
      esc(e.rango) + '</span>' : '';
    return '<article class="ps" style="--c:' + esc(colorSv(e.sv)) + '">' +
      '<header><span class="ps-chips">' + chipSv(e.sv) + etiquetaMult(e.sv, e.cuando) + rg + '</span>' +
      '<span class="hace">' + esc(cuandoSe(e.cuando)) + '</span></header>' +
      '<h3>' + esc(e.nombre) + '</h3>' +
      (datos ? '<p class="ps-d">' + datos + '</p>' : '') +
      (camp.length ? '<p class="ps-c"><span>&#127942;</span>' + camp.join('<i class="coma">,</i> ') + '</p>' : '') +
      // ⚠️ LOS BOTONES DEL COLOR DEL SERVIDOR, como el «Entrar» de Mundo:
      // Dlx, 25/09/2026, «hacer los botones más bonitos, quizás como los
      // que tienen los servidores»
      '<div class="ps-acc">' +
        (L ? '<button class="btn" data-llave="' + esc(e.llave) + '">&#127942; Ver llave</button>' : '') +
        (e.link ? '<a class="btn sec" href="' + esc(e.link) + '" target="_blank" rel="noopener ' +
          'noreferrer">El anuncio &#8599;</a>' : '') +
      '</div></article>';
  }).join('');
}

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
var VIVO = { llaves: [] }, VIVO_L = {}, VIVO_TIMER = null, VIVO_PEDIDO = 0;
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
/* ¿Cuál de las llaves en vivo es la de este anuncio? El mismo servidor, publicada
   desde una hora antes hasta cinco después de la hora del anuncio y, si hay más
   de una, la que comparte palabras con el nombre. ⚠️ Con un solo candidato
   también tiene que compartir alguna, salvo que la llave no tenga título: dos
   eventos del mismo servidor en la misma noche no se confunden. */
// las palabras que están en el nombre de cualquier evento: no alcanzan para decir que una llave es de ése
var RELLENO_LL = { vol: 1, volumen: 1, edicion: 1, fecha: 1, the: 1, los: 1, las: 1, del: 1, con: 1, por: 1,
  una: 1, uno: 1, '1v1': 1, '2v2': 1, '3v3': 1, '4v4': 1, '1vs1': 1, '2vs2': 1, '3vs3': 1, '4vs4': 1 };
// `[temporada, edición]` de un nombre, en dígitos: lo mismo que `_numeros()` de sheet/llaves_web.py. Sin la
// modalidad («1v1», «2VS2», «1🆚1») ni la temporada del organizador («T2») mezcladas en la edición
function numerosLL(s) {
  var t = '';
  s = String(s || '').normalize('NFKD').replace(/🆚/g, 'vs').replace(/[︎️]/g, '')
    .replace(/(^|[^a-z0-9])\d+\s*(?:vs|v|x)\s*\d+(?![a-z0-9])/gi, '$1 ')
    .replace(/(^|[^a-z0-9])(?:temporada|season|temp|t)\s*[.#:-]?\s*(\d+)/gi, function (m, a, d) { t += d; return a + ' '; });
  return [t, s.replace(/\D/g, '')];
}
// ¿se contradicen? Dos ediciones distintas sí («VOL 20» y «Vol 2»); un número contra ninguno, no
function chocanLL(x, y) {
  var a = numerosLL(x), b = numerosLL(y);
  return !!((a[1] && b[1] && a[1] !== b[1]) || (a[0] && b[0] && a[0] !== b[0]));
}
function llaveDeEvento(e, ls) {
  var t = Date.parse(String(e.cuando || '').replace(/Z$/, '') + 'Z');
  // ⚠️ NFKD ANTES de pasar a minúsculas: `𝓟𝓞𝓔𝓢Í𝓐 𝓒𝓡𝓤𝓓𝓐` (URBF, 01/10/2026) sale de NFKD en MAYÚSCULAS, y al revés
  // el filtro de abajo se comía el título entero
  var pal = function (s) {
    return String(s || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length > 2; });
  };
  var pe = pal(e.nombre);
  // 🔴 «VOL» NO DICE NADA, Y LOS NÚMEROS SÍ (01/10/2026, Dlx: «ahora hay 3 en vivos, CHEQUEA»): «DESGRACIAS EN TOKYO
  // VOL 20 1v1» se llevaba la llave en vivo de «Dos Generaciones Un Destino Vol 2» —las dos de FFA, el mismo día—
  // por la palabra «vol», y salía en vivo tres horas después de empezar. Ahora una palabra de relleno no junta, y
  // dos ediciones distintas no se juntan nunca: la regla de `_chocan()` de sheet/llaves_web.py
  var comun = function (L) {
    return pal(L.nombre).filter(function (w) { return !RELLENO_LL[w] && pe.indexOf(w) >= 0; }).length;
  };
  var cand = (ls || []).filter(function (L) {
    var p = L.pub || L.ed || 0;
    return (!e.sv || !L.sv || e.sv === L.sv) && p >= t - 3600000 && p <= t + 5 * 3600000 &&
      !chocanLL(e.nombre, L.nombre) &&
      (comun(L) > 0 || !pal(L.nombre).length || L.nombre === 'La llave');
  });
  cand.sort(function (a, b) { return comun(b) - comun(a); });
  return cand[0] || null;
}
function pintaVivo() {
  var caja = $('#vivoLista'), sec = $('#secVivo');
  if (!caja || !sec || !window.LlaveVivo) return;
  var ya = llavesHechas(), ahora = Date.now();
  var bloques = LlaveVivo.unirPartidas((VIVO.llaves || []).filter(function (m) { return !ya[m.id]; }));
  VIVO_L = {};
  var ls = bloques.map(function (b) {
    try { return LlaveVivo.aLlave(b); } catch (e) { console.error('[llave en vivo]', e); return null; }
  }).filter(function (L) {
    // en vivo = la tocaron en las últimas tres horas
    return L && L.rondas.length && ahora - (L.ed || L.pub || 0) < 3 * 3600000;
  });
  // 🔑 Y LOS 5 VIDAS DE LOS VEREDICTOS (ver `LlaveVivo.veredictos()`): sin
  // llave, con el nombre del anuncio que les corresponde
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
  // 🔴 EL MISMO EVENTO, UNA VEZ. DESGRACIAS EN TOKYO VOL 15 MULTIVERSE (FFA,
  // 28/09/2026) se sorteó dos veces y la llave vieja quedó en el canal: «En
  // vivo» mostraba dos tarjetas del mismo evento, con 14 y 17 raperos. Mismo
  // servidor y mismo nombre en estas tres horas es el mismo evento: queda la
  // más nueva (el lector del ciclo hace lo mismo, `sin_sorteos_viejos()`).
  var visto = {};
  ls = ls.slice().sort(function (a, b) { return (b.pub || 0) - (a.pub || 0); }).filter(function (L) {
    var k = LlaveVivo.norm(L.nombre || '');
    // sin título no se sabe si son el mismo: «La llave» es el de relleno
    if (!k || L.veredictos || L.nombre === 'La llave') return true;
    k = (L.sv || '') + '|' + k;
    if (visto[k]) return false;
    visto[k] = 1;
    return true;
  }).sort(function (a, b) { return ls.indexOf(a) - ls.indexOf(b); });
  ls.forEach(function (L) { VIVO_L[L.id] = L; });
  // 🔑 Y LO QUE EMPEZÓ SIN LLAVE A LA VISTA. Con dos eventos a la vez se veía
  // uno: la SNAKE ARENA (27/09/2026) era un 5 vidas y se jugaba en
  // #veredictos, donde no hay llave que leer. El anuncio dice que empezó, y
  // eso se muestra —hasta `vivo_min` después, como «Lo que viene»—; si
  // aparece su llave, queda la llave.
  var vent = (D.vivo_min || 90) * 60000;
  var emp = (D.proximos || []).filter(function (e) {
    var t = Date.parse(String(e.cuando || '').replace(/Z$/, '') + 'Z');
    return empezo(e) && ahora - t < vent && !llaveDeEvento(e, ls);
  });
  sec.hidden = !ls.length && !emp.length;
  caja.innerHTML = ls.map(function (L) {
    return '<article class="vv" style="--c:' + esc(colorSv(L.sv)) + '">' +
      '<header><span class="ps-chips">' + chipSv(L.sv) + '</span><span class="vv-t">' +
        esc(cuandoSe(new Date(L.ed || L.pub).toISOString())) + '</span></header>' +
      '<h3>' + esc(L.nombre) + '</h3>' +
      '<p class="vv-e"><i class="vivo-punto" aria-hidden="true"></i><span>' +
        (L.terminada ? 'Terminó: los puntos llegan en la próxima vuelta del ciclo'
          : L.veredictos ? '<b>' + esc(L.rondas[0].r) + '</b> &middot; ' + esc(L.enJuego) + ' en juego'
          : '<b>' + esc(L.enJuego || 'En juego') + '</b> en juego') +
        (L.participantes ? ' &middot; ' + L.participantes + ' raperos' : '') + '</span></p>' +
      '<div class="ps-acc"><button class="btn" data-llave="v:' + esc(L.id) + '">Ver la llave</button>' +
        (L.links[0] ? '<a class="btn sec" href="' + esc(L.links[0]) + '" target="_blank" rel="noopener noreferrer">' +
          'Discord &#8599;</a>' : '') + '</div></article>';
  }).join('') + emp.map(function (e) {
    var iso = String(e.cuando || '').replace(/Z$/, '') + 'Z';
    return '<article class="vv vv-sin" style="--c:' + esc(colorSv(e.sv)) + '">' +
      '<header><span class="ps-chips">' + chipSv(e.sv) + etiquetaMult(e.sv, iso) + '</span><span class="vv-t">' +
        'empezó ' + esc(cuandoSe(iso)) + '</span></header>' +
      '<h3>' + esc(e.nombre) + '</h3>' +
      '<p class="vv-e"><i class="vivo-punto" aria-hidden="true"></i><span>Empezó a las <b>' +
        esc(fmtHora(iso)) + '</b> ' + etiquetaHora(iso) + ' &middot; la llave todavía no está publicada: ' +
        'se sigue en Discord</span></p>' +
      (e.link ? '<div class="ps-acc"><a class="btn sec" href="' + esc(e.link) + '" target="_blank" ' +
        'rel="noopener noreferrer">Ver el anuncio &#8599;</a></div>' : '') + '</article>';
  }).join('');
  // 📡 y el día abierto del calendario de Eventos: su «Ver la llave en vivo»
  try { if (typeof CAL !== 'undefined' && CAL.dia && $('#diaLista')) pintaDia(); } catch (e) {
    console.error('[pintaDia]', e);
  }
  // la que está abierta se redibuja con lo nuevo, sin cerrarse
  // 🔴 SÓLO SI CAMBIÓ, Y EN SU LUGAR. Se redibujaba cada minuto aunque no
  // hubiera nada nuevo, y el teléfono que había deslizado hasta la final
  // volvía a la primera ronda (auditoría del 27/09/2026).
  if (LL && LL.L && LL.L.vivo && !$('#visorLlave').hidden) {
    var nuevo = VIVO_L[LL.L.id];
    if (nuevo) {
      // (y la fase de una nave de funa: una ❌ nueva no cambia ninguna ronda)
      var firma = function (L) { return JSON.stringify([L.rondas, L.participantes, L.terminada, L.funa]); };
      var cambio = firma(nuevo) !== firma(LL.L);
      LL.L = nuevo;
      pintaCabVivo(nuevo);
      if (cambio) pintaVistaLlave(true);
    }
  }
}

/* ── la llave de un evento que ya pasó ────────────────────────────── */
// 🔑 «VER LLAVES». Dlx, 25/09/2026: «un botón de ver llaves de evento y
// vemos ahí la info y las llaves de forma detallada». La llave viaja en
// el mismo payload —`D.llaves`, por número de evento— y el cruce con el
// anuncio lo hace `sheet/llaves_web.py`, con su self-check: acá no se
// adivina nada.
//
// ⚠️ LOS NOMBRES ABREN LA TARJETA de quien está en la tabla, con el mismo
// `data-k` que el resto de la página. Por eso `#visorLlave` va ANTES de
// `#visor` en el HTML: la tarjeta se abre encima y al cerrarla se vuelve
// a la llave.
var MEDALLA = { 'Campeón': '&#129351;', 'Subcampeón': '&#129352;',
                'Tercero': '&#129353;', 'Cuarto': '&#127894;' };

// «Denik 🇵🇪» -> «Denik» con la bandera como imagen. 🔴 LA LLAVE TRAE EL
// NOMBRE COMO SE ESCRIBIÓ, con su emoji, cuando la persona no está en el
// padrón; y en Windows el emoji de bandera son dos letras —«Denik PE»—, que
// es justo lo que Dlx pidió no ver más (25/09/2026). Un país que no está en
// `PAIS` se saca: dos letras sueltas no dicen nada.
function conBanderas(x) {
  var out = '', txt = '', par = '';
  Array.from(String(x == null ? '' : x)).forEach(function (ch) {
    var c = ch.codePointAt(0);
    if (c >= 0x1F1E6 && c <= 0x1F1FF) {
      par += String.fromCharCode(c - 0x1F1E6 + 97);
      if (par.length === 2) {
        out += esc(txt) + bandera(par);
        txt = '';
        par = '';
      }
    } else {
      txt += ch;
    }
  });
  return (out + esc(txt)).trim();
}

/* la llave abierta: para volver a dibujarla al cambiar de vista y para la
   barra de quien se sigue */
var LL = null;
var LL_VISTA = '';
var HOVER = !!(window.matchMedia && window.matchMedia('(hover:hover)').matches);
/* 🔴 LOS LINKS DE LLAVES VIEJAS. `#/llave/<n>` se hizo para pegarlo en
   Discord, y el lobby trae sólo las más nuevas: una llave de hace un mes caía
   al calendario sin decir nada (auditoría del 27/09/2026). Las demás se piden
   aparte (`/api/llaves`), una vez y sólo en ese caso. */
var LLAVES_TODAS = null;
function llaveVieja(n) {
  var dic = function (t) {
    var L = t && t[n];
    if (L) { D.llaves = D.llaves || {}; D.llaves[n] = L; abrirLlave(n); return; }
    avisoLlave('Esa llave no está: puede ser de otra temporada, o el link está mal copiado.');
  };
  if (LLAVES_TODAS) return dic(LLAVES_TODAS);
  fetch('/api/llaves', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (t) { LLAVES_TODAS = t || {}; dic(LLAVES_TODAS); })
    .catch(function () { avisoLlave('No pude traer esa llave. Probá de nuevo en un rato.'); });
}
function avisoLlave(txt) {
  var e = $('#evAviso');
  if (!e) {
    e = document.createElement('p');
    e.id = 'evAviso';
    e.className = 'fase';
    var v = $('.vista[data-vista="eventos"] .bajada');
    if (!v) return;
    v.parentNode.insertBefore(e, v.nextSibling);
  }
  e.textContent = txt;
  e.hidden = false;
}
function abrirLlave(n) {
  // 🔑 `v:<id>` ES UNA LLAVE EN VIVO: la leyó `LlaveVivo`, sin puntos todavía
  var L = String(n).indexOf('v:') === 0 ? VIVO_L[String(n).slice(2)] : (D.llaves || {})[n];
  if (!L) return false;
  // 🔴 Y SIN LA BANDERA: la llave escribe «Mau Kc 🇨🇴» y el ranking «Mau Kc»,
  // así que esa persona salía sin cara y sin link a su perfil. Ver `kDe()`.
  var claveDe = kDe;
  // 🔑 CON SU CARA Y LA BANDERA A LA DERECHA, como en el ranking; tocar
  // un nombre abre su perfil. En un equipo va sin cara: las caras van
  // juntas, adelante (ver `cara`).
  // ⚠️ QUIEN NO ESTÁ EN EL RANKING VA EN UN <span>, no suelto: suelto, su
  // bandera quedaba como hija directa de una caja flex y se estiraba.
  // 🔑 MOST WANTED EN LA LLAVE (Dlx, 27/09/2026): en una llave en vivo, el
  // buscado suelto lleva 🎯 y su recompensa; en una procesada, el que cazaron
  // ACÁ queda marcado para siempre
  var cazas = (D.mw && D.mw.ce && D.mw.ce[String(n)]) || [];
  var cazadoAca = {};
  cazas.forEach(function (c) { cazadoAca[kDe(c[0]) || c[0]] = c; });
  // ⚠️ `perdio`: el 🎯 de la caza va en la batalla que perdió, no en cada
  // renglón donde aparece (en las que ganó antes no lo cazaron)
  var marca = function (f, x, perdio) {
    var k = (f && f.k) || kDe(x) || x;
    if (cazadoAca[k]) {
      return perdio ? '<i class="mw-b cz" title="Lo cazaron acá (' + esc(cazadoAca[k][1]) + ')">&#127919;</i>' : '';
    }
    var b = L.vivo && mwDe((f && f.n) || x);
    return b && b.e === 'suelto' ? '<i class="mw-b" title="Buscado · ' + esc(b.cn) + ' · ' + num(b.v) +
      ' pts">&#127919;</i>' : '';
  };
  // 🔑 EL EQUIPO QUE LA LLAVE NOMBRA CON UN SOLO NOMBRE Y NADIE SABE QUIÉNES
  // SON (`sin`, del lector). Dlx, 29/09/2026: «TEAM VENECIA no es un
  // participante… es un equipo… solo un equipo creado x este evento». Va
  // como equipo —sin cara, sin perfil y sin puntos—, no como una persona.
  // ⚠️ sin el paréntesis: «[ME TIENE SIN CUIDADO (ABYSSUS)]» en la final es
  // el mismo equipo, con quien entró por uno de ellos
  var sinP = function (x) { return normNombre(String(x || '').replace(/[(（][^()（）]*[)）]/g, '')); };
  var sinK = {};
  (L.sin || []).forEach(function (x) { sinK[sinP(x)] = 1; });
  var esSin = function (x) { return !!sinK[sinP(x)]; };
  var quien = function (x, sinCara, perdio) {
    var f = claveDe(x) && porK(claveDe(x));
    // ⚠️ quien tiene perfil es una persona que jugó sola, no un equipo
    if (!f && esSin(x)) {
      return '<span class="ql-n ql-eq" title="Un equipo de este evento: la llave no dice quiénes son, así que no suma puntos">' +
        conBanderas(x) + '<small>equipo</small></span>';
    }
    return f ? '<button class="ql" data-k="' + esc(f.k) + '">' + (sinCara ? '' : avatar(f, 18)) +
      '<span>' + esc(f.n) + '</span>' + (bandera(f.cc) || '') + marca(f, x, perdio) + '</button>'
      : '<span class="ql-n">' + conBanderas(x) + marca(null, x, perdio) + '</span>';
  };
  var cara = function (x) {
    var f = claveDe(x) && porK(claveDe(x));
    if (!f && esSin(x)) return '<span class="av ini av-eq" style="width:20px;height:20px;font-size:11px" aria-hidden="true">&#128101;</span>';
    return avatar(f || { n: String(x || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim() }, 20);
  };
  // los puntos y el puesto de cada uno en esta llave, para la barra de «seguir»
  var pts = {};
  (L.tabla || []).forEach(function (r) { if (claveDe(r[0])) pts[claveDe(r[0])] = [r[1], r[2]]; });
  // ⚠️ EL CUADRO PRIMERO, también en el teléfono. Dlx, 27/09/2026: «que el
  // default sea cuadros, no por rondas». «Por rondas» queda al lado.
  if (!LL_VISTA) LL_VISTA = 'cuadro';
  LL = { n: n, L: L, quien: quien, cara: cara, pts: pts };
  FIJO = '';
  SIGUE_K = '';
  var sv = svDe(L.sv);
  $('#visorLlave .v-pos').innerHTML = sv.logo
    ? '<img class="l-logo" src="' + esc(sv.logo) + '" alt="" width="44" height="44">' : '&#127942;';
  var pas = (D.pasados || []).filter(function (p) { return String(p.llave) === String(n); })[0];
  // 🔑 LA FICHA DEL EVENTO: formato, rango, cuándo, cuántos y quién organizó.
  // Dlx, 25/09/2026: «mejorar significativamente este panel de llaves para
  // que se entienda mejor, y mostrar el formato de eventos… pandillas, 1v1,
  // el rango». El formato y el rango vienen del anuncio (`info`).
  var inf = L.info || {};
  var cal = (D.calendario || []).filter(function (c) { return String(c.ll) === String(n); })[0];
  var mod = inf.mod || (pas && pas.modalidad) || '';
  var rgo = inf.rg || (pas && pas.rango) || '';
  var org = inf.org || (pas && pas.org) || '';
  $('#lNombre').textContent = L.nombre;
  $('#lSub').innerHTML = '<span class="l-chips">' + chipSv(L.sv) + (L.vivo ? etiquetaMult(L.sv) : '') +
    (mod ? '<span class="lch">&#127908; ' + esc(mod) + '</span>' : '') +
    (rgo ? '<span class="rg-ev" title="' + esc(tituloRango(L.sv, rgo)) + '">' + esc(rgo) + '</span>' : '') +
    (puntosRango(L.sv, rgo) ? '<span class="rg-pts">' + esc(puntosRango(L.sv, rgo)) +
      ' pts de ascenso en ' + esc(nombreSv(L.sv)) + '</span>' : '') + '</span>' +
    '<span class="l-datos">' + [cal ? esc(fmtFecha(cal.t, { weekday: 'short', day: 'numeric', month: 'short' })) +
      ' &middot; ' + esc(fmtHora(cal.t)) + ' ' + etiquetaHora(cal.t) : esc(L.fecha),
    L.participantes ? esc(L.participantes) + ' raperos' : '',
    org ? 'organizó ' + orgHtml(org, 18) : '',
    inf.pre ? '&#127941; ' + esc(inf.pre) : ''].filter(Boolean).join(' &middot; ') + '</span>';
  // 🔑 LOS PUNTOS, POR PUESTO: todos los campeones juntos, después los
  // subcampeones… En una llave por equipos, cada equipo queda junto.
  var ORD_P = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos',
    'Dieciseisavos', 'R32'];
  var grupos = {}, orden = [];
  (L.tabla || []).forEach(function (r) {
    if (!grupos[r[1]]) { grupos[r[1]] = []; orden.push(r[1]); }
    grupos[r[1]].push(r);
  });
  orden.sort(function (a, b) {
    var x = ORD_P.indexOf(a), y = ORD_P.indexOf(b);
    return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
  });
  var puntos = orden.map(function (g) {
    return '<div class="pg"><h5>' + (MEDALLA[g] ? MEDALLA[g] + ' ' : '') + esc(g) +
      '<small>' + grupos[g].length + '</small></h5><ul>' + grupos[g].map(function (r) {
        return '<li><span>' + quien(r[0]) + '</span><b>' + num(r[2]) + '</b></li>';
      }).join('') + '</ul></div>';
  }).join('');
  // ⚠️ EL CUADRO ARRIBA y los puntos debajo: lo que se vino a ver es la
  // llave. Ver `cuadro()`.
  var links = (L.links || []).map(function (u, i, t) {
    return '<a class="bajar" href="' + esc(u) + '" target="_blank" ' +
      'rel="noopener noreferrer"><span>' +
      (t.length > 1 ? 'Llave ' + (i + 1) : 'La llave en Discord') +
      '</span><i class="ir">&#8599;</i></a>';
  }).join('') + (L.vivo ? '' : '<button type="button" class="bajar" data-copiar-llave="' + esc(n) + '">' +
    '<i aria-hidden="true">&#128279;</i><span>Copiar el link de esta llave</span></button>');
  // ⚠️ SIN UN «PODIO» APARTE: repetía las cuatro primeras filas de «Los
  // puntos», que ya llevan su medalla. Con el cuadro arriba, el campeón
  // ya está a la vista.
  // 🔑 EL PODIO ARRIBA DEL CUADRO: lo primero que se busca en una llave
  var puesto = function (p) {
    return (L.tabla || []).filter(function (r) { return r[1] === p; });
  };
  var podio = [['Campeón', '&#129351;', 'p1'], ['Subcampeón', '&#129352;', 'p2'],
    ['Tercero', '&#129353;', 'p3']].map(function (p) {
    var rs = puesto(p[0]);
    // ⚠️ UN EQUIPO NO SIEMPRE SUMA PAREJO: en GENESIS el revivido se llevó
    // 3000 y sus compañeros 2500, y el podio decía «3000» para los tres
    var ps = rs.map(function (r) { return +r[2] || 0; });
    var lo = Math.min.apply(null, ps), hi = Math.max.apply(null, ps);
    return rs.length ? '<div class="lp ' + p[2] + '"><span class="lp-m">' + p[1] + '</span>' +
      '<div>' + rs.map(function (r) { return quien(r[0]); }).join('') + '</div>' +
      '<small>' + p[0] + ' · ' + (lo === hi ? num(hi) : num(lo) + ' a ' + num(hi)) + ' pts</small></div>' : '';
  }).join('');
  // 🔑 CÓMO SE LEE, ARRIBA DEL CUADRO. Estaba abajo, en letra chica, y es
  // lo primero que hace falta para entender lo que sigue.
  // ⚠️ CÓMO SEGUIR A ALGUIEN NO VA ACÁ: lo dice la barra de abajo mientras
  // no se sigue a nadie, que es justo cuando hace falta.
  var vid = vidasDe(L);
  var ley = vid ? '<div class="l-ley"><span class="ley-n">' + vid + ' vidas: cada batalla le saca una al que ' +
    'pierde y el que gana se queda. Con ' + vid + ' derrotas quedás afuera, y el lugar es el orden en que ' +
    'cayeron.</span></div>' :
    '<div class="l-ley"><span class="ley-g"><i></i>Ganó y pasa de ronda</span>' +
    '<span class="ley-p"><i></i>Quedó afuera</span><span class="ley-o"><i></i>El camino del campeón</span>' +
    '<span class="ley-n">' + (L.vivo ? 'Se juega ahora: los puntos llegan cuando el ciclo procesa el evento.'
      : 'Arriba de cada ronda, los puntos de quien queda afuera ahí.') + '</span></div>';
  // 🔑 DOS FORMAS DE VERLA: el cuadro, y por rondas de arriba abajo —cómoda en
  // el teléfono, donde el cuadro obliga a correrlo de costado—.
  var vistas = vid ? '' : '<div class="l-vista" role="group" aria-label="Cómo ver la llave">' +
    [['cuadro', 'Cuadro'], ['rondas', 'Por rondas']].map(function (v) {
      return '<button type="button" data-lvista="' + v[0] + '" aria-pressed="' + (LL_VISTA === v[0]) + '">' +
        v[1] + '</button>';
    }).join('') + '</div>';
  // y en una en vivo, quiénes de los buscados juegan: es la invitación a cazar
  var aca = [], visto = {};
  if (L.vivo) {
    (L.rondas || []).forEach(function (R) {
      (R.b || []).forEach(function (b) {
        (b[0] || []).forEach(function (s) {
          String(s || '').split(/,\s*/).forEach(function (m) {
            var y = mwDe(m);
            if (y && y.e === 'suelto' && !visto[y.n]) { visto[y.n] = 1; aca.push(y); }
          });
        });
      });
    });
  }
  var cazaHtml = cazas.length || aca.length ? '<div class="l-mw">' + cazas.map(function (c) {
    return '<p>&#127919; Acá cazaron a <b>' + esc(c[0]) + '</b> (' + esc(c[1]) + '): ' +
      (c[2].length ? 'cobró <b>' + esc(c[2].join(' y ')) + '</b>' : 'no cobró nadie') + '.</p>';
  }).join('') + (aca.length ? '<p>&#127919; ' + (aca.length === 1 ? 'Juega un buscado' : 'Juegan ' + aca.length +
    ' buscados') + ': ' + aca.map(function (y) {
      return '<b>' + esc(y.n) + '</b> (' + esc(y.cn) + ', ' + num(y.v) + ' pts)';
    }).join(', ') + '. Quien le gane, cobra.</p>' : '') + '</div>' : '';
  $('#lCuerpo').innerHTML = (podio ? '<div class="lpod">' + podio + '</div>' : '') + cazaHtml +
    ley + vistas + '<div class="l-sigue" id="lSigue" aria-live="polite"></div><div id="lVista"></div>' +
    (puntos ? '<h4>Los puntos, por puesto</h4><div class="pgs">' + puntos + '</div>' : '') +
    '<div class="v-acc">' + links +
    // 🔑 ¿ALGO ESTÁ MAL? (Dlx, 28/09/2026: «ok»): lo revisa la Liga, nunca por DM
    '<button type="button" class="bajar" data-rep-abrir><i aria-hidden="true">&#9873;</i>' +
    '<span>¿Algo está mal en esta llave?</span></button></div>' +
    '<div class="l-rep" id="lRep" hidden></div>';
  if (L.vivo) pintaCabVivo(L);
  // ⚠️ VISIBLE ANTES DE DIBUJAR: escondido, el cuadro mide 0 de ancho y no
  // había cómo centrarlo en la final (arrancaba en los octavos)
  $('#visorLlave').hidden = false;
  pintaVistaLlave();
  $('#lCuerpo').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  return true;
}
/* ── ¿algo está mal en esta llave? ────────────────────────────────────
   🔑 Dlx, 28/09/2026, a «"Reportar un error" en cada llave: quien ve mal su
   batalla la marca desde la página y va a ✅ Decidir, nunca por DM»: «ok».
   Quién reporta lo dice Discord —la sesión de Mi cuenta—, no la página: sin
   haber entrado se le pide que entre. Lo lee el ciclo (`bot/reportes.py`) y
   lo pone en la sección de su evento. Ver `validarReporte()` en avisos.js. */
var REP_QUE = [['ganador', 'El ganador está mal'], ['gente', 'Falta o sobra alguien'],
  ['nombre', 'Un nombre está mal'], ['otro', 'Otra cosa']];
var REP = { que: '' };
function pintaReporte(est) {
  var el = $('#lRep');
  if (!el) return;
  el.innerHTML = '<p class="rep-t">Contanos qué está mal y lo revisa la Liga.</p>' +
    '<div class="rep-q" role="group" aria-label="Qué está mal">' + REP_QUE.map(function (q) {
      return '<button type="button" data-rep-que="' + q[0] + '" aria-pressed="' + (REP.que === q[0]) + '">' +
        esc(q[1]) + '</button>';
    }).join('') + '</div>' +
    '<textarea id="lRepTxt" maxlength="300" rows="3" placeholder="Qué batalla y qué pasó' +
      (REP.que === 'otro' ? '' : ' (si querés)') + '">' + esc(REP.txt || '') + '</textarea>' +
    '<div class="rep-pie"><button type="button" class="btn" data-rep-enviar' +
      (REP.que && !REP.va ? '' : ' disabled') + '>' + (REP.va ? 'Enviando…' : 'Enviar') + '</button>' +
    '<span class="rep-est" aria-live="polite">' + (est || '') + '</span></div>' +
    // lo que se guarda, dicho al lado de «Enviar» (auditoría legal del 01/10/2026)
    '<p class="rep-nota">Se guarda con tu cuenta de Discord 30 días, para revisarlo.</p>';
}
function enviarReporte() {
  var t = (($('#lRepTxt') && $('#lRepTxt').value) || '').replace(/\s+/g, ' ').trim();
  REP.txt = t;
  if (!REP.que || !LL || REP.va) return;
  if (REP.que === 'otro' && t.length < 3) { pintaReporte('Contá qué pasó.'); return; }
  REP.va = true;
  pintaReporte();
  conCuenta('/api/avisos/reportar', { llave: String(LL.n), que: REP.que, texto: t })
    .then(function (j) {
      REP.va = false;
      if (j && j.ok) {
        REP = { que: '' };
        var el = $('#lRep');
        if (el) el.innerHTML = '<p class="rep-ok">&#10003; ¡Gracias! Lo revisa la Liga.</p>';
        return;
      }
      var e = (j && j.error) || '';
      pintaReporte(errorCuenta(e) || (j && j.status === 401 ? 'Para reportar, entrá con Discord desde Mi cuenta.'
        : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva para reportar.'
        : e === 'tope' ? 'Ya mandaste varios hoy: probá mañana.'
        : 'No pude mandarlo. Probá de nuevo en un rato.'));
    })
    .catch(function () { REP.va = false; pintaReporte('No pude mandarlo. Probá de nuevo en un rato.'); });
}
/* la ficha de una llave en vivo: no tiene puntos ni fecha de calendario */
function pintaCabVivo(L) {
  $('#lNombre').textContent = L.nombre;
  $('#lSub').innerHTML = '<span class="l-chips">' + chipSv(L.sv) + (L.vivo ? etiquetaMult(L.sv) : '') +
    '<span class="vv-et"><i class="vivo-punto" aria-hidden="true"></i>En vivo</span></span>' +
    '<span class="l-datos">' + (L.participantes ? L.participantes + ' raperos &middot; ' : '') +
    (L.terminada ? 'terminó: los puntos llegan cuando el ciclo la procese'
      : esc(L.enJuego || 'en juego') + ' en juego') + ' &middot; se actualiza sola cada minuto &middot; ' +
    'último cambio ' + esc(cuandoSe(new Date(L.ed || L.pub || Date.now()).toISOString())) + '</span>';
}
// `quieto`: se redibuja en el lugar —la llave en vivo que cambió, o el
// teléfono que giró— sin volver al principio
/* 🔑 LA FASE DE UNA NAVE DE FUNA (CYPHER, aniquilación). Dlx, 29/09/2026: se
   rapean rondas de beats y sale el nombre con más reacciones en Discord. La
   llave la escribe como una LISTA con ❌ en los que cayeron, sin el orden: se
   ven todos juntos, los que siguen primero. `funa` viene del lector —en vivo,
   `LlaveVivo.funaDe()`; procesada, `llaves_web.armar()`—: `[nombre, cayó]`. */
function funaVista(L, quien) {
  var fs = (L && L.funa) || [];
  if (!fs.length) return '';
  var quedan = fs.filter(function (x) { return !x[1]; }).length;
  return '<section class="funa"><h4>Fase de eliminación <small>' + fs.length + ' raperos &middot; ' +
    (quedan === fs.length ? 'se juega' : 'quedan ' + quedan) + '</small></h4><ul>' +
    fs.map(function (x) {
      return '<li' + (x[1] ? ' class="cae"' : '') + '>' + quien(x[0], false, !!x[1]) +
        (x[1] ? '<i class="cae-x" title="Cayó en la fase">&#10060;</i>' : '') + '</li>';
    }).join('') + '</ul></section>';
}
function pintaVistaLlave(quieto) {
  if (!LL || !$('#lVista')) return;
  var cc0 = $('#lCuerpo .cuadro-caja'), x0 = cc0 ? cc0.scrollLeft : 0;
  var cu = $('#lCuerpo'), y0 = cu ? cu.scrollTop : 0;
  $$('[data-lvista]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lvista === LL_VISTA)); });
  var vid = vidasDe(LL.L);
  var hayR = (LL.L.rondas || []).some(function (R) { return R.b && R.b.length; });
  $('#lVista').innerHTML = vid ? vidasVista(LL.L, LL.quien, vid)
    : funaVista(LL.L, LL.quien) + (!hayR ? ''
      : LL_VISTA === 'rondas' ? rondasLista(LL.L, LL.quien, LL.cara)
      : cuadro(LL.L, LL.quien, LL.cara));
  var cc = $('#lCuerpo .cuadro-caja');
  LL.ancho = window.innerWidth;
  if (quieto) {
    if (cc) cc.scrollLeft = x0;
    if (cu) cu.scrollTop = y0;
  } else if (cc && window.innerWidth >= 760 && cc.scrollWidth > cc.clientWidth) {
    // en espejo la final va en el medio: se arranca mirándola
    cc.scrollLeft = (cc.scrollWidth - cc.clientWidth) / 2;
  }
  // redibujada (otra vista, o la llave en vivo que cambió): quien se seguía
  // se sigue siguiendo
  seguirEnLlave(FIJO || SIGUE_K, !!FIJO);
}
/* 🔑 SEGUIR A ALGUIEN POR LA LLAVE, y cuánto sumó ahí. Con el mouse, al pasar
   por encima; en el teléfono, tocando el nombre (Dlx, 27/09/2026, a «tocar
   un nombre ilumina su camino y dice cuánto sumó»: «me gusta todo»).

   🔴 PARPADEABA, y la causa era la barra. Dlx, 27/09/2026: «this thing of
   selecting a person and seeing his path lightned is very buggy». La barra
   aparecía ARRIBA del cuadro al pasar el mouse, así que el cuadro bajaba 50
   px, el nombre se iba de abajo del mouse, la barra se escondía, el cuadro
   subía… Ahora la barra está siempre, con la misma altura: sin nadie
   seguido dice cómo se usa.

   ⚠️ Y EL CAMINO ES CAMINO: se encienden también las ramas por las que pasó,
   y el resto del cuadro se apaga. Antes sólo cambiaba el borde de sus
   cajas, que en una llave de 32 se perdía. */
var FIJO = '', SIGUE_K = '';
function seguirEnLlave(k, fijo) {
  SIGUE_K = k || '';
  $$('#lCuerpo .sigue').forEach(function (x) { x.classList.remove('sigue'); });
  var vis = $('#lVista .cuadro') || $('#lVista .rl-lista');
  if (vis) vis.classList.toggle('siguiendo', !!k);
  if (k) {
    // ⚠️ SÓLO DENTRO DE LA VISTA: el podio y «Los puntos» tienen los mismos
    // nombres y no son parte del camino
    $$('#lVista .ql').forEach(function (x) {
      if (x.dataset.k !== k) return;
      x.classList.add('sigue');
      var bx = x.closest('.bx,.bl');
      if (bx) bx.classList.add('sigue');
    });
    // una rama es del camino si esa persona está en las dos cajas que une
    $$('#lVista .cuadro path[data-de]').forEach(function (p) {
      var a = $('#lVista .bx[data-b="' + p.getAttribute('data-de') + '"]');
      var b = $('#lVista .bx[data-b="' + p.getAttribute('data-a') + '"]');
      if (a && b && a.classList.contains('sigue') && b.classList.contains('sigue')) p.classList.add('sigue');
    });
  }
  pintaBarraSigue(k, fijo);
}
function pintaBarraSigue(k, fijo) {
  var bar = $('#lSigue');
  if (!bar) return;
  var f = k && porK(k), p = f && LL && LL.pts[k];
  bar.classList.toggle('on', !!f);
  if (!f) {
    bar.innerHTML = '<span class="ls-idle">' + (HOVER
      ? 'Pasá el mouse por un nombre y se ilumina su camino. Con un clic, su perfil.'
      : 'Tocá un nombre y se ilumina su camino.') + '</span>';
    return;
  }
  // 🔑 DOS RENGLONES FIJOS —quién, y cómo le fue— para que la barra mida
  // lo mismo con cualquier nombre y en cualquier ancho
  bar.innerHTML = '<span class="ls-q">' + quienEs(f, 26) + '<span class="ls-d">' +
    (p ? (MEDALLA[p[0]] ? MEDALLA[p[0]] + ' ' : '') + esc(p[0]) + ' &middot; <b>' + num(p[1]) + ' pts</b>'
      : (LL && LL.L && LL.L.vivo ? 'Se juega ahora' : 'Sin puntos en esta llave')) + '</span></span>' +
    // con el mouse no se llega a la barra sin pasar por otros nombres: el
    // perfil se abre con un clic en el nombre, y los botones son del toque
    (fijo ? '<span class="ls-acc"><button type="button" class="btn sec ls-perf" data-k="' + esc(k) +
      '">Perfil</button><button type="button" class="ls-x" data-sigue-x aria-label="Dejar de seguir">&times;</button></span>'
      : '');
}
/* 🔑 LO QUE LA LLAVE NO DICE CON UN NOMBRE, CON UNA ETIQUETA: revivido,
   walk-in, pokémon, refuerzo, el tercero que dio el podio y cuántos pasan
   de un grupo. Antes era sólo el `title` de la caja, que en el teléfono no
   se ve nunca. */
function etiquetasNota(nota) {
  var s = String(nota || ''), out = [];
  var t = /pasan (\d+)/.exec(s);
  if (t) out.push(t[1] === '0' ? 'No pasó nadie' : 'Pasan ' + t[1]);
  if (/revivid/i.test(s)) out.push('Revivido');
  if (/walk-?in/i.test(s)) out.push('Walk-in');
  if (/pok[eé]mon/i.test(s)) out.push('Pokémon');
  if (/refuerzo/i.test(s)) out.push('Refuerzo');
  if (/^podio/i.test(s)) out.push('Por el podio');
  return out;
}
/* 🔑 EL CLÁSICO: los mismos dos, cruzándose en su tercer evento o más (ver
   `multiplicadores.clasicos()`: eventos y no duelos, por los 5 vidas). En una llave jugada, con lo que había ganado
   cada uno ANTES; en vivo, con lo que llevan. El que gana suma +10 %. */
function clasicoDe(L, b) {
  var ls = (b && b[0]) || [];
  if (!L || ls.length !== 2 || /[,+]/.test(ls[0] + ls[1])) return null;
  var a = ls[0], c = ls[1];
  var x = (L.clasicos || []).filter(function (y) {
    return (y[0] === a && y[1] === c) || (y[0] === c && y[1] === a);
  })[0];
  if (x) return x[0] === a ? [a, c, x[2], x[3]] : [a, c, x[3], x[2]];
  if (L.vivo && D.rivales) {
    var ka = kDe(a), kc = kDe(c), r = ka && kc && D.rivales[[ka, kc].sort().join('|')];
    if (r) return [a, c, r[ka] || 0, r[kc] || 0];
  }
  return null;
}
function etiquetaClasico(L, b) {
  var c = clasicoDe(L, b);
  return c ? '<span class="et-cl" title="Clásico: ya se cruzaron ' + (c[2] + c[3]) + ' veces (' + esc(c[0]) + ' ' +
    c[2] + '–' + c[3] + ' ' + esc(c[1]) + '). El que gana suma +10 %.">&#129308; Clásico ' + c[2] + '–' + c[3] +
    '</span>' : '';
}
function etiquetasHtml(nota) {
  var et = etiquetasNota(nota);
  return et.length ? et.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') : '';
}
/* los puntos de cada integrante en esta llave, y lo que vale quedar afuera en
   una ronda: el mismo número para el cuadro y para la lista */
function ptsDeLlave(L) {
  var ptsDe = {};
  (L.tabla || []).forEach(function (t) {
    miembrosDe(t[0]).forEach(function (m) { ptsDe[m] = t[2]; });
  });
  return ptsDe;
}
function valeRonda(R, ptsDe) {
  var vs = [];
  R.b.forEach(function (b) {
    (b[0] || []).forEach(function (s) {
      if (b[1] && (b[1] === s || comparten(b[1], s))) return;
      miembrosDe(s).forEach(function (m) { if (ptsDe[m] != null) vs.push(ptsDe[m]); });
    });
  });
  return vs.length && vs.every(function (v) { return v === vs[0]; }) ? vs[0] : null;
}
/* 🔑 UN EVENTO DE VIDAS NO ES UNA LLAVE. Dlx, 28/09/2026: «SNAKE ARENA es
   formato TIPO 5 VIDAS… como la Red Bull 5 Vidas». Cada batalla le saca una
   vida al que pierde y el que gana se queda, así que un cuadro no tiene ramas
   que dibujar: saldría una columna de 23 cajas. Arriba, las vidas de cada uno
   y cuándo cayó; abajo, las batallas en el orden en que se pelearon —el de
   las filas, que ES el dato—.
   ⚠️ EL LUGAR NO SE CALCULA ACÁ: lo da el motor (`motor.lugares_vidas()`) y
   llega en `L.tabla`. Acá sólo se cuentan las vidas para mostrarlas. */
function vidasDe(L) {
  var rs = ((L && L.rondas) || []).filter(function (R) { return R.b.length; });
  var m = rs.length === 1 && /^(\d+)\s*vidas?$/i.exec(String(rs[0].r || '').trim());
  return m ? +m[1] : 0;
}
function vidasVista(L, quien, N) {
  var bs = L.rondas.filter(function (R) { return R.b.length; })[0].b;
  var perd = {}, cae = {}, sale = [];
  var perdedor = function (b) {
    var ls = b[0] || [];
    if (!b[1] || ls.length !== 2) return null;
    var p = ls.filter(function (s) { return s !== b[1] && !comparten(b[1], s); });
    return p.length === 1 ? p[0] : null;
  };
  bs.forEach(function (b, i) {
    (b[0] || []).forEach(function (s) { if (!(s in perd)) perd[s] = 0; });
    var p = perdedor(b);
    if (p == null) { sale.push(null); return; }
    perd[p] += 1;
    if (perd[p] === N) cae[p] = i + 1;
    sale.push([p, perd[p]]);
  });
  // en el orden de la tabla del motor: del campeón al último. ⚠️ EN VIVO NO
  // HAY TABLA —los puntos llegan con el ciclo—: primero los que siguen en pie,
  // con más vidas arriba, y después los que cayeron, del último al primero.
  // Es la misma regla que `motor.lugares_vidas()`.
  var gente = Object.keys(perd);
  var lugar = {};
  (L.tabla || []).forEach(function (r, i) {
    gente.forEach(function (s) { if (!(s in lugar) && comparten(r[0], s)) lugar[s] = i; });
  });
  var ordenVivo = function (s) { return cae[s] ? 1000 - cae[s] : perd[s]; };
  gente.sort(function (a, b) {
    return (L.tabla || []).length ? (a in lugar ? lugar[a] : 99) - (b in lugar ? lugar[b] : 99)
      : ordenVivo(a) - ordenVivo(b);
  });
  var corazones = function (s) {
    var out = '';
    for (var k = 0; k < N; k++) {
      out += k < N - perd[s] ? '<i class="vd-c">&#9829;</i>' : '<i class="vd-c vd-x">&#9825;</i>';
    }
    return '<span class="vd-cs" aria-label="' + (N - perd[s]) + ' de ' + N + ' vidas">' + out + '</span>';
  };
  var tablero = '<div class="vd-t">' + gente.map(function (s, i) {
    var fin = cae[s] ? 'cayó en la batalla ' + cae[s] : 'en pie';
    return '<div class="vd-f' + (cae[s] ? '' : ' vd-pie') + '"><b class="vd-l">' + (i + 1) + '.º</b>' +
      '<span class="vd-n">' + quien(s) + '</span>' + corazones(s) +
      '<small>' + (cae[s] ? '' : '&#127942; ') + fin + '</small></div>';
  }).join('') + '</div>';
  var lista = bs.map(function (b, i) {
    var x = sale[i];
    var ult = x && x[1] === N;
    var et = etiquetasHtml(b[2]) + etiquetaClasico(L, b);
    // en vivo, lo que dijeron los votos: «votos 2–1», «réplica»…
    var nota = L.veredictos && b[2] ? '<span class="vd-v">' + esc(b[2]) + '</span>' : '';
    return '<div class="bl"' + (b[2] ? ' title="' + esc(b[2]) + '"' : '') + '>' +
      '<div class="bx-et"><span>Batalla ' + (i + 1) + '</span>' + nota + et + '</div>' +
      (b[0] || []).map(function (s, j) {
        var g = b[1] && (b[1] === s || comparten(b[1], s));
        var menos = x && x[0] === s;
        return (j ? '<i class="bl-vs">vs</i>' : '') + '<div class="bl-l' + (g ? ' g' : '') + '">' +
          '<span class="bl-n"><span class="bl-m">' + quien(s, false, !g) + '</span></span>' +
          (g ? '<span class="bl-ok" title="Ganó y se queda">&#10003;</span>'
            : menos ? '<span class="vd-m' + (ult ? ' vd-ult' : '') + '">' +
              (ult ? 'sin vidas' : '&minus;1 &#9829; (le quedan ' + (N - x[1]) + ')') + '</span>' : '') +
          '</div>';
      }).join('') + (x ? '' : '<p class="vd-sin">' + (/réplica/.test(b[2] || '') ? 'Réplica: se vuelve a pelear.'
        : L.vivo && i === bs.length - 1 ? 'Se está votando.' : 'Sin ganador: no le sacó vida a nadie.') +
        '</p>') + '</div>';
  }).join('');
  return '<div class="rl-lista vd">' + tablero + '<section class="rl-r"><h5>Batalla por batalla<small>' +
    bs.length + ' batallas</small></h5>' + lista + '</section></div>';
}

/* 🔑 LA LLAVE POR RONDAS: cada ronda con su valor, y cada batalla con quién
   pasó marcado. Es la vista del teléfono: se lee bajando, como un chat. */
function rondasLista(L, quien, cara) {
  var rs = (L.rondas || []).filter(function (R) { return R.b.length; });
  if (!rs.length) return '';
  var ptsDe = ptsDeLlave(L);
  var prin = rs.filter(function (R) { return R.r !== 'Tercer puesto'; });
  var ult = prin[prin.length - 1];
  // 🔴 EL CAMPEÓN, UNA VEZ: en su renglón de la final, con la copa y sus
  // puntos. Iba además en un recuadro debajo que repetía los mismos nombres
  // (Dlx, 27/09/2026: «I also dont have to see 2 times that this team won»).
  var lado = function (s, gano, copa) {
    var ms = String(s || '').split(/,\s*/).filter(Boolean);
    var eq = ms.length > 1;
    var ps = copa ? miembrosDe(s).map(function (m) { return ptsDe[m]; })
      .filter(function (v) { return v != null; }) : [];
    var lo = Math.min.apply(null, ps), hi = Math.max.apply(null, ps);
    return '<div class="bl-l' + (gano ? ' g' : '') + (eq ? ' eq' : '') + '">' +
      (eq ? '<span class="eq-caras">' + ms.map(cara).join('') + '</span>' : '') +
      // el punto va pegado al nombre de antes: suelto, al partirse el renglón
      // quedaba solo al principio del siguiente
      '<span class="bl-n">' + ms.map(function (m, i) {
        return '<span class="bl-m">' + quien(m, eq, !gano) + (i < ms.length - 1 ? '<i class="coma">&middot;</i>' : '') + '</span>';
      }).join('') + '</span>' + (copa ? '<span class="bl-ok bl-copa" title="Campeón">&#127942;' +
        (ps.length ? ' ' + (lo === hi ? num(hi) : num(lo) + '&ndash;' + num(hi)) + ' pts' : '') + '</span>'
        : gano ? '<span class="bl-ok" title="Pasó">&#10003;</span>' : '') + '</div>';
  };
  return '<div class="rl-lista">' + rs.map(function (R) {
    var v = valeRonda(R, ptsDe);
    var esFin = R === ult && R.b.length === 1;
    return '<section class="rl-r' + (esFin ? ' fin' : '') + '"><h5>' + esc(R.r) +
      (v != null ? '<small>' + num(v) + ' pts</small>' : '') + '</h5>' +
      R.b.map(function (b) {
        var et = etiquetasHtml(b[2]) + etiquetaClasico(L, b);
        return '<div class="bl"' + (b[2] ? ' title="' + esc(b[2]) + '"' : '') + '>' +
          (et ? '<div class="bx-et">' + et + '</div>' : '') +
          (b[0] || []).map(function (s, i) {
            var g = b[1] && (b[1] === s || comparten(b[1], s));
            return (i ? '<i class="bl-vs">vs</i>' : '') + lado(s, g, g && esFin);
          }).join('') + '</div>';
      }).join('') + '</section>';
  }).join('') + '</div>';
}

function cerrarLlave() {
  $('#visorLlave').hidden = true;
  if ($('#visor').hidden) document.body.style.overflow = '';
  FIJO = '';
  SIGUE_K = '';
  // abierta por su link: al cerrarla queda el calendario, sin volver a abrirla
  if (/^llave\//.test(ruta())) history.replaceState(null, '', urlDe('eventos'));
}

/* ── podio y récords ──────────────────────────────────────────────── */
/* ── el podio, por categoría ──────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «en la sección de podios en inicio deja unas flechas
   para cambiar de categoría a competitivo así y así…». Son las mismas
   categorías que «Los tres de arriba» —y se ordenan igual—, con la tarjeta
   de cada uno. La elegida se recuerda en este dispositivo.

   ⚠️ EL COMPETITIVO SE MUESTRA AUNQUE ESTÉ VACÍO, como en «Los tres de
   arriba»: que nadie haya llegado a los 10 eventos ES el dato. */
var POD = { i: 0, cats: [] };
function catsPodio() {
  var T = oficiales();
  var cats = [];
  var persona = function (f) { return porK(f.k) || f; };
  cats.push({ id: 'temporada', t: 'Temporada', carta: 'temporada', gente: T.slice(0, 3),
    v: function (f) { return 'OVR <b>' + (f.ovr || '—') + '</b> · ' + num(f.pts) + ' pts'; } });
  var comp = T.filter(function (f) { return f.rg; }).sort(function (a, b) {
    return (b.sc || 0) - (a.sc || 0);
  }).slice(0, 3);
  var pide = reqDe('competitivo') || 10;
  var cerca = T.slice().sort(function (a, b) { return (b.ev || 0) - (a.ev || 0); })[0];
  cats.push({ id: 'competitivo', t: 'Competitivo', carta: 'competitivo', gente: comp,
    v: function (f) { return 'Rango <b style="color:' + esc(f.rgc || 'inherit') + '">' + esc(f.rg) + '</b>'; },
    vacio: cerca ? 'Se desbloquea a los <b>' + pide + ' eventos</b> y todavía no llegó nadie. ' +
      'El más cerca: <b>' + esc(cerca.n) + '</b>, con ' + cerca.ev + '.' : '' });
  cats.push({ id: 'duelos', t: 'Duelos', carta: 'temporada',
    gente: (D.duelos || []).filter(function (d) { return !d.fc; }).slice(0, 3).map(function (d) {
      return Object.assign({}, persona(d), { _g: d.g, _t: d.t });
    }),
    v: function (f) { return '<b>' + f._g + '</b> de ' + f._t + ' ganados'; } });
  var med = T.filter(function (f) { return (f.oro || 0) + (f.seg || 0) + (f.ter || 0) > 0; })
    .sort(medallero).slice(0, 3);
  cats.push({ id: 'podios', t: 'Podios', carta: 'temporada', gente: med,
    v: function (f) {
      return [['&#129351;', f.oro], ['&#129352;', f.seg], ['&#129353;', f.ter]]
        .filter(function (x) { return x[1]; }).map(function (x) { return x[0] + '<b>' + x[1] + '</b>'; })
        .join(' ');
    } });
  var con = T.filter(function (f) { return ((f.rch || [])[1] || 0) > 0; });
  var vivas = con.filter(function (f) { return f.rch[0] > 0; });
  cats.push({ id: 'rachas', t: vivas.length ? 'Rachas' : 'Rachas (la más larga)', carta: 'temporada',
    gente: (vivas.length ? vivas : con).slice().sort(function (a, b) {
      return vivas.length ? (b.rch[0] - a.rch[0]) || (b.rch[1] - a.rch[1])
                          : (b.rch[1] - a.rch[1]) || (b.pts - a.pts);
    }).slice(0, 3),
    v: function (f) { return '&#128293;<b>' + (vivas.length ? f.rch[0] : f.rch[1]) + '</b> seguidos'; } });
  cats.push({ id: 'paises', t: 'Países', grupos: (D.paises || []).filter(function (p) { return p.n; })
    .slice(0, 3).map(function (p) {
      var cc = String(p.cc || '').toLowerCase();
      return { n: nombrePais(cc), href: '#/pais/' + encodeURIComponent(cc),
        img: PAIS[cc] ? '<img class="pd-bandera" src="banderas/g/' + esc(cc) + '.webp" alt="" ' +
          'onerror="this.onerror=null;this.src=\'banderas/' + esc(cc) + '.png\'">' : '',
        v: '<b>' + num(p.pts) + '</b> pts · ' + p.n + (p.n === 1 ? ' rapero' : ' raperos') };
    }) });
  cats.push({ id: 'crews', t: 'Crews', grupos: (D.crews || []).filter(function (c) { return c.rk !== 0; })
    .slice(0, 3).map(function (c) {
      return { n: c.crew, href: '#/crew/' + encodeURIComponent(c.clave || c.crew),
        img: c.logo ? '<img class="pd-logo" src="' + esc(c.logo) + '" alt="">' : '',
        v: '<b>' + num(c.pts) + '</b> pts · ' + c.n + (c.n === 1 ? ' rapero' : ' raperos') };
    }) });
  return cats.filter(function (c) { return (c.gente || c.grupos || []).length || c.vacio; });
}
function pintaPodioCat() {
  var c = POD.cats[POD.i];
  if (!c) return;
  var med = ['&#129351;', '&#129352;', '&#129353;'];
  $('#podCat').textContent = c.t;
  $('#podDots').innerHTML = POD.cats.map(function (x, i) {
    return '<button type="button" class="pn-dot' + (i === POD.i ? ' on' : '') + '" data-pod="' + i +
      '" aria-label="' + esc(x.t) + '" title="' + esc(x.t) + '"></button>';
  }).join('');
  $('#podNav').hidden = POD.cats.length < 2;
  var h = (c.gente || []).map(function (f, i) {
    var cs = f.c || [];
    var carta = c.carta && cs.indexOf(c.carta) >= 0 ? c.carta : cs[0];
    var img = carta
      ? '<button data-carta="' + esc(f.k) + '"><img loading="lazy" decoding="async" src="' +
        urlCarta(f, carta) + '" alt="Tarjeta de ' + esc(f.n) + '"></button>'
      : '<button class="pd-sin" data-k="' + esc(f.k) + '">' + avatar(f, 120) + '</button>';
    return '<div class="pd p' + (i + 1) + '"><span class="med">' + med[i] + '</span>' + img +
      '<b data-k="' + esc(f.k) + '">' + esc(f.n) + (f.cc ? ' ' + bandera(f.cc) : '') + '</b>' +
      '<small>' + c.v(f) + '</small></div>';
  }).concat((c.grupos || []).map(function (g, i) {
    return '<div class="pd p' + (i + 1) + ' grupo"><span class="med">' + med[i] + '</span>' +
      '<a class="pd-g" href="' + g.href + '">' + g.img + '</a>' +
      '<b><a href="' + g.href + '">' + esc(g.n) + '</a></b><small>' + g.v + '</small></div>';
  })).join('');
  $('#elPodio').innerHTML = h;
  $('#elPodio').hidden = !h;
  $('#podVacio').hidden = !!h || !c.vacio;
  $('#podVacio').innerHTML = h ? '' : (c.vacio || '');
}
function moverPodio(paso, a) {
  if (!POD.cats.length) return;
  POD.i = a != null ? a : (POD.i + paso + POD.cats.length) % POD.cats.length;
  guardarLS('lg:podio', POD.cats[POD.i].id);
  pintaPodioCat();
}
function pintaPodio() {
  POD.cats = catsPodio();
  if (!POD.cats.length) { apaga('#secPodio'); return; }
  var pedida = leerLS('lg:podio', '');
  POD.i = 0;
  POD.cats.forEach(function (c, i) { if (c.id === pedida) POD.i = i; });
  pintaPodioCat();
  pintaUnos();

  var rs = D.records || [];
  $('#records').innerHTML = rs.map(function (r) {
    return '<dl class="rec"' + (r.k ? ' data-k="' + esc(r.k) + '"' : '') + '><dt>' +
      esc(r.que) + '</dt><dd>' +
      '<span class="v">' + esc(typeof r.v === 'number' ? num(r.v) : r.v) + '</span>' +
      '<span class="q">' + esc(r.n) + (r.cc ? ' ' + bandera(r.cc) : '') + '</span>' +
      '</dd>' + (r.x ? '<small class="rec-x">' + esc(r.x) + '</small>' : '') + '</dl>';
  }).join('');
}

/* ── los mejores de cada lado ─────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «y agrega más cosas abajo». El #1 de la temporada en
   cada país, en cada crew y en cada servidor, del mismo payload. Un grupo
   con un solo servidor no se dibuja: «el mejor de FFA» es el #1 de todos. */
function pintaUnos() {
  var T = oficiales();
  var mejor = function (ok) { return T.filter(ok)[0]; };
  var item = function (cab, f, extra) {
    return '<div class="uno">' + cab + '<div class="uno-q" data-k="' + esc(f.k) + '">' +
      avatar(f, 34) + '<span><b>' + esc(f.n) + '</b><small>' + numPos(f) + ' · OVR ' +
      (f.ovr || '—') + ' · ' + num(f.pts) + ' pts</small></span></div>' + (extra || '') + '</div>';
  };
  var partes = [];
  var ps = (D.paises || []).filter(function (p) { return p.n; }).map(function (p) {
    var cc = String(p.cc || '').toLowerCase();
    var f = mejor(function (x) { return String(x.cc || '').toLowerCase() === cc; });
    return f ? item('<a class="uno-cab" href="#/pais/' + encodeURIComponent(cc) + '">' +
      bandera(cc) + '<span>' + esc(nombrePais(cc)) + '</span><u>' + p.n + '</u></a>', f) : '';
  }).filter(Boolean);
  if (ps.length) partes.push('<h3 class="gh">Por país <small>' + ps.length + '</small></h3>' +
    '<div class="unos">' + ps.join('') + '</div>');
  var cs = (D.crews || []).filter(function (c) { return c.rk !== 0 && c.mejor; }).map(function (c) {
    var f = porK(kDe(c.mejor)) || mejor(function (x) { return x.n === c.mejor; });
    if (f && f.fc) f = null;
    return f ? item('<a class="uno-cab" href="#/crew/' + encodeURIComponent(c.clave || c.crew) + '">' +
      (c.logo ? '<img class="uno-logo" src="' + esc(c.logo) + '" alt="">' : '') + '<span>' + esc(c.crew) +
      '</span><u>' + c.n + '</u></a>', f) : '';
  }).filter(Boolean);
  if (cs.length) partes.push('<h3 class="gh">Por crew <small>' + cs.length + '</small></h3>' +
    '<div class="unos">' + cs.join('') + '</div>');
  var svs = (D.svs || []).filter(function (s) { return s.n; });
  if (svs.length > 1) {
    var ss = svs.map(function (s) {
      var f = mejor(function (x) { return x.sv === s.sv; });
      return f ? item('<span class="uno-cab">' + chipSv(s.sv) + '<u>' + s.n + '</u></span>', f) : '';
    }).filter(Boolean);
    if (ss.length) partes.push('<h3 class="gh">Por servidor <small>' + ss.length + '</small></h3>' +
      '<div class="unos">' + ss.join('') + '</div>');
  }
  if (!partes.length) { apaga('#secUnos'); return; }
  $('#secUnos').hidden = false;
  $('#unos').innerHTML = partes.join('');
}

/* ── filtros ──────────────────────────────────────────────────────── */
function pintaChips() {
  // ⚠️ SOLO SE OFRECEN LOS QUE EXISTEN. Un chip por cada uno de los nueve
  // servidores serían ocho botones que no filtran nada: hoy la T1 entera
  // es de FFA.
  var svs = (D.svs || []).filter(function (s) { return s.n; });
  $('#chipsSv').innerHTML = svs.length < 2 ? '' :
    '<button class="chip on" data-sv="">Todos</button>' +
    svs.map(function (s) {
      return '<button class="chip" data-sv="' + esc(s.sv) + '">' + esc(s.sv) +
        '<span class="n">' + s.n + '</span></button>';
    }).join('');

  var ps = (D.paises || []).filter(function (p) { return p.n; }).slice(0, 12);
  $('#chipsCc').innerHTML = ps.length < 2 ? '' :
    '<button class="chip on" data-cc="">Todos</button>' +
    ps.map(function (p) {
      return '<button class="chip" data-cc="' + esc(p.cc) + '">' +
        ccTexto(p.cc) + '<span class="n">' + p.n + '</span></button>';
    }).join('');
}

/* 🔑 EL ORDEN DE UN MEDALLERO: oros, después platas, después bronces.
   Sumar las tres daría que tres bronces valen más que un oro, que es justo
   lo que un medallero existe para no decir. */
function medallero(a, b) {
  return (b.oro || 0) - (a.oro || 0) || (b.seg || 0) - (a.seg || 0) ||
    (b.ter || 0) - (a.ter || 0) || (b.pts || 0) - (a.pts || 0);
}
function pct(x) { return parseFloat(String(x == null ? '' : x).replace(',', '.')) || 0; }
var nada = '<span class="nada">&mdash;</span>';
var MW_ON = false;

function pastillaRg(f) {
  return f.rg
    ? '<span class="rg" style="color:' + esc(f.rgc || '') + ';border-color:' +
      esc(f.rgc || '#1A2523') + '55">' + esc(f.rg) + '</span>'
    : '<span class="rg">&middot;</span>';
}
function rachaCelda(f) {
  var r = f.rch || [0, 0];
  if (!r[1]) return nada;
  // «🔥1/4»: la que lleva y la más larga. Dlx, 25/09/2026: «eso que dice
  // máx 4 se ve raro, ¿por qué no ponés / X?»
  return '<span class="rch' + (r[0] ? ' viva' : '') + '">' + (r[0] ? '&#128293;' : '') + r[0] +
    '<s>/' + r[1] + '</s></span>';
}
function ultCelda(f) {
  var u = f.ult || [];
  if (!u[0]) return nada;
  var d = new Date(u[0] + 'T12:00:00');
  var fe = isNaN(d) ? u[0] : d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  return '<span class="ult"><b>' + esc(u[1] || '') + '</b><small>' + esc(fe) + '</small></span>';
}
function mwCol(k, t, tit) {
  return { t: t, tit: tit, s: function (f) { return f[k] || 0; },
    v: function (f) { return MW_ON ? String(f[k] || 0) : nada; } };
}
function crewCelda(c) {
  return '<span class="quien">' + (c.logo
    ? '<img class="av" src="' + esc(c.logo) + '" alt="" style="width:30px;height:30px">'
    : '<span class="av ini" style="width:30px;height:30px;font-size:14px">' +
      esc(inicial(c.crew)) + '</span>') + '<span class="qn">' + esc(c.crew) + '</span></span>';
}

/* 🔑 CADA COLUMNA DICE CÓMO SE MUESTRA (`v`) Y CÓMO SE ORDENA (`s`). Todas
   se ordenan: Dlx, 25/09/2026, «que se pueda filtrar de arriba hacia abajo
   para los demás». `txt` arranca de la A a la Z; el resto, de mayor a
   menor, porque un ranking que al tocar «Puntos» muestra primero al
   último obliga a tocar dos veces siempre. */
var COL = {
  // ⚠️ EL `#` ORDENA POR MÉRITO (`o`), no por `pos`: quien está fuera de
  // concurso no tiene `pos` y se iría al fondo en vez de quedar en su lugar
  pos: { t: '#', cls: 'c-pos', s: function (f) { return f.o || f.pos; },
    v: function (f) { return f.fc ? FC : esc(f.pos); } },
  // `_o` es el lugar en ESTE ranking contando a todos (ver `pintaTabla`)
  i: { t: '#', cls: 'c-pos', s: function (f) { return f._o || f._i; },
    v: function (f) { return f._i || (f.fc ? FC : nada); } },
  n: { t: 'Rapero', cls: 'c-n', txt: 1, s: function (f) { return sinTildes(f.n); },
    v: function (f) { return quienEs(f.av !== undefined ? f : conCara(f), 30); } },
  ovr: { t: 'OVR', tit: 'El número de la temporada, de 40 a 99', s: function (f) { return f.ovr || 0; },
    v: function (f) { return '<span class="ovr">' + (f.ovr || '—') + '</span>'; } },
  // ⚠️ EL RANGO SE ORDENA POR SCORE, que es de donde sale: por letra, «A+»
  // quedaría abajo de «A» y «SSS» abajo de «S». Sin rango, al final.
  rg: { t: 'Rango', si: function () { return (D.tabla || []).some(function (f) { return f.rg; }); },
    s: function (f) { return f.rg ? f.sc || 0 : ''; }, v: pastillaRg },
  sc: { t: 'Score', tit: 'El número del Competitivo, de 0 a 100', s: function (f) { return f.sc || 0; },
    v: function (f) { return f.sc ? '<b class="sc">' + esc(String(f.sc).replace('.', ',')) + '</b>' : nada; } },
  // ⚠️ SE VE SÓLO SI HAY MÁS DE UN SERVIDOR EN LA TABLA: hoy la T1 entera es
  // de FFA y la columna decía «FFA» ochenta y cinco veces, comiéndose el
  // ancho. Cuando entre gente de otro servidor, vuelve sola.
  sv: { t: 'Sv', tit: 'Servidor', cls: 'c-sv', txt: 1,
    si: function (fs) { return fs.some(function (f) { return (f.sv || '') !== ((fs[0] || {}).sv || ''); }); },
    s: function (f) { return f.sv || ''; },
    v: function (f) { return '<span class="sv">' + esc(f.sv || '') + '</span>'; } },
  pts: { t: 'Puntos', cls: 'pts', s: function (f) { return f.pts || 0; }, v: function (f) { return num(f.pts); } },
  ev: { t: 'Ev', tit: 'Eventos jugados en la temporada', s: function (f) { return f.ev || 0; },
    v: function (f) { return esc(f.ev || 0); } },
  wr: { t: 'Win%', tit: 'Duelos ganados sobre duelos jugados', s: function (f) { return f.wr ? pct(f.wr) : ''; },
    v: function (f) { return f.wr ? esc(f.wr) : nada; } },
  racha: { t: 'Racha', tit: 'La que lleva ahora / la más larga de la temporada',
    s: function (f) { var r = f.rch || [0, 0]; return r[0] * 1000 + r[1]; }, v: rachaCelda },
  ract: { t: 'Actual', tit: 'Eventos seguidos que lleva ahora', s: function (f) { return (f.rch || [0])[0]; },
    v: function (f) { var r = (f.rch || [0])[0]; return r ? '<span class="rch viva">&#128293;' + r + '</span>' : '0'; } },
  rmax: { t: 'La más larga', tit: 'La racha más larga de la temporada', s: function (f) { return (f.rch || [0, 0])[1]; },
    v: function (f) { return esc((f.rch || [0, 0])[1]); } },
  ult: { t: 'Último evento', tit: 'Cómo le fue la última vez que jugó, y cuándo',
    s: function (f) { return (f.ult || [])[0] || ''; }, v: ultCelda },
  mwp: { t: 'Cobró', tit: 'Puntos cobrados en Most Wanted', s: function (f) { return f.pts || 0; },
    v: function (f) { return f.pts ? '<b>' + num(f.pts) + '</b>' : nada; } },
  mwc: { t: 'Cazó', s: function (f) { return f.caz || 0; }, v: function (f) { return f.caz || nada; } },
  mwz: { t: 'Cazado', s: function (f) { return f.czd || 0; }, v: function (f) { return f.czd || nada; } },
  mws: { t: 'Sobrevivió', s: function (f) { return f.sob || 0; }, v: function (f) { return f.sob || nada; } },
  caz: mwCol('caz', 'Cazó', 'Most Wanted: a cuántos cazó'),
  czd: mwCol('czd', 'Cazado', 'Most Wanted: cuántas veces lo cazaron'),
  sob: mwCol('sob', 'Sobrevivió', 'Most Wanted: cuántas veces sobrevivió'),
  mis: { t: 'Misiones', tit: 'Las misiones de la temporada: próximamente',
    s: function () { return 0; }, v: function () { return nada; } },
  g: { t: 'Ganados', s: function (f) { return f.g || 0; }, v: function (f) { return '<b class="g">' + (f.g || 0) + '</b>'; } },
  t: { t: 'Jugados', s: function (f) { return f.t || 0; }, v: function (f) { return esc(f.t || 0); } },
  wrd: { t: '%', tit: 'Ganados sobre jugados', s: function (f) { return f.t ? f.g / f.t : 0; },
    v: function (f) { return f.t ? Math.round(100 * f.g / f.t) + '%' : nada; } },
  oro: { t: '&#129351;', tit: 'Primeros puestos', s: function (f) { return f.oro || 0; },
    v: function (f) { return f.oro || '<span class="nada">&middot;</span>'; } },
  seg: { t: '&#129352;', tit: 'Segundos puestos', s: function (f) { return f.seg || 0; },
    v: function (f) { return f.seg || '<span class="nada">&middot;</span>'; } },
  ter: { t: '&#129353;', tit: 'Terceros puestos', s: function (f) { return f.ter || 0; },
    v: function (f) { return f.ter || '<span class="nada">&middot;</span>'; } },
  sem: { t: 'Semis', tit: 'Semifinales jugadas', s: function (f) { return f.sem || 0; },
    v: function (f) { return f.sem || '<span class="nada">&middot;</span>'; } },
  pais: { t: 'País', cls: 'c-n', txt: 1, s: function (f) { return sinTildes(nombrePais(f.cc)); },
    v: function (f) { return '<span class="quien">' + (bandera(f.cc) || '') + '<span class="qn">' +
      esc(nombrePais(f.cc)) + '</span></span>'; } },
  np: { t: 'Raperos', s: function (f) { return f.n || 0; }, v: function (f) { return esc(f.n || 0); } },
  prom: { t: 'Por rapero', tit: 'Puntos por cada rapero de ese país', s: function (f) { return f.n ? f.pts / f.n : 0; },
    v: function (f) { return f.n ? num(Math.round(f.pts / f.n)) : nada; } },
  crew: { t: 'Crew', cls: 'c-n', txt: 1, s: function (f) { return sinTildes(f.crew); }, v: crewCelda },
  nc: { t: 'Raperos', s: function (f) { return f.n || 0; }, v: function (f) { return esc(f.n || 0); } },
  mejor: { t: 'Su mejor', tit: 'El mejor de la crew en la temporada', txt: 1, cls: 'c-izq',
    s: function (f) { return sinTildes(f.mejor); },
    v: function (f) {
      var k = kDe(f.mejor);
      return k ? '<span class="lnk" data-k="' + esc(k) + '">' + esc(f.mejor) + '</span>' : esc(f.mejor || '');
    } },
};

/* La subcategoría del ranking. Ver `#subRanking` en el HTML.
   ⚠️ Vive acá y no en el hash: es un filtro de una vista, no una vista.
   El hash sólo la abre (`#/ranking/duelos`); al tocarla se reescribe con
   `replaceState`, que no dispara `hashchange` ni sube la página. */
var SUB = 'temporada';

/* 🔑 CADA RANKING DICE SUS FILAS, SUS COLUMNAS Y SU ORDEN. Es una tabla
   para todos, no diez: diez tablas serían diez lugares donde arreglar el
   mismo bug — que es el error que este repo persigue. */
var SUBS = {
  temporada: {
    baj: 'El orden sale del <b>OVR</b>, que es el mismo número que lleva la tarjeta. ' +
      'Tocá cualquier encabezado para ordenar, y un nombre para abrir su perfil.',
    filas: function () { return D.tabla || []; },
    orden: 'pos',
    // 🔑 LAS COLUMNAS DEL RANKING OFICIAL. Dlx, 25/09/2026: «chequea cómo
    // está el ranking temporada el oficial… tiene racha, último evento,
    // sobrevivió, cazó, cazado… y uno nuevo que es misiones».
    cols: ['pos', 'n', 'ovr', 'rg', 'sv', 'pts', 'ev', 'racha', 'ult', 'caz', 'czd', 'sob', 'mis'],
    nota: function () {
      return MW_ON ? '<b>Misiones</b> arranca pronto: hasta entonces su columna va en &mdash;.'
        : '<b>Most Wanted</b> y <b>Misiones</b> arrancan pronto: hasta entonces sus columnas van en &mdash;.';
    },
  },
  competitivo: {
    baj: 'Ordenado por <b>Score</b>, que mide la calidad y no la cantidad: de él sale el ' +
      'rango, el mismo en todas las tarjetas.',
    filas: function () { return (D.tabla || []).filter(function (f) { return f.rg; }); },
    orden: 'sc',
    cols: ['i', 'n', 'rg', 'sc', 'ev', 'wr', 'sv'],
    vacio: function () {
      var pide = reqDe('competitivo') || 10;
      var c = (D.tabla || []).slice().sort(function (a, b) { return (b.ev || 0) - (a.ev || 0); })[0];
      return 'El Competitivo pide <b>' + pide + ' eventos</b> en la temporada y todavía no ' +
        'llegó nadie.' + (c ? ' El más cerca: <b>' + esc(c.n) + '</b>, con ' + c.ev + '.' : '');
    },
  },
  duelos: {
    // 🔴 DECÍA «fuera del bracket» Y ERA AL REVÉS: los duelos salen de las
    // llaves. Y la regla es de Dlx (21/09, reconfirmada el 24/09): los
    // triples no cuentan.
    baj: 'Las batallas <b>uno contra uno</b> de las llaves. Los triples, las de cuatro y ' +
      'las de equipos no cuentan: ahí no hay un solo rival. Se ordena por <b>ganados</b>: ' +
      'un 1 de 1 da 100&nbsp;% y no dice nada.',
    filas: function () { return D.duelos || []; },
    orden: 'g',
    cols: ['i', 'n', 'g', 't', 'wrd', 'sv'],
  },
  podios: {
    baj: 'Como un medallero: primero los oros, después las platas y después los bronces. ' +
      'Quien no subió al podio no aparece.',
    filas: function () {
      return (D.tabla || []).filter(function (f) { return (f.oro || 0) + (f.seg || 0) + (f.ter || 0) > 0; });
    },
    orden: medallero,
    cols: ['i', 'n', 'oro', 'seg', 'ter', 'sem', 'pts'],
  },
  rachas: {
    baj: 'Eventos seguidos llegando arriba de la llave: la <b>final</b> si es de menos de ' +
      '16, la <b>semifinal</b> de 16 a 31, <b>cuartos</b> de 32 a 63. La que llevan ahora y ' +
      'la más larga de la temporada.',
    filas: function () {
      return (D.tabla || []).filter(function (f) { return ((f.rch || [])[1] || 0) > 0; });
    },
    orden: 'racha',
    cols: ['i', 'n', 'ract', 'rmax', 'ult', 'ev'],
  },
  paises: {
    baj: 'Por los puntos que hizo su gente en la temporada.',
    filas: function () { return D.paises || []; },
    sinChips: 1,
    nombre: function (f) { return nombrePais(f.cc); },
    orden: 'pts',
    cols: ['i', 'pais', 'np', 'pts', 'prom'],
    que: ['país', 'países'],
    enlace: function (f) { return ' data-pais="' + esc(f.cc) + '"'; },
  },
  crews: {
    baj: 'Por los puntos que suman. Para tener puesto una crew necesita <b>tres raperos</b> ' +
      'en la temporada: las que no llegan se ven, sin número.',
    filas: function () { return D.crews || []; },
    sinChips: 1,
    nombre: function (f) { return f.crew; },
    orden: function (a, b) { return ((b.rk !== 0) - (a.rk !== 0)) || (b.pts - a.pts) || (b.n - a.n); },
    sinPuesto: function (f) { return f.rk === 0; },
    fila: function (f) { return f.rk === 0 ? 'chica' : ''; },
    cols: ['i', 'crew', 'nc', 'pts', 'mejor'],
    que: ['crew', 'crews'],
    enlace: function (f) { return ' data-crew="' + esc(f.clave || f.crew) + '"'; },
  },
  mw: {
    // sin período todavía queda el «pronto» de siempre (ver `pintaTabla`)
    hay: function () { return !!(D.mw && (D.mw.b || []).length); },
    siNo: '<b>Most Wanted</b>: quién cazó, quién fue cazado y quién sobrevivió. Suma al OVR y arranca pronto.',
    baj: 'Los <b>cazadores</b> de la temporada: los puntos que cobraron cazando buscados y ' +
      'sobreviviendo, a cuántos cazaron, cuántas veces los cazaron y cuántas sobrevivieron. ' +
      'Lo cobrado suma a los <b>Puntos</b> de la Temporada; al Competitivo, nunca.',
    filas: function () { return (D.mw && D.mw.caz) || []; },
    orden: 'mwp',
    cols: ['i', 'n', 'mwp', 'mwc', 'mwz', 'mws'],
    vacio: function () { return 'Todavía nadie cazó a un buscado. Mirá el tablero del Inicio.'; },
  },
  misiones: { pronto: '<b>Las misiones</b> de la temporada arrancan pronto.' },
  ligas: { pronto: '<b>El ranking de ligas</b> llega en la Temporada 2.', cuando: 'Temporada 2' },
};

function filtradas(fs, cfg) {
  var q = sinTildes(FIL.q).trim();
  return fs.filter(function (f) {
    if (!cfg.sinChips) {
      if (FIL.sv && (f.sv || '').toUpperCase() !== FIL.sv) return false;
      if (FIL.cc && (f.cc || '').toLowerCase() !== FIL.cc) return false;
    }
    if (q && sinTildes(cfg.nombre ? cfg.nombre(f) : f.n).indexOf(q) < 0) return false;
    return true;
  });
}

// ⚠️ LO VACÍO VA AL FINAL, ordene como ordene: quien todavía no tiene rango
// o nunca jugó un duelo no es «el más bajo», es que no tiene el dato. Y a
// igual valor manda el orden de ese ranking, no el azar del `sort`.
function ordenadas(fs, id, desc) {
  var c = COL[id];
  if (!c) return fs;
  var d = desc ? -1 : 1;
  return fs.map(function (f, i) { return [f, i]; }).sort(function (A, B) {
    var x = c.s(A[0]), y = c.s(B[0]);
    x = x == null ? '' : x; y = y == null ? '' : y;
    if ((x === '') !== (y === '')) return x === '' ? 1 : -1;
    var r = (typeof x === 'string' || typeof y === 'string')
      ? String(x).localeCompare(String(y), 'es') : x - y;
    return r * d || A[1] - B[1];
  }).map(function (P) { return P[0]; });
}

function elegirSub(s) {
  SUB = s;
  ORDEN.tocado = false;
  $$('#subRanking .sub').forEach(function (o) { o.classList.toggle('on', o.dataset.sub === s); });
  // en el teléfono la fila se desliza: la elegida, a la vista (sin mover la
  // página de arriba abajo, por eso `scrollLeft` y no `scrollIntoView`)
  var b = $('#subRanking .sub.on'), fila = $('#subRanking');
  if (b && fila.scrollWidth > fila.clientWidth) {
    fila.scrollLeft = Math.max(0, b.offsetLeft - fila.offsetLeft - (fila.clientWidth - b.offsetWidth) / 2);
  }
  pintaTabla();
}

function pintaTabla() {
  var cfg = SUBS[SUB] || SUBS.temporada;
  if (cfg.hay && !cfg.hay()) cfg = { pronto: cfg.siNo };
  MW_ON = !!(D.mw && (D.mw.b || []).length) || (D.tabla || []).some(function (f) { return f.caz || f.czd || f.sob; });
  $('#bajadaRk').innerHTML = cfg.baj || cfg.pronto || '';
  $('#chipsSv').hidden = $('#chipsCc').hidden = !!(cfg.sinChips || cfg.pronto);
  $('#buscar').hidden = !!cfg.pronto;
  var nota = cfg.nota ? cfg.nota() : '';
  // la línea que explica el «—», sólo si en este ranking hay alguien así
  if (!cfg.pronto && cfg.filas().some(function (f) { return f.fc; })) {
    nota = (nota ? nota + ' ' : '') + 'En el <b>#</b>, <b>&mdash;</b> es <b>fuera de concurso</b>: todavía no es miembro de ' +
      'la Liga (tiene que estar en Discord Rap Español y verificarse). Sus puntos cuentan igual; el número ' +
      'es de los miembros.';
  }
  $('#notaSub').innerHTML = nota;
  $('#notaSub').hidden = !nota;
  if (cfg.pronto) {
    $('#cabTabla').innerHTML = '';
    $('#filas').innerHTML = '<tr><td class="vacio pronto-td"><span>' +
      (cfg.cuando || 'Próximamente') + '</span>' + cfg.pronto + '</td></tr>';
    $('#notaTabla').textContent = '';
    return;
  }
  // el puesto DENTRO DE ESTE RANKING, antes de que quien mira reordene
  var base = cfg.filas().slice();
  var cols = cfg.cols.filter(function (id) { return !COL[id].si || COL[id].si(base); });
  base = typeof cfg.orden === 'function' ? base.sort(cfg.orden)
    : ordenadas(base, cfg.orden, !COL[cfg.orden].txt && cfg.orden !== 'pos');
  // 🔑 el número salta a quien está fuera de concurso: Velatz queda en su
  // lugar, sin número, y el que sigue es el #3
  var nro = 0;
  base.forEach(function (f, i) {
    f._o = i + 1;
    f._i = (cfg.sinPuesto && cfg.sinPuesto(f)) || f.fc ? '' : ++nro;
  });
  var fs = filtradas(base, cfg);
  if (ORDEN.tocado) fs = ordenadas(fs, ORDEN.col, ORDEN.desc);
  // sin tocar, la flecha va en «#»: es el orden de este ranking
  var act = ORDEN.tocado ? ORDEN.col : cols[0], dsc = ORDEN.tocado ? ORDEN.desc : false;
  $('#cabTabla').innerHTML = '<tr>' + cols.map(function (id) {
    var c = COL[id];
    return '<th scope="col" tabindex="0" data-col="' + id + '" class="ord' +
      (c.cls ? ' ' + c.cls : '') + (id === act ? (dsc ? ' desc' : ' asc') : '') + '"' +
      (c.tit ? ' title="' + esc(c.tit) + '"' : '') +
      (id === act ? ' aria-sort="' + (dsc ? 'descending' : 'ascending') + '"' : '') + '>' +
      c.t + '</th>';
  }).join('') + '</tr>';
  var que = cfg.que || ['rapero', 'raperos'];
  if (!fs.length) {
    $('#filas').innerHTML = '<tr><td colspan="' + cols.length + '" class="vacio">' +
      (base.length ? 'Nadie con ese filtro.'
        : cfg.vacio ? cfg.vacio() : 'Todavía no hay nadie en este ranking.') + '</td></tr>';
    $('#notaTabla').textContent = '';
    return;
  }
  $('#filas').innerHTML = fs.map(function (f) {
    var cl = [f._i === 1 ? 'top1' : f._i === 2 ? 'top2' : f._i === 3 ? 'top3' : '',
      f.fc ? 'fc' : '', cfg.fila ? cfg.fila(f) : ''].filter(Boolean).join(' ');
    return '<tr' + (cl ? ' class="' + cl + '"' : '') + (f.k ? ' data-k="' + esc(f.k) + '"' : '') +
      (cfg.enlace ? cfg.enlace(f) : '') + '>' +
      cols.map(function (id) {
        var c = COL[id];
        return '<td' + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + c.v(f) + '</td>';
      }).join('') + '</tr>';
  }).join('');
  $('#notaTabla').textContent = fs.length === base.length
    ? fs.length + ' ' + (fs.length === 1 ? que[0] : que[1])
    : fs.length + ' de ' + base.length;
}

/* ── quién entra en la sección de tarjetas ────────────────────
   🔑 UN SOLO LUGAR PARA LAS TRES VISTAS. La galería, el comparador y su
   sugeridor tenían este mismo filtro escrito tres veces, y el pedido de
   Dlx del 24/09/2026 —*«solo quisiera ver tarjetas con avatares»*— toca a
   los tres: arreglado en uno, el comparador seguiría ofreciendo a alguien
   que la galería ya no muestra. Es la forma de `escudo()`, que este repo
   documenta escrita tres veces y rota en una.

   Dos condiciones:
   • **tiene alguna carta en R2 y se la ganó** — `c`, que `subir_web.py`
     arma preguntando a `comun/requisitos.py`;
   • **tiene cara** — `fo`.

   ⚠️ `fo !== 0` Y NO `fo === 1`, a propósito. El payload que hay en KV
   hasta que el ciclo escriba el siguiente **no trae `fo`**, y con
   `=== 1` la sección entera quedaría vacía mientras el Worker sirve esa
   copia — sin que nada falle, que es la peor forma. Mejor caras de menos
   que una página en blanco; es la misma decisión que `_con_foto()` toma
   del otro lado.

   ⚠️ Y NO TOCA LA TABLA NI EL RANKING. Quien no tiene foto compitió
   igual; sacarlo de ahí le borraría lo que sí se ganó. */
function conTarjeta() {
  return (D.tabla || []).filter(function (f) {
    return (f.c || []).length && f.fo !== 0;
  });
}

/* ── galería ──────────────────────────────────────────────────────── */
function pintaGaleria() {
  // sin tildes, como el ranking y el Inicio: «lazaro» encuentra a Lázaro
  var q = sinTildes(FIL.qc || '').trim();
  var hay = conTarjeta();
  var con = hay.filter(function (f) {
    return !q || sinTildes(f.n).indexOf(q) >= 0;
  });
  if (!con.length) {
    // ⚠️ DOS VACÍOS DISTINTOS, DOS MENSAJES. «Nadie con ese nombre» es
    // cierto cuando hay galería y la búsqueda no encontró a nadie, y es
    // una mentira cuando la galería está vacía de entrada — ahí no
    // sobra el nombre, faltan las caras.
    $('#galeria').innerHTML = '<p class="sin-carta">' + (hay.length
      ? 'Nadie con ese nombre.'
      : 'Todavía no hay tarjetas con foto. Poné la tuya en Discord con ' +
        '<code>/foto</code>.') + '</p>';
    $('#masCartas').hidden = true;
    return;
  }
  $('#galeria').innerHTML = con.slice(0, VISTAS).map(function (f) {
    // ⚠️ SIN CHAPA DE PUESTO: la tarjeta ya lo dibuja arriba a la
    // derecha, y la chapa caía justo encima del OVR.
    return '<button class="gc' + (vieja(f, f.c[0]) ? ' vieja' : '') +
      '" data-carta="' + esc(f.k) + '"' +
      (vieja(f, f.c[0]) ? ' title="Se está redibujando con los datos de ahora"' : '') +
      '>' +
      '<img loading="lazy" decoding="async" src="' + urlCarta(f, f.c[0]) +
      '" alt="Tarjeta de ' + esc(f.n) + '">' +
      '<b>' + esc(f.n) + '</b><small>' + f.c.length + ' tarjeta' +
      (f.c.length === 1 ? '' : 's') + '</small></button>';
  }).join('');
  $('#masCartas').hidden = con.length <= VISTAS;
  $('#masCartas').textContent = 'Ver las ' + con.length;
}

/* ── comparar dos ───────────────────────────────────────────────────
   🔑 TODO EL CRUCE LO HACE EL NAVEGADOR con el payload que ya bajó: no
   hay una consulta nueva ni una ruta nueva. Es la misma idea que el
   buscador y el orden de la tabla —ver la cabecera de este archivo— y
   por eso agregarlo no cuesta un milisegundo de Worker.

   ⚠️ Y ARRANCA CON EL #1 Y EL #2, no vacío: un comparador con dos
   selects en blanco no muestra para qué sirve. */
var CMP = [0, 1];

/* 🔑 PRIMERO QUÉ TARJETA. Dlx, 25/09/2026: «en comparación de 2 elegir la
   categoría primero, o sea qué se va a comparar». Cada tarjeta mide otra
   cosa, así que cada una trae sus filas: comparar el OVR de dos tarjetas
   Competitivas sería comparar lo que esa tarjeta no mide.

   ⚠️ UNA CATEGORÍA QUE TIENEN MENOS DE DOS SE VE APAGADA, con cuántos la
   tienen: esconderla haría pensar que no existe. */
var CMP_CAT = 'temporada';
var CATS = [['temporada', 'Temporada'], ['competitivo', 'Competitiva'],
  ['pais', 'País'], ['servidor', 'Servidor']];
var FILAS_CMP = {
  temporada: [['ovr', 'OVR', 1], ['pts', 'Puntos', 1], ['ev', 'Eventos', 1],
    ['pod', 'Podios', 1], ['pos', 'Puesto', -1]],
  competitivo: [['sc', 'Score', 1], ['ev', 'Eventos', 1], ['wr', 'Win%', 1], ['oro', 'Títulos', 1]],
  pais: [['pts', 'Puntos', 1], ['ev', 'Eventos', 1], ['pod', 'Podios', 1], ['pos', 'Puesto', -1]],
  servidor: [['pts', 'Puntos', 1], ['ev', 'Eventos', 1], ['oro', 'Títulos', 1], ['pos', 'Puesto', -1]],
};
function cmpLista() {
  return conTarjeta().filter(function (f) { return (f.c || []).indexOf(CMP_CAT) >= 0; });
}

function pintaComparar() {
  var todas = conTarjeta();
  if (todas.length < 2) { apaga('#secComparar'); return; }
  var cuantos = function (cat) {
    return todas.filter(function (f) { return (f.c || []).indexOf(cat) >= 0; }).length;
  };
  if (cuantos(CMP_CAT) < 2) CMP_CAT = 'temporada';
  $('#cmpCat').innerHTML = CATS.map(function (c) {
    var n = cuantos(c[0]);
    return '<button class="sub' + (c[0] === CMP_CAT ? ' on' : '') + '" data-cat="' + c[0] + '"' +
      (n < 2 ? ' disabled title="Hace falta que dos la tengan"' : '') + '>' + c[1] +
      '<i>' + n + '</i></button>';
  }).join('');
  var con = cmpLista();
  if (con.length < 2) { $('#cmp').innerHTML = ''; return; }
  CMP = CMP.map(function (i) { return Math.min(i, con.length - 1); });
  if (CMP[0] === CMP[1]) CMP[1] = CMP[0] ? 0 : 1;
  // 🔑 SE PUEDE ESCRIBIR EL NOMBRE, no sólo desplegar la lista (Dlx,
  // 24/09/2026). La ventanita de sugerencias es `pintaSug()`.
  var lado = function (j) {
    var f = con[CMP[j]];
    if (!f) return '';
    return '<div class="cmp-lado">' +
      '<input class="cmp-busca" data-lado="' + j + '" ' +
      'value="' + esc(f.n) + '" placeholder="Escribí un nombre…" ' +
      'autocomplete="off" spellcheck="false" ' +
      'aria-label="Rapero a comparar">' +
      '<img loading="lazy" decoding="async" src="' + urlCarta(f, CMP_CAT) +
      '" alt="Tarjeta ' + esc(CARTA_TIT[CMP_CAT] || '') + ' de ' + esc(f.n) + '"></div>';
  };
  var a = con[CMP[0]], b = con[CMP[1]];
  var val = function (f, k) { return typeof f[k] === 'string' ? pct(f[k]) : (f[k] || 0); };
  var vs = (FILAS_CMP[CMP_CAT] || FILAS_CMP.temporada).map(function (par) {
    var k = par[0], et = par[1], dir = par[2];
    var x = val(a, k), y = val(b, k);
    // ⚠️ EN EL PUESTO GANA EL NÚMERO MÁS CHICO: sin ese `-1` el #1
    // aparecería perdiendo contra el #40.
    var ga = dir > 0 ? x > y : x < y;
    var gb = dir > 0 ? y > x : y < x;
    var fmt = function (v) {
      return k === 'pos' ? '#' + v : k === 'wr' ? String(v).replace('.', ',') + '%'
        : k === 'sc' ? String(v).replace('.', ',') : num(v);
    };
    return '<div class="fila"><b class="' + (ga ? 'gana' : '') + '">' + fmt(x) +
      '</b><em>' + et + '</em><b class="' + (gb ? 'gana' : '') + '">' + fmt(y) +
      '</b></div>';
  }).join('');
  $('#cmp').innerHTML =
    '<div class="sugeridor" id="sugeridor" hidden></div>' +
    lado(0) + lado(1) +
    (a.k === b.k ? '<p class="sin">Elegí dos distintos.</p>'
                 : '<div class="vs">' + vs + '</div>');
  $('#cmp').dataset.par = a.k + '|' + b.k;
  pintaCaraCmp();
}
/* 🔑 Y SI SE CRUZARON, CARA A CARA, arriba de todo: cuántas ganó cada uno
   contra el otro. Sale de los duelos de `/api/perfiles`, que se piden sólo
   con «Tarjetas» a la vista (Dlx, 27/09/2026, el «duelos win rate entre cada
   uno»). */
function pintaCaraCmp() {
  var par = ($('#cmp') && $('#cmp').dataset.par) || '';
  var ab = par.split('|');
  if (!ab[1] || ab[0] === ab[1] || (!PERF && ruta() !== 'tarjetas')) return;
  perfiles().then(function (P) {
    var vs = $('#cmp .vs');
    if (!vs || $('#cmp').dataset.par !== par || vs.querySelector('.cara')) return;
    var x = P && P.p && P.p[ab[0]];
    var c = caraACara(x && x.du).filter(function (c) { return c.k === ab[1]; })[0];
    if (!c) return;
    var t = c.g + c.p;
    vs.insertAdjacentHTML('afterbegin', '<div class="fila cara"><b class="' + (c.g > c.p ? 'gana' : '') +
      '">' + c.g + '</b><em>Cara a cara &middot; ' + (t === 1 ? 'una vez' : t + ' veces') + '</em><b class="' +
      (c.p > c.g ? 'gana' : '') + '">' + c.p + '</b></div>');
  });
}

/* ── el sugeridor del comparador ──────────────────────────────────────
   🔑 UNA VENTANITA PROPIA Y NO EL `<datalist>` DEL NAVEGADOR. Dlx,
   24/09/2026: *«eso de buscar debería aparecer una mini ventana con los
   resultados más cercanos basado en lo que escribo»*.

   El `<datalist>` parecía gratis y tiene tres problemas que sólo se ven
   usándolo: **filtra por prefijo**, así que escribir «chula» no encuentra
   a `PichulaMc`; se dibuja con el estilo del sistema operativo, o sea
   blanco sobre una página negra; y en varios navegadores no aparece hasta
   que se toca la flecha. Un control que a veces no se ve es un control
   que no está.

   ⚠️ VIVE FUERA DE `pintaComparar()`, y eso no es orden: repintar
   reemplaza el `<input>` que tiene el foco, así que si la lista se
   dibujara ahí adentro se perdería el cursor a la segunda letra. Por eso
   antes el cambio iba en `change` y no en `input` — ahora se puede
   sugerir en cada tecla porque la ventanita es otro elemento. */
var SUG = { lado: -1, sel: 0, lista: [] };

function cerrarSug() {
  var e = $('#sugeridor');
  if (e) { e.hidden = true; e.innerHTML = ''; }
  SUG.lado = -1;
}

function pintaSug(inp) {
  var con = cmpLista();
  var q = sinTildes(inp.value || '').trim();
  // ⚠️ POR CONTENIDO Y NO POR PREFIJO: «chula» tiene que encontrar a
  // PichulaMc. Los que empiezan igual van primero igual, porque es lo
  // que uno espera al escribir las primeras letras.
  var empieza = [], dentro = [];
  con.forEach(function (f, i) {
    var n = sinTildes(f.n);
    if (!q) { empieza.push([f, i]); return; }
    var p = n.indexOf(q);
    if (p === 0) empieza.push([f, i]);
    else if (p > 0) dentro.push([f, i]);
  });
  SUG.lista = empieza.concat(dentro).slice(0, 8);
  SUG.sel = 0;
  SUG.lado = +inp.dataset.lado;
  var e = $('#sugeridor');
  if (!SUG.lista.length) {
    e.innerHTML = '<div class="sug-no">Nadie con ese nombre</div>';
  } else {
    e.innerHTML = SUG.lista.map(function (par, j) {
      var f = par[0];
      return '<button class="sug' + (j ? '' : ' on') + '" data-i="' +
        par[1] + '"><i class="cc">' + ccTexto(f.cc) + '</i>' + esc(f.n) +
        '<span>' + num(f.pts) + ' pts</span></button>';
    }).join('');
  }
  // se pega debajo del campo que se está escribiendo
  var r = inp.getBoundingClientRect(), c = $('#cmp').getBoundingClientRect();
  e.style.left = (r.left - c.left) + 'px';
  e.style.top = (r.bottom - c.top + 4) + 'px';
  e.style.width = r.width + 'px';
  e.hidden = false;
}

function eligeSug(i) {
  if (i == null || i < 0 || SUG.lado < 0) return;
  CMP[SUG.lado] = i;
  cerrarSug();
  pintaComparar();
}

/* Del texto escrito al índice de `con`. `-1` si no es nadie.
   ⚠️ Compara normalizado: quien escribe «makmah» en minúscula, o con un
   espacio de más al pegar, está nombrando a la misma persona. */
function indiceDe(txt, con) {
  var k = String(txt || '').trim().toLowerCase();
  if (!k) return -1;
  for (var i = 0; i < con.length; i++) {
    if (String(con[i].n).trim().toLowerCase() === k) return i;
  }
  // y si no es exacto, el primero que empiece igual
  for (var j = 0; j < con.length; j++) {
    if (String(con[j].n).trim().toLowerCase().indexOf(k) === 0) return j;
  }
  return -1;
}

/* ── servidores, países, crews ────────────────────────────────────── */
/* 🔑 LOS NUEVE, con su logo, su nombre completo y cuánta gente tienen.
   Dlx, 25/09/2026: «deberías agregar DRA, Snake Rap también, pero con sus
   nombres completos e incluso sus logos y cantidad de miembros». Antes
   salían sólo los que tenían raperos en la T1 —con la T1 entera en FFA,
   uno solo—.
   ⚠️ Cada pieza sale si hay dato: sin logo va la sigla, sin cantidad no
   se inventa un número, y sin raperos en la T1 no se dice «0 puntos». */
function pintaServidores() {
  var ss = D.svs || [];
  if (!ss.length) { apaga('#secSvs'); return; }
  $('#svs').innerHTML = ss.map(function (s) {
    var logo = s.logo
      ? '<img class="sv-logo" src="' + esc(s.logo) + '" alt="" width="64" height="64" loading="lazy">'
      : '<span class="sv-logo sv-sigla">' + esc(s.sv) + '</span>';
    var datos = [];
    // 🔑 EXACTO. Dlx, 25/09/2026: «en el mundo poner números exactos».
    if (s.miembros) datos.push('<div><dt>Miembros</dt><dd>' + num(s.miembros) + '</dd></div>');
    if (s.n) {
      datos.push('<div><dt>En la T1</dt><dd>' + s.n + '</dd></div>');
      datos.push('<div><dt>Puntos</dt><dd>' + num(s.pts) + '</dd></div>');
    }
    // 🔑 LA ETIQUETA, LAS REDES Y UN «ENTRAR» GRANDE. Dlx, 25/09/2026:
    // «generar tags para los servidores… y hacer el botón de entrar más
    // grande, mira el espacio de cada cosa».
    return '<div class="sv-c" style="--c:' + esc(colorVisible(s.color)) + '">' +
      '<div class="sv-cab">' + logo + '<div><h3>' + esc(s.nombre || s.sv) + '</h3>' +
      (s.tag ? '<span class="sv-tag">' + esc(s.tag) + '</span>' : '<small>' + esc(s.sv) + '</small>') +
      '</div></div>' +
      (datos.length ? '<dl>' + datos.join('') + '</dl>' : '') +
      (s.redes ? '<div class="sv-redes">' + redes(s.redes) + '</div>' : '') +
      (s.invita ? '<a class="sv-entrar" href="' + esc(s.invita) + '" target="_blank" ' +
        'rel="noopener noreferrer">Entrar al servidor &#8599;</a>' : '') + '</div>';
  }).join('');
}

function pintaPaises() {
  var ps = D.paises || [], cs = D.crews || [];
  // 🔴 DOS SECCIONES, DOS DECISIONES. Esto era un `return` temprano
  // cuando no había países, y ese `return` se llevaba puesto el apagado
  // de las crews: con el pool vacío la vista de Mundo quedaba con UN
  // panel «Las crews» sin nada adentro. Lo encontró la prueba de borde,
  // no mirarlo — porque con datos de verdad las dos listas tienen algo
  // y el camino no se recorre nunca.
  if (!cs.length) apaga('#secCrews');
  if (!ps.length) { apaga('#secPaises'); return; }
  $('#listaPaises').innerHTML = ps.map(function (p, i) {
    return '<div class="pa" data-pais="' + esc(p.cc) + '"><span class="p">' + (i + 1) + '</span>' +
      '<span class="fl">' + ccTexto(p.cc) + '</span>' +
      '<span class="nm">' + esc(nombrePais(p.cc)) + '</span>' +
      '<span class="n">' + p.n + (p.n === 1 ? ' rapero' : ' raperos') + '</span>' +
      '<span class="pt">' + num(p.pts) + '</span></div>';
  }).join('');
  if (!cs.length) return;
  // 🔑 TODAS LAS QUE TIENEN GENTE EN LA TEMPORADA, con su logo y su gente.
  // El puesto sigue pidiendo tres raperos: las que no llegan van sin número
  // y apagadas (ver `_crews()` en bot/subir_web.py).
  var pos = 0;
  $('#crews').innerHTML = cs.map(function (c) {
    var p = c.rk === 0 ? 0 : ++pos;
    return '<div class="cw' + (p ? '' : ' chica') + '" data-crew="' + esc(c.clave || c.crew) + '">' +
      (c.logo ? '<img class="cw-logo" src="' + esc(c.logo) + '" alt="" width="48" height="48" loading="lazy">'
        : '<span class="cw-logo cw-ini">' + esc(inicial(c.crew)) + '</span>') +
      '<div class="cw-tx"><b>' + esc(c.crew) + '</b><small>' + c.n + (c.n === 1 ? ' rapero' : ' raperos') +
      ' &middot; ' + num(c.pts) + ' pts</small>' +
      ((c.gente || []).length ? '<p class="cw-g">' + c.gente.map(function (n) {
        var k = kDe(n);
        return k ? '<span class="lnk" data-k="' + esc(k) + '">' + esc(n) + '</span>' : esc(n);
      }).join(', ') + '</p>' : '') + '</div>' +
      '<u class="cw-p"' + (p ? '' : ' title="Para tener puesto hacen falta tres raperos"') + '>' +
      (p ? '#' + p : '&mdash;') + '</u></div>';
  }).join('');
}

/* ── rangos ───────────────────────────────────────────────────────── */
function pintaRangos() {
  var rs = D.rangos || [];
  if (!rs.length) { apaga('#secRangos'); return; }
  var cuenta = {};
  (D.tabla || []).forEach(function (f) {
    if (f.rg) {
      var r = f.rg.replace(/[+\-−]$/, '');
      cuenta[r] = (cuenta[r] || 0) + 1;
    }
  });
  var alguno = Object.keys(cuenta).length;
  $('#escalera').innerHTML = rs.map(function (r) {
    return '<div class="rk" style="--c:' + esc(r.color) + '">' +
      '<b>' + esc(r.r) + '</b><small>' + esc(r.mat) + '</small><u>' +
      (alguno ? (cuenta[r.r] || 0) + ' hoy' : (r.min ? r.min + '+' : 'resto')) +
      '</u></div>';
  }).join('');
  // 🔴 «0 DE 0» NO ES «0 %», ES QUE NO HAY CON QUE MEDIR. Es la regla del
  // proyecto: hoy nadie llegó a 10 eventos, así que la escalera muestra
  // los umbrales y lo dice, en vez de ocho ceros que parecen un error.
  $('#bajadaRangos').innerHTML = alguno
    ? 'El rango sale del <b>Score competitivo</b> y es uno solo por persona: ' +
      'da igual en sus cuatro tarjetas.'
    : 'El rango sale del <b>Score competitivo</b>, y para tenerlo hacen falta ' +
      '<b>10 eventos</b> en la temporada. Todavía no llegó nadie, así que acá ' +
      'van los umbrales — no es que estén todos en cero, es que la temporada ' +
      'recién arrancó.';
}

/* ── cómo conseguir tu tarjeta ────────────────────────────────────── */
function pintaComo() {
  // 🔑 Y LAS DOS QUE VIENEN. Dlx, 25/09/2026: «en guía, cómo conseguir tu
  // tarjeta, agregá HISTÓRICA y PRIME con lo de PRÓXIMAMENTE». Las dos
  // llegan con la T2: la Histórica suma todas las temporadas.
  var qs = (D.requisitos || []).concat(D.requisitos && D.requisitos.length ? [
    { titulo: 'Histórica', mide: 'Todas tus temporadas juntas.', pide: ['Llega con la Temporada 2'], prox: 1 },
    { titulo: 'Prime', mide: 'Próximamente.', pide: ['Llega con la Temporada 2'], prox: 1 },
  ] : []);
  if (!qs.length) { apaga('#secComo'); return; }
  $('#listaComo').innerHTML = qs.map(function (q) {
    return '<div class="cm' + (q.prox ? ' prox' : '') + '"><h3>' + esc(q.titulo) +
      (q.prox ? '<span class="pase-tag">Próximamente</span>' : '') + '</h3><p>' + esc(q.mide) +
      '</p><ul>' + (q.pide || []).map(function (p) {
        return '<li' + (p === 'nada' ? ' class="nada"' : '') + '>' +
          (p === 'nada' ? 'Sin requisito' : esc(p)) + '</li>';
      }).join('') + '</ul></div>';
  }).join('');
}

/* ── el visor ─────────────────────────────────────────────────────── */
var NOMBRE_CARTA = {
  temporada: 'Temporada', competitivo: 'Competitiva',
  servidor: 'Servidor', pais: 'País',
  'bloq-temporada': 'Temporada 🔒', 'bloq-competitivo': 'Competitiva 🔒',
  'bloq-pais': 'País 🔒', 'bloq-servidor': 'Servidor 🔒'
};

// ══════════════════════════════════════════════════════════════════════
// 🔴 BAJAR UNA CARTA NO ES UN `<a download>`, Y ESO NO SE PUEDE ADIVINAR
// LEYENDO: los navegadores **ignoran** el atributo `download` cuando el
// archivo es de otro origen. Con un `<a download href="…r2.dev/…">` el
// botón se ve bien, no da error, y abre la imagen en vez de guardarla.
//
// Así que se baja con `fetch` y se guarda un blob — y eso pide **CORS en
// el bucket**, que no tenía. Medido el 24/09/2026: `pub-*.r2.dev` no
// mandaba ni un `access-control-*`. Se le puso una política limitada a
// los dos dominios de Pages; a cualquier otro origen sigue sin mandarla.
//
// ⚠️ Y HAY UN CAMINO DE VUELTA, porque el que falla es el `fetch`: si la
// política se cae o el archivo no está, se abre la imagen en otra pestaña.
// Un botón que no hace nada es peor que uno que hace algo parecido.
//
// ⚠️ El nombre del archivo lo pone la página y no el bucket. En R2 todas
// se llaman `temporada.webp` —la clave es `<persona>/<carta>.webp`— así
// que cuatro descargas dejarían cuatro archivos con el mismo nombre.
function bajarCarta(f, cual) {
  var nombre = f.n.replace(/[\\/:*?"<>|]/g, '') + ' - ' +
    (NOMBRE_CARTA[cual] || cual) + '.webp';
  var url = urlCarta(f, cual);
  var b = $('#vBajar');
  if (b) b.classList.add('yendo');
  fetch(url, { mode: 'cors' }).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.blob();
  }).then(function (bl) {
    var u = URL.createObjectURL(bl);
    var a = document.createElement('a');
    a.href = u;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // sin esto el blob queda en memoria toda la sesión
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }).catch(function () {
    window.open(url, '_blank', 'noopener');
  }).then(function () {
    if (b) b.classList.remove('yendo');
  });
}

function abrir(k) {
  var f = porK(k) || filaCuenta(k);
  if (!f) return;
  $('#vPos').textContent = f.pos && f.pos !== '—' ? '#' + f.pos : '';
  $('#vNombre').textContent = f.n;
  // 🔑 EL PAÍS Y LA CREW SE TOCAN, como en el perfil (Dlx, 25/09/2026: «que
  // aparezca el mouse para clickear como cualquier perfil»)
  var pa = String(f.cc || '').toLowerCase();
  var cr = f.crew && (D.crews || []).filter(function (c) { return c.crew === f.crew; })[0];
  $('#vSub').innerHTML = [pa && PAIS[pa] ? '<a class="v-lnk" href="#/pais/' + esc(pa) + '">' + ccTexto(pa) +
      ' ' + esc(nombrePais(pa)) + '</a>' : ccTexto(f.cc), esc(f.sv),
    f.crew ? (cr ? '<a class="v-lnk" href="#/crew/' + encodeURIComponent(cr.clave || cr.crew) + '">' +
      esc(f.crew) + '</a>' : esc(f.crew)) : '']
    .filter(Boolean).join(' &middot; ');
  $('#vStats').innerHTML =
    '<div><b>' + (f.ovr || '—') + '</b><span>OVR</span></div>' +
    '<div><b>' + num(f.pts) + '</b><span>Puntos</span></div>' +
    '<div><b>' + f.ev + '</b><span>Eventos</span></div>' +
    '<div><b>' + esc(f.wr || '—') + '</b><span>Win%</span></div>';

  var cs = f.c || [];
  var img = $('#vImg');
  if (cs.length) {
    $('#vPestanas').innerHTML = cs.map(function (c, i) {
      return '<button class="pest' + (i ? '' : ' on') + '" data-c="' + c + '">' +
        (NOMBRE_CARTA[c] || c) + '</button>';
    }).join('');
    $('#vPestanas').dataset.k = k;
    img.hidden = false;
    img.src = urlCarta(f, cs[0]);
    img.alt = 'Tarjeta ' + (NOMBRE_CARTA[cs[0]] || cs[0]) + ' de ' + f.n;
    avisoCarta(f, cs[0]);
  } else {
    img.hidden = true;
    avisoCarta(f, '');
    $('#vPestanas').innerHTML =
      '<p class="sin-carta">Todavía no tiene ninguna tarjeta emitida.</p>';
  }
  // ⚠️ EL BOTON SIGUE A LA CARTA, NO A LA PERSONA: sin cartas no hay nada
  // que bajar, y dejarlo visible sería un botón que no puede funcionar.
  var bj = $('#vBajar');
  if (bj) {
    bj.hidden = !cs.length;
    bj.dataset.k = k;
  }
  // 🔑 DE LA TARJETA AL PERFIL: el botón lleva `data-k`, así que lo
  // atiende el mismo escucha que cualquier nombre
  if ($('#vPerfil')) {
    $('#vPerfil').dataset.k = k;
    // quien entró con Discord y no jugó la temporada no tiene página todavía
    $('#vPerfil').hidden = !porK(k);
  }
  $('#visor').hidden = false;
  document.body.style.overflow = 'hidden';
}

function cerrar() {
  $('#visor').hidden = true;
  // ⚠️ si la llave sigue abierta debajo, la página sigue quieta
  if ($('#visorLlave').hidden) document.body.style.overflow = '';
  $('#vImg').src = '';
}

/* ── el cuadro de la llave ────────────────────────────────────────────
   🔑 Dlx, 25/09/2026, con la imagen de una llave clásica: «pensé que ibas
   a crear algo así y rellenar los nombres en esos huecos». La llave era
   una lista de rondas; ahora es el cuadro, con las ramas.

   Las ramas no las inventa la página: cada batalla trae de qué batallas
   de la ronda anterior vienen sus lados (`b[3]`, lo arma
   `llaves_web.enlazar()` por los nombres de los ganadores).

   ⚠️ EN ESPEJO SÓLO SI SE PUEDE: la final en el medio y una mitad de cada
   lado, como en la imagen, pide una final con dos ramas. Si la llave es
   rara —una final sin semis enganchadas— o la pantalla es de teléfono, va
   de un solo lado, de izquierda a derecha, y se desliza.

   ⚠️ LO QUE NO ENGANCHA SE DIBUJA IGUAL, en su columna y sin rama: un
   walk-in o un revivido no tiene de dónde venir, y sacarlo sería borrar
   una batalla que se jugó. */
function miembrosDe(x) {
  return String(x || '').split(',').map(function (s) {
    return s.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim().toLowerCase();
  }).filter(Boolean);
}
function comparten(a, b) {
  var mb = miembrosDe(b);
  return miembrosDe(a).some(function (x) { return mb.indexOf(x) >= 0; });
}

function cuadro(L, quien, cara) {
  var todas = L.rondas || [];
  var rs = todas.filter(function (R) { return R.r !== 'Tercer puesto' && R.b.length; });
  var ter = todas.filter(function (R) { return R.r === 'Tercer puesto' && R.b.length; })[0];
  var n = rs.length;
  if (!n) return '';
  var angosto = window.innerWidth < 760;
  var W = 150, G = angosto ? 24 : 30, FILA = 26, PAD = 5,
      SEP = angosto ? 10 : 14, TOPE = 34;
  // 🔑 UN RENGLÓN POR INTEGRANTE. En una llave de tríos los tres nombres
  // entraban a la fuerza en un renglón de 26 px y se cortaban (Dlx, con la
  // captura de TOKYO VOL.12). Ahora la caja crece con el equipo.
  var LINEA = 21;
  var miembros = function (s) { return String(s || '').split(/,\s*/).filter(Boolean).length || 1; };
  var altoLado = function (s) { return Math.max(FILA, 6 + LINEA * miembros(s)); };
  var alto = function (b) {
    return PAD * 2 + b[0].reduce(function (a, s) { return a + altoLado(s); }, 0) +
      (b[0].length < 2 ? FILA * (2 - b[0].length) : 0);
  };
  var hijos = function (r, i) {
    if (!r) return [];
    return ((rs[r].b[i] || [])[3] || []).filter(function (j) { return rs[r - 1].b[j]; });
  };
  var conPadre = {};
  rs.forEach(function (R, r) {
    R.b.forEach(function (b, i) {
      hijos(r, i).forEach(function (j) { conPadre[(r - 1) + ':' + j] = 1; });
    });
  });
  var pos = {};
  var colocar = function (r, i, cur, lado) {
    var hs = hijos(r, i), y;
    if (!hs.length) {
      var h = alto(rs[r].b[i]);
      y = cur.y + h / 2;
      cur.y += h + SEP;
    } else {
      var ys = hs.map(function (j) { return colocar(r - 1, j, cur, lado); });
      y = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
    }
    pos[r + ':' + i] = { r: r, i: i, y: y, lado: lado };
    return y;
  };
  var fin = hijos(n - 1, 0);
  var espejo = !angosto && n >= 3 && rs[n - 1].b.length === 1 && fin.length === 2;
  // 🔴 EL ANCHO DE CADA CAJA SALE DE CUÁNTAS COLUMNAS HAY QUE METER. Con un
  // ancho fijo, una llave de octavos en espejo —siete columnas— medía
  // 1.462 px y cortaba los octavos de las dos puntas.
  if (!angosto) {
    var cols = espejo ? 2 * n - 1 : n;
    // ⚠️ EL ANCHO DE LA CAJA DE VERDAD, no el de la ventana menos un número:
    // la cuenta a ojo no veía la barra del costado, y a 900 px diez de
    // quince llaves medían 10 px más que su caja (una barra para nada)
    var vis = $('#lVista');
    var disp = (vis && vis.clientWidth) || Math.min(1400, window.innerWidth * 0.97) - 44;
    W = Math.max(132, Math.min(196, Math.floor((disp + G) / cols - G)));
  }
  var curI = { y: 0 }, curD = { y: 0 };
  if (espejo) {
    colocar(n - 2, fin[0], curI, 'i');
    colocar(n - 2, fin[1], curD, 'd');
  } else {
    rs[n - 1].b.forEach(function (b, i) { colocar(n - 1, i, curI, 'i'); });
  }
  // lo que quedó suelto, en su columna
  rs.forEach(function (R, r) {
    R.b.forEach(function (b, i) {
      var k = r + ':' + i;
      if (pos[k] || conPadre[k] || (espejo && r === n - 1)) return;
      var cur = espejo && curD.y < curI.y ? curD : curI;
      colocar(r, i, cur, cur === curD ? 'd' : 'i');
    });
  });
  var HI = Math.max(0, curI.y - SEP), HD = Math.max(0, curD.y - SEP);
  var H = Math.max(HI, HD);
  Object.keys(pos).forEach(function (k) {
    var p = pos[k];
    p.y += espejo ? (H - (p.lado === 'd' ? HD : HI)) / 2 : 0;
  });
  if (espejo) {
    pos[(n - 1) + ':0'] = { r: n - 1, i: 0, lado: 'c',
      y: (pos[(n - 2) + ':' + fin[0]].y + pos[(n - 2) + ':' + fin[1]].y) / 2 };
  }
  // 🔴 SIN CAJA DE CAMPEÓN ARRIBA DE LA FINAL: repetía, con letra grande,
  // el renglón dorado de la final (Dlx, 27/09/2026: «I also dont have to see
  // 2 times that this team won»). La copa va en ese renglón.
  var pf = pos[(n - 1) + ':0'];
  // 🔑 CUÁNTO VALE CADA RONDA, arriba de su columna: los puntos de quien
  // queda afuera ahí. Es lo que ata el cuadro con «Los puntos, por puesto»
  // de abajo, que antes había que cruzar a mano. Sale de la tabla de la
  // misma llave; si en una ronda no todos se llevan lo mismo (las semis con
  // tercer puesto), no se escribe nada antes que un número a medias.
  var ptsDe = ptsDeLlave(L);
  var vale = rs.map(function (R) { return valeRonda(R, ptsDe); });
  // lo que se llevó el campeón; si el equipo no sumó parejo, de cuánto a cuánto
  var ptsCamp = (function () {
    var ps = miembrosDe((rs[n - 1].b[0] || [])[1]).map(function (m) { return ptsDe[m]; })
      .filter(function (v) { return v != null; });
    if (!ps.length) return null;
    var lo = Math.min.apply(null, ps), hi = Math.max.apply(null, ps);
    return lo === hi ? num(hi) : num(lo) + '&ndash;' + num(hi);
  })();
  if (vale.some(function (v) { return v != null; })) TOPE += 14;
  var ncol = espejo ? 2 * n - 1 : n;
  var col = function (p) { return p.lado === 'd' ? 2 * (n - 1) - p.r : p.r; };
  var X = function (p) { return col(p) * (W + G); };
  var campeon = (rs[n - 1].b[0] || [])[1] || '';

  // el nombre, o los del equipo, cada uno con su tarjeta si la tiene
  var lado = function (x, perdio) {
    return String(x || '').split(/,\s*/).map(function (m) {
      return quien(m, false, perdio);
    }).join('<i class="coma">,</i> ');
  };
  // `clave` ata la caja con sus ramas (`data-de`/`data-a`), para encender
  // el camino de quien se sigue
  var caja = function (b, x, y, cl, clave) {
    var h = alto(b);
    return '<div class="bx' + (cl || '') + '"' + (clave ? ' data-b="' + clave + '"' : '') +
      ' style="left:' + x + 'px;top:' +
      Math.round(y - h / 2) + 'px;width:' + W + 'px;height:' + h + 'px"' +
      (b[2] ? ' title="' + esc(b[2]) + '"' : '') + '>' + b[0].map(function (s) {
        var g = b[1] && (b[1] === s || comparten(b[1], s));
        var eq = miembros(s) > 1;
        // 🔑 EL EQUIPO, EN UN BLOQUE: las caras juntas adelante y los nombres
        // al lado (Dlx, 27/09/2026, «me gusta todo»)
        return '<div class="ld' + (g ? ' g' : '') + (eq ? ' eq' : '') + '" style="height:' + altoLado(s) +
          'px" title="' + esc(s) + '">' + (eq && cara ? '<span class="eq-caras">' +
            String(s).split(/,\s*/).map(cara).join('') + '</span>' : '') +
          '<span class="nm">' + (eq ? String(s).split(/,\s*/).map(function (m) {
            return '<span class="mb">' + quien(m, !!cara, b[1] && !g) + '</span>';
          }).join('') : lado(s, b[1] && !g)) + '</span></div>';
      }).join('') + '</div>';
  };

  var fondo = TOPE + H;
  var html = [], lineas = [];
  Object.keys(pos).forEach(function (k) {
    var p = pos[k], b = rs[p.r].b[p.i];
    var esFinal = p.r === n - 1 && rs[n - 1].b.length === 1;
    html.push(caja(b, X(p), TOPE + p.y, esFinal ? ' fin' : '', k));
    // la copa va en una etiqueta del borde, como «Revivido»: dentro del
    // renglón le comía el ancho a los nombres de un equipo
    var et = etiquetasHtml(b[2]) + etiquetaClasico(L, b) +
      (esFinal && b[1] ? '<span class="et-copa">&#127942; Campeón</span>' : '');
    if (et) {
      html.push('<span class="bx-et" style="left:' + X(p) + 'px;width:' + W + 'px;top:' +
        Math.round(TOPE + p.y - alto(b) / 2 - 9) + 'px">' + et + '</span>');
    }
    hijos(p.r, p.i).forEach(function (j) {
      var c = pos[(p.r - 1) + ':' + j];
      if (!c) return;
      var x1 = c.lado === 'd' ? X(c) : X(c) + W,
          x2 = c.lado === 'd' ? X(p) + W : X(p),
          y1 = TOPE + c.y, y2 = TOPE + p.y, xm = (x1 + x2) / 2;
      var oro = campeon && comparten(rs[c.r].b[c.i][1], campeon) &&
        comparten(b[1], campeon);
      lineas.push('<path' + (oro ? ' class="oro"' : '') + ' data-de="' + c.r + ':' + c.i +
        '" data-a="' + k + '" d="M' + x1 + ' ' + y1 + 'H' + xm + 'V' + y2 + 'H' + x2 + '"/>');
    });
  });
  // el tercer puesto, debajo de la final
  if (ter && pf) {
    var bt = ter.b[0], ht = alto(bt), yt = TOPE + pf.y + alto(rs[n - 1].b[0]) / 2 + 52 + ht / 2;
    html.push('<span class="rl sub" style="left:' + X(pf) + 'px;width:' + W + 'px;top:' +
      Math.round(yt - ht / 2 - 22) + 'px">Tercer puesto</span>');
    html.push(caja(bt, X(pf), yt, ' ter'));
    fondo = Math.max(fondo, yt + ht / 2);
  }
  // el nombre de cada ronda, arriba de su columna
  for (var c = 0; c < ncol; c++) {
    var r = espejo && c > n - 1 ? 2 * (n - 1) - c : c;
    var v = vale[r], fin = r === n - 1 && rs[n - 1].b.length === 1;
    html.push('<span class="rl" style="left:' + c * (W + G) + 'px;width:' + W + 'px">' +
      esc(rs[r].r) + (v != null || (fin && ptsCamp != null)
        ? '<small>' + (v != null ? num(v) + ' pts' : '') +
          (fin && ptsCamp != null ? (v != null ? ' &middot; ' : '') + '&#127942; ' + ptsCamp : '') +
          '</small>' : '') + '</span>');
  }
  var ancho = ncol * (W + G) - G, alto2 = Math.ceil(fondo + 8);
  // en el teléfono el cuadro no entra: se avisa que sigue a la derecha
  return (angosto && ncol > 2 ? '<p class="cuadro-guia">Deslizá para ver hasta la final &#8594;</p>' : '') +
    '<div class="cuadro-caja"><div class="cuadro" style="width:' + ancho +
    'px;height:' + alto2 + 'px"><svg width="' + ancho + '" height="' + alto2 +
    '" aria-hidden="true">' + lineas.join('') + '</svg>' + html.join('') +
    '</div></div>';
}

/* ── el calendario ────────────────────────────────────────────────────
   🔑 EL DÍA LO PONE EL NAVEGADOR. El payload trae el instante en UTC, y
   quien mira desde Madrid y quien mira desde Lima ven cada evento en SU
   día y a SU hora — un calendario en una sola zona le correría la fecha
   a media Liga. */
var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
var CAL = { y: 0, m: 0, dia: '' };
var dd2 = function (n) { return (n < 10 ? '0' : '') + n; };
function claveDia(d) {
  return d.getFullYear() + '-' + dd2(d.getMonth() + 1) + '-' + dd2(d.getDate());
}
function svDe(sv) {
  return (D.svs || []).filter(function (s) { return s.sv === sv; })[0] || {};
}
function colorSv(sv) { return colorVisible(svDe(sv).color || '#7E8B89'); }

/* 🔴 EL COLOR DE MARCA DE FFA ES #26045B, CASI NEGRO. Sobre el fondo de la
   página no se veía: los eventos de FFA eran puntos invisibles en el
   calendario. Se conserva el TONO de cada servidor —sigue siendo su
   violeta— y se sube la luz hasta que se lee. Los que ya se leen (DRA)
   quedan como están. */
/* 🔴 Y SÓLO LOS QUE NO SE LEEN. Dlx, 27/09/2026: «lo de Urban Freestyle usa
   otro naranja». El corte era la luz (L < 50 %), no si se leía, así que el
   naranja de Snake Rap —que se lee: 5,7:1 sobre el negro— también se
   aclaraba, y quedaba a ΔE 3 del de Urban: el mismo color a simple vista.
   Ahora se aclara sólo lo que no llega a 4,5:1. */
function contrasteNegro(r, g, b) {
  var li = function (c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  var y = 0.2126 * li(r) + 0.7152 * li(g) + 0.0722 * li(b);
  return (y + 0.05) / 0.0512;   // contra --ng, #030304
}
function colorVisible(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex || '#7E8B89';
  var n = parseInt(m[1], 16);
  var r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2,
      d = mx - mn, h = 0, s = 0;
  if (l >= 0.5 || contrasteNegro(r, g, b) >= 4.5) return '#' + m[1];
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  }
  return 'hsl(' + Math.round(h * 60) + ' ' + Math.round(Math.max(s, 0.5) * 100) + '% 60%)';
}
function nombreSv(sv) { return svDe(sv).nombre || sv || ''; }
function porDia() {
  var m = {};
  (D.calendario || []).forEach(function (c) {
    var t = new Date(c.t);
    if (isNaN(t)) return;
    // ⚠️ EL DÍA EN LA ZONA ELEGIDA, no la del dispositivo: si quien mira fijó
    // la hora del este, un evento de las 11 PM va en su día
    var k = diaDe(t);
    (m[k] = m[k] || []).push(c);
  });
  return m;
}

function pintaCalendario() {
  var cs = D.calendario || [];
  if (!cs.length) { apaga('#secCal'); apaga('#secDia'); return; }
  var M = porDia();
  if (!CAL.y) {
    var hoy = new Date(), hk = diaDe(hoy);
    CAL.y = hoy.getFullYear();
    CAL.m = hoy.getMonth();
    // el día que se abre: hoy si hubo algo; si no, el último que tuvo
    var dias = Object.keys(M).sort();
    var antes = dias.filter(function (k) { return k <= hk; });
    CAL.dia = M[hk] ? hk : (antes[antes.length - 1] || dias[0] || hk);
    var d0 = new Date(CAL.dia + 'T12:00:00');
    CAL.y = d0.getFullYear();
    CAL.m = d0.getMonth();
  }
  $('#calMes').textContent = MESES[CAL.m] + ' ' + CAL.y;
  var arranque = (new Date(CAL.y, CAL.m, 1).getDay() + 6) % 7;
  var diasMes = new Date(CAL.y, CAL.m + 1, 0).getDate();
  var celdas = Math.ceil((arranque + diasMes) / 7) * 7;
  var hoyK = diaDe(Date.now()), h = '';
  for (var i = 0; i < celdas; i++) {
    var d = new Date(CAL.y, CAL.m, 1 - arranque + i);
    var k = claveDia(d), evs = M[k] || [];
    h += '<button class="cal-d' + (d.getMonth() !== CAL.m ? ' otro' : '') +
      // 🔴 «es-hoy» Y NO «hoy»: `.hoy` es la grilla de dos columnas del panel
      // del Inicio, y partía la celda de hoy en dos (Dlx, 28/09/2026, con captura)
      (k === hoyK ? ' es-hoy' : '') + (k === CAL.dia ? ' sel' : '') +
      (evs.length ? ' con' : '') + '" data-dia="' + k + '"' +
      (evs.length ? ' aria-label="' + d.getDate() + ': ' + evs.length +
        (evs.length === 1 ? ' evento' : ' eventos') + '"' : '') + '><b>' + d.getDate() +
      '</b><span class="ces">' + evs.slice(0, 3).map(function (e) {
        return '<span class="ce' + (e.fut ? ' fut' : e.jugado ? '' : ' sin') +
          '" style="--c:' + esc(colorSv(e.sv)) + '"><i></i><u>' + esc(e.n) + '</u></span>';
      }).join('') + (evs.length > 3 ? '<span class="ce-mas">+' + (evs.length - 3) +
        '</span>' : '') + '</span></button>';
  }
  $('#calGrid').innerHTML = h;
  // 🔑 LOS SERVIDORES DE LA LIGA, CON SU LOGO, aunque todavía no hayan
  // jugado: Dlx, 25/09/2026, «el logo del servidor, agregar DRA».
  var vistos = (D.svs || []).map(function (x) { return x.sv; });
  cs.forEach(function (c) { if (vistos.indexOf(c.sv) < 0) vistos.push(c.sv); });
  var cuenta = {};
  cs.forEach(function (c) { cuenta[c.sv] = (cuenta[c.sv] || 0) + 1; });
  $('#calLey').innerHTML = vistos.map(function (sv) {
    return '<span style="--c:' + esc(colorSv(sv)) + '"><i></i>' + logoSv(sv, 18) +
      esc(nombreSv(sv)) + '<small>' + (cuenta[sv] || 0) + '</small></span>';
  }).join('') + '<span class="sin"><i></i>Anunciado, sin llave</span>' +
    '<span class="fut"><i></i>Por jugarse</span>';
  pintaDia(M);
}

function pintaDia(M) {
  M = M || porDia();
  // 🔑 LO MÁS NUEVO ARRIBA (Dlx, 28/09/2026: «que los eventos recientes estén
  // de recientes a menos recientes en el día»)
  var evs = (M[CAL.dia] || []).slice().sort(function (a, b) {
    return a.t < b.t ? 1 : -1;
  });
  var d = CAL.dia ? new Date(CAL.dia + 'T12:00:00') : null;
  var txt = d ? d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  $('#diaTit').innerHTML = '<span>&#128197;</span> ' +
    (txt ? esc(txt.charAt(0).toUpperCase() + txt.slice(1)) : 'El día') +
    (evs.length ? '<small class="dia-n">' + evs.length + (evs.length === 1 ? ' evento' : ' eventos') +
      ' &middot; ' + (function (z) { return z.indexOf('z-pais') >= 0 ? 'hora ' + z : z; })(etiquetaHora(evs[0].t)) +
      '</small>' : '');
  if (!evs.length) {
    $('#diaLista').innerHTML = '<p class="dia-no">Ese día no hubo eventos.</p>';
    return;
  }
  // 🔑 CADA EVENTO, UNA TARJETA: la hora grande a la izquierda, lo que es
  // arriba y lo que se puede hacer abajo, en una fila. Dlx, 25/09/2026: «la
  // zona de la derecha está rara, quizás podamos reorganizarlo mejor».
  // 📡 las llaves que se están jugando (ver `pintaVivo()`)
  var vivas = Object.keys(VIVO_L).map(function (k) { return VIVO_L[k]; });
  $('#diaLista').innerHTML = evs.map(function (e) {
    var L = e.ll && (D.llaves || {})[e.ll];
    var inf = (L && L.info) || {};
    var mod = e.mod || inf.mod || '';
    var camp = L ? (L.tabla || []).filter(function (r) { return r[1] === 'Campeón'; }) : [];
    // 🔑 LO QUE SE ESTÁ JUGANDO, CON SU LLAVE EN VIVO. Dlx, 28/09/2026, con
    // la VOL 16 2VS2 en cuartos: «no deja ver las llaves de este evento en
    // vivo en la sección de eventos». El calendario sólo miraba la llave ya
    // procesada (`ll`); la en vivo la une `llaveDeEvento()`, igual que «En vivo».
    var V = !e.ll && vivas.length ? llaveDeEvento({ cuando: e.t, sv: e.sv, nombre: e.n }, vivas) : null;
    // ⚠️ «POR JUGARSE» CON EL RELOJ DE QUIEN MIRA: el `fut` del payload es de
    // cuando corrió el ciclo, y hasta media hora después seguía diciéndolo
    var fut = Date.parse(e.t) > Date.now();
    var acc = (e.ll ? '<button class="btn" data-llave="' + e.ll + '">&#127942; Ver llave</button>'
      : V ? '<button class="btn" data-llave="v:' + esc(V.id) + '">&#128225; Ver la llave en vivo</button>' : '') +
      (fut && !V ? '<a class="btn" href="' + esc(googleEv(e)) + '" target="_blank" ' +
        'rel="noopener noreferrer">&#128197; Agregar a Google</a>' : '') +
      (e.link ? '<a class="btn sec" href="' + esc(e.link) + '" target="_blank" ' +
        'rel="noopener noreferrer">Discord &#8599;</a>' : '');
    var estado = e.jugado ? 'jugado' : V ? (V.terminada ? 'terminó' : 'en vivo') : fut ? 'por jugarse' : 'anunciado';
    return '<article class="de" style="--c:' + esc(colorSv(e.sv)) + '">' +
      // ⚠️ «DEL ANUNCIO» Y NO «ANUNCIADO»: el anuncio no decía la hora y ésta es
      // cuándo se publicó. «Anunciado» al lado de «jugado» se leía como dos
      // estados (Dlx, 28/09/2026, con captura). Lo jugado ya trae la hora de la llave
      '<div class="de-t"><b>' + esc(fmtHora(e.t)) + '</b>' +
      (e.sh ? '<small title="El anuncio no decía la hora: es cuándo se publicó">del anuncio</small>' : '') +
      '</div><div class="de-c"><h3>' + esc(e.n) + '</h3>' +
      '<div class="de-sub">' + chipSv(e.sv) + etiquetaMult(e.sv, e.t) +
      (e.ct ? '<span class="xm ct" title="Anunciado con 12 horas o más">&#128227; con tiempo</span>' : '') + (mod ? '<span class="lch">&#127908; ' + esc(mod) + '</span>' : '') +
      (e.rg || inf.rg ? '<span class="rg-ev">' + esc(e.rg || inf.rg) + '</span>' : '') +
      '<span class="de-est ' + (e.jugado ? 'jug' : V ? 'viv' : fut ? 'fut' : '') + '">' +
        (V && !V.terminada ? '<i class="vivo-punto" aria-hidden="true"></i>' : '') + estado + '</span></div>' +
      (camp.length ? '<p class="de-camp"><span>&#127942;</span>' + camp.map(function (r) {
        var f = porK(r[3] || kDe(r[0]));
        return f ? quienEs(f, 20) : conBanderas(r[0]);
      }).join('<i class="coma">,</i> ') + '</p>' : '') +
      (acc ? '<div class="de-acc">' + acc + '</div>' : '') + '</div></article>';
  }).join('');
}

/* ── los últimos campeones y cómo se juega ────────────────────────────
   🔑 Dlx, 25/09/2026: «agregar más cosas a la sección de eventos entre
   aviso de eventos y calendario». Sale de las llaves que viajan en el lobby
   y de su ficha (el formato y quién organizó vienen del anuncio). */
function jugadas() {
  var vistos = {};
  return (D.calendario || []).filter(function (c) {
    if (!c.ll || !(D.llaves || {})[c.ll] || vistos[c.ll]) return false;
    vistos[c.ll] = 1;
    return true;
  }).sort(function (a, b) { return a.t < b.t ? 1 : -1; });
}
function pintaUltCampeones() {
  var js = jugadas().slice(0, 6);
  if (!js.length) { apaga('#secCampeones'); return; }
  $('#secCampeones').hidden = false;
  $('#ultCampeones').innerHTML = js.map(function (c) {
    var L = D.llaves[c.ll], inf = L.info || {};
    var camp = (L.tabla || []).filter(function (r) { return r[1] === 'Campeón'; });
    return '<button type="button" class="uc" data-llave="' + esc(c.ll) + '" style="--c:' +
      esc(colorSv(c.sv)) + '"><span class="uc-top">' + chipSv(c.sv) + '<small>' +
      esc(fmtFecha(c.t)) + '</small></span><b class="uc-n">' + esc(c.n) + '</b>' +
      '<span class="uc-camp">&#127942; ' + (camp.length ? camp.map(function (r) {
        var f = porK(r[3] || kDe(r[0]));
        return f ? quienEs(f, 22) : conBanderas(r[0]);
      }).join('<i class="coma">,</i> ') : '—') + '</span>' +
      '<small class="uc-d">' + [inf.mod ? esc(inf.mod) : '', L.participantes ? L.participantes + ' raperos' : '']
        .filter(Boolean).join(' &middot; ') + '</small></button>';
  }).join('');
}
/* 🔑 QUIÉN ORGANIZA, CON SU PERFIL Y SU CARA. Dlx, 28/09/2026: «¿puedes
   hacer que los organizadores se muestren sus perfiles también con su
   avatar?». El ciclo lleva el «Organiza:» del anuncio a un perfil —por el
   nombre o por su usuario de Discord— y lo manda en `D.orgs` (ver `_orgs()`
   en bot/subir_web.py). Sin perfil, el nombre en texto, como antes. */
function orgPerfil(o) {
  var k = (D.orgs || {})[o];
  return k ? porK(k) : null;
}
function orgHtml(o, tam) {
  var f = orgPerfil(o);
  return f ? '<button type="button" class="org-p" data-k="' + esc(f.k) + '" title="Ver su perfil">' +
    quienEs(f, tam || 18) + '</button>' : '<b>' + esc(o) + '</b>';
}
/* «1vs1», «1V1» y «1 VS 1» son el mismo formato (Dlx, 28/09/2026, con captura) */
function claveFormato(m) {
  var k = String(m || '').toLowerCase().replace(/\s+/g, '');
  var x = /^(\d+)(?:vs|v|x)(\d+)$/.exec(k);
  return x ? x[1] + 'vs' + x[2] : k;
}
function pintaFormatos() {
  var ls = jugadas();
  var fmt = {}, org = {}, con = 0, gente = 0;
  ls.forEach(function (c) {
    var L = D.llaves[c.ll], inf = L.info || {};
    if (inf.mod) {
      var m = inf.mod.trim().replace(/\s+/g, ' ');
      var k = claveFormato(m);
      fmt[k] = fmt[k] || { n: 0, t: /^\d+vs\d+$/.test(k) ? k.toUpperCase() : m };
      fmt[k].n++;
      con++;
    }
    // el mismo organizador escrito de dos maneras («Carlos», «carlos») suma junto
    if (inf.org) {
      var f = orgPerfil(inf.org), ko = f ? 'k:' + f.k : 't:' + inf.org.toLowerCase();
      org[ko] = org[ko] || [inf.org, 0];
      org[ko][1]++;
    }
    gente += L.participantes || 0;
  });
  var fs = Object.keys(fmt).map(function (k) { return fmt[k]; }).sort(function (a, b) { return b.n - a.n; });
  var os = Object.keys(org).map(function (k) { return org[k]; }).sort(function (a, b) { return b[1] - a[1]; });
  if (!fs.length && !os.length) { apaga('#secFormatos'); return; }
  $('#secFormatos').hidden = false;
  var max = fs.length ? fs[0].n : 1;
  $('#formatos').innerHTML =
    (fs.length ? '<h3 class="gh">Formatos</h3>' + fs.slice(0, 6).map(function (x) {
      return '<div class="gp"><span>' + esc(x.t) + '</span><i><u style="width:' +
        Math.round(100 * x.n / max) + '%"></u></i><b>' + x.n + '</b></div>';
    }).join('') : '') +
    (os.length ? '<h3 class="gh">Quién organiza</h3><div class="orgs">' + os.slice(0, 8).map(function (x) {
      return '<span class="org">' + (orgPerfil(x[0]) ? orgHtml(x[0], 20) : esc(x[0])) + '<u>' + x[1] + '</u></span>';
    }).join('') + '</div>' : '') +
    '<p class="nota">Sobre las ' + ls.length + ' llaves más nuevas' +
    (ls.length ? ': ' + Math.round(gente / ls.length) + ' raperos por llave, en promedio' : '') + '.</p>';
}

/* ── la cabecera de Eventos ───────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «hacer un poco más motivador esto, porque se ve algo
   muerto… la opción de sincronizar esto con el calendario de Google». Lo
   que viene con su cuenta atrás —o el último campeón, si no hay nada
   anunciado—, los números de la temporada y cómo no perderse ninguno.

   ⚠️ EL CALENDARIO ES UN .ics QUE SIRVE EL WORKER TAL CUAL
   (`/calendario.ics`, lo escribe `bot/subir_web.py`): Google, Apple y
   Outlook se suscriben una vez y se actualizan solos. Desde la compu de
   desarrollo se apunta al dominio público, porque Google no puede leer
   `localhost`. */
var ICS_HOST = /^(localhost|127\.|\[::1\])/.test(location.hostname) || !location.host
  ? 'underlegends.pages.dev' : location.host;
function googleEv(e) {
  var t = new Date(e.t), f = new Date(t.getTime() + 90 * 60000);
  var z = function (x) { return x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
    encodeURIComponent(e.n + ' · ' + (nombreSv(e.sv) || e.sv)) + '&dates=' + z(t) + '/' + z(f) +
    '&details=' + encodeURIComponent('Evento de la Liga Global de Freestyle.' +
      (e.link ? '\n' + e.link : ''));
}
function pintaEvCab() {
  var cs = D.calendario || [];
  if (!cs.length) { apaga('#evCab'); return; }
  var ahora = Date.now();
  var prox = cs.filter(function (c) { return Date.parse(c.t) > ahora; })[0];
  var ult = (D.pasados || [])[0];
  var L = ult && ult.llave && (D.llaves || {})[ult.llave];
  var camp = L ? (L.tabla || []).filter(function (r) { return r[1] === 'Campeón'; }) : [];
  var porSv = {};
  cs.forEach(function (c) { if (Date.parse(c.t) <= ahora) porSv[c.sv] = (porSv[c.sv] || 0) + 1; });
  var top = Object.keys(porSv).sort(function (a, b) { return porSv[b] - porSv[a]; })[0];
  var A = D.actividad || {};
  var h = '';
  if (prox) {
    h += '<div class="evc-prox" style="--c:' + esc(colorSv(prox.sv)) + '">' +
      '<span class="evc-et">Próximo evento</span><b class="evc-n1">' + esc(prox.n) + '</b>' +
      '<div class="evc-sub">' + chipSv(prox.sv) + '<span>' + esc(fmtFecha(prox.t, { weekday: 'long' })) +
        ' &middot; ' + esc(fmtHora(prox.t)) + ' ' + etiquetaHora(prox.t) + '</span></div>' +
      '<span class="reloj" data-t="' + esc(prox.t.replace(/Z$/, '')) + '">&middot;</span>' +
      '<a class="evc-g" href="' + esc(googleEv(prox)) + '" target="_blank" rel="noopener noreferrer">' +
      '&#128197; Agregar este evento a Google Calendar</a></div>';
  } else if (ult) {
    h += '<div class="evc-prox" style="--c:' + esc(colorSv(ult.sv)) + '">' +
      '<span class="evc-et">El último campeón</span>' +
      (camp.length ? '<b class="evc-n1">' + camp.map(function (r) {
        var f = porK(r[3] || kDe(r[0]));
        return f ? quienEs(f, 34) : conBanderas(r[0]);
      }).join('<i class="coma">,</i> ') + '</b>' : '') +
      '<div class="evc-sub">' + chipSv(ult.sv) + '<span>' + esc(ult.nombre) + ' &middot; ' +
      esc(cuandoSe(ult.cuando)) + '</span></div>' +
      '<p class="evc-no">El próximo aparece acá apenas un servidor lo anuncie.</p></div>';
  }
  h += '<dl class="evc-num">' +
    '<div><dt>Eventos en la temporada</dt><dd>' + num(D.eventos || 0) + '</dd></div>' +
    '<div><dt>Esta semana</dt><dd>' + num(A.ev || 0) + '</dd></div>' +
    '<div><dt>Raperos esta semana</dt><dd>' + num(A.gente || 0) + '</dd></div>' +
    (top ? '<div><dt>El más activo</dt><dd class="evc-sv">' + logoSv(top, 24) + esc(top) +
      '</dd></div>' : '') + '</dl>' +
    '<div class="evc-acc">' +
    '<a class="btn" href="#/avisos">&#128276; Avisame de cada evento</a>' +
    /* 🔴 EN EL TELÉFONO, EL BOTÓN DE GOOGLE NO PUEDE ANDAR. Ni la app de
       Google Calendar ni su web en el teléfono dejan sumar un calendario
       por link: sólo la de la compu («Otros calendarios → Desde URL»). El
       botón abría Google y no pasaba nada, y parecía que el calendario no
       funcionaba — Dlx, 27/09/2026: «lo de sincronizar con Google Calendar
       no funciona, creo». El .ics estaba bien (Google lo baja: 200). */
    (MOVIL ? '' : '<a class="btn sec" href="https://calendar.google.com/calendar/render?cid=' +
      encodeURIComponent('webcal://' + ICS_HOST + '/calendario.ics') + '" target="_blank" ' +
      'rel="noopener noreferrer">&#128197; Sumar a Google Calendar</a>') +
    /* `webcal://` lo abre el iPhone y la compu; Android no tiene quién */
    (ANDROID ? '' : '<a class="btn sec" href="webcal://' + esc(ICS_HOST) +
      '/calendario.ics">Apple · Outlook</a>') +
    '<button type="button" class="btn sec" id="evcCopia">&#128279; Copiar el link</button></div>' +
    '<p class="evc-no">' + (MOVIL
      ? (prox ? 'En el teléfono, cada evento se suma con un toque en «Agregar este evento a Google ' +
          'Calendar». ' : '') +
        'Para que aparezcan <b>todos solos</b>, suscribite una vez desde una compu —Google no lo deja ' +
        'hacer desde la app—: en calendar.google.com, «Otros calendarios» → «+» → «Desde URL», con este ' +
        'link. Después aparecen solos en tu teléfono. '
      : 'Si el botón de Google no te lo suma, en calendar.google.com: «Otros calendarios» → «+» → ' +
        '«Desde URL», y pegá este link. ') +
      '<code id="evcIcs">https://' + esc(ICS_HOST) + '/calendario.ics</code> ' +
      'Google lo actualiza cada algunas horas.</p>';
  $('#evCab').innerHTML = h;
  $('#evCab').hidden = false;
  var cp = $('#evcCopia');
  if (cp) cp.onclick = function () {
    var ics = $('#evcIcs').textContent;
    var marca = function () {
      var r = document.createRange(); r.selectNodeContents($('#evcIcs'));
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    };
    try {
      navigator.clipboard.writeText(ics).then(function () { cp.textContent = '✓ Copiado'; }, marca);
    } catch (e) { marca(); }
  };
  pintaRelojes();
}
/* el teléfono: ahí Google Calendar no suma calendarios por link */
var ANDROID = /Android/i.test(navigator.userAgent);
/* 🔑 LOS LINKS DE DISCORD, EN LA APP. Dlx, 27/09/2026: *«hago clic en la
   llave pero me lleva a Discord en el website cuando tengo la app»*. En
   Android el navegador abre discord.com como página; un `intent://` le pide
   al sistema la app de Discord, y si no está, vuelve al mismo link en el
   navegador (`browser_fallback_url`). En el iPhone el link de siempre ya
   abre la app, así que ahí no se toca. */
document.addEventListener('click', function (e) {
  if (!ANDROID || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  var a = e.target && e.target.closest && e.target.closest('a[href]');
  var m = a && /^https:\/\/((?:(?:ptb|canary)\.)?discord(?:app)?\.com\/(?:channels|invite)\/[^\s#]+|discord\.gg\/[^\s#?]+)/i
    .exec(a.href);
  if (!m) return;
  e.preventDefault();
  location.href = 'intent://' + m[1] + '#Intent;scheme=https;package=com.discord;S.browser_fallback_url=' +
    encodeURIComponent(a.href) + ';end';
});
var MOVIL = ANDROID || /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ── el mapa ──────────────────────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «en inicio poner como un mapa con el porcentaje de
   cuántos países están representados, algo visual».

   ⚠️ EL PORCENTAJE NECESITA UN DENOMINADOR, Y ES ÉSTE: los veinte países
   de habla hispana de América y España. «16 países» no dice si es mucho
   o poco; «15 de 20» sí. Los que no son hispanos —Estados Unidos, Brasil—
   se cuentan aparte, sin inflar el porcentaje.

   ⚠️ EL DIBUJO DEL MUNDO ES EL ÚNICO ARCHIVO DE AFUERA DE LA PÁGINA, y se
   pide recién cuando la sección se ve. Si no llega, quedan el número y
   las banderas. */
var HISPANOS = ['ar', 'bo', 'cl', 'co', 'cr', 'cu', 'do', 'ec', 'sv', 'gt', 'hn',
  'mx', 'ni', 'pa', 'py', 'pe', 'pr', 'es', 'uy', 've'];
// el número de cada país en el dibujo del mundo (ISO 3166-1)
var ISO_NUM = { ar: '032', bo: '068', br: '076', cl: '152', co: '170', cr: '188',
  cu: '192', do: '214', ec: '218', sv: '222', gt: '320', hn: '340', mx: '484',
  ni: '558', no: '578', pa: '591', py: '600', pe: '604', pr: '630', es: '724',
  uy: '858', ve: '862', us: '840', ae: '784' };
var MUNDO = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
// lo que se ve: de California a España, y de Canadá al Cabo de Hornos
var VISTA_MAPA = { o: -126, e: 6, n: 51, s: -57 };

function pintaMapa() {
  var ps = (D.paises || []).filter(function (p) { return p.n; });
  if (!ps.length) { apaga('#secMapa'); return; }
  $('#secMapa').hidden = false;
  var por = {};
  ps.forEach(function (p) { por[String(p.cc).toLowerCase()] = p; });
  var dentro = HISPANOS.filter(function (c) { return por[c]; });
  var pct = Math.round(100 * dentro.length / HISPANOS.length);
  $('#mapaDato').innerHTML = '<b>' + pct + '<small>%</small></b><span><em>' +
    dentro.length + ' de ' + HISPANOS.length + '</em> países de habla hispana con ' +
    'raperos en la temporada</span>';
  // ⚠️ SIN «Y TAMBIÉN» NI «TODAVÍA NO». Dlx, 25/09/2026: «quitar eso que
  // dice "y también" y "todavía no"». El mapa ya lo dice: pintado el que
  // tiene gente, punteado el que falta, y el nombre al pasar el mouse.
  var caja = $('#mapa');
  var cargar = function () {
    fetch(MUNDO).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (topo) {
      caja.innerHTML = dibujoMapa(topo, por);
    }).catch(function () { caja.hidden = true; });
  };
  if (!('IntersectionObserver' in window)) { cargar(); return; }
  var ojo = new IntersectionObserver(function (es) {
    if (es.some(function (x) { return x.isIntersecting; })) {
      ojo.disconnect();
      cargar();
    }
  }, { rootMargin: '300px' });
  ojo.observe(caja);
}

// 🔑 TOPOJSON A MANO, SIN LIBRERÍA: son veinte líneas y una dependencia
// menos que puede quedar vieja. Cada arco viene en diferencias enteras;
// se suman y se escalan con `transform`.
function dibujoMapa(topo, por) {
  var t = topo.transform || { scale: [1, 1], translate: [0, 0] };
  var arcos = topo.arcs.map(function (a) {
    var x = 0, y = 0;
    return a.map(function (p) {
      x += p[0]; y += p[1];
      return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]];
    });
  });
  var V = VISTA_MAPA, W = 1000, H = Math.round(W * (V.n - V.s) / (V.e - V.o));
  var proy = function (p) {
    return (((p[0] - V.o) / (V.e - V.o)) * W).toFixed(1) + ' ' +
      (((V.n - p[1]) / (V.n - V.s)) * H).toFixed(1);
  };
  var anillo = function (idx) {
    var pts = [];
    idx.forEach(function (i, k) {
      var a = i < 0 ? arcos[~i].slice().reverse() : arcos[i];
      pts = pts.concat(k ? a.slice(1) : a);
    });
    // ⚠️ LO QUE CRUZA EL MERIDIANO 180 SE SALTEA: Fiyi y Rusia saltan de
    // +179 a −179, y proyectado eso es una raya de lado a lado del mapa.
    for (var j = 1; j < pts.length; j++) {
      if (Math.abs(pts[j][0] - pts[j - 1][0]) > 180) return '';
    }
    var fuera = pts.every(function (p) {
      return p[0] < V.o - 5 || p[0] > V.e + 5 || p[1] > V.n + 5 || p[1] < V.s - 5;
    });
    return fuera ? '' : 'M' + pts.map(proy).join('L') + 'Z';
  };
  var codigo = {};
  Object.keys(ISO_NUM).forEach(function (cc) { codigo[ISO_NUM[cc]] = cc; });
  var maxN = Math.max.apply(null, Object.keys(por).map(function (c) { return por[c].n; }));
  var geos = (topo.objects.countries || { geometries: [] }).geometries;
  var paths = geos.map(function (g) {
    var polis = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    var d = polis.map(function (pol) { return pol.map(anillo).join(''); }).join('');
    if (!d) return '';
    var cc = codigo[String(g.id)], p = cc && por[cc];
    var nom = cc ? nombrePais(cc) : ((g.properties || {}).name || '');
    if (p) {
      // la intensidad por cuánta gente, en escala de raíz: con 33 de un
      // país y 1 de otro, lineal dejaría al de 1 casi invisible
      var a = (0.35 + 0.65 * Math.sqrt(p.n / maxN)).toFixed(2);
      return '<path class="con" style="--a:' + a + '" d="' + d + '"><title>' + esc(nom) +
        ' · ' + p.n + (p.n === 1 ? ' rapero' : ' raperos') + ' · ' + num(p.pts) +
        ' pts</title></path>';
    }
    return '<path class="' + (cc && HISPANOS.indexOf(cc) >= 0 ? 'hisp' : 'pais') + '" d="' +
      d + '">' + (nom ? '<title>' + esc(nom) + '</title>' : '') + '</path>';
  }).join('');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Mapa de los ' +
    'países con raperos en la temporada">' + paths + '</svg>';
}

/* ── los cinco de arriba, de cada ranking ─────────────────────────────
   🔑 Dlx, 25/09/2026: «que los cinco de arriba muestre el top 5 de todos
   los rankings que hayan, no solo temporada». Todo sale del mismo
   payload: no hay una consulta nueva.

   ⚠️ EL COMPETITIVO SE VE AUNQUE ESTÉ VACÍO, porque ahí la ausencia ES el
   dato: pide 10 eventos y todavía no llegó nadie. Decirlo —y quién está
   más cerca— es mejor que esconder el ranking que más importa. */
// 🔑 EL TOP 3. Dlx, 25/09/2026: «que sólo muestre el top 3 de todo en el
// inicio». El resto está a un «Ver todo» de distancia.
var TOP = 3;
function pintaTops() {
  var T = oficiales();
  var fila = function (f, i, v, c) {
    return '<li' + (f.k ? ' data-k="' + esc(f.k) + '"' : f.dc ? ' data-crew="' + esc(f.dc) + '"' : '') +
      '><i class="pp">' + (i + 1) +
      '</i><span class="nm">' + (f.k ? quienEs(f.av !== undefined ? f : conCara(f), 24)
        : (f.logo ? '<span class="quien"><img class="av" src="' + esc(f.logo) + '" alt="" ' +
          'style="width:24px;height:24px"><span class="qn">' + esc(f.n) + '</span></span>'
          : esc(f.n))) +
      '</span><b' + (c ? ' style="color:' + esc(c) + '"' : '') + '>' + v + '</b></li>';
  };
  var cajas = [];
  cajas.push(['&#127942;', 'Temporada <u>OVR</u>', '#/ranking/temporada', T.slice(0, TOP).map(function (f, i) {
    return fila(f, i, f.ovr || '—');
  })]);
  var comp = T.filter(function (f) { return f.rg; }).sort(function (a, b) {
    return (b.sc || 0) - (a.sc || 0);
  }).slice(0, TOP);
  var pide = reqDe('competitivo') || 10;
  var cerca = T.slice().sort(function (a, b) { return (b.ev || 0) - (a.ev || 0); })[0];
  cajas.push(['&#9876;', 'Competitivo <u>Score</u>', '#/ranking/competitivo', comp.map(function (f, i) {
    return fila(f, i, esc(f.rg), f.rgc);
  }), cerca ? 'Se desbloquea a los <b>' + pide + ' eventos</b> y todavía no llegó nadie. ' +
    'El más cerca: <b>' + esc(cerca.n) + '</b>, con ' + cerca.ev + '.' : '']);
  cajas.push(['&#129354;', 'Duelos <u>ganados</u>', '#/ranking/duelos', (D.duelos || []).filter(function (d) {
    return !d.fc;
  }).slice(0, TOP).map(function (d, i) {
    return fila(d, i, d.g + '<s>/' + d.t + '</s>');
  })]);
  var med = T.filter(function (f) { return (f.oro || 0) + (f.seg || 0) + (f.ter || 0) > 0; })
    .sort(medallero).slice(0, TOP);
  // ⚠️ CADA MEDALLA EN SU CAJITA: en una caja angosta se apilan (ver
  // `.meds`), y el nombre no se parte letra por letra
  cajas.push(['&#127941;', 'Podios', '#/ranking/podios', med.map(function (f, i) {
    return fila(f, i, '<span class="meds">' + [['&#129351;', f.oro], ['&#129352;', f.seg], ['&#129353;', f.ter]]
      .filter(function (x) { return x[1]; }).map(function (x) {
        return '<span>' + x[0] + x[1] + '</span>';
      }).join('') + '</span>');
  })]);
  // 🔑 RACHAS EN EL LUGAR DE PAÍSES. Dlx, 25/09/2026: «quitar el de países
  // y ahí poner el de rachas». La que llevan ahora; si nadie lleva una, la
  // más larga de la temporada — y el título dice cuál de las dos es.
  var con = T.filter(function (f) { return ((f.rch || [])[1] || 0) > 0; });
  var vivas = con.filter(function (f) { return f.rch[0] > 0; });
  var rs = (vivas.length ? vivas : con).slice().sort(function (a, b) {
    return vivas.length ? (b.rch[0] - a.rch[0]) || (b.rch[1] - a.rch[1])
                        : (b.rch[1] - a.rch[1]) || (b.pts - a.pts);
  }).slice(0, TOP);
  if (!rs.length && (D.rachas || []).length) {
    rs = D.rachas.filter(function (r) { return !r.fc; }).slice(0, TOP).map(function (r) {
      return { n: r.n, k: r.k, cc: r.cc, rch: [r.r, r.r] };
    });
    vivas = rs;
  }
  cajas.push(['&#128293;', 'Rachas <u>' + (vivas.length ? 'la actual' : 'la más larga') + '</u>',
    '#/ranking/rachas', rs.map(function (f, i) {
      return fila(f, i, '&#128293;' + (vivas.length ? f.rch[0] : f.rch[1]));
    })]);
  cajas.push(['&#129309;', 'Crews <u>pts</u>', '#/ranking/crews', (D.crews || []).filter(function (c) {
    return c.rk !== 0;
  }).slice(0, TOP).map(function (c, i) {
    return fila({ n: c.crew, logo: c.logo, dc: c.clave || c.crew }, i, num(c.pts));
  })]);
  // 🔑 LOS QUE VIENEN. Dlx, 25/09/2026: «los otros 2 de cinco de arriba
  // será MOST WANTED y MISIONES», y después «los 2 espacios será uno de
  // Ascenso, que viene próximamente, y el otro Ligas». Todavía no hay
  // datos: se dice que vienen, en vez de esconder lo que Dlx pidió ver.
  // Most Wanted ya corre (1.22): los que más cobraron, miembros
  if (D.mw && (D.mw.b || []).length) {
    cajas.push(['&#128128;', 'Most Wanted <u>cobró</u>', '#/ranking/mw', (D.mw.caz || []).filter(function (c) {
      return c.pts > 0 && !c.fc;
    }).slice(0, TOP).map(function (c, i) {
      return fila(c, i, num(c.pts));
    }), 'Todavía nadie cazó a un buscado. Los de hoy están en el tablero, arriba.']);
  } else {
    cajas.push(['&#128128;', 'Most Wanted', '', [],
      'Quién cazó, quién fue cazado y quién sobrevivió. <b>Próximamente</b>.', 'pronto']);
  }
  cajas.push(['&#127919;', 'Misiones', '', [], 'Las misiones de la temporada. <b>Próximamente</b>.', 'pronto']);
  // Dlx, 25/09/2026: Ascenso y Ligas, «eso será en la temporada 2»
  cajas.push(['&#128200;', 'Ascenso', '', [], 'El ranking de ascenso. <b>Llega en la Temporada 2</b>.', 'pronto']);
  cajas.push(['&#127942;', 'Ligas', '', [], 'El ranking de ligas. <b>Llega en la Temporada 2</b>.', 'pronto']);
  var hay = cajas.filter(function (c) { return c[3].length || c[4]; });
  if (!hay.length) { apaga('#secTop'); return; }
  $('#tops').innerHTML = hay.map(function (c) {
    return '<div class="tp' + (c[5] ? ' ' + c[5] : '') + '"><h3><span>' + c[0] + '</span>' + c[1] +
      (c[2] ? '<a href="' + c[2] + '">Ver todo</a>' : '') + '</h3>' + (c[3].length
      ? '<ol>' + c[3].join('') + '</ol>' : '<p class="tp-no">' + c[4] + '</p>') + '</div>';
  }).join('');
}

/* ── la cara: el avatar de Discord o la inicial ─────────────────────────
   🔑 Dlx, 25/09/2026: «para aquellos que tienen imágenes, un círculo y su
   avatar en los rankings, uno pequeño, y mover la bandera a la derecha del
   nombre».

   ⚠️ EL AVATAR DE DISCORD Y NO LA FOTO DE LA CARTA: la foto congelada vive
   en una dirección secreta a propósito (ver `_avatares()` en
   bot/subir_web.py). `f.av` es `<id>/<hash>`; si la persona cambió su
   foto, el CDN da 404 y el círculo pasa a la inicial solo. */
var CDN_AV = 'https://cdn.discordapp.com/avatars/';
function inicial(n) {
  var s = String(n || '').replace(/[^\p{L}\p{N}]/gu, '');
  return (s.charAt(0) || '?').toUpperCase();
}
function avatar(f, tam) {
  tam = tam || 28;
  var st = 'width:' + tam + 'px;height:' + tam + 'px';
  var ini = esc(inicial(f && f.n));
  if (f && f.av) {
    return '<img class="av" src="' + CDN_AV + esc(f.av) + '.webp?size=' +
      (tam > 40 ? 128 : 64) + '" alt="" style="' + st + '" data-i="' + ini +
      '" loading="lazy" decoding="async">';
  }
  return '<span class="av ini" style="' + st + ';font-size:' + Math.round(tam * 0.46) +
    'px">' + ini + '</span>';
}
document.addEventListener('error', function (e) {
  var t = e.target;
  if (!t || t.tagName !== 'IMG' || !t.classList.contains('av')) return;
  var s = document.createElement('span');
  s.className = 'av ini';
  s.style.cssText = t.style.cssText + ';font-size:' +
    Math.round(parseInt(t.style.width, 10) * 0.46) + 'px';
  s.textContent = t.dataset.i || '?';
  t.replaceWith(s);
}, true);
/* el nombre con su cara a la izquierda y la bandera a la derecha */
function quienEs(f, tam) {
  return '<span class="quien">' + avatar(f, tam) + '<span class="qn">' + esc(f.n) +
    '</span>' + (bandera(f.cc) || '') +
    (sigoA(f.k) ? '<i class="sigo-et" title="Lo seguís">&#9733;</i>' : '') + '</span>';
}
/* lo que viene sin cara en su lista (duelos, rachas) la toma de la tabla */
function conCara(x) {
  var f = porK(x.k) || {};
  return { n: x.n, k: x.k, cc: x.cc || f.cc, av: f.av || '' };
}

/* ── la página de una crew y la de un país ───────────────────────────
   🔑 Dlx, 25/09/2026: «crear perfiles para las crews, y quizás países».
   Todo sale del lobby que ya bajó: su gente es la de la tabla. */
function genteLista(fs) {
  return '<div class="gente">' + fs.map(function (f) {
    return '<div class="gt' + (f.fc ? ' fc' : '') + '" data-k="' + esc(f.k) + '"><span class="gt-p">' +
      numPos(f) + '</span>' +
      '<span class="gt-n">' + quienEs(f, 30) + '</span>' +
      '<span class="gt-d"><b class="ovr">' + (f.ovr || '—') + '</b><small>OVR</small></span>' +
      '<span class="gt-d"><b>' + num(f.pts) + '</b><small>pts</small></span>' +
      '<span class="gt-d"><b>' + esc(f.ev || 0) + '</b><small>ev</small></span></div>';
  }).join('') + '</div>';
}
function cabezaPagina(img, pre, tit, sub, cifras) {
  return '<header class="pf-cab">' + img + '<div class="pf-id"><span class="pf-pos">' + pre +
    '</span><h1 class="tit">' + tit + '</h1><p class="pf-sub">' + sub + '</p></div>' +
    '<dl class="pf-cifras">' + cifras.map(function (c) {
      return '<div><dt>' + c[0] + '</dt><dd>' + c[1] + '</dd></div>';
    }).join('') + '</dl></header>';
}
function pintaCrew(clave) {
  var caja = $('#crewPag');
  var cs = D.crews || [];
  var c = cs.filter(function (x) { return (x.clave || x.crew) === clave; })[0];
  if (!c) {
    caja.innerHTML = '<a class="volver" href="#/mundo">&#8249; Mundo</a><section class="blk entro">' +
      '<h2><span>&#128269;</span> No la encontré</h2><p class="bajada">Esa crew no tiene gente en la ' +
      'temporada.</p></section>';
    return;
  }
  document.title = c.crew + ' · Liga Global de Freestyle';
  var conPuesto = cs.filter(function (x) { return x.rk !== 0; });
  var pos = conPuesto.indexOf(c) + 1;
  var gente = (c.gente || []).map(function (n) { return porK(kDe(n)); }).filter(Boolean)
    .sort(function (a, b) { return (a.o || a.pos || 999) - (b.o || b.pos || 999); });
  var ccs = [];
  gente.forEach(function (f) { if (f.cc && ccs.indexOf(f.cc) < 0) ccs.push(f.cc); });
  var logo = c.logo ? '<img class="cw-logo grande" src="' + esc(c.logo) + '" alt="" width="116" height="116">'
    : '<span class="cw-logo cw-ini grande">' + esc(inicial(c.crew)) + '</span>';
  caja.innerHTML = '<a class="volver" href="#/mundo">&#8249; Mundo</a>' +
    cabezaPagina(logo, pos ? '#' + pos + ' de las crews' : 'Sin puesto: hacen falta tres raperos',
      esc(c.crew), ccs.map(function (cc) { return bandera(cc); }).join(' '),
      [['Raperos', esc(c.n)], ['Puntos', num(c.pts)],
        ['Por rapero', c.n ? num(Math.round(c.pts / c.n)) : '—'],
        ['Su mejor', c.mejor && kDe(c.mejor) ? '<span class="lnk" data-k="' + esc(kDe(c.mejor)) + '">' +
          esc(c.mejor) + '</span>' : esc(c.mejor || '—')]]) +
    '<section class="blk entro"><h2><span>&#129309;</span> Su gente en la temporada</h2>' +
    (gente.length ? genteLista(gente) : '<p class="bajada">Todavía nadie de la crew jugó la temporada.</p>') +
    '</section>';
}
function pintaPais(cc) {
  cc = String(cc || '').toLowerCase();
  var caja = $('#paisPag');
  var ps = D.paises || [];
  var P = ps.filter(function (x) { return String(x.cc).toLowerCase() === cc; })[0];
  var gente = (D.tabla || []).filter(function (f) { return String(f.cc).toLowerCase() === cc; })
    .sort(function (a, b) { return (a.o || a.pos || 999) - (b.o || b.pos || 999); });
  if (!P && !gente.length) {
    caja.innerHTML = '<a class="volver" href="#/mundo">&#8249; Mundo</a><section class="blk entro">' +
      '<h2><span>&#128269;</span> No lo encontré</h2><p class="bajada">Ese país no tiene raperos en ' +
      'la temporada.</p></section>';
    return;
  }
  document.title = nombrePais(cc) + ' · Liga Global de Freestyle';
  var pos = P ? ps.indexOf(P) + 1 : 0;
  var pts = P ? P.pts : gente.reduce(function (a, f) { return a + (f.pts || 0); }, 0);
  var crews = (D.crews || []).filter(function (c) {
    return (c.gente || []).some(function (n) { var f = porK(kDe(n)); return f && String(f.cc).toLowerCase() === cc; });
  });
  var img = PAIS[cc] ? '<img class="pais-bandera" src="banderas/' + esc(cc) + '.png" alt="" width="120" height="80">' : '';
  caja.innerHTML = '<a class="volver" href="#/mundo">&#8249; Mundo</a>' +
    cabezaPagina(img, pos ? '#' + pos + ' de los países' : '', esc(nombrePais(cc)),
      crews.length ? crews.map(function (c) {
        return '<a class="chip-crew" href="#/crew/' + encodeURIComponent(c.clave || c.crew) + '">' +
          esc(c.crew) + '</a>';
      }).join(' ') : '',
      [['Raperos', esc(gente.length)], ['Puntos', num(pts)],
        ['Por rapero', gente.length ? num(Math.round(pts / gente.length)) : '—'],
        ['Su mejor', gente[0] ? '<span class="lnk" data-k="' + esc(gente[0].k) + '">' + esc(gente[0].n) +
          '</span>' : '—']]) +
    '<section class="blk entro"><h2><span>&#127758;</span> Su gente en la temporada</h2>' +
    genteLista(gente) + '</section>';
}

/* ── ir al perfil ─────────────────────────────────────────────────────── */
function irPerfil(k) {
  if (!$('#visor').hidden) cerrar();
  if (!$('#visorLlave').hidden) cerrarLlave();
  location.hash = '#/r/' + encodeURIComponent(k);
}

/* ── el perfil de cada rapero ─────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «ESTARÍA BUENÍSIMO». Lo que más le faltaba al hub
   contra la página vieja del Apps Script: una página por persona.

   ⚠️ EL HISTORIAL SE PIDE APARTE (`/api/perfiles`) y una sola vez: el
   lobby se baja en cada visita y esto sólo cuando alguien abre un perfil.
   Si no llega, el perfil se dibuja igual con lo que trae la tabla. */
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

var CARTA_TIT = { temporada: 'Temporada', competitivo: 'Competitiva', pais: 'País', servidor: 'Servidor' };
var PERF_CARTA = {};

/* 🔑 «SIN VERIFICAR», CON EL PORQUÉ. Dlx, 27/09/2026: «que aparezca en alguna
   parte que no está verificado». `nv` viene del payload con lo primero que le
   falta del portón (`_sin_verificar()` en bot/subir_web.py). */
var NV = { id: 'su Discord todavía no está vinculado a la Liga',
  pais: 'le falta el país', dra: 'tiene que ser Miembro de Discord Rap Español' };
/* 🔑 EL GRÁFICO DE FORTALEZAS. Dlx, 27/09/2026: «en mi perfil de la hoja de
   la pre-temporada había un gráfico donde comparaba las estadísticas del
   competitivo y te mostraba cuál era más fuerte y menos». Es el radar de «Mi
   Perfil» con las cinco dimensiones del Score, más el promedio de la Liga
   para comparar. */
var DIMS = [['⚡', 'Eficiencia'], ['🎯', 'Consistencia'], ['👑', 'Dominancia'], ['🔥', 'Racha'],
  ['🌍', 'Diversidad']];
function radar(v, prom, color) {
  var cx = 150, cy = 120, R = 84, n = v.length;
  var pt = function (i, r) {
    var a = Math.PI * 2 * i / n - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  var poly = function (xs) {
    return xs.map(function (x, i) {
      var q = pt(i, R * Math.max(0, Math.min(100, x || 0)) / 100);
      return q[0].toFixed(1) + ',' + q[1].toFixed(1);
    }).join(' ');
  };
  var mx = Math.max.apply(null, v);
  var s = '';
  [25, 50, 75, 100].forEach(function (f) { s += '<polygon class="rd-red" points="' + poly([f, f, f, f, f]) + '"/>'; });
  v.forEach(function (_x, i) {
    var q = pt(i, R);
    s += '<line class="rd-eje" x1="' + cx + '" y1="' + cy + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '"/>';
  });
  if (prom && prom.length === n) s += '<polygon class="rd-prom" points="' + poly(prom) + '"/>';
  s += '<polygon class="rd-yo" points="' + poly(v) + '"/>';
  v.forEach(function (x, i) {
    var q = pt(i, R * Math.max(0, Math.min(100, x)) / 100), l = pt(i, R + 20);
    var an = Math.abs(l[0] - cx) < 10 ? 'middle' : l[0] > cx ? 'start' : 'end';
    s += '<circle class="rd-p" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3.5"/>' +
      '<text class="rd-l' + (x === mx && mx > 0 ? ' fuerte' : '') + '" x="' + l[0].toFixed(1) + '" y="' +
      (l[1] + 5).toFixed(1) + '" text-anchor="' + an + '">' + DIMS[i][0] + ' ' + x + '</text>';
  });
  return '<svg class="radar" viewBox="0 0 300 240" style="--c:' + esc(color) + '" role="img" aria-label="' +
    esc(v.map(function (x, i) { return DIMS[i][1] + ' ' + x; }).join(', ')) + '">' + s + '</svg>';
}
function pintaJuego(f, x, prom) {
  var v = x && x.dm;
  if (!v || v.length !== 5) return;
  var G = (D.guia && D.guia.score) || [];
  var orden = v.map(function (n, i) { return [n, i]; }).sort(function (a, b) { return b[0] - a[0]; });
  var fuerte = orden[0], flojo = orden[orden.length - 1];
  var pide = reqDe('competitivo') || 10;
  $('#pfJuego').innerHTML = '<div class="juego">' + radar(v, prom, f.rgc || '#29B298') +
    '<div class="jg-tx"><p class="jg-res">' +
      (fuerte[0] > 0 ? '<span><small>Su fuerte</small><b>' + DIMS[fuerte[1]][0] + ' ' + DIMS[fuerte[1]][1] +
        '</b></span>' : '') +
      (flojo[0] < fuerte[0] ? '<span><small>A trabajar</small><b>' + DIMS[flojo[1]][0] + ' ' +
        DIMS[flojo[1]][1] + '</b></span>' : '') + '</p>' +
      '<ul class="jg-l">' + v.map(function (n, i) {
        var g = G[i] || [];
        return '<li title="' + esc(g[2] || '') + '"><span>' + DIMS[i][0] + ' ' + DIMS[i][1] +
          (g[3] ? ' <i>' + g[3] + '%</i>' : '') + '</span><b>' + n + '</b>' +
          (prom && prom[i] != null ? '<s>Liga ' + prom[i] + '</s>' : '') + '</li>';
      }).join('') + '</ul>' +
      '<p class="jg-nota"><span class="ley-yo" style="border-top-color:' + esc(f.rgc || '#29B298') + '"></span>' +
        esc(f.n) + (prom ? ' <span class="ley-li"></span>el promedio de la Liga' : '') +
      '</p>' +
      ((f.ev || 0) < pide ? '<p class="jg-nota">Provisorio: con pocos eventos cambia mucho. Cuenta para el ' +
        'rango desde los ' + pide + ' eventos (lleva ' + (f.ev || 0) + ').</p>' : '') +
    '</div></div>';
  $('#pfJuegoSec').hidden = false;
}
function pintaPerfil(k) {
  // 🔑 QUIEN ENTRÓ CON DISCORD Y NO JUGÓ LA TEMPORADA también tiene su perfil
  // (Dlx, 25/09/2026: «cuando toco mi perfil debería ver mi perfil»). Sólo
  // lo ve esa persona: el resto de los perfiles sale del ranking.
  var f = porK(k) || filaCuenta(k);
  var caja = $('#perfil');
  if (!f) {
    caja.innerHTML = '<a class="volver" href="#/ranking">&#8249; Ranking</a>' +
      '<section class="blk entro"><h2><span>&#128269;</span> No lo encontré</h2>' +
      '<p class="bajada">Ese rapero no está en la tabla de la temporada.</p></section>';
    return;
  }
  // la clave de verdad, aunque se haya llegado por un link viejo (`porK()`);
  // y el link se corrige, así lo que se copie de acá ya es el nuevo
  if (f.k && f.k !== k) history.replaceState(null, '', urlDe('r/' + encodeURIComponent(f.k)));
  k = f.k || k;
  // 🔴 LO QUE LLEGA DESPUÉS SE COMPARA CONTRA ESTA RUTA, no contra la clave:
  // con un link viejo (`#/r/antorcha%20ol%C3%ADmpica`) ninguna de las dos
  // formas de la clave coincidía, y «Lo que le falta» quedaba en «Cargando…»
  // para siempre, sin sus duelos ni sus eventos
  var aca = ruta();
  document.title = f.n + ' · Liga Global de Freestyle';
  var sv = svDe(f.sv);
  var cartas = f.c || [];
  var cual = PERF_CARTA[k] && cartas.indexOf(PERF_CARTA[k]) >= 0 ? PERF_CARTA[k] : cartas[0];
  var rg = f.rg ? '<span class="rg pf-rg" style="color:' + esc(f.rgc || '') + ';border-color:' +
    esc(f.rgc || '#1A2523') + '">' + esc(f.rg) + '</span>' : '';
  // 🏠 el servidor: el que eligió en Mi cuenta, o donde más jugó (ver `svPerfil()`)
  var sub = (f.cc ? '<a class="pf-pais" href="#/pais/' + esc(f.cc) + '">' + bandera(f.cc) + ' ' +
      esc(nombrePais(f.cc)) + '</a>' : '') +
    '<span id="pfSv" data-k="' + esc(k) + '" data-sep="' + (f.cc ? 1 : 0) + '">' + svPerfil(k, f) + '</span>';
  var med = [['&#129351;', f.oro], ['&#129352;', f.seg], ['&#129353;', f.ter]];
  caja.innerHTML =
    '<a class="volver" href="#/ranking">&#8249; Ranking</a>' +
    '<header class="pf-cab">' + avatar(f, 116) +
      '<div class="pf-id"><span class="pf-pos' + (f.fc ? ' fc' : '') + '">' + textoPos(f) + '</span>' +
      '<h1 class="tit">' + esc(f.n) + '</h1>' +
      (f.nv ? '<p class="pf-nv"><span class="nv-et">Sin verificar</span><span>' + esc(NV[f.nv] || '') +
        (k === YO || (DC && DC.clave === k) ? ' — en DRA, <code>/verificar</code> te dice qué hacer' : '') +
        '</span></p>' : '') +
      '<p class="pf-sub">' + sub +
      '<span id="pfCrew"></span></p><p class="pf-redes" id="pfRedes" hidden></p>' +
      // 🔑 cuántos lo siguen: lo público (`/api/avisos/seguidores`), también en el tuyo
      '<p class="pf-seg" id="pfSeg" data-k="' + esc(k) + '" hidden></p>' +
      // no se sigue uno mismo
      (k === YO || (DC && DC.clave === k) ? '' : '<p class="pf-acc">' + botonSigo(k) + '</p>') + '</div>' +
      '<dl class="pf-cifras"><div><dt>OVR</dt><dd class="ovr">' + (f.ovr || '—') + '</dd></div>' +
      '<div><dt>Rango</dt><dd>' + (rg || '<span class="nada">—</span>') + '</dd></div>' +
      '<div><dt>Puntos</dt><dd>' + num(f.pts) + '</dd></div>' +
      '<div><dt>Eventos</dt><dd>' + esc(f.ev) + '</dd></div>' +
      '<div><dt>Win%</dt><dd>' + esc(f.wr || '—') + '</dd></div></dl>' +
    '</header>' +
    '<div class="pf-grid">' +
      '<section class="blk entro pf-cartas"><h2><span>&#127183;</span> Sus tarjetas</h2>' +
        (cartas.length
          ? '<div class="pestanas" id="pfPest">' + cartas.map(function (c) {
              // ⚠️ `NOMBRE_CARTA` Y NO `CARTA_TIT`: tu propio perfil trae tus
              // Bloqueadas, y la pestaña decía «bloq-temporada»
              return '<button class="pest' + (c === cual ? ' on' : '') + '" data-pfc="' + c + '">' +
                esc(NOMBRE_CARTA[c] || c) + '</button>';
            }).join('') + '</div><div class="pf-carta"><img id="pfImg" alt="Tarjeta ' +
            esc(NOMBRE_CARTA[cual] || cual) + ' de ' + esc(f.n) + '" src="' + urlCarta(f, cual) +
            '"></div><div class="v-acc"><button class="bajar" id="pfBajar" data-pfk="' + esc(k) +
            '"><i aria-hidden="true">&#11015;</i><span>Descargar</span></button>' +
            // 🔑 la foto, desde tu propia tarjeta (Dlx, 25/09/2026)
            (DC && DC.clave === k ? '<button class="bajar" type="button" data-foto><i aria-hidden="true">' +
              '&#128247;</i><span>Cambiar mi foto</span></button>' : '') + '</div>'
          // 🔑 las LIBRES: sin verificar igual tiene la Temporada y la Servidor
          : '<p class="sin-carta">Todavía no tiene ninguna tarjeta emitida.</p>') +
      '</section>' +
      '<div class="col">' +
        '<section class="blk entro"><h2><span>&#128202;</span> Sus números</h2><div class="pf-nums">' +
          '<div><b>' + med.map(function (m) { return m[1] ? m[0] + m[1] : ''; }).join(' ') +
            (med.some(function (m) { return m[1]; }) ? '' : '—') + '</b><span>Podios</span></div>' +
          // ⚠️ `sem` SON LAS VECES QUE QUEDÓ EN SEMIS, no las que llegó: quien
          // llegó siempre a la final tiene 0, y «Semifinales 0» se leía mal
          '<div><b>' + (f.sem || 0) + '</b><span>Quedó en semis</span></div>' +
          '<div><b id="pfDu">—</b><span>Duelos ganados</span></div>' +
          '<div><b id="pfRd">—</b><span>Racha de duelos</span></div>' +
        '</div></section>' +
        '<section class="blk entro" id="pfJuegoSec" hidden><h2><span>&#128170;</span> Sus fortalezas</h2>' +
          '<div id="pfJuego"></div></section>' +
        '<section class="blk entro"><h2><span>&#127919;</span> Lo que le falta</h2>' +
          '<div class="pf-req" id="pfReq"><p class="nota">Cargando…</p></div></section>' +
        '<section class="blk entro" id="pfRkSec" hidden><h2><span>&#127942;</span> En cada ranking</h2>' +
          '<div class="pf-rk" id="pfRk"></div></section>' +
      '</div>' +
    '</div>' +
    // 💰 cuánto vale su cabeza, y ponerle precio: ver `pintaPrecioPerfil()`
    '<section class="blk entro" id="pfPrecioSec" hidden><h2><span>&#128176;</span> Precio por su cabeza</h2>' +
      '<div id="pfPrecio"></div></section>' +
    '<section class="blk entro" id="pfEvSec" hidden><h2><span>&#128197;</span> Sus eventos</h2>' +
      '<div class="pf-ev" id="pfEv"></div></section>' +
    '<section class="blk entro" id="pfCaraSec" hidden><h2><span>&#129354;</span> Cara a cara</h2>' +
      '<p class="bajada">Contra cada rival: cuántas veces se cruzaron y cómo le fue. Primero, con quien ' +
      'más veces se enfrentó.</p><div class="pf-cara" id="pfCara"></div></section>' +
    '<section class="blk entro" id="pfInsSec" hidden><h2><span>&#127941;</span> Insignias <small id="pfInsN">' +
      '</small></h2><div class="pf-ins" id="pfIns"></div></section>' +
    '<section class="blk entro" id="pfMwSec" hidden><h2><span>&#128128;</span> Su cacería</h2>' +
      '<div class="pf-mw" id="pfMw"></div></section>' +
    '<section class="blk entro" id="pfDuSec" hidden><h2><span>&#9876;</span> Sus duelos</h2>' +
      '<div class="pf-du" id="pfDus"></div></section>';
  PR_PERFIL = f.n;
  try { pintaPrecioPerfil(); } catch (e) { console.error('[pintaPrecioPerfil]', e); }
  // ★ cuántos lo siguen
  pintaSeguidores(k);
  pedirSeguidores().then(function () { pintaSeguidores(k); });
  // 🏠 y el servidor que eligió
  pedirElegidos().then(function () {
    var c = $('#pfSv');
    if (c && c.dataset.k === k) c.innerHTML = svPerfil(k, f);
  });

  // ── lo que viene de /api/perfiles
  perfiles().then(function (P) {
    if (ruta() !== aca) return;
    var x = P && P.p && P.p[k];
    if (!x) {
      $('#pfReq').innerHTML = '<p class="nota">Su historial todavía no está: se arma en la ' +
        'próxima corrida del ciclo.</p>';
      return;
    }
    var E = P.e || {};
    if (x.crew) {
      var cw = (D.crews || []).filter(function (c) { return c.clave === x.crew || c.crew === x.crew; })[0];
      $('#pfCrew').innerHTML = ' <i class="sep">·</i> <a class="chip-crew" href="#/crew/' +
        encodeURIComponent(cw ? cw.clave || cw.crew : x.crew) + '">' + esc(cw ? cw.crew : x.crew) + '</a>';
    }
    // 🔑 SUS REDES: las que eligió mostrar desde Mi cuenta (ver `secRedes()`)
    if ((x.redes || []).length) {
      $('#pfRedes').innerHTML = redes(x.redes, 'chica');
      $('#pfRedes').hidden = false;
    }
    try { pintaJuego(f, x, P.dmp); } catch (e) { console.error('[pintaJuego]', e); }
    var dus = x.du || [];
    var g = dus.filter(function (d) { return d[2]; }).length;
    $('#pfDu').innerHTML = dus.length ? g + '<s>/' + dus.length + '</s>' : '—';
    $('#pfRd').innerHTML = x.rd ? x.rd[0] + '<s> · máx ' + x.rd[1] + '</s>' : '—';
    // lo que le falta, por tarjeta y por condición
    var req = x.req || {};
    $('#pfReq').innerHTML = ['temporada', 'competitivo', 'pais'].map(function (c) {
      var tiene = cartas.indexOf(c) >= 0;
      var cs = req[c] || [];
      var cumple = cs.every(function (q) { return q[0] >= q[1]; });
      // 🔴 CUMPLIR NO ES TENERLA: sin verificarse no hay tarjeta. Decía
      // «✓ Desbloqueada» a 96 de 153 mientras «Sus tarjetas», en la misma
      // página, decía que no tiene porque no está verificado.
      // 🔑 salvo la Temporada, que no pide verificarse (las LIBRES, 29/09/2026)
      var listo = tiene || (cumple && (!f.nv || c === 'temporada'));
      var espera = !listo && cumple;
      return '<div class="rq' + (listo ? ' ok' : '') + '"><h3>' + (CARTA_TIT[c] || c) +
        '<span>' + (listo ? '&#10003; Desbloqueada' : espera ? 'Falta verificarse' : 'Bloqueada') +
        '</span></h3>' + (listo ? '' : espera ? '<p class="nota">Cumple lo que pide; ' +
          esc(NV[f.nv] || 'le falta verificarse') + '.</p>' : cs.map(function (q) {
          var pct = Math.max(0, Math.min(100, Math.round(100 * q[0] / (q[1] || 1))));
          return '<div class="rq-l"><span>' + esc(Math.min(q[0], q[1])) + '/' + esc(q[1]) + ' ' +
            esc(String(q[2]).toLowerCase()) + '</span><i><u style="width:' + pct + '%"></u></i></div>';
        }).join('')) + '</div>';
    }).join('');
    // en cada ranking
    var rk = x.rk || {}, filas = [];
    filas.push(['Temporada', f.fc ? 'Fuera de concurso'
      : '#' + f.pos + ' de ' + (D.oficiales || D.gente || (D.tabla || []).length)]);
    if (rk.du) filas.push(['Duelos', '#' + rk.du[0] + ' de ' + rk.du[1]]);
    if (rk.pod) filas.push(['Podios', '#' + rk.pod[0] + ' de ' + rk.pod[1]]);
    if (rk.pa) filas.push([bandera(f.cc) + ' ' + esc(nombrePais(f.cc)), '#' + rk.pa[0] + ' de ' + rk.pa[1]]);
    if (rk.cr && rk.cr[1]) filas.push([esc(rk.cr[0]), '#' + rk.cr[1] + ' de ' + rk.cr[2]]);
    $('#pfRk').innerHTML = filas.map(function (r) {
      return '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    }).join('');
    $('#pfRkSec').hidden = !filas.length;
    // sus eventos, el más nuevo arriba
    var evs = x.ev || [];
    if (evs.length) {
      $('#pfEvSec').hidden = false;
      $('#pfEv').innerHTML = evs.map(function (e) {
        var m = E[e[0]] || [];
        var t = m[2] ? new Date(m[2]) : null;
        var fecha = t && !isNaN(t) ? fmtFecha(t) : (m[4] || '');
        // todo evento del historial salió de una llave procesada: si no viaja
        // en el lobby, el botón la pide aparte
        var ll = '<button class="ver-llave" data-llave="' + esc(e[0]) + '">Ver llave</button>';
        return '<div class="pe" style="--c:' + esc(colorSv(m[1])) + '"><span class="pe-f">' + esc(fecha) +
          '</span><div><b>' + esc(m[0] || ('Evento #' + e[0])) + '</b><small>' +
          esc(nombreSv(m[1])) + (m[3] ? ' · ' + m[3] + ' raperos' : '') + '</small>' + ll + '</div>' +
          '<span class="pe-p">' + (MEDALLA[e[1]] ? MEDALLA[e[1]] + ' ' : '') + esc(e[1]) + '</span>' +
          '<b class="pe-pts">' + num(e[2]) + '</b></div>';
      }).join('');
    }
    // 🔑 SUS INSIGNIAS. Dlx, 27/09/2026: «me gustan todas». Las ganadas a
    // color; las que faltan en gris, con cómo se ganan: se coleccionan.
    var cat = D.insignias || [];
    if (cat.length) {
      var tiene = {};
      (x.ins || []).forEach(function (i) { tiene[i[0]] = i[1]; });
      $('#pfInsSec').hidden = false;
      $('#pfInsN').textContent = Object.keys(tiene).length + ' de ' + cat.length;
      $('#pfIns').innerHTML = cat.map(function (c) {
        var cu = tiene[c[0]];
        return '<div class="ins' + (cu ? ' si' : '') + '" title="' + esc(c[3]) + '"><span class="ins-e">' + c[1] +
          '</span><b>' + esc(c[2]) + '</b><small>' + (cu ? 'desde el ' + esc(fmtFecha(cu, { day: 'numeric',
            month: 'short' })) : esc(c[3])) + '</small></div>';
      }).join('');
    }
    // 🔑 SU CACERÍA: Most Wanted, de todos los períodos
    var mw = x.mw;
    if (mw) {
      var linea = function (r) {
        var g = porK(kDe(r.n));
        return '<div class="mwl"' + (g ? ' data-k="' + esc(g.k) + '"' : '') + '>' +
          (g ? quienEs(g, 22) : conBanderas(r.n)) + '<span>' + r.t + '</span></div>';
      };
      $('#pfMwSec').hidden = false;
      $('#pfMw').innerHTML =
        '<dl class="mw-n"><div><dt>Cazó</dt><dd>' + mw.caz.length + '</dd></div>' +
        '<div><dt>Lo cazaron</dt><dd>' + mw.czd.length + '</dd></div>' +
        '<div><dt>Sobrevivió</dt><dd>' + mw.sob + '</dd></div>' +
        '<div><dt>Se escondió</dt><dd>' + mw.esc + '</dd></div></dl>' +
        (mw.caz.length ? '<h3 class="mw-h">A quién cazó</h3>' + mw.caz.slice().reverse().map(function (c) {
          return linea({ n: c[1], t: esc(c[2]) + ' · ' + esc(c[3]) + ' · <b>+' + num(c[4]) + '</b>' });
        }).join('') : '') +
        (mw.czd.length ? '<h3 class="mw-h">Quién lo cazó</h3>' + mw.czd.slice().reverse().map(function (c) {
          return linea({ n: (c[3] || [])[0] || '', t: esc(c[1]) + ' · ' + esc(c[2]) +
            ((c[3] || []).length > 1 ? ' · con ' + esc(c[3].slice(1).join(' y ')) : '') });
        }).join('') : '');
    }
    // 🔑 CARA A CARA. Dlx, 27/09/2026: «maybe we could create a DUELOS WIN
    // RATE between each individual… like counting the times they faced
    // before». Sale de los mismos duelos de abajo, agrupados por rival.
    var cara = caraACara(dus);
    if (cara.length) {
      $('#pfCaraSec').hidden = false;
      var fila = function (c) {
        var r = c.k && porK(c.k), t = c.g + c.p;
        return '<div class="cr' + (c.g > c.p ? ' g' : c.g < c.p ? ' p' : '') + '"' +
          (r ? ' data-k="' + esc(r.k) + '"' : '') + '><span class="cr-q">' +
          (r ? quienEs(r, 24) : conBanderas(c.n)) + '</span><b class="cr-m">' + c.g +
          '<i>&ndash;</i>' + c.p + '</b><span class="cr-b" aria-hidden="true"><u style="width:' +
          Math.round(100 * c.g / t) + '%"></u></span><small>' + (t === 1 ? 'una vez'
            : t + ' veces') + '</small></div>';
      };
      // se pliega sólo si sobran varios: «Los otros 1» escondía justo al único
      // que le ganó a Hassan
      var TOPE_CARA = cara.length <= 11 ? cara.length : 8;
      $('#pfCara').innerHTML = cara.slice(0, TOPE_CARA).map(fila).join('') +
        (cara.length > TOPE_CARA ? '<details class="cr-mas"><summary>Los otros ' +
          (cara.length - TOPE_CARA) + '</summary>' + cara.slice(TOPE_CARA).map(fila).join('') +
          '</details>' : '');
    }
    if (dus.length) {
      $('#pfDuSec').hidden = false;
      $('#pfDus').innerHTML = dus.map(function (d) {
        var m = E[d[0]] || [];
        var r = porK(kDe(d[1]));
        return '<div class="dd' + (d[2] ? ' g' : ' p') + '"><span class="dd-r">' + (d[2] ? 'Ganó' : 'Perdió') +
          '</span><span class="dd-v">vs ' + (r ? quienEs(r, 22) : conBanderas(d[1])) + '</span>' +
          '<small>' + esc(m[0] || '') + '</small></div>';
      }).join('');
    }
  });
}
/* 🔑 LOS DUELOS DE ALGUIEN, AGRUPADOS POR RIVAL: `[{k, n, g, p}]`, primero
   con quien más veces se cruzó y, a igual cantidad, el mejor saldo. `dus`
   son los de `/api/perfiles`: `[evento, rival, ganó]`. */
function caraACara(dus) {
  var por = {}, orden = [];
  (dus || []).forEach(function (d) {
    var k = kDe(d[1]), id = k || 'n:' + (normNombre(d[1]) || d[1]);
    if (!por[id]) { por[id] = { k: k, n: d[1], g: 0, p: 0 }; orden.push(id); }
    por[id][d[2] ? 'g' : 'p']++;
  });
  return orden.map(function (id) { return por[id]; }).sort(function (a, b) {
    return (b.g + b.p) - (a.g + a.p) || (b.g - b.p) - (a.g - a.p);
  });
}
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
  if (!c.length) return (D.alias && D.alias[normNombre(n)]) || '';
  var ccs = banderasDe(n);
  var m = c.filter(function (f) { return ccs.indexOf(String(f.cc || '').toLowerCase()) >= 0; });
  return m.length === 1 ? m[0].k : '';
}

/* ── el buscador del Inicio ───────────────────────────────────────────
   🔑 Lo que la página vieja tenía primero: escribís tu nombre y vas a tu
   perfil. */
function sinTildes(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function pintaBusca(q) {
  var caja = $('#buscaRes');
  q = sinTildes(q).trim();
  if (!q) { caja.hidden = true; caja.innerHTML = ''; return; }
  var fs = (D.tabla || []).filter(function (f) {
    return sinTildes(f.n).indexOf(q) >= 0;
  }).slice(0, 6);
  caja.hidden = false;
  caja.innerHTML = fs.length ? fs.map(function (f, i) {
    return '<button class="br' + (i ? '' : ' on') + '" data-k="' + esc(f.k) + '">' + quienEs(f, 26) +
      '<span class="br-p">' + numPos(f) + '</span></button>';
  }).join('') : '<p class="br-no">No hay nadie con ese nombre en la temporada.</p>';
}

/* ── la actividad ─────────────────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «quizás podamos medir la actividad también». Los
   eventos de cada día de las últimas dos semanas, con el color de su
   servidor, y los números de la semana. */
/* 🔑 LA COMUNIDAD: cuánta gente tiene la Liga. Dlx, 25/09/2026: «¿cuántas
   personas diferentes tenemos, y con ID y verificadas? Quizás ese dato
   podríamos agregarlo a La Liga hoy». Cada número se dibuja sólo si vino. */
function pintaComunidad() {
  var C = D.comunidad, caja = $('#comunidad');
  if (!caja) return;
  if (!C || !C.personas) { caja.hidden = true; return; }
  var filas = [
    ['Personas', C.personas, C.servidores ? 'distintas, en los ' + C.servidores + ' servidores' : 'distintas'],
    ['En la Lista', C.lista, 'compitieron o se anotaron'],
    ['Con su Discord', C.con_id, 'el bot sabe quiénes son'],
    ['Verificadas', C.verificados, 'con tarjeta'],
  ].filter(function (f) { return f[1]; });
  caja.innerHTML = '<h3>La comunidad</h3><dl class="com-n">' + filas.map(function (f) {
    return '<div><dt>' + esc(f[0]) + '</dt><dd>' + num(f[1]) + '</dd><small>' + esc(f[2]) +
      '</small></div>';
  }).join('') + '</dl>' +
    // ver `pintaPedi()`: se esconde para quien ya tiene la suya
    '<a class="com-pedi" id="comPedi" href="#/tarjetas">¿Todavía no tenés tu tarjeta? Pedila &#8594;</a>';
  caja.hidden = false;
  try { pintaPedi(); } catch (e) { /* la cuenta lo vuelve a pintar */ }
}

/* 🔑 «QUE LA PIDAN ELLAS». Dlx, 25/09/2026, sobre las 1.492 personas con el
   Miembro de DRA y país que nunca pidieron su tarjeta: que cada una la pida
   —con /verificar o /card— y que la página las empuje. Un bloque en
   Tarjetas y un link en «La comunidad» del Inicio, que se esconden para
   quien ya tiene la suya (la de la cuenta de Discord, o la del rapero que
   eligió en «Mi cuenta»). */
function pintaPedi() {
  var f = yo();
  var tiene = (f && (f.c || []).some(function (c) { return String(c).indexOf('bloq-') !== 0; })) ||
    (DC && (DC.cs || []).length > 0);
  var dra = svDe('DRA');
  var s = $('#secPedi');
  if (s) {
    s.innerHTML = '<h2><span>&#127183;</span> ¿Todavía no tenés tu tarjeta?</h2>' +
      '<p class="bajada">La pide cada uno y es un minuto: escribí <code>/verificar</code> en ' +
      'Discord. El bot te dice qué te falta y, si está todo, te carga solo: en menos de una hora ' +
      'tenés tu tarjeta.</p>' +
      '<p class="bajada">Tu <b>Temporada</b> y tu <b>Servidor</b> salen solas cuando jugás estando en ' +
      'la Lista. Para las cuatro hace falta estar en <b>Discord Rap Español</b> con el rol ' +
      '<b>Miembro</b> y tu <b>país</b> (la bandera en el apodo o el rol de tu país).</p>' +
      '<div class="pedi-bt">' +
      (dra.invita ? '<a class="btn" href="' + esc(dra.invita) + '" target="_blank" ' +
        'rel="noopener noreferrer">Entrar a Discord Rap Español &#8599;</a>' : '') +
      '<a class="btn sec" href="#/guia">Cómo funciona</a></div>';
    s.hidden = !!tiene;
  }
  var l = $('#comPedi');
  if (l) l.hidden = !!tiene;
}
function pintaActividad() {
  var A = D.actividad;
  var caja = $('#actividad');
  if (!A || !(A.dias || []).length) { caja.hidden = true; return; }
  var max = Math.max(1, Math.max.apply(null, A.dias.map(function (d) {
    return Object.keys(d[1]).reduce(function (s, k) { return s + d[1][k]; }, 0);
  })));
  var dias = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  var barras = A.dias.map(function (d) {
    var dia = new Date(d[0] + 'T12:00:00');
    var tot = 0, capas = Object.keys(d[1]).map(function (sv) {
      tot += d[1][sv];
      return '<i style="height:' + (100 * d[1][sv] / max) + '%;background:' + esc(colorSv(sv)) +
        '" title="' + esc(nombreSv(sv)) + ': ' + d[1][sv] + '"></i>';
    }).join('');
    return '<div class="ac-d" title="' + esc(dia.toLocaleDateString('es', { day: 'numeric', month: 'short' })) +
      ': ' + tot + (tot === 1 ? ' evento' : ' eventos') + '"><span class="ac-b">' + capas + '</span>' +
      '<u>' + dias[dia.getDay()] + '</u></div>';
  }).join('');
  var cambio = A.ant ? Math.round(100 * (A.ev - A.ant) / A.ant) : null;
  caja.innerHTML = '<h3>Actividad</h3>' +
    '<dl class="ac-n"><div><dt>Eventos esta semana</dt><dd>' + A.ev +
    (cambio !== null ? '<s class="' + (cambio >= 0 ? 'sube' : 'baja') + '">' + (cambio >= 0 ? '+' : '') +
      cambio + '%</s>' : '') + '</dd></div>' +
    '<div><dt>Participaciones</dt><dd>' + num(A.part) + '</dd></div>' +
    '<div><dt>Raperos distintos</dt><dd>' + num(A.gente) + '</dd></div></dl>' +
    '<div class="ac-g" role="img" aria-label="Eventos por día, últimas dos semanas">' + barras + '</div>' +
    '<p class="nota">Eventos por día · últimas 2 semanas</p>';
  caja.hidden = false;
}

/* ── novedades de la Liga y sus redes ─────────────────────────────────
   🔑 Dlx, 25/09/2026: «3 mini recent feeds de DRA únicamente, como una
   pestaña de novedades… información de la liga». Salen de
   〢🌍〉rankings-liga-global, donde se anuncia todo lo de la Liga. */
var RED_ICONO = {
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor"/><path d="M10 9v6l5-3z" fill="var(--ng,#030304)"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16M20 4L4 20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3v11.5a3.5 3.5 0 1 1-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M13 3c.4 2.6 2.2 4.4 5 4.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  twitch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h15v10l-4 4h-4l-3 3v-3H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M11 7v4M15 7v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  kick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h4v6l5-6h5l-6 8 6 10h-5l-5-7v7H5z" fill="currentColor"/></svg>',
};
RED_ICONO.spotify = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7 9.6c3.4-1 7-.6 10 1M7.6 12.9c2.9-.8 5.7-.4 8.2.9M8.2 16c2.2-.5 4.3-.3 6.1.7" fill="none" stroke="var(--ng,#030304)" stroke-width="1.6" stroke-linecap="round"/></svg>';
RED_ICONO.reddit = '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="14" rx="8" ry="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="13.6" r="1.2" fill="currentColor"/><circle cx="15" cy="13.6" r="1.2" fill="currentColor"/><path d="M12 8.5l1.3-4.4 3.6 1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="18" cy="5.3" r="1.4" fill="currentColor"/></svg>';
RED_ICONO.bluesky = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11c-1.5-3-5-6.5-8-6.5-1.2 0-1.5 1.5-1 3.5.6 2.6 2.4 3.6 5 3.4-3 .6-4 2.4-2.4 4.1 1.8 2 4.4 0 6.4-3.5 2 3.5 4.6 5.5 6.4 3.5 1.6-1.7.6-3.5-2.4-4.1 2.6.2 4.4-.8 5-3.4.5-2-.2-3.5-1-3.5-3 0-6.5 3.5-8 6.5z" fill="currentColor"/></svg>';
var RED_NOMBRE = { instagram: 'Instagram', youtube: 'YouTube', x: 'X', tiktok: 'TikTok',
  twitch: 'Twitch', kick: 'Kick', spotify: 'Spotify', reddit: 'Reddit', bluesky: 'Bluesky' };
function redes(rs, cl) {
  return (rs || []).map(function (r) {
    return '<a class="red ' + (cl || '') + '" href="' + esc(r[1]) + '" target="_blank" ' +
      'rel="noopener noreferrer" title="' + esc(RED_NOMBRE[r[0]] || r[0]) + '" aria-label="' +
      esc(RED_NOMBRE[r[0]] || r[0]) + '">' + (RED_ICONO[r[0]] || esc(r[0])) + '</a>';
  }).join('');
}
var DISCORD_ICONO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" ' +
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
var FEED = { pag: 0, pp: 0 };
function porPagina() { return window.innerWidth < 620 ? 1 : 2; }
function itemFeed(x) {
  // ⚠️ EL ID DEL VIDEO VA ADENTRO DE UN `onerror`, o sea de JavaScript en un
  // atributo, y ahí `esc()` no protege: `&#39;` se vuelve `'` antes de que
  // corra. Hoy viene del RSS de YouTube; igual, sólo pasa lo que tiene forma
  // de ID (auditoría del 27/09/2026).
  if (x.vid && !/^[\w-]{6,20}$/.test(String(x.vid))) x = Object.assign({}, x, { vid: '' });
  var yt = x.tipo === 'youtube';
  var de = yt ? (x.canal || nombreSv(x.sv) || x.sv) : 'Liga Global';
  return '<a class="fd' + (yt ? ' yt' : '') + '" href="' + esc(x.link) + '" target="_blank" ' +
    'rel="noopener noreferrer" style="--c:' + esc(colorSv(x.sv)) + '">' +
    // 🔴 ERA `mqdefault` (320×180) Y EL FEED GRANDE LA ESTIRA AL DOBLE: Dlx,
    // 25/09/2026, «por qué los thumbnails se ven con baja calidad». Ahora la
    // de 640 en el teléfono y la de 1280 en la compu; si un video no tiene
    // la grande, `hqdefault` existe siempre. `object-fit:cover` recorta las
    // bandas negras de la de 640, que es 4:3.
    (yt && x.vid ? '<span class="fd-img"><img src="https://i.ytimg.com/vi/' + esc(x.vid) +
      '/hq720.jpg" srcset="https://i.ytimg.com/vi/' + esc(x.vid) + '/sddefault.jpg 640w, ' +
      'https://i.ytimg.com/vi/' + esc(x.vid) + '/hq720.jpg 1280w" sizes="(max-width: 620px) 100vw, 50vw" ' +
      'onerror="this.onerror=null;this.removeAttribute(\'srcset\');this.src=\'https://i.ytimg.com/vi/' +
      esc(x.vid) + '/hqdefault.jpg\'" alt="" width="640" height="360" loading="lazy" decoding="async">' +
      '<i aria-hidden="true">&#9654;</i></span>' : '') +
    '<span class="fd-de"><i class="fd-red">' + (yt ? RED_ICONO.youtube : DISCORD_ICONO) + '</i>' +
    esc(de) + '<small>' + esc(cuandoSe(x.t)) + '</small></span>' +
    '<b>' + esc(x.tit) + '</b>' + (!yt && x.tx ? '<p>' + esc(x.tx) + '</p>' : '') +
    '<span class="fd-ir">' + (yt ? 'Ver en YouTube' : 'Ver en Discord') + ' &#8599;</span></a>';
}
function pager(st, items, pp, caja, nav, pag, antes, despues, item) {
  var tot = Math.max(1, Math.ceil(items.length / pp));
  st.pag = Math.max(0, Math.min(st.pag, tot - 1));
  st.pp = pp;
  $(caja).innerHTML = items.slice(st.pag * pp, st.pag * pp + pp).map(item).join('');
  $(nav).hidden = tot < 2;
  $(pag).textContent = (st.pag + 1) + ' de ' + tot;
  $(antes).disabled = st.pag === 0;
  $(despues).disabled = st.pag >= tot - 1;
}
// 🔑 LAS REDES, EN GRANDE: los videos de YouTube de cada servidor, dos por
// página. Dlx, 25/09/2026: «en grande, 2 bloques con flechas».
function pintaFeed() {
  var fs = (D.feed || []).filter(function (x) { return x.tipo === 'youtube'; });
  var rs = D.redes || [];
  if (!fs.length && !rs.length) { apaga('#secRedes'); return; }
  $('#secRedes').hidden = false;
  $('#novRedes').innerHTML = rs.length ? '<span>Seguí a la Liga</span>' + redes(rs) : '';
  $('#feed').hidden = !fs.length;
  pager(FEED, fs, porPagina(), '#feed', '#feedNav', '#feedPag', '#feedAntes', '#feedDespues', itemFeed);
}
// 🔑 LAS NOVEDADES: lo que anuncia la Liga en DRA. Dlx, 25/09/2026: «lo
// último de la liga que sea como novedades, información».
var NOV = { pag: 0, pp: 0 };
function pintaNovedades() {
  var ns = (D.novedades || []).map(function (x) { return Object.assign({ tipo: 'discord', sv: 'DRA' }, x); });
  if (!ns.length) { apaga('#secNov'); return; }
  $('#secNov').hidden = false;
  pager(NOV, ns, porPagina(), '#novedades', '#novNav', '#novPag', '#novAntes', '#novDespues', itemFeed);
}

/* ── los paneles del Inicio ───────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «un sistema de paneles de páginas: la primera será
   MW y a la mitad, a la derecha, MISIONES… Liga hoy será la última». La del
   medio es la de quien mira: su temporada y lo que viene. */
var PN = { pag: 0 };
/* ── Most Wanted ──────────────────────────────────────────────────────
   🔑 EL TABLERO VA EN EL PANEL DEL INICIO. Dlx, 27/09/2026: «por eso puse
   el panel ahí». Cada cartel dice su categoría, por qué lo buscan, cuánto
   vale AHORA y cómo está: suelto, cazado, sobrevivió o se escondió. Todo
   sale de `D.mw` (`bot/most_wanted.py`, en el ciclo). */
var MW_EST = {
  suelto: ['&#128994;', 'Suelto'], cazado: ['&#127919;', 'Cazado'],
  sobrevivio: ['&#128737;&#65039;', 'Sobrevivió'], escondio: ['&#128168;', 'Se escondió']
};
/* el cartel de alguien en el período de ahora, si lo tiene */
function mwDe(n) {
  var M = D.mw;
  if (!M || !n) return null;
  var k = kDe(n);
  return (M.b || []).filter(function (b) { return b.n === n || (k && b.k === k); })[0] || null;
}
function cartelMW(b) {
  var f = b.k && porK(b.k);
  var e = MW_EST[b.e] || MW_EST.suelto;
  var por = b.c ? (b.c.por || []).map(function (y) { return esc(y.n); }).join(' y ') : '';
  return '<div class="mwc e-' + esc(b.e) + '"' + (b.k ? ' data-k="' + esc(b.k) + '"' : '') + '>' +
    '<span class="mwc-cat">' + (b.cat === 'elegido' ? '&#128499;&#65039; ' : '') + esc(b.cn) + '</span>' +
    '<span class="mwc-q">' + (f ? quienEs(f, 34) : '<span class="quien">' + conBanderas(b.n) + '</span>') + '</span>' +
    '<small class="mwc-m">' + esc(b.m) + '</small>' +
    '<span class="mwc-v"><b>' + num(b.paga || b.v) + '</b> pts</span>' +
    '<span class="mwc-e">' + e[0] + ' ' + (b.e === 'cazado' && por ? 'Lo cazó ' + por : e[1]) + '</span>' +
    (b.c ? '<small class="mwc-d">en ' + esc(b.c.ev) + '</small>' : '') + '</div>';
}
function pintaMW() {
  var M = D.mw, pag = $('#secPaneles .pn-pag[data-pag="0"]');
  if (!pag || !M) return;
  // la primera semana de la temporada no hay buscados: dice cuándo salen
  if (!(M.b || []).length) {
    if (!M.prox) return;
    pag.dataset.tit = '&#128128; Most Wanted';
    pag.innerHTML = '<p class="mw-cab">Los primeros <b>buscados de la temporada</b> salen el ' +
      esc(fmtFecha(M.prox, { weekday: 'long', day: 'numeric', month: 'long' })) + ' a las ' +
      esc(fmtHora(M.prox)) + ' ' + etiquetaHora(M.prox) + '. Se eligen con lo que cada uno juegue ' +
      'hasta entonces.</p><div class="enc" id="encElegido" hidden></div>' +
      '<div class="enc" id="prInicio" hidden></div>' +
      '<p class="mw-pie"><span>&#127919; Las <b>misiones</b> llegan pronto.</span></p>';
    return;
  }
  var sueltos = M.b.filter(function (b) { return b.e === 'suelto'; }).length;
  pag.dataset.tit = '&#128128; Most Wanted' + (M.tipo === 'dia' ? ' de hoy' : ' de la semana');
  var tmw = D.tienda && D.tienda.mw;
  pag.innerHTML = '<p class="mw-cab"><b>' + sueltos + ' de ' + M.b.length + '</b> siguen sueltos. ' +
    'Cazalos en cualquier evento de la Liga: le ganás a uno y su recompensa suma a tus Puntos' +
    (tmw ? ' (y el ' + Math.round(tmw * 100) + ' % en Puntos de Tienda)' : '') + '. Vence el ' +
    esc(fmtFecha(M.fin, { weekday: 'long' })) + ' a las ' + esc(fmtHora(M.fin)) + ' ' + etiquetaHora(M.fin) +
    '.</p><div class="mw-t">' + M.b.map(cartelMW).join('') + '</div>' +
    // la votación de El Elegido del que viene: la llena `pintaEncuestas()`
    '<div class="enc" id="encElegido" hidden></div>' +
    // y el precio por cabeza: lo llena `pintaPrecioInicio()`
    '<div class="enc" id="prInicio" hidden></div>' +
    '<p class="mw-pie"><a href="#/ranking/mw">Los cazadores de la temporada &#8250;</a>' +
    '<span>&#127919; Las <b>misiones</b> llegan pronto.</span></p>';
  // la pestaña del ranking deja de decir «pronto»
  var s = $('#subRanking [data-sub="mw"]');
  if (s) {
    s.classList.remove('pronto');
    var i = s.querySelector('i');
    if (i) i.remove();
  }
}
/* ── las encuestas ─────────────────────────────────────────────────────
   🔑 Dlx, 27/09/2026, del Most Wanted: «eso de que los buscados lo elige la
   gente es peak», en la página; y a quién vota, «1. A. 2. A»: cualquiera que
   entre con Discord. En el ×2, desde el 28/09 cualquiera vota a cualquiera,
   también al suyo («3. B y C»). Qué se vota llega
   en `D.enc` (bot/encuestas.py, cada media hora) y cuántos votos lleva cada
   opción, de `/api/avisos/encuestas`. Quién vota lo dice Discord al Worker
   (`validarVoto()` en bot/avisos.js), nunca la página.
   ⚠️ AFUERA SE VE CUÁNTOS, NUNCA QUIÉN. Lo que votaste lo recuerda sólo tu
   navegador (`lg:votos`). */
var ENC_V = {}, ENC_T = 0, ENC_POST = {}, ENC_EST = {}, ENC_BUSCA = '';
var ENC_MIO = leerLS('lg:votos', null) || {};
function pedirEncuestas() {
  if (!D || !(D.enc || []).length) return;
  fetch('/api/avisos/encuestas', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.votos) return;
      ENC_V = d.votos;
      ENC_T = d.t || 0;
      pintaEncuestas();
    })
    .catch(function () { /* sin los votos se ve igual, sin números */ });
}
/* los votos de una: los de mi voto, si son más nuevos que los de la caché */
function cuentaEnc(id) {
  var p = ENC_POST[id];
  return p && p.t >= ENC_T ? p.cuenta : ENC_V[id] || {};
}
function totalEnc(c) {
  return Object.keys(c).reduce(function (s, k) { return s + (+c[k] || 0); }, 0);
}
/* 🔑 LO QUE PIDE SABER QUIÉN SOS —votar, poner un precio, la billetera—: con
   la SESIÓN (la cookie que deja entrar con Discord, 30 días) o con el permiso
   recién traído, y a Discord UNA sola vez.
   🔴 Dlx, 28/09/2026: «cada vez que presiono para votar me redirige a DISCORD
   para autorizar mi cuenta… lo hice miles de veces». Un 401 borraba el
   permiso y volvía a votar, que volvía a mandar a Discord: si Discord no
   contestaba bien, era un ciclo. Ahora: si recién se volvió de Discord y el
   servidor sigue sin saber quién sos, se dice y no se manda a ningún lado; y
   si Discord no contesta (503), también. */
var DC_VUELTA = false;
function pedirConCuenta(ruta, cuerpo, conPermiso) {
  var b = Object.assign({}, cuerpo);
  if (conPermiso && DC_TOKEN) b.token = DC_TOKEN;
  return fetch(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; });
    });
}
/* `modo`, `clave` y `pendiente`: a qué entrar y qué hacer a la vuelta. Sin
   `modo`, no se va a ningún lado (lo que se pide solo, como la billetera al
   abrir la Tienda). Devuelve la respuesta, o `null` si se fue a Discord. */
function conCuenta(ruta, cuerpo, modo, clave, pendiente) {
  var irse = function (j) {
    if (!modo || DC_VUELTA) return j;
    try { if (clave) sessionStorage.setItem(clave, JSON.stringify(pendiente)); } catch (e) { /* igual */ }
    location.href = urlLogin(modo);
    return null;
  };
  return pedirConCuenta(ruta, cuerpo, false).then(function (j) {
    if (j.status !== 401) return j;
    if (!DC_TOKEN) return irse(j);
    return pedirConCuenta(ruta, cuerpo, true).then(function (k) {
      if (k.status !== 401) return k;
      DC_TOKEN = null;
      return irse(k);
    });
  });
}
/* lo que se le dice a quien no pudo entrar */
function errorCuenta(e) {
  return e === 'discord_ocupado' ? 'Discord no contesta ahora: probá de nuevo en un minuto.'
    : e === 'discord' || e === 'sin_sesion' ? 'Discord no confirmó tu cuenta. Probá entrar de nuevo desde Mi cuenta.'
    : '';
}
function votar(id, op) {
  ENC_EST[id] = { va: op };
  pintaEncuestas();
  conCuenta('/api/avisos/votar', { enc: id, op: op }, 'e', 'lg:voto', { enc: id, op: op })
    .then(function (j) {
      if (!j) return;
      if (j.ok) {
        ENC_MIO[id] = op;
        guardarLS('lg:votos', ENC_MIO);
        ENC_POST[id] = { t: j.t || 0, cuenta: j.cuenta || {} };
        ENC_EST[id] = {};
      } else {
        ENC_EST[id] = j;
      }
      pintaEncuestas();
    })
    .catch(function () { ENC_EST[id] = { error: 'red' }; pintaEncuestas(); });
}
function errorEnc(E) {
  var e = E.error;
  return errorCuenta(e) || (e === 'cerrada' ? 'La votación ya cerró.'
    : e === 'vos' ? 'No podés votarte a vos.'
    : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva para votar: vas a poder desde el ' +
      esc(fmtFecha(E.desde, { day: 'numeric', month: 'long' })) + '.'
    : e === 'opcion' ? 'Esa opción ya no está: la lista se actualiza cada media hora.'
    : e === 'no_existe' ? 'Esa votación ya no está.'
    : 'No pude guardar tu voto. Probá de nuevo en un rato.');
}
/* el renglón de abajo: qué votaste, o qué salió mal */
function pieEnc(E, nombre) {
  var est = ENC_EST[E.id] || {}, mio = ENC_MIO[E.id];
  if (est.va) return 'Guardando tu voto&hellip;';
  if (est.error) return '<span class="enc-mal">' + errorEnc(est) + '</span>';
  if (mio && E.op.indexOf(mio) >= 0) {
    return 'Votaste por <b>' + esc(nombre(mio)) + '</b>. Lo podés cambiar hasta que cierre.';
  }
  return (DC ? 'Tocá una opción para votar.' : 'Para votar entrás con Discord: tocá una opción.') +
    ' Nadie ve a quién votaste.';
}
function cabEnc(E, tot) {
  var min = E.min || 3;
  return 'Cierra el ' + esc(fmtFecha(E.hasta, { weekday: 'long' })) + ' a las ' + esc(fmtHora(E.hasta)) + ' ' +
    etiquetaHora(E.hasta) + ' &middot; ' + (tot ? '<b>' + tot + (tot === 1 ? ' voto' : ' votos') + '</b>'
    : 'todavía sin votos') + (tot < min ? ' (hacen falta ' + min + ')' : '') + '.';
}
/* quién soy según Discord: sólo con eso se marca «el tuyo» o «sos vos»
   (quien eligió a mano quién es puede haber elegido a otro) */
function yoDiscord() { return DC && DC.clave ? porK(DC.clave) : null; }
function pintaEncuestas() {
  var es = (D && D.enc) || [], ahora = Date.now();
  var abierta = function (t) {
    return es.filter(function (e) { return e.tipo === t && Date.parse(e.hasta) > ahora; })[0] || null;
  };
  pintaElegido(abierta('elegido'));
  pintaX2(abierta('x2'));
}
/* 🔑 EL ELEGIDO: los más votados arriba; a los demás se llega buscando */
function pintaElegido(E) {
  var c = $('#encElegido');
  if (!c) return;
  if (!E || !(E.op || []).length) { c.hidden = true; return; }
  if (c.dataset.id !== E.id) {
    var para = E.per === 'semana' ? 'de la semana del ' + esc(fmtFecha(E.hasta, { day: 'numeric', month: 'numeric' }))
      : 'del ' + esc(fmtFecha(E.hasta, { weekday: 'long' }));
    c.dataset.id = E.id;
    c.innerHTML = '<h4>&#128499;&#65039; El Elegido ' + para + '</h4><p class="enc-b"></p>' +
      '<input type="search" class="enc-busca" placeholder="Buscá a quién votar" ' +
      'aria-label="Buscar un rapero para votar" value="' + esc(ENC_BUSCA) + '">' +
      '<div class="enc-ops"></div><p class="enc-e" aria-live="polite"></p>';
  }
  c.querySelector('.enc-b').innerHTML = 'Votá a quién buscar: el más votado entra al Most Wanted como ' +
    '<b>El Elegido</b>. ' + cabEnc(E, totalEnc(cuentaEnc(E.id)));
  pintaOpsElegido(E);
  c.hidden = false;
}
function pintaOpsElegido(E) {
  var c = $('#encElegido');
  E = E || ((D && D.enc) || []).filter(function (e) { return e.tipo === 'elegido'; })[0];
  if (!E || !c || !c.querySelector('.enc-ops')) return;
  var cu = cuentaEnc(E.id), tot = totalEnc(cu), mio = ENC_MIO[E.id], est = ENC_EST[E.id] || {};
  var yoF = yoDiscord();
  var fDe = function (op) { return porK(kDe(op)); };
  var nombre = function (op) { var f = fDe(op); return f ? f.n : op; };
  var idx = {};
  E.op.forEach(function (o, i) { idx[o] = i; });
  var ops = E.op.slice().sort(function (a, b) { return (cu[b] || 0) - (cu[a] || 0) || idx[a] - idx[b]; });
  var q = sinTildes(ENC_BUSCA).trim();
  var ver = q ? ops.filter(function (o) { return sinTildes(nombre(o)).indexOf(q) >= 0; }).slice(0, 8)
    : ops.slice(0, 6);
  c.querySelector('.enc-ops').innerHTML = ver.length ? ver.map(function (op) {
    var f = fDe(op), n = cu[op] || 0, esYo = yoF && f && f.k === yoF.k;
    return '<button type="button" class="enc-op' + (mio === op ? ' mio' : '') + (est.va === op ? ' va' : '') +
      '" data-votar="' + esc(E.id) + '" data-op="' + esc(op) + '"' + (esYo ? ' disabled title="Sos vos"' : '') + '>' +
      '<i class="enc-bar" style="width:' + (tot ? Math.round(100 * n / tot) : 0) + '%"></i>' +
      (f ? quienEs(f, 26) : '<span class="quien">' + conBanderas(op) + '</span>') +
      '<span class="enc-n">' + (esYo ? 'sos vos' : (mio === op ? '&#10003; ' : '') + n) + '</span></button>';
  }).join('') : '<p class="nota">Nadie con ese nombre puede ser El Elegido.</p>';
  c.querySelector('.enc-e').innerHTML = pieEnc(E, nombre) + (!q && E.op.length > ver.length
    ? ' Se puede votar a ' + E.op.length + ': buscá a quién.' : '');
}
/* 🔑 EL ×2 DE LA SEMANA QUE VIENE: los servidores, con sus votos */
function pintaX2(E) {
  var c = $('#encX2');
  if (!c) return;
  // la página de la votación en el panel de multiplicadores aparece y se va con ella
  if (!E || !(E.op || []).length) { c.hidden = true; pintaMultPags(); return; }
  var cu = cuentaEnc(E.id), tot = totalEnc(cu), mio = ENC_MIO[E.id], est = ENC_EST[E.id] || {};
  var x = String(E.x || 2).replace('.', ',');
  // 🔑 CUALQUIERA VOTA A CUALQUIERA, también al suyo (Dlx, 28/09/2026: «3. B y C»).
  // ⚠️ Sin el título de antes: ahora es el de su página en el panel
  c.innerHTML = '<p class="enc-b">¿Quién se lleva el &times;' + x + ' la semana que viene? El más votado sale ' +
    'del sorteo del lunes con <b>&times;' + x + ' como mínimo</b>. ' +
    cabEnc(E, tot) + '</p>' +
    '<div class="enc-svs">' + E.op.map(function (sv) {
      var n = cu[sv] || 0;
      return '<button type="button" class="enc-sv' + (mio === sv ? ' mio' : '') + (est.va === sv ? ' va' : '') +
        '" style="--c:' + esc(colorSv(sv)) + '" data-votar="' + esc(E.id) + '" data-op="' + esc(sv) + '">' +
        logoSv(sv, 30) + '<span class="enc-svn" title="' + esc(nombreSv(sv)) + '">' + esc(sv) + '</span>' +
        '<small>' + (mio === sv ? '&#10003; ' : '') + n + (n === 1 ? ' voto' : ' votos') +
        '</small><i class="enc-bar" style="width:' + (tot ? Math.round(100 * n / tot) : 0) + '%"></i></button>';
    }).join('') + '</div><p class="enc-e" aria-live="polite">' + pieEnc(E, nombreSv) + '</p>';
  c.hidden = false;
  pintaMultPags();
}
/* ── la tienda: los Puntos de Tienda y el precio por cabeza ────────────
   🔑 Dlx, 27 y 28/09/2026: «PUNTOS de TIENDA… que todos empecemos con 5k»,
   el precio por cabeza se paga con eso, «si nadie lo caza, vuelve», «sí 20k»,
   y «1. Ambos. 2. B»: el que caza cobra esos Puntos de Tienda y lo mismo en
   su Temporada, y billetera tiene cualquiera que entre con Discord. Y
   «agrega la opción de TIENDA». Los números vienen en `D.tienda`
   (bot/precios.py); cuánto vale cada cabeza, de `/api/avisos/precios`; tu
   billetera, de `/api/avisos/billetera`, con el permiso de Discord.
   ⚠️ AFUERA SE VE CUÁNTO VALE CADA CABEZA, NUNCA QUIÉN PUSO. */
var PRECIOS = null, PRECIOS_T = 0, PR_TOT = {}, BILL = null, PR_EST = {}, PR_BUSCA = '', PR_SEL = '',
  PR_PERFIL = '';
function pedirPrecios() {
  if (!D || !D.tienda) return;
  fetch('/api/avisos/precios', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !Array.isArray(d.precios)) return;
      PRECIOS = d.precios;
      PRECIOS_T = d.t || 0;
      pintaPrecios();
    })
    .catch(function () { /* sin precios se ve igual, sin números */ });
}
/* lo que vale cada cabeza ahora: lo activo, lo que todavía se puede cobrar.
   El precio que acabo de poner manda sobre la caché, si es más nuevo. */
function valorCabezas() {
  var ahora = Date.now(), v = {};
  (PRECIOS || []).forEach(function (p) {
    if (!p.estado && p.fin > ahora) v[p.cabeza] = (v[p.cabeza] || 0) + (+p.monto || 0);
  });
  Object.keys(PR_TOT).forEach(function (c) { if (PR_TOT[c].t >= PRECIOS_T) v[c] = PR_TOT[c].total; });
  return v;
}
/* a quién se le puede poner precio: a quien juega la temporada y no es
   fuera de concurso (lo mismo que valida el Worker) */
function puedeCabeza(n) {
  var f = (D.tabla || []).filter(function (x) { return x.n === n; })[0];
  return !!(f && !f.fc);
}
function nombreCabeza(n) { var f = porK(kDe(n)); return f ? f.n : n; }
/* `entrar`: si no se sabe quién sos, ir a Discord (el botón); sin eso, se
   prueba con la sesión y, si no hay, queda el botón (al abrir la Tienda) */
function pedirBilletera(entrar) {
  if (!D || !D.tienda) return;
  conCuenta('/api/avisos/billetera', {}, entrar ? 't' : '', null, null)
    .then(function (j) {
      if (!j) return;
      if (j.status === 401) { BILL = entrar ? { error: j.error } : null; pintaPrecios(); return; }
      BILL = j.ok ? j : { error: j.error || 'red' };
      pintaPrecios();
    })
    .catch(function () { BILL = { error: 'red' }; pintaPrecios(); });
}
function ponerPrecio(cabeza, monto) {
  PR_EST[cabeza] = { va: monto };
  pintaPrecios();
  conCuenta('/api/avisos/precio', { cabeza: cabeza, monto: monto }, 't', 'lg:precio',
    { cabeza: cabeza, monto: monto, volver: ruta() })
    .then(function (j) {
      if (!j) return;
      if (j.ok) {
        PR_EST[cabeza] = { ok: j.monto };
        PR_TOT[cabeza] = { t: j.t || 0, total: j.total };
        if (BILL && BILL.ok) BILL.saldo = j.saldo;
        pedirBilletera(false);
      } else {
        PR_EST[cabeza] = j;
      }
      pintaPrecios();
    })
    .catch(function () { PR_EST[cabeza] = { error: 'red' }; pintaPrecios(); });
}
function errorPrecio(E) {
  var T = D.tienda || {}, e = E.error;
  return errorCuenta(e) || (e === 'saldo' ? 'No te alcanzan: tenés ' + num(E.saldo) + ' Puntos de Tienda.'
    : e === 'tope' ? (E.queda ? 'Esa cabeza está cerca del máximo: se le pueden poner ' + num(E.queda) + ' más.'
      : 'Esa cabeza ya vale lo máximo (' + num(T.tope) + ').')
    : e === 'vos' ? 'No te podés poner precio a vos.'
    : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva: vas a poder desde el ' +
      esc(fmtFecha(E.desde, { day: 'numeric', month: 'long' })) + '.'
    : e === 'cabeza' ? 'A esa persona no se le puede poner precio: tiene que jugar la temporada.'
    : e === 'monto' ? 'Desde ' + num(E.min) + ', de a ' + num(E.paso) + '.'
    : e === 'cerrada' ? 'La semana terminó: probá de nuevo en un rato.'
    : e === 'todavia' ? 'La tienda todavía no está lista: probá en un rato.'
    : 'No pude ponerlo. Probá de nuevo en un rato.');
}
/* los montos: el mínimo y sus múltiplos, apagados si no entran en la cabeza
   o en tu saldo (el Worker y el objeto lo vuelven a mirar igual) */
function montosPrecio(c, T) {
  var v = valorCabezas()[c] || 0, queda = T.tope - v, saldo = BILL && BILL.ok ? BILL.saldo : null;
  return '<div class="pr-montos">' + [1, 2, 5, 10].map(function (x) { return T.min * x; }).map(function (m) {
    var no = m > queda || (saldo != null && m > saldo);
    return '<button type="button" class="pr-m" data-precio="' + esc(c) + '" data-monto="' + m + '"' +
      (no ? ' disabled' : '') + '>+' + num(m) + '</button>';
  }).join('') + '</div>';
}
/* poner un precio a alguien: cuánto vale, los montos y cómo salió */
function panelPrecio(c, T) {
  var v = valorCabezas()[c] || 0, est = PR_EST[c] || {}, f = porK(kDe(c)), yoF = yoDiscord();
  var esYo = yoF && f && yoF.k === f.k;
  var msg = est.va ? 'Poniendo ' + num(est.va) + '&hellip;'
    : est.ok ? '&#10003; Pusiste <b>' + num(est.ok) + '</b>. Si nadie lo caza en la semana, vuelven a vos.'
    : est.error ? '<span class="enc-mal">' + errorPrecio(est) + '</span>'
    : DC ? 'Elegí cuánto ponerle.' : 'Para poner un precio entrás con Discord: tocá un monto.';
  return '<div class="pr-sel"><p>' + (f ? quienEs(f, 26) : esc(c)) + ' vale <span class="pt-i">' + num(v) +
    '</span>' + (v < T.tope ? ' &middot; se le pueden poner ' + num(T.tope - v) + ' más' : ' &middot; ya vale lo máximo') +
    '</p>' + (esYo ? '<p class="nota">Sos vos: no te podés poner precio.</p>' : montosPrecio(c, T)) +
    '<p class="enc-e" aria-live="polite">' + msg + '</p></div>';
}
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
/* los nombres de una publicación: cada uno abre su perfil, si está en la tabla */
function nombresMuro(ns) {
  return (ns || []).map(function (n) {
    var f = porK(kDe(n));
    return f ? '<button type="button" class="mu-q" data-k="' + esc(f.k) + '">' + esc(f.n) + '</button>'
      : '<b>' + conBanderas(n) + '</b>';
  }).join(' y ');
}
function pastillaRango(r) {
  var x = (D.rangos || []).filter(function (y) { return y.r === r; })[0];
  return '<span class="rg" style="color:' + esc((x && x.color) || '') + ';border-color:' +
    esc((x && x.color) || '#1A2523') + '">' + esc(r) + '</span>';
}
function itemMuro(x) {
  var q = nombresMuro(x.quien), n = (x.quien || []).length, ico = '', txt = '', mas = '';
  if (x.tipo === 'campeon') {
    ico = '&#127942;';
    txt = q + (n > 1 ? ' ganaron ' : ' ganó ') + '<b>' + esc(x.ev) + '</b>';
    mas = chipSv(x.sv) + (x.ll ? '<button type="button" class="mu-a" data-llave="' + esc(x.ll) + '">Ver la llave</button>' : '');
  } else if (x.tipo === 'rango') {
    ico = x.primero ? '&#127894;&#65039;' : '&#11014;&#65039;';
    txt = q + (x.primero ? ' ya tiene rango ' : ' subió a rango ') + pastillaRango(x.rg);
  } else if (x.tipo === 'tarjeta') {
    var f = porK(kDe((x.quien || [])[0]));
    ico = '&#127183;';
    txt = q + ' desbloqueó su tarjeta <b>' + esc(NOMBRE_CARTA[x.carta] || x.carta) + '</b>';
    mas = f ? '<button type="button" class="mu-a" data-carta="' + esc(f.k) + '">Ver sus tarjetas</button>' : '';
  } else if (x.tipo === 'caza') {
    ico = '&#127919;';
    txt = q + ' cazó a ' + nombresMuro([x.a]) + ' (' + esc(x.cat) + ') en ' + esc(x.ev) + ' y cobró <b>' +
      num(x.pts) + '</b>';
  } else if (x.tipo === 'sobrevivio') {
    ico = '&#128737;&#65039;';
    txt = q + ' sobrevivió al Most Wanted (' + esc(x.cat) + ') y se llevó <b>' + num(x.pts) + '</b>';
  } else if (x.tipo === 'precio') {
    ico = '&#128176;';
    txt = q + ' le ' + (n > 1 ? 'ganaron' : 'ganó') + ' a ' + nombresMuro([x.a]) + ' en ' + esc(x.ev) +
      ' y cobró el precio por su cabeza: <span class="pt-i">' + num(x.pts) + '</span>';
  } else if (x.tipo === 'premios') {
    ico = '&#129351;';
    txt = 'Premios de la semana: ' + [x.figura ? 'figura ' + nombresMuro([x.figura[0]]) : '',
      x.revelacion ? 'revelación ' + nombresMuro([x.revelacion[0]]) : '',
      x.cazador ? 'cazador ' + nombresMuro([x.cazador[0]]) : '',
      x.servidor ? 'servidor <b>' + esc(nombreSv(x.servidor[0])) + '</b>' : ''].filter(Boolean).join(' &middot; ');
  } else if (x.tipo === 'elegido') {
    ico = '&#128499;&#65039;';
    txt = 'La gente eligió a ' + q + ' como El Elegido del Most Wanted' + (x.de ? ' (' + x.votos + ' de ' +
      x.de + ' votos)' : '');
  } else if (x.tipo === 'anuncio') {
    ico = '&#128226;';
    // ⚠️ TODO ESCAPADO: es texto que escribió alguien en Discord
    var det = [x.mod ? esc(x.mod) : '', x.org ? 'organiza ' + orgHtml(x.org, 18) : '',
      x.pre ? '&#127941; ' + esc(x.pre) : ''].filter(Boolean);
    txt = '<b>' + esc(x.ev) + '</b>' + (det.length ? ' — ' + det.join(' &middot; ') : '');
    mas = chipSv(x.sv) + (x.link ? '<a class="mu-a" href="' + esc(x.link) + '" target="_blank" rel="noopener ' +
      'noreferrer">Ver en Discord &#8599;</a>' : '');
  } else if (x.tipo === 'liga') {
    ico = '&#128240;';
    txt = '<b>' + esc(x.tit) + '</b>' + (x.tx ? ' — ' + esc(x.tx) : '');
    mas = x.link ? '<a class="mu-a" href="' + esc(x.link) + '" target="_blank" rel="noopener noreferrer">Ver en ' +
      'Discord &#8599;</a>' : '';
  } else {
    return '';
  }
  return '<article class="mu" data-tipo="' + esc(x.tipo) + '"><span class="mu-i" aria-hidden="true">' + ico + '</span>' +
    '<div class="mu-c"><p>' + txt + '</p><small>' + esc(cuandoSe(x.t)) + '</small>' +
    (mas ? '<div class="mu-x">' + mas + '</div>' : '') + '</div></article>';
}
/* ★ ¿es de alguien que seguís? Con las claves que trae el muro (`ks`, de
   bot/muro.py), o por el nombre si es un muro de antes */
function deQuienSigo(x) {
  var ks = Array.isArray(x.ks) ? x.ks : x.ks ? Object.keys(x.ks).map(function (r) { return x.ks[r]; })
    : (x.quien || []).map(kDe);
  return ks.some(sigoA);
}
/* el filtro «A quien sigo» se ve sólo si seguís a alguien */
function pintaMuroFiltros() {
  var b = $('[data-mufil="sigo"]');
  if (!b) return;
  b.hidden = !SIGO.length;
  if (!SIGO.length && MURO_FIL === 'sigo') { MURO_FIL = ''; pintaMuro(); }
}
function pintaMuro() {
  var c = $('#muro');
  if (!c) return;
  pintaMuroFiltros();
  $$('[data-mufil]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mufil === MURO_FIL)); });
  if (MURO === null) { c.innerHTML = '<p class="nota">Cargando&hellip;</p>'; return; }
  var ls = MURO.filter(function (x) {
    if (MURO_FIL === 'sigo') return deQuienSigo(x);
    return !MURO_FIL || (MURO_FIL === 'anuncios') === !!MURO_ANUNCIO[x.tipo];
  });
  c.innerHTML = ls.length ? ls.slice(0, MURO_VER).map(itemMuro).join('')
    : MURO_FIL === 'sigo' ? '<p class="nota">Nada todavía de la gente que seguís: cuando ganen, suban de ' +
      'rango o desbloqueen una tarjeta, aparece acá.</p>'
      : '<p class="nota">Todavía no hay nada acá: lo que pase en la Liga va apareciendo solo.</p>';
  $('#muroMas').hidden = ls.length <= MURO_VER;
}
/* 🔑 LA BARRA DEL TELÉFONO SE DESLIZA (Dlx, 28/09/2026: «en celular haz que
   se deslice para ver más opciones»): el borde de la derecha se apaga para
   decir que hay más, y deja de apagarse al llegar al final. */
function bordeNav() {
  var n = $('#nav');
  if (n) n.classList.toggle('fin', n.scrollLeft + n.clientWidth >= n.scrollWidth - 2);
}
function pintaPrecios() {
  [pintaTienda, pintaPrecioPerfil, pintaPrecioInicio].forEach(function (f) {
    try { f(); } catch (e) { console.error('[' + f.name + ']', e); }
  });
}
function pintaTienda() {
  var T = D && D.tienda, b = $('#secBilletera'), p = $('#secPrecios');
  if (!b || !p) return;
  if (!T) { b.hidden = true; p.hidden = true; return; }
  $('#tiBaj').innerHTML = 'Tus Puntos de Tienda y el precio por cabeza. Todos arrancan con <b>' +
    num(T.inicial) + '</b>.';
  // 🪙 la billetera: sólo la ves vos, con tu Discord
  var cab = '<h2><span>&#129689;</span> Tus Puntos de Tienda</h2>';
  if (BILL && BILL.ok) {
    var ahora = Date.now();
    var act = (BILL.mios || []).filter(function (m) { return !m.estado && m.fin > ahora; });
    b.innerHTML = cab + '<div class="bill"><span class="pt">' + num(BILL.saldo) + '</span><small>Puntos de Tienda' +
      (BILL.cobrado ? ' &middot; cobraste <b>' + num(BILL.cobrado) + '</b> cazando' : '') + '</small></div>' +
      (act.length ? '<p class="nota">Tus precios de esta semana (vuelven si nadie caza):</p><div class="pr-mios">' +
        act.map(function (m) {
          return '<span>' + esc(nombreCabeza(m.cabeza)) + ' &middot; <span class="pt-i">' + num(m.monto) +
            '</span></span>';
        }).join('') + '</div>' : '');
  } else if (BILL && BILL.error) {
    b.innerHTML = cab + '<p class="enc-e"><span class="enc-mal">' + (errorCuenta(BILL.error) ||
      (BILL.error === 'todavia' ? 'La tienda todavía no está lista: probá en un rato.'
        : 'No pude leer tu billetera. Probá de nuevo.')) +
      '</span></p><button type="button" class="btn sec" data-billetera>Probar de nuevo</button>';
  } else {
    b.innerHTML = cab + '<p class="bajada">Todos arrancan con <b>' + num(T.inicial) + '</b>, y se ganan cazando: ' +
      'todo el precio por cabeza' + (T.mw ? ', y el <b>' + Math.round(T.mw * 100) + ' %</b> de lo que pagan los ' +
      'buscados del Most Wanted' : '') + '. Para ver los tuyos entrás con Discord: los ves sólo vos.</p>' +
      '<button type="button" class="btn" data-billetera>Ver mis Puntos de Tienda</button>';
  }
  b.hidden = false;
  // 💰 el precio por cabeza: arriba lo que vale cada una, abajo para poner
  if (p.dataset.listo !== '1') {
    p.dataset.listo = '1';
    p.innerHTML = '<h2><span>&#128176;</span> Precio por cabeza</h2><p class="bajada pr-cab"></p>' +
      '<div class="pr-lista pr-top"></div><div class="pr-poner"><input type="search" class="enc-busca pr-busca" ' +
      'placeholder="Buscá a quién ponerle precio" aria-label="Buscar un rapero para ponerle precio" value="' +
      esc(PR_BUSCA) + '"><div class="pr-lista pr-res"></div><div class="pr-panel"></div></div>' +
      '<div class="pr-cazas"></div>';
  }
  p.querySelector('.pr-cab').innerHTML = 'Poné Puntos de Tienda sobre un rapero de la temporada: el primero que ' +
    'le gana en un evento de la Liga se los lleva, <b>y lo mismo suma a su Temporada</b>. Si nadie lo caza hasta ' +
    'el ' + esc(fmtFecha(T.fin, { weekday: 'long' })) + ' a las ' + esc(fmtHora(T.fin)) + ' ' + etiquetaHora(T.fin) +
    ', vuelven a quien los puso. Una cabeza vale como mucho <b>' + num(T.tope) + '</b>, y nadie ve quién puso.';
  var v = valorCabezas();
  var top = Object.keys(v).filter(function (c) { return v[c] > 0; }).sort(function (x, y) { return v[y] - v[x]; });
  p.querySelector('.pr-top').innerHTML = top.length ? top.map(function (c) {
    return filaPrecio(c, v[c]);
  }).join('') : '<p class="nota">Esta semana todavía nadie tiene precio. Buscá a alguien y ponele el primero.</p>';
  pintaBuscaPrecio();
  p.querySelector('.pr-panel').innerHTML = PR_SEL ? panelPrecio(PR_SEL, T) : '';
  var cz = (T.cazas || []).slice().reverse();
  p.querySelector('.pr-cazas').innerHTML = cz.length ? '<h3 class="mw-h">Lo último que se cobró</h3>' +
    cz.map(function (x) {
      return '<p>&#128176; <b>' + esc(x.por.map(function (y) { return nombreCabeza(y[0]); }).join(' y ')) +
        '</b> le ganó a <b>' + esc(nombreCabeza(x.cabeza)) + '</b> en ' + esc(x.ev) + ' y cobró <span class="pt-i">' +
        num(x.monto) + '</span>.</p>';
    }).join('') : '';
  p.hidden = false;
}
function filaPrecio(c, valor) {
  var f = porK(kDe(c));
  return '<button type="button" class="pr-c' + (PR_SEL === c ? ' on' : '') + '" data-pr-sel="' + esc(c) + '">' +
    (f ? quienEs(f, 26) : '<span class="quien">' + esc(c) + '</span>') +
    (valor != null ? '<span class="pt-i">' + num(valor) + '</span>' : '<small>ponerle precio</small>') + '</button>';
}
function pintaBuscaPrecio() {
  var r = $('#secPrecios .pr-res');
  if (!r) return;
  var q = sinTildes(PR_BUSCA).trim(), v = valorCabezas();
  var fs = q ? (D.tabla || []).filter(function (f) { return !f.fc && sinTildes(f.n).indexOf(q) >= 0; }).slice(0, 8) : [];
  r.innerHTML = q ? (fs.length ? fs.map(function (f) { return filaPrecio(f.n, v[f.n] || null); }).join('')
    : '<p class="nota">No hay nadie con ese nombre en la temporada.</p>') : '';
}
/* en el perfil: cuánto vale su cabeza y los montos para ponerle */
function pintaPrecioPerfil() {
  var s = $('#pfPrecioSec'), c = $('#pfPrecio'), T = D && D.tienda;
  if (!s || !c) return;
  if (!T || !PR_PERFIL || !puedeCabeza(PR_PERFIL)) { s.hidden = true; return; }
  c.innerHTML = '<p class="bajada">El primero que le gane en un evento de la Liga se lleva lo que vale, en ' +
    'Puntos de Tienda y en su Temporada. <a href="#/tienda">Cómo funciona &#8250;</a></p>' + panelPrecio(PR_PERFIL, T);
  s.hidden = false;
}
/* en el Inicio, abajo de El Elegido: las cabezas que más valen */
function pintaPrecioInicio() {
  var c = $('#prInicio'), T = D && D.tienda;
  if (!c) return;
  if (!T) { c.hidden = true; return; }
  var v = valorCabezas();
  var top = Object.keys(v).filter(function (x) { return v[x] > 0; }).sort(function (x, y) { return v[y] - v[x]; })
    .slice(0, 3);
  c.innerHTML = '<h4>&#128176; Precio por cabeza</h4><p class="enc-b">' + (top.length ? 'Lo pone la gente: ' +
    top.map(function (x) {
      var f = porK(kDe(x));
      return (f ? '<button type="button" class="ql" data-k="' + esc(f.k) + '">' + esc(f.n) + '</button>' : esc(x)) +
        ' <span class="pt-i">' + num(v[x]) + '</span>';
    }).join(' &middot; ') + '. Quien le gane, cobra.' : 'Poné Puntos de Tienda sobre un rapero: quien le gane, ' +
    'cobra.') + ' <a href="#/tienda">Ir a la Tienda &#8250;</a></p>';
  c.hidden = false;
}
function pintaPaneles() {
  var pags = $$('#secPaneles .pn-pag');
  if (!pags.length) return;
  PN.pag = Math.max(0, Math.min(PN.pag, pags.length - 1));
  pags.forEach(function (p, i) { p.hidden = i !== PN.pag; });
  $('#pnTit').innerHTML = pags[PN.pag].dataset.tit || '';
  $('#pnDots').innerHTML = pags.map(function (p, i) {
    return '<button type="button" class="pn-dot' + (i === PN.pag ? ' on' : '') + '" data-pn="' + i +
      '" aria-label="Página ' + (i + 1) + '"></button>';
  }).join('');
  $('#pnAntes').disabled = PN.pag === 0;
  $('#pnDespues').disabled = PN.pag === pags.length - 1;
  pintaYoPanel();
}
function pintaYoPanel() {
  var f = yo(), c = $('#pnYo'), e = $('#pnEv');
  if (!c || !e) return;
  if (!f && DC && DC.rapero) {
    // ⚠️ CON TARJETA Y SIN EVENTOS: ver `pintaPopCuenta()`
    var n = (DC.cs || []).length + (DC.bl || []).length;
    c.innerHTML = '<div class="teaser yo lleno">' + avatar({ n: DC.n, av: DC.av }, 56) +
      '<h3>' + esc(DC.rapero) + '</h3><p class="yo-pos">Todavía sin eventos esta temporada</p>' +
      '<p class="yo-falta">Con tu primer evento entrás al ranking' +
      (reqDe('temporada') ? ' y se desbloquea tu Temporada' : '') + '.</p>' +
      (DC.clave && n ? '<button type="button" class="btn" data-carta="' + esc(DC.clave) +
        '">&#127183; Ver mis tarjetas</button>' : '') + '</div>';
  } else if (!f) {
    c.innerHTML = '<div class="teaser yo"><span class="tz-ico" aria-hidden="true">&#128100;</span>' +
      '<h3>¿Quién sos?</h3><p>Elegí tu nombre y acá ves tu puesto, tu racha y lo que te falta.</p>' +
      '<button type="button" class="btn" data-abrir-cuenta>Elegir quién soy</button></div>';
  } else {
    var pide = reqDe('competitivo') || 10, r = f.rch || [0, 0];
    var falta = Math.max(0, pide - (f.ev || 0));
    c.innerHTML = '<div class="teaser yo lleno" data-k="' + esc(f.k) + '">' + avatar(f, 56) +
      '<h3>' + esc(f.n) + '</h3><p class="yo-pos">' + textoPos(f) + '</p>' +
      '<dl class="yo-n"><div><dt>OVR</dt><dd class="ovr">' + (f.ovr || '—') + '</dd></div>' +
      '<div><dt>Puntos</dt><dd>' + num(f.pts) + '</dd></div>' +
      '<div><dt>Racha</dt><dd>' + (r[0] ? '&#128293;' + r[0] : '0') + '<s>/' + r[1] + '</s></dd></div></dl>' +
      '<p class="yo-falta">' + (f.rg ? 'Rango <b>' + esc(f.rg) + '</b>'
        : falta ? 'Te ' + (falta === 1 ? 'falta <b>1 evento</b>' : 'faltan <b>' + falta + ' eventos</b>') +
          ' para la Competitiva' : 'Ya tenés los eventos de la Competitiva') + '</p></div>';
  }
  var ahora = Date.now();
  var prox = (D.calendario || []).filter(function (x) { return Date.parse(x.t) > ahora; })[0];
  var ult = jugadas()[0];
  if (prox) {
    e.innerHTML = '<div class="teaser ev" style="--c:' + esc(colorSv(prox.sv)) + '">' +
      '<span class="evc-et">Próximo evento</span><h3>' + esc(prox.n) + '</h3>' + chipSv(prox.sv) +
      '<p>' + esc(fmtFecha(prox.t, { weekday: 'long' })) + ' &middot; ' + esc(fmtHora(prox.t)) + ' ' +
      etiquetaHora(prox.t) + '</p><span class="reloj" data-t="' + esc(prox.t.replace(/Z$/, '')) +
      '">&middot;</span><a class="btn sec" href="#/eventos">Ver el calendario</a></div>';
    pintaRelojes();
  } else if (ult) {
    var L = D.llaves[ult.ll];
    var camp = (L.tabla || []).filter(function (r) { return r[1] === 'Campeón'; });
    e.innerHTML = '<div class="teaser ev" style="--c:' + esc(colorSv(ult.sv)) + '">' +
      '<span class="evc-et">El último campeón</span><h3>' + (camp.length ? camp.map(function (r) {
        var g = porK(kDe(r[0]));
        return g ? quienEs(g, 26) : conBanderas(r[0]);
      }).join('<i class="coma">,</i> ') : '—') + '</h3>' + chipSv(ult.sv) + '<p>' + esc(ult.n) + ' &middot; ' +
      esc(cuandoSe(ult.t)) + '</p><button type="button" class="btn sec" data-llave="' + esc(ult.ll) +
      '">&#127942; Ver la llave</button></div>';
  } else {
    e.innerHTML = '';
  }
}

/* ── la guía, con los números de verdad ──────────────────────────────
   🔑 Dlx, 25/09/2026: «agregar más cosas a GUÍA». La tabla de puntos sale
   de `Config` y los pesos de `sheet/ovr.py` y `sheet/competitivo.py` (ver
   `_guia()` en bot/subir_web.py): escritos acá se quedarían viejos el día
   que cambie uno. */
function pintaGuia() {
  var G = D.guia || {}, P = G.puntos;
  if (!P || !P.tablas) apaga('#secPuntos');
  else {
    var escs = ['16+', '8-15', '4-7'].filter(function (e) { return (P.tablas[e] || []).length; });
    var orden = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos',
      'Dieciseisavos'];
    var vale = function (e, p) {
      var r = P.tablas[e].filter(function (x) { return x[0] === p; })[0];
      return r ? r[1] : null;
    };
    var nom = { '16+': '16 o más', '8-15': '8 a 15', '4-7': '4 a 7' };
    var wk = P.walkin || [];
    $('#puntos').innerHTML = '<div class="tabla-caja"><table class="escala"><thead><tr>' +
      '<th class="c-izq">Puesto</th>' + escs.map(function (e) {
        return '<th>' + nom[e] + '<small>raperos</small></th>';
      }).join('') + '</tr></thead><tbody>' + orden.filter(function (p) {
        return escs.some(function (e) { return vale(e, p) != null; });
      }).map(function (p) {
        return '<tr><td class="c-izq">' + (MEDALLA[p] ? MEDALLA[p] + ' ' : '') + esc(p) +
          (p === 'Semifinal' ? '<small>cuando no se juega el tercer puesto</small>' : '') + '</td>' +
          escs.map(function (e) {
            var v = vale(e, p);
            return '<td>' + (v == null ? nada : num(v)) + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<ul class="guia-notas"><li><b>Por equipos</b>: los puntos del puesto se reparten ' +
      'entre los integrantes.</li>' +
      (wk.length ? '<li><b>Walk-in</b>: quien entra salteando rondas cobra ' + wk.map(function (w, i) {
        return w[1] + '&nbsp;% con ' + w[0] + (i === wk.length - 1 ? ' o más' : '') +
          (w[0] === 1 ? ' ronda' : ' rondas');
      }).join(', ') + '.</li>' : '') +
      (P.revivido != null ? '<li><b>Revivido</b>: su primer puesto entero y el ' + P.revivido +
        '&nbsp;% del puesto final.</li>' : '') + '</ul>';
  }
  if (!(G.ovr || []).length && !(G.score || []).length) { apaga('#secNumeros'); return; }
  var barra = function (n, w, max, sub) {
    return '<div class="gp"><span>' + n + (sub ? '<small>' + sub + '</small>' : '') + '</span>' +
      '<i><u style="width:' + Math.round(100 * w / max) + '%"></u></i><b>' + w + '&nbsp;%</b></div>';
  };
  var mx = function (xs, j) { return Math.max.apply(null, xs.map(function (x) { return x[j]; })); };
  $('#numeros').innerHTML =
    ((G.ovr || []).length ? '<h3 class="gh">El OVR <small>de 40 a 99 · ordena la temporada</small></h3>' +
      G.ovr.map(function (x) { return barra(esc(x[0]), x[1], mx(G.ovr, 1)); }).join('') +
      '<p class="nota">Cada parte se compara con la mejor de la temporada.</p>' : '') +
    ((G.score || []).length ? '<h3 class="gh">El Score <small>de 0 a 100 · da el rango</small></h3>' +
      G.score.map(function (x) { return barra(esc(x[0]) + ' ' + esc(x[1]), x[3], mx(G.score, 3), esc(x[2])); }).join('') +
      ((G.conf || []).length ? '<p class="nota">Y se multiplica por la <b>confianza</b>, que premia ' +
        'jugar más: ' + G.conf.map(function (c, i) {
          return c[1] + '&nbsp;% ' + (i === G.conf.length - 1 ? 'desde ' : 'con ') + c[0] +
            (c[0] === 1 ? ' evento' : ' eventos');
        }).join(', ') + '.</p>' : '') : '');
}

/* ── mi cuenta ────────────────────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «arriba en la esquina derecha superior mi cuenta (mi
   perfil y cosas más)». No hay login: quien mira elige quién es y este
   dispositivo lo recuerda. No sale de acá. */
var YO = leerLS('lg:yo', '');
function yo() { return YO ? porK(YO) : null; }

/* ── seguir raperos ───────────────────────────────────────────────────
   🔑 Dlx, 25/09/2026, a las ideas de Mi cuenta: «todas». Se ve en tres
   lugares: el botón del perfil, la lista de Mi cuenta y una ★ al lado de su
   nombre en toda la página.
   🔑 Y DESDE EL 28/09/2026, GUARDADO DE VERDAD (Dlx: «sí, hay que hacer
   eso»). Con «Entrar con Discord», a quién seguís vive en el servidor
   (`seguir()` en bot/avisos.js): se ve en todos tus dispositivos, cuenta
   como seguidor y te llega un aviso por la campana —nunca por DM— cuando esa
   persona gana, sube de rango o desbloquea una tarjeta. Sin entrar, sigue
   siendo de este dispositivo, como antes.
   ⚠️ LO DE ESTE DISPOSITIVO SUBE UNA SOLA VEZ (`lg:sigo_srv`): después manda
   el servidor. Si subiera siempre, lo que dejaste de seguir en el teléfono
   volvería desde la compu. */
var SIGO_TOPE = 200;
var SIGO = leerLS('lg:sigo', []);
if (!Array.isArray(SIGO)) SIGO = [];
var SIGO_SRV = leerLS('lg:sigo_srv', false) === true;
var SIGO_EST = {}, ME_SIGUEN = null, SEGUIDORES = null, SEGUIDORES_T = 0;
function sigoA(k) { return !!k && SIGO.indexOf(k) >= 0; }
function guardarSigo(lista) {
  SIGO = (lista || []).slice(0, SIGO_TOPE);
  guardarLS('lg:sigo', SIGO.length ? SIGO : null);
}
function marcarSigoSrv(si) {
  SIGO_SRV = si;
  guardarLS('lg:sigo_srv', si || null);
}
/* lo que cambia en la página cuando cambia a quién seguís */
function repintarSigo(k) {
  $$('[data-segw]').forEach(function (b) {
    if (!k || b.dataset.segw === k) b.outerHTML = botonSigo(b.dataset.segw);
  });
  if (k) pintaSeguidores(k);
  var pop = $('#popCuenta');
  if (pop && !pop.hidden) pintaPopCuenta();
  try { pintaMuroFiltros(); } catch (e) { console.error('[pintaMuroFiltros]', e); }
}
function alternarSigo(k) {
  var i = SIGO.indexOf(k), si = i < 0, antes = SIGO.slice();
  if (i >= 0) SIGO.splice(i, 1); else SIGO.unshift(k);
  guardarSigo(SIGO);
  if (!DC) return;
  // ⚠️ SI HAY QUE VOLVER A ENTRAR (la sesión venció), lo de este dispositivo
  // sube a la vuelta: por eso se marca antes de pedir
  marcarSigoSrv(false);
  SIGO_EST[k] = { va: true };
  conCuenta('/api/avisos/seguir', { a: k, si: si }, 's').then(function (j) {
    if (!j) return;
    SIGO_EST[k] = {};
    if (j.status === 200 && Array.isArray(j.sigo)) {
      guardarSigo(j.sigo);
      marcarSigoSrv(true);
      if (j.n && SEGUIDORES) SEGUIDORES[k] = j.n[k] || 0;
    } else {
      guardarSigo(antes);
      SIGO_EST[k] = { error: j.error === 'tope' ? 'Ya seguís a ' + SIGO_TOPE + ': dejá de seguir a alguien primero.'
        : errorCuenta(j.error) || 'No pude guardarlo. Probá de nuevo en un rato.' };
    }
    repintarSigo(k);
  }).catch(function () {
    guardarSigo(antes);
    SIGO_EST[k] = { error: 'Sin conexión: probá de nuevo.' };
    repintarSigo(k);
  });
}
/* 🔑 A QUIÉN SEGUÍS, DEL SERVIDOR: al abrir la página con Discord y al
   entrar. La primera vez sube lo que este dispositivo ya seguía. */
function pedirSigo() {
  if (!DC) return;
  pedirConCuenta('/api/avisos/sigo', {}, false).then(function (j) {
    if (!j || j.status !== 200 || !Array.isArray(j.sigo)) return;
    var subir = SIGO_SRV ? [] : SIGO.filter(function (k) { return j.sigo.indexOf(k) < 0; }).slice(0, 60);
    ME_SIGUEN = j.me_siguen || null;
    guardarSigo(j.sigo.concat(subir));
    if (!subir.length) { marcarSigoSrv(true); repintarSigo(); return; }
    pedirConCuenta('/api/avisos/seguir', { a: subir, si: true }, false).then(function (k) {
      if (k && Array.isArray(k.sigo)) guardarSigo(k.sigo);
      if (k && (k.status === 200 || k.status === 409)) marcarSigoSrv(true);
      repintarSigo();
    }).catch(function () { /* se sube la próxima vez */ });
  }).catch(function () { /* sin red, queda lo de este dispositivo */ });
}
/* cuántos siguen a cada uno: lo público, una vez cada cinco minutos */
function pedirSeguidores() {
  if (SEGUIDORES && Date.now() - SEGUIDORES_T < 5 * 60000) return Promise.resolve(SEGUIDORES);
  return fetch('/api/avisos/seguidores', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (j && j.n) { SEGUIDORES = j.n; SEGUIDORES_T = Date.now(); }
      return SEGUIDORES;
    })
    .catch(function () { return SEGUIDORES; });
}
function pintaSeguidores(k) {
  var c = $('#pfSeg');
  if (!c || c.dataset.k !== k) return;
  var n = (SEGUIDORES || {})[k] || 0;
  c.hidden = !n;
  c.innerHTML = n ? '<b>' + num(n) + '</b> ' + (n === 1 ? 'seguidor' : 'seguidores') : '';
}
/* el botón va con su aviso de error en una caja: se reemplazan juntos */
function botonSigo(k) {
  var si = sigoA(k), est = SIGO_EST[k] || {};
  return '<span class="seg-w" data-segw="' + esc(k) + '"><button type="button" class="btn sec seguir' +
    (si ? ' on' : '') + '" data-seguir="' + esc(k) + '" aria-pressed="' + si + '"' + (est.va ? ' disabled' : '') + '>' +
    (si ? '&#9733; Siguiendo' : '&#9734; Seguir') + '</button>' +
    (est.error ? '<span class="seg-e" role="status">' + est.error + '</span>' : '') + '</span>';
}
/* lo que va en Mi cuenta: a quién seguís, con su puesto de hoy, y quién te sigue */
function secSigo() {
  var fs = SIGO.map(function (k) { return porK(k); }).filter(Boolean);
  var ms = ME_SIGUEN && ME_SIGUEN.n ? ME_SIGUEN : null;
  var suyos = ms ? (ms.perfiles || []).map(function (k) { return porK(k); }).filter(Boolean) : [];
  var out = '';
  if (fs.length) {
    out += '<section class="pop-sec"><h4>&#9733; Siguiendo <small>' + fs.length + '</small></h4>' +
      '<div class="pop-sigo">' + fs.slice(0, 6).map(function (f) {
        return '<a href="#/r/' + encodeURIComponent(f.k) + '">' + avatar(f, 26) + '<span class="ps-n">' +
          esc(f.n) + '</span><span class="ps-d">' + (f.pos && f.pos !== '—' ? '#' + esc(f.pos) : '—') +
          ' &middot; OVR ' + (f.ovr || '—') + '</span></a>';
      }).join('') + '</div>' + (fs.length > 6 ? '<p class="nota">y ' + (fs.length - 6) +
        ' más: tienen la &#9733; en el ranking.</p>' : '') +
      // sin Discord no hay aviso: el servidor no sabe a quién seguís
      (DC ? '<p class="nota">Te llega un aviso cuando ganan, suben de rango o desbloquean una tarjeta ' +
        '(<a href="#/avisos">activá los avisos</a> en este dispositivo).</p>'
        : '<p class="nota">Entrá con Discord y te avisamos cuando ganen o suban de rango.</p>') + '</section>';
  }
  if (ms) {
    var otros = ms.n - suyos.length;
    out += '<section class="pop-sec"><h4>&#128101; Te siguen <small>' + num(ms.n) + '</small></h4>' +
      (suyos.length ? '<div class="pop-sigo">' + suyos.slice(0, 6).map(function (f) {
        return '<a href="#/r/' + encodeURIComponent(f.k) + '">' + avatar(f, 26) + '<span class="ps-n">' +
          esc(f.n) + '</span></a>';
      }).join('') + '</div>' : '') +
      (otros > 0 || suyos.length > 6 ? '<p class="nota">' + (suyos.length > 6 ? 'y ' + (suyos.length - 6) +
        ' raperos más' + (otros > 0 ? ', y ' : '') : '') + (otros > 0 ? num(otros) + (otros === 1 ? ' persona' : ' personas') +
        ' que no compiten' : '') + '.</p>' : '') + '</section>';
  }
  return out;
}
/* ── «tu servidor» ─────────────────────────────────────────────────────
   🔑 Dlx, 28/09/2026: «La idea es q la gente decida por su cuenta», y
   «1. A 2. A 3. B y C»: se elige en Mi cuenta (con Discord), uno por
   temporada como la foto —libre hasta el 9 de octubre—, y no frena ningún
   voto. Se ve en tu perfil, en lugar del servidor donde más jugaste.
   ⚠️ LA TARJETA DE SERVIDOR NO CAMBIA: mide los datos del servidor donde
   jugaste, y uno elegido donde no jugaste la dejaría en cero. */
var ELEGIDOS = null, ELEGIDOS_T = 0, MISV = null, MISV_EST = {}, MISV_PIDE = false;
function pedirElegidos() {
  if (ELEGIDOS && Date.now() - ELEGIDOS_T < 5 * 60000) return Promise.resolve(ELEGIDOS);
  return fetch('/api/avisos/servidores', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (j && j.n) { ELEGIDOS = j.n; ELEGIDOS_T = Date.now(); }
      return ELEGIDOS;
    })
    .catch(function () { return ELEGIDOS; });
}
/* el que eligió, si es un servidor de la Liga; si no, '' */
function svElegido(k) {
  var s = (ELEGIDOS || {})[k];
  return s && ((D && D.svs) || []).some(function (x) { return x.sv === s; }) ? s : '';
}
/* lo que va en la cabecera del perfil: el elegido, o donde más jugó */
function svPerfil(k, f) {
  var el = svElegido(k), sv = el || f.sv;
  if (!sv) return '';
  return (f.cc ? ' <i class="sep">·</i> ' : '') + '<span title="' +
    esc(el ? 'Eligió ' + nombreSv(el) + ' como su servidor' : 'Donde más jugó esta temporada') + '">' +
    chipSv(sv) + '</span>';
}
/* lo tuyo: cuál elegiste y si todavía se puede cambiar */
function pedirMiServidor() {
  if (!DC || MISV || MISV_PIDE) return;
  MISV_PIDE = true;
  pedirConCuenta('/api/avisos/mi-servidor', {}, false).then(function (j) {
    MISV_PIDE = false;
    MISV = j && j.status === 200 ? j : { error: (j && j.error) || 'red' };
    repintarMiServidor();
  }).catch(function () { MISV_PIDE = false; MISV = { error: 'red' }; repintarMiServidor(); });
}
function repintarMiServidor() {
  var pop = $('#popCuenta');
  if (pop && !pop.hidden) pintaPopCuenta();
}
function elegirMiServidor(sv) {
  MISV_EST = { va: sv };
  repintarMiServidor();
  conCuenta('/api/avisos/mi-servidor', { sv: sv }, 's').then(function (j) {
    if (!j) return;
    if (j.status === 200) {
      MISV = j;
      MISV_EST = { ok: true };
      if (DC && DC.clave) { ELEGIDOS = ELEGIDOS || {}; ELEGIDOS[DC.clave] = j.sv; }
    } else if (j.status === 409) {
      MISV = Object.assign({}, MISV || {}, { sv: j.sv, fijo: true, puede: false, libre: false });
      MISV_EST = { error: 'Ya lo elegiste esta temporada: se vuelve a abrir en la que viene.' };
    } else {
      MISV_EST = { error: errorCuenta(j.error) || 'No pude guardarlo. Probá de nuevo en un rato.' };
    }
    repintarMiServidor();
  }).catch(function () { MISV_EST = { error: 'Sin conexión: probá de nuevo.' }; repintarMiServidor(); });
}
function secMiServidor() {
  var svs = (D && D.svs) || [];
  if (!DC || !svs.length) return '';
  pedirMiServidor();
  var M = MISV || {}, est = MISV_EST;
  var hasta = M.libre_hasta ? fmtFecha(new Date(M.libre_hasta - 60000).toISOString(),
    { day: 'numeric', month: 'long' }) : '';
  var nota = !MISV ? 'Cargando&hellip;'
    : est.error ? '<span class="enc-mal">' + est.error + '</span>'
    : M.error ? '<span class="enc-mal">' + (errorCuenta(M.error) || 'No pude leerlo. Probá en un rato.') + '</span>'
    : est.va ? 'Guardando&hellip;'
    : M.libre ? 'Cambialo cuantas veces quieras hasta el ' + esc(hasta) + '; después, uno por temporada.'
    : M.puede ? (M.sv ? 'Podés cambiarlo una vez en esta temporada.' : 'Se elige una vez por temporada.')
    : 'Ya lo elegiste esta temporada: se vuelve a abrir en la que viene.';
  return '<section class="pop-sec"><h4>&#127968; Tu servidor' + (M.sv ? ' <small>' + esc(nombreSv(M.sv)) +
    '</small>' : '') + '</h4><p class="nota">El que representás en la Liga: sale en tu perfil. Tu tarjeta de ' +
    'Servidor sigue siendo la de donde jugás.</p><div class="ms-svs">' + svs.map(function (s) {
      var on = M.sv === s.sv, pide = est.pide === s.sv;
      return '<button type="button" class="ms-sv' + (on ? ' on' : '') + (pide ? ' pide' : '') + '" data-misv="' +
        esc(s.sv) + '" style="--c:' + esc(colorSv(s.sv)) + '" aria-pressed="' + on + '"' +
        ((MISV && !M.error && !M.puede && !on) || est.va ? ' disabled' : '') + '>' + logoSv(s.sv, 24) +
        '<span>' + esc(s.nombre || s.sv) + '</span></button>';
    }).join('') + '</div>' +
    // pasada la ventana libre, elegir es para toda la temporada: se confirma
    (est.pide ? '<p class="ms-ok"><button type="button" class="btn" data-misv-ok="' + esc(est.pide) + '">Elegir ' +
      esc(nombreSv(est.pide)) + '</button><span>Queda hasta la temporada que viene.</span></p>' : '') +
    '<p class="nota" role="status">' + nota + '</p></section>';
}

/* 🔑 TUS PRÓXIMOS EVENTOS: los anunciados en los servidores donde estás
   (lo sabe `/api/cuenta`); sin eso, los de toda la Liga. El link es el
   anuncio, que es donde cada servidor dice cómo anotarse. */
function secProximos() {
  var ahora = Date.now();
  var fut = (D.calendario || []).filter(function (c) { return Date.parse(c.t) > ahora; });
  var svs = (DC && DC.svs && DC.svs.length ? DC.svs : (yo() && yo().sv ? [yo().sv] : []));
  var mios = svs.length ? fut.filter(function (c) { return svs.indexOf(c.sv) >= 0; }) : fut;
  var titulo = svs.length ? '&#128197; Tus próximos eventos' : '&#128197; Próximos eventos';
  if (!mios.length) {
    return '<section class="pop-sec"><h4>' + titulo + '</h4><p class="nota">' +
      (svs.length ? 'Ninguno anunciado en tus servidores' + (fut.length ? ' (hay ' + fut.length +
        ' en otros)' : '') : 'No hay eventos anunciados') + '. <a href="#/avisos">Activá los avisos</a> y ' +
      'te llega uno al celular cuando salga.</p></section>';
  }
  return '<section class="pop-sec"><h4>' + titulo + '</h4><div class="pop-ev">' +
    mios.slice(0, 3).map(function (c) {
      return '<div class="pv" style="--c:' + esc(colorSv(c.sv)) + '"><b>' + esc(c.n) + '</b><small>' +
        esc(nombreSv(c.sv)) + ' &middot; ' + esc(fmtFecha(c.t, { weekday: 'short' })) + ' ' +
        esc(fmtHora(c.t)) + '</small><span class="pv-acc">' +
        (c.link ? '<a href="' + esc(c.link) + '" target="_blank" rel="noopener noreferrer">Anuncio' +
          ' e inscripción &#8599;</a>' : '') +
        '<a href="' + esc(googleEv(c)) + '" target="_blank" rel="noopener noreferrer">+ Calendario</a>' +
        '</span></div>';
    }).join('') + '</div></section>';
}

/* 🔑 ENTRAR CON DISCORD. Dlx, 25/09/2026: «creo que sería mejor meter el
   login de Discord». Discord devuelve a la página con un permiso que sólo
   lee la identidad; el Worker le pregunta a Discord de quién es
   (`/api/cuenta`) y el permiso se tira. `DC_APP` es el ID público de la app
   (va en cualquier link de OAuth); no es un secreto.

   ⚠️ LA DIRECCIÓN DE VUELTA TIENE QUE ESTAR REGISTRADA en el portal de
   Discord (OAuth2 → Redirects): `https://underlegends.pages.dev/`. Sin eso,
   Discord contesta «invalid redirect_uri» y no pasa nada más. */
var DC_APP = '1550026808404217926';
var DC = leerLS('lg:dc', null);
/* 🔑 «MIS REDES» PIDE OTRO PERMISO: `connections`, sólo cuando la persona lo
   toca. Entrar sigue pidiendo sólo `identify`. El permiso de redes queda en
   memoria mientras la página está abierta —para poder guardar— y nunca en
   el dispositivo. */
var DC_TOKEN = null, REDES_MIAS = null;
function urlLogin(modo) {
  // 'r' las redes (pide `connections`), 'v' vincular los avisos, 'f' la
  // foto, 'e' votar en una encuesta, 't' la tienda (poner un precio o ver la
  // billetera), 'd' verificarse (pide `guilds.join`: el bot te mete en DRA),
  // o entrar
  var conRedes = modo === true || modo === 'r';
  var st = (conRedes ? 'r' : modo === 'v' || modo === 'f' || modo === 'e' || modo === 't' || modo === 'd' ? modo : 'i') +
    Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { sessionStorage.setItem('lg:estado', st); } catch (e) { /* sin sesión: igual anda */ }
  return 'https://discord.com/oauth2/authorize?client_id=' + DC_APP + '&response_type=token' +
    '&redirect_uri=' + encodeURIComponent(location.origin + '/') +
    '&scope=' + encodeURIComponent(conRedes ? 'identify connections' : modo === 'd' ? 'identify guilds.join' : 'identify') +
    '&prompt=' + (conRedes ? 'consent' : 'none') + '&state=' + encodeURIComponent(st);
}
/* 🔑 «SALIR» CIERRA LA SESIÓN: el Worker la borra y le saca la cookie al
   navegador. Y lo que se sabía de la billetera se olvida acá. */
/* 🔑 VERIFICARSE DESDE LA PÁGINA. Dlx, 01/10/2026: «haz que la gente se
   verifique por la página web… y que te entres a DRA automáticamente». Con
   el permiso de «unirse a servidores» el Worker te mete en DRA y, si elegís
   tu país, te pone ese rol allá (`cuentaVerificar()` en bot/worker.js). Lo
   que contesta queda en `VERIF` y la página nueva se entera por `lg:verif`.
   ⚠️ Un error NO manda solo a Discord: se muestra con su botón. Un permiso
   que vuelve mal y reenvía solo es un bucle (pasó con los votos, 28/09). */
var VERIF = null;
function avisarVerif() {
  try { window.dispatchEvent(new Event('lg:verif')); } catch (e) { /* navegador viejo */ }
}
function verificarme(pais) {
  if (!DC_TOKEN) {
    // sin el permiso en memoria (se recargó la página): a Discord, que con el
    // permiso ya dado vuelve de rebote, y el país elegido espera acá
    try {
      if (pais) sessionStorage.setItem('lg:verif-pais', String(pais));
      else sessionStorage.removeItem('lg:verif-pais');
    } catch (e) { /* sin sesión: se elige de nuevo al volver */ }
    location.href = urlLogin('d');
    return Promise.resolve(null);
  }
  VERIF = Object.assign({}, VERIF && !VERIF.error ? VERIF : {}, { cargando: true });
  avisarVerif();
  return fetch('/api/cuenta/verificar', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(pais ? { token: DC_TOKEN, pais: String(pais) } : { token: DC_TOKEN }) })
    .then(function (r) {
      return r.json().catch(function () { return { error: 'red' }; })
        .then(function (j) { j = j || {}; j.estadoHttp = r.status; return j; });
    })
    .then(function (j) {
      // un permiso vencido se olvida: el botón de reintentar va a buscar otro
      if (j.error === 'discord' || j.error === 'token' || j.error === 'permiso') DC_TOKEN = null;
      VERIF = j;
      avisarVerif();
      return j;
    })
    .catch(function () { VERIF = { error: 'red' }; avisarVerif(); return VERIF; });
}
function cerrarSesion() {
  DC_TOKEN = null;
  BILL = null;
  VERIF = null;
  fetch('/api/cuenta/salir', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    .catch(function () { /* se cierra sola a los 30 días */ });
}
/* ⚠️ «SALIR» SUELTA TAMBIÉN LOS AVISOS DE ESTE DISPOSITIVO. En uno compartido,
   el que entraba después seguía recibiendo los avisos del anterior (revisión
   del 25/09/2026). */
function desvincularAvisos() {
  if (!leerLS('campana:yo', null)) return;
  guardarLS('campana:yo', null);
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then(function (reg) { return reg.pushManager.getSubscription(); })
    .then(function (sub) {
      if (sub) {
        fetch('/api/avisos/desvincular', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }) });
      }
    })
    .catch(function () { /* se suelta la próxima vez */ });
}
/* 🔑 LOS AVISOS DE CADA UNO: con el permiso recién traído de Discord, este
   dispositivo queda anotado como de esta persona. El ID lo pone Discord, no
   la página: ver `rutaAvisos()` en bot/avisos.js. La campana se entera por
   un evento y se repinta. */
function vincularAvisos(token) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then(function (reg) { return reg.pushManager.getSubscription(); })
    .then(function (sub) {
      if (!sub) throw new Error('sin avisos');
      return fetch('/api/avisos/vincular', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, token: token }) });
    })
    .then(function (r) {
      if (!r.ok) throw new Error('no');
      guardarLS('campana:yo', { id: DC ? DC.id : '', n: DC ? (DC.rapero || DC.n) : '' });
      window.dispatchEvent(new Event('lg:vinculado'));
    })
    .catch(function () { window.dispatchEvent(new Event('lg:vinculado-no')); });
}
/* 🔑 LA FOTO DESDE LA PÁGINA: lo mismo que `/foto`, con su regla (una por
   temporada; libre antes de que arranque; el pase de DRA la saltea). Primero
   se muestra qué foto quedaría; se guarda recién con «Usar esta foto». */
var FOTO = null;
function pedirFoto(confirmar) {
  return fetch('/api/cuenta/foto', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: DC_TOKEN, confirmar: !!confirmar }) })
    .then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }); });
}
/* 🔑 Dlx, 25/09/2026: «cambios ilimitados hasta el 9». La fecha viene del Worker. */
function libreTexto(F) {
  return F.libre_hasta ? 'Hasta el <b>' + esc(F.libre_hasta) + '</b> la podés cambiar las veces que quieras.'
    : 'Hasta que arranque la temporada la podés cambiar las veces que quieras.';
}
function secFoto() {
  if (!FOTO || !DC) return '';
  var F = FOTO, cab = '<section class="pop-sec" id="secFoto"><h4>&#128247; Tu foto de la tarjeta</h4>';
  var T = esc(F.temporada || 'temporada');
  if (F.hecho) {
    return cab + '<p class="nota">&#128248; <b>Listo</b>: ésa es tu foto de la ' + T + '. Tus tarjetas ' +
      'se vuelven a dibujar en la próxima vuelta del ciclo (cada media hora; de 3 a 11 AM, hora del ' +
      'este, no corre).' + (F.libre ? ' ' + libreTexto(F) : '') + '</p></section>';
  }
  if (F.error) {
    var m = F.error === 'sin_foto' ? 'No tenés foto puesta en Discord: tu tarjeta va con la inicial, ' +
      'que con el color de tu rango queda bien. Si te ponés una, volvé.'
      : F.error === 'sin_perfil' ? 'Primero necesitás tu tarjeta: escribí <code>/verificar</code> en Discord.'
      : F.error === 'usado' ? 'Ya elegiste tu foto de la ' + T + ': va una por temporada. Se vuelve a abrir ' +
        'cuando arranque la que sigue.'
      : F.error === 'cdn' ? 'Discord no me dio tu foto. Suele arreglarse volviéndotela a poner en Discord ' +
        'y probando de nuevo.'
      : F.error === 'espera' ? 'Esperá un minuto y probá de nuevo.'
      : 'No pude cambiarla. Probá de nuevo en un rato.';
    return cab + '<p class="nota">' + m + '</p></section>';
  }
  if (F.estado === 'usado') {
    return cab + '<p class="nota">Ya elegiste tu foto de la ' + T + ' y va <b>una por temporada</b>: ' +
      'la Histórica necesita la cara que tenías en cada una. Se vuelve a abrir cuando arranque la que ' +
      'sigue.</p></section>';
  }
  return cab + '<div class="foto-vista"><img src="' + esc(F.vista) + '" alt="Tu foto de Discord" ' +
    'width="96" height="96"><p class="nota">Tu tarjeta de la ' + T + ' va a llevar ésta, la de tu ' +
    'perfil de Discord. ' + (F.libre ? libreTexto(F) : F.pase ? 'Con el pase de DRA la podés cambiar cuando quieras.'
      : '<b>Va una por temporada</b>: después no se puede cambiar hasta la próxima.') + '</p></div>' +
    '<button type="button" class="btn ancho" id="dcFotoSi">Usar esta foto</button>' +
    '<button type="button" class="btn sec ancho" id="dcFotoNo">Cancelar</button></section>';
}
function pedirRedes(mostrar) {
  var cuerpo = { token: DC_TOKEN };
  if (mostrar) cuerpo.mostrar = mostrar;
  return fetch('/api/cuenta/redes', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo) })
    .then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }); });
}
function secRedes() {
  if (!DC || !DC.clave) return '';
  var R = REDES_MIAS;
  // ⚠️ `secMisRedes` Y NO `secRedes`: ése es el feed de redes del Inicio, y
  // con dos iguales `pintaFeed()` podía agarrar esta sección
  var cab = '<section class="pop-sec" id="secMisRedes"><h4>&#128279; Mis redes en mi perfil</h4>';
  if (!R || !DC_TOKEN) {
    return cab + '<p class="nota">Mostrá en tu perfil las redes que ya tenés conectadas en Discord ' +
      '(Instagram, TikTok, YouTube…). Discord te pide permiso para leerlas.</p>' +
      '<button type="button" class="btn sec ancho" id="dcRedes">Elegir mis redes</button></section>';
  }
  if (R.error) {
    return cab + '<p class="nota">' + (R.error === 'sin_perfil' ? 'Primero necesitás tu tarjeta: escribí ' +
      '<code>/verificar</code> en Discord.' : 'No pude leer tus redes. Probá de nuevo.') + '</p>' +
      '<button type="button" class="btn sec ancho" id="dcRedes">Probar de nuevo</button></section>';
  }
  if (!(R.publicas || []).length) {
    return cab + '<p class="nota">No tenés redes públicas en Discord. Andá a <b>Ajustes → Conexiones</b>, ' +
      'conectá tu Instagram, TikTok o YouTube y activá <b>«Mostrar en el perfil»</b>. Después volvé acá.</p>' +
      '<button type="button" class="btn sec ancho" id="dcRedes">Ya las conecté</button></section>';
  }
  var ya = {};
  (R.guardadas || []).forEach(function (r) { ya[r.t + ':' + r.n] = 1; });
  var nada = !(R.guardadas || []).length;
  return cab + '<div class="redes-el">' + R.publicas.map(function (r) {
    var id = r.t + ':' + r.n;
    // ⚠️ NINGUNA MARCADA DE ENTRADA: se muestra lo que la persona elige, no lo que
    // la página eligió por ella (auditoría legal del 01/10/2026)
    return '<label><input type="checkbox" value="' + esc(id) + '"' + (ya[id] ? ' checked' : '') +
      '><span class="red chica">' + (RED_ICONO[r.t] || '') + '</span><span>' + esc(RED_NOMBRE[r.t] || r.t) +
      ' <small>' + esc(r.n) + '</small></span></label>';
  }).join('') + '</div><button type="button" class="btn ancho" id="dcRedesGuardar">Guardar en mi perfil</button>' +
    (nada ? '' : '<button type="button" class="btn sec ancho" id="dcRedesQuitar">Quitar todas</button>') +
    '<p class="nota" id="redesNota">' + (nada ? 'Todavía no mostrás ninguna.' : 'Tu perfil muestra ' +
      R.guardadas.length + '.') + ' Los cambios aparecen en la próxima actualización (cada media hora).</p>' +
    '</section>';
}
// ⚠️ ANTES DEL ENRUTADO: Discord vuelve con el permiso en el `#`, que es
// justo lo que usa el enrutado de la página. Se lee, se limpia y recién
// después se enruta.
function volverDeDiscord() {
  var h = location.hash || '';
  if (h.indexOf('access_token=') < 0 && h.indexOf('error=') < 0) return;
  var q = {};
  h.replace(/^#/, '').split('&').forEach(function (x) {
    var i = x.indexOf('=');
    // ⚠️ CON TRY: un `%` suelto en el link tiraba URIError y la página quedaba
    // en blanco (revisión del 25/09/2026)
    try {
      if (i > 0) q[decodeURIComponent(x.slice(0, i))] = decodeURIComponent(x.slice(i + 1));
    } catch (e) { /* ese par no se lee */ }
  });
  // quien vino a vincular sus avisos vuelve a la campana; quien vino a poner
  // un precio, adonde lo tocó (la tienda o un perfil)
  var modo0 = String(q.state || '').charAt(0), pp = null;
  if (modo0 === 't') {
    try { pp = JSON.parse(sessionStorage.getItem('lg:precio') || 'null'); } catch (e) { pp = null; }
  }
  var destino = '#/' + (modo0 === 'v' ? 'avisos' : modo0 === 'd' ? 'cuenta/verificar' : modo0 === 't'
    ? String((pp && pp.volver) || 'tienda').replace(/^#?\/?/, '') : '');
  try { history.replaceState(null, '', urlDe(destino)); } catch (e) { location.hash = destino; }
  var st = '';
  try { st = sessionStorage.getItem('lg:estado') || ''; sessionStorage.removeItem('lg:estado'); } catch (e) { st = ''; }
  // quien canceló el permiso de verificarse vuelve a la página y lo lee ahí
  if (modo0 === 'd' && !q.access_token && q.error) {
    VERIF = { error: q.error === 'access_denied' ? 'cancelado' : 'discord_error' };
    avisarVerif();
  }
  if (!q.access_token || !st || q.state !== st) return;
  var porRedes = st.charAt(0) === 'r';
  var porAvisos = st.charAt(0) === 'v';
  var porFoto = st.charAt(0) === 'f';
  // 🔑 VOTAR: el permiso queda en memoria mientras la página está abierta,
  // para los votos que siguen; nunca en el dispositivo
  var porVoto = st.charAt(0) === 'e';
  // 🔑 LA TIENDA: igual, en memoria (ver `ponerPrecio()` y `pedirBilletera()`)
  var porTienda = st.charAt(0) === 't';
  // 🔑 VERIFICARSE: también en memoria, para «Revisar» y para elegir el país
  var porVerif = st.charAt(0) === 'd';
  if (porRedes || porFoto || porVoto || porTienda || porVerif) DC_TOKEN = q.access_token;
  // y se mira ya, sin esperar a `/api/cuenta`: el Worker le pregunta a Discord por su cuenta
  if (porVerif) {
    var vp = '';
    try { vp = sessionStorage.getItem('lg:verif-pais') || ''; sessionStorage.removeItem('lg:verif-pais'); } catch (e) { vp = ''; }
    verificarme(vp || null);
  }
  // recién vuelto de Discord: si igual no se sabe quién sos, no se vuelve a ir
  DC_VUELTA = true;
  // el precio que se tocó antes de entrar sale ya; si no, se muestra la billetera
  if (porTienda) {
    try { sessionStorage.removeItem('lg:precio'); } catch (e) { /* igual */ }
    if (pp && pp.cabeza && pp.monto) ponerPrecio(String(pp.cabeza), Number(pp.monto));
    else pedirBilletera(false);
  }
  // el voto que se tocó antes de entrar sale ya, sin esperar a `/api/cuenta`:
  // el Worker le pregunta a Discord por su cuenta (ver `votar()`)
  if (porVoto) {
    var pv = null;
    try {
      pv = JSON.parse(sessionStorage.getItem('lg:voto') || 'null');
      sessionStorage.removeItem('lg:voto');
    } catch (e) { pv = null; }
    if (pv && pv.enc && pv.op) votar(String(pv.enc), String(pv.op));
  }
  fetch('/api/cuenta', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: q.access_token }) })
    .then(function (r) { return r.json(); })
    .then(function (c) {
      if (!c || !c.id) return;
      DC = { id: c.id, n: c.n || '', av: c.av || '', rapero: c.rapero || '',
        clave: c.clave || '', cs: c.cs || [], bl: c.bl || [], ev: c.ev || 0,
        sv: c.sv || '', cc: c.cc || '', svs: c.svs || [] };
      guardarLS('lg:dc', DC);
      YO = c.clave && porK(c.clave) ? c.clave : c.rapero ? kDe(c.rapero) : '';
      guardarLS('lg:yo', YO || null);
      // ★ a quién seguís, del servidor (y lo de este dispositivo sube)
      try { pedirSigo(); } catch (e) { console.error('[pedirSigo]', e); }
      pintaCuenta();
      pintaPaneles();
      pintaPopCuenta();
      $('#popCuenta').hidden = false;
      if (porAvisos) {
        vincularAvisos(q.access_token);
        $('#popCuenta').hidden = true;
      }
      // quien vino a votar se queda donde votó; ahora se sabe quién es («el tuyo»)
      if (porVoto) {
        $('#popCuenta').hidden = true;
        if (D) pintaEncuestas();
      }
      // y quien vino a la tienda, también («sos vos» en su propio perfil)
      if (porTienda) {
        $('#popCuenta').hidden = true;
        if (D) pintaPrecios();
      }
      // y quien vino a verificarse se queda en su página de verificarse
      if (porVerif) {
        $('#popCuenta').hidden = true;
        avisarVerif();
      }
      if (porFoto) {
        pedirFoto(false).then(function (R) {
          FOTO = R;
          pintaPopCuenta();
          $('#popCuenta').hidden = false;
        }).catch(function () { FOTO = { error: 'red' }; pintaPopCuenta(); });
      }
      if (porRedes) {
        pedirRedes(null).then(function (R) {
          REDES_MIAS = R;
          pintaPopCuenta();
          $('#popCuenta').hidden = false;
        }).catch(function () { REDES_MIAS = { error: 'red' }; pintaPopCuenta(); });
      }
    })
    .catch(function () { /* si falla, queda como estaba */ });
}
function pintaCuenta() {
  var f = yo();
  var cara = f ? avatar(f, 26) : DC ? avatar({ n: DC.n, av: DC.av }, 26)
    : '<span class="av ini" style="width:26px;height:26px;font-size:13px">&#128100;</span>';
  $('#cuentaCara').innerHTML = cara;
  $('#cuentaTxt').textContent = f ? f.n : DC ? (DC.rapero || DC.n) : 'Mi cuenta';
  // quien entra, sale o elige quién es cambia si el «pedila» se ve
  try { pintaPedi(); } catch (e) { console.error('[pintaPedi]', e); }
}
/* 🔑 PRIVACIDAD Y TÉRMINOS, EN AJUSTES Y EN MI CUENTA. Dlx, 27/09/2026: «esa
   zona de privacidad y términos se ve algo rara… ¿quizás lo podamos agregar
   dentro de la sección de cuenta o ajustes?». Estaban en letra chica al pie
   del menú. Ahora van donde se piensa en los datos de uno. */
function legalPop() {
  return '<p class="pop-legal"><span>&#128274; Tus datos</span>' +
    '<a href="privacidad.html">Privacidad</a><a href="terminos.html">Términos</a></p>';
}
function pintaPopCuenta() {
  _pintaPopCuenta();
  $('#popCuenta').insertAdjacentHTML('beforeend', legalPop());
}
function _pintaPopCuenta() {
  var f = yo(), c = $('#popCuenta');
  var entrar = '<button type="button" class="btn dc-entrar" id="dcEntrar">Entrar con Discord</button>';
  // 🔴 CON TARJETA Y SIN EVENTOS NO ES «SIN TARJETA». Quien no jugó la
  // temporada no está en el ranking, pero puede tener su carta de Servidor
  // y sus Bloqueadas: a Dlx le decía que no tenía ninguna (25/09/2026).
  if (!f && DC && DC.rapero) {
    var misCartas = (DC.cs || []).length + (DC.bl || []).length;
    // 🔴 LA SESIÓN DE ANTES DEL 25/09 NO TRAE LA CLAVE, y el texto le decía
    // «volvé a entrar con Discord» a alguien que ya estaba conectado: Dlx lo
    // leyó como desconectado. Es un toque —el link lleva `prompt=none`, no
    // vuelve a pedir permiso— y ahora dice lo que es: actualizar.
    c.innerHTML = '<div class="pop-yo">' + avatar({ n: DC.n, av: DC.av }, 46) + '<div><b>' +
      esc(DC.rapero) + '</b><small>Conectado con Discord' +
      (DC.n && DC.n !== DC.rapero ? ' como ' + esc(DC.n) : '') + '</small></div></div>' +
      (DC.clave ? '<p class="nota">Todavía no jugaste esta temporada: aparecés en el ranking ' +
        'con tu primer evento.</p>'
        : '<p class="nota">Tu sesión es de una versión anterior. Actualizala para ver tus ' +
          'tarjetas y tu perfil: es un toque, no te pide nada.</p>' +
          '<button type="button" class="btn sec ancho" id="dcEntrar">&#8635; Actualizar mi cuenta</button>') +
      '<nav class="pop-menu">' +
      (DC.clave ? '<a href="#/r/' + encodeURIComponent(DC.clave) + '">&#128100; Mi perfil</a>' : '') +
      (DC.clave && misCartas ? '<button type="button" data-carta="' + esc(DC.clave) + '">&#127183; Mis tarjetas' +
        ' <small>' + misCartas + '</small></button>' : '') +
      (DC.cc && PAIS[String(DC.cc).toLowerCase()] ? '<a href="#/pais/' + esc(DC.cc) + '">' + bandera(DC.cc) +
        ' Mi país</a>' : '') +
      '<a href="#/avisos">&#128276; Mis avisos</a>' +
      (DC.clave ? '<button type="button" data-foto>&#128247; Cambiar mi foto</button>' : '') +
      '<button type="button" id="yoOlvidar">Salir</button></nav>' + secFoto() + secRedes() + secMiServidor() +
      secProximos() + secSigo();
    return;
  }
  if (!f && DC) {
    c.innerHTML = '<div class="pop-yo">' + avatar({ n: DC.n, av: DC.av }, 46) + '<div><b>' +
      esc(DC.n) + '</b><small>Conectado con Discord</small></div></div>' +
      '<p class="nota">Todavía no estás verificado en la Liga. Verificate acá, en un toque: si no ' +
      'estás en Discord Rap Español te metemos, y te decimos qué te falta. Si estás en la Lista y ' +
      'ya jugaste, tu Temporada y tu Servidor salen igual con <code>/card</code>.</p><nav class="pop-menu">' +
      // 🔑 Dlx, 01/10/2026: «haz que la gente se verifique por la página web»
      '<a href="#/cuenta/verificar">&#9989; Verificarme</a>' +
      '<a href="#/guia">&#127915; Cómo conseguir tu tarjeta</a>' +
      '<a href="#/avisos">&#128276; Mis avisos</a>' +
      '<button type="button" id="yoOlvidar">Salir</button></nav>' + secMiServidor() + secProximos() + secSigo();
    return;
  }
  if (!f) {
    c.innerHTML = '<h3>Mi cuenta</h3><p class="nota">Entrá con tu Discord y la página sabe quién ' +
      'sos: tu perfil, tus tarjetas y tu temporada, a un toque. Sólo lee tu nombre y tu foto; no ' +
      'publica nada.</p>' + entrar +
      '<details class="pop-sin"><summary>O elegí tu nombre sin entrar</summary>' +
      '<input type="search" id="yoBusca" placeholder="Tu nombre de competencia…" autocomplete="off" ' +
      'spellcheck="false" aria-label="Tu nombre"><div class="pop-lista" id="yoRes"></div></details>' +
      secSigo();
    return;
  }
  c.innerHTML = '<div class="pop-yo">' + avatar(f, 46) + '<div><b>' + esc(f.n) + '</b><small>' +
    textoPos(f) + ' · OVR ' + (f.ovr || '—') +
    (DC ? ' · con Discord' : '') + '</small></div></div>' +
    '<nav class="pop-menu">' +
    '<a href="#/r/' + encodeURIComponent(f.k) + '">&#128100; Mi perfil</a>' +
    ((f.c || []).length ? '<button type="button" data-carta="' + esc(f.k) + '">&#127183; Mis tarjetas</button>' : '') +
    (f.cc && PAIS[String(f.cc).toLowerCase()] ? '<a href="#/pais/' + esc(f.cc) + '">' + bandera(f.cc) + ' Mi país</a>' : '') +
    '<a href="#/avisos">&#128276; Mis avisos</a>' +
    (DC && DC.clave ? '<button type="button" data-foto>&#128247; Cambiar mi foto</button>' : '') +
    '<button type="button" id="yoOlvidar">' + (DC ? 'Salir' : 'No soy yo') + '</button></nav>' +
    (DC ? '' : '<p class="nota">¿Es tu cuenta? Entrá con Discord y queda confirmado.</p>' + entrar) +
    secFoto() + secRedes() + secMiServidor() + secProximos() + secSigo();
}
function pintaYoRes(q) {
  var caja = $('#yoRes');
  if (!caja) return;
  q = sinTildes(q).trim();
  var fs = q ? (D.tabla || []).filter(function (f) { return sinTildes(f.n).indexOf(q) >= 0; }).slice(0, 6) : [];
  caja.innerHTML = fs.map(function (f) {
    return '<button type="button" class="br" data-yo="' + esc(f.k) + '">' + quienEs(f, 24) +
      '<span class="br-p">' + numPos(f) + '</span></button>';
  }).join('') || (q ? '<p class="br-no">No hay nadie con ese nombre en la temporada.</p>' : '');
}
function pintaPopAjustes() {
  var h = AJ.h12 === true ? '12' : AJ.h12 === false ? '24' : '';
  $('#popAjustes').innerHTML = '<h3>&#9881; Ajustes</h3>' +
    '<label class="aj"><span>Formato de la hora</span><select id="ajH12">' +
    '<option value="">Automático (' + esc(fmtHora(Date.now())) + ')</option>' +
    '<option value="12">12 horas</option><option value="24">24 horas</option></select></label>' +
    '<label class="aj"><span>Zona horaria</span><select id="ajTz">' + ZONAS.map(function (z) {
      return '<option value="' + esc(z[0]) + '">' + esc(z[1]) + '</option>';
    }).join('') + '</select></label>' +
    '<p class="nota">Las horas de la página van en <b>' + esc(zonaCorta()) + '</b>' +
    (AJ.tz ? '.' : ', la de este dispositivo.') + '</p>' +
    '<label class="aj aj-ck"><input type="checkbox" id="ajCalma"' + (AJ.calma ? ' checked' : '') +
    '><span>Menos animaciones</span></label>' +
    '<button type="button" class="btn sec ancho" id="ajBorrar">Olvidar quién soy y mis ajustes</button>' +
    '<a class="aj-cambios" href="#/cambios">&#128220; Changelog: lo nuevo de la página' +
    (CAMBIOS && CAMBIOS.length && CAMBIOS[0].version ? ' <span class="ver">v' + esc(CAMBIOS[0].version) + '</span>' : '') +
    (CAMBIOS && CAMBIOS.length && nuevaQue(versionDe(CAMBIOS[0]), CAMBIOS_VISTO) ? ' <b class="nuevo-et">Nuevo</b>' : '') +
    '</a>' + legalPop();
  $('#ajH12').value = h;
  $('#ajTz').value = AJ.tz || '';
}
function cerrarPops() { $$('.pop').forEach(function (p) { p.hidden = true; }); }

/* ── la fase: prueba, o la temporada en juego ─────────────────────────
   🔑 Dlx, 25/09/2026: «estamos en prueba todavía» y «la temporada 1 ya
   tiene fecha: 5 de octubre hasta el 31 de diciembre». Las fechas viajan en
   el payload desde `comun/temporada.py` (`FECHAS`); qué se muestra lo
   decide el día de quien mira, así el 5/10 cambia solo, sin tocar nada. */
function diaLocal(iso) {
  var p = String(iso || '').split('-');
  return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null;
}
function enPrueba() {
  var a = D.fase && diaLocal(D.fase.arranca);
  return !!a && Date.now() < a.getTime();
}
function pintaFase() {
  var c = $('#fase'), f = D.fase;
  if (!c || !f) { if (c) c.hidden = true; return; }
  var a = diaLocal(f.arranca), t = diaLocal(f.termina);
  if (!a || !t) { c.hidden = true; return; }
  var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  var dias = function (d) { return Math.round((d - hoy) / 86400000); };
  var fecha = function (d) {
    try { return d.toLocaleDateString('es', { day: 'numeric', month: 'long' }); }
    catch (e) { return d.getDate() + '/' + (d.getMonth() + 1); }
  };
  var cuenta = function (n) {
    return n <= 0 ? 'hoy' : n === 1 ? 'falta 1 día' : 'faltan ' + n + ' días';
  };
  var h = '';
  if (dias(a) > 0) {
    h = '&#129514; <b>Fase de prueba</b> &middot; la <b>Temporada ' + esc(String(D.temporada || '1').replace(/^T/i, '')) +
      '</b> arranca el <b>' + esc(fecha(a)) + '</b> (' + cuenta(dias(a)) + ') y termina el ' + esc(fecha(t)) + '.';
  } else if (dias(t) >= 0) {
    h = '&#127937; <b>Temporada ' + esc(String(D.temporada || '1').replace(/^T/i, '')) + ' en juego</b> &middot; termina el <b>' +
      esc(fecha(t)) + '</b> (' + (dias(t) === 0 ? 'hoy' : cuenta(dias(t))) + ').';
  }
  c.innerHTML = h;
  c.hidden = !h;
}

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
      if (c && listo) c.innerHTML = '<p class="nota">No pude cargar el changelog. Probá recargar.</p>';
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
function puntoCambios() {
  var hay = !!(CAMBIOS && CAMBIOS.length && nuevaQue(versionDe(CAMBIOS[0]), CAMBIOS_VISTO));
  if ($('#verCambios') && CAMBIOS && CAMBIOS.length && CAMBIOS[0].version) {
    $('#verCambios').textContent = 'v' + CAMBIOS[0].version;
  }
  if ($('#cambiosNuevo')) $('#cambiosNuevo').hidden = !hay;
  if ($('#bAjustes2')) $('#bAjustes2').classList.toggle('con-nuevo', hay);
}
// **negrita** y `código`, sobre el texto ya escapado
function mdCorto(t) {
  return esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}
function pintaCambios() {
  var c = $('#cambios');
  if (!c || !CAMBIOS) return;
  var antes = CAMBIOS_VISTO;
  c.innerHTML = CAMBIOS.map(function (x) {
    var nueva = antes && nuevaQue(versionDe(x), antes);
    var f = '';
    try {
      f = new Date(x.dia + 'T12:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'long',
        year: 'numeric', timeZone: 'UTC' });
    } catch (e) { f = x.dia; }
    // 🔑 LA HORA, EN LA DE QUIEN MIRA. Dlx, 27/09/2026: «si es posible añade
    // la hora de cada changelog». `cuando` es el instante de la publicación;
    // las primeras cuatro se escribieron después y van sólo con el día.
    var zh = '';
    if (x.cuando) {
      f = fmtFecha(x.cuando, { day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + fmtHora(x.cuando);
      zh = ' ' + etiquetaHora(x.cuando);
    }
    return '<article class="cambio' + (nueva ? ' es-nuevo' : '') + '">' +
      '<header>' + (x.version ? '<span class="ver-et">v' + esc(x.version) + '</span>' : '') +
      '<time datetime="' + esc(x.cuando || x.dia) + '">' + esc(f) + zh + '</time>' +
      (nueva ? '<span class="nuevo-et">Nuevo</span>' : '') +
      '<h2>' + esc(x.titulo) + '</h2></header><ul>' +
      (x.items || []).map(function (i) { return '<li>' + mdCorto(i) + '</li>'; }).join('') +
      '</ul></article>';
  }).join('') || '<p class="nota">Todavía no hay nada anotado.</p>';
  acomodarCambios();
  if (CAMBIOS.length) {
    CAMBIOS_VISTO = versionDe(CAMBIOS[0]);
    guardarLS('lg:cambios', CAMBIOS_VISTO);
    puntoCambios();
  }
}
/* 🔑 EN LA COMPU, DE A DOS Y SIN HUECOS. Dlx, 27/09/2026: «mezclarlo a la
   derecha también, hay mucho espacio en el website desde el ordenador».
   La más nueva va entera arriba; las demás, cada una a la columna más
   corta, en orden. Con una grilla de filas la más larga de cada par dejaba
   un hueco al lado: la 1.15 mide 529 px y la 1.14, 200. */
var MQ_CAMBIOS = window.matchMedia ? window.matchMedia('(min-width:1100px)') : null;
function acomodarCambios() {
  var c = $('#cambios');
  if (!c) return;
  var todas = $$('#cambios .cambio');
  todas.forEach(function (a) { c.appendChild(a); });
  $$('#cambios .cambios-col').forEach(function (x) { x.remove(); });
  var dos = !!(MQ_CAMBIOS && MQ_CAMBIOS.matches) && todas.length > 2;
  c.classList.toggle('dos', dos);
  if (!dos) return;
  var cols = [0, 1].map(function () {
    var x = document.createElement('div');
    x.className = 'cambios-col';
    return c.appendChild(x);
  });
  var alto = [0, 0];
  todas.slice(1).forEach(function (a) {
    var i = alto[0] <= alto[1] ? 0 : 1;
    cols[i].appendChild(a);
    alto[i] += a.offsetHeight + 16;
  });
}
if (MQ_CAMBIOS) {
  var reacomodar = function () { if (CAMBIOS && ruta() === 'cambios') acomodarCambios(); };
  if (MQ_CAMBIOS.addEventListener) MQ_CAMBIOS.addEventListener('change', reacomodar);
  else if (MQ_CAMBIOS.addListener) MQ_CAMBIOS.addListener(reacomodar);
}
// lo que depende de la hora se vuelve a dibujar al cambiar la zona o el formato
// 🔴 SIN `ir()`, Y CON «LO QUE VIENE», EL CHANGELOG Y LA LLAVE ABIERTA. Con
// `ir()` cambiar la zona en un perfil cerraba Ajustes y subía la página al
// principio; y el Inicio seguía diciendo «domingo 23:00» con el panel ya en
// «lunes 6:00» para el mismo evento (auditoría del 27/09/2026).
function repintarHoras() {
  [pintaHero, pintaCalendario, pintaEvCab, pintaPaneles, pintaUltCampeones].forEach(function (f) {
    try { f(); } catch (e) { console.error('[' + f.name + ']', e); }
  });
  var y = window.scrollY;
  var dec = function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } };
  try {
    if (ruta().indexOf('r/') === 0) pintaPerfil(dec(ruta().slice(2)));
    if (ruta() === 'cambios' && CAMBIOS) pintaCambios();
  } catch (e) { console.error('[repintarHoras]', e); }
  window.scrollTo(0, y);
  // la llave abierta, en su lugar: mismo scroll y mismo seguido
  if (LL && !$('#visorLlave').hidden) {
    var cu = $('#lCuerpo'), st = cu ? cu.scrollTop : 0, fijo = FIJO;
    abrirLlave(LL.n);
    FIJO = fijo;
    if (fijo) seguirEnLlave(fijo, true);
    if (cu) cu.scrollTop = st;
  }
}

/* ── eventos de la página ─────────────────────────────────────────── */
function eventos() {
  $('#buscar').addEventListener('input', function (e) {
    FIL.q = e.target.value.trim(); pintaTabla();
  });
  $('#buscarC').addEventListener('input', function (e) {
    FIL.qc = e.target.value.trim(); VISTAS = 24; pintaGaleria();
  });
  [['#chipsSv', 'sv'], ['#chipsCc', 'cc']].forEach(function (par) {
    $(par[0]).addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      FIL[par[1]] = b.dataset[par[1]] || '';
      $$(par[0] + ' .chip').forEach(function (c) { c.classList.toggle('on', c === b); });
      pintaTabla();
    });
  });

  // 🔑 LOS ENCABEZADOS SE REDIBUJAN CON CADA RANKING, así que el escucha va
  // en la cabecera y no en cada uno. Tocar el que ya manda lo da vuelta.
  var ordenar = function (th) {
    var id = th.dataset.col, c = COL[id];
    var cfg = SUBS[SUB] || SUBS.temporada;
    var act = ORDEN.tocado ? ORDEN.col : cfg.cols[0], dsc = ORDEN.tocado ? ORDEN.desc : false;
    if (id === act) ORDEN.desc = !dsc;
    else ORDEN.desc = !(c.txt || id === 'pos' || id === 'i');
    ORDEN.col = id;
    ORDEN.tocado = true;
    pintaTabla();
  };
  $('#cabTabla').addEventListener('click', function (e) {
    var th = e.target.closest('th[data-col]');
    if (th) ordenar(th);
  });
  $('#cabTabla').addEventListener('keydown', function (e) {
    var th = e.target.closest('th[data-col]');
    if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ordenar(th); }
  });

  // Un solo escucha para todo lo que abre el visor. ⚠️ Los enlaces del
  // menú también son clics: se sale antes si el destino es un `<a>`, o
  // tocar «Ver el ranking completo» abriría una tarjeta.
  // 🔑 UNA TARJETA ABRE LA TARJETA; UN NOMBRE ABRE SU PERFIL. Desde el
  // 25/09/2026 cada rapero tiene su página, y es lo que alguien busca al
  // tocar un nombre en una tabla. Las imágenes de tarjetas (galería,
  // podio, campeón) siguen abriendo el visor: llevan `data-carta`.
  document.addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    var c = e.target.closest('[data-carta]');
    if (c) { abrir(c.dataset.carta); return; }
    // ⚠️ LO MÁS ADENTRO MANDA: en la fila de una crew, el nombre de su mejor
    // rapero abre al rapero y el resto de la fila, la crew
    var t = e.target.closest('[data-k],[data-crew],[data-pais]');
    if (!t || e.target.closest('.pest')) return;
    if (t.dataset.k) irPerfil(t.dataset.k);
    else if (t.dataset.crew) location.hash = '#/crew/' + encodeURIComponent(t.dataset.crew);
    else if (t.dataset.pais) location.hash = '#/pais/' + encodeURIComponent(t.dataset.pais);
  });
  // el perfil: sus pestañas de tarjetas y descargar la que se ve
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pfc]');
    if (b) {
      var k = $('#pfBajar') && $('#pfBajar').dataset.pfk;
      var f = porK(k);
      if (!f) return;
      PERF_CARTA[k] = b.dataset.pfc;
      $$('#pfPest .pest').forEach(function (p) { p.classList.toggle('on', p === b); });
      $('#pfImg').src = urlCarta(f, b.dataset.pfc);
      $('#pfImg').alt = 'Tarjeta ' + (NOMBRE_CARTA[b.dataset.pfc] || '') + ' de ' + f.n;
      return;
    }
    var d = e.target.closest('#pfBajar');
    if (d) {
      var g = porK(d.dataset.pfk);
      if (g) bajarCarta(g, PERF_CARTA[g.k] || (g.c || [])[0]);
    }
  });
  // el buscador del Inicio: escribir sugiere, Enter abre el primero
  var bi = $('#buscarInicio');
  if (bi) {
    bi.addEventListener('input', function () { pintaBusca(bi.value); });
    bi.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var p = $('#buscaRes .br');
        if (p) { e.preventDefault(); bi.value = ''; pintaBusca(''); irPerfil(p.dataset.k); }
      } else if (e.key === 'Escape') { bi.value = ''; pintaBusca(''); }
    });
    bi.addEventListener('blur', function () { setTimeout(function () { pintaBusca(''); }, 180); });
  }
  // ⚠️ AL CAMBIAR DE SUBCATEGORIA SE SUELTA EL ORDEN MANUAL. Cada una
  // trae el suyo —Podios por oros, Camino por eventos— y respetar el
  // orden viejo haría que tocar «Podios» no cambiara nada visible.
  // mi cuenta y los ajustes: se abren arriba, se cierran tocando afuera
  var abrirPop = function (id, pintar) {
    var p = $(id), estaba = !p.hidden;
    cerrarPops();
    if (estaba) return;
    pintar();
    p.hidden = false;
    var inp = p.querySelector('input[type=search]');
    if (inp) inp.focus();
  };
  $('#bCuenta').addEventListener('click', function () { abrirPop('#popCuenta', pintaPopCuenta); });
  ['#bAjustes', '#bAjustes2'].forEach(function (b) {
    $(b).addEventListener('click', function () { abrirPop('#popAjustes', pintaPopAjustes); });
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('.pop,#bCuenta,#bAjustes,#bAjustes2,[data-abrir-cuenta]')) return;
    cerrarPops();
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-abrir-cuenta]')) {
      e.preventDefault();
      window.scrollTo(0, 0);
      abrirPop('#popCuenta', pintaPopCuenta);
      return;
    }
    // 🏠 «tu servidor»: durante la ventana libre se elige al toque; después,
    // como es para toda la temporada, se confirma
    var ms = e.target.closest('[data-misv]');
    if (ms) {
      var msv = ms.dataset.misv;
      if (MISV && MISV.sv === msv) return;
      if (MISV && !MISV.libre) { MISV_EST = { pide: msv }; repintarMiServidor(); } else elegirMiServidor(msv);
      return;
    }
    var mo = e.target.closest('[data-misv-ok]');
    if (mo) { elegirMiServidor(mo.dataset.misvOk); return; }
    var sg = e.target.closest('[data-seguir]');
    if (sg) {
      var sk = sg.dataset.seguir, sw = sg.closest('[data-segw]');
      SIGO_EST[sk] = {};
      alternarSigo(sk);
      if (sw) sw.outerHTML = botonSigo(sk); else sg.outerHTML = botonSigo(sk);
      return;
    }
    var y = e.target.closest('[data-yo]');
    if (y) {
      YO = y.dataset.yo;
      guardarLS('lg:yo', YO);
      pintaCuenta();
      pintaPopCuenta();
      pintaPaneles();
      return;
    }
    if (e.target.closest('#dcEntrar')) {
      location.href = urlLogin();
      return;
    }
    if (e.target.closest('#dcRedes')) {
      location.href = urlLogin(true);
      return;
    }
    if (e.target.closest('[data-foto]')) {
      location.href = urlLogin('f');
      return;
    }
    if (e.target.closest('#dcFotoNo')) {
      FOTO = null;
      pintaPopCuenta();
      return;
    }
    var fs = e.target.closest('#dcFotoSi');
    if (fs) {
      fs.disabled = true;
      pedirFoto(true).then(function (R) {
        FOTO = R && R.ok ? { hecho: true, temporada: R.temporada, libre: R.libre, libre_hasta: R.libre_hasta }
          : { error: (R && (R.paso || R.error)) || 'red', temporada: R && R.temporada };
        pintaPopCuenta();
      }).catch(function () { FOTO = { error: 'red' }; pintaPopCuenta(); });
      return;
    }
    var rg = e.target.closest('#dcRedesGuardar,#dcRedesQuitar');
    if (rg) {
      var elegidas = rg.id === 'dcRedesQuitar' ? [] : $$('#secMisRedes input:checked').map(function (x) {
        return x.value;
      });
      rg.disabled = true;
      pedirRedes(elegidas).then(function (R) {
        if (R && R.guardadas) REDES_MIAS = R;
        pintaPopCuenta();
        var n = $('#redesNota');
        if (n && R && R.error === 'tope') n.textContent = 'Ya cambiaste tus redes muchas veces hoy: probá mañana.';
        else if (n && R && R.error === 'espera') n.textContent = 'Esperá un minuto y probá de nuevo.';
        else if (n) n.innerHTML = R && R.guardadas ? '&#10003; Guardado. ' + (R.guardadas.length ? 'Tu perfil va a ' +
          'mostrar ' + R.guardadas.length + (R.guardadas.length === 1 ? ' red' : ' redes') : 'Tu perfil no ' +
          'muestra ninguna') + ' desde la próxima actualización (cada media hora).' : 'No pude guardar. Probá de nuevo.';
      }).catch(function () { rg.disabled = false; });
      return;
    }
    if (e.target.closest('#yoOlvidar')) {
      desvincularAvisos();
      cerrarSesion();
      // ★ a quién seguías queda en el servidor, con tu cuenta: no en este dispositivo
      if (DC) { guardarSigo([]); marcarSigoSrv(false); ME_SIGUEN = null; }
      MISV = null;
      MISV_EST = {};
      YO = '';
      DC = null;
      guardarLS('lg:yo', null);
      guardarLS('lg:dc', null);
      pintaCuenta();
      pintaPopCuenta();
      pintaPaneles();
      return;
    }
    if (e.target.closest('.pop-menu a,.pop-menu [data-carta]')) cerrarPops();
    if (e.target.closest('#ajBorrar')) {
      desvincularAvisos();
      cerrarSesion();
      guardarSigo([]);
      marcarSigoSrv(false);
      ME_SIGUEN = null;
      MISV = null;
      MISV_EST = {};
      AJ = {};
      YO = '';
      DC = null;
      guardarLS('lg:ajustes', null);
      guardarLS('lg:yo', null);
      guardarLS('lg:dc', null);
      aplicarCalma();
      pintaCuenta();
      pintaPopAjustes();
      repintarHoras();
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'yoBusca') pintaYoRes(e.target.value);
    // 🔑 las encuestas: buscar a quién votar (ver `pintaOpsElegido()`)
    if (e.target.classList && e.target.classList.contains('enc-busca')) {
      ENC_BUSCA = e.target.value;
      pintaOpsElegido();
    }
  });
  // 🔑 y votar: una opción es un botón con `data-votar` (ver `votar()`)
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-votar]');
    if (!b || b.disabled) return;
    e.preventDefault();
    votar(b.dataset.votar, b.dataset.op);
  });
  // 🔑 la tienda: poner un precio, elegir a quién y ver la billetera
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-precio],[data-pr-sel],[data-billetera]');
    if (!b || b.disabled) return;
    e.preventDefault();
    if (b.dataset.precio) ponerPrecio(b.dataset.precio, Number(b.dataset.monto));
    else if (b.dataset.prSel) { PR_SEL = b.dataset.prSel; pintaTienda(); }
    else pedirBilletera(true);
  });
  document.addEventListener('input', function (e) {
    if (e.target.classList && e.target.classList.contains('pr-busca')) {
      PR_BUSCA = e.target.value;
      pintaBuscaPrecio();
    }
  });
  // 🔑 Publicaciones: los filtros y «ver más» (ver `pintaMuro()`)
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mufil],#muroMas');
    if (!b) return;
    if (b.id === 'muroMas') MURO_VER += 20;
    else { MURO_FIL = b.dataset.mufil; MURO_VER = 20; }
    pintaMuro();
  });
  // la barra del teléfono se desliza: su borde deja de apagarse al final
  var nv = $('#nav');
  if (nv) nv.addEventListener('scroll', bordeNav, { passive: true });
  window.addEventListener('resize', bordeNav);
  document.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id !== 'ajH12' && id !== 'ajTz' && id !== 'ajCalma') return;
    if (id === 'ajH12') {
      var v = e.target.value;
      if (v) AJ.h12 = v === '12'; else delete AJ.h12;
    }
    if (id === 'ajTz') {
      if (e.target.value) AJ.tz = e.target.value; else delete AJ.tz;
    }
    if (id === 'ajCalma') AJ.calma = e.target.checked;
    guardarLS('lg:ajustes', AJ);
    aplicarCalma();
    repintarHoras();
    pintaPopAjustes();
  });
  $('#subRanking').addEventListener('click', function (e) {
    var b = e.target.closest('.sub'); if (!b) return;
    elegirSub(b.dataset.sub);
    // el link queda en la barra para mandarlo, sin saltar arriba
    try { history.replaceState(null, '', urlDe('ranking/' + b.dataset.sub)); } catch (x) { /* nada */ }
  });
  // las flechas del feed
  $('#feedAntes').addEventListener('click', function () { FEED.pag--; pintaFeed(); });
  $('#feedDespues').addEventListener('click', function () { FEED.pag++; pintaFeed(); });
  $('#novAntes').addEventListener('click', function () { NOV.pag--; pintaNovedades(); });
  $('#novDespues').addEventListener('click', function () { NOV.pag++; pintaNovedades(); });
  $('#pnAntes').addEventListener('click', function () { PN.pag--; pintaPaneles(); });
  $('#pnDespues').addEventListener('click', function () { PN.pag++; pintaPaneles(); });
  // 🔑 las del panel de multiplicadores (Dlx, 28/09/2026: «A»)
  $('#mpAntes').addEventListener('click', function () { MP.pag--; pintaMultPags(); });
  $('#mpDespues').addEventListener('click', function () { MP.pag++; pintaMultPags(); });
  $('#mpDots').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mp]');
    if (b) { MP.pag = +b.dataset.mp; pintaMultPags(); }
  });
  $('#pnDots').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pn]');
    if (b) { PN.pag = +b.dataset.pn; pintaPaneles(); }
  });
  window.addEventListener('resize', function () {
    if (FEED.pp && FEED.pp !== porPagina()) pintaFeed();
    if (NOV.pp && NOV.pp !== porPagina()) pintaNovedades();
  });
  // la categoría del comparador: se quedan los mismos dos si la tienen
  $('#cmpCat').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]'); if (!b || b.disabled) return;
    var antes = cmpLista(), ks = CMP.map(function (i) { return (antes[i] || {}).k; });
    CMP_CAT = b.dataset.cat;
    var ahora = cmpLista().map(function (f) { return f.k; });
    CMP = ks.map(function (k, j) { var i = ahora.indexOf(k); return i >= 0 ? i : j; });
    cerrarSug();
    pintaComparar();
  });
  $('#masCartas').addEventListener('click', function () {
    VISTAS = 9999; pintaGaleria();
  });
  // ⚠️ `change` Y NO `input`: con `input` se repinta en cada tecla, y
  // repintar reemplaza el `<input>` que tiene el foco — se pierde el
  // cursor a la segunda letra. `change` dispara al elegir del datalist y
  // al salir del campo, que es cuando el nombre ya está completo.
  // ⚠️ `input` PARA SUGERIR y `change` para confirmar. Sugerir en cada
  // tecla se puede porque la ventanita es otro elemento y no repinta el
  // campo; confirmar en cada tecla borraría lo que se está escribiendo.
  $('#cmp').addEventListener('input', function (e) {
    var s = e.target.closest('.cmp-busca'); if (!s) return;
    pintaSug(s);
  });
  $('#cmp').addEventListener('focusin', function (e) {
    var s = e.target.closest('.cmp-busca'); if (!s) return;
    s.select();
    pintaSug(s);
  });
  // el clic en una sugerencia. `mousedown` y no `click`: el `blur` del
  // campo llega antes que el click y cerraría la lista debajo del dedo.
  $('#cmp').addEventListener('mousedown', function (e) {
    var b = e.target.closest('.sug'); if (!b) return;
    e.preventDefault();
    eligeSug(+b.dataset.i);
  });
  $('#cmp').addEventListener('keydown', function (e) {
    var s = e.target.closest('.cmp-busca'); if (!s) return;
    var e2 = $('#sugeridor');
    if (!e2 || e2.hidden || !SUG.lista.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      SUG.sel = (SUG.sel + (e.key === 'ArrowDown' ? 1 : -1) +
                 SUG.lista.length) % SUG.lista.length;
      $$('#sugeridor .sug').forEach(function (b, j) {
        b.classList.toggle('on', j === SUG.sel);
      });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      eligeSug(SUG.lista[SUG.sel] ? SUG.lista[SUG.sel][1] : -1);
      s.blur();
      return;
    }
    if (e.key === 'Escape') { cerrarSug(); s.blur(); }
  });
  $('#cmp').addEventListener('focusout', function (e) {
    if (e.target.closest('.cmp-busca')) setTimeout(cerrarSug, 120);
  });
  $('#cmp').addEventListener('change', function (e) {
    var s = e.target.closest('.cmp-busca'); if (!s) return;
    var con = cmpLista();
    var i = indiceDe(s.value, con);
    if (i < 0) {
      // ⚠️ SE AVISA Y SE VUELVE ATRAS. Dejar el texto inventado en el
      // campo con la tarjeta anterior debajo es la pantalla mintiendo.
      s.classList.add('mal');
      setTimeout(function () {
        s.classList.remove('mal');
        pintaComparar();
      }, 900);
      return;
    }
    CMP[+s.dataset.lado] = i;
    pintaComparar();
  });
  // 🔑 EL CUADRO SE REARMA SI CAMBIA EL ANCHO —el teléfono que gira, la
  // ventana que se agranda—: el tamaño de las cajas sale del ancho, y se
  // medía una sola vez al abrir. Sólo el ANCHO: la barra del navegador del
  // teléfono cambia el alto cada vez que se desliza.
  var AJUSTE = 0;
  window.addEventListener('resize', function () {
    clearTimeout(AJUSTE);
    AJUSTE = setTimeout(function () {
      if (!LL || $('#visorLlave').hidden || LL_VISTA !== 'cuadro') return;
      if (Math.abs(window.innerWidth - (LL.ancho || 0)) < 40) return;
      pintaVistaLlave(true);
    }, 200);
  });
  // 🔑 SEGUIR A ALGUIEN POR LA LLAVE: con el mouse encima de un nombre se
  // iluminan todas las batallas donde está. En el teléfono no hay «encima»:
  // el primer toque sigue y el segundo abre el perfil (ver `#visorLlave`).
  var SOLTAR = 0;
  // el nombre bajo el puntero: el suyo, o el del renglón si el renglón es
  // de una sola persona (el nombre es angosto y el renglón no)
  var nombreBajo = function (el) {
    var q = el.closest && el.closest('#lVista .ql[data-k]');
    if (q) return q;
    var fila = el.closest && el.closest('#lVista .ld, #lVista .bl-l');
    var qs = fila ? fila.querySelectorAll('.ql[data-k]') : [];
    return qs.length === 1 ? qs[0] : null;
  };
  document.addEventListener('mouseover', function (e) {
    // ⚠️ SÓLO CON MOUSE DE VERDAD: el toque del teléfono también dispara un
    // `mouseover`, y borraría el seguido que se eligió tocando
    if (!HOVER || FIJO || !LL) return;
    var q = nombreBajo(e.target);
    if (q) {
      clearTimeout(SOLTAR);
      if (q.dataset.k !== SIGUE_K) seguirEnLlave(q.dataset.k, false);
      return;
    }
    if (!SIGUE_K) return;
    // ⚠️ SE SUELTA CON UNA PAUSA: pasar de un nombre al de abajo cruza el
    // borde de la caja, y soltar ahí mismo era el parpadeo
    var suya = e.target.closest && e.target.closest('#lVista .bx.sigue, #lVista .bl.sigue');
    clearTimeout(SOLTAR);
    if (suya) return;
    SOLTAR = setTimeout(function () { if (!FIJO) seguirEnLlave('', false); }, 250);
  });
  // el podio: flechas, puntos y las flechas del teclado cuando tiene el foco
  $('#podAntes').addEventListener('click', function () { moverPodio(-1); });
  $('#podDespues').addEventListener('click', function () { moverPodio(1); });
  $('#podDots').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pod]');
    if (b) moverPodio(0, +b.dataset.pod);
  });
  $('#vPestanas').addEventListener('click', function (e) {
    var b = e.target.closest('.pest'); if (!b) return;
    var f = porK($('#vPestanas').dataset.k) || filaCuenta($('#vPestanas').dataset.k); if (!f) return;
    $$('#vPestanas .pest').forEach(function (p) { p.classList.toggle('on', p === b); });
    $('#vImg').src = urlCarta(f, b.dataset.c);
    $('#vImg').alt = 'Tarjeta ' + (NOMBRE_CARTA[b.dataset.c] || '') + ' de ' + f.n;
    avisoCarta(f, b.dataset.c);
  });
  $('#vBajar').addEventListener('click', function () {
    var b = $('#vBajar');
    var f = porK(b.dataset.k) || filaCuenta(b.dataset.k);
    if (!f) return;
    // ⚠️ LA PESTAÑA ACTIVA, no `f.c[0]`. Si alguien abre la Servidor y le
    // da a Descargar, tiene que bajar ESA — bajar siempre la primera es un
    // botón que hace algo parecido a lo que dice.
    var p = $('#vPestanas .pest.on');
    bajarCarta(f, (p && p.dataset.c) || (f.c || [])[0]);
  });
  $('#visor').addEventListener('click', function (e) {
    if (e.target.closest('[data-cerrar]')) cerrar();
  });
  $('#visorLlave').addEventListener('click', function (e) {
    if (e.target.closest('[data-cerrar-llave]')) { cerrarLlave(); return; }
    if (e.target.closest('[data-sigue-x]')) { FIJO = ''; seguirEnLlave(''); return; }
    var bv = e.target.closest('[data-lvista]');
    if (bv) { LL_VISTA = bv.dataset.lvista; pintaVistaLlave(); return; }
    if (e.target.closest('[data-rep-abrir]')) {
      var rp = $('#lRep');
      if (rp) {
        rp.hidden = !rp.hidden;
        if (!rp.hidden) { REP = { que: '' }; pintaReporte(); rp.scrollIntoView({ block: 'nearest' }); }
      }
      return;
    }
    var rq = e.target.closest('[data-rep-que]');
    if (rq) {
      REP.txt = ($('#lRepTxt') && $('#lRepTxt').value) || '';
      REP.que = rq.getAttribute('data-rep-que');
      pintaReporte();
      return;
    }
    if (e.target.closest('[data-rep-enviar]')) { enviarReporte(); return; }
    var cl = e.target.closest('[data-copiar-llave]');
    if (cl) {
      var u = location.origin + urlDe('llave/' + cl.dataset.copiarLlave);
      var listo = function () { cl.querySelector('span').textContent = '✓ Link copiado'; };
      try {
        navigator.clipboard.writeText(u).then(listo, function () { window.prompt('Copiá el link:', u); });
      } catch (x) { window.prompt('Copiá el link:', u); }
      return;
    }
    // 🔑 EN EL TELÉFONO, EL PRIMER TOQUE SIGUE Y EL SEGUNDO ABRE EL PERFIL.
    // Sin esto, tocar un nombre abría su perfil y el camino no se veía nunca.
    // Tocar el renglón (y no justo el nombre) también sigue.
    var q = !HOVER && nombreBajo(e.target);
    if (q && FIJO !== q.dataset.k) {
      e.preventDefault();
      e.stopPropagation();
      FIJO = q.dataset.k;
      seguirEnLlave(FIJO, true);
    }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-llave]');
    // la que no viaja en el lobby se pide aparte (ver `llaveVieja()`)
    if (b && !abrirLlave(b.dataset.llave) && String(b.dataset.llave).indexOf('v:') !== 0) {
      llaveVieja(b.dataset.llave);
    }
  });
  // ⚠️ Escape cierra lo de arriba primero: la tarjeta, y después la llave
  // 🔑 EL CALENDARIO: tocar un día muestra sus eventos; las flechas
  // cambian de mes. Un día de otro mes lleva a ese mes.
  $('#calGrid').addEventListener('click', function (e) {
    var b = e.target.closest('.cal-d'); if (!b) return;
    CAL.dia = b.dataset.dia;
    var d = new Date(CAL.dia + 'T12:00:00');
    if (d.getMonth() !== CAL.m || d.getFullYear() !== CAL.y) {
      CAL.m = d.getMonth(); CAL.y = d.getFullYear();
      pintaCalendario();
    } else {
      $$('#calGrid .cal-d').forEach(function (x) { x.classList.toggle('sel', x === b); });
      pintaDia();
    }
    if (window.innerWidth < 900) $('#secDia').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  $('#calAntes').addEventListener('click', function () {
    if (--CAL.m < 0) { CAL.m = 11; CAL.y--; }
    pintaCalendario();
  });
  $('#calDespues').addEventListener('click', function () {
    if (++CAL.m > 11) { CAL.m = 0; CAL.y++; }
    pintaCalendario();
  });
  // ⚠️ EL CUADRO SE ARRASTRA CON EL MOUSE. Una llave de 16 en espejo mide
  // más que la pantalla, y la barra de abajo es lo último que alguien
  // busca. En el teléfono ya se desliza con el dedo.
  var arr = null;
  $('#lCuerpo').addEventListener('mousedown', function (e) {
    var c = e.target.closest('.cuadro-caja');
    if (!c || e.button !== 0 || e.target.closest('button,a')) return;
    arr = { c: c, x: e.clientX, y: e.clientY, l: c.scrollLeft, t: $('#lCuerpo').scrollTop };
    c.classList.add('arrastra');
    e.preventDefault();
  });
  window.addEventListener('mousemove', function (e) {
    if (!arr) return;
    arr.c.scrollLeft = arr.l - (e.clientX - arr.x);
    $('#lCuerpo').scrollTop = arr.t - (e.clientY - arr.y);
  });
  window.addEventListener('mouseup', function () {
    if (arr) arr.c.classList.remove('arrastra');
    arr = null;
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($$('.pop').some(function (p) { return !p.hidden; })) { cerrarPops(); return; }
    if (!$('#visor').hidden) cerrar();
    else if (!$('#visorLlave').hidden) cerrarLlave();
  });

  // Aparición de los paneles y marca en la nav. `IntersectionObserver` y
  // no `scroll`: el segundo dispara cientos de veces por gesto.
  var ver = new IntersectionObserver(function (es) {
    es.forEach(function (x) {
      if (x.isIntersecting) { x.target.classList.add('entro'); ver.unobserve(x.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  $$('.blk').forEach(function (s) { ver.observe(s); });

  // 🔑 `lg:dir` lo manda el script del principio de index.html, UNA vez por cambio de dirección: atrás/adelante, un
  // link `#/…` que ataja o un `location.hash = …`. ⚠️ No `popstate` + `hashchange`: un cambio de hash dispara los
  // dos, y enrutar dos veces cerraba la llave que la primera vuelta acababa de abrir
  if (window.rutaLG) window.addEventListener('lg:dir', ir);
  else window.addEventListener('hashchange', ir);
}

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

/* lo que se dibuja con los datos: al abrir la página y cada vez que llegan
   nuevos (ver `refrescarDatos()`) */
function pintaDatos() {
  // 🔴 CADA SECCIÓN, AISLADA. Una que falla —un dato que llega con otra
  // forma, o el HTML viejo en caché con este JS nuevo— queda sin dibujar y
  // el resto de la página sale igual. Antes un error en cualquier `pinta*`
  // cortaba todos los que venían después, y los escuchas no se colgaban:
  // una sección rota apagaba la página entera. El error queda en la
  // consola con el nombre de la sección.
  [trama, pintaMult, pintaHero, pintaPasados, pintaPodio, pintaChips, pintaTabla, pintaGaleria,
    pintaComparar, pintaServidores, pintaPaises, pintaRangos, pintaComo, pintaGuia,
    pintaTops, pintaMapa, pintaActividad, pintaComunidad, pintaFeed, pintaNovedades, pintaCalendario, pintaEvCab,
    pintaUltCampeones, pintaFormatos, pintaCuenta, pintaMW, pintaEncuestas, pintaPrecios, pintaPaneles,
    aplicarCalma]
    .forEach(function (f) {
      try { f(); } catch (e) { console.error('[' + f.name + ']', e); }
    });
  // 🔴 LA FECHA QUE SE MUESTRA ES LA DE LOS DATOS, NO LA DE LA COPIA.
  // `sello` es cuándo se escribió el payload y se puede mover sin que
  // los datos se muevan —correr `subir_web.py` a mano lo pone en
  // «recién» con anuncios de hace dos horas—. Dlx lo vio tal cual.
  //
  // 🔑 Y SE LEE. Dlx, 27/09/2026: «cuando dice que se actualizan los datos
  // hace 3 horas, ¿puedes hacer esa parte más grande o con otra fuente? no
  // la entiendo». Era una línea en mayúsculas condensadas de 11 px. Ahora son
  // dos renglones en la letra de la página, y cuando los datos tienen más de
  // una hora dice por qué: de 3 a 11 AM (hora del este) el ciclo no corre.
  var hace = cuandoSe(D.leido || D.sello), viejo = edadMin(D.leido || D.sello) > 75;
  $('#pie').innerHTML = '<span class="pie-fase">' +
    esc(enPrueba() ? 'Fase de prueba' : 'Temporada ' + (D.temporada || '')) + '</span>' +
    '<span class="pie-datos' + (viejo ? ' viejo' : '') + '"><i aria-hidden="true"></i>' +
    esc(!hace ? 'Datos sin fecha' : hace === 'recién' ? 'Datos recién actualizados'
      : 'Datos actualizados ' + hace) + '</span>' +
    (viejo ? '<span class="pie-nota">De 3 a 11 AM (hora del este) no se actualiza.</span>' : '');
  $('#pie').title = 'Se actualiza cada media hora.';
  try { pintaFase(); } catch (e) { console.error('[pintaFase]', e); }
}
function pinta() {
  // el punto de «nuevo» del changelog: un pedido chico a un archivo estático
  try { cargarCambios(null); } catch (e) { /* sin changelog, la página sigue */ }
  try { volverDeDiscord(); } catch (e) { console.error('[volverDeDiscord]', e); }
  pintaDatos();
  try { eventos(); } catch (e) { console.error('[eventos]', e); }
  ir();
  setInterval(pintaRelojes, 1000);
  // «En vivo» se dibuja ya con lo que dice el payload (lo que empezó), sin
  // esperar al vigía: si no contesta, igual se ve
  try { pintaVivo(); } catch (e) { console.error('[pintaVivo]', e); }
  try { pedirVivo(); } catch (e) { console.error('[pedirVivo]', e); }
  try { pedirEncuestas(); } catch (e) { console.error('[pedirEncuestas]', e); }
  try { pedirPrecios(); } catch (e) { console.error('[pedirPrecios]', e); }
  // ★ con Discord, a quién seguís sale del servidor (quien vuelve de Discord
  // lo pide al terminar de entrar: ver `volverDeDiscord()`)
  if (DC && !DC_VUELTA) {
    try { pedirSigo(); } catch (e) { console.error('[pedirSigo]', e); }
  }
  setInterval(refrescarDatos, 5 * 60000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && Date.now() - DATOS_PEDIDOS > 60000) refrescarDatos();
  });
}

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

fetch('/api/lobby', { headers: { accept: 'application/json' } })
  .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(function (d) { D = d; pinta(); })
  .catch(function (e) {
    // 🔴 QUE FALLE SE VE, Y NO COMO UNA PAGINA VACIA. Antes esto pintaba
    // la trama, escribía el error en la tabla y encendía **todos** los
    // paneles: con la API caída quedaban ONCE secciones vacías —podio,
    // medallero, comparador, países…— con sus títulos y nada adentro.
    // Parecía una liga sin nadie, que es peor que decir que no cargó.
    // Lo encontró la prueba de borde devolviendo un 503.
    trama();
    $$('.blk').forEach(function (s) { s.hidden = true; });
    $$('main .vista > .tit, main .vista > .bajada, .hero').forEach(
      function (s) { s.hidden = true; });
    var v = $$('.vista')[0];
    if (v) {
      v.hidden = false;
      v.insertAdjacentHTML('afterbegin',
        '<section class="blk entro" style="margin-top:0">' +
        '<h2><span>⚠️</span> No pude cargar los datos</h2>' +
        '<p class="bajada">El servidor contestó <code>' + esc(e.message) +
        '</code>. Los datos se refrescan solos cada media hora — probá ' +
        'recargar en un rato.</p></section>');
    }
  });
