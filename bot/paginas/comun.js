/* ═════════════════════════════════════════════════════════════════════
   LO COMÚN: los atajos de la página ($, esc, num), el navegador (leerLS,
   guardarLS) y las horas en la zona de quien mira (AJ, ZONAS, fmtHora,
   fmtFecha). Salió de app.js el 13/10/2026 (la tanda 2 de sacarlo; Dlx:
   «Te doy el sí»), cortado tal cual. Se carga PRIMERO: la cuenta, la Tienda
   y lo social lo usan al cargar (`leerLS`), y React lo lee de `window`.
   ═════════════════════════════════════════════════════════════════════ */
'use strict';

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

/* ── los ajustes de quien mira ────────────────────────────────────────
   🔑 Dlx, 25/09/2026: «la hora que se muestre ahí que se adapte al usuario
   que esté en la página… en mi caso yo soy EST». Por defecto, la zona y el
   formato del dispositivo; desde Ajustes se pueden fijar.

   ⚠️ TODO EN `localStorage` Y SIEMPRE CON try: en una ventana privada o con
   los datos bloqueados no hay dónde guardar, y la página anda igual. */
function leerLS(k, def) {
  try {
    var v = localStorage.getItem(k);
    return v == null ? def : JSON.parse(v);
  } catch (e) { return def; }
}
function guardarLS(k, v) {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch (e) { /* sin dónde guardar: se sigue igual */ }
}
var AJ = leerLS('lg:ajustes', {}) || {};
var ZONAS = [['', 'La de este dispositivo'],
  ['America/New_York', 'Este de EE. UU. (Nueva York)'], ['America/Mexico_City', 'México'],
  ['America/Guatemala', 'Centroamérica'], ['America/Bogota', 'Colombia · Perú · Ecuador'],
  ['America/Caracas', 'Venezuela · Bolivia'], ['America/Santo_Domingo', 'Rep. Dominicana · Puerto Rico'],
  ['America/Santiago', 'Chile'], ['America/Argentina/Buenos_Aires', 'Argentina · Uruguay'],
  ['Europe/Madrid', 'España']];
function zona() {
  if (AJ.tz) return AJ.tz;
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
}
function opcTz(o) {
  o = o || {};
  if (AJ.tz) o.timeZone = AJ.tz;
  if (AJ.h12 === true || AJ.h12 === false) o.hour12 = AJ.h12;
  return o;
}
function fmtHora(d) {
  try { return new Date(d).toLocaleTimeString('es', opcTz({ hour: 'numeric', minute: '2-digit' })); }
  catch (e) { return ''; }
}
function fmtFecha(d, o) {
  try { return new Date(d).toLocaleDateString('es', opcTz(o || { day: 'numeric', month: 'short' })); }
  catch (e) { return ''; }
}
