// 🤝 UNIRTE A LOS SERVIDORES TIER 1 (Dlx, 13/11/2026: «Yes, the safe way», a «¿el bot te une a todos los Tier 1?»).
// Un botón que abre la lista de los Tier 1 —todos marcados, cada uno se puede desmarcar— y dice claro qué va a pasar:
// Discord pide el permiso «Unirse a servidores por ti», se usa una vez para estos y no se guarda. A la vuelta, cómo
// quedó cada uno, y donde no se pudo, su invitación de siempre.
//
// ⚠️ HECHO COMO PIDE LA DEVELOPER POLICY DE DISCORD (8/7/2024): «adding the account to a server» pide informar claro y
// un permiso explícito (regla 1) y no se puede inflar la cantidad de miembros (regla 13). Por eso: el permiso aparte y
// sólo al tocar (`urlLogin('u')` en bot/paginas/cuenta.js, con la pantalla de Discord), tú eliges cuáles, y NO HAY
// PREMIO por unirse. El Worker suma sólo a los socios y a los que viajan (`cuentaUnirse()` en bot/worker.js).
//
// Vive en Socios (en el cuadro del Tier 1). Desde el Ranking se llega con `lg:unirse-abrir`, y la vuelta de Discord cae
// en Socios con el resultado en `window.UNIRSE` (`lg:unirse`)
import { useEffect, useRef, useState } from 'react';
import { siglaDe } from './liga.js';
import { Ico } from './piezas.jsx';
import { PopCab } from './pop.jsx';

const ESTADO = {
  ok: ['si', 'Entraste'],
  ya: ['si', 'Ya estabas'],
  lleno: ['no', 'Tu cuenta llegó al máximo de servidores de Discord'],
  no_deja: ['no', 'Ese servidor no te deja entrar'],
  sin_permiso: ['no', 'El bot todavía no puede invitar ahí'],
  permiso: ['no', 'Discord no dio el permiso'],
  espera: ['no', 'Discord pidió esperar un rato'],
  no: ['no', 'No está disponible'],
  error: ['no', 'No se pudo'],
};
const ERROR = {
  cancelado: 'Cancelaste el permiso en Discord: no te sumamos a ninguno.',
  espera: 'Lo probaste varias veces seguidas: espera unos minutos y vuelve a intentarlo.',
  discord: 'Discord no confirmó tu cuenta. Prueba de nuevo.',
  token: 'Discord no confirmó tu cuenta. Prueba de nuevo.',
  discord_error: 'Discord no dio el permiso. Prueba de nuevo.',
  discord_ocupado: 'Discord está ocupado: prueba en un rato.',
  nada: 'No llegó qué servidores elegiste. Elígelos de nuevo.',
  red: 'Sin conexión: prueba de nuevo.',
  bot: 'El bot no está disponible ahora mismo. Prueba en un rato.',
};

/** Los socios Tier 1: los que cuentan para el Competitivo (`svs[].cu.c`, Socios 4.98) */
export function tier1De(liga) {
  return Object.values((liga && liga.svs) || {}).filter((s) => s.cu && s.cu.c);
}

/** Desde otra página (el pop-up del Competitivo): a Socios, con la lista abierta */
export function abrirUnirse() {
  try { sessionStorage.setItem('lg:unirse-abrir', '1'); } catch (e) { /* igual se llega a Socios */ }
  location.hash = '#/socios';
}

