// ── 🎮 EL LOBBY DEL INICIO, COMO EN LOS JUEGOS (Dlx, 13/10/2026: «los paneles cuadriculares estaban más o menos bien
// pero no se destacaban para nada… se veía feo el diseño… averiguá qué hay en una pestaña de Inicio, ¿cómo lo hace
// Brawl Stars? ¿FIFA?»). Lo que tienen en común los lobbies de Brawl Stars, Clash Royale, FC Ultimate Team y Fortnite:
//   1. TU BARRA arriba: quién sos, tu nivel y tu progreso, siempre a la vista;
//   2. UNA COSA DESTACADA, grande y con color (el «Jugar» amarillo de Brawl Stars, la promo de FC): acá Se busca;
//   3. CADA PUERTA CON SU IMAGEN, no un ícono en una caja: caras, tarjetas, logos de verdad;
//   4. RELOJES: lo que vence dice cuándo («vence en 6 d», «en 2 h»), en verde como los eventos de Brawl Stars;
//   5. GLOBITOS con un número cuando hay algo nuevo (eventos hoy, buscados sueltos).
// Mientras Dlx no lo apruebe, sólo con `?prev=lobby`; si no, las puertas de la 2.87 (`Puertas` en medio.jsx). Las
// puertas llevan la clase `pu` y su dirección: los toques se cuentan igual (`queToco()` de App.jsx)
import { limpio, num, utc } from './liga.js';
import { Cara, Ico, accion } from './piezas.jsx';
import { avance, usePase } from './pase.js';

// «en 35 min», «en 2 h», «en 6 d»: lo que falta, corto, como los relojes de los juegos
function falta(ms) {
  if (!(ms > 0)) return '';
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' MIN';
  const h = Math.round(m / 60);
  return h < 48 ? h + ' H' : Math.round(h / 24) + ' D';
}

function TuBarra({ liga, dc, P }) {
  const yo = liga.yo;
  if (!dc) {
    return (
      <div className="lb-yo invita">
        <p><b>¿Jugás en la Liga?</b> Entrá con Discord y ves tu puesto, tu Pase y tu racha acá arriba.</p>
        <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar</button>
      </div>
    );
  }
  const a = P && P.listo && P.miembro ? avance(P) : null;
  const pct = a ? Math.round((100 * a.lleva) / a.de) : 0;
  return (
    <a className="lb-yo" href={yo ? '#/r/' + encodeURIComponent(yo.k) : '#/cuenta'}>
      {yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls="lb-cara" /> : <span className="lb-cara vacia"><Ico n="yo" t={26} /></span>}
      <span className="lb-quien"><b>{limpio(yo ? yo.n : dc.n || 'Vos')}</b>
        <small>{yo && yo.pos ? '#' + yo.pos + ' DE LA TEMPORADA' + (yo.ovr ? ' · OVR ' + yo.ovr : '') : 'Jugá un evento y aparecés en el Ranking'}</small></span>
      {P && P.listo && P.miembro ? (
        <span className="lb-pase"><small>PASE · NIVEL {P.nivel}</small><i><u style={{ width: pct + '%' }} /></i>
          <small>{a ? num(a.falta) + ' XP para el ' + (P.nivel + 1) : 'nivel máximo'}</small></span>
      ) : null}
    </a>
  );
}

