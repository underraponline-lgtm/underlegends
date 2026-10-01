/* ── LAS LLAVES EN VIVO: el lector de `bot/escuchar.py`, en el navegador ──

   🔑 Dlx, 27/09/2026: «llaves en vivo… como las notificaciones, que se
   chequean cada 1 minuto». El vigía del Worker guarda cada minuto el texto de
   las llaves que se están jugando, SIN LEERLAS —el Worker tiene 10 ms de CPU—,
   y esto las lee acá, en el navegador de quien mira, donde leer es gratis.

   ⚠️ ES UNA COPIA DE LAS REGLAS DE PYTHON, Y ESTÁ ATADA. `plano`, `traducir`,
   `nombresDeLinea`, `unirContinuadas` y `rondasDe` son `escuchar.py` línea
   por línea, y `bot/llaves_casos.json` guarda llaves reales con lo que
   Python lee de cada una: `node bot/llave_vivo_prueba.mjs` corre en CI y se
   pone rojo si este archivo lee distinto. Si se toca el lector de Python, se
   rehacen los casos (`python bot/llaves_casos.py --armar`) y se trae el
   cambio acá.

   ⚠️ QUIÉN PASÓ SE DICE SIMPLE, Y NO SUMA NADA. Pasó quien aparece en la
   ronda siguiente —con los equipos como conjunto— y el campeón sale de la
   línea CAMPEÓN. Los parecidos, el padrón y los puntos son del ciclo: la
   llave en vivo muestra la forma, y cuando el ciclo procesa el evento la
   página la cambia por la oficial.

   ⚠️ SIN LOOKBEHIND: Safari lo entiende recién desde la 16.4, y una expresión
   que un navegador no entiende tumba el archivo entero. */
