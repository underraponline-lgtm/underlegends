// 🐉 LOS DRAGÓN DROPS EN LA PÁGINA (12/11/2026). Dlx: «sorpresa… y cheto… como Brawl Stars pero con nuestra temática», y a
// la maqueta, «Sí, constrúyelos». La rareza y el premio los decide el objeto al abrir (`dropAbrir()` en bot/avisos.js):
// acá sólo se anima, toque a toque, hasta lo que salió. ⚠️ La animación no puede «mentir»: nunca muestra una rareza más
// alta que la que salió (sube hasta ella y se queda).
// - `useDrops(dc)`: los tuyos, la barra del día y la garantía (`/api/avisos/drops`, con tu sesión), una vez por visita.
// - `BarraDia`: el cuadro de la fila de arriba del Inicio (opción A de la maqueta: racha · campana o último evento · esto).
// - `AbrirDrops`: la ventana para abrirlos.
import { useEffect, useRef, useState } from 'react';
import { num } from './liga.js';
import { PopCab } from './pop.jsx';

const W = typeof window !== 'undefined' ? window : {};
const E = { d: null, va: false, oyen: new Set() };
const avisar = () => E.oyen.forEach((f) => f());

export function pedirDrops() {
  if (E.va || !W.conCuenta) return Promise.resolve(E.d);
  E.va = true;
  return W.conCuenta('/api/avisos/drops', {}).then((j) => {
    E.va = false;
    if (j && j.ok) { E.d = j; avisar(); }
    return E.d;
  }).catch(() => { E.va = false; return E.d; });
}

/** Tus drops y la barra del día (`null` mientras llega o sin cuenta) */
export function useDrops(dc) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!dc) return undefined;
    const f = () => setN((n) => n + 1);
    E.oyen.add(f);
    if (!E.d) pedirDrops();
    return () => { E.oyen.delete(f); };
  }, [!!dc]); // eslint-disable-line react-hooks/exhaustive-deps
  return dc ? E.d : null;
}

//: los colores de cada rareza (la misma escala de la maqueta)
export const COLOR_RZ = ['#9AA4B2', '#29B298', '#9B5CFF', '#FF4F93', '#F5C542'];
const ICONO_RZ = ['🪙', '⚡', '💿', '🏆', '🎤'];
const NOMBRES = ['Maqueta', 'Mixtape', 'Vinilo', 'Disco de Oro', 'Micrófono de Oro'];

/** 🐉 La barra del día, para la fila de arriba: los pasos de hoy y cuántos drops tienes para abrir */
export function BarraDia({ dc }) {
  const D = useDrops(dc);
  const dlg = useRef(null);
  // 🔓 el Premio gratis la abre (`lg:abrir-drops`), y votar todas las encuestas trae el cofre (`lg:cofre`): se vuelven a pedir
  useEffect(() => {
    const abrir = () => { pedirDrops(); if (dlg.current && !dlg.current.open) dlg.current.showModal(); };
    const cofre = () => { E.va = false; pedirDrops(); };
    W.addEventListener('lg:abrir-drops', abrir);
    W.addEventListener('lg:cofre', cofre);
    return () => { W.removeEventListener('lg:abrir-drops', abrir); W.removeEventListener('lg:cofre', cofre); };
  }, []);
  if (!dc) return null;
  const pasos = D ? D.dia.pasos : 0;
  const de = D ? D.dia.de : 6;
  const marcas = D ? D.dia.drops : [1, 3, 6];
  const cerrados = D ? D.cerrados.length : 0;
  const prox = marcas.find((m) => m > pasos);
  const texto = cerrados ? (cerrados === 1 ? 'Tienes un Dragón Drop para abrir' : 'Tienes ' + cerrados + ' Dragón Drops para abrir')
    : prox ? (prox - pasos === 1 ? 'Uno más y te ganas un Dragón Drop' : 'Te faltan ' + (prox - pasos) + ' para el próximo Dragón Drop')
      : 'Completaste la barra de hoy';
  return (
    <>
      <button type="button" className="pn-dia" onClick={() => { pedirDrops(); if (dlg.current) dlg.current.showModal(); }}
        aria-label={'Hoy: ' + pasos + ' de ' + de + '. ' + texto}>
        <span className="dd-huevo-m" aria-hidden="true">{cerrados ? <em>{cerrados}</em> : null}</span>
        <span className="pn-tx"><b>Hoy: {pasos} de {de}</b>
          <span className="dd-pasos" aria-hidden="true">{Array.from({ length: de }, (_, i) => (
            <i key={i} className={(i < pasos ? 'si' : '') + (marcas.includes(i + 1) ? ' drop' : '')} />))}</span>
          <small>{texto}</small></span>
      </button>
      <dialog className="pn-pop dd-pop" ref={dlg} aria-label="Dragón Drops" onClick={(e) => { if (e.target === dlg.current) dlg.current.close(); }}>
        <AbrirDrops D={D} cerrar={() => dlg.current && dlg.current.close()} />
      </dialog>
    </>
  );
}

