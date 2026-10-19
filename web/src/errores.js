// 🐞 LOS ERRORES DE LA PÁGINA, AL DASHBOARD (Dlx, 19/10/2026: «ok», a «que los errores de la página lleguen al
// Dashboard»). Publicaciones estuvo rota en producción y lo encontré yo recorriendo la página: con esto, el primero que
// la abre lo cuenta. Viaja SÓLO el error —en qué parte, el mensaje y en qué lugar del código—, nunca quién ni qué
// estaba mirando. Cada error una vez por sesión, y hasta 5 por carga: una página rota no es una inundación.
//
// Lo recibe `/api/avisos/error` (bot/avisos.js, `errorValido()` y `errorPagina()`), que lo junta en memoria y lo
// escribe una vez por minuto; el Dashboard lo muestra en Sistema.

const YA = new Set();
let mandados = 0;

/** El mensaje sin lo que no hace falta: sin el `?…` de un link y con los números largos (un ID) tapados. */
function limpiarMsg(s) {
  return String(s || '').replace(/\s+/g, ' ').replace(/(https?:\/\/[^\s?#]+)\S*/g, '$1').replace(/\d{5,}/g, '#').trim().slice(0, 200);
}

/** El primer lugar del código que aparece en la pila: `inicio/inicio-llave.js:1:2345`. */
function lugar(pila) {
  const m = /((?:inicio\/)?[\w.-]+\.js):(\d+):(\d+)/.exec(String(pila || ''));
  return m ? (m[1] + ':' + m[2] + ':' + m[3]).slice(0, 80) : '';
}

/** `donde`: la parte de la página (el nombre de la sección aislada, `inicio`, `global` o `promesa`). */
export function reportarError(donde, e) {
  try {
    const d = String(donde || 'otra').toLowerCase().replace(/[^a-z0-9:_-]/g, '').slice(0, 40) || 'otra';
    const m = limpiarMsg((e && (e.message || e.reason)) || e);
    if (!m) return;
    const k = d + '|' + m;
    if (YA.has(k) || mandados >= 5) return;
    try {
      const vistos = JSON.parse(sessionStorage.getItem('lg:err') || '[]');
      if (Array.isArray(vistos) && vistos.includes(k)) return;
      sessionStorage.setItem('lg:err', JSON.stringify([...(Array.isArray(vistos) ? vistos : []), k].slice(-20)));
    } catch (x) { /* sin sessionStorage, una vez por carga */ }
    YA.add(k);
    mandados++;
    const tipo = e && /^[A-Za-z]{1,30}$/.test(String(e.name || '')) ? e.name : '';
    const cuerpo = JSON.stringify({ d, m, f: lugar(e && e.stack), t: tipo });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/avisos/error', new Blob([cuerpo], { type: 'application/json' }))) return;
    } catch (x) { /* sin beacon, con fetch */ }
    fetch('/api/avisos/error', { method: 'POST', headers: { 'content-type': 'application/json' }, body: cuerpo, keepalive: true })
      .catch(() => {});
  } catch (x) { /* reportar nunca rompe nada */ }
}

/** Los errores que no agarra ninguna sección: los de los scripts de la página y las promesas de programación. */
export function escucharErrores() {
  if (window.__lgErrores) return;
  window.__lgErrores = true;
  window.addEventListener('error', (ev) => {
    // sólo lo nuestro: un script de otro lado (una extensión, un traductor) no es un error de la página
    const f = String((ev && ev.filename) || '');
    if (!f || !f.startsWith(location.origin)) return;
    reportarError('global', ev.error || { message: ev.message, stack: f + ':' + ev.lineno + ':' + ev.colno });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev && ev.reason;
    // lo de la red (sin conexión, un servidor caído) no es un error del código; uno de programación, sí. Un pedazo de
    // la página que no bajó («dynamically imported module») cuenta: es lo que pasa cuando un despliegue sale mal
    if (!r || !/^(TypeError|ReferenceError|RangeError|SyntaxError)$/.test(r.name || '')) return;
    if (/^(Failed to fetch|NetworkError|Load failed)/i.test(r.message || '')) return;
    reportarError('promesa', r);
  });
}