export function Lobby({ liga, dc }) {
  const P = usePase(!!dc);
  const ahora = liga.ahora;
  // 🎯 Se busca: los sueltos primero, sus caras como afiches
  const mw = liga.d.mw || {};
  const bus = mw.b || [];
  const sueltos = bus.filter((b) => b.e !== 'cazado' && b.e !== 'escondio');
  const caras = (sueltos.length ? sueltos : bus).slice(0, 3);
  const tope = bus.reduce((m, b) => Math.max(m, Number(b.v) || 0), 0);
  const vence = mw.fin ? falta(utc(mw.fin) - ahora) : '';
  // 📅 lo de hoy y lo próximo
  const hoyK = liga.diaClave(new Date(ahora).toISOString());
  const cal = (liga.d.calendario || []).filter((c) => !liga.canceladoCal(c));
  const hoy = cal.filter((c) => liga.diaClave(c.t) === hoyK && utc(c.t) > ahora - 3 * 3600000);
  const prox = cal.filter((c) => utc(c.t) > ahora).sort((a, b) => utc(a.t) - utc(b.t))[0];
  const enVivo = liga.vivo().length;
  // sin nada anunciado (de madrugada pasa seguido), lo último que se jugó: una puerta vacía no invita a nada
  const ult = !prox && !hoy.length ? liga.llaves().slice().sort((x, y) => utc(liga.fechaLlave(y)) - utc(liga.fechaLlave(x)))[0] : null;
  // 🏆 el podio de la temporada
  const podio = [2, 1, 3].map((n) => (liga.d.tabla || []).find((f) => f.pos === n)).filter(Boolean);
  const yo = liga.yo;
  // 🃏 tres tarjetas de verdad, en abanico: la tuya primero si la tenés
  const conCarta = (liga.d.tabla || []).filter((f) => f.pos && liga.cartaUrl(f.k, 'temporada')).slice(0, 3);
  if (yo && liga.cartaUrl(yo.k, 'temporada') && !conCarta.includes(yo)) conCarta.splice(1, 1, yo);
  const a = P && P.listo && P.miembro ? avance(P) : null;
  return (
    <section className="lobby" aria-label="Tu lobby">
      <TuBarra liga={liga} dc={dc} P={P} />
      <div className="lb-grid">
        {bus.length ? (
          <a className="pu lb lb-mw" href="#/ranking/mw">
            <span className="lb-t">SE BUSCA</span>
            {vence ? <span className="lb-reloj">VENCE EN {vence}</span> : null}
            {sueltos.length ? <span className="lb-glob" aria-label={sueltos.length + ' sueltos'}>{sueltos.length}</span> : null}
            <span className="lb-afiches">{caras.map((b) => (
              <span key={b.k} className="lb-afiche"><Cara liga={liga} k={b.k} nombre={b.n} cls="lb-af-c" /><b>{limpio(b.n)}</b></span>
            ))}</span>
            <small>{bus.length} buscados{tope ? ' · cobrás hasta ' + num(tope) + ' pts' : ''}</small>
          </a>
        ) : null}
        <a className="pu lb lb-ev" href="#/eventos">
          <span className="lb-t">EVENTOS</span>
          {enVivo ? <span className="lb-reloj vivo">EN VIVO</span> : prox ? <span className="lb-reloj">EN {falta(utc(prox.t) - ahora)}</span> : null}
          {hoy.length ? <span className="lb-glob" aria-label={hoy.length + ' hoy'}>{hoy.length}</span> : null}
          {prox ? (
            <span className="lb-prox"><img alt="" src={liga.logo(prox.sv)} /><b>{limpio(prox.n)}</b></span>
          ) : ult ? (
            <span className="lb-prox"><img alt="" src={liga.logo(ult.sv)} /><b>{limpio(ult.nombre)}</b></span>
          ) : <span className="lb-big"><Ico n="eventos" t={34} /></span>}
          <small>{hoy.length ? (hoy.length === 1 ? '1 evento hoy' : hoy.length + ' eventos hoy') : prox ? liga.cuando(new Date(utc(prox.t)))
            : ult ? liga.cuando(liga.fechaLlave(ult)) + ' · ganó ' + liga.campeon(ult).join(' y ') : 'El calendario'}</small>
        </a>
        <a className="pu lb lb-rk" href="#/ranking">
          <span className="lb-t">RANKING</span>
          <span className="lb-podio">{podio.map((f) => (
            <span key={f.k} className={'lb-p p' + f.pos}><Cara liga={liga} k={f.k} nombre={f.n} cls="lb-p-c" /><b>{f.pos}</b></span>
          ))}</span>
          <small>{yo && yo.pos ? 'Vas #' + yo.pos : podio.length ? '#1 ' + limpio((podio.find((f) => f.pos === 1) || {}).n || '') : 'La temporada'}</small>
        </a>
        <a className="pu lb lb-tj" href="#/tarjetas">
          <span className="lb-t">TARJETAS</span>
          <span className="lb-abanico">{conCarta.map((f) => <img key={f.k} alt="" loading="lazy" src={liga.cartaUrl(f.k, 'temporada')} />)}</span>
          <small>{yo ? 'La tuya y las de todos' : 'Las de cada rapero'}</small>
        </a>
        <a className="pu lb lb-pa" href="#/pase">
          <span className="lb-t">PASE</span>
          <span className="lb-nivel"><b>{a ? P.nivel : 30}</b><small>{a ? 'TU NIVEL' : 'NIVELES'}</small></span>
          <i className="lb-barra"><u style={{ width: (a ? Math.round((100 * a.lleva) / a.de) : 0) + '%' }} /></i>
          <small>{a ? num(a.falta) + ' XP para el siguiente' : 'Tareas que dan premios'}</small>
        </a>
        <a className="pu lb lb-ti" href="#/tienda">
          <span className="lb-big"><Ico n="moneda" t={34} /></span>
          <span className="lb-ti-t"><span className="lb-t">TIENDA</span><small>Tus Puntos de Tienda, el precio por cabeza y la ropa</small></span>
        </a>
      </div>
    </section>
  );
}