(function (raiz) {
  'use strict';

  var ORDEN = ['FILTROS', 'CLASIFICATORIAS', 'PRELIMINARES', 'DIECISEISAVOS', 'OCTAVOS',
    'CUARTOS', 'SEMIFINALES', 'TERCER LUGAR', 'FINAL'];
  var ALIAS = { 'CLASIFICATORIA': 'CLASIFICATORIAS', 'CUARTOS DE FINAL': 'CUARTOS',
    'FILTRO': 'FILTROS', 'SEMI - FINAL': 'SEMIFINALES', 'SEMI-FINAL': 'SEMIFINALES',
    'SEMI FINAL': 'SEMIFINALES', 'SEMIFINAL': 'SEMIFINALES', 'SEMIS': 'SEMIFINALES',
    // y el plural con espacio de Urban Freestyle: ver `escuchar.ALIAS`
    'SEMI - FINALES': 'SEMIFINALES', 'SEMI-FINALES': 'SEMIFINALES', 'SEMI FINALES': 'SEMIFINALES',
    'SEMI': 'SEMIFINALES', 'GRAN FINAL': 'FINAL' };
  // y `[ CYPHER ]` solo en su renglón es la fase previa (POESÍA CRUDA, 01/10): `escuchar.CYPHER_ENC`
  var CYPHER_ENC = /^[\W_]*(?:(?:fase|ronda)\s+(?:de\s+)?)?c[iy]pher[\W_]*$/i;
  // cómo se lee cada ronda en la página: lo mismo que `llaves_web.ETIQUETA`
  var ETIQUETA = { 'FILTROS': 'Filtros', 'CLASIFICATORIAS': 'Clasificatorias',
    'PRELIMINARES': 'Preliminares', 'DIECISEISAVOS': 'Dieciseisavos', 'OCTAVOS': 'Octavos',
    'CUARTOS': 'Cuartos', 'SEMIFINALES': 'Semifinales', 'TERCER LUGAR': 'Tercer puesto',
    'FINAL': 'Final' };
  var RONDA_ALT = 'FILTROS?|CLASIFICATORIAS?|PRELIMINARES|DIECISEISAVOS|OCTAVOS|' +
    'CUARTOS(?:\\s+DE\\s+FINAL)?|SEMI\\s*-?\\s*FINAL(?:ES)?|SEMIS?|TERCER\\s+LUGAR|GRAN\\s+FINAL|FINAL';
  var PALABRA = /[\p{L}\p{N}_]/u;
  var SEP = /🆚|<a?:VSF?:\d+>|:vsf?:|\bvs\.?\b/i;
  var SEP_G = /🆚|<a?:VSF?:\d+>|:vsf?:|\bvs\.?\b/gi;
  // 🔴 SIN LOS MARCOS ADENTRO: con el hueco vacío de la plantilla (`⌞⌝ 🆚 ⌞⌝`)
  // la captura saltaba de un ⌞ al siguiente ⌝ y daba el lado «⌝ ⌞». Ver
  // `escuchar.DELIMS`.
  // y un `[x]` con `+` adentro es un equipo, que puede ser largo (MULTIVERSE: 8v1)
  var DELIMS = [/⌞([^⌞⌝]+?)⌝/gu, /\[([^\[\]\n]{1,30}|[^\[\]\n]*[+&][^\[\]\n]*)\]/gu];
  var VACIO = { 'suplente': 1 };
  var POKEMON = /\(\s*(?:P|pok[eé]mon)\s*\)|\bpok[eé]mon\b/i;
  var MENCION = /<@!?(\d+)>/g;
  var CORTO = /:[a-z0-9_+\-]{2,32}:/g;
  var MARCAS = /\*\*|__|~~|\|\|/g;
  var CONTRA = /🆚|\bvs\.?\b/i;
  var PODIO = /CAMPE[OÓ]N|\bPUESTO\b|\bLUGAR\b|M\.?\s*V\.?\s*P\b/i;
  var HISTORIA = /\s*[(（][^()（）]*[)）]?\s*$/;
  var BANDERA = '[\\u{1F1E6}-\\u{1F1FF}]';
  var MD = '(?:\\*\\*|__)?';
  var VS_PROPIO = /<a?:(?!VSF?:)\w*?vs\w*:\d+>/gi;
  var PODIO_PROPIO = /<a?:([123])[a-zº°]*_?puesto\w*:\d+>/gi;
  var TERCER_ENC = /\b3\s*(?:er|ro|º|°)?\s*(?:y\s*4\s*(?:to|º|°|o)?\s*)?(?:puesto|lugar)\b/i;
  var PAIS_DE_EMOJI = { ar: ['ARG', 'ARGENTINA'], bo: ['BOL', 'BOLIVIA'], br: ['BRA', 'BRASIL', 'BRAZIL'],
    cl: ['CHI', 'CHL', 'CHILE'], co: ['COL', 'COLOMBIA'], cr: ['CRC', 'CRI', 'COSTARICA'], cu: ['CUB', 'CUBA'],
    do: ['DOM', 'DOMINICANA', 'REPUBLICADOMINICANA', 'REPDOM'], ec: ['ECU', 'ECUADOR'],
    es: ['ESP', 'ESPANA', 'SPAIN'], gt: ['GUA', 'GTM', 'GUATEMALA'], hn: ['HON', 'HND', 'HONDURAS'],
    mx: ['MEX', 'MEXICO'], ni: ['NCA', 'NIC', 'NICARAGUA'], pa: ['PAN', 'PANAMA'], pe: ['PER', 'PERU'],
    pr: ['PUR', 'PRI', 'PUERTORICO'], py: ['PAR', 'PRY', 'PARAGUAY'],
    sv: ['SLV', 'ESA', 'ELSALVADOR', 'SALVADOR'], us: ['USA', 'EEUU', 'ESTADOSUNIDOS'],
    uy: ['URU', 'URY', 'URUGUAY'], ve: ['VEN', 'VENEZUELA'] };
  var PAIS = {};
  Object.keys(PAIS_DE_EMOJI).forEach(function (cc) {
    PAIS_DE_EMOJI[cc].forEach(function (n) { PAIS[n] = cc; });
  });

  function lineas(t) { return String(t || '').split(/\r\n|[\n\r\u000b\u000c\u001c\u001d\u001e\u0085\u2028\u2029]/); }
  function quitarBordes(s, cs) {
    var a = Array.from(s), i = 0, j = a.length;
    while (i < j && cs.indexOf(a[i]) >= 0) i++;
    while (j > i && cs.indexOf(a[j - 1]) >= 0) j--;
    return a.slice(i, j).join('');
  }
  function bandera(cc) {
    return Array.from(cc.toLowerCase()).map(function (c) {
      return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 97);
    }).join('');
  }

  /* `escuchar.plano()`: las letras de fantasía, en letras comunes */
  function plano(t) {
    if (!t) return t || '';
    return Array.from(t).map(function (ch) {
      var c = ch.codePointAt(0);
      return (c >= 0x1D400 && c <= 0x1D7FF) || (c >= 0xFF01 && c <= 0xFF5E) ? ch.normalize('NFKD') : ch;
    }).join('');
  }

  /* `escuchar.norm()` */
  function norm(s) {
    s = String(s || '').replace(/<a?:\w+:\d+>/g, '').replace(MENCION, '').replace(CORTO, '');
    s = Array.from(s).filter(function (c) {
      var n = c.codePointAt(0);
      return !(n >= 0x1F000 && n <= 0x1FAFF);
    }).join('');
    return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  }

  /* `escuchar._sin_marcas()` */
  function sinMarcas(x) {
    x = String(x).replace(MARCAS, '').replace(/[ \t]*<a?:\w+:\d+>/g, '');
    return quitarBordes(x, [' ', '*', '`']);
  }

  function paisDelEmoji(todo, nombre) {
    var nom = nombre.normalize('NFKD').replace(/\p{M}/gu, '');
    var partes = nom.split(/[^A-Za-z]+/).filter(Boolean);
    var ks = [partes.join('')].concat(partes);
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i];
      if (k && PAIS[k.toUpperCase()] && (k.length > 3 || k === k.toUpperCase())) {
        return bandera(PAIS[k.toUpperCase()]);
      }
    }
    return todo;
  }

  function equipoDeBanderas(s) {
    if ((s.match(new RegExp(BANDERA + '{2}', 'gu')) || []).length < 2 || /[+,\/]/.test(s)) return s;
    s = s.replace(new RegExp('(' + BANDERA + ')(' + MD + ')[ \\t]*&[ \\t]*(?=' + MD + '[\\p{L}\\p{N}_])', 'gu'),
      '$1$2 + ');
    return s.replace(new RegExp('(' + BANDERA + ')(' + MD + ')[ \\t]+(?=' + MD + '[\\p{L}\\p{N}_])', 'gu'),
      '$1$2 + ');
  }

  /* `escuchar.traducir()`: los dialectos de los otros servidores */
  function traducir(texto) {
    if (!texto) return texto || '';
    var t = texto.replace(VS_PROPIO, ' 🆚 ');
    t = t.replace(/<a?:(\w+):\d+>/g, paisDelEmoji);
    t = t.replace(/:flag_([a-z]{2}):/g, function (_m, cc) { return bandera(cc); });
    t = t.replace(PODIO_PROPIO, function (_m, n) {
      return ' ' + { '1': '1ER', '2': '2DO', '3': '3ER' }[n] + ' PUESTO: ';
    });
    t = t.replace(/[『「〈][ \t]*(\d(?:ER|DO) PUESTO:)[ \t]*[』」〉]/g, '$1');
    t = t.replace(new RegExp(MD + '[「〈][ \\t]*', 'g'), '⌞');
    t = t.replace(new RegExp('[ \\t]*[」〉]' + MD, 'g'), '⌝');
    // y las llaves `{x}` de Urban Freestyle, sólo en par: ver `escuchar.traducir()`
    t = t.replace(/\{[ \t]*([^{}\n]*?)[ \t]*\}/g, '⌞$1⌝');
    t = t.replace(/([⌝\]])[ \t]*<a?:\w+:\d+>[ \t]*\([ \t]*([^()\n]{2,30}?)[ \t]*\)/gu, '$1 🆚 ⌞$2⌝');
    t = t.replace(new RegExp('([⌝\\]])[ \\t]*' + MD + '[ \\t]*(?!<a?:[vV][sS][fF]?:)<a?:\\w+:\\d+>[ \\t]*(?=' +
      MD + '[⌞\\[])', 'gu'), '$1 🆚 ');
    t = t.replace(/⌞([^⌞⌝\n]{1,80})⌝/gu, function (_m, x) { return '⌞' + equipoDeBanderas(x) + '⌝'; });
    t = t.replace(/\[([^\[\]\n]{1,40})\]/gu, function (_m, x) { return '[' + equipoDeBanderas(x) + ']'; });
    var ls = t.split('\n');
    for (var i = 0; i < ls.length; i++) {
      var l = ls[i], m = TERCER_ENC.exec(l);
      if (!m || buscarRonda(l) || nombresDeLinea(l).length) continue;
      if (/^\s*[:：]\s*[^\s*_`~|]/.test(l.slice(m.index + m[0].length))) continue;
      var sig = '';
      for (var j = i + 1; j < ls.length; j++) { if (ls[j].trim()) { sig = ls[j]; break; } }
      if (nombresDeLinea(sig).length) ls[i] = l.replace(TERCER_ENC, 'TERCER LUGAR');
    }
    return ls.join('\n');
  }

  /* `RONDA.search()`: con los bordes de palabra de Python, que ven las tildes */
  function buscarRonda(l) {
    var re = new RegExp(RONDA_ALT, 'gi'), m;
    while ((m = re.exec(l))) {
      var antes = Array.from(l.slice(0, m.index)).pop() || '';
      var despues = Array.from(l.slice(m.index + m[0].length))[0] || '';
      if (!PALABRA.test(antes) && !PALABRA.test(despues)) return m;
      re.lastIndex = m.index + 1;
    }
    return null;
  }

  function hallar(re, s) {
    var out = [], m;
    re.lastIndex = 0;
    while ((m = re.exec(s))) out.push(m[1]);
    return out;
  }

  /* `escuchar.nombres_de_linea()` */
  function nombresDeLinea(l) {
    var i, lados, enm;
    if (SEP.test(l)) {
      lados = [];
      l.split(SEP_G).forEach(function (seg) {
        enm = [];
        for (i = 0; i < DELIMS.length; i++) {
          enm = hallar(DELIMS[i], seg).map(function (x) { return x.trim(); }).filter(function (x) { return norm(x); });
          if (enm.length) break;
        }
        if (enm.length >= 2 && enm.some(function (x) { return /[+,&]/.test(x); })) lados = lados.concat(enm);
        else if (enm.length >= 2) lados.push(enm.join(' + '));
        else if (enm.length === 1) lados.push(enm[0]);
        else {
          var t = quitarBordes(seg.replace(/[⌞⌝\[\]]/g, ''),
            [' ', '.', '·', '▪', '️', '♠', '︎', '-', '–', '—', '*', '_', '`']);
          // un equipo se mide por integrante: ver `escuchar.nombres_de_linea()`
          var partes = t.split(/[+&]/).filter(function (p) { return norm(p); });
          if ((partes.length > 1 && partes.every(function (p) { return norm(p).length <= 28; })) ||
              (norm(t).length > 1 && norm(t).length <= 28)) lados.push(t);
        }
      });
      var n = lados.length;
      lados = lados.filter(function (x) { return !VACIO[norm(x)]; });
      if (lados.length >= 2) return lados.map(function (x) { return sinRefuerzos(sinMarcas(x)); });
      if (lados.length < n) return [];
    }
    for (i = 0; i < DELIMS.length; i++) {
      // sin nombre no hay lado: el hueco `⌞ + ⌝` o `［ ］` de la plantilla. Una
      // mención sí es alguien, aunque `norm()` la borre (ver `escuchar.py`)
      var hay = hallar(DELIMS[i], l).map(function (x) { return x.trim(); })
        .filter(function (x) { return (norm(x) || /<@!?\d+>/.test(x)) && !VACIO[norm(x)]; });
      if (hay.length >= 2) return hay.map(function (x) { return sinRefuerzos(sinMarcas(x)); });
    }
    return [];
  }

  /* 🔑 `escuchar.sin_refuerzos()`: el refuerzo `(EZE 🇦🇷)` adentro del marco, al
     principio o al final del lado, no es del lado; y la «R» suelta después de la
     bandera (`SIX 🇦🇷 R`) es una marca, no el nombre. ⚠️ Sin lookbehind: un
     iPhone con Safari viejo no lo entiende y se caería la página entera. */
  var REFUERZO_INI = new RegExp('^\\s*[(（][^()（）]*' + BANDERA + '[^()（）]*[)）]\\s*', 'u');
  var REFUERZO_FIN = new RegExp('\\s+[(（][^()（）]*' + BANDERA + '[^()（）]*[)）]\\s*$', 'u');
  var R_SUELTA = new RegExp('(' + BANDERA + ')\\s+R\\s*$', 'u');
  function sinRefuerzos(lado) {
    var s = String(lado || '').replace(REFUERZO_INI, '').replace(REFUERZO_FIN, '');
    s = s.split(/(\s*[+&]\s*)/).map(function (p, i) { return i % 2 ? p : p.replace(R_SUELTA, '$1'); })
      .join('').trim();
    return norm(s) || /<@!?\d+>/.test(s) ? s : String(lado || '');
  }

  /* `escuchar.unir_continuadas()` */
  function unirContinuadas(texto) {
    var abiertas = function (s) { return (s.split('⌞').length - 1) - (s.split('⌝').length - 1); };
    var sigue = function (s) {
      if (abiertas(s) > 0) return true;
      if (SEP.test(s) && nombresDeLinea(s).length < 2) return true;
      return /\+$/.test(s.replace(/\s+$/, ''));
    };
    var salida = [], buf = null;
    lineas(texto).forEach(function (l) {
      if (buf !== null) {
        if (!l.trim() || (buscarRonda(l) && !nombresDeLinea(l).length)) {
          salida.push(buf, l);
          buf = null;
          return;
        }
        buf = buf.replace(/\s+$/, '') + ' ' + l.trim();
        if (!sigue(buf)) { salida.push(buf); buf = null; }
        return;
      }
      if (sigue(l)) buf = l; else salida.push(l);
    });
    if (buf !== null) salida.push(buf);
    return salida.join('\n');
  }

  function partirEquipo(lado, vistos) {
    if (!vistos.size || /[+,&()（）⌞⌝\[\]]/.test(lado || '')) return lado;
    var pal = String(lado).trim().split(/\s+/);
    if (pal.length < 2 || vistos.has(norm(lado))) return lado;
    var mejor = [[]];
    for (var k = 0; k < pal.length; k++) mejor.push(null);
    for (var i = 1; i <= pal.length; i++) {
      for (var j = 0; j < i; j++) {
        if (mejor[j] !== null && vistos.has(norm(pal.slice(j, i).join(' ')))) {
          var c = mejor[j].concat([pal.slice(j, i).join(' ')]);
          if (mejor[i] === null || c.length < mejor[i].length) mejor[i] = c;
        }
      }
    }
    var g = mejor[pal.length];
    return g && g.length >= 2 ? g.join(' + ') : lado;
  }

  function equiposConEspacios(rs) {
    var vistos = new Set(), out = [];
    rs.forEach(function (R) {
      out.push([R[0], R[1].map(function (b) { return b.map(function (x) { return partirEquipo(x, vistos); }); })]);
      R[1].forEach(function (b) {
        b.forEach(function (x) {
          if (!/[+,&]/.test(x)) vistos.add(norm(x.replace(HISTORIA, '')));
        });
      });
      vistos.delete('');
    });
    return out;
  }

  /* `escuchar.rondas_de()`: [[ronda, [[lados…]…]]…] */
  function rondasDe(texto) {
    var out = [], actual = null, bats = [];
    texto = plano(texto);
    lineas(unirContinuadas(texto)).forEach(function (l) {
      var m = buscarRonda(l), nombres = nombresDeLinea(l);
      var cy = !m && !nombres.length && CYPHER_ENC.test(l.trim());
      if ((m || cy) && !nombres.length) {
        var e = cy ? 'FILTROS' : m[0].toUpperCase().replace(/\s+/g, ' ').trim();
        if (actual && bats.length) out.push([actual, bats]);
        actual = ALIAS[e] || e;
        bats = [];
        return;
      }
      if (nombres.length && actual && !(PODIO.test(l) && !CONTRA.test(l))) bats.push(nombres);
    });
    if (actual && bats.length) out.push([actual, bats]);
    return equiposConEspacios(out);
  }

  /* ── de acá para abajo no hay copia de Python: es lo que la página dibuja ── */
  function equipo(s) {
    var p = String(s || '').split(/[+&]/).map(norm).filter(Boolean);
    return p.length > 1 ? p : [];
  }
  function mismos(a, b) {
    return a.length === b.length && a.every(function (x) { return b.indexOf(x) >= 0; });
  }
  function dentro(a, b) {
    return a.length < b.length && a.every(function (x) { return b.indexOf(x) >= 0; });
  }
  function clave(s) { return norm(String(s || '').replace(HISTORIA, '')); }
  function sinPokemon(lado) {
    if (!POKEMON.test(lado || '')) return lado;
    return String(lado).split(/[+,&]/).map(function (x) { return x.trim(); })
      .filter(function (x) { return x && !POKEMON.test(x); }).join(' + ');
  }

  /* la línea del campeón: `CAMPEÓN: X`, sin tomar la del SUB-campeón */
  function lineaCampeon(texto) {
    var re = /(SUB[\s\-]*)?(?:CAMPE[OÓ]N|\b(?:1\s*(?:ER|RO)|PRIMER)\s+PUESTO)\s*:?\s*[*_`~|┋]*\s*([^\n]{1,60})/gi, m;
    while ((m = re.exec(texto))) { if (!m[1]) return m[2].trim(); }
    return '';
  }
  /* `camp2` de `escuchar.resolver()`: el renglón de abajo de la línea del
     campeón —el nombre puede estar ahí, o seguir ahí: «CAMPEON: Hassan🇪🇬 +» y
     abajo el resto del equipo (EL RAP FECHA 5)—, salvo que sea el del segundo */
  function renglonDeAbajo(texto) {
    var re = /(SUB[\s\-]*)?(?:CAMPE[OÓ]N|\b(?:1\s*(?:ER|RO)|PRIMER)\s+PUESTO)\s*:?\s*[*_`~|┋]*\s*([^\n]{1,60})/gi, m;
    while ((m = re.exec(texto)) && m[1]) { /* el del SUB-campeón no */ }
    if (!m) return '';
    var abajo = lineas(texto.slice(m.index + m[0].length)).slice(1, 3).map(function (l) { return l.trim(); })
      .filter(Boolean)[0] || '';
    return /SEGUND|SUB[\s\-]*CAMPE|\b2\s*(?:DO|ND|°|º)\b|\bPUESTO\b|\bLUGAR\b|M\.?\s*V\.?\s*P\b/i.test(abajo) ? '' : abajo;
  }
  /* `escuchar.SUBCAMPEON`: en una final de dos, saber quién perdió es saber quién ganó */
  function lineaSubcampeon(texto) {
    var m = /(?:SUB[\s\-]*CAMPE[OÓ]N|\b(?:2\s*(?:DO|DO\.)|SEGUNDO)\s+PUESTO)\s*:?\s*[*_`~|┋]*\s*([^\n]{1,60})/i.exec(texto);
    return m ? m[1].trim() : '';
  }

  /* los lados de la final que dice la línea del campeón (uno solo, o no dice) */
  function campeonDe(camp, b) {
    var c = norm(camp), ce = equipo(camp);
    // ⚠️ `CAMPEÓN: FULLY🇨🇱 @FULLY`: la mención ya viene como nombre
    // (`conNombres()` del vigía), así que la línea EMPIEZA con el
    // finalista y no es igual a él. Python la borra antes de comparar.
    return !c ? [] : b.filter(function (s) {
      var e = equipo(s), k = clave(s);
      return k === c || (e.length && ce.length && mismos(e, ce)) ||
        (e.length && e.every(function (m) { return c.indexOf(m) >= 0; })) ||
        (!e.length && k.length >= 2 && c.indexOf(k) === 0);
    });
  }

  /* quién pasó en cada batalla: el que aparece en la ronda siguiente */
  function resolver(rs, texto) {
    var arbol = rs.filter(function (R) { return R[0] !== 'TERCER LUGAR'; });
    var camp = lineaCampeon(texto), camp2 = renglonDeAbajo(texto);
    return rs.map(function (R) {
      var k = arbol.indexOf(R), sig = k >= 0 && k + 1 < arbol.length ? arbol[k + 1] : null;
      var lados = [], miembros = [], eqs = [];
      if (sig) {
        sig[1].forEach(function (b) {
          b.forEach(function (x) {
            x = sinPokemon(x);
            lados.push(clave(x));
            if (equipo(x).length) eqs.push(equipo(x));
            String(x).replace(HISTORIA, '').split(/[+&]/).forEach(function (m) { if (norm(m)) miembros.push(norm(m)); });
          });
        });
      }
      return [R[0], R[1].map(function (b) {
        if (R[0] === 'TERCER LUGAR') return [b, '', ''];
        if (!sig) {
          // la última ronda: el campeón, si ya lo escribieron
          var g = campeonDe(camp, b);
          // el equipo partido en dos renglones, y el nombre en el de abajo
          if (g.length !== 1 && camp2 && /[+&]$/.test(camp)) g = campeonDe(camp + ' ' + camp2, b);
          if (g.length !== 1 && camp2) g = campeonDe(camp2, b);
          // 🔑 `escuchar.resolver()`: si el campeón no engancha —DESGRACIAS EN
          // TOKYO VOL 11 dice `CAMPEÓN: JOVEN ALA` con el lado `PRR`, dos
          // alias de Hassan—, el SUB-CAMPEÓN lo dice. Sólo con dos lados, sólo
          // si engancha con uno, y nunca si la línea nombra a un equipo o a
          // los dos (`SUB-CAMPEÓN: [Nc] [Mcnadie]`, CARABOBO).
          if (g.length !== 1 && b.length === 2) {
            var sub = lineaSubcampeon(texto), ns = norm(sub);
            if (ns && !equipo(sub).length && (sub.match(/\[/g) || []).length <= 1) {
              var pierde = b.filter(function (s) {
                var k = clave(s);
                return k && (k === ns || (k.length >= 2 && ns.indexOf(k) >= 0));
              });
              if (pierde.length === 1) g = b.filter(function (s) { return s !== pierde[0]; });
            }
          }
          return [b, g.length === 1 ? g[0] : '', ''];
        }
        var ganan = b.filter(function (s) {
          return lados.indexOf(clave(s)) >= 0 || (!equipo(s).length && miembros.indexOf(clave(s)) >= 0);
        });
        if (!ganan.length) ganan = b.filter(function (s) { return equipo(s).length && eqs.some(function (e) { return mismos(e, equipo(s)); }); });
        if (!ganan.length) {
          var sub = b.filter(function (s) { return equipo(s).length && eqs.some(function (e) { return dentro(equipo(s), e); }); });
          if (sub.length === 1) ganan = sub;
        }
        // los que pasan de dos equipos y se juntan (AGREEMENT DOOMSDAY)
        if (!ganan.length && b.length >= 2 && b.every(function (s) { return equipo(s).length; })) {
          var todos = [].concat.apply([], b.map(equipo));
          var fus = [];
          sig[1].forEach(function (bb) {
            bb.forEach(function (x) {
              var e = equipo(x);
              if (e.length && e.every(function (m) { return todos.indexOf(m) >= 0; }) &&
                  b.filter(function (s) { return equipo(s).some(function (m) { return e.indexOf(m) >= 0; }); }).length >= 2) fus.push(x);
            });
          });
          if (fus.length === 1) {
            var ef = equipo(fus[0]), resto = [];
            b.forEach(function (s) {
              String(s).split(/[+&]/).forEach(function (m) {
                m = m.trim();
                if (norm(m) && ef.indexOf(norm(m)) < 0) resto.push(m);
              });
            });
            return [[fus[0], resto.join(' + ')], fus[0], ''];
          }
        }
        return [b, ganan.length === 1 ? ganan[0] : '', ganan.length > 1 ? 'pasan ' + ganan.length : ''];
      })];
    });
  }

  /* `llaves_web.enlazar()`: de qué batallas vienen los lados de cada una */
  function enlazar(rondas) {
    var arbol = rondas.filter(function (R) { return R.r !== 'Tercer puesto'; });
    var miem = function (s) { return String(s || '').split(/[+,]/).map(norm).filter(Boolean); };
    for (var k = 1; k < arbol.length; k++) {
      var prev = arbol[k - 1].b, cur = arbol[k].b, usado = prev.map(function () { return false; });
      cur.forEach(function (b) {
        var m = [];
        b[0].forEach(function (s) { m = m.concat(miem(s)); });
        prev.forEach(function (a, i) {
          if (!usado[i] && b[3].length < b[0].length && miem(a[1]).some(function (x) { return m.indexOf(x) >= 0; })) {
            b[3].push(i);
            usado[i] = true;
          }
        });
      });
      prev.forEach(function (_a, i) {
        if (usado[i]) return;
        for (var j = 0; j < cur.length; j++) {
          var b = cur[j];
          if (b[3].length < b[0].length && b[3].some(function (x) { return Math.abs(x - i) === 1; })) {
            b[3].push(i);
            usado[i] = true;
            break;
          }
        }
      });
      cur.forEach(function (b) { b[3].sort(function (x, y) { return x - y; }); });
    }
    return rondas;
  }

  /* el nombre del evento: `llaves_a_entrada.titulo()`, limpio para mostrarlo */
  function titulo(texto) {
    var ls = lineas(texto).slice(0, 6);
    for (var i = 0; i < ls.length; i++) {
      var l = ls[i];
      var s = l.replace(/<a?:\w+:\d+>|<@[&!]?\d+>/g, ' ').replace(/[^\p{L}\p{N}_\s.\-]/gu, ' ')
        .replace(/\s+/g, ' ').trim();
      if (s.length < 3 || !/\p{L}/u.test(s)) continue;
      if (buscarRonda(s) || nombresDeLinea(l).length) continue;
      return quitarBordes(s.slice(0, 60), ['_', '*', '~', ' ']).trim();
    }
    return '';
  }

  var PARTIDA_MS = 3 * 3600 * 1000;
  function rondaN(r) { r = ALIAS[r] || r; return ORDEN.indexOf(r); }

  /* `escuchar._podio_de()`: ¿`t` es SÓLO el podio de la llave `rs`? La línea
     CAMPEÓN sin batallas, la llave con su FINAL y el campeón, un finalista */
  function podioDe(t, rs) {
    var camp = lineaCampeon(t);
    if (!camp || rondasDe(t).some(function (R) { return R[1].length; })) return false;
    var fin = [];
    rs.forEach(function (R) { if (rondaN(R[0]) === rondaN('FINAL')) fin = fin.concat(R[1]); });
    if (!fin.length) return false;
    var nc = norm(camp.replace(/<@!?\d+>/g, ''));
    if (!nc) return true;
    return fin.some(function (b) {
      return b.some(function (lado) {
        return String(lado).split(/[+,&]/).some(function (x) {
          x = norm(x);
          return x.length >= 2 && (nc.indexOf(x) >= 0 || x.indexOf(nc) >= 0);
        });
      });
    });
  }

  /* `escuchar.unir_partidas()`: la llave que vino en dos mensajes, en uno.
     🔴 Y EL PODIO EN SU PROPIO MENSAJE (FFA WORLD CUP, 27/09/2026): ver allá */
  function unirPartidas(ms) {
    var bloques = [];
    ms.slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }).forEach(function (m) {
      var t = traducir(plano(m.texto || ''));
      var rs = rondasDe(t);
      var b = bloques[bloques.length - 1];
      if (b && rs.length && b.rs.length && m.autor && m.autor === b.autor && m.canal === b.canal &&
          m.pub - b.ult <= PARTIDA_MS && rondaN(rs[0][0]) > rondaN(b.rs[b.rs.length - 1][0])) {
        b.texto += '\n' + (m.texto || '');
        b.ult = m.pub;
        b.ed = Math.max(b.ed, m.ed || 0);
        b.rs = rondasDe(traducir(plano(b.texto)));
        return;
      }
      if (b && b.rs.length && !b.podio && m.autor && m.autor === b.autor && m.canal === b.canal &&
          m.pub - b.ult <= PARTIDA_MS && podioDe(t, b.rs)) {
        b.texto += '\n' + (m.texto || '');
        b.ult = m.pub;
        b.ed = Math.max(b.ed, m.ed || 0);
        b.podio = true;
        return;
      }
      bloques.push({ id: m.id, canal: m.canal, sv: m.sv, g: m.g, autor: m.autor, pub: m.pub,
        ed: m.ed || m.pub, ult: m.pub, texto: m.texto || '', rs: rs });
    });
    return bloques;
  }

  /* 🔑 EL EQUIPO QUE LA LLAVE NOMBRA CON UN SOLO NOMBRE: «[TEAM VENECIA]» en
     un 2VS2 son dos personas (Dlx, 28/09/2026, con la VOL 16 en juego). La
     misma regla que `faltan_en_equipos()` de bot/llaves_a_entrada.py: si los
     demás lados de la primera ronda son todos del mismo tamaño y la gran
     mayoría, el de un nombre cuenta ese tamaño. En un MULTIVERSE, nada. */
  function faltanEnEquipos(rs) {
    var e = equiposConNombre(rs);
    return e[0].length * Math.max(e[1] - 1, 0);
  }
  /* `equipos_con_nombre()`: [los lados de un nombre que son un equipo, de cuántos].
     La página los dibuja como equipo, sin perfil (Dlx, 29/09/2026: «TEAM
     VENECIA no es un participante… es un equipo»). */
  function equiposConNombre(rs) {
    if (!rs.length) return [[], 0];
    var tams = [], solos = [];
    rs[0][1].forEach(function (b) {
      b.forEach(function (lado) {
        var n = String(lado).replace(HISTORIA, '').split(/[+&]/).filter(function (m) { return norm(m); }).length;
        if (n) tams.push(n);
        if (n === 1) solos.push(lado);
      });
    });
    var grandes = tams.filter(function (t) { return t >= 2; });
    var k = grandes[0];
    if (!grandes.length || grandes.some(function (t) { return t !== k; }) || !solos.length || grandes.length < 3 * solos.length) {
      return [[], 0];
    }
    return [solos, k];
  }

  /* `repetidos_en_la_primera()`: el que revive aparece dos veces en la primera
     ronda y ocupa dos lugares. Dlx, 28/09/2026: «en sí el formato es de 16»
     (COMPE DEL VACILE 1: Majiztral dos veces en octavos). */
  function repetidosEnLaPrimera(rs) {
    if (!rs.length) return 0;
    var vistos = {}, extra = 0;
    rs[0][1].forEach(function (b) {
      b.forEach(function (lado) {
        String(lado).replace(HISTORIA, '').split(/[+&]/).forEach(function (m) {
          var k = norm(m.replace(HISTORIA, ''));
          if (!k) return;
          if (vistos[k]) extra++;
          vistos[k] = 1;
        });
      });
    });
    return extra;
  }

  /* 🔑 `llaves_a_entrada.plantel()`, sin el padrón: la gente de TODAS las
     rondas. 🔴 El paréntesis se saca antes de partir —`gekto(chianluka+makma)`
     partido por `+` daba `gektochianluka` y `makma)`: ELRAP FECHA 6 contaba
     34 donde Python dice 29—, y lo de adentro cuenta sólo si es alguien nuevo.
     ⚠️ Se parte por `+ , /` y « - », NO por `&`: igual que Python y que los
     puntos (`sheet/equipos.py`), porque hay gente que se llama `prove&shows`. */
  var PAREN = /[(（][^)）]*[)）]?/g;
  function plantel(rs) {
    var out = {}, adentro = {};
    rs.forEach(function (R) {
      R[1].forEach(function (b) {
        b.forEach(function (n) {
          n = sinPokemon(String(n || ''));
          (n.match(PAREN) || []).forEach(function (x) {
            x.replace(/[()（）]/g, '').split(/[+,\/]/).forEach(function (p) {
              if (norm(p).length >= 2) adentro[norm(p)] = 1;
            });
          });
          var partes = n.replace(PAREN, '').split(/[+,\/]|\s-\s/);
          partes.forEach(function (p) {
            var k = norm(p);
            if (k.length >= 2 || (k && partes.length === 1)) out[k] = 1;
          });
        });
      });
    });
    Object.keys(adentro).sort().forEach(function (k) {
      var ya = out[k] || Object.keys(out).some(function (c) {
        return Math.min(k.length, c.length) >= 4 && (c.indexOf(k) === 0 || k.indexOf(c) === 0);
      });
      if (!ya) out[k] = 1;
    });
    return Object.keys(out).length;
  }

  /* ── la NAVE DE FUNA (CYPHER, aniquilación) ─────────────────────────────
     `escuchar.funa_de()` y `escuchar.medallas_de()`: la fase de eliminación es
     una lista, un nombre por renglón, con ❌ en los que cayeron (Dlx,
     29/09/2026). Lo que sigue —final, podio— se lee como cualquier llave. */
  var FUNA = /FASE\s+DE\s+ELIMINACI[OÓ]N|NAVE\s+DE\s+FUNA|ANIQUILACI[OÓ]N|\bC[IY]PHER\b/i;
  var CAYO = /[❌✖✗✘❎\u{1F6AB}]/gu;
  var UNO = /[『「⌞\[]\s*([^』」⌝\]]+?)\s*[』」⌝\]]/u;
  var MEDALLA = { '\u{1F947}': 1, '\u{1F948}': 2, '\u{1F949}': 3 };
  var PUNTAS = ' .·▪️*_`:-–—️';
  function recortar(s) {
    var a = Array.from(String(s || ''));
    while (a.length && PUNTAS.indexOf(a[0]) >= 0) a.shift();
    while (a.length && PUNTAS.indexOf(a[a.length - 1]) >= 0) a.pop();
    return a.join('');
  }
  function unoDeRenglon(l) {
    var s = plano(String(l || '')).trim().replace(/^[>\s]+/, '');
    CAYO.lastIndex = 0;
    var cayo = CAYO.test(s);
    s = s.replace(CAYO, '').replace(/<@&\d+>|@everyone|@here|▋/g, '');
    s = s.replace(/^\s*(?:\d{1,3}\s*[-.)–—]\s*|[▪️•·*\-–—]+\s*)/u, '');
    var m = UNO.exec(s);
    var t = recortar(sinMarcas(m ? m[1] : s));
    MENCION.lastIndex = 0;
    if (!(norm(t) || MENCION.test(t)) || norm(t).length > 28) return null;
    if (SEP.test(t) || buscarRonda(t) || PODIO.test(t) || FUNA.test(t)) return null;
    return [t, cayo];
  }
  function funaDe(texto) {
    var ls = lineas(plano(texto || ''));
    for (var i = 0; i < ls.length; i++) {
      if (!FUNA.test(ls[i]) || nombresDeLinea(ls[i]).length) continue;
      var out = [];
      for (var j = i + 1; j < ls.length; j++) {
        var l = ls[j];
        if (!l.trim()) continue;
        if (FUNA.test(l) && !nombresDeLinea(l).length) continue;
        if (nombresDeLinea(l).length || buscarRonda(l) || PODIO.test(l) ||
            Object.keys(MEDALLA).some(function (x) { return l.indexOf(x) >= 0; })) break;
        var u = unoDeRenglon(l);
        if (u) out.push(u);
      }
      if (out.length >= 4) return out;
    }
    return null;
  }
  function medallasDe(texto) {
    var out = {};
    lineas(plano(texto || '')).forEach(function (l) {
      var s = l.trim().replace(/^[>#*_ ]+/, '');
      var c = Array.from(s)[0], n = MEDALLA[c];
      if (!n || out[n] || PODIO.test(s)) return;
      var t = sinMarcas(recortar(s.slice(c.length)));
      MENCION.lastIndex = 0;
      if (norm(t) || MENCION.test(t)) out[n] = t;
    });
    return out;
  }

  /* 🔑 LA LLAVE PARA LA PÁGINA, con la misma forma que `datos/llaves_t1.json` */
  function aLlave(b) {
    var texto = traducir(plano(b.texto));
    var rs = b.rs || rondasDe(texto);
    // 🔑 una nave de funa se ve desde la fase, antes de que haya una batalla
    var fu = funaDe(texto);
    if (rs.length < 1 && !fu) return null;
    var coma = function (s) { return String(s || '').split(/\s*[+&]\s*/).filter(Boolean).join(', '); };
    var rondas = resolver(rs, texto).map(function (R) {
      return { r: ETIQUETA[R[0]] || R[0], b: R[1].map(function (x) {
        return [x[0].map(coma), coma(x[1]), x[2], []];
      }) };
    });
    // la final de una nave de funa que no dice CAMPEÓN pero sí «🥇 tam»
    // (`llaves_a_entrada.filas_funa()`)
    if (fu) {
      var med = medallasDe(texto), F = rondas.filter(function (R) { return R.r === ETIQUETA.FINAL; })[0];
      if (F && F.b.length === 1 && !F.b[0][1] && med[1]) {
        var gm = F.b[0][0].filter(function (s) { return clave(s) && clave(s) === clave(med[1]); });
        if (gm.length === 1) F.b[0][1] = gm[0];
      }
    }
    var fin = rs.length && rs[rs.length - 1][0] === 'FINAL' && rondas[rondas.length - 1].b.length === 1 &&
      rondas[rondas.length - 1].b[0][1];
    return {
      vivo: true, id: b.id, nombre: titulo(b.texto) || 'La llave', sv: b.sv || '',
      // la misma cuenta que el ciclo (`filas_de()`): la que elige la escala de puntos
      participantes: Math.max(plantel(rs) + repetidosEnLaPrimera(rs) + faltanEnEquipos(rs), fu ? fu.length : 0),
      rondas: enlazar(rondas), tabla: [],
      sin: equiposConNombre(rs)[0],
      funa: fu || undefined,
      links: b.g && b.canal ? ['https://discord.com/channels/' + b.g + '/' + b.canal + '/' + b.id] : [],
      pub: b.pub, ed: b.ed, terminada: !!fin,
      // la ronda que se está jugando: la última que tiene batallas sin ganador
      enJuego: (function () {
        for (var i = rondas.length - 1; i >= 0; i--) {
          if (rondas[i].r !== 'Tercer puesto' && rondas[i].b.some(function (x) { return !x[1]; })) return rondas[i].r;
        }
        return rondas.length ? rondas[rondas.length - 1].r : fu ? 'Fase de eliminación' : '';
      })()
    };
  }

  /* ── los veredictos en vivo ────────────────────────────────────────────
     🔑 Dlx, 28/09/2026: «tienes que estar pendiente de todos los canales de
     eventos cuando hay un evento en vivo… en veredictos está todo lo que
     pasó». Snake Rap juega sus 5 VIDAS en #veredictos, sin llave: un título
     `# A 🆚 B` por batalla y un mensaje por juez con el nombre que vota.

     Esto arma las batallas —el último voto de cada juez, y gana la mayoría—
     y devuelve las tandas que son un formato de VIDAS con la forma de una
     llave, para que las dibuje `vidasVista()` de la página. ⚠️ SÓLO PARA
     MIRAR: los puntos los sigue sacando el ciclo, de las batallas cargadas.

     ⚠️ Lo que el texto no dice no se inventa: un juez que vota con una
     imagen no cuenta, y un empate queda sin ganador. En un formato de vidas
     el que gana SE QUEDA, así que un empate lo desempata la batalla de
     después: el que sigue peleando es el que ganó (y si la de después es la
     misma pareja, fue una réplica). */
  var TANDA_MS = 45 * 60000;
  function menorId(a, b) {
    return a.length !== b.length ? a.length - b.length : a < b ? -1 : a > b ? 1 : 0;
  }
  function tituloBatalla(t) {
    var ls = lineas(t);
    for (var i = 0; i < ls.length; i++) {
      var ns = nombresDeLinea(ls[i].replace(/^\s*#+\s*/, ''));
      if (ns.length === 2) return ns.map(sinMarcas);
    }
    return null;
  }
  /* el voto de un juez: un renglón con un solo nombre (`**FAZER 🇦🇷**`, `# ***DELUXE***`) */
  function votoDe(t) {
    var ls = lineas(t).map(function (x) { return x.trim(); }).filter(Boolean);
    return ls.length === 1 ? norm(ls[0].replace(/^#+\s*/, '').replace(MARCAS, '')) : '';
  }
  function veredictos(rows) {
    var porCanal = {}, tandas = [];
    (rows || []).slice().sort(function (a, b) { return menorId(String(a.id), String(b.id)); })
      .forEach(function (m) { (porCanal[m.canal] = porCanal[m.canal] || []).push(m); });
    Object.keys(porCanal).forEach(function (c) {
      var tanda = null;
      porCanal[c].forEach(function (m) {
        if (!tanda || m.pub - tanda.ult > TANDA_MS) {
          tanda = { canal: c, sv: m.sv, g: m.g, id: m.id, pub: m.pub, ult: m.pub, ed: m.ed || m.pub, bs: [], nom: {} };
          tandas.push(tanda);
        }
        tanda.ult = m.pub;
        tanda.ed = Math.max(tanda.ed, m.ed || m.pub);
        var t = traducir(plano(m.texto || ''));
        var tit = tituloBatalla(t);
        // 🔴 CADA PERSONA CON UN SOLO NOMBRE EN TODA LA TANDA: el título pone la
        // bandera a veces antes y a veces después («🇦🇷 DELUXE», «DELUXE 🇦🇷»), y
        // eran dos personas con la mitad de las derrotas cada una
        if (tit) {
          var un = function (x) { var k = norm(x); return tanda.nom[k] || (tanda.nom[k] = x); };
          tanda.bs.push({ a: un(tit[0]), b: un(tit[1]), votos: {}, id: m.id });
          return;
        }
        var cur = tanda.bs[tanda.bs.length - 1], v = votoDe(t);
        if (!cur || !v || !m.autor) return;
        var na = norm(cur.a), nb = norm(cur.b);
        var ea = v === na || (na.length > 2 && v.indexOf(na) >= 0);
        var eb = v === nb || (nb.length > 2 && v.indexOf(nb) >= 0);
        if (ea !== eb) cur.votos[m.autor] = ea ? 'a' : 'b';
      });
    });
    return tandas.map(vidasDeTanda).filter(Boolean);
  }
  function vidasDeTanda(T) {
    var bs = T.bs, N = 5;
    if (bs.length < 3) return null;
    var gente = {}, pares = {}, vidas = false;
    bs.forEach(function (x, i) {
      gente[norm(x.a)] = 1;
      gente[norm(x.b)] = 1;
      var k = [norm(x.a), norm(x.b)].sort().join('|');
      // ⚠️ LA MISMA PAREJA, NO SEGUIDA: en una llave no se repite (salvo la
      // réplica, que va seguida); en un formato de vidas, sí
      if (pares[k] != null && pares[k] < i - 1) vidas = true;
      pares[k] = i;
    });
    var n = Object.keys(gente).length;
    if (!vidas || n > 8) return null;
    bs.forEach(function (x, i) {
      var va = 0, vb = 0;
      Object.keys(x.votos).forEach(function (j) { if (x.votos[j] === 'a') va++; else vb++; });
      x.g = va > vb ? x.a : vb > va ? x.b : '';
      x.nota = va + vb ? 'votos ' + Math.max(va, vb) + '–' + Math.min(va, vb) : '';
      var sig = bs[i + 1];
      if (!x.g && sig) {
        var misma = [norm(x.a), norm(x.b)].sort().join('|') === [norm(sig.a), norm(sig.b)].sort().join('|');
        var sigue = [x.a, x.b].filter(function (s) { return norm(s) === norm(sig.a) || norm(s) === norm(sig.b); });
        if (misma) x.nota = (x.nota ? x.nota + ' · ' : '') + 'réplica';
        else if (sigue.length === 1) { x.g = sigue[0]; x.nota = (x.nota ? x.nota + ' · ' : '') + 'siguió peleando'; }
      }
    });
    var perd = {}, fuera = 0;
    bs.forEach(function (x) {
      if (!x.g) return;
      var p = norm(x.g) === norm(x.a) ? x.b : x.a;
      perd[norm(p)] = (perd[norm(p)] || 0) + 1;
      if (perd[norm(p)] === N) fuera++;
    });
    return {
      vivo: true, veredictos: true, id: 'ver:' + T.id, nombre: '', sv: T.sv || '', participantes: n,
      rondas: [{ r: N + ' vidas', b: bs.map(function (x) { return [[x.a, x.b], x.g, x.nota, []]; }) }],
      tabla: [], links: T.g && T.canal ? ['https://discord.com/channels/' + T.g + '/' + T.canal + '/' + T.id] : [],
      pub: T.pub, ed: T.ed, terminada: n > 1 && fuera === n - 1, enJuego: 'Batalla ' + bs.length
    };
  }

  var LlaveVivo = { plano: plano, traducir: traducir, norm: norm, nombresDeLinea: nombresDeLinea,
    unirContinuadas: unirContinuadas, rondasDe: rondasDe, resolver: resolver, enlazar: enlazar,
    titulo: titulo, unirPartidas: unirPartidas, aLlave: aLlave, lineaCampeon: lineaCampeon,
    veredictos: veredictos, funaDe: funaDe, medallasDe: medallasDe };
  raiz.LlaveVivo = LlaveVivo;
})(typeof window !== 'undefined' ? window : globalThis);
