/* ════════════════════════════════════════════════════════════════════
   EL SERVICE WORKER DEL HUB. Existe para UNA cosa: los avisos de eventos.

   Es lo que recibe la notificación cuando la página está cerrada. La manda
   el vigía del Worker (`bot/avisos.js`) en cuanto un servidor anuncia un
   evento, cifrada para este dispositivo; el navegador la descifra y la
   entrega acá.

   ⚠️ NO INTERCEPTA NADA DE LA PAGINA. No hay `fetch` handler a propósito:
   con uno, cada visita al hub pasaría por acá, y un service worker con un
   bug puede dejar una página «cargando» para siempre en un teléfono ajeno.
   Sin él, el hub se comporta igual que antes de que existiera.

   ⚠️ LA HORA SE ESCRIBE ACA, AL MOSTRAR, y no en el Worker. El aviso trae
   el instante del evento; «empieza en 12 min» y «21:30» se arman con el
   reloj y el huso de este dispositivo — Dlx en hora del este, el resto de
   la Liga en la suya. Es la misma regla que la cuenta atrás del hub.
   ════════════════════════════════════════════════════════════════════ */
'use strict';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

function hora(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function cuando(ms) {
  var m = Math.round((ms - Date.now()) / 60000);
  if (m > 1) {
    var h = Math.floor(m / 60), r = m % 60;
    var falta = h ? h + ' h' + (r ? ' ' + r + ' min' : '') : m + ' min';
    return 'empieza en ' + falta + ' (' + hora(ms) + ')';
  }
  if (m >= -5) return '¡empieza ahora!';
  return 'empezó a las ' + hora(ms);
}

function armar(d) {
  if (d.tipo === 'prueba') {
    return {
      titulo: '🔔 Avisos activados',
      cuerpo: 'Así te va a llegar cada evento de la Liga. Tocá para abrir el hub.',
      url: '/#/avisos', tag: 'prueba',
    };
  }
  if (d.tipo === 'evento' || d.tipo === 'antes') {
    var linea = [d.svn || d.sv];
    if (d.ini) linea.push(cuando(d.ini));
    var extra = [d.mod, d.cup ? 'cupos: ' + d.cup : '', d.pre ? 'premio: ' + d.pre : '']
      .filter(Boolean).join(' · ');
    return {
      titulo: (d.tipo === 'antes' ? '⏰ ' : '🏆 ') + (d.t || 'Nuevo evento'),
      cuerpo: linea.filter(Boolean).join(' · ') + (extra ? '\n' + extra : ''),
      url: d.url || '/', tag: 'ev' + (d.id || ''),
    };
  }
  return { titulo: 'Liga Global', cuerpo: d.t || 'Hay novedades en la Liga.', url: '/', tag: 'liga' };
}

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { t: e.data ? e.data.text() : '' }; }
  var n = armar(d);
  // 🔑 Y SE LE CUENTA A LA PAGINA, SI ESTA ABIERTA. Dlx, 25/09/2026: en su
  // Samsung llegó, en Opera GX de la compu no. Desde afuera «no llegó al
  // navegador» y «llegó y Windows la tapó» se ven igual; con este aviso
  // la página sabe cuál de las dos fue. Ver `probar()` en campana.js.
  var contar = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(function (vs) {
      vs.forEach(function (v) { v.postMessage({ avisos: 'llego', tipo: d.tipo || '' }); });
    }).catch(function () {});
  // ⚠️ SIEMPRE SE MUESTRA ALGO. Los navegadores exigen una notificación
  // por cada push (`userVisibleOnly`); el que recibe y no muestra, a la
  // larga pierde el permiso.
  e.waitUntil(contar.then(function () { return self.registration.showNotification(n.titulo, {
    body: n.cuerpo,
    // 🐉 EL DRAGÓN DE UL, el logo que Dlx pidió para los avisos (25/09/2026):
    // blanco sobre un círculo oscuro, porque un logo blanco solo desaparece
    // en las notificaciones de fondo claro
    icon: '/aviso.png',
    // la insignia es la silueta blanca del mismo dragón: Android la pinta en
    // la barra de estado y sólo mira el alfa. ⚠️ Otro nombre que la de antes
    // (sólo «UL»): el navegador guarda estos íconos y no los vuelve a pedir
    badge: '/insignia-ul.png',
    // el mismo evento reemplaza su aviso en vez de apilar dos
    tag: n.tag,
    renotify: true,
    timestamp: d.ini || Date.now(),
    lang: 'es',
    data: { url: n.url },
  }); }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(function (ventanas) {
      // lo del hub se abre en la pestaña del hub, si hay una. ⚠️ Con red
      // de seguridad: `navigate()` falla en una pestaña que este service
      // worker no controla, y un clic que no abre nada es peor que una
      // pestaña de más.
      var abrir = function () { return self.clients.openWindow(url); };
      if (url.charAt(0) === '/' && ventanas.length && 'focus' in ventanas[0]) {
        var v = ventanas[0];
        return v.focus().then(function (w) {
          var x = w || v;
          return x.navigate ? x.navigate(url).catch(abrir) : abrir();
        }).catch(abrir);
      }
      // el anuncio, en Discord: en el teléfono abre la app si está
      return self.clients.openWindow(url);
    }));
});

function bytes(b64) {
  var s = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  var bin = atob(s), out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// 🔑 EL NAVEGADOR PUEDE CAMBIAR LA SUSCRIPCION POR SU CUENTA. Si nadie la
// vuelve a anotar, el Worker sigue mandando a la vieja y la persona deja
// de recibir sin haber tocado nada. `anterior` le dice al Worker cuál
// reemplazar, así se conservan los servidores que había elegido.
self.addEventListener('pushsubscriptionchange', function (e) {
  e.waitUntil((async function () {
    var vieja = e.oldSubscription;
    var nueva = e.newSubscription;
    if (!nueva) {
      var r = await fetch('/api/avisos/clave');
      var clave = (await r.json()).clave;
      nueva = await self.registration.pushManager.subscribe(
        { userVisibleOnly: true, applicationServerKey: bytes(clave) });
    }
    await fetch('/api/avisos/alta', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sub: nueva.toJSON(), anterior: vieja ? vieja.endpoint : '' }),
    });
  })());
});
