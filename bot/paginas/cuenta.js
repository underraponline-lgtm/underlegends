/* ═════════════════════════════════════════════════════════════════════
   LA CUENTA: entrar con Discord (`urlLogin`, `volverDeDiscord`, la sesión
   de `conCuenta`), verificarte, tu foto, tus redes, «tu servidor», salir y
   olvidar todo. Salió de app.js el 13/10/2026 (la tanda 2 de sacarlo),
   cortado tal cual. ⚠️ Todavía dibuja con funciones de app.js
   (`pintaPopCuenta`, `pintaCuenta`, `pintaEncuestas`…): mientras app.js
   esté, son las suyas; el día que se borre, tienen que quedar como
   funciones vacías o React deja de enterarse (`envolver()` de App.jsx).
   ═════════════════════════════════════════════════════════════════════ */
'use strict';

var RED_NOMBRE = { instagram: 'Instagram', youtube: 'YouTube', x: 'X', tiktok: 'TikTok',
  twitch: 'Twitch', kick: 'Kick', spotify: 'Spotify', reddit: 'Reddit', bluesky: 'Bluesky' };

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

/* ── mi cuenta ────────────────────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «arriba en la esquina derecha superior mi cuenta (mi
   perfil y cosas más)». No hay login: quien mira elige quién es y este
   dispositivo lo recuerda. No sale de acá. */
var YO = leerLS('lg:yo', '');
function yo() { return YO ? porK(YO) : null; }

/* ── «tu servidor» ─────────────────────────────────────────────────────
   🔑 Dlx, 28/09/2026: «La idea es q la gente decida por su cuenta», y
   «1. A 2. A 3. B y C»: se elige en Mi cuenta (con Discord), uno por
   temporada como la foto —libre hasta el fin de `FOTO_LIBRE`, en
   comun/temporada.py—, y no frena ningún
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
  // ⚠️ SIEMPRE, aunque la ventana esté cerrada: Mi cuenta nueva se entera de cada cambio por `pintaPopCuenta()`
  // (ver `nuevaCuenta()`), y con la ventana cerrada no se enteraba
  pintaPopCuenta();
}
function elegirMiServidor(sv) {
  MISV_EST = { va: sv };
  repintarMiServidor();
  conCuenta('/api/avisos/mi-servidor', { sv: sv }, 's').then(function (j) {
    if (!j) return;
    if (j.status === 200) {
      MISV = j;
      MISV_EST = { ok: true, sv: sv };
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
/* 🙈 «OCULTAR MI FOTO» (Dlx, 29/09/2026: «con ocultar mi foto en ajustes»; el 02/10: «1. A»). Como «tu servidor»:
   lo guarda el vigía con tu Discord (`miFoto()` en bot/avisos.js) y el ciclo lo aplica en su próxima vuelta: la página
   y tus tarjetas van con tu inicial. Lo dibuja Mi cuenta → Privacidad (web/src/cuenta.jsx) */
