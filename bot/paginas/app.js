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
var urlCarta = function (f, cual) {
  var v = (f.cv || {})[cual];
  return D.r2 + '/' + encodeURIComponent(f.k) + '/' + cual + '.webp' +
    (v ? '?v=' + v : '');
};
/* ¿La imagen de esa carta es de antes de los números de ahora? Ver
   `_versiones()` en bot/subir_web.py. */
var vieja = function (f, cual) {
  return (f.vj || []).indexOf(cual) >= 0;
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
var porK = function (k) {
  return (D.tabla || []).filter(function (x) { return x.k === k; })[0];
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
   🔴 POR HASH, NO POR RUTAS DE SERVIDOR. `#/ranking` lo resuelve el
   navegador sin pedirle nada a nadie: no hace falta que Pages sepa que
   esa ruta existe, el botón de atrás funciona solo y un link a
   `underlegends.pages.dev/#/tarjetas` abre directo ahí.

   Con rutas de verdad (`/ranking`) habría que servir el mismo HTML en
   cada una —una regla más que mantener— y cada cambio de vista sería
   una descarga. Acá el payload se baja UNA vez y las seis vistas ya
   están en la página.

   ⚠️ Y SE VUELVE ARRIBA AL CAMBIAR. Sin eso, entrar a «Tarjetas» desde
   el final del ranking te deja mirando la mitad de la galería sin
   entender por qué. */
function ruta() {
  return (location.hash || '#/').replace(/^#\/?/, '').split('?')[0];
}

// 🔑 `#/avisos` ES AHORA UN LUGAR ADENTRO DE «EVENTOS»: el botón de
// `/card` lleva ahí y no puede romperse. Se abre la vista y se baja hasta
// la campana.
// 🔑 `#/duelos` TAMBIÉN: Duelos pasó a ser un ranking (Dlx, 25/09/2026) y
// su lugar en el menú es del Pase. Los links viejos abren ese ranking.
var ALIAS = { avisos: 'eventos', duelos: 'ranking' };

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
  if (r === 'r') pintaPerfil(decodeURIComponent(partes.slice(1).join('/')));
  if (r === 'crew') pintaCrew(decodeURIComponent(partes.slice(1).join('/')));
  if (r === 'pais') pintaPais(partes[1] || '');
  if (r === 'cambios') cargarCambios(pintaCambios);
  // 🔑 `#/ranking/<sub>` ABRE ESE RANKING: es lo que usan los «Ver todo» del
  // Inicio, y deja mandar el link de un ranking puntual.
  if (r === 'ranking') {
    var sb = pedida === 'duelos' ? 'duelos' : partes[1];
    if (sb && SUBS[sb] && sb !== SUB) elegirSub(sb);
  }
  $$('#nav a').forEach(function (a) {
    a.classList.toggle('on', a.getAttribute('href') === '#/' + r);
  });
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
function pintaRelojes() {
  var ahora = Date.now();
  $$('.reloj').forEach(function (el) {
    var t = Date.parse(el.dataset.t + 'Z');
    if (isNaN(t)) { el.textContent = ''; return; }
    var f = t - ahora;
    if (f <= 0) { el.textContent = 'EN VIVO'; el.classList.add('vivo'); return; }
    el.classList.remove('vivo');
    var s = Math.floor(f / 1000), h = Math.floor(s / 3600),
        m = Math.floor(s % 3600 / 60), q = s % 60;
    var dd = function (n) { return (n < 10 ? '0' : '') + n; };
    el.textContent = h ? h + ':' + dd(m) + ':' + dd(q) : m + ':' + dd(q);
  });
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

  var pr = D.proximos || [];
  if (!pr.length) return;
  $('#viene').hidden = false;
  $('#eventos').innerHTML = pr.map(function (e) {
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
    return '<div class="ev"><div><b>' + tit + '</b><small>' + sub +
      '</small></div>' + der + '</div>';
  }).join('');
  pintaRelojes();
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
  return '<div class="hero-carta"><span class="corona">' + esc(tit) +
    '</span><button class="hc-marco" data-carta="' + esc(f.k) + '">' +
    '<img src="' + urlCarta(f, cual) + '" alt="Tarjeta de ' + esc(f.n) +
    '" width="300" height="438"></button><b data-k="' + esc(f.k) + '">' + esc(f.n) +
    '</b></div>';
}
function pintaCampeones() {
  var T = D.tabla || [], h = [];
  var uno = T[0];
  var comp = T.filter(function (f) { return f.rg; }).sort(function (a, b) {
    return (b.sc || 0) - (a.sc || 0);
  })[0];
  if (uno && (uno.c || []).length) h.push(campeon(uno, uno.c[0], 'Campeón de la temporada'));
  if (h.length && comp && (comp.c || []).length) {
    h.push(campeon(comp, comp.c.indexOf('competitivo') >= 0 ? 'competitivo' : comp.c[0],
      'Campeón del competitivo'));
  } else if (h.length) {
    var pide = reqDe('competitivo') || 10;
    var cerca = T.slice().sort(function (a, b) { return (b.ev || 0) - (a.ev || 0); })[0];
    h.push('<div class="hero-carta vacante"><span class="corona">Campeón del competitivo</span>' +
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
        var f = porK(kDe(r[0]));
        return f ? quienEs(f, 22) : conBanderas(r[0]);
      }) : [];
    var datos = [e.org ? 'Organizó <b>' + esc(e.org) + '</b>' : '',
      L && L.participantes ? L.participantes + ' raperos' : '',
      e.modalidad ? esc(e.modalidad) : ''].filter(Boolean).join(' &middot; ');
    // 🔑 EL RANGO DEL EVENTO, cuando el anuncio lo dice: es el de SU
    // servidor («aplica solo para el servidor local», Dlx 25/09/2026).
    var rg = e.rango ? '<span class="rg-ev" title="El rango de este evento en ' +
      esc(nombreSv(e.sv)) + '">' + esc(e.rango) + '</span>' : '';
    return '<article class="ps" style="--c:' + esc(colorSv(e.sv)) + '">' +
      '<header><span class="ps-chips">' + chipSv(e.sv) + rg + '</span>' +
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

function abrirLlave(n) {
  var L = (D.llaves || {})[n];
  if (!L) return;
  var k = {};
  (D.tabla || []).forEach(function (f) { k[f.n] = f.k; });
  // 🔑 CON SU CARA Y LA BANDERA A LA DERECHA, como en el ranking; tocar
  // un nombre abre su perfil
  var quien = function (x) {
    var f = k[x] && porK(k[x]);
    return f ? '<button class="ql" data-k="' + esc(f.k) + '">' + avatar(f, 18) +
      '<span>' + esc(f.n) + '</span>' + (bandera(f.cc) || '') + '</button>' : conBanderas(x);
  };
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
  $('#lSub').innerHTML = '<span class="l-chips">' + chipSv(L.sv) +
    (mod ? '<span class="lch">&#127908; ' + esc(mod) + '</span>' : '') +
    (rgo ? '<span class="rg-ev">' + esc(rgo) + '</span>' : '') + '</span>' +
    '<span class="l-datos">' + [cal ? esc(fmtFecha(cal.t, { weekday: 'short', day: 'numeric', month: 'short' })) +
      ' &middot; ' + esc(fmtHora(cal.t)) + ' ' + esc(zonaCorta(cal.t)) : esc(L.fecha),
    L.participantes ? esc(L.participantes) + ' raperos' : '',
    org ? 'organizó <b>' + esc(org) + '</b>' : '',
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
  }).join('');
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
    return rs.length ? '<div class="lp ' + p[2] + '"><span class="lp-m">' + p[1] + '</span>' +
      '<div>' + rs.map(function (r) { return quien(r[0]); }).join('') + '</div>' +
      '<small>' + p[0] + ' · ' + num(rs[0][2]) + ' pts</small></div>' : '';
  }).join('');
  // 🔑 CÓMO SE LEE, ARRIBA DEL CUADRO. Estaba abajo, en letra chica, y es
  // lo primero que hace falta para entender lo que sigue.
  var ley = '<div class="l-ley"><span class="ley-g"><i></i>Ganó y pasa de ronda</span>' +
    '<span class="ley-p"><i></i>Quedó afuera</span><span class="ley-o"><i></i>El camino del campeón</span>' +
    '<span class="ley-n">Arriba de cada ronda, los puntos de quien queda afuera ahí' +
    (window.matchMedia && window.matchMedia('(hover:hover)').matches
      ? '. Pasá el mouse por un nombre y se ve todo su camino.' : '.') + '</span></div>';
  $('#lCuerpo').innerHTML = (podio ? '<div class="lpod">' + podio + '</div>' : '') +
    ley + cuadro(L, quien) +
    (puntos ? '<h4>Los puntos, por puesto</h4><div class="pgs">' + puntos + '</div>' : '') +
    (links ? '<div class="v-acc">' + links + '</div>' : '');
  $('#visorLlave').hidden = false;
  $('#lCuerpo').scrollTop = 0;
  // en espejo la final va en el medio: se arranca mirándola
  var cc = $('#lCuerpo .cuadro-caja');
  if (cc && window.innerWidth >= 760 && cc.scrollWidth > cc.clientWidth) {
    cc.scrollLeft = (cc.scrollWidth - cc.clientWidth) / 2;
  }
  document.body.style.overflow = 'hidden';
}

function cerrarLlave() {
  $('#visorLlave').hidden = true;
  if ($('#visor').hidden) document.body.style.overflow = '';
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
  var T = D.tabla || [];
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
    gente: (D.duelos || []).slice(0, 3).map(function (d) {
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
  var T = D.tabla || [];
  var mejor = function (ok) { return T.filter(ok)[0]; };
  var item = function (cab, f, extra) {
    return '<div class="uno">' + cab + '<div class="uno-q" data-k="' + esc(f.k) + '">' +
      avatar(f, 34) + '<span><b>' + esc(f.n) + '</b><small>#' + esc(f.pos) + ' · OVR ' +
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
  pos: { t: '#', cls: 'c-pos', s: function (f) { return f.pos; }, v: function (f) { return esc(f.pos); } },
  i: { t: '#', cls: 'c-pos', s: function (f) { return f._i; }, v: function (f) { return f._i || nada; } },
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
      return MW_ON ? '' : '<b>Most Wanted</b> y <b>Misiones</b> arrancan pronto: hasta ' +
        'entonces sus columnas van en &mdash;.';
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
  mw: { pronto: '<b>Most Wanted</b>: quién cazó, quién fue cazado y quién sobrevivió. ' +
    'Suma al OVR y arranca pronto.' },
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
  pintaTabla();
}

function pintaTabla() {
  var cfg = SUBS[SUB] || SUBS.temporada;
  MW_ON = (D.tabla || []).some(function (f) { return f.caz || f.czd || f.sob; });
  $('#bajadaRk').innerHTML = cfg.baj || cfg.pronto || '';
  $('#chipsSv').hidden = $('#chipsCc').hidden = !!(cfg.sinChips || cfg.pronto);
  $('#buscar').hidden = !!cfg.pronto;
  var nota = cfg.nota ? cfg.nota() : '';
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
  base.forEach(function (f, i) { f._i = cfg.sinPuesto && cfg.sinPuesto(f) ? '' : i + 1; });
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
      cfg.fila ? cfg.fila(f) : ''].filter(Boolean).join(' ');
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
  var q = (FIL.qc || '').toLowerCase();
  var hay = conTarjeta();
  var con = hay.filter(function (f) {
    return !q || String(f.n || '').toLowerCase().indexOf(q) >= 0;
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
  var q = String(inp.value || '').trim().toLowerCase();
  // ⚠️ POR CONTENIDO Y NO POR PREFIJO: «chula» tiene que encontrar a
  // PichulaMc. Los que empiezan igual van primero igual, porque es lo
  // que uno espera al escribir las primeras letras.
  var empieza = [], dentro = [];
  con.forEach(function (f, i) {
    var n = String(f.n).toLowerCase();
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

function cuadro(L, quien) {
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
    var disp = Math.min(1400, window.innerWidth * 0.97) - 44;
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
  // ⚠️ LUGAR PARA EL CAMPEÓN ARRIBA DE LA FINAL: en una llave chica la
  // final queda pegada al techo y el nombre se cortaba.
  var pf = pos[(n - 1) + ':0'];
  var hayCamp = !!(pf && (rs[n - 1].b[0] || [])[1] && rs[n - 1].b.length === 1);
  // el alto del campeón: un renglón por integrante del equipo ganador
  var campH = hayCamp ? 20 + LINEA * miembros(rs[n - 1].b[0][1]) : 0;
  if (hayCamp) {
    var sobra = pf.y - alto(rs[n - 1].b[0]) / 2 - campH - 12;
    if (sobra < 0) TOPE -= sobra;
  }
  // 🔑 CUÁNTO VALE CADA RONDA, arriba de su columna: los puntos de quien
  // queda afuera ahí. Es lo que ata el cuadro con «Los puntos, por puesto»
  // de abajo, que antes había que cruzar a mano. Sale de la tabla de la
  // misma llave; si en una ronda no todos se llevan lo mismo (las semis con
  // tercer puesto), no se escribe nada antes que un número a medias.
  var ptsDe = {};
  (L.tabla || []).forEach(function (t) {
    miembrosDe(t[0]).forEach(function (m) { ptsDe[m] = t[2]; });
  });
  var valeRonda = function (R) {
    var vs = [];
    R.b.forEach(function (b) {
      (b[0] || []).forEach(function (s) {
        if (b[1] && (b[1] === s || comparten(b[1], s))) return;
        miembrosDe(s).forEach(function (m) { if (ptsDe[m] != null) vs.push(ptsDe[m]); });
      });
    });
    return vs.length && vs.every(function (v) { return v === vs[0]; }) ? vs[0] : null;
  };
  var vale = rs.map(valeRonda);
  var ptsCamp = (function () {
    var m = miembrosDe((rs[n - 1].b[0] || [])[1])[0];
    return m && ptsDe[m] != null ? ptsDe[m] : null;
  })();
  if (vale.some(function (v) { return v != null; })) TOPE += 14;
  var ncol = espejo ? 2 * n - 1 : n;
  var col = function (p) { return p.lado === 'd' ? 2 * (n - 1) - p.r : p.r; };
  var X = function (p) { return col(p) * (W + G); };
  var campeon = (rs[n - 1].b[0] || [])[1] || '';

  // el nombre, o los del equipo, cada uno con su tarjeta si la tiene
  var lado = function (x) {
    return String(x || '').split(/,\s*/).map(function (m) {
      return quien(m);
    }).join('<i class="coma">,</i> ');
  };
  var caja = function (b, x, y, cl) {
    var h = alto(b);
    return '<div class="bx' + (cl || '') + '" style="left:' + x + 'px;top:' +
      Math.round(y - h / 2) + 'px;width:' + W + 'px;height:' + h + 'px"' +
      (b[2] ? ' title="' + esc(b[2]) + '"' : '') + '>' + b[0].map(function (s) {
        var g = b[1] && (b[1] === s || comparten(b[1], s));
        var eq = miembros(s) > 1;
        return '<div class="ld' + (g ? ' g' : '') + (eq ? ' eq' : '') + '" style="height:' + altoLado(s) +
          'px" title="' + esc(s) + '"><span class="nm">' + (eq ? String(s).split(/,\s*/).map(function (m) {
            return '<span class="mb">' + quien(m) + '</span>';
          }).join('') : lado(s)) + '</span></div>';
      }).join('') + '</div>';
  };

  var fondo = TOPE + H;
  var html = [], lineas = [];
  Object.keys(pos).forEach(function (k) {
    var p = pos[k], b = rs[p.r].b[p.i];
    var esFinal = p.r === n - 1 && rs[n - 1].b.length === 1;
    html.push(caja(b, X(p), TOPE + p.y, esFinal ? ' fin' : ''));
    hijos(p.r, p.i).forEach(function (j) {
      var c = pos[(p.r - 1) + ':' + j];
      if (!c) return;
      var x1 = c.lado === 'd' ? X(c) : X(c) + W,
          x2 = c.lado === 'd' ? X(p) + W : X(p),
          y1 = TOPE + c.y, y2 = TOPE + p.y, xm = (x1 + x2) / 2;
      var oro = campeon && comparten(rs[c.r].b[c.i][1], campeon) &&
        comparten(b[1], campeon);
      lineas.push('<path' + (oro ? ' class="oro"' : '') + ' d="M' + x1 + ' ' + y1 +
        'H' + xm + 'V' + y2 + 'H' + x2 + '"/>');
    });
  });
  // el campeón, arriba de la final
  if (hayCamp) {
    var hf = alto(rs[n - 1].b[0]);
    html.push('<div class="camp' + (miembros(campeon) > 1 ? ' eq' : '') + '" style="left:' + (X(pf) - 20) +
      'px;width:' + (W + 40) + 'px;top:' + Math.round(TOPE + pf.y - hf / 2 - campH - 8) +
      'px"><small>&#127942; Campeón</small>' + (miembros(campeon) > 1
        ? String(campeon).split(/,\s*/).map(function (m) { return '<span class="mb">' + quien(m) + '</span>'; }).join('')
        : lado(campeon)) + '</div>');
  }
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
          (fin && ptsCamp != null ? (v != null ? ' &middot; ' : '') + '&#127942; ' + num(ptsCamp) : '') +
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
function colorVisible(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex || '#7E8B89';
  var n = parseInt(m[1], 16);
  var r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2,
      d = mx - mn, h = 0, s = 0;
  if (l >= 0.5) return '#' + m[1];
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
      (k === hoyK ? ' hoy' : '') + (k === CAL.dia ? ' sel' : '') +
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
  var evs = (M[CAL.dia] || []).slice().sort(function (a, b) {
    return a.t < b.t ? -1 : 1;
  });
  var d = CAL.dia ? new Date(CAL.dia + 'T12:00:00') : null;
  var txt = d ? d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  $('#diaTit').innerHTML = '<span>&#128197;</span> ' +
    (txt ? esc(txt.charAt(0).toUpperCase() + txt.slice(1)) : 'El día') +
    (evs.length ? '<small class="dia-n">' + evs.length + (evs.length === 1 ? ' evento' : ' eventos') +
      ' &middot; hora ' + esc(zonaCorta(evs[0].t)) + '</small>' : '');
  if (!evs.length) {
    $('#diaLista').innerHTML = '<p class="dia-no">Ese día no hubo eventos.</p>';
    return;
  }
  // 🔑 CADA EVENTO, UNA TARJETA: la hora grande a la izquierda, lo que es
  // arriba y lo que se puede hacer abajo, en una fila. Dlx, 25/09/2026: «la
  // zona de la derecha está rara, quizás podamos reorganizarlo mejor».
  $('#diaLista').innerHTML = evs.map(function (e) {
    var L = e.ll && (D.llaves || {})[e.ll];
    var inf = (L && L.info) || {};
    var mod = e.mod || inf.mod || '';
    var camp = L ? (L.tabla || []).filter(function (r) { return r[1] === 'Campeón'; }) : [];
    var acc = (e.ll ? '<button class="btn" data-llave="' + e.ll + '">&#127942; Ver llave</button>' : '') +
      (e.fut ? '<a class="btn" href="' + esc(googleEv(e)) + '" target="_blank" ' +
        'rel="noopener noreferrer">&#128197; Agregar a Google</a>' : '') +
      (e.link ? '<a class="btn sec" href="' + esc(e.link) + '" target="_blank" ' +
        'rel="noopener noreferrer">Discord &#8599;</a>' : '');
    var estado = e.fut ? 'por jugarse' : e.jugado ? 'jugado' : 'anunciado';
    return '<article class="de" style="--c:' + esc(colorSv(e.sv)) + '">' +
      '<div class="de-t"><b>' + esc(fmtHora(e.t)) + '</b>' + (e.sh ? '<small>anunciado</small>' : '') +
      '</div><div class="de-c"><h3>' + esc(e.n) + '</h3>' +
      '<div class="de-sub">' + chipSv(e.sv) + (mod ? '<span class="lch">&#127908; ' + esc(mod) + '</span>' : '') +
      (e.rg || inf.rg ? '<span class="rg-ev">' + esc(e.rg || inf.rg) + '</span>' : '') +
      '<span class="de-est ' + (e.fut ? 'fut' : e.jugado ? 'jug' : '') + '">' + estado + '</span></div>' +
      (camp.length ? '<p class="de-camp"><span>&#127942;</span>' + camp.map(function (r) {
        var f = porK(kDe(r[0]));
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
        var f = porK(kDe(r[0]));
        return f ? quienEs(f, 22) : conBanderas(r[0]);
      }).join('<i class="coma">,</i> ') : '—') + '</span>' +
      '<small class="uc-d">' + [inf.mod ? esc(inf.mod) : '', L.participantes ? L.participantes + ' raperos' : '']
        .filter(Boolean).join(' &middot; ') + '</small></button>';
  }).join('');
}
function pintaFormatos() {
  var ls = jugadas();
  var fmt = {}, org = {}, con = 0, gente = 0;
  ls.forEach(function (c) {
    var L = D.llaves[c.ll], inf = L.info || {};
    if (inf.mod) {
      var m = inf.mod.trim().replace(/\s+/g, ' ');
      var k = m.toLowerCase();
      fmt[k] = fmt[k] || { n: 0, t: m };
      fmt[k].n++;
      con++;
    }
    if (inf.org) org[inf.org] = (org[inf.org] || 0) + 1;
    gente += L.participantes || 0;
  });
  var fs = Object.keys(fmt).map(function (k) { return fmt[k]; }).sort(function (a, b) { return b.n - a.n; });
  var os = Object.keys(org).map(function (k) { return [k, org[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  if (!fs.length && !os.length) { apaga('#secFormatos'); return; }
  $('#secFormatos').hidden = false;
  var max = fs.length ? fs[0].n : 1;
  $('#formatos').innerHTML =
    (fs.length ? '<h3 class="gh">Formatos</h3>' + fs.slice(0, 6).map(function (x) {
      return '<div class="gp"><span>' + esc(x.t) + '</span><i><u style="width:' +
        Math.round(100 * x.n / max) + '%"></u></i><b>' + x.n + '</b></div>';
    }).join('') : '') +
    (os.length ? '<h3 class="gh">Quién organiza</h3><div class="orgs">' + os.slice(0, 8).map(function (x) {
      return '<span class="org">' + esc(x[0]) + '<u>' + x[1] + '</u></span>';
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
        ' &middot; ' + esc(fmtHora(prox.t)) + ' ' + esc(zonaCorta(prox.t)) + '</span></div>' +
      '<span class="reloj" data-t="' + esc(prox.t.replace(/Z$/, '')) + '">&middot;</span></div>';
  } else if (ult) {
    h += '<div class="evc-prox" style="--c:' + esc(colorSv(ult.sv)) + '">' +
      '<span class="evc-et">El último campeón</span>' +
      (camp.length ? '<b class="evc-n1">' + camp.map(function (r) {
        var f = porK(kDe(r[0]));
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
    '<a class="btn sec" href="https://calendar.google.com/calendar/render?cid=' +
      encodeURIComponent('webcal://' + ICS_HOST + '/calendario.ics') + '" target="_blank" ' +
      'rel="noopener noreferrer">&#128197; Sumar a Google Calendar</a>' +
    '<a class="btn sec" href="webcal://' + esc(ICS_HOST) + '/calendario.ics">Apple · Outlook</a></div>';
  $('#evCab').innerHTML = h;
  $('#evCab').hidden = false;
  pintaRelojes();
}

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
  var T = D.tabla || [];
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
  cajas.push(['&#129354;', 'Duelos <u>ganados</u>', '#/ranking/duelos', (D.duelos || []).slice(0, TOP).map(function (d, i) {
    return fila(d, i, d.g + '<s>/' + d.t + '</s>');
  })]);
  var med = T.filter(function (f) { return (f.oro || 0) + (f.seg || 0) + (f.ter || 0) > 0; })
    .sort(medallero).slice(0, TOP);
  cajas.push(['&#127941;', 'Podios', '#/ranking/podios', med.map(function (f, i) {
    return fila(f, i, [['&#129351;', f.oro], ['&#129352;', f.seg], ['&#129353;', f.ter]]
      .filter(function (x) { return x[1]; }).map(function (x) {
        return x[0] + x[1];
      }).join(' '));
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
    rs = D.rachas.slice(0, TOP).map(function (r) { return { n: r.n, k: r.k, cc: r.cc, rch: [r.r, r.r] }; });
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
  cajas.push(['&#128128;', 'Most Wanted', '', [],
    'Quién cazó, quién fue cazado y quién sobrevivió. <b>Próximamente</b>.', 'pronto']);
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
    return '<div class="gt" data-k="' + esc(f.k) + '"><span class="gt-p">#' + esc(f.pos) + '</span>' +
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
    .sort(function (a, b) { return (a.pos || 999) - (b.pos || 999); });
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
    .sort(function (a, b) { return (a.pos || 999) - (b.pos || 999); });
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
  document.title = f.n + ' · Liga Global de Freestyle';
  var sv = svDe(f.sv);
  var cartas = f.c || [];
  var cual = PERF_CARTA[k] && cartas.indexOf(PERF_CARTA[k]) >= 0 ? PERF_CARTA[k] : cartas[0];
  var rg = f.rg ? '<span class="rg pf-rg" style="color:' + esc(f.rgc || '') + ';border-color:' +
    esc(f.rgc || '#1A2523') + '">' + esc(f.rg) + '</span>' : '';
  var sub = [
    f.cc ? '<a class="pf-pais" href="#/pais/' + esc(f.cc) + '">' + bandera(f.cc) + ' ' +
      esc(nombrePais(f.cc)) + '</a>' : '',
    f.sv ? chipSv(f.sv) : '',
  ].filter(Boolean).join(' <i class="sep">·</i> ');
  var med = [['&#129351;', f.oro], ['&#129352;', f.seg], ['&#129353;', f.ter]];
  caja.innerHTML =
    '<a class="volver" href="#/ranking">&#8249; Ranking</a>' +
    '<header class="pf-cab">' + avatar(f, 116) +
      '<div class="pf-id"><span class="pf-pos">' + (f.pos && f.pos !== '—' ? '#' + esc(f.pos) +
        ' de la temporada' : 'Todavía sin eventos esta temporada') + '</span>' +
      '<h1 class="tit">' + esc(f.n) + '</h1><p class="pf-sub">' + sub +
      '<span id="pfCrew"></span></p><p class="pf-redes" id="pfRedes" hidden></p>' +
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
              return '<button class="pest' + (c === cual ? ' on' : '') + '" data-pfc="' + c + '">' +
                (CARTA_TIT[c] || c) + '</button>';
            }).join('') + '</div><div class="pf-carta"><img id="pfImg" alt="Tarjeta ' +
            esc(CARTA_TIT[cual] || cual) + ' de ' + esc(f.n) + '" src="' + urlCarta(f, cual) +
            '"></div><div class="v-acc"><button class="bajar" id="pfBajar" data-pfk="' + esc(k) +
            '"><i aria-hidden="true">&#11015;</i><span>Descargar</span></button></div>'
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
        '<section class="blk entro"><h2><span>&#127919;</span> Lo que le falta</h2>' +
          '<div class="pf-req" id="pfReq"><p class="nota">Cargando…</p></div></section>' +
        '<section class="blk entro" id="pfRkSec" hidden><h2><span>&#127942;</span> En cada ranking</h2>' +
          '<div class="pf-rk" id="pfRk"></div></section>' +
      '</div>' +
    '</div>' +
    '<section class="blk entro" id="pfEvSec" hidden><h2><span>&#128197;</span> Sus eventos</h2>' +
      '<div class="pf-ev" id="pfEv"></div></section>' +
    '<section class="blk entro" id="pfDuSec" hidden><h2><span>&#9876;</span> Sus duelos</h2>' +
      '<div class="pf-du" id="pfDus"></div></section>';

  // ── lo que viene de /api/perfiles
  perfiles().then(function (P) {
    if (ruta() !== 'r/' + encodeURIComponent(k) && ruta() !== 'r/' + k) return;
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
    var dus = x.du || [];
    var g = dus.filter(function (d) { return d[2]; }).length;
    $('#pfDu').innerHTML = dus.length ? g + '<s>/' + dus.length + '</s>' : '—';
    $('#pfRd').innerHTML = x.rd ? x.rd[0] + '<s> · máx ' + x.rd[1] + '</s>' : '—';
    // lo que le falta, por tarjeta y por condición
    var req = x.req || {};
    $('#pfReq').innerHTML = ['temporada', 'competitivo', 'pais'].map(function (c) {
      var tiene = cartas.indexOf(c) >= 0;
      var cs = req[c] || [];
      var listo = tiene || cs.every(function (q) { return q[0] >= q[1]; });
      return '<div class="rq' + (listo ? ' ok' : '') + '"><h3>' + (CARTA_TIT[c] || c) +
        '<span>' + (listo ? '&#10003; Desbloqueada' : 'Bloqueada') + '</span></h3>' +
        (listo ? '' : cs.map(function (q) {
          var pct = Math.max(0, Math.min(100, Math.round(100 * q[0] / (q[1] || 1))));
          return '<div class="rq-l"><span>' + esc(Math.min(q[0], q[1])) + '/' + esc(q[1]) + ' ' +
            esc(String(q[2]).toLowerCase()) + '</span><i><u style="width:' + pct + '%"></u></i></div>';
        }).join('')) + '</div>';
    }).join('');
    // en cada ranking
    var rk = x.rk || {}, filas = [];
    filas.push(['Temporada', '#' + f.pos + ' de ' + (D.gente || (D.tabla || []).length)]);
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
        var ll = (D.llaves || {})[e[0]]
          ? '<button class="ver-llave" data-llave="' + esc(e[0]) + '">Ver llave</button>' : '';
        return '<div class="pe" style="--c:' + esc(colorSv(m[1])) + '"><span class="pe-f">' + esc(fecha) +
          '</span><div><b>' + esc(m[0] || ('Evento #' + e[0])) + '</b><small>' +
          esc(nombreSv(m[1])) + (m[3] ? ' · ' + m[3] + ' raperos' : '') + '</small>' + ll + '</div>' +
          '<span class="pe-p">' + (MEDALLA[e[1]] ? MEDALLA[e[1]] + ' ' : '') + esc(e[1]) + '</span>' +
          '<b class="pe-pts">' + num(e[2]) + '</b></div>';
      }).join('');
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
/* la clave de alguien por su nombre, para los rivales de los duelos */
var K_DE = null;
function kDe(n) {
  if (!K_DE) {
    K_DE = {};
    (D.tabla || []).forEach(function (f) { K_DE[f.n] = f.k; });
  }
  return K_DE[n] || '';
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
      '<span class="br-p">#' + esc(f.pos) + '</span></button>';
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
  }).join('') + '</dl>';
  caja.hidden = false;
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
      '<h3>' + esc(f.n) + '</h3><p class="yo-pos">#' + esc(f.pos) + ' de la temporada</p>' +
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
      esc(zonaCorta(prox.t)) + '</p><span class="reloj" data-t="' + esc(prox.t.replace(/Z$/, '')) +
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
   🔑 Dlx, 25/09/2026, a las ideas de Mi cuenta: «todas». Seguir a alguien es
   de este dispositivo, como `lg:yo`: no viaja a ningún lado y no hace falta
   entrar con Discord. Se ve en tres lugares: el botón del perfil, la lista
   de Mi cuenta y una ★ al lado de su nombre en toda la página. */
var SIGO = leerLS('lg:sigo', []);
if (!Array.isArray(SIGO)) SIGO = [];
function sigoA(k) { return !!k && SIGO.indexOf(k) >= 0; }
function alternarSigo(k) {
  var i = SIGO.indexOf(k);
  if (i >= 0) SIGO.splice(i, 1); else SIGO.unshift(k);
  SIGO = SIGO.slice(0, 60);
  guardarLS('lg:sigo', SIGO.length ? SIGO : null);
}
function botonSigo(k) {
  var si = sigoA(k);
  return '<button type="button" class="btn sec seguir' + (si ? ' on' : '') + '" data-seguir="' +
    esc(k) + '" aria-pressed="' + si + '">' + (si ? '&#9733; Siguiendo' : '&#9734; Seguir') + '</button>';
}
/* lo que va en Mi cuenta: a quién seguís, con su puesto de hoy */
function secSigo() {
  var fs = SIGO.map(function (k) { return porK(k); }).filter(Boolean);
  if (!fs.length) return '';
  return '<section class="pop-sec"><h4>&#9733; Siguiendo <small>' + fs.length + '</small></h4>' +
    '<div class="pop-sigo">' + fs.slice(0, 6).map(function (f) {
      return '<a href="#/r/' + encodeURIComponent(f.k) + '">' + avatar(f, 26) + '<span class="ps-n">' +
        esc(f.n) + '</span><span class="ps-d">' + (f.pos && f.pos !== '—' ? '#' + esc(f.pos) : '—') +
        ' &middot; OVR ' + (f.ovr || '—') + '</span></a>';
    }).join('') + '</div>' + (fs.length > 6 ? '<p class="nota">y ' + (fs.length - 6) +
      ' más: tienen la &#9733; en el ranking.</p>' : '') + '</section>';
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
function urlLogin(conRedes) {
  var st = (conRedes ? 'r' : 'i') + Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { sessionStorage.setItem('lg:estado', st); } catch (e) { /* sin sesión: igual anda */ }
  return 'https://discord.com/oauth2/authorize?client_id=' + DC_APP + '&response_type=token' +
    '&redirect_uri=' + encodeURIComponent(location.origin + '/') +
    '&scope=' + encodeURIComponent(conRedes ? 'identify connections' : 'identify') +
    '&prompt=' + (conRedes ? 'consent' : 'none') + '&state=' + encodeURIComponent(st);
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
  var cab = '<section class="pop-sec" id="secRedes"><h4>&#128279; Mis redes en mi perfil</h4>';
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
    return '<label><input type="checkbox" value="' + esc(id) + '"' + (nada || ya[id] ? ' checked' : '') +
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
    if (i > 0) q[decodeURIComponent(x.slice(0, i))] = decodeURIComponent(x.slice(i + 1));
  });
  try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (e) { location.hash = '#/'; }
  var st = '';
  try { st = sessionStorage.getItem('lg:estado') || ''; sessionStorage.removeItem('lg:estado'); } catch (e) { st = ''; }
  if (!q.access_token || !st || q.state !== st) return;
  var porRedes = st.charAt(0) === 'r';
  if (porRedes) DC_TOKEN = q.access_token;
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
      pintaCuenta();
      pintaPaneles();
      pintaPopCuenta();
      $('#popCuenta').hidden = false;
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
}
function pintaPopCuenta() {
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
      '<a href="#/guia">&#128247; Cambiar mi foto <small>/foto</small></a>' +
      '<button type="button" id="yoOlvidar">Salir</button></nav>' + secRedes() + secProximos() + secSigo();
    return;
  }
  if (!f && DC) {
    c.innerHTML = '<div class="pop-yo">' + avatar({ n: DC.n, av: DC.av }, 46) + '<div><b>' +
      esc(DC.n) + '</b><small>Conectado con Discord</small></div></div>' +
      '<p class="nota">Todavía no tenés tarjeta en la Liga. Escribí <code>/verificar</code> en ' +
      'Discord: te dice qué te falta.</p><nav class="pop-menu">' +
      '<a href="#/guia">&#127915; Cómo conseguir tu tarjeta</a>' +
      '<a href="#/avisos">&#128276; Mis avisos</a>' +
      '<button type="button" id="yoOlvidar">Salir</button></nav>' + secProximos() + secSigo();
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
  c.innerHTML = '<div class="pop-yo">' + avatar(f, 46) + '<div><b>' + esc(f.n) + '</b><small>#' +
    esc(f.pos) + ' de la temporada · OVR ' + (f.ovr || '—') +
    (DC ? ' · con Discord' : '') + '</small></div></div>' +
    '<nav class="pop-menu">' +
    '<a href="#/r/' + encodeURIComponent(f.k) + '">&#128100; Mi perfil</a>' +
    ((f.c || []).length ? '<button type="button" data-carta="' + esc(f.k) + '">&#127183; Mis tarjetas</button>' : '') +
    (f.cc && PAIS[String(f.cc).toLowerCase()] ? '<a href="#/pais/' + esc(f.cc) + '">' + bandera(f.cc) + ' Mi país</a>' : '') +
    '<a href="#/avisos">&#128276; Mis avisos</a>' +
    (DC ? '<a href="#/guia">&#128247; Cambiar mi foto <small>/foto</small></a>' : '') +
    '<button type="button" id="yoOlvidar">' + (DC ? 'Salir' : 'No soy yo') + '</button></nav>' +
    (DC ? '' : '<p class="nota">¿Es tu cuenta? Entrá con Discord y queda confirmado.</p>' + entrar) +
    secRedes() + secProximos() + secSigo();
}
function pintaYoRes(q) {
  var caja = $('#yoRes');
  if (!caja) return;
  q = sinTildes(q).trim();
  var fs = q ? (D.tabla || []).filter(function (f) { return sinTildes(f.n).indexOf(q) >= 0; }).slice(0, 6) : [];
  caja.innerHTML = fs.map(function (f) {
    return '<button type="button" class="br" data-yo="' + esc(f.k) + '">' + quienEs(f, 24) +
      '<span class="br-p">#' + esc(f.pos) + '</span></button>';
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
    '</a>';
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
    return '<article class="cambio' + (nueva ? ' es-nuevo' : '') + '">' +
      '<header>' + (x.version ? '<span class="ver-et">v' + esc(x.version) + '</span>' : '') +
      '<time datetime="' + esc(x.dia) + '">' + esc(f) + '</time>' +
      (nueva ? '<span class="nuevo-et">Nuevo</span>' : '') +
      '<h2>' + esc(x.titulo) + '</h2></header><ul>' +
      (x.items || []).map(function (i) { return '<li>' + mdCorto(i) + '</li>'; }).join('') +
      '</ul></article>';
  }).join('') || '<p class="nota">Todavía no hay nada anotado.</p>';
  if (CAMBIOS.length) {
    CAMBIOS_VISTO = versionDe(CAMBIOS[0]);
    guardarLS('lg:cambios', CAMBIOS_VISTO);
    puntoCambios();
  }
}
// lo que depende de la hora se vuelve a dibujar al cambiar la zona o el formato
function repintarHoras() {
  [pintaCalendario, pintaEvCab, pintaPaneles, pintaUltCampeones].forEach(function (f) {
    try { f(); } catch (e) { console.error('[' + f.name + ']', e); }
  });
  if (ruta().indexOf('r/') === 0) ir();
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
      $('#pfImg').alt = 'Tarjeta ' + (CARTA_TIT[b.dataset.pfc] || '') + ' de ' + f.n;
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
    var sg = e.target.closest('[data-seguir]');
    if (sg) {
      alternarSigo(sg.dataset.seguir);
      sg.outerHTML = botonSigo(sg.dataset.seguir);
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
    var rg = e.target.closest('#dcRedesGuardar,#dcRedesQuitar');
    if (rg) {
      var elegidas = rg.id === 'dcRedesQuitar' ? [] : $$('#secRedes input:checked').map(function (x) {
        return x.value;
      });
      rg.disabled = true;
      pedirRedes(elegidas).then(function (R) {
        if (R && R.guardadas) REDES_MIAS = R;
        pintaPopCuenta();
        var n = $('#redesNota');
        if (n) n.innerHTML = R && R.guardadas ? '&#10003; Guardado. ' + (R.guardadas.length ? 'Tu perfil va a ' +
          'mostrar ' + R.guardadas.length + (R.guardadas.length === 1 ? ' red' : ' redes') : 'Tu perfil no ' +
          'muestra ninguna') + ' desde la próxima actualización (cada media hora).' : 'No pude guardar. Probá de nuevo.';
      }).catch(function () { rg.disabled = false; });
      return;
    }
    if (e.target.closest('#yoOlvidar')) {
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
  });
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
    try { history.replaceState(null, '', '#/ranking/' + b.dataset.sub); } catch (x) { /* nada */ }
  });
  // las flechas del feed
  $('#feedAntes').addEventListener('click', function () { FEED.pag--; pintaFeed(); });
  $('#feedDespues').addEventListener('click', function () { FEED.pag++; pintaFeed(); });
  $('#novAntes').addEventListener('click', function () { NOV.pag--; pintaNovedades(); });
  $('#novDespues').addEventListener('click', function () { NOV.pag++; pintaNovedades(); });
  $('#pnAntes').addEventListener('click', function () { PN.pag--; pintaPaneles(); });
  $('#pnDespues').addEventListener('click', function () { PN.pag++; pintaPaneles(); });
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
  // 🔑 SEGUIR A ALGUIEN POR LA LLAVE: con el mouse encima de un nombre se
  // iluminan todas las batallas donde está. En el teléfono no hay «encima»:
  // tocar el nombre sigue abriendo su perfil.
  var SIGUE = '';
  document.addEventListener('mouseover', function (e) {
    var q = e.target.closest && e.target.closest('.cuadro .ql[data-k]');
    var k = q ? q.dataset.k : '';
    if (k === SIGUE) return;
    SIGUE = k;
    $$('.cuadro .sigue').forEach(function (x) { x.classList.remove('sigue'); });
    if (!k) return;
    $$('.cuadro .ql').forEach(function (x) {
      if (x.dataset.k !== k) return;
      x.classList.add('sigue');
      var bx = x.closest('.bx,.camp');
      if (bx) bx.classList.add('sigue');
    });
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
    if (e.target.closest('[data-cerrar-llave]')) cerrarLlave();
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-llave]');
    if (b) abrirLlave(b.dataset.llave);
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

  window.addEventListener('hashchange', ir);
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

function pinta() {
  // el punto de «nuevo» del changelog: un pedido chico a un archivo estático
  try { cargarCambios(null); } catch (e) { /* sin changelog, la página sigue */ }
  volverDeDiscord();
  // 🔴 CADA SECCIÓN, AISLADA. Una que falla —un dato que llega con otra
  // forma, o el HTML viejo en caché con este JS nuevo— queda sin dibujar y
  // el resto de la página sale igual. Antes un error en cualquier `pinta*`
  // cortaba todos los que venían después, y los escuchas no se colgaban:
  // una sección rota apagaba la página entera. El error queda en la
  // consola con el nombre de la sección.
  [trama, pintaHero, pintaPasados, pintaPodio, pintaChips, pintaTabla, pintaGaleria,
    pintaComparar, pintaServidores, pintaPaises, pintaRangos, pintaComo, pintaGuia,
    pintaTops, pintaMapa, pintaActividad, pintaComunidad, pintaFeed, pintaNovedades, pintaCalendario, pintaEvCab,
    pintaUltCampeones, pintaFormatos, pintaCuenta, pintaPaneles, aplicarCalma]
    .forEach(function (f) {
      try { f(); } catch (e) { console.error('[' + f.name + ']', e); }
    });
  // 🔴 LA FECHA QUE SE MUESTRA ES LA DE LOS DATOS, NO LA DE LA COPIA.
  // `sello` es cuándo se escribió el payload y se puede mover sin que
  // los datos se muevan —correr `subir_web.py` a mano lo pone en
  // «recién» con anuncios de hace dos horas—. Dlx lo vio tal cual.
  $('#pie').textContent = (enPrueba() ? 'Fase de prueba' : 'Temporada ' + (D.temporada || '')) +
    ' · datos ' + (cuandoSe(D.leido || D.sello) || 'sin fecha');
  try { pintaFase(); } catch (e) { console.error('[pintaFase]', e); }
  try { eventos(); } catch (e) { console.error('[eventos]', e); }
  ir();
  setInterval(pintaRelojes, 1000);
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
