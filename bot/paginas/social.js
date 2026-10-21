/* ═════════════════════════════════════════════════════════════════════
   LO SOCIAL: las encuestas y el voto, felicitar y los aplausos, la
   campanita (`BANDEJA`) y seguir raperos (`SIGO`, `alternarSigo`,
   `pedirSeguidores`). Salió de app.js el 13/10/2026 (la tanda 2 de
   sacarlo), cortado tal cual.
   ═════════════════════════════════════════════════════════════════════ */
'use strict';

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
/* ── 👏 FELICITAR, en Publicaciones ─────────────────────────────────────
   🔑 Dlx, 02/10/2026: «algo más para que enganche a las personas o
   interactivo», y con el plan, «Dale». Un toque en un logro del muro
   (campeón, rango, Most Wanted) cuenta UNO por persona, y a quien felicitan
   le llega un aviso de la página con cuántos fueron —nunca por DM—: lo manda
   el vigía (`avisarAplausos()` en bot/avisos.js). Quién felicita lo dice
   Discord (la sesión), como el voto; qué publicación, el `id` del muro.
   ⚠️ AFUERA SE VE CUÁNTOS, NUNCA QUIÉN. Lo que felicitaste lo recuerda tu
   navegador (`lg:aplausos`). La página nueva lee `APLAUSOS` y se entera por
   `lg:aplausos` (web/src/publicaciones.jsx). */
var APLAUSOS = { cu: {}, mios: leerLS('lg:aplausos', null) || {}, va: {}, err: {}, post: {} };
var APL_T = 0;
function avisarAplausos() {
  try { window.dispatchEvent(new Event('lg:aplausos')); } catch (e) { /* navegador viejo */ }
}
function pedirAplausos() {
  if (Date.now() - APL_T < 30000) return;
  APL_T = Date.now();
  fetch('/api/avisos/aplausos', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.n) return;
      var cu = Object.assign({}, d.n);
      // lo que acabás de felicitar puede ser más nuevo que la copia del borde (30 s)
      Object.keys(APLAUSOS.post).forEach(function (id) {
        var p = APLAUSOS.post[id];
        if (Date.now() - p.t < 120000) cu[id] = Math.max(+cu[id] || 0, p.n);
      });
      APLAUSOS.cu = cu;
      avisarAplausos();
    })
    .catch(function () { /* sin los números se ve igual */ });
}
function felicitar(id) {
  id = String(id || '');
  if (!/^[0-9a-f]{12}$/.test(id) || APLAUSOS.va[id] || APLAUSOS.mios[id]) return;
  APLAUSOS.va[id] = 1;
  delete APLAUSOS.err[id];
  avisarAplausos();
  conCuenta('/api/avisos/felicitar', { id: id }, 'p', 'lg:aplauso', { id: id })
    .then(function (j) {
      if (!j) return;                 // se fue a Discord: a la vuelta sale solo (`volverDeDiscord()`)
      delete APLAUSOS.va[id];
      if (j.ok) {
        APLAUSOS.mios[id] = Date.now();
        // ⚠️ con tope: el muro trae 80, y lo de hace un mes ya no está
        var m = {};
        Object.keys(APLAUSOS.mios).sort(function (a, b) { return APLAUSOS.mios[b] - APLAUSOS.mios[a]; })
          .slice(0, 300).forEach(function (x) { m[x] = APLAUSOS.mios[x]; });
        APLAUSOS.mios = m;
        guardarLS('lg:aplausos', m);
        if (typeof j.n === 'number') {
          APLAUSOS.cu[id] = j.n;
          APLAUSOS.post[id] = { n: j.n, t: Date.now() };
        }
      } else {
        APLAUSOS.err[id] = j;
      }
      avisarAplausos();
    })
    .catch(function () { delete APLAUSOS.va[id]; APLAUSOS.err[id] = { error: 'red' }; avisarAplausos(); });
}
/* ── 🔔 LA BANDEJA: el panel de la campana ──────────────────────────────
   🔑 Dlx, 02/10/2026: «que en esa campanita, aparte de activar tus
   notificaciones, sea como un panel de notificaciones recientes, quizás
   algo como Instagram», y a «¿también los eventos del día?», «A». Lo tuyo
   (quién te sigue, quién te felicita, tus rangos y tarjetas, cuando gana
   alguien que seguís) lo guarda el objeto 30 días (`bandeja()` en
   bot/avisos.js), aunque no tengas la campana en ningún dispositivo. Se pide
   con la sesión y ⚠️ NUNCA manda a Discord: sin sesión, el panel invita a
   entrar. La página nueva lee `BANDEJA` y se entera por `lg:bandeja`. */
