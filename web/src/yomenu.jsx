// 👤 EL MENÚ DE TU CARA (26/10/2026, la puerta 1 del Inventario). Dlx: «tengo que irme a mi cuenta, luego en mi
// perfil…», y a la maqueta, «cinco puertas, 1, 3, 4 y 5». Tocar tu cara (arriba en la compu, «Tu cuenta» abajo en el
// celular) ya no lleva directo a Tu cuenta: abre este menú corto, con el Inventario primero y cuántas cosas nuevas
// tienes (se pregunta al abrirlo, no en cada página: ver inv_nuevos.js).
// Idea de 21st, sólo mirada: «User Profile Dropdown Menu» (shadcnspace) y «Profile Dropdown» (kokonutd).
//
// 🔔 CON EL ESTILO DE LA CAMPANA (Dlx, 13/11/2026: «remakea este apartado como lo está notificaciones con ese mismo
// estilo», y «añade la opción de soporte»): las mismas piezas `.nt-*` del panel de notificaciones —el título en Anton,
// los rótulos de sección, cada fila con su ícono en un círculo, el punto magenta de lo nuevo—, así los dos paneles de la
// cabecera se ven como uno. Soporte lleva a «Algo está mal» de Tu cuenta, que ya es el formulario de los pedidos.
// Los íconos son los de la página (`Ico` de piezas.jsx), no emojis (Dlx: «crea tus propios iconos, no usemos emojis»).
import { useEffect, useRef, useState } from 'react';
import { pasePost, usePases } from './pase.js';
import { SelloPremium, boostPremium, esPremium, marcoPremium } from './sello.jsx';
import { cuantosNuevos } from './inv_nuevos.js';
import { Ico } from './piezas.jsx';
import { DUENO } from './liga.js';
import { useRoles } from './roles.js';
import { useSocio } from './panelsocio.js';
import { INTERRUPTORES, abrirLugaresMods, lugaresMods, useModsEstado } from './mods.js';

