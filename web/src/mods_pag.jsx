// 🛠️ LA PÁGINA MODS (`#/mods`, 20/11/2026). Dlx, a la maqueta privada 2n91HAK3krNGWeK6u7zFF1: «A con lo de B, dale». La A,
// «la consola»: una página en Tus paneles en tres grupos —cómo ves la página, probar sin gastar y corregir de verdad— y al
// costado lo que hiciste, con Deshacer. De la B, la corrección en la llave misma: un lápiz en cada batalla, el aviso de qué
// cambia después y el Deshacer (llave.jsx, `StaffLlave` y `Lapiz`), sin barra flotante (Dlx sacó el menú de arriba el 18/11).
// Cada rol ve sólo lo suyo (la crítica de la maqueta: un Moderador veía 14 cosas y podía usar una).
//
// Qué es cada estado y quién lo lee: mods.js. ⚠️ Lo que se ve acá no da permisos: el Worker decide en cada pedido.
// Tanda 2 (20/11/2026): la hora en la lente, tener todo en el Inventario, el festejo, los lápices en las ligas y, con el
// Worker, los Admin y Moderadores de la página en llaves y ligas (`liga` de `socio-roles`).
// Tanda 3 (20/11/2026, con el Worker): «Alguien…» en la lente (sólo Dlx: lo de una persona, para mirar), el registro de
// Mods del servidor (`/avisos/mods`, de `socio_log`) y «Ocultar» en las publicaciones (mods_ocultar.jsx).
// Tanda 4 (20/11/2026, con el Worker, Dlx: «termina lo que queda de Mods»): quién es quién en los perfiles (sólo Dlx,
// mods_perfil.jsx), marcar un evento de estilo desde el evento (Dlx, y el staff de un Tier 1 o 2: mods_estilo.jsx) y
// fijar una publicación arriba (Dlx y los Admin y Moderadores de la página, en mods_ocultar.jsx).
import { useEffect, useState } from 'react';
import { DUENO } from './liga.js';
import { ahoraReal, deshechaMods, ponerMod, prendidosMods, rolMods, tieneMods, useHistorialMods, useModsEstado, useQuienMod } from './mods.js';
import { horaMods } from './mods.jsx';
import { pedirLlave, pedirMods, pedirRoles, pedirStaff } from './panelsocio.js';
import { abrirDePrueba, abrirMomento } from './drops.jsx';
import { pedirRecorrido } from './primera.js';
import { Ico } from './piezas.jsx';
import { ponerBotonMods, useBotonMods, useRuta } from './mods_herramientas.jsx';
import CSS from './css/mods.css?inline';
import { usarCss } from './css.js';

const W = window;
//: las rarezas de los Dragón Drops, con sus colores (drops.jsx `COLOR_RZ`)
const RAREZAS = [['Maqueta', '#9AA4B2'], ['Mixtape', '#29B298'], ['Vinilo', '#9B5CFF'], ['Disco de Oro', '#FF4F93'], ['Micrófono de Oro', '#F5C542']];

// 🕐 las horas de la lente, en hora del este (noviembre a enero: −5): el próximo viernes a las 10 PM, el cierre de la T1
// y la gala (NOVEDADES: la T1 va del 22/09 al 31/12 y la gala es el 1/1 a las 11 AM)
const ET = -5 * 3600000;
function viernes() {
  const et = new Date(ahoraReal() + ET);
  const d = (5 - et.getUTCDay() + 7) % 7 || (et.getUTCHours() >= 22 ? 7 : 0);
  return Date.UTC(et.getUTCFullYear(), et.getUTCMonth(), et.getUTCDate() + d, 22) - ET;
}
const HORAS = () => [['', 'Ahora'], [String(viernes()), 'Viernes 10 PM', 'en vivo'], [String(Date.parse('2026-12-31T20:00:00-05:00')), 'Cierre de la T1', '31/12'],
  [String(Date.parse('2027-01-01T11:00:00-05:00')), 'La gala', '1/1 11 AM']];
