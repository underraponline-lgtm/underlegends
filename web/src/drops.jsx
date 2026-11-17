// 🐉 LOS DRAGÓN DROPS EN LA PÁGINA (12/11/2026). Dlx: «sorpresa… y cheto… como Brawl Stars pero con nuestra temática», y a
// la maqueta, «Sí, constrúyelos». La rareza y el premio los decide el objeto al abrir (`dropAbrir()` en bot/avisos.js):
// acá sólo se anima, toque a toque, hasta lo que salió. ⚠️ La animación no puede «mentir»: nunca muestra una rareza más
// alta que la que salió (sube hasta ella y se queda).
// - `useDrops(dc)`: los tuyos, la barra del día y la garantía (`/api/avisos/drops`, con tu sesión), una vez por visita.
// - `BarraDia`: el cuadro de la fila de arriba del Inicio (opción A de la maqueta: racha · campana o último evento · esto).
// - `AbrirDrops`: la ventana con los que tienes para abrir. Elegir uno abre el escenario a pantalla completa
//   (drops_show.js, 17/11/2026: la maqueta de las tres animaciones y los cinco cofres), con los demás en fila detrás.
//   El escenario se baja aparte, la primera vez que abres la ventana: el Inicio no lo carga.
import { useEffect, useRef, useState } from 'react';
import { num } from './liga.js';
import { PopCab } from './pop.jsx';
import { usarCss } from './css.js';
import CSS_DROPS from './css/drops_show.css?inline';

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

//: los colores de cada rareza (la misma escala de la maqueta). La sexta, el Disco de Diamante, sólo sale del Nido
export const COLOR_RZ = ['#9AA4B2', '#29B298', '#9B5CFF', '#FF4F93', '#F5C542', '#BFF4FF'];
const NOMBRES = ['Maqueta', 'Mixtape', 'Vinilo', 'Disco de Oro', 'Micrófono de Oro', 'Disco de Diamante'];
//: los cofres de `cofre5:<t>:`, por si `cofres` todavía no llegó del objeto (el nombre bueno viene de ahí)
const COFRES = ['Cajón de discos', 'Flight case', 'Baúl de los objetos', 'Funda del Campeón', 'Tesoro del Dragón'];
const COLOR_COFRE = ['#D08C4A', '#8FA3B8', '#F5C542', '#E41373', '#BFF4FF'];

//: el escenario y su CSS: el CSS va con la ventana (la lista lo usa) y el escenario se pide al abrirla, así el primer
//: toque no espera la descarga
function preparar() {
  usarCss('drops-show', CSS_DROPS);
  return import('./drops_show.js');
}

/** Qué es cada cerrado: el `tipo` del objeto o, si no viene, el prefijo de su `origen` (ver el contrato) */
function queEs(x) {
  const o = String(x.origen || '');
  let tipo = x.tipo, t = x.cofre;
  const m = /^cofre5:(\d+):/.exec(o);
  if (!tipo) tipo = /^star:/.test(o) ? 'star' : /^nido:/.test(o) ? 'nido' : m ? 'cofre' : 'drop';
  if (tipo === 'cofre' && (t == null || t === '')) t = m ? Number(m[1]) : 0;
  return { ...x, tipo, cofre: tipo === 'cofre' ? Math.max(0, Math.min(4, Number(t) || 0)) : x.cofre };
}
/** Cómo se llama en la lista: el tipo (o el nombre del cofre) y una línea de qué trae */
function filaDe(x, D) {
  const min = Math.max(0, Math.min(5, Number(x.min) || 0));
  if (x.tipo === 'cofre') {
    const c = (D.cofres || [])[x.cofre] || {};
    const k = Array.isArray(c.drops) ? c.drops.length : 0;
    const sub = k ? 'Trae ' + (k === 1 ? '1 drop' : k + ' drops') + (c.puntos ? ' + ' + num(c.puntos) + ' Puntos' : '') : 'Cofre · 3 candados';
    return { nombre: c.n || COFRES[x.cofre], sub, color: COLOR_COFRE[x.cofre] };
  }
  if (x.tipo === 'star') return { nombre: 'Star Dragon', sub: 'De ' + NOMBRES[Math.max(2, min)] + ' para arriba', color: '#5CC8FF' };
  if (x.tipo === 'nido') {
    const d = Math.max(1, min);
    return { nombre: 'Nido de dragón', sub: 'Desde ' + NOMBRES[d] + ' · se puede partir', color: COLOR_RZ[d] };
  }
  // 🎁 los del cofre de las encuestas y del tutorial siguen siendo drops (origen `cofre:`, ver `cofreEncuestas()`)
  const o = String(x.origen || '');
  const de = /^cofre:nuevo:/.test(o) ? 'Del tutorial completo' : /^cofre:/.test(o) ? 'Del cofre de las encuestas' : '';
  const rz = min ? 'desde ' + NOMBRES[min] : 'al azar';
  return { nombre: 'Dragón Drop', sub: de ? de + ' · ' + rz : rz.charAt(0).toUpperCase() + rz.slice(1), color: COLOR_RZ[min] };
}

