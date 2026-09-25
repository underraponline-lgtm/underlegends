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
var ALIAS = { avisos: 'eventos' };

function ir() {
  var pedida = ruta(), r = ALIAS[pedida] || pedida;
  var hay = $$('.vista').some(function (v) { return v.dataset.vista === r; });
  if (!hay) { r = ''; }
  $$('.vista').forEach(function (v) { v.hidden = v.dataset.vista !== r; });
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
  var ancla = pedida !== r && document.getElementById(pedida);
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

  // La tarjeta del #1, si la tiene. Si no, no se dibuja el hueco.
  var uno = (D.tabla || [])[0];
  if (uno && (uno.c || []).length) {
    $('#hcImg').src = urlCarta(uno, uno.c[0]);
    $('#hcImg').alt = 'Tarjeta de ' + uno.n;
    $('#hcNombre').textContent = uno.n;
    $('#hcBtn').dataset.k = uno.k;
    $('#heroCarta').hidden = false;
  }

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

/* ── lo que acaba de pasar ────────────────────────────────────────── */
function pintaPasados() {
  var ps = D.pasados || [];
  if (!ps.length) { apaga('#secPaso'); return; }
  $('#secPaso').hidden = false;
  $('#pasados').innerHTML = ps.map(function (e) {
    var sub = [e.sv, e.modalidad].filter(Boolean).map(esc).join(' &middot; ');
    var tit = e.link
      ? '<a href="' + esc(e.link) + '" target="_blank" rel="noopener ' +
        'noreferrer">' + esc(e.nombre) + '<i class="ir">&#8599;</i></a>'
      : esc(e.nombre);
    // 🔑 «VER LLAVE» SÓLO SI LA LLAVE VINO EN EL PAYLOAD. Un botón que
    // abre una ventana vacía es peor que no tenerlo: sin dato no hay pieza.
    var ll = e.llave && (D.llaves || {})[e.llave]
      ? '<button class="ver-llave" data-llave="' + esc(e.llave) + '">' +
        'Ver llave</button>' : '';
    return '<div class="ev paso"><div><b>' + tit + '</b><small>' + sub +
      '</small>' + ll + '</div><span class="hace">' + esc(cuandoSe(e.cuando)) +
      '</span></div>';
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
  var quien = function (x) {
    return k[x] ? '<button class="ql" data-k="' + esc(k[x]) + '">' +
      conBanderas(x) + '</button>' : conBanderas(x);
  };
  $('#lNombre').textContent = L.nombre;
  $('#lSub').innerHTML = [esc(L.sv), esc(L.fecha),
    L.participantes ? esc(L.participantes) + ' participantes' : '']
    .filter(Boolean).join(' &middot; ');
  var fila = function (r) {
    return '<li><i>' + (MEDALLA[r[1]] || '') + '</i><span>' + quien(r[0]) +
      '</span><small>' + esc(r[1]) + '</small><b>' + num(r[2]) + '</b></li>';
  };
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
  $('#lCuerpo').innerHTML = cuadro(L, quien) +
    ((L.tabla || []).length ? '<h4>Los puntos</h4><ol class="res dos-col">' +
      L.tabla.map(fila).join('') + '</ol>' : '') +
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
function pintaPodio() {
  var tres = (D.tabla || []).slice(0, 3).filter(function (f) {
    return (f.c || []).length;
  });
  if (tres.length < 3) { apaga('#secPodio'); return; }
  var med = ['🥇', '🥈', '🥉'];
  $('#elPodio').innerHTML = tres.map(function (f, i) {
    return '<div class="pd p' + (i + 1) + '">' +
      '<span class="med">' + med[i] + '</span>' +
      '<button data-k="' + esc(f.k) + '"><img loading="lazy" decoding="async" src="' +
      urlCarta(f, f.c[0]) + '" alt="Tarjeta de ' + esc(f.n) + '"></button>' +
      '<b>' + esc(f.n) + '</b><small>' + num(f.pts) + ' pts</small></div>';
  }).join('');

  var rs = D.records || [];
  $('#records').innerHTML = rs.map(function (r) {
    return '<dl class="rec"><dt>' + esc(r.que) + '</dt><dd>' +
      '<span class="v">' + esc(r.v) + '</span>' +
      '<span class="q">' + ccTexto(r.cc) + ' ' + esc(r.n) + '</span>' +
      '</dd></dl>';
  }).join('');
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

function filtradas() {
  var q = FIL.q.toLowerCase();
  return (D.tabla || []).filter(function (f) {
    if (FIL.sv && (f.sv || '').toUpperCase() !== FIL.sv) return false;
    if (FIL.cc && (f.cc || '').toLowerCase() !== FIL.cc) return false;
    if (q && String(f.n || '').toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}

function ordenadas(fs) {
  var c = ORDEN.col, d = ORDEN.desc ? -1 : 1;
  return fs.slice().sort(function (a, b) {
    var x = a[c], y = b[c];
    // ⚠️ SIN RANGO VAN AL FINAL SIEMPRE, ordene como ordene. Hoy no lo
    // tiene nadie —hacen falta 10 eventos— y dejarlos mezclados haría
    // que ordenar por rango pareciera que no hace nada.
    if (c === 'rg') { x = x || '￿'; y = y || '￿'; }
    if (typeof x === 'string' || typeof y === 'string') {
      return String(x || '').localeCompare(String(y || ''), 'es') * d;
    }
    return ((x || 0) - (y || 0)) * d;
  });
}

/* La subcategoría del ranking. Ver `#subRanking` en el HTML.
   ⚠️ Vive acá y no en el hash: es un filtro de una vista, no una vista.
   Ponerlo en la URL obligaría a inventar rutas para cada combinación de
   subcategoría, búsqueda y chips. */
var SUB = 'temporada';

/* Qué cambia cada subcategoría: el orden, las columnas y la explicación.
   🔑 ES UNA TABLA, NO TRES. Tres tablas serían tres lugares donde
   arreglar el mismo bug — que es el error que este repo persigue. */
var SUBS = {
  temporada: {
    orden: null,
    nota: '',
    cols: [],
  },
  podios: {
    orden: function (a, b) {
      return (b.oro - a.oro) || (b.seg - a.seg) || (b.ter - a.ter) ||
        (b.pts - a.pts);
    },
    nota: 'Ordenado por oros, después platas y después bronces. ' +
      'Quien no subió al podio no aparece.',
    cols: ['pod'],
    filtro: function (f) { return (f.oro + f.seg + f.ter) > 0; },
  },
  camino: {
    // 🔴 EL COMPETITIVO PIDE 10 EVENTOS Y HOY NO LLEGA NADIE, así que la
    // tabla del Competitivo está VACIA — y una tabla vacía no dice por
    // qué. Esta contesta la pregunta que sí tiene respuesta: quién está
    // más cerca. Es «sin dato no hay pieza» con la pieza que sí hay.
    orden: function (a, b) { return (b.ev - a.ev) || (b.pts - a.pts); },
    nota: 'El Competitivo se desbloquea a los 10 eventos. Todavía no ' +
      'llegó nadie: éstos son los que están más cerca.',
    cols: [],
  },
};

function pintaTabla() {
  var cfg = SUBS[SUB] || SUBS.temporada;
  var fs = ordenadas(filtradas());
  if (cfg.filtro) fs = fs.filter(cfg.filtro);
  // ⚠️ El orden propio de la subcategoría sólo manda si el usuario no
  // tocó un encabezado. Si lo tocó, gana lo que pidió — un orden que se
  // ignora es un control que miente.
  if (cfg.orden && !ORDEN.tocado) fs = fs.slice().sort(cfg.orden);
  $('#tabla').classList.toggle('con-pod', (cfg.cols || []).indexOf('pod') >= 0);
  $('#notaSub').textContent = cfg.nota || '';
  $('#notaSub').hidden = !cfg.nota;
  // 🔴 LA COLUMNA DE RANGO SE CAE SI NO LA TIENE NADIE. Hoy el requisito
  // son 10 eventos y el máximo del pool es 3, así que salían 54 pastillas
  // con un punto adentro: una columna entera comiéndose el ancho —el
  // escaso, el del teléfono— para no decir nada. La sección «Rangos» ya
  // explica por qué está vacía.
  $('#tabla').classList.toggle('sin-rango',
    !(D.tabla || []).some(function (f) { return f.rg; }));
  if (!fs.length) {
    $('#filas').innerHTML = '<tr><td colspan="10" class="vacio">' +
      ((D.tabla || []).length ? 'Nadie con ese filtro.'
                              : 'Todavía no hay nadie en el ranking.') +
      '</td></tr>';
    $('#notaTabla').textContent = '';
    return;
  }
  $('#filas').innerHTML = fs.map(function (f) {
    var cl = f.pos === 1 ? 'top1' : f.pos === 2 ? 'top2' : f.pos === 3 ? 'top3' : '';
    var rg = f.rg
      ? '<span class="rg" style="color:' + esc(f.rgc || '') + ';border-color:' +
        esc(f.rgc || '#1A2523') + '55">' + esc(f.rg) + '</span>'
      : '<span class="rg">&middot;</span>';
    return '<tr class="' + cl + '" data-k="' + esc(f.k) + '">' +
      '<td>' + esc(f.pos) + '</td>' +
      '<td><i class="cc">' + ccTexto(f.cc) + '</i>' + esc(f.n) + '</td>' +
      '<td><span class="ovr">' + (f.ovr || '—') + '</span></td>' +
      '<td class="col-rg">' + rg + '</td>' +
      '<td class="col-sv"><span class="sv">' + esc(f.sv) + '</span></td>' +
      // ⚠️ `pts` LLEVA CLASE PROPIA: es de lo que habla la tabla y salía
      // con el mismo peso que la columna de eventos. Ver `td.pts`.
      '<td class="pts">' + num(f.pts) + '</td>' +
      '<td>' + esc(f.ev) + '</td>' +
      // las tres del podio: se ocultan por CSS fuera de esa subcategoría
      '<td class="col-pod">' + (f.oro || '') + '</td>' +
      '<td class="col-pod">' + (f.seg || '') + '</td>' +
      '<td class="col-pod">' + (f.ter || '') + '</td></tr>';
  }).join('');
  $('#notaTabla').textContent = fs.length === (D.tabla || []).length
    ? fs.length + ' raperos' : fs.length + ' de ' + D.tabla.length;
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
      '" data-k="' + esc(f.k) + '"' +
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

/* ── duelos y rachas ──────────────────────────────────────────────── */
function pintaDuelos() {
  var ds = D.duelos || [], rs = D.rachas || [];
  if (!ds.length) apaga('#secDuelos');
  if (!rs.length) apaga('#secRachas');
  if (!ds.length && !rs.length) return;
  var max = ds.length ? Math.max.apply(null, ds.map(function (d) { return d.t; })) : 1;
  $('#listaDuelos').innerHTML = ds.map(function (d, i) {
    var pct = Math.round(100 * d.g / (d.t || 1));
    return '<div class="du" data-k="' + esc(d.k) + '">' +
      '<span class="p">' + (i + 1) + '</span>' +
      '<span class="nm"><i class="cc">' + ccTexto(d.cc) + '</i>' + esc(d.n) + '</span>' +
      '<span class="bar" title="' + pct + '% ganados"><i style="width:' +
      Math.round(100 * d.t / max) + '%"></i></span>' +
      '<span class="gp">' + d.g + '<s>/' + d.t + '</s></span></div>';
  }).join('');
  // ⚠️ SIN LA ETIQUETA «RACHAS» DISFRAZADA DE CHIP. Era un `<span>` con
  // los estilos apagados a mano para parecer un título, al lado del
  // `<h2>` que ya dice lo mismo. Un elemento que finge ser otro se
  // rompe la primera vez que alguien toca la clase.
  $('#rachas').innerHTML = rs.map(function (r) {
    return '<span class="ra"><i class="cc">' + ccTexto(r.cc) + '</i>' +
      esc(r.n) + ' <u>' + r.r + '</u></span>';
  }).join('');
}

/* ── medallero ──────────────────────────────────────────────────────
   Los tres campos ya viajaban en el payload y no los miraba nadie.

   ⚠️ SE ORDENA COMO UN MEDALLERO DE VERDAD: primero por oros, después
   por platas, después por bronces. Sumar las tres daría que tres
   bronces valen más que un oro, que es justo lo que un medallero
   existe para no decir. */
function pintaPodios() {
  var ps = (D.tabla || []).filter(function (f) {
    return (f.oro || 0) + (f.seg || 0) + (f.ter || 0) > 0;
  });
  if (!ps.length) { apaga('#secPodios'); return; }
  ps.sort(function (a, b) {
    return (b.oro || 0) - (a.oro || 0) || (b.seg || 0) - (a.seg || 0) ||
           (b.ter || 0) - (a.ter || 0) || (a.pos || 0) - (b.pos || 0);
  });
  $('#listaPodios').innerHTML = ps.slice(0, 12).map(function (f) {
    var m = function (n, e) {
      return '<span class="' + (n ? 'hay' : '') + '">' + e + ' ' + (n || 0) + '</span>';
    };
    return '<div class="pm" data-k="' + esc(f.k) + '">' +
      '<span class="nm"><i class="cc">' + ccTexto(f.cc) + '</i>' + esc(f.n) + '</span>' +
      '<span class="med">' + m(f.oro, '\uD83E\uDD47') + m(f.seg, '\uD83E\uDD48') +
      m(f.ter, '\uD83E\uDD49') + '</span></div>';
  }).join('');
}

/* ── comparar dos ───────────────────────────────────────────────────
   🔑 TODO EL CRUCE LO HACE EL NAVEGADOR con el payload que ya bajó: no
   hay una consulta nueva ni una ruta nueva. Es la misma idea que el
   buscador y el orden de la tabla —ver la cabecera de este archivo— y
   por eso agregarlo no cuesta un milisegundo de Worker.

   ⚠️ Y ARRANCA CON EL #1 Y EL #2, no vacío: un comparador con dos
   selects en blanco no muestra para qué sirve. */
var CMP = [0, 1];

var FILAS_CMP = [
  ['ovr', 'OVR', 1], ['pts', 'Puntos', 1], ['ev', 'Eventos', 1],
  ['pod', 'Podios', 1], ['pos', 'Puesto', -1]
];

function pintaComparar() {
  var con = conTarjeta();
  if (con.length < 2) { apaga('#secComparar'); return; }
  var ops = function (sel) {
    return con.map(function (f, i) {
      return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' +
        esc(f.n) + '</option>';
    }).join('');
  };
  // 🔑 SE PUEDE ESCRIBIR EL NOMBRE, no sólo desplegar la lista. Dlx,
  // 24/09/2026: *«en tarjetas deja que se pueda escribir el nombre para
  // comparar tarjetas»*.
  //
  // ⚠️ ES UN `<input list>` CON `<datalist>`, no un buscador a mano. El
  // navegador da el autocompletado gratis —filtra mientras se escribe, y
  // en teléfono abre su propio selector— y si alguien escribe algo que no
  // existe, el `<select>` de antes no tenía forma de decirlo. Acá el valor
  // se busca contra la lista al soltar el foco.
  //
  // ⚠️ Y LA LISTA SIGUE ESTANDO: con 71 nombres, desplegar es más rápido
  // que escribir cuando uno no sabe a quién buscar. `list=` da las dos
  // cosas con un solo control.
  var lado = function (j) {
    var f = con[CMP[j]];
    if (!f) return '';
    return '<div class="cmp-lado">' +
      '<input class="cmp-busca" data-lado="' + j + '" ' +
      'value="' + esc(f.n) + '" placeholder="Escribí un nombre…" ' +
      'autocomplete="off" spellcheck="false" ' +
      'aria-label="Rapero a comparar">' +
      '<img loading="lazy" decoding="async" src="' + urlCarta(f, f.c[0]) +
      '" alt="Tarjeta de ' + esc(f.n) + '"></div>';
  };
  var a = con[CMP[0]], b = con[CMP[1]];
  var vs = FILAS_CMP.map(function (par) {
    var k = par[0], et = par[1], dir = par[2];
    var x = a[k] || 0, y = b[k] || 0;
    // ⚠️ EN EL PUESTO GANA EL NUMERO MAS CHICO. Sin ese `-1` el #1
    // aparecería perdiendo contra el #40, que es lo que pasa cuando una
    // tabla asume que más siempre es mejor.
    var ga = dir > 0 ? x > y : x < y;
    var gb = dir > 0 ? y > x : y < x;
    var fmt = function (v) { return k === 'pos' ? '#' + v : num(v); };
    return '<div class="fila"><b class="' + (ga ? 'gana' : '') + '">' + fmt(x) +
      '</b><em>' + et + '</em><b class="' + (gb ? 'gana' : '') + '">' + fmt(y) +
      '</b></div>';
  }).join('');
  // ⚠️ UN SOLO `<datalist>` PARA LOS DOS LADOS. Con uno por lado serían
  // 142 `<option>` repetidos en el DOM para la misma lista.
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
  var con = conTarjeta();
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
/* `7300` -> «7,3 mil». La cantidad de miembros viaja redondeada (ver
   `_miembros()` en subir_web.py) y así se lee como lo que es: un tamaño. */
function milesCortos(n) {
  n = Number(n || 0);
  if (n < 1000) return String(n);
  var m = Math.round(n / 100) / 10;
  return String(m).replace('.', ',') + ' mil';
}

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
      ? '<img class="sv-logo" src="' + esc(s.logo) + '" alt="" width="48" height="48" loading="lazy">'
      : '<span class="sv-logo sv-sigla">' + esc(s.sv) + '</span>';
    var datos = [];
    if (s.miembros) datos.push('<div><dt>Miembros</dt><dd>' + milesCortos(s.miembros) + '</dd></div>');
    if (s.n) {
      datos.push('<div><dt>En la T1</dt><dd>' + s.n + '</dd></div>');
      datos.push('<div><dt>Puntos</dt><dd>' + num(s.pts) + '</dd></div>');
    }
    var entrar = s.invita
      ? '<a class="sv-entrar" href="' + esc(s.invita) + '" target="_blank" rel="noopener noreferrer">Entrar</a>'
      : '';
    return '<div class="sv-c" style="--c:' + esc(colorVisible(s.color)) + '">' +
      '<div class="sv-cab">' + logo + '<div><h3>' + esc(s.nombre || s.sv) + '</h3>' +
      '<small>' + esc(s.sv) + '</small></div></div>' +
      (datos.length ? '<dl>' + datos.join('') + '</dl>' : '') + entrar + '</div>';
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
    return '<div class="pa"><span class="p">' + (i + 1) + '</span>' +
      '<span class="fl">' + ccTexto(p.cc) + '</span>' +
      '<span class="nm">' + esc(nombrePais(p.cc)) + '</span>' +
      '<span class="n">' + p.n + (p.n === 1 ? ' rapero' : ' raperos') + '</span>' +
      '<span class="pt">' + num(p.pts) + '</span></div>';
  }).join('');
  if (!cs.length) return;
  $('#crews').innerHTML = cs.map(function (c) {
    return '<div class="cw"><b>' + esc(c.crew) + '</b><small>' + c.n +
      ' · ' + num(c.pts) + ' pts · mejor ' + esc(c.mejor) + '</small></div>';
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
  var qs = D.requisitos || [];
  if (!qs.length) { apaga('#secComo'); return; }
  $('#listaComo').innerHTML = qs.map(function (q) {
    return '<div class="cm"><h3>' + esc(q.titulo) + '</h3><p>' + esc(q.mide) +
      '</p><ul>' + (q.pide || []).map(function (p) {
        return '<li' + (p === 'nada' ? ' class="nada"' : '') + '>' +
          (p === 'nada' ? 'Sin requisito' : esc(p)) + '</li>';
      }).join('') + '</ul></div>';
  }).join('');
}

/* ── el visor ─────────────────────────────────────────────────────── */
var NOMBRE_CARTA = {
  temporada: 'Temporada', competitivo: 'Competitiva',
  servidor: 'Servidor', pais: 'País'
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
  var f = porK(k);
  if (!f) return;
  $('#vPos').textContent = '#' + f.pos;
  $('#vNombre').textContent = f.n;
  $('#vSub').innerHTML = [ccTexto(f.cc), esc(f.sv), f.crew ? esc(f.crew) : '']
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
  var alto = function (b) { return PAD * 2 + FILA * Math.max(2, b[0].length); };
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
  if (hayCamp) {
    var sobra = pf.y - alto(rs[n - 1].b[0]) / 2 - 50;
    if (sobra < 0) TOPE -= sobra;
  }
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
        return '<div class="ld' + (g ? ' g' : '') + '" title="' + esc(s) +
          '"><span class="nm">' + lado(s) + '</span></div>';
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
    html.push('<div class="camp" style="left:' + (X(pf) - 20) + 'px;width:' + (W + 40) +
      'px;top:' + Math.round(TOPE + pf.y - hf / 2 - 44) + 'px"><small>&#127942; Campeón</small>' +
      lado(campeon) + '</div>');
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
    html.push('<span class="rl" style="left:' + c * (W + G) + 'px;width:' + W + 'px">' +
      esc(rs[r].r) + '</span>');
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
    var k = claveDia(t);
    (m[k] = m[k] || []).push(c);
  });
  return m;
}

function pintaCalendario() {
  var cs = D.calendario || [];
  if (!cs.length) { apaga('#secCal'); apaga('#secDia'); return; }
  var M = porDia();
  if (!CAL.y) {
    var hoy = new Date(), hk = claveDia(hoy);
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
  var hoyK = claveDia(new Date()), h = '';
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
  var vistos = [];
  cs.forEach(function (c) { if (vistos.indexOf(c.sv) < 0) vistos.push(c.sv); });
  $('#calLey').innerHTML = vistos.map(function (sv) {
    return '<span style="--c:' + esc(colorSv(sv)) + '"><i></i>' + esc(nombreSv(sv)) + '</span>';
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
    (txt ? esc(txt.charAt(0).toUpperCase() + txt.slice(1)) : 'El día');
  if (!evs.length) {
    $('#diaLista').innerHTML = '<p class="dia-no">Ese día no hubo eventos.</p>';
    return;
  }
  $('#diaLista').innerHTML = evs.map(function (e) {
    var hora = new Date(e.t).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
    var acc = (e.ll ? '<button class="ver-llave" data-llave="' + e.ll + '">Ver llave</button>' : '') +
      (e.link ? '<a class="ver-llave" href="' + esc(e.link) + '" target="_blank" ' +
        'rel="noopener noreferrer">En Discord &#8599;</a>' : '');
    var estado = e.fut ? 'por jugarse' : e.jugado ? 'jugado' : 'anunciado';
    return '<div class="de" style="--c:' + esc(colorSv(e.sv)) + '">' +
      '<span class="de-h">' + esc(hora) + (e.sh ? '<small>anunciado</small>' : '') + '</span>' +
      '<div><b>' + esc(e.n) + '</b><small>' + esc(nombreSv(e.sv)) + ' &middot; ' + estado +
      '</small>' + (acc ? '<div class="de-acc">' + acc + '</div>' : '') + '</div></div>';
  }).join('');
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
    dentro.length + ' de ' + HISPANOS.length + '</em> países de habla hispana ya ' +
    'tienen raperos en la temporada</span>';
  var otros = ps.filter(function (p) {
    return HISPANOS.indexOf(String(p.cc).toLowerCase()) < 0;
  });
  var faltan = HISPANOS.filter(function (c) { return !por[c]; });
  $('#mapaOtros').innerHTML =
    (otros.length ? '<p><span>Y también</span>' + otros.map(function (p) {
      return ccTexto(p.cc) + ' ' + esc(nombrePais(p.cc));
    }).join(' &middot; ') + '</p>' : '') +
    (faltan.length ? '<p><span>Todavía no</span>' + faltan.map(function (c) {
      return ccTexto(c) + ' ' + esc(nombrePais(c));
    }).join(' &middot; ') + '</p>' : '');
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
function pintaTops() {
  var T = D.tabla || [];
  var fila = function (f, i, v, u, c) {
    return '<li' + (f.k ? ' data-k="' + esc(f.k) + '"' : '') + '><i class="pp">' + (i + 1) +
      '</i><span class="nm">' + (f.cc ? '<i class="cc">' + ccTexto(f.cc) + '</i>' : '') +
      esc(f.n) + '</span><b' + (c ? ' style="color:' + esc(c) + '"' : '') + '>' + v +
      '</b>' + (u ? '<small>' + u + '</small>' : '') + '</li>';
  };
  var cajas = [];
  cajas.push(['&#127942;', 'Temporada', '#/ranking', T.slice(0, 5).map(function (f, i) {
    return fila(f, i, f.ovr || '—', 'OVR');
  })]);
  var comp = T.filter(function (f) { return f.rg; }).sort(function (a, b) {
    return (b.sc || 0) - (a.sc || 0);
  }).slice(0, 5);
  var cerca = T.slice().sort(function (a, b) { return (b.ev || 0) - (a.ev || 0); })[0];
  cajas.push(['&#9876;', 'Competitivo', '#/guia', comp.map(function (f, i) {
    return fila(f, i, esc(f.rg), f.sc ? String(f.sc).replace('.', ',') : '', f.rgc);
  }), cerca ? 'Se desbloquea a los <b>10 eventos</b> y todavía no llegó nadie. ' +
    'El más cerca: <b>' + esc(cerca.n) + '</b>, con ' + cerca.ev + '.' : '']);
  cajas.push(['&#129354;', 'Duelos', '#/duelos', (D.duelos || []).slice(0, 5).map(function (d, i) {
    return fila(d, i, d.g + '<s>/' + d.t + '</s>', 'ganados');
  })]);
  var med = T.filter(function (f) { return (f.oro || 0) + (f.seg || 0) + (f.ter || 0) > 0; })
    .sort(function (a, b) {
      return (b.oro - a.oro) || (b.seg - a.seg) || (b.ter - a.ter) || (b.pts - a.pts);
    }).slice(0, 5);
  cajas.push(['&#127941;', 'Podios', '#/duelos', med.map(function (f, i) {
    return fila(f, i, [['&#129351;', f.oro], ['&#129352;', f.seg], ['&#129353;', f.ter]]
      .filter(function (x) { return x[1]; }).map(function (x) {
        return x[0] + x[1];
      }).join(' '), '');
  })]);
  cajas.push(['&#127758;', 'Países', '#/mundo', (D.paises || []).slice(0, 5).map(function (p, i) {
    return fila({ n: nombrePais(p.cc), cc: p.cc }, i, num(p.pts), 'pts');
  })]);
  cajas.push(['&#129309;', 'Crews', '#/mundo', (D.crews || []).slice(0, 5).map(function (c, i) {
    return fila({ n: c.crew }, i, num(c.pts), 'pts');
  })]);
  var hay = cajas.filter(function (c) { return c[3].length || c[4]; });
  if (!hay.length) { apaga('#secTop'); return; }
  $('#tops').innerHTML = hay.map(function (c) {
    return '<div class="tp"><h3><span>' + c[0] + '</span>' + c[1] +
      '<a href="' + c[2] + '">Ver todo</a></h3>' + (c[3].length
      ? '<ol>' + c[3].join('') + '</ol>' : '<p class="tp-no">' + c[4] + '</p>') + '</div>';
  }).join('');
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

  $$('#tabla th').forEach(function (th) {
    th.addEventListener('click', function () {
      var c = th.dataset.orden;
      // ⚠️ LO NUMERICO ARRANCA DE MAYOR A MENOR y el puesto y el nombre al
      // revés. Un ranking que al tocar «Puntos» muestra primero al último
      // obliga a tocar dos veces siempre.
      if (ORDEN.col === c) ORDEN.desc = !ORDEN.desc;
      else { ORDEN.col = c; ORDEN.desc = (c !== 'pos' && c !== 'n'); }
      ORDEN.tocado = true;
      $$('#tabla th').forEach(function (o) { o.classList.remove('asc', 'desc'); });
      th.classList.add(ORDEN.desc ? 'desc' : 'asc');
      pintaTabla();
    });
  });

  // Un solo escucha para todo lo que abre el visor. ⚠️ Los enlaces del
  // menú también son clics: se sale antes si el destino es un `<a>`, o
  // tocar «Ver el ranking completo» abriría una tarjeta.
  document.addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    var t = e.target.closest('[data-k]');
    if (t && !e.target.closest('.pest')) abrir(t.dataset.k);
  });
  // ⚠️ AL CAMBIAR DE SUBCATEGORIA SE SUELTA EL ORDEN MANUAL. Cada una
  // trae el suyo —Podios por oros, Camino por eventos— y respetar el
  // orden viejo haría que tocar «Podios» no cambiara nada visible.
  $('#subRanking').addEventListener('click', function (e) {
    var b = e.target.closest('.sub'); if (!b) return;
    SUB = b.dataset.sub;
    ORDEN.tocado = false;
    $$('#subRanking .sub').forEach(function (o) {
      o.classList.toggle('on', o === b);
    });
    pintaTabla();
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
    var con = conTarjeta();
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
  $('#vPestanas').addEventListener('click', function (e) {
    var b = e.target.closest('.pest'); if (!b) return;
    var f = porK($('#vPestanas').dataset.k); if (!f) return;
    $$('#vPestanas .pest').forEach(function (p) { p.classList.toggle('on', p === b); });
    $('#vImg').src = urlCarta(f, b.dataset.c);
    $('#vImg').alt = 'Tarjeta ' + (NOMBRE_CARTA[b.dataset.c] || '') + ' de ' + f.n;
    avisoCarta(f, b.dataset.c);
  });
  $('#vBajar').addEventListener('click', function () {
    var b = $('#vBajar');
    var f = porK(b.dataset.k);
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
  trama();
  pintaHero();
  pintaPasados();
  pintaPodio();
  pintaChips();
  pintaTabla();
  pintaGaleria();
  pintaDuelos();
  pintaPodios();
  pintaComparar();
  pintaServidores();
  pintaPaises();
  pintaRangos();
  pintaComo();
  pintaTops();
  pintaMapa();
  pintaCalendario();
  // 🔴 LA FECHA QUE SE MUESTRA ES LA DE LOS DATOS, NO LA DE LA COPIA.
  // `sello` es cuándo se escribió el payload y se puede mover sin que
  // los datos se muevan —correr `subir_web.py` a mano lo pone en
  // «recién» con anuncios de hace dos horas—. Dlx lo vio tal cual.
  $('#pie').textContent = 'Temporada ' + (D.temporada || '') + ' · datos ' +
    (cuandoSe(D.leido || D.sello) || 'sin fecha');
  eventos();
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
