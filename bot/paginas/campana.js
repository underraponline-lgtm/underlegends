/* ════════════════════════════════════════════════════════════════════
   LA CAMPANA — los avisos de eventos, del lado de la página.

   La vista `#/avisos` y el botón de Inicio. Lo que pasa acá es pedir el
   permiso, anotar este dispositivo en el Worker y dejar elegir de qué
   servidores avisar. Lo que manda las notificaciones es el vigía de
   `bot/avisos.js`, que revisa los canales de eventos cada minuto.

   🔴 UN ARCHIVO APARTE DE `app.js`, Y NO POR PROLIJIDAD. Esto usa
   `async/await` y APIs que un navegador viejo no tiene; si fallara adentro
   de `app.js` se llevaría puesto el ranking entero. Acá, si algo no
   anda, lo único que se apaga es la campana.

   ⚠️ EL PERMISO SE PIDE CON UN CLIC, NUNCA SOLO. Un navegador que ve un
   pedido de notificaciones al cargar la página lo castiga —Chrome lo
   silencia para siempre— y con razón: nadie sabe todavía qué le van a
   mandar. Acá primero se explica y después se pregunta.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var SOPORTA = 'serviceWorker' in navigator && 'PushManager' in window &&
    'Notification' in window;
  // ⚠️ EN iPHONE LOS AVISOS SOLO ANDAN CON LA PÁGINA INSTALADA: Safari
  // expone PushManager únicamente dentro de la app de pantalla de inicio.
  // Sin esta rama, un iPhone vería «tu navegador no puede» — cierto, pero
  // sin decir que hay una salida.
  var IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var INSTALADA = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    navigator.standalone === true;

  var REG = null;    // el service worker
  var SUB = null;    // la suscripción de ESTE dispositivo
  var EST = null;    // /api/avisos/estado
  var SVS = leer('campana:svs', []);   // [] = todos los servidores
  var MSG = '';
  // 🔑 `#/avisos/FFA,SR` O `#/avisos/todos`: EL LINK DE `/notify`. Dlx,
  // 25/09/2026: «que te dé la opción para activar las notificaciones desde
  // Discord… y seleccionar los servidores o para todos». Se elige en Discord
  // y acá se activa con un toque; si este dispositivo ya estaba activado, la
  // elección REEMPLAZA a la de antes, porque es exactamente lo que se eligió.
  // `null` = no vino del link; `[]` = todos.
  var PEDIDO = pedidoDelLink();
  function pedidoDelLink() {
    var m = /^#\/avisos\/([A-Za-z0-9,]+)$/.exec(location.hash || '');
    if (!m) return null;
    return m[1].toLowerCase() === 'todos' ? [] : m[1].toUpperCase().split(',').filter(Boolean);
  }
  function nombreSv(sv) {
    var s = servidores().filter(function (x) { return x.sv === sv; })[0];
    return s ? s.n : sv;
  }
  // ⚠️ SÓLO SERVIDORES QUE EL VIGÍA ESCUCHA. `null` si todavía no se sabe
  // cuáles son (el estado no llegó) o si del link no queda ninguno.
  function pedidoValido() {
    if (!PEDIDO) return null;
    var ok = servidores().map(function (s) { return s.sv; });
    if (!ok.length) return null;
    if (!PEDIDO.length) return [];
    var v = PEDIDO.filter(function (sv) { return ok.indexOf(sv) >= 0; });
    return !v.length ? null : v.length >= ok.length ? [] : v;
  }
  function textoPedido(v) {
    return !v.length ? 'todos los servidores' : v.map(nombreSv).join(', ');
  }
  // ⚠️ «Pruebas» se conserva: y «todos» con pruebas va como la lista entera
  // (ver `elegir()`), porque la lista vacía no trae las pruebas.
  function conPrueba(v) {
    if (SVS.indexOf(PRUEBA) < 0) return v;
    return (v.length ? v : servidores().map(function (s) { return s.sv; })).concat([PRUEBA]);
  }
  function aplicarPedido() {
    var v = pedidoValido();
    if (!v || !SUB) return;
    PEDIDO = null;
    SVS = conPrueba(v);
    guardar('campana:svs', SVS);
    MSG = 'Guardando…';
    pinta();
    alta(true).then(function () { MSG = '✅ Listo: te llegan los avisos de ' + textoPedido(v) + '.'; pinta(); })
      .catch(function (e) { MSG = '⚠️ No pude guardar: ' + e.message; pinta(); });
  }
  function leer(k, def) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; }
    catch (e) { return def; }
  }
  function guardar(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado */ }
  }

  function bytes(b64) {
    var s = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function igual(a, b) {
    if (!a || !b || a.byteLength !== b.byteLength) return false;
    var x = new Uint8Array(a), y = new Uint8Array(b);
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  function hace(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 90) return 'hace ' + Math.max(s, 1) + ' s';
    var m = Math.round(s / 60);
    if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60);
    return h < 24 ? 'hace ' + h + ' h' : 'hace ' + Math.round(h / 24) + ' días';
  }

  async function pedir(ruta, cuerpo) {
    var r = await fetch('/api/avisos/' + ruta, cuerpo ? {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    } : { headers: { accept: 'application/json' } });
    var d = {};
    try { d = await r.json(); } catch (e) { d = {}; }
    if (!r.ok) {
      var err = new Error(d.error || ('el servidor contestó ' + r.status));
      err.estado = r.status;
      throw err;
    }
    return d;
  }

  async function clave() { return (await pedir('clave')).clave; }

  // ── anotarse ────────────────────────────────────────────────────────
  async function alta(conServidores) {
    var cuerpo = { sub: SUB.toJSON() };
    // ⚠️ SIN `svs`, EL WORKER CONSERVA LOS QUE YA TENIA. La re-alta diaria
    // no los manda: si este navegador perdió su localStorage, mandar `[]`
    // borraría lo que la persona eligió.
    if (conServidores) cuerpo.svs = SVS;
    var d = await pedir('alta', cuerpo);
    if (Array.isArray(d.svs)) { SVS = d.svs; guardar('campana:svs', SVS); }
    guardar('campana:alta', Date.now());
  }

  async function activar() {
    MSG = 'Pidiendo permiso…'; pinta();
    var p = await Notification.requestPermission();
    if (p !== 'granted') { MSG = ''; pinta(); return; }
    MSG = 'Anotando este dispositivo…'; pinta();
    var k = await clave();
    REG = REG || await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    SUB = await REG.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(k) });
    // quien llega desde `/notify` se anota a lo que eligió en Discord
    var v = pedidoValido();
    if (v) { SVS = conPrueba(v); guardar('campana:svs', SVS); PEDIDO = null; }
    await alta(true);
    MSG = '';
    await probar(true);
  }

  // 🔑 EL SERVICE WORKER AVISA CUANDO UN PUSH LLEGA (ver sw.js). Con eso
  // la prueba puede decir DÓNDE se cortó, que era la pregunta de Dlx con
  // Opera GX: en su Samsung llegó y en la compu no, y desde la página
  // «no llegó al navegador» y «llegó y Windows la tapó» se veían igual.
  var LLEGO = [0];
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.avisos === 'llego') LLEGO[0] = Date.now();
    });
  }
  function esperarLlegada(desde, ms) {
    return new Promise(function (listo) {
      var t0 = Date.now();
      (function mirar() {
        if (LLEGO[0] >= desde) return listo(true);
        if (Date.now() - t0 > ms) return listo(false);
        setTimeout(mirar, 250);
      })();
    });
  }

  async function probar(recien) {
    MSG = 'Mandando uno de prueba…'; pinta();
    var desde = Date.now();
    try {
      var d = await pedir('probar', { endpoint: SUB.endpoint });
      if (!d.ok) {
        MSG = '⚠️ El servicio de avisos contestó ' + d.estado + '. Probá desactivar y activar de nuevo.';
        pinta();
        return;
      }
      MSG = recien ? 'Te mandé uno de prueba. Esperando que llegue…' : 'Enviado. Esperando que llegue…';
      pinta();
      var llego = await esperarLlegada(desde, 20000);
      // ⚠️ DOS FALLOS DISTINTOS, DOS CONSEJOS DISTINTOS. Si llegó al
      // navegador y no se vio, lo tapa el sistema; si no llegó, el
      // servicio de push de ese navegador no entrega, y ahí no hay
      // ajuste que lo arregle desde acá.
      MSG = llego
        ? '✅ Llegó a este dispositivo. Si no viste la notificación, la está tapando el ' +
          'sistema: en Windows, Configuración → Sistema → Notificaciones → activá tu ' +
          'navegador y apagá «No molestar».'
        : '⚠️ Tu navegador aceptó la suscripción pero el aviso no le llegó. Pasa con ' +
          'algunos navegadores de compu (Opera GX, por ejemplo): en esta compu probá con ' +
          'Chrome, Edge o Firefox. En el teléfono, Chrome anda.';
    } catch (e) {
      MSG = e.estado === 429 ? 'Esperá unos segundos entre pruebas.' : '⚠️ ' + e.message;
    }
    pinta();
  }

  // la ✕ del botón del Inicio: no se muestra más en este navegador
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#ctaCerrar')) return;
    guardar('campana:cerrada', 1);
    var c = $('#campanaCta');
    if (c) c.hidden = true;
  });

  async function desactivar() {
    MSG = 'Desactivando…'; pinta();
    var ep = SUB && SUB.endpoint;
    try { if (SUB) await SUB.unsubscribe(); } catch (e) { /* ya no estaba */ }
    SUB = null;
    if (ep) { try { await pedir('baja', { endpoint: ep }); } catch (e) { /* se cae sola */ } }
    guardar('campana:yo', null);
    MSG = 'Listo: este dispositivo ya no recibe avisos.';
    pinta();
  }

  // 🔑 VINCULAR: se entra con Discord (sin pedir nada nuevo: `prompt=none`)
  // y a la vuelta `vincularAvisos()` de app.js anota el dispositivo.
  function vincular() {
    if (typeof window.urlLogin !== 'function') throw new Error('recargá la página');
    location.href = window.urlLogin('v');
  }
  async function desvincular() {
    if (SUB) await pedir('desvincular', { endpoint: SUB.endpoint });
    guardar('campana:yo', null);
    MSG = 'Listo: este dispositivo ya no recibe tus avisos personales.';
    pinta();
  }
  window.addEventListener('lg:vinculado', function () {
    MSG = '✅ Listo: te llegan tus avisos (rango y tarjetas) en este dispositivo.';
    pinta();
  });
  window.addEventListener('lg:vinculado-no', function () {
    MSG = '⚠️ No pude vincularlo. Activá los avisos en este dispositivo y probá de nuevo.';
    pinta();
  });

  // 🧪 «Pruebas»: le llega a quien lo elige cuando Dlx escribe «probando»
  // en un canal de eventos (ver `prueba()` en bot/avisos.js).
  var PRUEBA = 'ZZZ';

  var tElegir = null;
  function elegir(sv) {
    var prueba = SVS.indexOf(PRUEBA) >= 0;
    var reales = SVS.filter(function (x) { return x !== PRUEBA; });
    var todos = servidores().map(function (s) { return s.sv; });
    if (sv === PRUEBA) prueba = !prueba;
    else if (sv === '') reales = [];
    else if (reales.indexOf(sv) >= 0) reales = reales.filter(function (x) { return x !== sv; });
    else reales = reales.concat([sv]);
    // elegir todos uno por uno es lo mismo que «todos»
    if (reales.length >= todos.length) reales = [];
    // ⚠️ «TODOS» ES LA LISTA VACÍA, Y LA VACÍA NO TRAE LAS PRUEBAS (el filtro
    // de `lote()` en avisos.js): con «Pruebas» elegido, la lista va entera.
    SVS = prueba ? (reales.length ? reales : todos).concat([PRUEBA]) : reales;
    guardar('campana:svs', SVS);
    pinta();
    clearTimeout(tElegir);
    tElegir = setTimeout(function () {
      alta(true).then(function () { MSG = '✅ Guardado.'; pinta(); })
        .catch(function (e) { MSG = '⚠️ No pude guardar: ' + e.message; pinta(); });
    }, 500);
  }

  function servidores() {
    var vistos = {}, out = [];
    ((EST && EST.vigia && EST.vigia.canales) || []).forEach(function (c) {
      if (!vistos[c.sv]) { vistos[c.sv] = 1; out.push({ sv: c.sv, n: c.svn || c.sv }); }
    });
    return out;
  }

  // ── dibujar ─────────────────────────────────────────────────────────
  function pinta() {
    var caja = $('#campana');
    var cta = $('#campanaCta');
    // ⚠️ `Notification` NO EXISTE en Safari de iPhone fuera de la pantalla
    // de inicio: nombrarlo a secas es un ReferenceError que apaga todo esto.
    var negado = typeof Notification !== 'undefined' && Notification.permission === 'denied';
    // 🔴 SE VA PARA QUIEN YA ACTIVÓ, Y SE PUEDE CERRAR. Dlx, 25/09/2026:
    // «si un usuario hizo todo el sistema para que le avise, que esto
    // desaparezca de su inicio». En iPhone la app de la pantalla de inicio
    // y Safari no comparten nada: en Safari la suscripción no se ve y el
    // botón volvía. Se recuerda que se activó, y la ✕ lo cierra.
    if (SUB) guardar('campana:activada', 1);
    if (cta) cta.hidden = !!SUB || !!leer('campana:activada', 0) ||
      !!leer('campana:cerrada', 0) || !(SOPORTA || IOS) || negado;
    if (!caja) return;
    var h = '';
    if (!SOPORTA && IOS && !INSTALADA) {
      h = '<p class="cp-tx">En iPhone y iPad los avisos llegan con la Liga en la pantalla de inicio:</p>' +
        '<ol class="cp-pasos"><li>Tocá <b>Compartir</b> (el cuadrado con la flecha).</li>' +
        '<li>Elegí <b>Agregar a inicio</b>.</li>' +
        '<li>Abrí la Liga <b>desde ese ícono</b> y volvé a esta pantalla.</li></ol>';
    } else if (!SOPORTA) {
      h = '<p class="cp-tx">Este navegador no puede recibir avisos. En Android andan Chrome, ' +
        'Firefox, Edge y Samsung Internet; en la compu, cualquiera de esos.</p>';
    } else if (negado) {
      h = '<p class="cp-tx">Las notificaciones de esta página están <b>bloqueadas</b>. Para ' +
        'activarlas: tocá el candado al lado de la dirección → <b>Notificaciones</b> → ' +
        '<b>Permitir</b>, y recargá.</p>';
    } else if (!SUB) {
      h = (pedidoValido() ? '<p class="cp-ok">Vas a activar los avisos de <b>' +
        esc(textoPedido(pedidoValido())) + '</b>, como elegiste en Discord.</p>' : '') +
        '<p class="cp-tx">Un aviso por evento, cuando el servidor lo anuncia. Nada más: ' +
        'ni resultados, ni publicidad, ni nada que no sea un evento por empezar.</p>' +
        '<button class="cp-btn" data-cp="activar"><i aria-hidden="true">&#128276;</i>' +
        '<span>Activar avisos</span></button>';
    } else {
      var svs = servidores();
      var reales = SVS.filter(function (x) { return x !== PRUEBA; });
      var todosOn = !reales.length || reales.length >= svs.length;
      h = '<p class="cp-ok">✅ Este dispositivo recibe los avisos.</p>';
      if (svs.length > 1) {
        h += '<p class="cp-tx">¿De qué servidores?</p><div class="chips cp-chips">' +
          '<button class="chip' + (todosOn ? ' on' : '') + '" data-sv="">Todos</button>' +
          svs.map(function (s) {
            return '<button class="chip' + (!todosOn && reales.indexOf(s.sv) >= 0 ? ' on' : '') +
              '" data-sv="' + esc(s.sv) + '" title="' + esc(s.n) + '">' + esc(s.sv) + '</button>';
          }).join('') +
          '<button class="chip' + (SVS.indexOf(PRUEBA) >= 0 ? ' on' : '') + '" data-sv="' +
          PRUEBA + '" title="Te llega cuando el admin escribe «probando» en un canal de ' +
          'eventos: sirve para probar el sistema entero">🧪 Pruebas</button></div>';
      }
      h += '<div class="cp-acc"><button class="bajar" data-cp="probar"><i aria-hidden="true">' +
        '&#9654;</i><span>Mandar una de prueba</span></button>' +
        '<button class="bajar cp-no" data-cp="desactivar"><span>Desactivar</span></button></div>';
      // 🔑 LOS AVISOS DE CADA UNO (Dlx, 25/09/2026: «todas»): subiste de
      // rango, desbloqueaste una tarjeta. Sólo si este dispositivo se
      // vinculó entrando con Discord; el ID lo pone Discord, no la página.
      var yo = leer('campana:yo', null);
      h += '<div class="cp-yo"><p class="cp-tx"><b>&#128100; Avisos míos</b>: cuando subís de ' +
        'rango o desbloqueás una tarjeta.</p>' + (yo && yo.id
        ? '<p class="cp-ok">✅ Vinculado con tu Discord' + (yo.n ? ' (' + esc(yo.n) + ')' : '') +
          '.</p><button class="bajar cp-no" data-cp="desvincular"><span>Desvincular</span></button>'
        : '<button class="bajar" data-cp="vincular"><i aria-hidden="true">&#128279;</i>' +
          '<span>Vincular con mi Discord</span></button>') + '</div>';
    }
    h += '<p class="cp-msg" role="status">' + esc(MSG) + '</p>';
    caja.innerHTML = h;
    pintaVigia();
  }

  function pintaVigia() {
    var sec = $('#secVigia'), caja = $('#vigia');
    if (!sec || !caja) return;
    var v = EST && EST.vigia;
    // sin dato no hay pieza
    if (!v || !v.t || !(v.canales || []).length) { sec.hidden = true; return; }
    sec.hidden = false;
    // ⚠️ UNA FILA POR SERVIDOR, NO POR CANAL. La búsqueda por nombre
    // encontró 14 canales —DRA sola tiene nueve— y catorce filas de
    // nombres con adornos (`〢🔥〉eventos-hoy`) no se leen: lo que la
    // persona quiere saber es de qué servidores le va a llegar.
    var por = {}, orden = [];
    v.canales.forEach(function (c) {
      if (!por[c.sv]) { por[c.sv] = []; orden.push(c.sv); }
      // sólo letras «de verdad» y dígitos: afuera `〢` (es un NÚMERO chino,
      // \p{Nl}) y los superíndices de `competenciasᵀᴵᴱᴿ¹`, que son \p{Lm}
      var limpio = String(c.nombre || '')
        .replace(/[^\p{Lu}\p{Ll}\p{Lt}\p{Lo}\p{Nd}\- ]+/gu, '').trim();
      if (limpio && por[c.sv].indexOf(limpio) < 0) por[c.sv].push(limpio);
    });
    var h = '<p class="cp-tx">Cada minuto se revisan los canales de eventos de estos ' +
      'servidores. Lo que se anuncia ahí, sale.</p><div class="vg-lista">' +
      orden.map(function (sv) {
        return '<div class="vg-canal"><b>' + esc(sv) + '</b><span>' +
          esc(por[sv].join(' · ')) + '</span></div>';
      }).join('') + '</div>';
    var bien = EST.ok;
    h += '<p class="nota">' + (bien ? '● ' : '⚠️ ') + 'última revisión ' + esc(hace(v.t)) +
      (EST.suscripciones ? ' · ' + EST.suscripciones + ' dispositivo' +
        (EST.suscripciones === 1 ? '' : 's') + ' con la campana' : '') + '</p>';
    if (EST.ultimo && EST.ultimo.titulo) {
      h += '<p class="nota">último aviso: ' + esc(EST.ultimo.titulo) + ' (' + esc(EST.ultimo.sv) +
        ') ' + esc(hace(EST.ultimo.t)) + '</p>';
    }
    caja.innerHTML = h;
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cp],[data-sv]');
    if (!b || !$('#campana') || !$('#campana').contains(b)) return;
    if (b.hasAttribute('data-sv')) { elegir(b.getAttribute('data-sv')); return; }
    var que = b.getAttribute('data-cp');
    var f = que === 'activar' ? activar : que === 'probar' ? function () { return probar(false); }
      : que === 'vincular' ? vincular : que === 'desvincular' ? desvincular : desactivar;
    b.disabled = true;
    Promise.resolve(f()).catch(function (err) {
      MSG = '⚠️ ' + (err && err.message ? err.message : 'no se pudo');
      pinta();
    });
  });

  // ── arrancar ────────────────────────────────────────────────────────
  async function arrancar() {
    if (SOPORTA) {
      try {
        REG = await navigator.serviceWorker.register('/sw.js');
        SUB = await REG.pushManager.getSubscription();
      } catch (e) { REG = null; SUB = null; }
    }
    pinta();
    try { EST = await pedir('estado'); } catch (e) { EST = null; }
    pinta();
    if (!SUB) return;
    aplicarPedido();
    try {
      // 🔴 SI LA CLAVE DEL WORKER CAMBIO, LA SUSCRIPCION VIEJA NO SIRVE: se
      // rehace sola acá, sin preguntar de nuevo —el permiso ya está—. Es
      // lo que hace sobrevivir una rotación de la clave VAPID para todo el
      // que vuelva a entrar. Ver `bot/avisos_claves.py`.
      var k = await clave();
      if (SUB.options && SUB.options.applicationServerKey &&
          !igual(SUB.options.applicationServerKey, bytes(k).buffer)) {
        await SUB.unsubscribe();
        SUB = await REG.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(k) });
        await alta(false);
      } else if (Date.now() - leer('campana:alta', 0) > 24 * 3600 * 1000) {
        // ⚠️ UNA VEZ POR DIA SE VUELVE A ANOTAR: si el Worker la había
        // borrado —el servicio dijo 410—, así vuelve sin que nadie toque
        // nada, y le trae de vuelta los servidores que había elegido.
        await alta(false);
      }
      pinta();
    } catch (e) { /* la campana sigue como estaba */ }
  }

  // el link de `/notify` con la página ya abierta
  window.addEventListener('hashchange', function () {
    PEDIDO = pedidoDelLink();
    if (PEDIDO) { if (SUB) aplicarPedido(); else pinta(); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