var MIFOTO = null, MIFOTO_EST = {}, MIFOTO_PIDE = false;
function pedirMiFoto() {
  if (!DC || MIFOTO || MIFOTO_PIDE) return;
  MIFOTO_PIDE = true;
  pedirConCuenta('/api/avisos/mi-foto', {}, false).then(function (j) {
    MIFOTO_PIDE = false;
    MIFOTO = j && j.status === 200 ? j : { error: (j && j.error) || 'red' };
    pintaPopCuenta();
  }).catch(function () { MIFOTO_PIDE = false; MIFOTO = { error: 'red' }; pintaPopCuenta(); });
}
function cuentaMiFoto(ocultar) {
  MIFOTO_EST = { va: true };
  pintaPopCuenta();
  conCuenta('/api/avisos/mi-foto', { ocultar: !!ocultar }, 's').then(function (j) {
    if (!j) { MIFOTO_EST = {}; pintaPopCuenta(); return; }
    if (j.status === 200) { MIFOTO = j; MIFOTO_EST = { ok: true }; }
    else MIFOTO_EST = { error: errorCuenta(j.error) || 'No pude guardarlo. Probá de nuevo en un rato.' };
    pintaPopCuenta();
  }).catch(function () { MIFOTO_EST = { error: 'Sin conexión: probá de nuevo.' }; pintaPopCuenta(); });
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
  // 'p' felicitar en Publicaciones, o entrar
  var conRedes = modo === true || modo === 'r';
  // 'o' el Dashboard del dueño (04/10/2026): vuelve a /dashboard
  var st = (conRedes ? 'r' : modo === 'v' || modo === 'f' || modo === 'e' || modo === 't' || modo === 'd' ||
    modo === 'p' || modo === 'o' ? modo : 'i') +
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
  // 🛡️ el permiso ya no está en la dirección: el script del principio lo saca apenas carga y lo deja acá (04/10/2026)
  var h = window.__vueltaDC || location.hash || '';
  window.__vueltaDC = '';
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
  // 🔗 LOS ROLES VINCULADOS (19/10/2026): Discord vuelve acá —es la dirección registrada— y el trámite sigue en su
  // página, con lo que trajo (el permiso o el error)
  if (modo0 === 'l') { location.replace('/vincular/' + location.hash); return; }
  if (modo0 === 't') {
    try { pp = JSON.parse(sessionStorage.getItem('lg:precio') || 'null'); } catch (e) { pp = null; }
  }
  // 🔑 Y QUIEN VINO A ENTRAR, A CAMBIAR SU FOTO O A ELEGIR SUS REDES VUELVE A MI CUENTA (02/10/2026), no a una
  // ventana encima del Inicio: ver `nuevaCuenta()`
  var aCuenta = nuevaCuenta() && (modo0 === 'i' || modo0 === 'f' || modo0 === 'r');
  // 🔒 y quien vino a su Dashboard vuelve al Dashboard, sin la ventana vieja de Mi cuenta encima (revisión del 05/10/2026)
  var sinVentana = aCuenta || modo0 === 'o';
  var destino = '#/' + (aCuenta ? (modo0 === 'i' ? 'cuenta' : 'cuenta/perfil') : modo0 === 'o' ? 'dashboard' : modo0 === 'v' ? 'avisos'
    : modo0 === 'd' ? 'cuenta/verificar' : modo0 === 'p' ? 'publicaciones' : modo0 === 't'
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
  // 👏 FELICITAR: igual que votar (ver `felicitar()`)
  var porAplauso = st.charAt(0) === 'p';
  if (porRedes || porFoto || porVoto || porTienda || porVerif || porAplauso) DC_TOKEN = q.access_token;
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
  // 👏 y la felicitación que se tocó antes de entrar, igual
  if (porAplauso) {
    var pa = null;
    try {
      pa = JSON.parse(sessionStorage.getItem('lg:aplauso') || 'null');
      sessionStorage.removeItem('lg:aplauso');
    } catch (e) { pa = null; }
    if (pa && pa.id) felicitar(String(pa.id));
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
      // con Mi cuenta nueva no hay ventana: ya se volvió a `#/cuenta` (ver `aCuenta`)
      if (!sinVentana) $('#popCuenta').hidden = false;
      if (porAvisos) {
        vincularAvisos(q.access_token);
        $('#popCuenta').hidden = true;
      }
      // quien vino a votar se queda donde votó; ahora se sabe quién es («el tuyo»)
      if (porVoto) {
        $('#popCuenta').hidden = true;
        if (D) pintaEncuestas();
      }
      // y quien vino a felicitar, en Publicaciones (y ahora se sabe cuáles son suyas)
      if (porAplauso) {
        $('#popCuenta').hidden = true;
        avisarAplausos();
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
          if (!sinVentana) $('#popCuenta').hidden = false;
        }).catch(function () { FOTO = { error: 'red' }; pintaPopCuenta(); });
      }
      if (porRedes) {
        pedirRedes(null).then(function (R) {
          REDES_MIAS = R;
          pintaPopCuenta();
          if (!sinVentana) $('#popCuenta').hidden = false;
        }).catch(function () { REDES_MIAS = { error: 'red' }; pintaPopCuenta(); });
      }
    })
    .catch(function () { /* si falla, queda como estaba */ });
}

