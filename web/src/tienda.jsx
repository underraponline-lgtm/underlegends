// 🛒 LA TIENDA, NUEVA (03/10/2026, la tanda 2 del plan: «1. A»). Lo mismo que tenían en app.js, con el estilo
// de las páginas nuevas: la Tienda con tus Puntos de Tienda y el precio por cabeza (la tienda en sí todavía no vende
// nada: dice que abre pronto). El Pase vivió acá como cartel «Próximamente» hasta el 05/10/2026: hoy es `pase.jsx`.
// ⚠️ LA PLATA LA SIGUE MANEJANDO APP.JS: la billetera (`BILL`, `pedirBilletera()`), lo que vale cada cabeza
// (`valorCabezas()`), poner un precio (`ponerPrecio()`, con su vuelta de Discord) y sus errores (`errorPrecio()`). Cada vez
// que algo de eso cambia, `pintaPrecios()` avisa `lg:precios` (App.jsx) y esto se redibuja. Los números son de
// `D.tienda` (bot/precios.py): ninguno se escribe acá. Afuera se ve cuánto vale cada cabeza, nunca quién puso.
import { useEffect, useState } from 'react';
import { limpio, norm, num } from './liga.js';
import { Bandera, Cara, DosToques } from './piezas.jsx';

const sinEtiquetas = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
function usePrecios() {
  const [, setV] = useState(0);
  useEffect(() => {
    const f = () => setV((x) => x + 1);
    window.addEventListener('lg:precios', f);
    return () => window.removeEventListener('lg:precios', f);
  }, []);
}
const valores = () => (typeof window.valorCabezas === 'function' ? window.valorCabezas() : {});

// ── tus Puntos de Tienda: sólo los ves vos, con tu Discord ──
function Billetera({ liga, dc }) {
  const T = liga.d.tienda;
  const B = window.BILL;
  const ahora = Date.now();
  const pedir = () => { if (typeof window.pedirBilletera === 'function') window.pedirBilletera(true); };
  if (B && B.ok) {
    const act = (B.mios || []).filter((m) => !m.estado && m.fin > ahora);
    return (
      <div className="ti-bill">
        <small>TUS PUNTOS DE TIENDA</small>
        <b className="ti-saldo">{num(B.saldo)}</b>
        {B.cobrado ? <p>Cobraste <b>{num(B.cobrado)}</b> cazando.</p> : null}
        {act.length ? (
          <div className="ti-mios">
            <p>Tus precios de esta semana (vuelven si nadie caza):</p>
            <ul>{act.map((m, i) => <li key={i}>{limpio((liga.fila(m.cabeza) || {}).n || m.cabeza)} · <b>{num(m.monto)}</b></li>)}</ul>
          </div>
        ) : null}
      </div>
    );
  }
  if (B && B.error) {
    const e = (typeof window.errorCuenta === 'function' && window.errorCuenta(B.error))
      || (B.error === 'todavia' ? 'La tienda todavía no está lista: probá en un rato.' : 'No pude leer tus Puntos. Probá de nuevo.');
    return (
      <div className="ti-bill">
        <small>TUS PUNTOS DE TIENDA</small>
        <p className="ti-mal">{e}</p>
        <button type="button" className="btn borde chico" onClick={pedir}>Probar de nuevo</button>
      </div>
    );
  }
  // con la cuenta ya abierta, app.js los está pidiendo (al abrir la Tienda): un momento
  if (dc) {
    return <div className="ti-bill"><small>TUS PUNTOS DE TIENDA</small><p>Buscando los tuyos…</p></div>;
  }
  return (
    <div className="ti-bill">
      {/* sin la cuenta, el número no es «tuyo»: es con cuánto arranca cada uno */}
      <small>TODOS ARRANCAN CON</small>
      <b className="ti-saldo">{num(T.inicial)}</b>
      <p>Para ver los tuyos entrás con Discord: los ves sólo vos.</p>
      <button type="button" className="btn verde chico" onClick={pedir}>Ver mis Puntos</button>
    </div>
  );
}