//: los festejos de verdad (el momento de drops_show.js), con lo que diría cada uno
const FESTEJOS = [
  ['Un día completo', { sub: 'Día 3 de 7', titulo: '¡Completaste el día!', lista: [{ txt: '500 Puntos de Tienda', small: 'Premio del día', tipo: 'pdt' }, { txt: '1 Star Dragon', small: 'Tu primera reacción', tipo: 'star' }], nota: 'Mañana: el Flight case', pal: { c: '#E41373', b1: '#FF5A9C', b2: '#2A0313' } }],
  ['La Caja del Nuevo', { sub: 'Día 7 de 7', titulo: '¡Terminaste tu primera semana!', lista: [{ txt: '5.000 Puntos de Tienda', small: 'Caja del Nuevo', tipo: 'pdt' }, { txt: '2 Star Dragons', small: 'Caja del Nuevo', tipo: 'star' }, { txt: 'Título «Recién llegado»', small: 'Caja del Nuevo', tipo: 'titulo' }], pal: { c: '#F5C542', b1: '#FFE07A', b2: '#7E4C00' } }],
  ['Un Drop', { sub: 'Pase de rapero', titulo: '¡Un Dragón Drop!', lista: [{ txt: 'Mixtape', small: 'Nivel 6 del Pase', tipo: 'drop' }], pal: { c: '#29B298', b1: '#5CE0C6', b2: '#04241D' } }],
];

/** «hace 3 min», «hace 2 h», «ayer», «hace 4 días» */
function haceCorto(t) {
  const s = Math.max(0, (ahoraReal() - t) / 1000);
  if (s < 60) return 'recién';
  if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
  const d = Math.floor(s / 86400);
  return d === 1 ? 'ayer' : 'hace ' + d + ' días';
}

/** Un interruptor: el estado de la pestaña `k` (sí/no) */
function Sw({ k, M, t }) {
  return <button type="button" role="switch" aria-checked={!!M[k]} aria-label={t} className={'md-sw' + (M[k] ? ' on' : '')} onClick={() => ponerMod(k, !M[k])} />;
}

/** Una tarjeta de «Probar sin gastar»: con interruptor si queda prendida, sin él si se dispara */
function Prueba({ t, d, k, M, children }) {
  return (
    <div className={'md-pc' + (k && M[k] ? ' on' : '')}>
      <div className="md-pc-h">
        <span><h3>{t} <i className="md-sello">de prueba</i></h3><p>{d}</p></span>
        {k ? <Sw k={k} M={M} t={t} /> : null}
      </div>
      {children ? <div className="md-ver">{children}</div> : null}
    </div>
  );
}

/** La lente: una fila de opciones donde una sola está elegida */
function Pildoras({ xs, val, al }) {
  return (
    <div className="md-pild" role="radiogroup">
      {xs.map(([v, t, sub]) => (
        <button key={v} type="button" role="radio" aria-checked={val === v} className={val === v ? 'on' : ''} onClick={() => al(v)}>{t}{sub ? <em>{sub}</em> : null}</button>
      ))}
    </div>
  );
}

/**
 * 👀 «ALGUIEN…» (sólo Dlx; la puerta la pone el Worker): lo de una persona, para mirar —su Pase, sus Puntos, sus piezas, sus
 * Drops sin abrir y sus últimos avisos—, para contestar «¿por qué no me llegó…?» sin pedirle una captura
 */