/* 🔑 MI CUENTA, EN SU PÁGINA (Dlx, 02/10/2026: «ajustes y cuenta separados, y me gusta cómo lo propusiste»).
   La ventana de arriba a la derecha pasa a ser una página, como los ajustes de Discord: la dibuja el Inicio nuevo
   (`web/src/cuenta.jsx`). Lo que hace cada cosa por dentro sigue acá —la foto, las redes, «tu servidor», salir— y
   la página nueva llama a estas funciones; se entera de cada cambio porque envuelve `pintaPopCuenta()`, que corre
   después de cada uno. ⚠️ LA VENTANA QUEDA DE RESPALDO: se abre sólo si la página nueva no se monta. */
function nuevaCuenta() { return mandaLoNuevo(); }
function cuentaFotoNo() { FOTO = null; pintaPopCuenta(); }
function cuentaFotoSi() {
  return pedirFoto(true).then(function (R) {
    FOTO = R && R.ok ? { hecho: true, temporada: R.temporada, libre: R.libre, libre_hasta: R.libre_hasta }
      : { error: (R && (R.paso || R.error)) || 'red', temporada: R && R.temporada };
    pintaPopCuenta();
  }).catch(function () { FOTO = { error: 'red' }; pintaPopCuenta(); });
}
/* guarda las redes elegidas (`[]` las quita todas) y dice cómo salió */
function cuentaRedes(elegidas) {
  return pedirRedes(elegidas).then(function (R) {
    if (R && R.guardadas) REDES_MIAS = R;
    pintaPopCuenta();
    if (R && R.error === 'tope') return 'Ya cambiaste tus redes muchas veces hoy: probá mañana.';
    if (R && R.error === 'espera') return 'Esperá un minuto y probá de nuevo.';
    if (!R || !R.guardadas) return 'No pude guardar. Probá de nuevo.';
    return '✓ Guardado. ' + (R.guardadas.length ? 'Tu perfil va a mostrar ' + R.guardadas.length +
      (R.guardadas.length === 1 ? ' red' : ' redes') : 'Tu perfil no muestra ninguna') +
      ' desde la próxima actualización (cada media hora).';
  }).catch(function () { return 'No pude guardar. Probá de nuevo.'; });
}
/* «tu servidor»: durante la ventana libre se elige al toque; después, como es para toda la temporada, se confirma */
function cuentaServidor(sv) {
  // `''` es «ninguno» (07/10/2026): ya elegido sólo si contestó (`elegido`), y no se confirma porque no fija la temporada
  if (MISV && MISV.sv === sv && (sv || MISV.elegido)) return;
  if (sv && MISV && !MISV.libre) { MISV_EST = { pide: sv }; repintarMiServidor(); } else elegirMiServidor(sv);
}
function cuentaSalir() {
  desvincularAvisos();
  cerrarSesion();
  // ★ a quién seguías queda en el servidor, con tu cuenta: no en este dispositivo
  if (DC) { guardarSigo([]); marcarSigoSrv(false); ME_SIGUEN = null; }
  MISV = null;
  MISV_EST = {};
  MIFOTO = null;
  MIFOTO_EST = {};
  YO = '';
  DC = null;
  guardarLS('lg:yo', null);
  guardarLS('lg:dc', null);
  pintaCuenta();
  pintaPopCuenta();
  pintaPaneles();
}
/* olvidar todo lo de este dispositivo: quién sos y los ajustes */
function cuentaOlvidarTodo() {
  desvincularAvisos();
  cerrarSesion();
  guardarSigo([]);
  marcarSigoSrv(false);
  ME_SIGUEN = null;
  MISV = null;
  MISV_EST = {};
  MIFOTO = null;
  MIFOTO_EST = {};
  AJ = {};
  YO = '';
  DC = null;
  guardarLS('lg:ajustes', null);
  guardarLS('lg:yo', null);
  guardarLS('lg:dc', null);
  aplicarCalma();
  pintaCuenta();
  pintaPopCuenta();
  pintaPopAjustes();
  repintarHoras();
  try { window.dispatchEvent(new Event('lg:ajustes')); } catch (e) { /* navegador viejo */ }
}