var BANDEJA = { items: [], nuevas: 0, listo: false, sinCuenta: false, t: 0 };
function avisarBandeja() {
  try { window.dispatchEvent(new Event('lg:bandeja')); } catch (e) { /* navegador viejo */ }
}
/* `visto`: se abrió el panel; lo nuevo queda visto (la respuesta todavía dice cuáles eran) */
function pedirBandeja(visto) {
  // ⚠️ sin cuenta, también sin lo de la anterior: al salir, el «3 nuevas» de esa cuenta quedaba en la campana
  // (revisión del 03/10/2026)
  if (!DC) {
    BANDEJA.sinCuenta = true; BANDEJA.listo = true; BANDEJA.items = []; BANDEJA.nuevas = 0; BANDEJA.t = 0;
    avisarBandeja();
    return;
  }
  if (!visto && Date.now() - BANDEJA.t < 60000) return;
  BANDEJA.t = Date.now();
  pedirConCuenta('/api/avisos/bandeja', visto ? { visto: true } : {}, false)
    .then(function (j) {
      BANDEJA.listo = true;
      if (j && j.ok) {
        BANDEJA.items = j.items || [];
        BANDEJA.nuevas = j.nuevas || 0;
        BANDEJA.sinCuenta = false;
      } else if (j && j.status === 401) {
        BANDEJA.sinCuenta = true;
      }
      avisarBandeja();
    })
    .catch(function () { BANDEJA.listo = true; avisarBandeja(); });
}
/* lo que se le dice a quien no pudo felicitar (texto: la página nueva lo escapa sola) */
function errorAplauso(E) {
  var e = E && E.error;
  return errorCuenta(e) || (e === 'tú' ? 'Es tuyo: a ti te felicitan los demás.'
    : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva para felicitar: vas a poder desde el ' +
      fmtFecha(E.desde, { day: 'numeric', month: 'long' }) + '.'
    : e === 'no_existe' ? 'Esa publicación ya no está: se actualiza cada media hora.'
    : 'No pude guardarlo. Prueba de nuevo en un rato.');
}
function errorEnc(E) {
  var e = E.error;
  return errorCuenta(e) || (e === 'cerrada' ? 'La votación ya cerró.'
    : e === 'tú' ? 'No puedes votarte a ti.'
    : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva para votar: vas a poder desde el ' +
      esc(fmtFecha(E.desde, { day: 'numeric', month: 'long' })) + '.'
    : e === 'opcion' ? 'Esa opción ya no está: la lista se actualiza cada media hora.'
    : e === 'no_existe' ? 'Esa votación ya no está.'
    : e === 'no_jugo' ? 'Los MES AWARDS de ' + esc(E.sv || 'este servidor') + ' los votan los que jugaron ahí este mes.'
    : 'No pude guardar tu voto. Prueba de nuevo en un rato.');
}

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
/* 👥 a cuántos sigue cada perfil (`s` de /avisos/seguidores, 21/10/2026: el remake del perfil, «seguidores y seguidos») */
var SIGUIENDO = null;
function siguiendoDe(k) { return SIGUIENDO ? SIGUIENDO[k] || 0 : null; }
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
      SIGO_EST[k] = { error: j.error === 'tope' ? 'Ya sigues a ' + SIGO_TOPE + ': deja de seguir a alguien primero.'
        : errorCuenta(j.error) || 'No pude guardarlo. Prueba de nuevo en un rato.' };
    }
    repintarSigo(k);
  }).catch(function () {
    guardarSigo(antes);
    SIGO_EST[k] = { error: 'Sin conexión: prueba de nuevo.' };
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
      if (j && j.s) SIGUIENDO = j.s;
      return SEGUIDORES;
    })
    .catch(function () { return SEGUIDORES; });
}
