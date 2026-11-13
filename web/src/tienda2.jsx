// 🛒 LA TIENDA, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes»; para todos desde el mismo día
// («Publica y haz todo»), en lugar de la de tienda.jsx. Lo mismo que hacía, ordenado como la economía de los Puntos de
// Tienda, con lo que dejó el research de 21st (scratchpad/remake2/research_tienda_salon_guia_socios.md):
// - LA BILLETERA ARRIBA, EN TRES: saldo, lo que tienes en juego (tus precios de la semana) y lo que cobraste cazando.
// - EN QUÉ SE USAN HOY: el precio por cabeza no es lo único (alargar tu promo, fundar una crew, cambiarle el nombre o el
//   escudo): las cuatro cosas con su precio, en una fila, antes de los detalles.
// - EL PRECIO POR CABEZA con lo que hacía falta abrir para ver: cada cabeza con su barra hasta el tope, por qué un monto
//   está apagado («pasa el tope», «no te alcanza») y cómo queda después; lo cobrado como un libro, no como oraciones.
// - CÓMO SE GANAN, juntos y con sus números de verdad (del payload, de las crews y del Salón: ninguno se escribe acá, salvo
//   los que ya estaban escritos en la página).
// ⚠️ LA PLATA LA SIGUE MANEJANDO bot/paginas/tienda.js, como en tienda.jsx: `BILL`, `pedirBilletera()`, `valorCabezas()`,
// `ponerPrecio()`, `errorPrecio()` y `PR_EST`. Se redibuja con `lg:precios`. Afuera se ve cuánto vale cada cabeza, nunca quién puso.
import { useEffect, useState } from 'react';
import { limpio, norm, num, utc } from './liga.js';
import { Bandera, Cara, DosToques, Ico } from './piezas.jsx';
import { Prenda, Stickers } from './abajo.jsx';
import { useCrews } from './crews.js';
import { useSalon } from './mesawards.jsx';
import CSS_PAGINA from './css/tienda2.css?inline';
import { usarCss } from './css.js';
import { Miniatura } from './video.jsx';

