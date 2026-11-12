// 📊 Lo liviano del panel de los socios (19/10/2026): pedirlo y saber si quien mira es dueño de un socio. Aparte de la
// página (socio2.jsx desde el 02/11/2026) para que Mi cuenta pueda mostrar «Mi servidor» sin bajarse la página entera.
import { useEffect, useState } from 'react';

const W = window;

/** 📊 Pide el panel. `irse`: si no hay cuenta, ir a entrar con Discord. */
export function pedirPanel(irse = false) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/panel-socio', {}, irse ? 's' : undefined).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
}

/** ⚙️ Los ajustes del bot de un servidor socio, y un cambio (`{cual, valor}`). Sólo con la cuenta; nunca manda a Discord solo. */
export function pedirAjustes(sv, cambio) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/socio-ajustes', cambio ? { sv, cambio } : { sv }).then((j) => j || { error: 'red' }).catch(() => ({ error: 'red' }));
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

/** ¿Es dueño de algún socio? Una vez por sesión, en silencio: para el botón de Mi cuenta. */
export function useSocio(conCuenta) {
  const [si, setSi] = useState(() => { try { return sessionStorage.getItem('lg:socio') === '1'; } catch (e) { return false; } });
  useEffect(() => {
    if (!conCuenta) return undefined;
    let ya = null;
    try { ya = sessionStorage.getItem('lg:socio'); } catch (e) { ya = null; }
    if (ya !== null) return undefined;
    let vivo = true;
    pedirPanel(false).then((j) => {
      const s = !!(j && j.ok && (j.servidores || []).length);
      try { if (j && j.ok) sessionStorage.setItem('lg:socio', s ? '1' : '0'); } catch (e) { /* igual */ }
      if (vivo) setSi(s);
    });
    return () => { vivo = false; };
  }, [conCuenta]);
  return si;
}
