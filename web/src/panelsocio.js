// 📊 Lo liviano del panel de los socios (19/10/2026): pedirlo y saber si quien mira es dueño de un socio. Aparte de
// socio.jsx para que Mi cuenta pueda mostrar «Mi servidor» sin bajarse la página entera.
import { useEffect, useState } from 'react';

const W = window;

/** 📊 Pide el panel. `irse`: si no hay cuenta, ir a entrar con Discord. */
export function pedirPanel(irse = false) {
  if (!W.conCuenta) return Promise.resolve({ error: 'red' });
  return W.conCuenta('/api/avisos/panel-socio', {}, irse ? 's' : undefined).then((j) => j || { error: 'red' });
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