usarCss('tienda2', CSS_PAGINA);

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
// 📣 una semana más de tu promo (Dlx, 16/10/2026: «1 semana más: 2.500 PdT»): el precio lo cobra el objeto
// (`promoExtender()` de bot/avisos.js); acá sólo se dice, como en tienda.jsx
const PROMO_SEMANA = 2500;
const irA = (id) => {
  const r = document.getElementById('inicio-nuevo');
  const el = r && r.shadowRoot && r.shadowRoot.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
// «cierra en 6 d 18 h»
function falta(liga, t) {
  const s = (utc(t) - liga.ahora) / 1000;
  if (!(s > 0)) return '';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d ? d + ' D ' + h + ' H' : h ? h + ' H' : Math.max(1, Math.floor(s / 60)) + ' MIN';
}

// ── tu billetera: el saldo y, abajo, en juego y cobrado (los ves sólo tú, con tu Discord) ──
function Billetera({ liga, dc }) {
  const T = liga.d.tienda;
  const B = window.BILL;
  const ahora = Date.now();
  const pedir = () => { if (typeof window.pedirBilletera === 'function') window.pedirBilletera(true); };
  if (B && B.ok) {
    const act = (B.mios || []).filter((m) => !m.estado && m.fin > ahora);
    const enJuego = act.reduce((a, m) => a + (Number(m.monto) || 0), 0);
    return (
      <div className="tn-bill">
        <small>TUS PUNTOS DE TIENDA · PARA GASTAR</small>
        <b className="tn-saldo">{num(B.saldo)}</b>
        <dl className="tn-bill-d">
          <div><dt>En juego</dt><dd>{num(enJuego)}</dd></div>
          <div><dt>Cobrado cazando</dt><dd>{num(B.cobrado || 0)}</dd></div>
        </dl>
        {act.length ? (
          <div className="tn-mios"><small>Tus precios de esta semana · si nadie los caza, vuelven</small>
            <ul>{act.map((m, i) => <li key={i}>{limpio((liga.fila(m.cabeza) || {}).n || m.cabeza)} <b>{num(m.monto)}</b></li>)}</ul></div>
        ) : null}
      </div>
    );
  }
  if (B && B.error && B.error !== 'sin_sesion') {
    const e = (typeof window.errorCuenta === 'function' && window.errorCuenta(B.error))
      || (B.error === 'todavia' ? 'La tienda todavía no está lista: prueba en un rato.' : 'No pude leer tus Puntos. Prueba de nuevo.');
    return (
      <div className="tn-bill">
        <small>TUS PUNTOS DE TIENDA</small>
        <p className="tn-mal">{e}</p>
        <button type="button" className="btn borde chico" onClick={pedir}>Probar de nuevo</button>
      </div>
    );
  }
  // con la sesión vencida vuelve a pedir que entres, como quien nunca entró
  if (dc && !B) return <div className="tn-bill"><small>TUS PUNTOS DE TIENDA</small><p className="tn-bill-p">Buscando los tuyos…</p></div>;
  return (
    <div className="tn-bill">
      <small>TODOS ARRANCAN CON</small>
      <b className="tn-saldo">{num(T.inicial)}</b>
      <p className="tn-bill-p">Para ver los tuyos entras con Discord: los ves sólo tú.</p>
      <button type="button" className="btn verde chico" onClick={pedir}>Ver mis Puntos</button>
    </div>
  );
}

// ── en qué se usan hoy: cuatro cosas con su precio ──
function Catalogo({ liga, todas, mia }) {
  const T = liga.d.tienda;
  const crew = (todas && todas.precio) ?? null;
  const nombre = mia && (mia.precio_nombre ?? null);
  const items = [
    ['cabeza', 'Precio por cabeza', num(T.min), 'Ponle precio a un rapero: el primero que le gana en un evento se lo lleva.', 'Ponerle precio', () => irA('tn-cabeza')],
    ['promo', 'Una semana más de tu promo', num(PROMO_SEMANA), 'Tu tema o tu video sigue una semana más en Publicaciones, tu perfil y las historias.', 'Ver mis promos', () => irA('tn-promo')],
    crew != null ? ['crew', 'Fundar una crew', num(crew), 'Tu crew, con su escudo, su lema y hasta ' + ((todas && todas.max) || 20) + ' raperos.', 'Ir a Crews', '#/crews'] : null,
    nombre != null ? ['nombre', 'Nombre o escudo nuevo', num(nombre), 'Para el Líder: cambiarle el nombre, la sigla o el escudo a tu crew.', 'Ir a Crews', '#/crews'] : null,
  ].filter(Boolean);
  return (
    <section className="sec tn-sec" aria-labelledby="tn-cat">
      <div className="sec-t"><h2 id="tn-cat">En qué se usan hoy</h2></div>
      <ul className="tn-cat">
        {items.map(([k, t, p, d, cta, ir]) => (
          <li key={k} className={'tn-item ' + k}>
            <span className="tn-precio">{k === 'cabeza' ? <small>DESDE</small> : null}<b>{p}</b><small>PUNTOS</small></span>
            <b className="tn-it">{t}</b>
            <p>{d}</p>
            {typeof ir === 'string' ? <a className="tn-a" href={ir}>{cta} <Ico n="flecha" t={14} /></a>
              : <button type="button" className="tn-a" onClick={ir}>{cta} <Ico n="flecha" t={14} /></button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── una cabeza: su cara, su nombre, cuánto vale y cuánto le falta al tope ──
function Fila({ liga, n, v, on, onSel, cara, info }) {
  const T = liga.d.tienda;
  const f = liga.fila(n);
  return (
    <button type="button" className={'tn-c' + (on ? ' on' : '')} aria-expanded={on} onClick={onSel}>
      <Cara liga={liga} k={f ? f.k : ''} nombre={f ? f.n : n} cls="tn-cara" />
      <span className="tn-n"><b>{limpio(f ? f.n : n)}{f && f.cc ? <Bandera cc={f.cc} cls="tn-flag" /> : null}{cara ? <em className="tn-cara-t">LA MÁS CARA</em> : null}</b>
        {v ? <i className="tn-barra" aria-hidden="true"><i style={{ width: Math.min(100, Math.round((v / T.tope) * 100)) + '%' }} /></i>
          : <small>{info && f ? (f.pos ? '#' + f.pos + ' · ' : '') + 'OVR ' + (f.ovr || '—') : 'sin precio todavía'}</small>}</span>
      <span className={'tn-v' + (v ? '' : ' sin')}>{v ? num(v) : 'ponerle precio'}</span>
    </button>
  );
}

// ── ponerle precio: los montos, por qué alguno está apagado y cómo queda ──
function Panel({ liga, n, dc }) {
  const T = liga.d.tienda;
  const v = valores()[n] || 0;
  const est = (window.PR_EST || {})[n] || {};
  const saldo = window.BILL && window.BILL.ok ? window.BILL.saldo : null;
  const queda = T.tope - v;
  const f = liga.fila(n);
  const esYo = !!(f && liga.yo && liga.yo.k === f.k);
  const msg = est.va ? 'Poniendo ' + num(est.va) + '…'
    : est.ok ? '✓ Pusiste ' + num(est.ok) + '. Si nadie lo caza en la semana, vuelven a ti.'
      : est.error ? sinEtiquetas(typeof window.errorPrecio === 'function' ? window.errorPrecio(est) : 'No pude ponerlo.')
        : dc ? 'Toca un monto y confírmalo.' : 'Para poner un precio entras con Discord: toca un monto.';
  return (
    <div className="tn-panel">
      <p className="tn-panel-t"><b>{limpio(f ? f.n : n)}</b>{v ? <> vale <b>{num(v)}</b></> : ' no tiene precio todavía'}
        {v < T.tope ? (v ? <> · se le pueden poner {num(queda)} más</> : null) : <> · ya vale lo máximo</>}
        {saldo != null ? <> · tienes <b>{num(saldo)}</b></> : null}</p>
      {esYo ? <p className="tn-nota">Eres tú: no te puedes poner precio.</p> : (
        <>
          <div className="tn-montos">
            {[1, 2, 5, 10].map((x) => T.min * x).map((m) => {
              const tope = m > queda;
              const falta2 = saldo != null && m > saldo;
              return (
                <div key={m} className="tn-monto">
                  <DosToques className="btn borde2 chico" disabled={tope || falta2 || !!est.va}
                    confirmar={'¿' + num(m) + '? Toca de nuevo'} onClick={() => window.ponerPrecio(n, m)}>+{num(m)}</DosToques>
                  <small>{tope ? 'pasa el tope' : falta2 ? 'no te alcanza' : v ? '→ vale ' + num(v + m) : ''}</small>
                </div>
              );
            })}
          </div>
          <p className={'tn-msg' + (est.error ? ' mal' : '')} aria-live="polite">{msg}</p>
        </>
      )}
      {f ? <a className="tn-a" href={'#/r/' + encodeURIComponent(f.k)}>Ver su perfil <Ico n="flecha" t={14} /></a> : null}
    </div>
  );
}

function Cabezas({ liga, dc }) {
  const T = liga.d.tienda;
  const [sel, setSel] = useState({ n: '', d: '' });
  const [q, setQ] = useState('');
  const v = valores();
  const puede = (n) => (liga.d.tabla || []).some((x) => x.n === n && !x.fc);
  const top = Object.keys(v).filter((c) => v[c] > 0 && puede(c)).sort((a, b) => v[b] - v[a]);
  const qq = norm(q).trim();
  const res = qq ? (liga.d.tabla || []).filter((x) => !x.fc && norm(x.n).includes(qq)).slice(0, 8) : [];
  // sin buscar: los primeros del ranking que todavía no tienen precio (quien no sabe a quién, empieza por ahí)
  const yo = liga.yo && liga.yo.k;
  const sug = qq ? [] : liga.oficiales().filter((x) => !x.fc && !v[x.n] && x.k !== yo).slice(0, top.length ? 4 : 6);
  const elegir = (n, d) => setSel((s) => (s.n === n && s.d === d ? { n: '', d: '' } : { n, d }));
  const lista = (ns, d) => ns.map((n, i) => (
    <li key={n}>
      <Fila liga={liga} n={n} v={v[n] || 0} on={sel.n === n && sel.d === d} onSel={() => elegir(n, d)} cara={d === 'top' && i === 0 && top.length > 1} info={d === 'sug'} />
      {sel.n === n && sel.d === d ? <Panel liga={liga} n={n} dc={dc} /> : null}
    </li>
  ));
  const cazas = (T.cazas || []).slice().reverse();
  const nombre = (x) => limpio((liga.fila(x) || {}).n || x);
  return (
    <section className="sec tn-sec" id="tn-cabeza" aria-labelledby="tn-cab-t">
      <div className="sec-t"><h2 id="tn-cab-t">Precio por cabeza</h2>
        <span className="tn-cierra">{falta(liga, T.fin) ? 'CIERRA EN ' + falta(liga, T.fin) : 'CERRADA'}<small>{liga.dia(T.fin)}</small></span></div>
      <ol className="tn-pasos">
        <li><b>1</b><span>Pones Puntos de Tienda sobre un rapero de la temporada.</span></li>
        <li><b>2</b><span>El primero que le gana en un evento de la Liga se los lleva, <b>y lo mismo suma a su Temporada</b>.</span></li>
        <li><b>3</b><span>Si nadie lo caza en la semana, vuelven a quien los puso. Una cabeza vale como mucho <b>{num(T.tope)}</b>, y nadie ve quién puso.</span></li>
      </ol>
      <div className={'tn-dos' + (top.length ? ' con-top' : ' sin-top')}>
        {top.length ? (
          <div>
            <h3 className="tn-h">Las cabezas de esta semana<small>{top.length}</small></h3>
            <ul className="tn-lista">{lista(top, 'top')}</ul>
          </div>
        ) : null}
        <div>
          <h3 className="tn-h">Ponerle precio a alguien</h3>
          {!top.length ? <p className="tn-nota">Esta semana todavía nadie tiene precio: el primero puede ser el tuyo.</p> : null}
          <input type="search" className="tn-busca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca a quién"
            aria-label="Buscar un rapero para ponerle precio" enterKeyHint="search" />
          {qq ? (res.length ? <ul className="tn-lista">{lista(res.map((x) => x.n), 'res')}</ul>
            : <p className="tn-nota">No hay nadie con ese nombre en la temporada.</p>)
            : sug.length ? <><small className="tn-sug">Los primeros del ranking sin precio</small><ul className="tn-lista">{lista(sug.map((x) => x.n), 'sug')}</ul></> : null}
        </div>
      {cazas.length ? (
        <div className="tn-cobros">
          <h3 className="tn-h">Lo último que se cobró</h3>
          <ul className="tn-libro">
            {cazas.map((x, i) => {
              const f = liga.fila(x.cabeza);
              return (
                <li key={i}>
                  <span className="tn-libro-c">{x.por.slice(0, 2).map((y) => { const g = liga.fila(y[0]); return <Cara key={y[0]} liga={liga} k={g ? g.k : ''} nombre={y[0]} cls="tn-lc" />; })}</span>
                  <span className="tn-libro-t"><span><b>{x.por.map((y) => nombre(y[0])).join(' y ')}</b>{x.por.length > 1 ? ' le ganaron a ' : ' le ganó a '}
                    <b>{nombre(x.cabeza)}</b></span><small>{limpio(x.ev)}{x.t ? ' · ' + liga.cuando(x.t) : ''}</small></span>
                  <b className="tn-mas">+{num(x.monto)}{x.por.length > 1 ? <small> entre {x.por.length}</small> : null}</b>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      </div>
    </section>
  );
}

// ── tu promo, una semana más: con la fecha nueva antes de pagar ──
function TuPromo({ liga, dc }) {
  const [est, setEst] = useState({});
  // ⚠️ con la clave de la cuenta: quien no entra en la tabla no tiene `liga.yo`, y leía «no tienes ninguna» con la suya al aire
  const yo = (liga.yo && liga.yo.k) || (dc && dc.clave);
  const xs = yo ? (liga.muro || []).filter((it) => it.tipo === 'promo' && (it.ks || []).includes(yo) && it.hasta && utc(it.hasta) > liga.ahora) : [];
  const saldo = window.BILL && window.BILL.ok ? window.BILL.saldo : null;
  const alargar = (it) => {
    if (!window.conCuenta) return;
    setEst((e) => ({ ...e, [it.id]: { va: true } }));
    window.conCuenta('/api/avisos/promo-extender', { id: it.id }).then((j) => {
      setEst((e) => ({ ...e, [it.id]: j && j.ok ? { ok: j.hasta } : { error: (j && j.error) || 'error', saldo: j && j.saldo } }));
      if (j && j.ok && typeof window.pedirBilletera === 'function') window.pedirBilletera(false);
    }).catch(() => setEst((e) => ({ ...e, [it.id]: { error: 'error' } })));
  };
  const msg = (e) => (e.va ? 'Alargando…' : e.ok ? '✓ Sigue en la página hasta el ' + liga.dia(new Date(e.ok).toISOString()) + '.'
    : e.error === 'saldo' ? 'Te faltan Puntos de Tienda' + (e.saldo != null ? ': tienes ' + num(e.saldo) + '.' : '.')
      : e.error === 'vencida' ? 'Ya salió de la página.' : e.error === 'no_es_tuya' ? 'Esta promo no es tuya.'
        : e.error === 'todavia' ? 'La tienda todavía no está lista: prueba en un rato.' : e.error ? 'No pude alargarla. Prueba de nuevo.' : '');
  const dia = (ms) => liga.dia(new Date(ms).toISOString()).replace(/ · .*$/, '');
  return (
    <section className="sec tn-sec" id="tn-promo" aria-labelledby="tn-promo-t">
      <div className="sec-t"><h2 id="tn-promo-t">Tu promo, una semana más</h2></div>
      <p className="tn-nota">Cada promo está <b>una semana</b> en la página —en Publicaciones, tu perfil y el círculo de las historias—.
        Si es tuya, la alargas <b>una semana más por {num(PROMO_SEMANA)} Puntos de Tienda</b>, y de nuevo cuando vuelva a vencer.</p>
      {!dc ? <p className="tn-nota fuerte">Entra con Discord para ver las tuyas.
        <button type="button" className="btn verde chico" onClick={() => { if (typeof window.pedirBilletera === 'function') window.pedirBilletera(true); }}>Entrar con Discord</button></p>
        : !xs.length ? <p className="tn-nota fuerte">Ahora no tienes ninguna en la página: comparte tu tema o tu video en el canal de promoción de tu servidor y aparece acá.</p>
          : (
            <ul className="tn-promos">
              {xs.map((it) => {
                const e = est[it.id] || {};
                // 🔎 de un video, la miniatura grande (`Miniatura`, 1280×720); la de 320×180 se veía borrosa
                const img = it.vid ? '' : it.img || '';
                const hasta = utc(it.hasta).getTime();
                return (
                  <li key={it.id}>
                    {it.vid ? <Miniatura vid={it.vid} /> : img ? <img alt="" src={img} loading="lazy" /> : <span className="tn-promo-sin" aria-hidden="true">▶</span>}
                    <div>
                      <b>{limpio(it.tit || it.url)}</b>
                      <small>{it.alargada ? 'Alargada · ' : ''}sale {dia(hasta)} → con una semana más, {dia(hasta + 7 * 86400000)}</small>
                      <p className={'tn-msg' + (e.error ? ' mal' : '')} aria-live="polite">{msg(e)}</p>
                    </div>
                    <DosToques className="btn borde2 chico" disabled={!!e.va || (saldo != null && saldo < PROMO_SEMANA)}
                      confirmar={'¿' + num(PROMO_SEMANA) + '? Toca de nuevo'} onClick={() => alargar(it)}>+1 semana · {num(PROMO_SEMANA)}</DosToques>
                  </li>
                );
              })}
            </ul>
          )}
    </section>
  );
}

// ── cómo se ganan: lo que ya paga hoy, con sus números de verdad ──
function SeGanan({ liga }) {
  const T = liga.d.tienda;
  const S = useSalon();
  const P = S && S.premio;
  // [clave, título, la cifra, lo que dice, adónde lleva]
  const items = [
    ['caza', 'Cazando', ['hasta', num(T.tope)], <>El precio entero de la cabeza que le ganas{T.mw ? <>, y el <b>{Math.round(T.mw * 100)} %</b> de lo que pagan los buscados del Most Wanted</> : null}.</>, '#/ranking/mw'],
    ['racha', 'Entrando cada día', ['', 'Cada día'], <>Tu racha paga cada día que entras —el que no se cobra ese día, no se cobra después— y el domingo es un cofre.</>, '#/'],
    ['promos', 'Abriendo promos', ['', '50'], <>Cada promo que abres con tu cuenta te da <b>50</b>, hasta 3 por día.</>, '#/publicaciones'],
    P ? ['mes', 'Ganando un MES AWARD', ['hasta', num(P.rapero)], <>El Rapero del mes se lleva <b>{num(P.rapero)}</b>, la Revelación <b>{num(P.revelacion)}</b>, la Batalla <b>{num(P.batalla)}</b>{P.otra ? <> y las demás <b>{num(P.otra)}</b></> : null}.</>, '#/salon']
      : ['mes', 'Ganando un MES AWARD', ['', 'Cada mes'], <>Cada ganador del mes se lleva Puntos de Tienda y su insignia.</>, '#/salon'],
    // 💎 el Ranked (bot/divisiones.py): `p` una piedra nueva, `ps` un subnivel, una vez cada uno; viajan en `div`
    liga.d.div && liga.d.div.m === 'elo' && liga.d.div.p ? ['ranked', 'Subiendo en el Ranked', ['', num(liga.d.div.p)], <>Llegar por primera vez a una piedra paga <b>{num(liga.d.div.p)}</b>{liga.d.div.ps ? <> y a cada subnivel <b>{num(liga.d.div.ps)}</b></> : null}.</>, '#/ranking/divisiones'] : null,
    ['nuevo', 'Tus primeros 7 días', ['', '7 pasos'], <>Si llegaste hace poco, cada paso de tu primera semana (seguir a alguien, activar la campana, verificarte…) tiene premio.</>, '#/'],
  ].filter(Boolean);
  return (
    <section className="sec tn-sec" aria-labelledby="tn-gan">
      <div className="sec-t"><h2 id="tn-gan">Cómo se ganan</h2></div>
      <p className="tn-nota">Todos arrancan la temporada con <b>{num(T.inicial)}</b>. Van aparte del ranking: no suman a tu OVR ni a tu Score.</p>
      <ul className="tn-gana">
        {items.map(([k, t, [pre, cifra], d, href]) => (
          <li key={k}><a href={href}>
            <span className="tn-precio">{pre ? <small>{pre.toUpperCase()}</small> : null}<b>{cifra}</b></span>
            <b className="tn-gt">{t} <Ico n="flecha" t={14} /></b><p>{d}</p></a></li>
        ))}
      </ul>
    </section>
  );
}

// ── la ropa de ejemplo (la de abajo.jsx), con «EJEMPLO» una sola vez ──
function Merch({ liga }) {
  const svs = Object.values(liga.svs || {}).filter((s) => s.color && s.sv);
  const socios = svs.filter((s) => s.logo).slice(0, 4);
  /* eslint-disable react/jsx-key */
  const items = [
    ['remera', 'Remera Under Legends', 'Negra, con el logo al pecho', <Prenda tipo="remera" color="#141414" logo="/ul.png" />],
    ['buzo', 'Buzo Liga Global', 'Magenta, con el logo y «LIGA GLOBAL»', <Prenda tipo="buzo" color="#E41373" logo="/ul.png" texto="LIGA GLOBAL" />],
    ['gorra', 'Gorra UL', 'Blanca, con el logo bordado', <Prenda tipo="gorra" color="#F2F2F2" logo="/ul.png" />],
    ...socios.map((s) => ['sv-' + s.sv, 'Remera ' + (s.sigla || s.sv), s.nombre + ', socio de la Liga',
      <Prenda tipo="remera" color={s.color} logo={liga.logo(s.sv)} texto={String(s.sigla || s.sv).toUpperCase()} />]),
    ...(svs.length ? [['stickers', 'Stickers de la Liga', 'Los logos de los socios',
      <Stickers logos={['/ul.png', ...svs.filter((s) => s.logo).map((s) => liga.logo(s.sv))]} />]] : []),
  ];
  /* eslint-enable react/jsx-key */
  return (
    <section className="sec negra tn-merch" aria-labelledby="tn-merch-t">
      <div className="sec-t"><h2 id="tn-merch-t">La tienda abre pronto</h2><span className="tag-pronto">EJEMPLOS · NO ESTÁ A LA VENTA</span></div>
      <div className="tn-merch-cab">
        <p className="tn-merch-p">Acá vas a poder canjear tus Puntos de Tienda. Así podría ser la ropa de Under Legends y de sus socios: <b>todavía no se vende
          nada</b>. Cuando abra se anuncia en la Liga y, con los avisos, te llega al teléfono.</p>
        <a className="btn borde chico" href="#/avisos">Activar los avisos</a>
      </div>
      <div className="tn-merch-rail">
        {items.map(([k, n, d, dibujo]) => (
          <article className="tn-prenda" key={k}>
            <div className="tn-prenda-img">{dibujo}</div>
            <b>{n}</b>
            <small>{d}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Tienda({ liga, dc }) {
  usePrecios();
  const T = liga.d.tienda;
  const { todas, mia } = useCrews();
  useEffect(() => {
    if (dc && !window.BILL && typeof window.pedirBilletera === 'function') window.pedirBilletera(false);
  }, [dc && dc.id]);
  if (!T || typeof window.ponerPrecio !== 'function') {
    return (
      <section className="sec tn-sec">
        <div className="sec-t"><h2>La tienda</h2></div>
        <p className="pronto-p">La tienda todavía no está lista: prueba en un rato.</p>
      </section>
    );
  }
  return (
    <>
      <div className="escena tn-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.9, '--mo-c2': '#29B298' }}>
        <section className="tn-cab">
          <div className="tn-cab-tx">
            <span className="tag">LA TIENDA · {liga.temp}</span>
            <h1 className="hero-ev">Tienda</h1>
            <p className="hero-p">Los Puntos de Tienda van aparte del ranking: se ganan jugando y entrando, y se usan acá —para ponerle precio a una cabeza,
              alargar tu promo o fundar tu crew—. La tienda de verdad abre pronto.</p>
          </div>
          <Billetera liga={liga} dc={dc} />
        </section>
      </div>
      <Catalogo liga={liga} todas={todas} mia={mia} />
      <Cabezas liga={liga} dc={dc} />
      <TuPromo liga={liga} dc={dc} />
      <SeGanan liga={liga} />
      <Merch liga={liga} />
    </>
  );
}
