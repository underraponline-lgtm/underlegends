// 🛟💾 LO QUE ULAYA GUARDA DE RESERVA (25/11/2026, Dlx: «me gustan todos»), en funciones puras para que prueba.js las
// pruebe sin conectarse a Discord (index.js no se puede importar: arranca el bot). Las usa index.js:
//   · el plan B si el vigía no contesta (el objeto caído del 24/11, 3–7 PM ET): `caidoDesde()` y `anunciosDeAhora()`
//   · lo grabado que sobrevive a un reinicio de Railway: `largoRecuperada()` (ver `foto()` y `recuperar()` en index.js)
const num = (s, d) => (Number.isFinite(Number(s)) && String(s ?? '').trim() !== '' ? Number(s) : d);
const E = process.env;

//: desde cuántos minutos sin respuesta el vigía se da por caído
export const VIGIA_CAIDO_MIN = num(E.VIGIA_CAIDO_MIN, 10);
//: los anuncios que se piden para tener de reserva (un Worker que no lo conoce manda sólo los de ahora: no rompe nada)
export const ANUNCIO_HORAS = 12;
//: la ventana de un anuncio: desde 30 min antes de su hora hasta 4 h después (como `anunciadosCiclo()` de bot/avisos.js)
export const ANUNCIO_ANTES_MIN = 30;
export const ANUNCIO_DESPUES_H = 4;
//: cada cuántos segundos se guarda `estado.json` de cada grabación
export const FOTO_S = num(E.FOTO_S, 60);

/** ¿Pasaron más de `min` minutos desde la última vez que contestó (`ok`, ms)? */
export function caidoDesde(ok, ahora = Date.now(), min = VIGIA_CAIDO_MIN) { return ahora - ok > min * 60000; }

/** De `[[guild, ini, autor]]`, los que están en su ventana `ahora`. */
export function anunciosDeAhora(ev, ahora = Date.now()) {
  return (ev || []).filter((f) => Array.isArray(f) && Number(f[1]) - ANUNCIO_ANTES_MIN * 60000 <= ahora
    && ahora <= Number(f[1]) + ANUNCIO_DESPUES_H * 3600000);
}

/** El largo a entregar de una grabación recuperada (`e` es su `estado.json`): si Railway la apagó (`cortada`), lo que
 *  dice la foto; si se cayó sin avisar, lo que llegó a escribirse después de la última foto, nunca más de `FOTO_S` + 10. */
export function largoRecuperada(e, durPistas) {
  const s = Number(e && e.seg) || 0;
  if (e && e.cortada) return s;
  return Math.max(s, Math.min(Math.max(0, ...(durPistas || [0])), s + FOTO_S + 10));
}

// ✂️⏸️ EL EVENTO QUE SE CORTA A MEDIAS (25/11/2026; Dlx: «en un evento que ULAYA estaba grabando la competencia terminó a
// medias, el organizador se fue… ¿sabe ULAYA cuando se cancela un evento, si alguien la va a retomar o si salirse?», y a
// las dos mejoras, «dale»). Hasta acá sólo miraba la llamada y la llave: salía a los 5 min de vaciarse o a los 40 de la
// llave quieta, y si después lo retomaban, era OTRA grabación. Ahora también lee lo que el organizador AVISA (`estados` de
// `/avisos/vivo`, lo mismo que la página: cancelado, pausado, atrasado) y si la llave ya tiene campeón:
//   · «se cancela»                  → termina YA y entrega (no espera los 40 min)
//   · «pausa» (con o sin hora)       → no sale porque la llave esté quieta; si la llamada se vacía, se PAUSA hasta la hora
//                                     que dijo + `PAUSA_ORG_COLA_MIN` (o `PAUSA_ORG_MAX_MIN` sin hora) y sigue la misma
//   · la llave SIN campeón y se vacía la llamada o la llave se queda quieta → sale y ESPERA `RETOMA_MAX_MIN` a que la llave
//                                     se vuelva a mover: si se mueve, vuelve y sigue la MISMA grabación; si no, entrega
//   · la llave con campeón          → como siempre
export const RETOMA_MAX_MIN = num(E.RETOMA_MAX_MIN, 90);
export const PAUSA_ORG_MAX_MIN = num(E.PAUSA_ORG_MAX_MIN, 90);
export const PAUSA_ORG_COLA_MIN = 30;
//: lo que dice que una llave terminó: su campeón, en palabras (🏆 y 👑 van de adorno en títulos y canales: no cuentan)
export const CAMPEON = /campe[oó]n|campeona|ganador(?:a)?\s+del\s+torneo|\b1\s*(?:er|ro|°|º)\s*(?:lugar|puesto)|primer\s+(?:lugar|puesto)/i;

/**
 * Qué hacer en esta vuelta, con: `vacia` (la llamada se vació hace ESPERA_SALIR o más), `quieta` (el evento se dio por
 * terminado: la llave sin tocar `LLAVE_SALIR_MIN`), `aviso` (lo último que avisó el organizador desde que empezó a grabar:
 * `{tipo, pub, nueva}` o null), `cerrada` (la llave tiene campeón), `llaveVista`, `ahora`. Devuelve
 * `{que: 'seguir' | 'terminar' | 'pausar', razon, hasta, retoma}`.
 */
export function decidirFin({ vacia = false, quieta = false, aviso = null, cerrada = false, llaveVista = false, ahora = Date.now() } = {}) {
  if (aviso && aviso.tipo === 'cancelado') return { que: 'terminar', razon: 'el organizador avisó que se canceló' };
  const pausaOrg = aviso && aviso.tipo === 'pausado';
  if (pausaOrg) {
    if (!vacia) return { que: 'seguir' };
    const hasta = Number(aviso.nueva) > ahora ? Number(aviso.nueva) + PAUSA_ORG_COLA_MIN * 60000 : ahora + PAUSA_ORG_MAX_MIN * 60000;
    return { que: 'pausar', razon: 'el organizador avisó una pausa', hasta, retoma: false };
  }
  if (!vacia && !quieta) return { que: 'seguir' };
  if (llaveVista && !cerrada) {
    return { que: 'pausar', razon: vacia ? 'la llamada se vació con la llave sin terminar' : 'la llave quedó quieta sin campeón',
      hasta: ahora + RETOMA_MAX_MIN * 60000, retoma: true };
  }
  return { que: 'terminar', razon: vacia ? 'se vació la llamada' : 'terminó el evento' };
}