/** 🐉 La ventana: abrir uno a toques, la barra de hoy, las probabilidades, la garantía y lo último que abriste */
export function AbrirDrops({ D, cerrar }) {
  const [res, setRes] = useState(null);   // lo que salió (del objeto)
  const [toques, setToques] = useState(0);
  const [nivel, setNivel] = useState(0);   // la rareza que se muestra mientras se abre
  const [msg, setMsg] = useState('');
  const [tiembla, setTiembla] = useState(0);
  const pidiendo = useRef(false);
  const hechos = useRef(new Set());   // los que ya abriste en esta ventana (la lista nueva tarda un momento)
  if (!D) return <div className="dd-in"><p className="dd-nota">Cargando tus drops…</p></div>;
  const cerrados = (D.cerrados || []).filter((x) => !hechos.current.has(x.id) || (res && x.id === res.id));
  const actual = res ? cerrados.find((x) => x.id === res.id) || { id: res.id } : cerrados[0];
  const quedan = cerrados.filter((x) => !res || x.id !== res.id).length;
  const listo = res && toques >= 3;
  const tocar = async () => {
    if (!actual || listo || pidiendo.current) return;
    setTiembla((n) => n + 1);
    let r = res;
    if (!r) {
      pidiendo.current = true;
      const j = W.conCuenta ? await W.conCuenta('/api/avisos/drop-abrir', { id: actual.id }) : null;
      pidiendo.current = false;
      if (!j || !j.ok) { setMsg('No se pudo abrir: prueba de nuevo.'); return; }
      r = j;
      hechos.current.add(j.id);
      setRes(j);
    }
    const t = toques + 1;
    // sube a toques hasta la que salió: nunca más alto
    setNivel(t >= 3 ? r.rareza : Math.min(r.rareza, Math.max(nivel, Math.round((r.rareza * t) / 3))));
    setToques(t);
    if (t >= 3) pedirDrops();
  };
  const otro = () => { setRes(null); setToques(0); setNivel(0); setMsg(''); };
  // la rareza que se muestra antes de abrir: nunca menos que la mínima de ese drop (el primero del cofre sale desde Vinilo)
  const nv = listo ? res.rareza : Math.max(nivel, (actual && actual.min) || 0);
  const c = COLOR_RZ[nv];
  const tot = (D.rarezas || []).reduce((s, x) => s + x[1], 0) || 1;
  return (
    <div className="dd-in">
      <PopCab ico="premio" t="Dragón Drops" sub="Cofres sorpresa de la Liga: se abren a toques" cerrar={cerrar} />
      <div className="dd-cuerpo">
        <div className="dd-escena" style={{ '--c': c }}>
          <div className="dd-rayos" aria-hidden="true" />
          {actual || listo ? <span className="dd-rz">{NOMBRES[nv]}{!listo && actual && actual.min ? ' o más' : ''}</span> : null}
          {listo ? (
            <div className="dd-premio">
              <span className="dd-ficha">{ICONO_RZ[res.rareza]}</span>
              {res.titulo ? <b>Título «{res.titulo}»</b> : null}
              {res.puntos ? <b>+{num(res.puntos)} Puntos de Tienda</b> : null}
              <small>{NOMBRES[res.rareza]}</small>
              {quedan ? <button type="button" className="btn verde chico" onClick={otro}>Abrir otro ({quedan})</button>
                : <button type="button" className="btn borde2 chico" onClick={cerrar}>Listo</button>}
            </div>
          ) : actual ? (
            <>
              {/* 🎁 los del cofre de las encuestas se ven como cofre (origen `cofre:`, ver `cofreEncuestas()` en bot/avisos.js) */}
              {/^cofre:/.test(String(actual.origen || '')) ? <span className="dd-cofre-et">Cofre de las encuestas</span> : null}
              <button type="button" key={tiembla} className={'dd-huevo' + (/^cofre:/.test(String(actual.origen || '')) ? ' cofre' : '') + (tiembla ? ' tiembla' : '') + (toques >= 2 ? ' grietas' : '')}
                onClick={tocar} aria-label="Tocar el drop"><span>UL</span></button>
              <span className="dd-toques">{toques ? 'Toca ' + (3 - toques) + (3 - toques === 1 ? ' vez más' : ' veces más') : 'Tócalo 3 veces'}</span>
            </>
          ) : (
            <p className="dd-vacio">No tienes drops para abrir.<br />Sigue la barra del día: drop en el paso 1, el 3 y el 6.</p>
          )}
          {msg ? <small className="dd-msg" role="alert">{msg}</small> : null}
        </div>
        <section className="dd-lado">
          <h5>Hoy <small>{D.dia.pasos} de {D.dia.de}</small></h5>
          <ul className="dd-hoy">{Object.entries(D.que || {}).map(([k, t]) => (
            <li key={k} className={D.dia.hechos.includes(k) ? 'si' : ''}><i aria-hidden="true">{D.dia.hechos.includes(k) ? '✓' : ''}</i>{t}</li>))}</ul>
          <h5>Las rarezas</h5>
          <ul className="dd-rzs">{(D.rarezas || []).map(([n, p], i) => (
            <li key={n} style={{ '--c': COLOR_RZ[i] }}><i aria-hidden="true" /><b>{n}</b><strong>{(Math.round((1000 * p) / tot) / 10).toLocaleString('es')} %</strong></li>))}</ul>
          <p className="dd-nota">Cada {D.garantia} drops sin un Micrófono de Oro, el siguiente lo es seguro. Llevas <b>{D.sin}</b>.</p>
          {(D.abiertos || []).length ? (
            <><h5>Lo último que abriste</h5>
              <ul className="dd-ult">{D.abiertos.slice(0, 6).map((x) => (
                <li key={x.id} style={{ '--c': COLOR_RZ[x.rareza] || '#9AA4B2' }}><i aria-hidden="true" />
                  <span>{x.titulo ? 'Título «' + x.titulo + '»' : '+' + num(x.puntos) + ' Puntos'}</span><small>{NOMBRES[x.rareza] || ''}</small></li>))}</ul></>
          ) : null}
        </section>
      </div>
    </div>
  );
}
