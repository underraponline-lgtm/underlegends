/* ═════════════════════════════════════════════════════════════════════
   LA TIENDA: la billetera (`BILL`, `pedirBilletera`), lo que vale cada
   cabeza (`valorCabezas`) y ponerle precio (`ponerPrecio`, `errorPrecio`).
   Salió de app.js el 13/10/2026 (la tanda 2 de sacarlo), cortado tal cual.
   ⚠️ `pintaPrecios` se quedó en app.js: reparte a las vistas viejas.
   ═════════════════════════════════════════════════════════════════════ */
'use strict';

/* ── la tienda: los Puntos de Tienda y el precio por cabeza ────────────
   🔑 Dlx, 27 y 28/09/2026: «PUNTOS de TIENDA… que todos empecemos con 5k»,
   el precio por cabeza se paga con eso, «si nadie lo caza, vuelve», «sí 20k»,
   y «1. Ambos. 2. B»: el que caza cobra esos Puntos de Tienda y lo mismo en
   su Temporada, y billetera tiene cualquiera que entre con Discord. Y
   «agrega la opción de TIENDA». Los números vienen en `D.tienda`
   (bot/precios.py); cuánto vale cada cabeza, de `/api/avisos/precios`; tu
   billetera, de `/api/avisos/billetera`, con el permiso de Discord.
   ⚠️ AFUERA SE VE CUÁNTO VALE CADA CABEZA, NUNCA QUIÉN PUSO. */
var PRECIOS = null, PRECIOS_T = 0, PR_TOT = {}, BILL = null, PR_EST = {}, PR_BUSCA = '', PR_SEL = '',
  PR_PERFIL = '';
function pedirPrecios() {
  if (!D || !D.tienda) return;
  fetch('/api/avisos/precios', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !Array.isArray(d.precios)) return;
      PRECIOS = d.precios;
      PRECIOS_T = d.t || 0;
      pintaPrecios();
    })
    .catch(function () { /* sin precios se ve igual, sin números */ });
}
/* lo que vale cada cabeza ahora: lo activo, lo que todavía se puede cobrar.
   El precio que acabo de poner manda sobre la caché, si es más nuevo. */
function valorCabezas() {
  var ahora = Date.now(), v = {};
  (PRECIOS || []).forEach(function (p) {
    if (!p.estado && p.fin > ahora) v[p.cabeza] = (v[p.cabeza] || 0) + (+p.monto || 0);
  });
  Object.keys(PR_TOT).forEach(function (c) { if (PR_TOT[c].t >= PRECIOS_T) v[c] = PR_TOT[c].total; });
  return v;
}
/* a quién se le puede poner precio: a quien juega la temporada y no es
   fuera de concurso (lo mismo que valida el Worker) */
function puedeCabeza(n) {
  var f = (D.tabla || []).filter(function (x) { return x.n === n; })[0];
  return !!(f && !f.fc);
}
function nombreCabeza(n) { var f = porK(kDe(n)); return f ? f.n : n; }
/* `entrar`: si no se sabe quién sos, ir a Discord (el botón); sin eso, se
   prueba con la sesión y, si no hay, queda el botón (al abrir la Tienda) */
function pedirBilletera(entrar) {
  if (!D || !D.tienda) return;
  // ⚠️ quien nunca entró con Discord (`DC` vacío) no tiene sesión: preguntar igual era un 401 seguro en cada visita a la
  // Tienda, con su error en la consola (recorrido del 03/10/2026). Queda el botón, como con el 401. ⚠️ Con el permiso
  // recién traído (`DC_TOKEN`) sí: al volver de Discord por la Tienda esto corre ANTES de que `/api/cuenta` llene `DC`
  if (!entrar && !DC && !DC_TOKEN) { BILL = null; pintaPrecios(); return; }
  conCuenta('/api/avisos/billetera', {}, entrar ? 't' : '', null, null)
    .then(function (j) {
      if (!j) return;
      if (j.status === 401) { BILL = entrar ? { error: j.error } : null; pintaPrecios(); return; }
      BILL = j.ok ? j : { error: j.error || 'red' };
      pintaPrecios();
    })
    .catch(function () { BILL = { error: 'red' }; pintaPrecios(); });
}
function ponerPrecio(cabeza, monto) {
  PR_EST[cabeza] = { va: monto };
  pintaPrecios();
  conCuenta('/api/avisos/precio', { cabeza: cabeza, monto: monto }, 't', 'lg:precio',
    { cabeza: cabeza, monto: monto, volver: ruta() })
    .then(function (j) {
      if (!j) return;
      if (j.ok) {
        PR_EST[cabeza] = { ok: j.monto };
        PR_TOT[cabeza] = { t: j.t || 0, total: j.total };
        if (BILL && BILL.ok) BILL.saldo = j.saldo;
        pedirBilletera(false);
      } else {
        PR_EST[cabeza] = j;
      }
      pintaPrecios();
    })
    .catch(function () { PR_EST[cabeza] = { error: 'red' }; pintaPrecios(); });
}
function errorPrecio(E) {
  var T = D.tienda || {}, e = E.error;
  return errorCuenta(e) || (e === 'saldo' ? 'No te alcanzan: tenés ' + num(E.saldo) + ' Puntos de Tienda.'
    : e === 'tope' ? (E.queda ? 'Esa cabeza está cerca del máximo: se le pueden poner ' + num(E.queda) + ' más.'
      : 'Esa cabeza ya vale lo máximo (' + num(T.tope) + ').')
    : e === 'vos' ? 'No te podés poner precio a vos.'
    : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva: vas a poder desde el ' +
      esc(fmtFecha(E.desde, { day: 'numeric', month: 'long' })) + '.'
    : e === 'cabeza' ? 'A esa persona no se le puede poner precio: tiene que jugar la temporada.'
    : e === 'monto' ? 'Desde ' + num(E.min) + ', de a ' + num(E.paso) + '.'
    : e === 'cerrada' ? 'La semana terminó: probá de nuevo en un rato.'
    : e === 'todavia' ? 'La tienda todavía no está lista: probá en un rato.'
    : 'No pude ponerlo. Probá de nuevo en un rato.');
}