export function YoMenu({ k, dc, nombre, cara, abajo = false, onCerrar }) {
  const [nuevos, setNuevos] = useState(0);
  // 🛠️ TUS PANELES, A UN TOQUE (Dlx, 13/11/2026: «quizás ahí que me aparezca opciones como Dashboard, mi servidor
  // directamente»): los mismos dos botones de arriba de Tu cuenta, con las mismas reglas. El Dashboard, para Dlx y para
  // quien tiene un rol que lo abre; Mi servidor, para el dueño de un socio. Son atajos: la puerta de verdad es el servidor
  const misRoles = ((useRoles() || {})[k] || []).map((x) => x[0]);
  const dashboard = !!dc && (String(dc.id) === DUENO || misRoles.some((r) => ['admin', 'asistente', 'moderador'].includes(r)));
  const esDlx = !!dc && String(dc.id) === DUENO;
  // Dlx ve todos los servidores en el panel (`sociosDe()` del objeto): su fila sale de entrada, sin esperar la pregunta
  const socio = useSocio(!!dc) || esDlx;
  // 💎 si tienes el Pase de rapero premium, una fila que lo dice, con tu marco y lo que suma (va a la página del Pase)
  const pub = usePases();
  const prem = esPremium(pub, k);
  const marco = prem ? marcoPremium(pub, k) : '';
  const caja = useRef(null);
  useEffect(() => {
    let vivo = true;
    pasePost('tags-mios', {}).then((d) => { if (vivo && d && d._ok) setNuevos(cuantosNuevos(d)); });
    return () => { vivo = false; };
  }, []);
  // se cierra con Escape, tocando afuera o eligiendo algo
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    const fuera = (e) => {
      const c = caja.current;
      if (c && !e.composedPath().includes(c)) onCerrar();
    };
    window.addEventListener('keydown', tecla);
    const t = setTimeout(() => window.addEventListener('pointerdown', fuera), 0);
    const p = caja.current && caja.current.querySelector('a');
    if (p) p.focus();
    return () => { window.removeEventListener('keydown', tecla); window.removeEventListener('pointerdown', fuera); clearTimeout(t); };
  }, [onCerrar]);
  // 🛠️ MODS, también acá (Dlx, 17/11/2026: «pon el menú de mods dentro de tus paneles… o si se puede ponlo en ambos
  // lugares»): en el celular el botón de la cabecera no entra —partía la cabecera en dos renglones—, y acá entra siempre.
  // No abre el menú de una página sino la ventana con TODOS los lugares donde puedes usarlo (mods.jsx, `LugaresMods`).
  // Quién es sale de lo mismo que ya miran las dos filas de arriba
  const quien = { owner: esDlx, admin: esDlx || misRoles.includes('admin'), mod: dashboard, socio: !!socio };
  const lugares = lugaresMods(quien);
  const M = useModsEstado();
  const prendidos = Object.keys(INTERRUPTORES).filter((x) => M[x]).length;
  const paneles = [
    dashboard ? ['#/dashboard', 'tablero', 'Dashboard', 'lo que espera que decidas', false, true] : null,
    socio ? ['#/socio', 'servidor', esDlx ? 'Los servidores' : 'Mi servidor', esDlx ? 'las estadísticas de todos los socios' : 'las estadísticas de tu servidor', false, true] : null,
    lugares.length ? ['', 'escudo', 'MODS', (prendidos ? (prendidos === 1 ? '1 prendido · ' : prendidos + ' prendidos · ') : '')
      + (lugares.length === 1 ? 'el lugar donde puedes usarlo' : 'los ' + lugares.length + ' lugares donde puedes usarlo'), false, true,
    () => abrirLugaresMods(quien)] : null,
  ].filter(Boolean);
  const secciones = [
    paneles.length ? ['Tus paneles', paneles] : null,
    ['Lo tuyo', [
      ['#/inventario', 'mochila', 'Inventario', nuevos ? nuevos + (nuevos === 1 ? ' cosa nueva' : ' cosas nuevas') : 'tus TAGs, marcos y cartas', nuevos > 0],
      [k ? '#/r/' + encodeURIComponent(k) : '#/cuenta/perfil', 'perfil', 'Mi perfil', 'lo que ven los demás'],
      ['#/pase', 'pase', 'Pase rapero', 'tu nivel y tus premios'],
      prem ? ['#/pase', 'sello', 'Tienes el Premium', (marco ? 'Tu marco: ' + marco + ' · ' : '') + '+' + boostPremium(pub) + ' % de XP'] : null,
      // 🛍️ la Tienda vive acá desde que salió del menú de arriba (Dlx, 12/11/2026: «Tienda me gusta en tu cuenta… ahí nos
      // ahorramos un espacio»): es donde se gastan tus Puntos
      ['#/tienda', 'tienda', 'Tienda', 'tus Puntos y el precio por cabeza'],
      // 🎁 Invita y gana (17/11/2026): también acá, porque en pantallas angostas el regalo de arriba no entra
      ['#/invitar', 'regalo', 'Invita y gana', 'tu link, tu track y tus invitados'],
    ].filter(Boolean)],
    ['Cuenta y ayuda', [
      ['#/cuenta', 'engranaje', 'Tu cuenta', 'foto, redes, avisos y la app'],
      ['#/cuenta/algo-mal', 'soporte', 'Soporte', 'perdí mi cuenta, mi país, algo está mal'],
    ]],
  ].filter(Boolean);
  return (
    <div className={'yo-menu' + (abajo ? ' abajo' : '')} ref={caja} role="menu" aria-label="Lo tuyo">
      <div className="nt-h">
        {cara ? <span className="yo-menu-cara" aria-hidden="true">{cara}</span> : null}
        <h2>{nombre || 'Lo tuyo'}</h2>
        <button type="button" className="nt-ib" aria-label="Cerrar" onClick={onCerrar}><Ico n="cerrar" t={16} /></button>
      </div>
      <div className="nt-cuerpo">
        {secciones.map(([t, xs]) => (
          <div key={t}>
            <p className="nt-s">{t}</p>
            <ul>{xs.map(([h, ic, n, d, nuevo, panel, fn]) => {
              const dentro = (
                <>
                  <span className="nt-cara"><span className="nt-c nt-ico" aria-hidden="true">{ic === 'sello' ? <SelloPremium t={20} /> : <Ico n={ic} t={20} />}</span></span>
                  <span className="nt-t"><b>{n}</b><small className={nuevo ? 'nv' : ''}>{d}</small></span>
                  <span className="nt-hora" aria-hidden="true">›</span>
                </>
              );
              const cls = 'nt-f' + (nuevo ? ' nueva' : '') + (panel ? ' panel' : '');
              return (
                // las dos filas del Pase van al mismo lugar: la clave lleva el nombre
                <li key={h + n}>
                  {/* una fila sin link abre algo en vez de ir (MODS): un botón, y el menú se cierra antes */}
                  {fn ? <button type="button" role="menuitem" className={cls} aria-haspopup="dialog" onClick={() => { onCerrar(); fn(); }}>{dentro}</button>
                    : <a href={h} role="menuitem" className={cls} onClick={onCerrar}>{dentro}</a>}
                </li>
              );
            })}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}