/** 🐉 La barra del día, para la fila de arriba: los pasos de hoy y cuántos drops tienes para abrir */
export function BarraDia({ dc }) {
  const D = useDrops(dc);
  const dlg = useRef(null);
  const abrirVentana = () => {
    pedirDrops();
    preparar().catch(() => {});
    if (dlg.current && !dlg.current.open) dlg.current.showModal();
  };
  // 🔓 el Premio gratis la abre (`lg:abrir-drops`), y votar todas las encuestas trae el cofre (`lg:cofre`): se vuelven a pedir
  useEffect(() => {
    const abrir = () => abrirVentana();
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
      <button type="button" className="pn-dia" onClick={abrirVentana}
        aria-label={'Hoy: ' + pasos + ' de ' + de + '. ' + texto}>
        <span className="dd-huevo-m" aria-hidden="true">{cerrados ? <em>{cerrados}</em> : null}</span>
        <span className="pn-tx"><i className="pn-dia-et">Dragón Drops</i><b>Hoy: {pasos} de {de}</b>
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

/** 🐉 La ventana: los que tienes para abrir, la barra de hoy, las probabilidades, la garantía y lo último que abriste */
export function AbrirDrops({ D, cerrar }) {
  const caja = useRef(null);
  const hechos = useRef(new Set());   // los que ya abriste (la lista nueva tarda un momento en llegar)
  const abierto = useRef(false);
  const [, setN] = useState(0);
  const [msg, setMsg] = useState('');
  if (!D) return <div className="dd-in"><p className="dd-nota" style={{ padding: 16 }}>Cargando tus drops…</p></div>;
  const cerrados = (D.cerrados || []).filter((x) => x && !hechos.current.has(x.id)).map(queEs);
  const marcas = (D.dia && D.dia.drops) || [1, 3, 6];
  // abre el elegido a pantalla completa, con los demás en fila detrás («Abrir otro» en el resumen)
  const abrirUno = (i) => {
    if (abierto.current) return;
    abierto.current = true;
    setMsg('');
    const cola = [cerrados[i], ...cerrados.filter((_, k) => k !== i)];
    preparar().then(({ mostrarDrops }) => {
      const el = caja.current;
      const raiz = el && el.getRootNode ? el.getRootNode() : null;
      // el shadow root de la página: ahí vale su CSS (y un <dialog> modal se dibuja encima de esta ventana igual)
      const host = typeof ShadowRoot !== 'undefined' && raiz instanceof ShadowRoot ? raiz : document.body;
      mostrarDrops(host, cola, {
        cofres: D.cofres,
        abrir: (id) => (W.conCuenta ? W.conCuenta('/api/avisos/drop-abrir', { id }) : Promise.resolve(null)).then((j) => {
          if (j && j.ok) hechos.current.add(id);
          return j;
        }),
        alCerrar: () => { abierto.current = false; setN((n) => n + 1); E.va = false; pedirDrops(); },
      });
    }).catch(() => { abierto.current = false; setMsg('No se pudo cargar: prueba de nuevo.'); });
  };
  const tot = (D.rarezas || []).reduce((s, x) => s + x[1], 0) || 1;
  return (
    <div className="dd-in" ref={caja}>
      <PopCab ico="premio" t="Dragón Drops" sub="Cofres sorpresa de la Liga: se abren a toques" cerrar={cerrar} />
      <div className="dd-cuerpo">
        <section className="dsw-caja" aria-label="Para abrir">
          <h5 className="dsw-caja-t">Para abrir {cerrados.length ? <small>{cerrados.length === 1 ? '1 drop' : cerrados.length + ' drops'}</small> : null}</h5>
          {cerrados.length ? (
            <ul className="dsw-lista">{cerrados.map((x, i) => {
              const f = filaDe(x, D);
              return (
                <li key={x.id}>
                  <button type="button" className="dsw-li" style={{ '--c': f.color }} onClick={() => abrirUno(i)} aria-label={'Abrir: ' + f.nombre + '. ' + f.sub}>
                    <i className={'dsw-li-ic dsw-li-' + x.tipo} aria-hidden="true" />
                    <span className="dsw-li-tx"><b>{f.nombre}</b><small>{f.sub}</small></span>
                    <em className="dsw-li-ab" aria-hidden="true">Abrir</em>
                  </button>
                </li>
              );
            })}</ul>
          ) : (
            <p className="dsw-vacio">No tienes drops para abrir.<br />Sigue la barra del día: drop en el paso {marcas.slice(0, -1).join(', el ')}{marcas.length > 1 ? ' y el ' : ''}{marcas[marcas.length - 1]}.</p>
          )}
          {msg ? <p className="dsw-msg" role="alert">{msg}</p> : null}
        </section>
        <section className="dd-lado">
          <h5>Hoy <small>{D.dia.pasos} de {D.dia.de}</small></h5>
          <ul className="dd-hoy">{Object.entries(D.que || {}).map(([k, t]) => (
            <li key={k} className={D.dia.hechos.includes(k) ? 'si' : ''}><i aria-hidden="true">{D.dia.hechos.includes(k) ? '✓' : ''}</i>{t}</li>))}</ul>
          <h5>Las rarezas</h5>
          <ul className="dd-rzs">{(D.rarezas || []).map(([n, p], i) => (
            <li key={n} style={{ '--c': COLOR_RZ[i] }}><i aria-hidden="true" /><b>{n}</b><strong>{(Math.round((1000 * p) / tot) / 10).toLocaleString('es')} %</strong></li>))}</ul>
          <p className="dd-nota">Cada {D.garantia} drops sin un Micrófono de Oro, el siguiente lo es seguro. Llevas <b>{D.sin}</b>.</p>
          {/* 🧢 el tope suave de la semana (17/11/2026): lo que pasa de 10.000 en drops va a la mitad (`conTope()` en bot/avisos.js) */}
          {D.semana ? <p className="dd-nota">Esta semana llevas <b>{num(D.semana.cobrado)}</b> de {num(D.semana.de)} Puntos completos. Lo que pase de ahí va a la mitad, y se renueva el lunes.</p> : null}
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