// ── una cabeza: su cara, su nombre y cuánto vale ──
function Fila({ liga, n, v, on, onSel }) {
  const f = liga.fila(n);
  return (
    <button type="button" className={'ti-c' + (on ? ' on' : '')} aria-expanded={on} onClick={onSel}>
      <Cara liga={liga} k={f ? f.k : ''} nombre={f ? f.n : n} cls="ti-cara" />
      <span className="ti-n">{limpio(f ? f.n : n)}</span>
      {f && f.cc ? <Bandera cc={f.cc} cls="ti-flag" /> : null}
      <span className={'ti-v' + (v ? '' : ' sin')}>{v ? num(v) : 'ponerle precio'}</span>
    </button>
  );
}

// ── ponerle precio a alguien: cuánto vale, los montos y cómo salió (`panelPrecio()` de app.js) ──
function Panel({ liga, n, dc }) {
  const T = liga.d.tienda;
  const v = valores()[n] || 0;
  const est = (window.PR_EST || {})[n] || {};
  const saldo = window.BILL && window.BILL.ok ? window.BILL.saldo : null;
  const queda = T.tope - v;
  const f = liga.fila(n);
  const esYo = !!(f && liga.yo && liga.yo.k === f.k);
  const msg = est.va ? 'Poniendo ' + num(est.va) + '…'
    : est.ok ? '✓ Pusiste ' + num(est.ok) + '. Si nadie lo caza en la semana, vuelven a vos.'
      : est.error ? sinEtiquetas(typeof window.errorPrecio === 'function' ? window.errorPrecio(est) : 'No pude ponerlo.')
        : dc ? 'Elegí cuánto ponerle.' : 'Para poner un precio entrás con Discord: tocá un monto.';
  return (
    <div className="ti-panel">
      <p><b>{limpio(f ? f.n : n)}</b> vale <span className="ti-pv">{num(v)}</span>
        {v < T.tope ? <> · se le pueden poner {num(queda)} más</> : <> · ya vale lo máximo</>}</p>
      {esYo ? <p className="ti-nota">Sos vos: no te podés poner precio.</p> : (
        <>
          <div className="ti-montos">
            {[1, 2, 5, 10].map((x) => T.min * x).map((m) => (
              <DosToques key={m} className="btn borde2 chico" disabled={m > queda || (saldo != null && m > saldo) || !!est.va}
                confirmar={'¿' + num(m) + '? Tocá de nuevo'} onClick={() => window.ponerPrecio(n, m)}>+{num(m)}</DosToques>
            ))}
          </div>
          <p className={'ti-msg' + (est.error ? ' mal' : '')} aria-live="polite">{msg}</p>
        </>
      )}
      {f ? <a className="ti-perfil" href={'#/r/' + encodeURIComponent(f.k)}>Ver su perfil</a> : null}
    </div>
  );
}

