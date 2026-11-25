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
