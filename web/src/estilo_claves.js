// 🔑 LAS CLAVES CON LAS QUE PUEDE ESTAR MARCADO UN EVENTO DE ESTILO (17/11/2026; aparte desde el 20/11/2026, para que el
// lápiz de Mods en Eventos no baje el catálogo de estilos): su número y el id de su anuncio. Las usan el Dashboard
// (dash_estilos.jsx) y Mods (mods_estilo.jsx); el Worker valida las mismas (`ajusteValido()`, `eventos_estilo`)
export function clavesDe(e) {
  const out = [];
  // ⚠️ sólo si es un NÚMERO DE EVENTO (hasta 6 cifras): la llave de un servidor que no suma (Tier 2 y 3,
  // `datos/llaves_sin_sumar.json`) trae en `ll` su registro (`#126047346`), que no es un evento; ese va por su anuncio.
  // El Worker rechaza el ajuste entero con una clave así. (18/11/2026: esto decía «una llave en vivo», y no lo es)
  if (e && e.ll && /^[0-9]{1,6}$/.test(String(e.ll))) out.push(String(e.ll));
  const m = /\/([0-9]{15,22})\/?$/.exec((e && e.link) || '');
  if (m) out.push('a:' + m[1]);
  return out;
}
