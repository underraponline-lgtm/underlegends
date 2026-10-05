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
   que un navegador no entiende tumba el archivo entero.

   🎤 Y DESDE EL 01/10/2026 LO USA TAMBIÉN EL VIGÍA, para «te toca»
   (`turnos()` en `bot/avisos.js`): `bot/desplegar.py` sube este mismo
   archivo como un módulo más del Worker. Por eso vale para los dos lados
   —`raiz` es `window` o `globalThis`— y por eso el bot llama con las mismas
   llaves que ve la página. Ahí sí corre en el Worker, pero una vez por
   minuto y sólo con llaves en vivo, no por cada visita. */
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
  // y `versus` entero: el `<:versus_:…>` de DIMENSIÓN DEL FREESTYLE. Ver `escuchar.VS_PROPIO`
  var VS_PROPIO = /<a?:(?!VSF?:)\w*?(?:vs|versus)\w*:\d+>/gi;
  var PODIO_PROPIO = /<a?:([123])[a-zº°]*_?puesto\w*:\d+>/gi;
  /* 🏛️ el VS y el podio escritos como texto (`:VSr:`, `:1erPuesto:`): `escuchar.VS_TEXTO` y `PODIO_TEXTO` */
  var VS_TEXTO = /(?<![<\w]):(?!vsf?:)\w*?(?:vs|versus)\w*:(?!\d)/gi;
  var PODIO_TEXTO = /(?<![<\w]):([123])[a-zº°]*_?puesto\w*:(?!\d)/gi;
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
  // `<a:Per:…>` también es un país, salvo las palabras: `escuchar.PALABRAS_PAIS`
  var PALABRAS_PAIS = { PAN: 1, PAR: 1, ESA: 1, VEN: 1, COL: 1, BOL: 1, USA: 1, BRA: 1, CHI: 1, CUB: 1, DOM: 1 };
  // `S E M I F I N A L`, sin lookbehind: el borde de atrás se captura. Ver `escuchar.ESPACIADA`
  var ESPACIADA = /(^|[^\p{L}\p{N}_])((?:\p{L} ){3,}\p{L})(?![\p{L}\p{N}_])/gu;
  // `[<:carts:…>]`, `[👑]`: un marco con sólo emojis es adorno. Ver `escuchar.ADORNO`
  var ADORNO = /\[[ \t]*(?:<a?:\w+:\d+>[ \t]*)+\]|\[[ \t]*[^\x00-\x7F\p{L}\p{N}_\s\[\]⌞⌝]+[ \t]*\]/gu;

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

  /* `escuchar.plano()`: las letras de fantasía, en letras comunes. 🏛️ Y las de cuadradito y circulito (la
     ACADEMIA, 04/10/2026: `🄾🄲🅃🄰🅅🄾🅂`) */
  function plano(t) {
    if (!t) return t || '';
    return Array.from(t).map(function (ch) {
      var c = ch.codePointAt(0);
      return (c >= 0x1D400 && c <= 0x1D7FF) || (c >= 0xFF01 && c <= 0xFF5E) ||
        (c >= 0x1F130 && c <= 0x1F149) || (c >= 0x24B6 && c <= 0x24E9) ? ch.normalize('NFKD') : ch;
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

  /* `escuchar._sin_marcas()`. 🏛️ Sin el «##» de adelante y con la bandera al final: «## 🇵🇪 SOSA» es
     «SOSA 🇵🇪» (la ACADEMIA, 04/10/2026) */
  function sinMarcas(x) {
    x = quitarBordes(String(x).replace(MARCAS, '').replace(/[ \t]*<a?:\w+:\d+>/g, ''), [' ', '*', '`']);
    x = x.replace(/^#{1,3}[ \t]+/, '');
    var m = /^((?:[\u{1F1E6}-\u{1F1FF}]{2}[ \t]*)+)(\S[\s\S]*)$/u.exec(x);
    if (m) x = m[2].replace(/\s+$/, '') + ' ' + m[1].replace(/\s/g, '');
    return quitarBordes(x, [' ', '*', '`']);
  }

  function paisDelEmoji(todo, nombre) {
    var nom = nombre.normalize('NFKD').replace(/\p{M}/gu, '');
    var partes = nom.split(/[^A-Za-z]+/).filter(Boolean);
    var ks = [partes.join('')].concat(partes);
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i], K = k.toUpperCase();
      if (k && PAIS[K] && (k.length > 3 || k === K || (/^[A-Z][a-z]+$/.test(k) && !PALABRAS_PAIS[K]))) {
        return bandera(PAIS[K]);
      }
    }
    // y el de dos letras, en mayúsculas y solo: `<a:CL:…>`
    if (partes.length === 1 && /^[A-Z]{2}$/.test(partes[0]) && PAIS_DE_EMOJI[partes[0].toLowerCase()]) {
      return bandera(partes[0].toLowerCase());
    }
    return todo;
  }

  /* `escuchar._sin_espaciar()`: `[ G R A N - F I N A L]` -> `[ GRAN - FINAL]`, si así se lee una ronda */
  function sinEspaciar(l) {
    var j = l.replace(ESPACIADA, function (_m, a, x) { return a + x.replace(/ /g, ''); });
    return j !== l && buscarRonda(j) && !buscarRonda(l) ? j : l;
  }

  function equipoDeBanderas(s) {
    if ((s.match(new RegExp(BANDERA + '{2}', 'gu')) || []).length < 2 || /[+,\/]/.test(s)) return s;
    s = s.replace(new RegExp('(' + BANDERA + ')(' + MD + ')[ \\t]*&[ \\t]*(?=' + MD + '[\\p{L}\\p{N}_])', 'gu'),
      '$1$2 + ');
    return s.replace(new RegExp('(' + BANDERA + ')(' + MD + ')[ \\t]+(?=' + MD + '[\\p{L}\\p{N}_])', 'gu'),
      '$1$2 + ');
  }

  /* `escuchar._podio_con_medallas()`: `🏆 |X` del pie de la llave, como `CAMPEÓN: X` (y 🥈, 🥉 igual). Sólo debajo
     de la última batalla y sólo el puesto que la llave no escribe ya con palabras (ONE PIECE, FFA, 30/09/2026) */
  var MEDALLA_PODIO = { '\u{1F3C6}': 'CAMPEÓN', '\u{1F947}': 'CAMPEÓN', '\u{1F948}': 'SUBCAMPEÓN', '\u{1F949}': '3ER PUESTO' };
  var PUNTAS_PODIO = Array.from(' .·▪️*_`:-–—️|┋');
  var TERCERO = /(?:\b3\s*(?:ER|RO)|TERC?ER)\s*(?:PUESTO|LUGAR)\s*:?\s*[*_`~|]*\s*([^\n]{1,80})/i;
  function hayCampeon(texto) {
    var re = /(SUB[\s\-]?)?(?:CAMPE[OÓ]N|\b(?:1\s*(?:ER|RO)|PRIMER)\s+PUESTO)\s*:?\s*[*_`~|┋]*\s*([^\n]{1,60})/gi, m;
    while ((m = re.exec(texto))) { if (!m[1]) return true; }
    return false;
  }
  function podioConMedallas(ls) {
    var ult = -1;
    ls.forEach(function (l, i) { if (CONTRA.test(l) && nombresDeLinea(l).length) ult = i; });
    if (ult < 0) return ls;
    var todo = ls.join('\n');
    var ya = { 'CAMPEÓN': hayCampeon(todo), 'SUBCAMPEÓN': !!lineaSubcampeon(todo), '3ER PUESTO': TERCERO.test(todo) };
    for (var i = ult + 1; i < ls.length; i++) {
      var s = ls[i].trim().replace(/^[>#*_ ]+/, '');
      var c = Array.from(s)[0], et = c && MEDALLA_PODIO[c];
      if (!et || ya[et] || PODIO.test(s) || buscarRonda(s) || CONTRA.test(s)) continue;
      var resto = sinMarcas(quitarBordes(s.slice(c.length), PUNTAS_PODIO));
      MENCION.lastIndex = 0;
      if (!(norm(resto) || MENCION.test(resto))) continue;
      ls[i] = et + ': ' + resto;
      ya[et] = true;
    }
    return ls;
  }

  /* `escuchar.traducir()`: los dialectos de los otros servidores */
  function traducir(texto) {
    if (!texto) return texto || '';
    // el emoji entre dos `<>` de más (DIMENSIÓN DEL FREESTYLE)
    var t = texto.replace(/<(<a?:\w+:\d+>)>/g, '$1');
    t = t.replace(VS_PROPIO, ' 🆚 ');
    // 🏛️ la RED BULL CREW de la ACADEMIA: el VS como texto, sin los marcos 〘〙 mal anidados ni la viñeta ➢
    t = t.replace(VS_TEXTO, ' 🆚 ').replace(/[〘〙]/g, ' ').replace(/^[ \t]*[➢➤]+[ \t]*/gm, '');
    t = t.replace(/<a?:(\w+):\d+>/g, paisDelEmoji);
    t = t.replace(/:flag_([a-z]{2}):/g, function (_m, cc) { return bandera(cc); });
    t = t.split('\n').map(sinEspaciar).join('\n');
    t = t.replace(PODIO_PROPIO, function (_m, n) {
      return ' ' + { '1': '1ER', '2': '2DO', '3': '3ER' }[n] + ' PUESTO: ';
    });
    t = t.replace(PODIO_TEXTO, function (_m, n) {
      return ' ' + { '1': '1ER', '2': '2DO', '3': '3ER' }[n] + ' PUESTO: ';
    });
    t = t.replace(/[『「〈][ \t]*(\d(?:ER|DO) PUESTO:)[ \t]*[』」〉]/g, '$1');
    t = t.replace(new RegExp(MD + '[「〈][ \\t]*', 'g'), '⌞');
    t = t.replace(new RegExp('[ \\t]*[」〉]' + MD, 'g'), '⌝');
    // `『x』` en par y sin comerse el negrito; el suelto es un tipeo; y el marco de puro emoji, adorno
    t = t.replace(/『[ \t]*([^『』\n]*?)[ \t]*』/g, '⌞$1⌝');
    t = t.replace(/[『』]/g, '');
    t = t.replace(ADORNO, '');
    // y las llaves `{x}` de Urban Freestyle, sólo en par: ver `escuchar.traducir()`
    t = t.replace(/\{[ \t]*([^{}\n]*?)[ \t]*\}/g, '⌞$1⌝');
    t = t.replace(/([⌝\]])[ \t]*<a?:\w+:\d+>[ \t]*\([ \t]*([^()\n]{2,30}?)[ \t]*\)/gu, '$1 🆚 ⌞$2⌝');
    t = t.replace(new RegExp('([⌝\\]])[ \\t]*' + MD + '[ \\t]*(?!<a?:[vV][sS][fF]?:)<a?:\\w+:\\d+>[ \\t]*(?=' +
      MD + '[⌞\\[])', 'gu'), '$1 🆚 ');
    t = t.replace(/⌞([^⌞⌝\n]{1,80})⌝/gu, function (_m, x) { return '⌞' + equipoDeBanderas(x) + '⌝'; });
    t = t.replace(/\[([^\[\]\n]{1,40})\]/gu, function (_m, x) { return '[' + equipoDeBanderas(x) + ']'; });
    var ls = podioConMedallas(t.split('\n'));
    for (var i = 0; i < ls.length; i++) {
      var l = ls[i];
      // la medalla sola de encabezado (`# ••• 🥉 •••`): abajo va la batalla por el tercero
      if (l.indexOf('\u{1F949}') >= 0 && !/[\p{L}\p{N}]/u.test(l)) {
        var sg = '';
        for (var j2 = i + 1; j2 < ls.length; j2++) { if (ls[j2].trim()) { sg = ls[j2]; break; } }
        if (nombresDeLinea(sg).length) ls[i] = 'TERCER LUGAR';
        continue;
      }
      var m = TERCER_ENC.exec(l);
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
      // un lado y el otro vacío a la vista (`⌞Geoka⌝ 🆚 ⌞⌝`): un cruce que espera rival (`escuchar.nombres_de_linea()`)
      if (lados.length === 1 && /⌞\s*⌝|\[\s*\]/.test(l)) return [sinRefuerzos(sinMarcas(lados[0]))];
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
    // y el `+` que sumaba al comodín: `YINN 🇲🇦 + (PICHULITAMC 🇦🇷)` (`escuchar.sin_refuerzos()`)
    if (s !== String(lado || '')) s = s.replace(/^\s*[+&,]\s*|\s*[+&,]\s*$/g, '');
    s = s.split(/(\s*[+&]\s*)/).map(function (p, i) { return i % 2 ? p : p.replace(R_SUELTA, '$1'); })
      .join('').trim();
    return norm(s) || /<@!?\d+>/.test(s) ? s : String(lado || '');
  }

  /* `escuchar.unir_continuadas()` */
  function unirContinuadas(texto) {
    var abiertas = function (s) { return (s.split('⌞').length - 1) - (s.split('⌝').length - 1); };
    var sigue = function (s) {
      if (abiertas(s) > 0) return true;
      // ⚠️ salvo el rival vacío a la vista: `⌞Geoka⌝ VS ⌞⌝` espera a su rival (`escuchar.unir_continuadas()`)
      if (SEP.test(s) && nombresDeLinea(s).length < 2 && !/⌞\s*⌝|\[\s*\]/.test(s)) return true;
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
    var m = /(?:SUB[\s\-]*CAMPE[OÓ]N|\b(?:2\s*(?:DO|DO\.)|SEGUNDO)\s+(?:PUESTO|LUGAR))\s*:?\s*[*_`~|┋]*\s*([^\n]{1,60})/i.exec(texto);
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
  /* 🔑 LA MISMA PERSONA CON OTRO NOMBRE (02/10/2026), como `escuchar.resolver()` con `quien`. `quien(nombre)` —opcional,
     lo da la página con lo que sabe: la tabla, los alias y lo que el vigía reconoció en vivo— devuelve las claves de
     persona de un nombre. Un lado de esta ronda pasa si su persona es la de UN nombre de la ronda siguiente que ningún
     lado de esta ronda explica por su propio nombre, y uno a uno; pasa con el nombre de después, para que el cuadro lo
     una. Sin `quien`, como siempre: el vigía de «te toca» llama sin él. */
  function porPersona(R, sig, quien) {
    var ren = {};
    if (!quien || !sig) return ren;
    var propios = {};
    R[1].forEach(function (bb) { bb.forEach(function (s) { propios[clave(s)] = 1; }); });
    var libres = {};
    sig[1].forEach(function (bb) {
      bb.forEach(function (x) {
        x = sinPokemon(x);
        if (equipo(x).length || propios[clave(x)]) return;
        (quien(String(x).replace(HISTORIA, '')) || []).forEach(function (q) { (libres[q] = libres[q] || []).push(x); });
      });
    });
    var tomados = {};
    R[1].forEach(function (bb) {
      bb.forEach(function (s) {
        if (equipo(s).length) return;
        var xs = [];
        (quien(String(s).replace(HISTORIA, '')) || []).forEach(function (q) {
          (libres[q] || []).forEach(function (x) { if (xs.indexOf(x) < 0) xs.push(x); });
        });
        if (xs.length === 1) (tomados[xs[0]] = tomados[xs[0]] || []).push(s);
      });
    });
    Object.keys(tomados).forEach(function (x) { if (tomados[x].length === 1) ren[tomados[x][0]] = x; });
    return ren;
  }

  function resolver(rs, texto, quien) {
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
      var ren = porPersona(R, sig, quien);
      return [R[0], R[1].map(function (b) {
        // el lado que es otra persona con otro nombre pasa con el nombre de después
        if (sig && Object.keys(ren).length && b.some(function (s) { return ren[s]; })) {
          var gp = b.filter(function (s) { return ren[s]; });
          var bp = b.map(function (s) { return ren[s] || s; });
          var otros = b.filter(function (s) {
            return !ren[s] && (lados.indexOf(clave(s)) >= 0 || (!equipo(s).length && miembros.indexOf(clave(s)) >= 0));
          });
          // y si con él pasan varios (un grupo de tres donde siguen dos), «pasan N», como abajo
          var npasan = gp.length + otros.length;
          if (npasan === 1) return [bp, ren[gp[0]], ''];
          if (npasan > 1) return [bp, '', 'pasan ' + npasan];
        }
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
  /* ⚠️ «al hueco de al lado» supone que la llave va en orden, y no siempre va (Dos Generaciones Vol 2, 01/10/2026): sólo
     si lo que enganchó por nombre está en orden (`_en_orden()`). Y del grupo donde pasan dos, cualquiera de los dos */
  function enlazar(rondas) {
    var arbol = rondas.filter(function (R) { return R.r !== 'Tercer puesto'; });
    var miem = function (s) { return String(s || '').split(/[+,]/).map(norm).filter(Boolean); };
    var pasan = function (a) { var m = /pasan (\d+)/.exec(String(a[2] || '')); return m ? +m[1] : 1; };
    var enOrden = function (cur) {
      var ult = -1;
      for (var j = 0; j < cur.length; j++) {
        var l = cur[j][3];
        if (!l.length) continue;
        if (Math.min.apply(null, l) <= ult) return false;
        ult = Math.max.apply(null, l);
      }
      return true;
    };
    for (var k = 1; k < arbol.length; k++) {
      var prev = arbol[k - 1].b, cur = arbol[k].b, usos = prev.map(function () { return 0; });
      cur.forEach(function (b) {
        var m = [];
        b[0].forEach(function (s) { m = m.concat(miem(s)); });
        prev.forEach(function (a, i) {
          if (b[3].length >= b[0].length || usos[i] >= pasan(a)) return;
          // el que ganó; y si pasan varios, cualquiera de los lados
          var pasaron = pasan(a) < 2 ? miem(a[1]) : [].concat.apply([], a[0].map(miem));
          if (pasaron.some(function (x) { return m.indexOf(x) >= 0; })) {
            b[3].push(i);
            usos[i] += 1;
          }
        });
      });
      if (enOrden(cur)) {
        prev.forEach(function (_a, i) {
          if (usos[i]) return;
          for (var j = 0; j < cur.length; j++) {
            var b = cur[j];
            if (b[3].length < b[0].length && b[3].some(function (x) { return Math.abs(x - i) === 1; })) {
              b[3].push(i);
              usos[i] = 1;
              break;
            }
          }
        });
      }
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
  // 🔑 y la NAVE DE EXTERMINACIÓN (FFA, 03/10/2026): el mismo formato con otro nombre (`escuchar.FUNA`)
  var FUNA = /FASE\s+DE\s+ELIMINACI[OÓ]N|NAVE\s+DE\s+FUNA|ANIQUILACI[OÓ]N|EXTERMINACI[OÓ]N|\bC[IY]PHER\b/i;
  var CAYO = /[❌✖✗✘❎\u{1F6AB}]/gu;
  // «ELIMINADO #3», «eliminado #1», «ELIMNINADO #6»: cayó, como la ❌ (`escuchar.ELIMINADO`)
  var ELIMINADO = /(^|[^\p{L}\p{N}_])ELIM[\p{L}\p{N}_]{0,4}NAD[OA]S?(?![\p{L}\p{N}_])(?:\s*#?\s*\d+)?/giu;
  // el adorno que sigue en el mismo renglón (`escuchar.COLA`)
  var COLA = /\s*(?:[─━═]{3,}|●❯|❮●).*$/u;
  // «Shisui (VELATZ)» (`escuchar._PAREN`)
  var PAREN = /^(.+?)\s*\(\s*([^()]+?)\s*\)(.*)$/u;
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
    var s = plano(String(l || '')).trim().replace(/^[>\s]+/, '').replace(COLA, '');
    CAYO.lastIndex = 0;
    ELIMINADO.lastIndex = 0;
    var cayo = CAYO.test(s) || ELIMINADO.test(s);
    ELIMINADO.lastIndex = 0;
    s = s.replace(CAYO, '').replace(ELIMINADO, '$1').replace(/<@&\d+>|@everyone|@here|▋/g, '');
    s = s.replace(/^\s*(?:\d{1,3}\s*[-.)–—]\s*|[▪️•·*\-–—]+\s*)/u, '');
    var m = UNO.exec(s);
    var t = recortar(sinMarcas(m ? m[1] : s));
    MENCION.lastIndex = 0;
    if (!(norm(t) || MENCION.test(t)) || norm(t).length > 28) return null;
    if (SEP.test(t) || buscarRonda(t) || PODIO.test(t) || FUNA.test(t)) return null;
    return [t, cayo];
  }
  function funaDe(texto) {
    var fu = funaInterna(texto);
    return fu ? fu.map(function (x) { return [x[0], x[1]]; }) : null;
  }
  // en qué ronda cayó cada uno («ELIMINADO #3»), en el orden de `funaDe()`, o null (`escuchar.funa_rondas()`).
  // Dlx, 03/10/2026: «¿podrías dar más detalles?… en este caso sí». Sólo se muestra: los puntos no cambian
  function funaRondas(texto) {
    var fu = funaInterna(texto);
    var rs = fu ? fu.map(function (x) { return x[2]; }) : [];
    return rs.some(function (r) { return r; }) ? rs : null;
  }
  function rondaDe(l) {
    ELIMINADO.lastIndex = 0;
    var m = ELIMINADO.exec(plano(String(l || '')).replace(COLA, ''));
    ELIMINADO.lastIndex = 0;
    var d = m ? /\d+/.exec(m[0]) : null;
    return d ? parseInt(d[0], 10) : null;
  }
  function funaInterna(texto) {
    var ls = lineas(plano(texto || ''));
    for (var i = 0; i < ls.length; i++) {
      if (!FUNA.test(ls[i]) || nombresDeLinea(ls[i]).length) continue;
      var out = [];
      var fin = ls.length;
      for (var j = i + 1; j < ls.length; j++) {
        var l = ls[j];
        if (!l.trim()) continue;
        if (FUNA.test(l) && !nombresDeLinea(l).length) continue;
        if (nombresDeLinea(l).length || buscarRonda(l) || PODIO.test(l) ||
            Object.keys(MEDALLA).some(function (x) { return l.indexOf(x) >= 0; })) { fin = j; break; }
        var u = unoDeRenglon(l);
        if (u) out.push([u[0], u[1], u[1] ? rondaDe(l) : null]);
      }
      if (out.length >= 4) {
        // 🔑 «Shisui (VELATZ)»: el de los paréntesis, si es quien sigue en la llave (`escuchar._quien_sigue()`)
        var despues = {};
        ls.slice(fin).forEach(function (l3) { nombresDeLinea(l3).forEach(function (n) { despues[norm(n)] = 1; }); });
        return out.map(function (x) { return [quienSigue(x[0], despues), x[1], x[2]]; });
      }
    }
    return null;
  }
  function quienSigue(n, despues) {
    var m = PAREN.exec(n);
    if (!m) return n;
    var afuera = m[1].trim(), adentro = m[2].trim();
    return norm(adentro) && despues[norm(adentro)] && !despues[norm(afuera)] ? adentro : n;
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
  function aLlave(b, quien) {
    var texto = traducir(plano(b.texto));
    var rs = b.rs || rondasDe(texto);
    // 🔑 una nave de funa se ve desde la fase, antes de que haya una batalla
    var fu = funaDe(texto);
    // y en qué ronda cayó cada uno, si la llave lo dice: la página lo muestra ronda por ronda
    var fr = fu ? funaRondas(texto) : null;
    if (rs.length < 1 && !fu) return null;
    var coma = function (s) { return String(s || '').split(/\s*[+&]\s*/).filter(Boolean).join(', '); };
    var rondas = resolver(rs, texto, quien).map(function (R) {
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
      funa: fu ? fu.map(function (x, i) { return fr && fr[i] ? [x[0], x[1], fr[i]] : x; }) : undefined,
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
  /* el voto de un juez: un renglón con un solo nombre (`**FAZER 🇦🇷**`, `# ***DELUXE***`). 🏛️ Una mano sola
     es `<izq>` o `<der>`: 🫲 / 👈 el de la izquierda del título, 🫱 / 👉 el de la derecha (la ACADEMIA,
     04/10/2026). Ver `escuchar.MANO_IZQ` */
  function votoDe(t) {
    var ls = lineas(t).map(function (x) { return x.trim(); }).filter(Boolean);
    if (ls.length !== 1) return '';
    var mano = ls[0].replace(/^#+\s*/, '').replace(/[\u{1F3FB}-\u{1F3FF}\uFE0F]/gu, '').trim();
    if (mano === '\u{1FAF2}' || mano === '\u{1F448}') return '<izq>';
    if (mano === '\u{1FAF1}' || mano === '\u{1F449}') return '<der>';
    return norm(ls[0].replace(/^#+\s*/, '').replace(MARCAS, ''));
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
        if (v === '<izq>' || v === '<der>') { cur.votos[m.autor] = v === '<izq>' ? 'a' : 'b'; return; }
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

  /* ── 🔑 LA LLAVE COMO SE JUGÓ, DE #VEREDICTOS (02/10/2026): `escuchar.llaves_de_veredictos()` línea por línea ──
     Dlx: «el orden verdadero de las llaves para ese evento estaba en el canal de veredictos». En FFA es #votaciones:
     el encabezado de cada ronda, cada batalla con TODOS sus lados y abajo el ganador —el renglón que nombra a uno solo;
     la réplica «A X B» y el «X» no votan—. Sin encabezado de ronda no es una llave (un 5 vidas sigue por
     `veredictos()`), y una ronda que vuelve para atrás es otro evento. El contrato con Python está en
     `bot/llaves_casos.json` (`llaves_v`). */
  function llavesDeVeredictos(rows) {
    var porCanal = {}, canales = [], out = [];
    (rows || []).slice().sort(function (a, b) {
      var x = String(a.id), y = String(b.id);
      return x.length - y.length || (x < y ? -1 : x > y ? 1 : 0);
    }).forEach(function (m) {
      if (!porCanal[m.canal]) { porCanal[m.canal] = []; canales.push(m.canal); }
      porCanal[m.canal].push(m);
    });
    function cerrar(cur) {
      if (!cur || !cur.bats.length) return;
      var bats = cur.bats;
      bats.forEach(function (b) {
        var cuenta = {}, vistos = [];
        b.votos.forEach(function (v) { if (!(v in cuenta)) { cuenta[v] = 0; vistos.push(v); } cuenta[v]++; });
        var top = vistos.slice().sort(function (x, y) { return cuenta[y] - cuenta[x]; });
        b.gan = top.length && (top.length === 1 || cuenta[top[0]] > cuenta[top[1]]) ? top[0] : null;
        b.razon = b.gan ? 'veredicto' : '';
        b.pasan = [];
      });
      var ultima = Math.max.apply(null, bats.map(function (x) { return ORDEN.indexOf(x.r); }));
      bats.forEach(function (b, i) {
        if (b.gan) return;
        var o = ORDEN.indexOf(b.r), despues = {};
        bats.forEach(function (bb) { if (ORDEN.indexOf(bb.r) > o) bb.lados.forEach(function (x) { despues[norm(x)] = 1; }); });
        var pasan = b.lados.filter(function (x) { return despues[norm(x)]; });
        if (pasan.length === 2 && b.lados.length === 2) {
          var misma = {};
          bats.slice(i + 1).forEach(function (bb) { if (bb.r === b.r) bb.lados.forEach(function (x) { misma[norm(x)] = 1; }); });
          var rev = pasan.filter(function (x) { return misma[norm(x)]; });
          if (rev.length === 1) pasan = pasan.filter(function (x) { return x !== rev[0]; });
        }
        if (pasan.length === 1) { b.gan = pasan[0]; b.razon = 'ronda siguiente'; } else if (pasan.length) {
          b.pasan = pasan; b.razon = 'pasan ' + pasan.length + ', no hay un ganador';
        } else b.razon = o === ultima ? 'última ronda y no dice campeón' : 'no aparece nadie después';
      });
      out.push({ id: cur.id, sv: cur.sv, g: cur.g, canal: cur.canal, pub: cur.pub, ed: cur.ed,
        batallas: bats.map(function (b) { return [b.r, b.lados, b.gan, b.razon, b.pasan]; }) });
    }
    canales.forEach(function (c) {
      var cur = null, ult = 0;
      porCanal[c].forEach(function (m) {
        var pub = +m.pub || 0;
        if (cur && pub - ult > TANDA_MS) { cerrar(cur); cur = null; }
        ult = pub;
        lineas(unirContinuadas(traducir(plano(m.texto || '')))).forEach(function (l) {
          var r = buscarRonda(l), ns = nombresDeLinea(l);
          if (r && !ns.length) {
            var e = r[0].toUpperCase().replace(/\s+/g, ' ').trim();
            e = ALIAS[e] || e;
            if (ORDEN.indexOf(e) < 0) return;
            if (cur && cur.bats.length && cur.r && ORDEN.indexOf(e) < ORDEN.indexOf(cur.r)) { cerrar(cur); cur = null; }
            if (!cur) cur = { canal: c, sv: m.sv || '', g: String(m.g || ''), id: String(m.id), pub: pub, ed: +m.ed || pub, r: null, bats: [] };
            cur.r = e;
            return;
          }
          if (!cur || !cur.r) return;
          if (ns.length >= 2 && SEP.test(l)) {
            cur.bats.push({ r: cur.r, lados: ns.map(sinMarcas), votos: [] });
            cur.ed = Math.max(cur.ed, +m.ed || pub);
            return;
          }
          if (cur.bats.length) {
            var k = norm(String(l).replace(/^\s*#+\s*/, '').replace(MARCAS, ''));
            var b = cur.bats[cur.bats.length - 1];
            var hits = b.lados.filter(function (x) { var n = norm(x); return n && (n === k || (n.length > 2 && k.indexOf(n) >= 0)); });
            if (hits.length === 1) { b.votos.push(hits[0]); cur.ed = Math.max(cur.ed, +m.ed || pub); }
          }
        });
      });
      cerrar(cur);
    });
    return out;
  }

  /* ── ¿DE QUÉ ANUNCIO ES ESTA LLAVE? ──────────────────────────────────────
     La página (`llaveDeEvento()` de app.js) y el bot en vivo (`chatVivo()` de bot/avisos.js) preguntan lo mismo, así
     que vive acá, donde los dos lo cargan. Es `cruzar()` de sheet/llaves_web.py, en dos pasadas:

     1 · POR NOMBRE (`porNombre`): el mismo servidor, publicada desde una hora antes hasta cinco después del arranque,
         alguna palabra en común que no sea de relleno —o la llave sin título— y SIN NÚMEROS QUE CHOQUEN: «VOL 11» y
         «VOL 12» son dos eventos. 🔴 «VOL» no dice nada (01/10/2026): «DESGRACIAS EN TOKYO VOL 20 1v1» se llevaba la
         llave de «Dos Generaciones Un Destino Vol 2», las dos de FFA, el mismo día.
     2 · 🔑 LA HUÉRFANA (`huerfana`, 05/10/2026; Dlx: «estas llaves en vivo no se detectan»): FFA anunció «DESGRACIAS
         EN TOKYO VOL 23 1v1» y su llave dice «VOL 22 1v1» —copió el título de la anterior—. El ciclo ya lo resolvía
         desde el 29/09 (la VOL 17 con la llave de la 16, `_huerfanas()`) y la página en vivo no. Las mismas reglas:
         la misma SERIE (el nombre sin números ni modalidad), una llave que NINGÚN OTRO ANUNCIO se lleva por nombre,
         publicada desde 15 minutos antes del anuncio hasta el SIGUIENTE ANUNCIO DE ESA SERIE (o 24 h), la misma
         FORMA (un 1v1 no se lleva una de equipos) y UNA SOLA candidata entre todas las que hay en vivo: con dos, no
         elige. Un botón que abre la llave de otro evento es peor que no tener botón.

     Un anuncio es `{nombre, sv, cuando, link, mod}`: `cuando` el arranque (ISO en UTC, con o sin Z, o ms) y `link` el
     del mensaje, que dice cuándo se publicó. */
  var RELLENO = { vol: 1, volumen: 1, edicion: 1, fecha: 1, the: 1, los: 1, las: 1, del: 1, con: 1, por: 1,
    una: 1, uno: 1, '1v1': 1, '2v2': 1, '3v3': 1, '4v4': 1, '1vs1': 1, '2vs2': 1, '3vs3': 1, '4vs4': 1 };
  var MODALIDAD_EV = /(^|[^a-z0-9])\d+\s*(?:vs|v|x)\s*\d+(?![a-z0-9])/gi;
  var TEMPORADA_EV = /(^|[^a-z0-9])(?:temporada|season|temp|t)\s*[.#:-]?\s*(\d+)/gi;
  var FORMA_EV = /(^|[^a-z0-9])(\d+)\s*(?:vs|v)\s*(\d+)(?![a-z0-9])/i;
  var HUERFANA_ANTES = 15 * 60000, HUERFANA_MS = 24 * 3600000, SERIE_MIN = 0.9;
  // 🔑 MEMORIA PARA LAS FUNCIONES DE NOMBRES (05/10/2026): son puras —un texto entra, lo mismo sale— y la asignación
  // las pide cientos de veces por dibujo. Medido con 70 anuncios y 10 llaves: 3.6 ms por asignación y 60 ms por
  // dibujo de la página, que en un teléfono son varias veces más. ⚠️ Lo que devuelven se comparte: nadie lo modifica
  function memo(f) {
    var m = new Map();
    return function (s) {
      var k = typeof s === 'string' ? s : String(s || '');
      var v = m.get(k);
      if (v === undefined && !m.has(k)) {
        if (m.size > 3000) m.clear();
        v = f(k);
        m.set(k, v);
      }
      return v;
    };
  }
  function sinVariantes(s) { return String(s || '').normalize('NFKD').replace(/🆚/g, 'vs').replace(/[︎️]/g, ''); }
  // `[temporada, edición]` de un nombre, en dígitos: `_numeros()` de sheet/llaves_web.py. Sin la modalidad («1v1»,
  // «2VS2», «1🆚1») ni la temporada del organizador («T2») mezcladas en la edición
  function numerosEv(s) {
    var t = '';
    s = sinVariantes(s).replace(MODALIDAD_EV, '$1 ').replace(TEMPORADA_EV, function (m, a, d) { t += d; return a + ' '; });
    return [t, s.replace(/\D/g, '')];
  }
  // ¿se contradicen? Dos ediciones distintas sí («VOL 20» y «Vol 2»); un número contra ninguno, no
  function chocanEv(x, y) {
    var a = numerosEv(x), b = numerosEv(y);
    return !!((a[1] && b[1] && a[1] !== b[1]) || (a[0] && b[0] && a[0] !== b[0]));
  }
  // ⚠️ NFKD ANTES de pasar a minúsculas: `𝓟𝓞𝓔𝓢Í𝓐 𝓒𝓡𝓤𝓓𝓐` (URBF, 01/10/2026) sale de NFKD en MAYÚSCULAS
  function palabrasEv(s) {
    return String(s || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length > 2; });
  }
  var instanteTexto = memo(function (s) { return Date.parse(s.replace(/Z$/, '') + 'Z'); });
  function instanteEv(x) { return typeof x === 'number' ? x : instanteTexto(String(x || '')); }
  // cuándo se PUBLICÓ el anuncio: del id de su mensaje (los ids de Discord llevan la hora); si no, el arranque
  var publicadoLink = memo(function (l) {
    var m = /\/(\d{15,22})\/?$/.exec(l);
    return m ? Math.floor(Number(m[1]) / 4194304) + 1420070400000 : NaN;
  });
  function publicadoEv(e) {
    var p = publicadoLink(e.link || e.url || '');
    return isNaN(p) ? instanteEv(e.cuando) : p;
  }
  // la serie del organizador: `_serie()` de sheet/llaves_web.py
  function serieEv(s) {
    s = sinVariantes(s).replace(MODALIDAD_EV, '$1 ').replace(TEMPORADA_EV, '$1 ');
    return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '')
      .replace(/\d/g, '');
  }
  // `difflib.SequenceMatcher(None, a, b).ratio()`, para nombres cortos
  function parecidoEv(a, b) {
    if (!a.length && !b.length) return 1;
    var mm = function (a0, a1, b0, b1) {
      var k = 0, ia = a0, jb = b0;
      for (var i = a0; i < a1; i++) {
        for (var j = b0; j < b1; j++) {
          var n = 0;
          while (i + n < a1 && j + n < b1 && a[i + n] === b[j + n]) n++;
          if (n > k) { k = n; ia = i; jb = j; }
        }
      }
      return k ? k + mm(a0, ia, b0, jb) + mm(ia + k, a1, jb + k, b1) : 0;
    };
    return 2 * mm(0, a.length, 0, b.length) / (a.length + b.length);
  }
  function mismaSerieEv(a, b) { return !!(a && b && (a === b || parecidoEv(a, b) >= SERIE_MIN)); }
  // `forma_anuncio()`: «solos», «equipos» o '' (no se sabe). Un MULTIVERSE o «pandillas» no se sabe
  function formaAnuncioEv(mod) {
    var s = sinVariantes(mod), t = s.toLowerCase();
    if (/multiverse|pandilla/.test(t)) return '';
    if (/dupla|equipo/.test(t)) return 'equipos';
    var m = FORMA_EV.exec(s);
    if (!m) return '';
    return +m[2] === 1 && +m[3] === 1 ? 'solos' : +m[2] === +m[3] ? 'equipos' : '';
  }
  numerosEv = memo(numerosEv);
  palabrasEv = memo(palabrasEv);
  serieEv = memo(serieEv);
  formaAnuncioEv = memo(formaAnuncioEv);
  // la de un anuncio entero: la de su modalidad, salvo que su NOMBRE diga otra —entonces no se sabe—. 🔴 FFA anunció
  // «DESGRACIAS EN TOKYO VOL 24 2v2» con la modalidad «1v1» (copió la VOL 23) y su llave de equipos se jugaba en vivo
  // sin dueño (05/10/2026). `forma_del_anuncio()` de sheet/llaves_web.py: el nombre sólo anula, nunca descarta solo
  function formaDelAnuncioEv(e) {
    var m = formaAnuncioEv(e.mod || e.modalidad), n = formaAnuncioEv(e.nombre);
    return m && n && m !== n ? '' : m;
  }
  // `forma_llave()`: un lado de equipo trae los nombres con coma («27, Piyi»)
  function formaLlaveEv(L) {
    var lados = [];
    ((L && L.rondas) || []).forEach(function (R) {
      (R.b || []).forEach(function (b) { (b[0] || []).forEach(function (x) { if (x) lados.push(String(x)); }); });
    });
    if (!lados.length) return '';
    var eq = lados.filter(function (x) { return x.indexOf(',') >= 0; }).length;
    return eq * 2 > lados.length ? 'equipos' : eq ? '' : 'solos';
  }
  // y la de cada llave, una vez por asignación (`asignar()` la prende): adentro de una asignación las llaves no cambian
  var formaLlaveSin = formaLlaveEv, FORMAS = null;
  formaLlaveEv = function (L) {
    if (!FORMAS || !L || typeof L !== 'object') return formaLlaveSin(L);
    var f = FORMAS.get(L);
    if (f === undefined) { f = formaLlaveSin(L); FORMAS.set(L, f); }
    return f;
  };
  // la misma llave: el mismo objeto, o el mismo id (la página y el Inicio nuevo pueden tener copias)
  function mismaLlave(x, y) { return x === y || !!(x && y && x.id && x.id === y.id); }
  // la llave por nombre de `e` entre `ls`: `porNombre()` y, con `todo`, `{L, n, cerca}` para el que asigna (ver `asignar()`)
  function mejorPorNombre(e, ls) {
    var t = instanteEv(e.cuando);
    // ⚠️ un anuncio sin hora (`ini` vacío) se mide desde que se publicó: con NaN no se juntaba nunca (revisión del 05/10)
    if (isNaN(t)) t = publicadoEv(e);
    var pe = palabrasEv(e.nombre), fe = formaDelAnuncioEv(e);
    var comun = function (L) {
      return palabrasEv(L.nombre).filter(function (w) { return !RELLENO[w] && pe.indexOf(w) >= 0; }).length;
    };
    var cand = [];
    (ls || []).forEach(function (L) {
      var p = L.pub || L.ed || 0, fl = '', n = 0;
      // 🔑 y la misma FORMA, como `_elegir()` del ciclo: un 1v1 no se lleva una llave de equipos (la VOL 16 de FFA tuvo
      // un 2VS2 y un 1VS1 la misma noche, con el mismo título)
      if ((!e.sv || !L.sv || e.sv === L.sv) && p >= t - 3600000 && p <= t + 5 * 3600000 &&
          !chocanEv(e.nombre, L.nombre) && !(fe && (fl = formaLlaveEv(L)) && fe !== fl) &&
          ((n = comun(L)) > 0 || !palabrasEv(L.nombre).length || L.nombre === 'La llave')) {
        cand.push({ L: L, n: n, cerca: Math.abs(p - t) });
      }
    });
    // la que más comparte y, entre las que comparten lo mismo, la más cerca en el tiempo (`_elegir()`)
    cand.sort(function (a, b) { return b.n - a.n || a.cerca - b.cerca; });
    return cand[0] || null;
  }
  function porNombre(e, ls) {
    var m = mejorPorNombre(e, ls);
    return m ? m.L : null;
  }
  function mismoAnuncio(a, b) {
    if (a === b) return true;
    if (a.link && b.link) return a.link === b.link;
    return (a.sv || '') === (b.sv || '') && a.nombre === b.nombre && instanteEv(a.cuando) === instanteEv(b.cuando);
  }
  // `ls`: entre cuáles se busca; `anuncios`: todos los que se conocen (para el siguiente de la serie y para saber qué
  // llave ya es de otro); `todas`: todas las llaves en vivo, para que con dos candidatas no elija
  // `libres`: las que ya se sabe que nadie se llevó por nombre (lo pasa `asignar()`); sin eso, se descarta la que algún
  // otro anuncio PODRÍA llevarse
  function huerfana(e, ls, anuncios, todas, libres) {
    var se = serieEv(e.nombre), pub = publicadoEv(e);
    if (!se || isNaN(pub)) return null;
    var pool = [];
    (ls || []).concat(todas || []).forEach(function (L) {
      if (L && !pool.some(function (x) { return x === L || (x.id && x.id === L.id); })) pool.push(L);
    });
    // si alguna llave en vivo ya es suya por nombre, la huérfana no es de este anuncio
    if (porNombre(e, pool)) return null;
    var fe = formaDelAnuncioEv(e);
    var cand = pool.filter(function (L) {
      var p = L.pub || L.ed || 0, fl = formaLlaveEv(L);
      return !L.veredictos && (L.sv || '') === (e.sv || '') && p >= pub - HUERFANA_ANTES &&
        mismaSerieEv(serieEv(L.nombre), se) && !(fe && fl && fe !== fl);
    });
    if (!cand.length) return null;
    var otros = (anuncios || []).filter(function (q) { return (q.sv || '') === (e.sv || '') && !mismoAnuncio(q, e); });
    var hasta = pub + HUERFANA_MS;
    otros.forEach(function (q) {
      var qp = publicadoEv(q);
      if (qp > pub && qp < hasta && mismaSerieEv(serieEv(q.nombre), se)) hasta = qp;
    });
    cand = cand.filter(function (L) {
      return (L.pub || L.ed || 0) < hasta && (libres || !otros.some(function (q) { return porNombre(q, [L]); }));
    });
    if (cand.length !== 1) return null;
    return (ls || []).filter(function (L) { return L === cand[0] || (L.id && L.id === cand[0].id); })[0] || null;
  }
  /* 🔑 LA ASIGNACIÓN ENTERA, COMO LA DEL CICLO (revisión del 05/10/2026). Preguntando anuncio por anuncio no alcanzaba:
     con la VOL 22 a la 1 PM y la VOL 23 a las 5 PM —las dos de FFA— y la llave de la 23 titulada «VOL 22», la VOL 22
     podía llevarse por nombre la llave de la 23, y la 23 se quedaba sin ninguna. `cruzar()` de sheet/llaves_web.py lo
     hace en dos pasadas sobre TODOS los anuncios a la vez: primero cada uno elige por nombre —la que más comparte y la
     más cerca en el tiempo—; después, los que quedaron sin llave toman una huérfana, sólo entre las que nadie se llevó.
     Devuelve `{porAnuncio: [[anuncio, llave]], deLlave: {id de la llave: anuncio}}`. */
  function asignar(anuncios, llaves) {
    var antes = FORMAS;
    FORMAS = new Map();
    try {
      var ans = (anuncios || []).slice().sort(function (a, b) { return publicadoEv(a) - publicadoEv(b); });
      var asig = [], tomadas = [], conLlave = [];
      // ⚠️ tomada por objeto o por id, no por `L.id` a secas: las llaves del vigía que arma el Inicio nuevo no traen id,
      // y con `tomadas[undefined]` la primera que se llevaba un anuncio sacaba de la huérfana a todas las demás
      var tomada = function (L) { return tomadas.some(function (x) { return mismaLlave(x, L); }); };
      // 1 · por nombre: cada anuncio, su mejor
      ans.forEach(function (a) {
        var m = mejorPorNombre(a, llaves);
        if (m) { asig.push([a, m.L]); tomadas.push(m.L); conLlave.push(a); }
      });
      // 2 · la huérfana, sólo entre las que nadie se llevó, y de a una (la que se lleva un anuncio ya no es de otro)
      ans.forEach(function (a) {
        if (conLlave.indexOf(a) >= 0) return;
        var libres = (llaves || []).filter(function (L) { return L && !tomada(L); });
        if (!libres.length) return;
        var L = huerfana(a, libres, anuncios, libres, true);
        if (L) { asig.push([a, L]); tomadas.push(L); }
      });
      var deLlave = {};
      asig.forEach(function (x) { if (x[1] && x[1].id && !deLlave[x[1].id]) deLlave[x[1].id] = x[0]; });
      return { porAnuncio: asig, deLlave: deLlave };
    } finally {
      FORMAS = antes;
    }
  }

  /* la llave en vivo del anuncio `e` entre `ls`, o null. Con `ctx = {anuncios, todas}` es la de `asignar()` sobre
     todos los anuncios que se conocen y todas las llaves en vivo (más las de `ls`), y sólo si es una de `ls`; sin
     `ctx`, por nombre (como antes) */
  // 🔑 LA ASIGNACIÓN DE TODOS CONTRA TODAS SIRVE PARA CADA ANUNCIO DE LA PÁGINA (05/10/2026): se calcula UNA vez por
  // contexto —la página arma uno por payload y por vuelta del vigía— y por lo que se le sume: un anuncio que no estaba
  // o llaves que no son de `todas`. Sin esto, 20 preguntas eran 20 asignaciones enteras (60 ms por dibujo, medido).
  // ⚠️ El contexto no se modifica después de usarlo: para otro estado, otro objeto
  var ASIGNADOS = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function claveLlave(L) { return L.id ? 'i' + L.id : 'n' + [L.sv || '', L.nombre || '', L.pub || '', L.ed || ''].join('|'); }
  function claveAnuncio(e) {
    return [e.link || e.url || '', e.sv || '', e.nombre || '', instanteEv(e.cuando), e.mod || e.modalidad || ''].join('|');
  }
  function deEvento(e, ls, ctx) {
    if (!ctx) return porNombre(e, ls);
    var todas = (ctx.todas || []).filter(Boolean), extra = [];
    (ls || []).forEach(function (L) {
      if (L && !todas.some(function (x) { return mismaLlave(x, L); }) &&
          !extra.some(function (x) { return mismaLlave(x, L); })) extra.push(L);
    });
    var ans = ctx.anuncios || [], mio = null;
    for (var i = 0; i < ans.length && !mio; i++) if (mismoAnuncio(ans[i], e)) mio = ans[i];
    var k = (mio ? '' : claveAnuncio(e)) + '#' + extra.map(claveLlave).join(',');
    var cache = ASIGNADOS ? ASIGNADOS.get(ctx) : null;
    if (ASIGNADOS && !cache) { cache = new Map(); ASIGNADOS.set(ctx, cache); }
    var ent = cache ? cache.get(k) : null;
    if (!ent) {
      ent = { e: mio ? null : e, r: asignar(mio ? ans : ans.concat([e]), todas.concat(extra)) };
      if (cache) { if (cache.size > 200) cache.clear(); cache.set(k, ent); }
    }
    var yo = mio || ent.e;
    for (var j = 0; j < ent.r.porAnuncio.length; j++) {
      if (ent.r.porAnuncio[j][0] !== yo) continue;
      var L = ent.r.porAnuncio[j][1];
      return (ls || []).filter(function (x) { return mismaLlave(x, L); })[0] || null;
    }
    return null;
  }

  var LlaveVivo = { plano: plano, traducir: traducir, norm: norm, nombresDeLinea: nombresDeLinea,
    llavesDeVeredictos: llavesDeVeredictos,
    deEvento: deEvento, asignar: asignar, porNombre: porNombre, huerfana: huerfana, chocan: chocanEv, numeros: numerosEv,
    serie: serieEv, formaAnuncio: formaAnuncioEv, formaDelAnuncio: formaDelAnuncioEv, formaLlave: formaLlaveEv,
    parecido: parecidoEv,
    unirContinuadas: unirContinuadas, rondasDe: rondasDe, resolver: resolver, enlazar: enlazar,
    titulo: titulo, unirPartidas: unirPartidas, aLlave: aLlave, lineaCampeon: lineaCampeon,
    veredictos: veredictos, funaDe: funaDe, funaRondas: funaRondas, medallasDe: medallasDe };
  raiz.LlaveVivo = LlaveVivo;
})(typeof window !== 'undefined' ? window : globalThis);
