// ✅ VERIFICARSE EN LA PÁGINA (o con /verificar): LOS MISMOS ROLES QUE EL PANEL DE DISCORD, DE UNA SOLA TABLA (28/11/2026).
//
// MEDIDO EL 28/11/2026 en el registro de auditoría de DRA (sólo leer): quien se verifica en la página recibe el rol de
// su país («Se verificó en underlegends.pages.dev»), el Miembro 0,4–0,5 s después y pierde el Invitado 0,4 s más tarde
// («Liga Global: se verificó en la página (en DRA + país)»). O sea que YA ERA AL INSTANTE, desde el Worker
// (`cuentaVerificar()` y `darMiembro()` en worker.js), no en la vuelta del ciclo. Lo que el ciclo hace después es la
// tarjeta, y a esa también se la despierta en el momento (`/ciclo-verificar`).
//
// LO QUE FALTABA ERA LA TABLA ÚNICA: el panel de Discord (bot/verificar_dc.js) tiene sus roles escritos —el Miembro,
// el Invitado y los 21 países del menú— y la página leía los suyos de KV (`meta.porton`, que arma `bot/subir_datos.py`
// desde `bot/verificados.py`, `datos/servidores.json` y `sheet/pais_por_rol.py`). Hoy dicen lo mismo, pero eran dos
// lugares, y un rol que se cambia en uno solo verifica distinto según por dónde entraste. `porton()` le pone encima al
// portón de KV los roles de verificar_dc.js.
//
// ⚠️ EL MIEMBRO Y EL INVITADO MANDAN DE ACÁ SIEMPRE: son los dos que se ponen y se sacan al verificarte, por los dos
// caminos. LOS PAÍSES, sólo si el portón no trae ninguno: el portón conoce uno más que el menú (Brasil, que se lee pero
// no se ofrece) y la página arma con ellos su lista para elegir. Que los 21 del menú digan lo mismo en los dos lados lo
// cuida la prueba (`bot/conectar_dra_prueba.mjs`, contra `sheet/pais_por_rol.py`), en CI.
// ⚠️ Lo que sólo sabe el ciclo se queda del portón: `revisa` (a quién mira un admin antes). Sin portón en KV no se
// inventa uno: la página sigue diciendo «porton» como antes.
import * as VD from './verificar_dc.js';

/** El portón de KV con los roles de DRA de bot/verificar_dc.js encima. `null` sigue siendo `null` */
export function porton(P) {
  if (!P || typeof P !== 'object' || String(P.guild || '') !== VD.GUILD_DRA) return P || null;
  const paises = P.paises && Object.keys(P.paises).length ? P.paises : Object.fromEntries(VD.PAISES.map((p) => [p[3], p[0]]));
  return Object.assign({}, P, { rol: VD.ROL_MIEMBRO, invitado: VD.ROL_INVITADO, paises });
}

/** Para la prueba y para `herramientas/`: en qué difieren el portón de KV y la tabla del panel (vacío = iguales) */
export function diferencias(P) {
  const out = [];
  if (!P || String(P.guild || '') !== VD.GUILD_DRA) return ['el portón no es el de DRA'];
  if (String(P.rol || '') !== VD.ROL_MIEMBRO) out.push('Miembro: ' + P.rol + ' contra ' + VD.ROL_MIEMBRO);
  if (P.invitado && String(P.invitado) !== VD.ROL_INVITADO) out.push('Invitado: ' + P.invitado + ' contra ' + VD.ROL_INVITADO);
  for (const [cc, , n, rol] of VD.PAISES) {
    if ((P.paises || {})[rol] !== cc) out.push(n + ': el portón dice ' + ((P.paises || {})[rol] || 'nada') + ' para ' + rol);
  }
  return out;
}
