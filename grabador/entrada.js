// 🚪 CUANDO NO PUEDE ENTRAR A LA LLAMADA (25/11/2026). Sin Discord ni red: lo prueba `prueba.js`.
//
// Lo que pasó el 24/11/2026: ULAYA entró a TORNEOS de Freestyle Zone para DEM BATTLES, se puso «🔴 GRABANDO · ULAYA» y a
// las 11:06 PM ET alguien de ahí (o un bot de moderación) la AISLÓ un día (timeout). Un miembro aislado no puede entrar a
// ninguna llamada de ese servidor: Discord no contesta y `entersState(Ready, 30 s)` corta con «The operation was
// aborted». El grabador lo volvía a probar cada 2 minutos toda la noche, y lo único que se veía estaba en la consola de
// Railway. Esto lo cambia en tres cosas:
//   · ESPERA ENTRE INTENTOS (`REINTENTO_MIN`), y si está aislada, hasta que se le termine el timeout
//   · EL POR QUÉ: aislada, sin permiso, o Discord que no terminó de conectar
//   · UN MENSAJE en Logs de DRA por evento, que se EDITA con cada intento (ver «Avisar una vez, y editar») y dice al
//     final si entró

/** Minutos entre un intento fallido y el siguiente: el 1.º, el 2.º… y de ahí en más el último. */
export const REINTENTO_MIN = [2, 5, 10, 20, 30];
/** Una falla que llega más de esto después de la anterior es de OTRO evento: mensaje nuevo. */
export const OTRO_EVENTO_MIN = 90;

/** Las fallas de entrar, por servidor. */
export class Fallas {
  constructor() { this.m = new Map(); }   // gid -> { n, primera, ultima, hasta, motivo, aislada, aviso }

  /** ¿Se puede probar de nuevo en este servidor? */
  puede(gid, ahora = Date.now()) {
    const f = this.m.get(gid);
    return !f || ahora >= f.hasta;
  }

  /** Anota una falla y devuelve la fila. `aislada`: hasta cuándo dura el timeout (ms), si lo hay. */
  fallo(gid, motivo, ahora = Date.now(), aislada = null) {
    let f = this.m.get(gid);
    if (!f || ahora - f.ultima > OTRO_EVENTO_MIN * 60000) {
      f = { n: 0, primera: ahora, ultima: ahora, hasta: 0, motivo: '', aislada: null, aviso: null };
      this.m.set(gid, f);
    }
    f.n++;
    f.ultima = ahora;
    f.motivo = motivo;
    f.aislada = aislada && aislada > ahora ? aislada : null;
    const espera = REINTENTO_MIN[Math.min(f.n - 1, REINTENTO_MIN.length - 1)] * 60000;
    // aislada: no hay nada que probar hasta que se le termine (y un poco después, por si el reloj de Discord va adelantado)
    f.hasta = f.aislada ? Math.max(ahora + espera, f.aislada + 15000) : ahora + espera;
    return f;
  }

  /** Entró: se olvida la racha y devuelve la fila que había (para decir en Logs que al final entró). */
  entro(gid) {
    const f = this.m.get(gid) || null;
    this.m.delete(gid);
    return f;
  }
}

/** El por qué, para una persona: con timeout lo dice así, y si no, lo que contestó Discord. */
export function motivoDe(error, aislada, horaET) {
  if (aislada) {
    return `ULAYA está **aislada (timeout)** en ese servidor hasta las ${horaET(new Date(aislada))}: alguien del staff `
      + 'o un bot de moderación. Mientras dure no puede entrar a ninguna llamada de ahí';
  }
  const e = String(error || '');
  if (/permiso/i.test(e)) return e;
  if (/aborted|abort/i.test(e)) return 'Discord no terminó de conectar la llamada en 30 s («' + e.slice(0, 80) + '»)';
  return 'Discord contestó «' + e.slice(0, 120) + '»';
}

/** El mensaje de Logs (uno por evento; se edita con cada intento). */
export function textoFalla({ servidor, canal, porque, f, horaET, entro = null, sacada = false }) {
  const intentos = f.n === 1 ? '1 intento' : `${f.n} intentos`;
  const lineas = [
    `⚠️ **${sacada && f.n === 1 ? 'Me sacaron de la llamada' : 'No pude entrar a grabar'}** · ${servidor} · <#${canal}>`,
    `Iba a grabar porque ${porque}. ${intentos}, el último a las ${horaET(new Date(f.ultima))}.`,
    `Por qué: ${f.motivo}.`,
  ];
  if (entro) lineas.push(`✅ Al final entré a las ${horaET(new Date(entro))}.`);
  else lineas.push(`Vuelvo a probar a las ${horaET(new Date(f.hasta))}.`);
  return lineas.join('\n');
}