export function Tienda({ liga, dc }) {
  usePrecios();
  const T = liga.d.tienda;
  // la elegida y en qué lista (la de la semana o la búsqueda): una cabeza puede estar en las dos, y el panel iba doble
  const [sel, setSel] = useState({ n: '', d: '' });
  const [q, setQ] = useState('');
  // con la cuenta abierta, tus Puntos: app.js los pide al abrir la Tienda, pero si la página llegó antes que los datos
  // no los había pedido (y quedaba «Buscando los tuyos…»)
  useEffect(() => {
    if (dc && !window.BILL && typeof window.pedirBilletera === 'function') window.pedirBilletera(false);
  }, [dc && dc.id]);
  if (!T || typeof window.ponerPrecio !== 'function') {
    return (
      <section className="sec ti-sec">
        <div className="sec-t"><h2>La tienda</h2></div>
        <p className="pronto-p">La tienda todavía no está lista: probá en un rato.</p>
      </section>
    );
  }
  const v = valores();
  // a quién se le puede poner precio: a quien juega la temporada y no es fuera de concurso (lo mismo que el Worker)
  const puede = (n) => (liga.d.tabla || []).some((x) => x.n === n && !x.fc);
  const top = Object.keys(v).filter((c) => v[c] > 0 && puede(c)).sort((a, b) => v[b] - v[a]);
  const qq = norm(q).trim();
  const res = qq ? (liga.d.tabla || []).filter((x) => !x.fc && norm(x.n).includes(qq)).slice(0, 8) : [];
  const elegir = (n, d) => setSel((s) => (s.n === n && s.d === d ? { n: '', d: '' } : { n, d }));
  const cazas = (T.cazas || []).slice().reverse();
  const lista = (ns, d) => ns.map((n) => (
    <li key={n}>
      <Fila liga={liga} n={n} v={v[n] || 0} on={sel.n === n && sel.d === d} onSel={() => elegir(n, d)} />
      {sel.n === n && sel.d === d ? <Panel liga={liga} n={n} dc={dc} /> : null}
    </li>
  ));
  return (
    <>
      <div className="escena ti-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.9, '--mo-c2': '#29B298' }}>
        <section className="rk-cab ti-cab">
          <div className="rk-tx">
            <span className="tag">LA TIENDA · {liga.temp}</span>
            <h1 className="hero-ev">Tienda</h1>
            <p className="hero-p">Los Puntos de Tienda van aparte del ranking: todos arrancan con <b>{num(T.inicial)}</b> y se ganan cazando —todo el precio por cabeza{T.mw ? <>, y el <b>{Math.round(T.mw * 100)} %</b> de lo que pagan los buscados del Most Wanted</> : null}—. Hoy sirven para ponerle precio a una cabeza; la tienda en sí abre pronto.</p>
          </div>
          <Billetera liga={liga} dc={dc} />
        </section>
      </div>

      <section className="sec ti-sec">
        <div className="sec-t"><h2>Precio por cabeza</h2><span className="ti-hasta">hasta {liga.dia(T.fin)}</span></div>
        <ol className="ti-pasos">
          <li><b>1</b><span>Ponés Puntos de Tienda sobre un rapero de la temporada.</span></li>
          <li><b>2</b><span>El primero que le gana en un evento de la Liga se los lleva, <b>y lo mismo suma a su Temporada</b>.</span></li>
          <li><b>3</b><span>Si nadie lo caza en la semana, vuelven a quien los puso.</span></li>
        </ol>
        <p className="ti-nota">Una cabeza vale como mucho <b>{num(T.tope)}</b>, y nadie ve quién puso.</p>

        {/* en la compu, a dos columnas: las cabezas de la semana a la izquierda y buscar y lo cobrado a la derecha (a una sola
            quedaba media pantalla en blanco) */}
        <div className="ti-dos"><div>
        <h3 className="ti-h">Las cabezas de esta semana<small>{top.length || ''}</small></h3>
        {top.length ? <ul className="ti-lista">{lista(top, 'top')}</ul>
          : <p className="ti-nota">Esta semana todavía nadie tiene precio. Buscá a alguien y ponele el primero.</p>}
        </div><div>
        <h3 className="ti-h">Ponerle precio a alguien</h3>
        <input type="search" className="ti-busca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscá a quién"
          aria-label="Buscar un rapero para ponerle precio" enterKeyHint="search" />
        {qq ? (res.length ? <ul className="ti-lista">{lista(res.map((x) => x.n), 'res')}</ul>
          : <p className="ti-nota">No hay nadie con ese nombre en la temporada.</p>) : null}

        {cazas.length ? (
          <>
            <h3 className="ti-h">Lo último que se cobró</h3>
            <ul className="ti-cazas">
              {cazas.map((x, i) => (
                <li key={i}>💰 <b>{x.por.map((y) => limpio((liga.fila(y[0]) || {}).n || y[0])).join(' y ')}</b>{x.por.length > 1 ? ' le ganaron a ' : ' le ganó a '}<b>{limpio((liga.fila(x.cabeza) || {}).n || x.cabeza)}</b> en {limpio(x.ev)}{x.por.length > 1 ? ' y cobraron ' : ' y cobró '}<b>{num(x.monto)}</b>.</li>
              ))}
            </ul>
          </>
        ) : null}
        </div></div>
      </section>

      <section className="sec ti-sec">
        <div className="ti-pronto">
          <span className="tag">PRÓXIMAMENTE</span>
          <h2>La tienda abre pronto</h2>
          <p>Acá vas a poder gastar tus Puntos de Tienda. Cuando abra se anuncia en la Liga, y si activás los avisos te llega al teléfono.</p>
          <a className="btn borde2 chico" href="#/avisos">Activar los avisos</a>
        </div>
      </section>
    </>
  );
}