function Alguien({ liga }) {
  const [q, setQ] = useState('');
  const [x, setX] = useState(null);
  const [va, setVa] = useState(false);
  const tabla = (liga && liga.d && liga.d.tabla) || [];
  const deNombre = (t) => { const n = String(t || '').trim().toLowerCase(); const f = tabla.find((r) => String(r.n || '').toLowerCase() === n || r.k === n); return f ? f.k : n.replace(/[^a-z0-9._-]/g, ''); };
  const ver = () => {
    const k = deNombre(q);
    if (!k || va || !W.conCuenta) return;
    setVa(true);
    W.conCuenta('/api/avisos/mods', { que: 'alguien', k }).then((j) => { setVa(false); setX(j && j.ok ? j : { error: 1 }); }).catch(() => { setVa(false); setX({ error: 1 }); });
  };
  const P = x && x.pase, T = x && x.tienda;
  const nombre = x && x.k ? ((tabla.find((r) => r.k === x.k) || {}).n || x.k) : '';
  return (
    <div className="md-fila"><span className="lab">Alguien</span>
      <div className="md-alg">
        <form className="md-alg-f" onSubmit={(e) => { e.preventDefault(); ver(); }}>
          <input list="md-alg-l" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Su nombre en la Liga" aria-label="Ver lo de alguien" />
          <datalist id="md-alg-l">{tabla.slice(0, 400).map((r) => <option key={r.k} value={r.n} />)}</datalist>
          <button type="submit" className="btn borde2 chico" disabled={!q.trim() || va}>{va ? 'Buscando…' : 'Ver'}</button>
        </form>
        {x && x.error ? <p className="md-nota">No pude traerlo: prueba de nuevo en un rato.</p> : null}
        {x && x.sin_cuenta ? <p className="md-nota"><b>{nombre}</b> no entró nunca con Discord: no tiene Pase, Puntos ni avisos.</p> : null}
        {x && x.ok && !x.sin_cuenta ? (
          <div className="md-ficha">
            <p className="md-ficha-t"><b>{nombre}</b> <a href={'#/r/' + encodeURIComponent(x.k)}>Su perfil ›</a></p>
            <div className="md-ficha-n">
              <span><small>Pase</small><b>{P ? (P.miembro ? 'Nivel ' + P.nivel : 'Sin el rol') : '—'}</b><em>{P ? P.xp + ' XP' + (P.premium ? ' · Premium' : '') : ''}</em></span>
              <span><small>Puntos de Tienda</small><b>{T && T.saldo != null ? T.saldo.toLocaleString('es') : '—'}</b><em>{T ? T.piezas + (T.piezas === 1 ? ' pieza' : ' piezas') : ''}</em></span>
              <span><small>Drops sin abrir</small><b>{x.drops ? x.drops.cerrados : '—'}</b></span>
            </div>
            {P && (P.hoy.length || P.semana.length) ? <p className="md-ficha-l"><small>Sus Tareas</small>{[...P.hoy, ...P.semana].map((t) => (t.hecha ? '✓ ' : '') + t.t + ' (' + Math.min(t.lleva, t.meta) + '/' + t.meta + ')').join(' · ')}</p> : null}
            {(x.avisos || []).length ? (
              <ul className="md-ficha-av">{x.avisos.map((a, i) => <li key={i}><b>{a.titulo}</b><small>{haceCorto(a.t)}{a.visto ? ' · visto' : ' · sin ver'}</small></li>)}</ul>
            ) : <p className="md-nota">Sin avisos en su campana.</p>}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Lo que hiciste con Mods (este navegador), con su Deshacer */
function Hecho() {
  const H = useHistorialMods();
  // 🗂️ el registro del servidor (`socio_log`): lo de todos para Dlx, lo tuyo para el resto. Sin el Worker nuevo, no está
  const [reg, setReg] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (W.conCuenta) W.conCuenta('/api/avisos/mods', { que: 'registro' }).then((j) => { if (vivo && j && j.ok) setReg(j); }).catch(() => {});
    return () => { vivo = false; };
  }, [H.length]);
  const [va, setVa] = useState(0);
  const [err, setErr] = useState('');
  const deshacer = (x) => {
    if (va || !x.deshacer) return;
    setVa(x.t); setErr('');
    const D = x.deshacer;
    // 🪪 quién es quién, 📌 la fijada y 🎭 un evento de estilo (20/11/2026): cada uno vuelve atrás por su camino
    const p = D.tipo === 'muro' ? pedirStaff(D.sv, 'muro', 'mostrar', { pub: D.pub })
      : D.tipo === 'ident' ? pedirMods('ident', 'quitar', { id: D.id })
        : D.tipo === 'fijar' ? pedirMods('fijar', 'soltar')
          : D.tipo === 'estilo' ? (D.dlx ? pedirMods('estilo', 'quitar', { ids: D.ids }) : pedirStaff(D.sv, 'estilo', 'quitar', { id: (D.ids || [])[0] }))
            : pedirLlave(D.sv, 'corregir', { fix: D.fix });
    p.then((j) => {
      setVa(0);
      if (j && j.ok) deshechaMods(x.t); else setErr('No se pudo deshacer: prueba de nuevo en un rato.');
    }).catch(() => { setVa(0); setErr('No se pudo deshacer: prueba de nuevo en un rato.'); });
  };
  return (
    <section className="md-caja" aria-labelledby="md-hecho">
      <h3 id="md-hecho">Lo que hiciste con Mods</h3>
      {H.length ? (
        <ul className="md-log">
          {H.slice(0, 6).map((x) => (
            <li key={x.t}>
              <span><a href={x.ruta || '#/mods'}><b>{x.que}</b></a><small>{x.donde} · {haceCorto(x.t)}{x.deshecha ? ' · deshecho' : ''}</small></span>
              {x.deshacer && !x.deshecha ? <button type="button" className="md-link" disabled={!!va} onClick={() => deshacer(x)}>{va === x.t ? 'Deshaciendo…' : 'Deshacer'}</button> : null}
            </li>
          ))}
        </ul>
      ) : <p className="md-gris">Todavía nada. Lo que corrijas con los lápices sale acá, con su Deshacer.</p>}
      {err ? <p className="md-err" role="alert">{err}</p> : null}
      {/* (21/11/2026, G6#23) sin repetir «con su Deshacer», que ya dice la línea de arriba cuando no hay nada */}
      <p className="md-gris md-chico">Sólo lo de este navegador.</p>
      {reg && reg.items && reg.items.length ? (
        <>
          <h3 className="md-h3b">{reg.todo ? 'El registro del equipo' : 'Tu registro en la Liga'}</h3>
          <ul className="md-log">
            {reg.items.slice(0, 10).map((x, i) => (
              <li key={x.t + ':' + i}><span><b>{x.que}{x.despues ? ' · ' + x.despues : ''}</b><small>{[x.sv, reg.todo ? x.n || x.rol : '', haceCorto(x.t)].filter(Boolean).join(' · ')}</small></span></li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

export function ModsPagina({ liga, dc }) {
  usarCss('mods', CSS);
  const k = (liga && liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  const Q = useQuienMod(dc, k, 'mods');
  const M = useModsEstado();
  const owner = !!dc && String(dc.id) === DUENO;
  const [cayo, setCayo] = useState(false);
  // ✎ ¿corrige llaves y ligas de cualquier servidor? Dlx, o Admin y Moderador de la página (`liga`, el Worker lo dice)
  const [deLiga, setDeLiga] = useState(false);
  useEffect(() => {
    if (!dc) return undefined;
    let vivo = true;
    pedirRoles().then((r) => { if (vivo) setDeLiga(!!(r && (r.dlx || r.liga))); });
    return () => { vivo = false; };
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [horaElegir, setHoraElegir] = useState('');
  const ruta = useRuta();
  const [tab0, setTab0] = useState(() => { try { return ruta[1] || localStorage.getItem('lg:mods-tab') || 'corregir'; } catch (e) { return ruta[1] || 'corregir'; } });
  useEffect(() => { if (ruta[0] === 'mods' && ruta[1]) setTab0(ruta[1]); }, [ruta[0], ruta[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const boton = useBotonMods();
  const historial = useHistorialMods();
  if (!dc || !tieneMods(Q)) {
    return (
      <div className="md-pag">
        <span className="lab">Tus paneles</span><h1 className="md-h1">Mods</h1>
        <p className="md-gris">Mods es del equipo de la Liga y del staff de los servidores. {dc ? 'Tu cuenta no tiene nada para hacer acá.' : 'Entra con Discord para ver lo tuyo.'}</p>
      </div>
    );
  }
  const n = prendidosMods(M);
  const idioma = (l) => { try { W.location.href = W.location.pathname + '?lang=' + l + W.location.hash; } catch (e) { /* nada */ } };
  const en = (() => { try { return localStorage.getItem('lg:lang') === 'en'; } catch (e) { return false; } })();
  const drop = (i, e) => { setCayo(false); abrirDePrueba(e.currentTarget, i).catch(() => setCayo(true)); };
  // 🗂️ CUATRO PESTAÑAS (21/11/2026, la maqueta privada K3F14JmtDQvEYLMn6d2Pb9): en el celular la página medía 4.032 px y los
  // lápices quedaban a 2.780. Corregir primero; Mirar y Probar para quien los tiene; Registro con lo hecho y quién puede qué.
  // La pestaña va en la dirección (`#/mods/<pestaña>`, el panel de cada página lleva a Registro) y se recuerda
  const TABS = [['corregir', 'Corregir'], Q.owner || Q.admin ? ['mirar', 'Mirar'] : null, Q.owner ? ['probar', 'Probar'] : null, ['registro', 'Registro']].filter(Boolean);
  const tab = TABS.some(([x]) => x === tab0) ? tab0 : 'corregir';
  // 🗂️ el costado, sólo con algo hecho (21/11/2026, la revisión visual G6#6): con «Todavía nada» quedaba una caja de
  // 140 px y debajo cientos de px vacíos; ese «Todavía nada» ya vive en Registro
  const costado = tab !== 'registro' && (Q.owner || Q.admin) && historial.length > 0;
  const elegir = (x) => {
    setTab0(x);
    try { localStorage.setItem('lg:mods-tab', x); } catch (e) { /* sin almacenamiento */ }
    try { const r = '#/mods/' + x; history.replaceState(history.state, '', W.urlLG ? W.urlLG(r) : r); } catch (e) { /* queda la dirección */ }
  };
  const lenteSec = (Q.owner || Q.admin ? (
            <section className="md-sec" aria-labelledby="md-lente">
              <div className="md-sec-h"><h2 id="md-lente">Cómo ves la página</h2><small>sólo cambia lo que ves</small></div>
              <div className="md-lente">
                <div className="md-fila"><span className="lab">Ver como</span>
                  <Pildoras xs={[['', owner ? 'Tú · Owner' : 'Tú · Admin'], ['usuario', 'Un usuario'], ['sincuenta', 'Sin cuenta']]} val={M.vista || ''} al={(v) => ponerMod('vista', v)} />
                </div>
                {owner ? (
                  <div className="md-fila"><span className="lab">La hora</span>
                    <div className="md-hora">
                      <Pildoras xs={HORAS()} val={M.hora && HORAS().some(([v]) => v === String(M.hora)) ? String(M.hora) : M.hora ? 'otra' : ''} al={(v) => ponerMod('hora', v ? Number(v) : '')} />
                      <label className="md-elegir"><span>Elegir</span><input type="datetime-local" value={horaElegir} onChange={(e) => setHoraElegir(e.target.value)} aria-label="Elegir día y hora (hora del este)" />
                        <button type="button" className="btn borde2 chico" disabled={!horaElegir} onClick={() => ponerMod('hora', Date.parse(horaElegir + ':00-05:00'))}>Ir</button></label>
                    </div>
                    {M.hora ? <p className="md-nota md-hora-n">La página corre desde el <b>{horaMods(M.hora)}</b> (hora del este). Lo que viene del servidor sigue siendo de ahora: los datos, los eventos y lo en vivo.</p> : null}
                  </div>
                ) : null}
                {owner ? <Alguien liga={liga} /> : null}
                <div className="md-fila"><span className="lab">Idioma</span>
                  <Pildoras xs={[['es', 'Español'], ['en', 'English']]} val={en ? 'en' : 'es'} al={(v) => { if ((v === 'en') !== en) idioma(v); }} />
                </div>
                <p className="md-nota"><b>Los botones siguen siendo tuyos.</b> Si tocas algo mirando como un usuario o sin cuenta, lo haces tú. Para volver, la franja de arriba.</p>
              </div>
            </section>
          ) : null);
  const pruebaSec = (Q.owner ? (
            <section className="md-sec" aria-labelledby="md-prueba">
              <div className="md-sec-h"><h2 id="md-prueba">Probar sin gastar</h2><small>no se compra ni se guarda nada</small></div>
              <div className="md-prueba">
                <Prueba t="Tener todo" k="prueba" M={M} d="En la Tienda y en tu Inventario: todas las piezas y todos los efectos de carta como tuyos, para ponértelos y verlos puestos.">
                  <a className="btn borde2 chico" href="#/tienda">Ir a la Tienda</a>
                  <a className="btn borde2 chico" href="#/inventario">Ir al Inventario</a>
                </Prueba>
                <Prueba t="Dinero de prueba" k="dinero" M={M} d="Puntos de Tienda que no se terminan: compras y te lo pones. Al apagarlo, todo vuelve a como estaba.">
                  <span className="md-wallet"><b>∞</b><small>Puntos de prueba<br />los tuyos de verdad, quietos</small></span>
                  <a className="btn borde2 chico" href="#/tienda">Ir a la Tienda</a>
                </Prueba>
                <Prueba t="El Pase en otro nivel" k="pase" M={M} d="Tu Pase dibujado en el nivel que elijas: los premios, la pista y el CIELO de cada nivel.">
                  <label className="md-nivel"><span className="lab">Nivel</span>
                    <input type="range" min="1" max="50" value={Number(M.paseN) || 1} onChange={(e) => ponerMod('paseN', Number(e.target.value))} aria-label="Nivel del Pase" />
                    <b>{Number(M.paseN) || 1}</b></label>
                  <label className="md-check"><input type="checkbox" checked={!!M.paseP} onChange={(e) => ponerMod('paseP', e.target.checked)} /> Con Premium</label>
                  <a className="btn borde2 chico" href="#/pase">Ir al Pase</a>
                </Prueba>
                <Prueba t="Abrir un Dragón Drop" M={M} d="Eliges la rareza y miras la animación entera, sin gastar ni sumar nada.">
                  <div className="md-rz">{RAREZAS.map(([t, c], i) => <button key={t} type="button" onClick={(e) => drop(i, e)}><i style={{ background: c }} />{t}</button>)}</div>
                  {cayo ? <p className="md-err" role="alert">No se pudo abrir: prueba de nuevo.</p> : null}
                </Prueba>
                <Prueba t="Disparar un festejo" M={M} d="El momento de verdad, con lo que diría: para mirar la animación sin esperar a ganarlo.">
                  {FESTEJOS.map(([t, x]) => <button key={t} type="button" className="btn borde2 chico" onClick={(e) => abrirMomento(e.currentTarget, Object.assign({ botones: [{ txt: 'Listo', blanco: true }] }, x)).catch(() => setCayo(true))}>{t}</button>)}
                </Prueba>
                <Prueba t="Como alguien nuevo" M={M} d="La bienvenida y el tutorial, como los ve quien llega por primera vez.">
                  <a className="btn borde2 chico" href="#/bienvenida">Ver la bienvenida</a>
                  <button type="button" className="btn borde2 chico" onClick={() => pedirRecorrido()}>Hacer el tutorial</button>
                </Prueba>
              </div>
            </section>
          ) : null);
  return (
    <div className="md-pag">
      <div className="md-tit">
        <div>
          <span className="lab">Tus paneles</span>
          <h1 className="md-h1">Mods</h1>
          <p className="md-gris">{rolMods(Q)}. Lo que prendas sirve en esta pestaña hasta que lo apagues o la cierres{n ? ' (tienes ' + (n === 1 ? '1 cosa prendida' : n + ' cosas prendidas') + ')' : ''}. Cada uno ve sólo lo de su rol.</p>
        </div>
        {/* sin «Apagar todo» acá (21/11/2026, la revisión visual G6#23): con algo prendido ya está la franja magenta de
            arriba (mods.jsx), que lo tiene, y en el celular salía dos veces a 200 px */}
      </div>
      <div className={'md-grid' + (costado ? '' : ' uno')}>
        <div className="md-main">
          <div className="md-pes" role="tablist" aria-label="Partes de Mods">{TABS.map(([k1, t1]) => (
            <button key={k1} type="button" role="tab" aria-selected={tab === k1} className={tab === k1 ? 'on' : ''} onClick={() => elegir(k1)}>{t1}</button>
          ))}</div>
          {tab === 'corregir' ? <>
          {Q.owner || Q.admin || deLiga ? (
            <section className="md-sec" aria-labelledby="md-corregir">
              <div className="md-sec-h"><h2 id="md-corregir">Corregir de verdad</h2><small>queda anotado con tu nombre</small></div>
              <div className="md-lapices">
                <span className="md-lp-ic" aria-hidden="true">✎</span>
                <span><h3>Lápices para corregir</h3><p>Con esto prendido, sale un lápiz magenta en cada cosa que puedes corregir, en su propia página. Tocas, corriges y te queda el Deshacer.</p></span>
                <Sw k="lapices" M={M} t="Lápices para corregir" />
              </div>
              {/* 🛠️ el botón de Mods en cada página (21/11/2026, mods_herramientas.jsx): se esconde y se vuelve a prender acá */}
              <div className="md-lapices md-boton">
                <span className="md-lp-ic" aria-hidden="true"><Ico n="escudo" t={20} /></span>
                <span><h3>El botón Mods en cada página</h3><p>Arriba en la compu (al lado de la campana) y la M abajo a la derecha en el celular: lo que puedes hacer en la página donde estás, a un toque.</p></span>
                <button type="button" role="switch" aria-checked={boton} aria-label="El botón Mods en cada página" className={'md-sw' + (boton ? ' on' : '')} onClick={() => ponerBotonMods(!boton)} />
              </div>
              <div className="md-donde"><span className="lab">Dónde aparecen</span>
                {owner || deLiga ? <a className="md-fl" href="#/eventos"><span className="md-ic"><Ico n="eventos" t={18} /></span><span><h3>Cualquier llave</h3><p>En cada batalla: quién ganó, un nombre o «la llave no cuenta». Avisa qué cambia después en la llave.</p></span><i>›</i></a> : null}
                {owner || deLiga ? <a className="md-fl" href="#/ligas"><span className="md-ic"><Ico n="ligas" t={18} /></span><span><h3>Las ligas</h3><p>Al final de cada liga: quién ganó, una que no cuenta, cargar una batalla, un DF, un invitado o el campeón.</p></span><i>›</i></a> : null}
                {Q.admin ? <a className="md-fl" href="#/crews"><span className="md-ic"><Ico n="crews" t={18} /></span><span><h3>Las crews</h3><p>Sus Ajustes, rangos y pedidos, como su Líder.</p></span><i>›</i></a> : null}
                {Q.admin ? <a className="md-fl" href="#/competencias"><span className="md-ic"><Ico n="competencias" t={18} /></span><span><h3>Competencias</h3><p>Todas las llaves de la Copa y la Rapid, también donde no juegas.</p></span><i>›</i></a> : null}
                {owner || deLiga ? <a className="md-fl" href="#/publicaciones"><span className="md-ic"><Ico n="publicaciones" t={18} /></span><span><h3>Publicaciones</h3><p>Ocultar una publicación de cualquier servidor, o fijar una arriba: sale de titular por 3 días. Las dos, en la próxima vuelta del ciclo.</p></span><i>›</i></a> : null}
                {owner ? <a className="md-fl" href="#/ranking"><span className="md-ic"><Ico n="ranking" t={18} /></span><span><h3>Los perfiles</h3><p>Quién es quién, arriba de cada perfil: juntar a dos nombres que son la misma persona, o separarlos.</p></span><i>›</i></a> : null}
                {owner ? <a className="md-fl" href="#/eventos"><span className="md-ic"><Ico n="eventos" t={18} /></span><span><h3>Los eventos de estilo</h3><p>En cada evento: marcarlo de un estilo, como en tu Dashboard. Jugarlo da nivel en ese estilo.</p></span><i>›</i></a> : null}
                {owner ? <a className="md-fl" href="#/publicaciones"><span className="md-ic"><Ico n="publicaciones" t={18} /></span><span><h3>Los comentarios</h3><p>Borrar cualquier comentario, desde el comentario. Siempre, sin prender nada.</p></span><i>›</i></a> : null}
                {owner ? <a className="md-fl" href="#/socio"><span className="md-ic"><Ico n="servidor" t={18} /></span><span><h3>El panel de cualquier servidor</h3><p>Como su dueño: sus números, el bot y su equipo.</p></span><i>›</i></a> : null}
              </div>
            </section>
          ) : null}
          {Q.mod && !Q.admin ? (
            <section className="md-sec" aria-labelledby="md-moderar">
              <div className="md-sec-h"><h2 id="md-moderar">Moderar</h2><small>lo que reporta la gente</small></div>
              <a className="md-fl" href="#/dashboard"><span className="md-ic"><Ico n="tablero" t={18} /></span><span><h3>El Dashboard</h3><p>Las publicaciones y los perfiles reportados, y lo que espera que decidas.</p></span><i>›</i></a>
            </section>
          ) : null}
          {Q.socio && !Q.owner ? (
            <section className="md-sec" aria-labelledby="md-sv">
              <div className="md-sec-h"><h2 id="md-sv">Tu servidor</h2><small>estadísticas, el bot y tu equipo</small></div>
              <a className="md-fl" href="#/socio"><span className="md-ic"><Ico n="servidor" t={18} /></span><span><h3>El panel de tu servidor</h3><p>Y en las llaves de tu servidor, «Corregir» en cada una.</p></span><i>›</i></a>
            </section>
          ) : null}
            {!(Q.owner || Q.admin || deLiga) ? (
              <div className="md-lapices md-boton">
                <span className="md-lp-ic" aria-hidden="true"><Ico n="escudo" t={20} /></span>
                <span><h3>El botón Mods en cada página</h3><p>La M abajo a la derecha en el celular y el botón de arriba en la compu, donde hay algo para hacer.</p></span>
                <button type="button" role="switch" aria-checked={boton} aria-label="El botón Mods en cada página" className={'md-sw' + (boton ? ' on' : '')} onClick={() => ponerBotonMods(!boton)} />
              </div>
            ) : null}
          </> : null}
          {tab === 'mirar' ? lenteSec : null}
          {tab === 'probar' ? pruebaSec : null}
          {/* 🗂️ Registro a lo ancho (21/11/2026, la revisión visual: en la compu la columna de al lado quedaba vacía):
              lo hecho a la izquierda y «Quién puede qué» y los atajos a la derecha */}
          {tab === 'registro' ? <div className="md-reg">
            {Q.owner || Q.admin ? <Hecho /> : null}
          <div className="md-reg-d">
          <details className="md-caja">
            <summary><h3>Quién puede qué</h3><i aria-hidden="true">›</i></summary>
            <table className="md-mtz">
              <thead><tr><th /><th>Owner</th><th>Admin</th><th>Mod</th><th>Socio</th></tr></thead>
              <tbody>
                {[['Cómo ves la página', 1, 1, 0, 0], ['Probar sin gastar', 1, 0, 0, 0], ['Corregir llaves y ligas', 1, 1, 1, 2], ['Crews y Competencias', 1, 1, 0, 0], ['Ocultar publicaciones', 1, 1, 1, 2], ['Ver como alguien', 1, 0, 0, 0], ['El Dashboard', 1, 1, 1, 0], ['Su servidor', 1, 0, 0, 1]]
                  .map(([t, ...v]) => <tr key={t}><td>{t}</td>{v.map((x, i) => <td key={i}><span className={'md-pt' + (x === 2 ? ' m' : x ? '' : ' n')} aria-label={x === 2 ? 'sólo su servidor' : x ? 'sí' : 'no'} /></td>)}</tr>)}
              </tbody>
            </table>
            <p className="md-gris md-chico">● sí · ○ sólo en su servidor</p>
          </details>
          <details className="md-caja md-atajos">
            <summary><h3>Atajos</h3><i aria-hidden="true">›</i></summary>
            {Q.mod ? <a href="#/dashboard">El Dashboard <span>›</span></a> : null}
            {Q.socio || owner ? <a href="#/socio">{owner ? 'Los paneles de los servidores' : 'El panel de tu servidor'} <span>›</span></a> : null}
            {owner ? <a href="/mapa.html" target="_blank" rel="noopener">El mapa en vivo <span>↗</span></a> : null}
            <a href="#/cuenta">Tu cuenta <span>›</span></a>
          </details>
          </div>
          </div> : null}
        </div>
        {/* en la compu, lo que hiciste queda al costado (menos en Registro, que ya lo tiene); en el celular, en Registro */}
        {costado ? <aside className="md-costado"><Hecho /></aside> : null}
      </div>
    </div>
  );
}