export function UnirseTier1({ liga }) {
  const svs = tier1De(liga);
  const dlg = useRef(null);
  const [elegidos, setElegidos] = useState(() => new Set(svs.map((s) => s.sv)));
  const [U, setU] = useState(() => (typeof window !== 'undefined' && window.UNIRSE ? { ...window.UNIRSE } : null));
  useEffect(() => {
    const f = () => setU(window.UNIRSE ? { ...window.UNIRSE } : null);
    window.addEventListener('lg:unirse', f);
    f();
    return () => window.removeEventListener('lg:unirse', f);
  }, []);
  // se abre solo con el resultado (la vuelta de Discord) o si lo pidieron desde el Ranking
  useEffect(() => {
    let abrir = !!U;
    try { if (sessionStorage.getItem('lg:unirse-abrir')) { sessionStorage.removeItem('lg:unirse-abrir'); abrir = true; } } catch (e) { /* igual */ }
    if (abrir && dlg.current && !dlg.current.open) dlg.current.showModal();
  }, [!!U]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!svs.length || typeof window === 'undefined' || typeof window.unirmeTier1 !== 'function') return null;
  const cerrar = () => {
    if (dlg.current) dlg.current.close();
    // el resultado se muestra una vez
    if (U && !U.cargando) { window.UNIRSE = null; setU(null); }
  };
  const cambia = (sv) => setElegidos((x) => { const n = new Set(x); if (n.has(sv)) n.delete(sv); else n.add(sv); return n; });
  const n = elegidos.size;
  const res = U && U.res ? U.res : null;
  return (
    <>
      <button type="button" className="btn verde chico un-b" aria-haspopup="dialog" onClick={() => dlg.current && dlg.current.showModal()}>
        <Ico n="socios" t={16} />Unirme a los Tier 1
      </button>
      <dialog className="pn-pop un-pop" ref={dlg} aria-label="Unirte a los servidores Tier 1" onClose={() => { if (U && !U.cargando) { window.UNIRSE = null; setU(null); } }}
        onClick={(e) => { if (e.target === dlg.current) cerrar(); }}>
        <PopCab ico="socios" t="Unirte a los Tier 1" sub={U ? 'Cómo quedó' : 'Tú eliges a cuáles'} cerrar={cerrar} />
        <div className="un-in">
          {U && U.cargando ? <p className="un-p" aria-live="polite">Sumándote a {U.svs ? U.svs.length : ''} servidores…</p>
            : U && U.error ? (
              <>
                <p className="un-p un-mal" role="alert">{ERROR[U.error] || 'No se pudo. Prueba de nuevo.'}</p>
                <button type="button" className="btn borde2 chico" onClick={() => { window.UNIRSE = null; setU(null); }}>Volver a la lista</button>
              </>
            ) : res ? (
              <>
                <ul className="un-l">
                  {Object.keys(res).map((sv) => {
                    const s = (liga.svs || {})[sv] || { sv };
                    const [cl, txt] = ESTADO[res[sv]] || ESTADO.error;
                    return (
                      <li key={sv} className={cl} style={{ '--c': s.color || '#29B298' }}>
                        <img alt="" src={liga.logo(sv)} />
                        <span><b>{s.nombre || sv}</b><small>{txt}</small></span>
                        {cl === 'si' ? <Ico n="ok" t={18} />
                          : s.invita ? <a className="btn borde2 chico" href={s.invita} target="_blank" rel="noopener noreferrer">Entrar ↗</a> : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="un-p un-chico">El permiso de Discord ya se usó y no quedó guardado.</p>
              </>
            ) : (
              <>
                <p className="un-p">Te sumamos con el bot a los que dejes marcados. Discord te va a pedir el permiso <b>«Unirse a servidores por ti»</b>: lo usamos <b>una vez, para estos</b>, y no lo guardamos.</p>
                <ul className="un-l eleg">
                  {svs.map((s) => (
                    <li key={s.sv} style={{ '--c': s.color || '#29B298' }}>
                      <label>
                        <input type="checkbox" checked={elegidos.has(s.sv)} onChange={() => cambia(s.sv)} />
                        <img alt="" src={liga.logo(s.sv)} />
                        <span><b>{s.nombre || s.sv}</b><small>{siglaDe(s.sv)}{s.miembros ? ' · ' + s.miembros.toLocaleString('es') + ' en su Discord' : ''}</small></span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn verde un-ir" disabled={!n} onClick={() => window.unirmeTier1([...elegidos])}>
                  {n ? 'Unirme a ' + (n === 1 ? '1 servidor' : n + ' servidores') : 'Elige al menos uno'}
                </button>
                <p className="un-p un-chico">Si ya estás en alguno, no pasa nada. No hay premio por unirse: es para que juegues donde cuenta el Competitivo. Si prefieres entrar tú, cada uno tiene su «Entrar» en esta página.</p>
              </>
            )}
        </div>
      </dialog>
    </>
  );
}
