// 📊 Lo liviano del panel de los socios (19/10/2026): pedirlo y saber si quien mira es dueño de un socio. Aparte de la
// página (socio2.jsx desde el 02/11/2026) para que Mi cuenta pueda mostrar «Mi servidor» sin bajarse la página entera.
import { useEffect, useState } from 'react';

const W = window;

/** 📊 Pide el panel. `irse`: si no hay cuenta, ir a entrar con Discord. */
// (18/11/2026: con la 's', que ahora vuelve a la ruta desde donde saliste, el panel dependía de esa ruta guardada; tiene
// su propia letra en cuenta.js, la 'a', que vuelve siempre a #/socio)
export function pedirPanel(irse = false) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/panel-socio', {}, irse ? 'a' : undefined).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
}

/** ⚙️ Los ajustes del bot de un servidor socio, y un cambio (`{cual, valor}`). Sólo con la cuenta; nunca manda a Discord solo. */
export function pedirAjustes(sv, cambio) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/socio-ajustes', cambio ? { sv, cambio } : { sv }).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
}

/** 🧪 (16/11/2026) Probar el canal elegido para algo (`vivo`, `avisos`, `ascenso`, `resumen`, `ligas`): el bot manda un
 *  mensaje corto ahí. `{ok, estado}`: 403 o 404 es que no puede escribir */
export function probarCanal(sv, cual) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/socio-ajustes', { sv, probar: cual }).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
}

/** 🏁 Quién ganó una batalla que el bot no entendió (`v`: la letra del lado, o `z` para «Nadie siguió»). Lo mismo que
 *  tocar el botón en Discord: lo pasa el ciclo a `datos/decisiones.json`. */
export function contestarFinal(sv, k, v) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/socio-final', { sv, k, v }).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
}

/** 👥 El equipo de un socio (sólo su dueño): `ver`, `buscar` (`{q}`), `sumar` o `sacar` (`{id}`). */
export function pedirEquipo(sv, accion, extra) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/socio-equipo', Object.assign({ sv, accion }, extra || {})).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
}

/** 🏠 La página del servidor, a su gusto: sin nada lee; con `{desc}`, `{redes}`, `{img}` (base64) o `{quitar_banner: true}` cambia. */
export function pedirPagina(sv, cambio) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/socio-pagina', Object.assign({ sv }, cambio || {})).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
}

/** 🛡️ (16/11/2026) Los servidores donde quien mira es del staff y su rol en cada uno: `{roles: {SV: rol}}`. En silencio:
 *  sin cuenta no pregunta nada (la llave lo usa para mostrar «Corregir» sólo a quien puede). Una vez por sesión */
let rolesP = null;
export function pedirRoles() {
  if (!W.conCuenta) return Promise.resolve({ roles: {} });
  try { if (!localStorage.getItem('lg:dc')) return Promise.resolve({ roles: {} }); } catch (e) { return Promise.resolve({ roles: {} }); }
  if (!rolesP) rolesP = W.conCuenta('/api/avisos/socio-roles', {}).then((j) => (j && j.ok ? j : { roles: {} })).catch(() => ({ roles: {} }));
  return rolesP;
}

/** 🛠️ Las llaves del servidor, desde su staff: `ver`, `corregir` o `sugerir` (`{fix, id?}`) y `cerrar` (`{id}`). */
export function pedirLlave(sv, accion, extra) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/socio-llave', Object.assign({ sv, accion }, extra || {})).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
}

/** 🏟️ La liga del servidor, desde su staff: `ver`, `cambiar` (`{cambio}`) o `deshacer` (`{id}`). */
export function pedirLiga(sv, liga, accion, extra) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/socio-liga', Object.assign({ sv, liga, accion }, extra || {})).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
}

/** 🛡️ (16/11/2026) Lo demás del staff: `que` es `quien`, `nombres`, `vs`, `agenda` o `muro` (`socioStaff()` en avisos.js) */
export function pedirStaff(sv, que, accion, extra) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/socio-staff', Object.assign({ sv, que, accion: accion || 'ver' }, extra || {})).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
}

/** 🛠️ Lo de Mods que no es de un servidor (20/11/2026): `ident` (quién es quién, sólo Dlx), `fijar` (una publicación
 *  arriba, Dlx y los Admin y Moderadores de la página) y `estilo` (un evento de estilo de la Liga, sólo Dlx). `/avisos/mods` */
export function pedirMods(que, accion, extra) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/mods', Object.assign({ que, accion: accion || 'ver' }, extra || {})).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
}

/** 🛡️ ¿Ese rol puede `que`? Con `permisos`, la tabla que manda el Worker (`SOCIO_PERMISOS` de bot/avisos.js, vía
 *  `pedirRoles()`): la página no tiene su copia. El dueño y Dlx, todo */
export const puede = (rol, que, permisos) => rol === 'dlx' || rol === 'dueno' || ((permisos || {})[rol] || []).includes(que);

// (18/11/2026: lo guardado no decía de qué cuenta era y nada lo borraba: tras «Salir» el botón «Mi servidor» seguía a la
// vista, y quien entraba después en la misma pestaña heredaba el «sí» del anterior. Ahora va con el id de la cuenta,
// `<id>:1`, vale sólo para esa, y sin cuenta nunca dice que sí)
const idCuenta = () => String((W.DC && W.DC.id) || '');
function deSesion() {
  const id = idCuenta();
  let v = null;
  try { v = sessionStorage.getItem('lg:socio'); } catch (e) { v = null; }
  return id && v && v.slice(0, -2) === id ? v.slice(-1) : null;
}

/** ¿Es dueño de algún socio? Una vez por sesión, en silencio: para el botón de Mi cuenta. */
export function useSocio(conCuenta) {
  const [si, setSi] = useState(() => deSesion() === '1');
  useEffect(() => {
    if (!conCuenta) return undefined;
    const ya = deSesion();
    if (ya !== null) { setSi(ya === '1'); return undefined; }
    let vivo = true;
    pedirPanel(false).then((j) => {
      const s = !!(j && j.ok && (j.servidores || []).length);
      const id = idCuenta();
      try { if (j && j.ok && id) sessionStorage.setItem('lg:socio', id + ':' + (s ? '1' : '0')); } catch (e) { /* igual */ }
      if (vivo) setSi(s);
    });
    return () => { vivo = false; };
  }, [conCuenta]);
  return !!conCuenta && si;
}
