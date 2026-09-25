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

function ir() {
  var r = ruta();
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
  window.scrollTo(0, 0);
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
  var ev = 0, cartas = 0;
  (D.tabla || []).forEach(function (f) {
    ev += f.ev || 0; cartas += (f.c || []).length;
  });
  $('#cRaperos').textContent = D.gente || (D.tabla || []).length;
  $('#cEventos').textContent = ev;
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
    return '<div class="ev"><div><b>' + tit + '</b><small>' + sub +
      '</small></div><span class="reloj" data-t="' + esc(e.cuando) +
      '">&middot;</span></div>';
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
// lo que va en «Podio»: los puestos que se ganan en las dos últimas rondas
var PODIO = { 'Campeón': 1, 'Subcampeón': 1, 'Tercero': 1, 'Cuarto': 1,
              'Semifinal': 1 };

function abrirLlave(n) {
  var L = (D.llaves || {})[n];
  if (!L) return;
  var k = {};
  (D.tabla || []).forEach(function (f) { k[f.n] = f.k; });
  var quien = function (x) {
    return k[x] ? '<button class="ql" data-k="' + esc(k[x]) + '">' + esc(x) +
      '</button>' : esc(x);
  };
  $('#lNombre').textContent = L.nombre;
  $('#lSub').innerHTML = [esc(L.sv), esc(L.fecha),
    L.participantes ? L.participantes + ' participantes' : '']
    .filter(Boolean).join(' &middot; ');
  var fila = function (r) {
    return '<li><i>' + (MEDALLA[r[1]] || '') + '</i><span>' + quien(r[0]) +
      '</span><small>' + esc(r[1]) + '</small><b>' + num(r[2]) + '</b></li>';
  };
  // ⚠️ ARRIBA SÓLO EL PODIO y la tabla entera al final: con 30 que cobran,
  // la tabla empujaba la llave —que es lo que se vino a ver— fuera de la
  // pantalla.
  var pod = (L.tabla || []).filter(function (r) { return PODIO[r[1]]; });
  var rondas = (L.rondas || []).map(function (R) {
    return '<h4>' + esc(R.r) + '</h4><ul class="bts">' + R.b.map(function (b) {
      // [lados, ganador, nota]: una batalla de 3 o 4 bandas viene junta
      return '<li>' + b[0].map(function (x) {
        return '<span class="' + (b[1] && b[1] === x ? 'g' : 'p') + '">' +
          quien(x) + '</span>';
      }).join('<i>vs</i>') + (b[2] ? '<small>' + esc(b[2]) + '</small>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }).join('');
  var links = (L.links || []).map(function (u, i, t) {
    return '<a class="bajar" href="' + esc(u) + '" target="_blank" ' +
      'rel="noopener noreferrer"><span>' +
      (t.length > 1 ? 'Llave ' + (i + 1) : 'La llave en Discord') +
      '</span><i class="ir">&#8599;</i></a>';
  }).join('');
  $('#lCuerpo').innerHTML =
    (pod.length ? '<h4>Podio</h4><ol class="res">' + pod.map(fila).join('') +
      '</ol>' : '') + rondas +
    ((L.tabla || []).length ? '<h4>Los puntos</h4><ol class="res">' +
      L.tabla.map(fila).join('') + '</ol>' : '') +
    (links ? '<div class="v-acc">' + links + '</div>' : '');
  $('#visorLlave').hidden = false;
  $('#lCuerpo').scrollTop = 0;
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

/* ── los cinco de arriba, en el inicio ────────────────────────────── */
function pintaTop() {
  var fs = (D.tabla || []).slice(0, 5);
  if (!fs.length) { apaga('#secTop'); return; }
  $('#filasTop').innerHTML = fs.map(function (f) {
    var cl = f.pos === 1 ? 'top1' : f.pos === 2 ? 'top2' : f.pos === 3 ? 'top3' : '';
    return '<tr class="' + cl + '" data-k="' + esc(f.k) + '">' +
      '<td>' + esc(f.pos) + '</td>' +
      '<td><i class="cc">' + ccTexto(f.cc) + '</i>' + esc(f.n) + '</td>' +
      '<td>' + (f.ovr || '—') + '</td></tr>';
  }).join('');
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
    return '<div class="sv-c" style="--c:' + esc(s.color) + '">' +
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
    '<div><b>' + (f.wr || '—') + '</b><span>Win%</span></div>';

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
  var t = Date.parse(String(iso || '').replace(' ', 'T'));
  if (isNaN(t)) return '';
  var m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return 'recién';
  if (m < 60) return 'hace ' + m + ' min';
  var h = Math.round(m / 60);
  return h < 24 ? 'hace ' + h + ' h' : 'hace ' + Math.round(h / 24) + ' días';
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
  pintaTop();
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
