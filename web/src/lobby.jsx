// ── 🎮 EL LOBBY DEL INICIO, COMO EN LOS JUEGOS (Dlx, 13/10/2026: «los paneles cuadriculares estaban más o menos bien
// pero no se destacaban para nada… averiguá cómo lo hace Brawl Stars, FIFA»; y al research «Lobbies de juegos que
// enganchan», con sus nueve decisiones: «me gusta todo como me lo pasaste»). De arriba abajo:
//   1. TU BARRA: tu cara con la llama de la racha, tu letra (o cuánto te falta), tu nivel del Pase y tus Puntos de
//      Tienda. Festeja la racha al llegar a 7 y a 30 (Duolingo: la animación del hito sola valió +1,7 % al día 7);
//   2. EL BOTÓN GRANDE: lo tuyo, una sola vez. Tu evento en vivo, en el que estás anotado o el próximo para anotarte
//      con un toque (el canal de inscripciones), con su reloj y su premio; y después del primer evento, «tu segundo
//      evento» con el reto del debut. El 42 % juega una sola vez: ahí se pierde la gente;
//   3. SE BUSCA, el destacado en amarillo (el panel de abajo se va del Inicio: cada dato, una vez);
//   4. LAS PUERTAS, cada una con una sola cosa y un globito SÓLO por algo tuyo (Supercell: el punto rojo sólo «cuando
//      hay un motivo de verdad»), que se apaga al entrar.
// Para todos desde el 13/10/2026 (Dlx: «1. yes»); antes, sólo con `?prev=lobby`. Las puertas llevan `pu` y su
// dirección: los toques se cuentan igual (`queToco()` de App.jsx)
import { useEffect, useState } from 'react';
import { limpio, mult, num, siglaDe, utc } from './liga.js';
import { Cara, Ico, aDiscord, accion } from './piezas.jsx';
import { avance, usePase } from './pase.js';
import { useRacha } from './racha.js';
import { llaveEnVivo } from './arriba.jsx';

const W = typeof window !== 'undefined' ? window : {};
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };

// «35 MIN», «2 H», «6 D»: lo que falta, corto, como los relojes de los juegos
function falta(ms) {
  if (!(ms > 0)) return '';
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' MIN';
  const h = Math.round(m / 60);
  return h < 48 ? h + ' H' : Math.round(h / 24) + ' D';
}
// cuánto falta para la medianoche del este, cuando vencen las Tareas diarias
function hastaMedianocheET(ahora) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(ahora));
  const h = Number((p.find((x) => x.type === 'hour') || {}).value || 0) % 24;
  const m = Number((p.find((x) => x.type === 'minute') || {}).value || 0);
  return ((23 - h) * 60 + (60 - m)) * 60000;
}
// el lunes 00:00 de esta semana, en la hora de quien mira
function lunes(ahora) {
  const d = new Date(ahora);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

// 🪙 tus Puntos de Tienda: la billetera la pide app.js (`pedirBilletera()`, `window.BILL`) y avisa con `lg:precios`
function useSaldo(dc) {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    W.addEventListener('lg:precios', f);
    if (dc && !W.BILL && typeof W.pedirBilletera === 'function') { try { W.pedirBilletera(); } catch (e) { /* sin saldo */ } }
    return () => W.removeEventListener('lg:precios', f);
  }, [dc]);
  return W.BILL && W.BILL.ok ? W.BILL.saldo : null;
}

function TuBarra({ liga, dc, P, R, saldo }) {
  const yo = liga.yo;
  const [fest, setFest] = useState(null);
  const actual = R && R.racha ? R.racha.actual || 0 : 0;
  const inicio = R && R.racha ? R.racha.inicio || '' : '';
  // 🔥 el festejo de la racha, una vez por hito y por racha (si se corta y vuelve a llegar, se festeja otra vez)
  useEffect(() => {
    const hito = actual >= 30 ? 30 : actual >= 7 ? 7 : 0;
    if (!hito || !inicio) return;
    const ya = leer('lg:racha-fest') || {};
    if (ya[hito] === inicio) return;
    setFest(hito);
    guardar('lg:racha-fest', Object.assign({}, ya, { [hito]: inicio }));
  }, [actual, inicio]);
  if (!dc) {
    return (
      <div className="lb-yo invita">
        <p><b>¿Jugás en la Liga?</b> Entrá con Discord y ves acá tu racha, tu letra, tu Pase y tus Puntos.</p>
        <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar</button>
      </div>
    );
  }
  const a = P && P.listo && P.miembro ? avance(P) : null;
  const ev = yo ? yo.ev || 0 : 0;
  const letra = yo && yo.rg ? yo.rg : null;
  return (
    <>
      <a className="lb-yo" href={yo ? '#/r/' + encodeURIComponent(yo.k) : '#/cuenta'}>
        <span className="lb-cw">
          {yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls="lb-cara" /> : <span className="lb-cara vacia"><Ico n="yo" t={26} /></span>}
          {actual >= 1 ? <span className="lb-fuego" title={actual + (actual === 1 ? ' día seguido' : ' días seguidos')}><Ico n="fuego" t={13} />{actual}</span> : null}
        </span>
        <span className="lb-quien"><b>{limpio(yo ? yo.n : dc.n || 'Vos')}</b>
          <small>{letra ? 'RANGO ' + letra : yo ? Math.min(ev, 10) + '/10 PARA TU RANGO' : 'JUGÁ UN EVENTO Y APARECÉS'}
            {a ? ' · PASE ' + P.nivel : yo && yo.pos ? ' · #' + yo.pos + ' DE LA TEMPORADA' : ''}</small>
          {a ? <i className="lb-mini"><u style={{ width: Math.round((100 * a.lleva) / a.de) + '%' }} /></i> : null}</span>
        {saldo != null ? <span className="lb-saldo"><Ico n="moneda" t={18} /><b>{num(saldo)}</b></span> : null}
      </a>
      {fest ? (
        <button type="button" className="lb-fest" onClick={() => setFest(null)}>
          <Ico n="fuego" t={26} /><span><b>¡{fest} DÍAS SEGUIDOS!</b><small>Tu racha llegó a {fest}. Tocá para seguir.</small></span>
        </button>
      ) : null}
    </>
  );
}

// ── 🎯 EL BOTÓN GRANDE: lo tuyo, una sola vez, en su estado de ahora ──
function ElBoton({ liga }) {
  const yo = liga.yo;
  const ahora = liga.ahora;
  const vivos = liga.vivo();
  const luego = liga.luego();
  const estoy = (e) => !!(yo && liga.anotados(e).some((x) => x.f && x.f.k === yo.k));
  // 1 · tu evento, en vivo
  const vivoMio = vivos.find(estoy);
  if (vivoMio) {
    const L = llaveEnVivo(vivoMio, W.VIVO_L);
    const dd = aDiscord(liga, vivoMio, true);
    return (
      <div className="lb-boton vivo">
        <span className="lb-b-et"><i />TU EVENTO ESTÁ EN VIVO</span>
        <span className="lb-b-ev"><img alt="" src={liga.logo(vivoMio.sv)} /><b>{limpio(vivoMio.nombre)}</b></span>
        {L ? <button type="button" className="btn verde" onClick={() => accion.llave('v:' + L.id)}>Ver la llave</button>
          : dd ? <a className="btn verde" href={dd.url} target="_blank" rel="noopener noreferrer">{dd.txt}</a> : null}
      </div>
    );
  }
  // 2 · en el que estás anotado
  const anotado = luego.find(estoy);
  // 3 · si no, el próximo para anotarte: el de tu servidor primero, en las próximas 36 h
  const cerca = luego.filter((x) => utc(x.cuando) - ahora < 36 * 3600000);
  const e = anotado || (yo && cerca.find((x) => x.sv === yo.sv)) || cerca[0] || luego[0];
  if (!e) {
    return (
      <div className="lb-boton nada">
        <span className="lb-b-et">TODAVÍA NO ANUNCIARON EL PRÓXIMO</span>
        <p>Los eventos se anuncian con poco tiempo. Activá la campana y te llega al minuto.</p>
        <a className="btn verde" href="#/avisos"><Ico n="campana" t={18} />Activar la campana</a>
      </div>
    );
  }
  const ev = yo ? yo.ev || 0 : 0;
  // 🥈 TU SEGUNDO EVENTO: después del primero, qué sumaste y el reto del debut (1.000 Puntos de Tienda si jugás otro
  // en 7 días; `bot/debutantes.py`)
  const primero = yo && ev === 1 ? liga.semanaDe(yo.k)[0] : null;
  const vence = primero ? utc(liga.fechaLlave(primero[0])) + 7 * 86400000 : 0;
  const reto = !!primero && vence > ahora;
  const m = liga.multSv(e.sv);
  const ins = aDiscord(liga, e, false);
  const et = anotado ? 'ESTÁS ANOTADO' : reto ? 'TU SEGUNDO EVENTO' : yo && ev === 0 ? 'TU PRIMER EVENTO' : 'EL PRÓXIMO EVENTO';
  return (
    <div className={'lb-boton' + (anotado ? ' anotado' : '')}>
      <span className="lb-b-et">{et} · EMPIEZA EN {falta(utc(e.cuando) - ahora) || 'UN RATO'}</span>
      <span className="lb-b-ev"><img alt="" src={liga.logo(e.sv)} /><b>{limpio(e.nombre)}</b></span>
      {reto || m > 1 || primero ? (
        <span className="lb-b-pr">
          {reto ? <em>Jugalo antes del {liga.dia(new Date(vence))} y ganás 1.000 Puntos de Tienda</em> : null}
          {m > 1 ? <em>{siglaDe(e.sv)} va {mult(m)} esta semana</em> : null}
          {primero ? <em className="gris">Tu debut: {limpio(primero[0].nombre)} · +{num(primero[2])} pts</em> : null}
        </span>
      ) : null}
      {anotado ? <a className="btn verde" href="#/avisos"><Ico n="campana" t={18} />Avisame cuando empiece</a>
        : ins ? <a className="btn verde lb-b-ya" href={ins.url} target="_blank" rel="noopener noreferrer">Anotarme</a> : null}
    </div>
  );
}

export function Lobby({ liga, dc }) {
  const P = usePase(!!dc);
  const R = useRacha(!!dc);
  const saldo = useSaldo(dc);
  const ahora = liga.ahora;
  const yo = liga.yo;
  // 🎯 Se busca: los sueltos primero, sus caras como afiches. Sin globito: no es algo tuyo (salvo que te busquen a vos)
  const mw = liga.d.mw || {};
  const bus = mw.b || [];
  const sueltos = bus.filter((b) => b.e !== 'cazado' && b.e !== 'escondio');
  const caras = (sueltos.length ? sueltos : bus).slice(0, 3);
  const tope = bus.reduce((mx, b) => Math.max(mx, Number(b.v) || 0), 0);
  const vence = mw.fin ? falta(utc(mw.fin) - ahora) : '';
  const teBuscan = !!(yo && liga.buscado(yo.k));
  // 📅 la semana: cuántos eventos (lunes a domingo, en tu hora) y si hay alguno en vivo
  const l0 = lunes(ahora);
  const semana = (liga.d.calendario || []).filter((c) => !liga.canceladoCal(c) && utc(c.t) >= l0 && utc(c.t) < l0 + 7 * 86400000).length;
  const enVivo = liga.vivo().length;
  // 🏆 tu puesto y si cambió desde la última vez que miraste (el globito, sólo por algo tuyo)
  const pos = yo && yo.pos ? yo.pos : 0;
  const [vistoPos, setVistoPos] = useState(() => leer('lg:lb-pos'));
  useEffect(() => { if (pos && vistoPos == null) { guardar('lg:lb-pos', pos); setVistoPos(pos); } }, [pos, vistoPos]);
  const subio = pos && vistoPos && vistoPos !== pos ? vistoPos - pos : 0;
  const uno = (liga.d.tabla || []).find((f) => f.pos === 1);
  // 🃏 tu carta más nueva, con «NUEVA» si cambió desde la última vez
  const tuya = yo ? ['temporada', 'competitivo', 'servidor'].map((c) => liga.cartaUrl(yo.k, c)).find(Boolean) : null;
  const [vistaCarta, setVistaCarta] = useState(() => leer('lg:lb-carta'));
  useEffect(() => { if (tuya && vistaCarta == null) { guardar('lg:lb-carta', tuya); setVistaCarta(tuya); } }, [tuya, vistaCarta]);
  const cartaNueva = !!(tuya && vistaCarta && vistaCarta !== tuya);
  const otras = (liga.d.tabla || []).filter((f) => f.pos && liga.cartaUrl(f.k, 'temporada')).slice(0, 3);
  // 🎟️ el Pase: tu nivel, y cuándo vencen las Tareas de hoy
  const a = P && P.listo && P.miembro ? avance(P) : null;
  return (
    <section className="lobby" aria-label="Tu lobby">
      <TuBarra liga={liga} dc={dc} P={P} R={R} saldo={saldo} />
      <ElBoton liga={liga} />
      <div className="lb-grid">
        {bus.length ? (
          <a className="pu lb lb-mw" href="#/ranking/mw">
            <span className="lb-t">{teBuscan ? 'TE BUSCAN' : 'SE BUSCA'}</span>
            {vence ? <span className="lb-reloj">VENCE EN {vence}</span> : null}
            {teBuscan ? <span className="lb-glob" aria-label="te buscan">!</span> : null}
            <span className="lb-afiches">{caras.map((b) => (
              <span key={b.k} className="lb-afiche"><Cara liga={liga} k={b.k} nombre={b.n} cls="lb-af-c" /><b>{limpio(b.n)}</b></span>
            ))}</span>
            <small>{sueltos.length} {sueltos.length === 1 ? 'sigue suelto' : 'siguen sueltos'}{tope ? ' · cobrás hasta ' + num(tope) + ' pts' : ''}</small>
          </a>
        ) : null}
        <a className="pu lb lb-ev" href="#/eventos">
          <span className="lb-t">EVENTOS</span>
          {enVivo ? <span className="lb-reloj vivo">EN VIVO</span> : null}
          <span className="lb-nivel"><b>{semana}</b><small>{semana === 1 ? 'EVENTO' : 'EVENTOS'}</small></span>
          <small>esta semana en la Liga</small>
        </a>
        <a className="pu lb lb-rk" href="#/ranking" onClick={() => { if (pos) guardar('lg:lb-pos', pos); }}>
          <span className="lb-t">RANKING</span>
          {subio ? <span className="lb-glob" aria-label="cambió tu puesto">{subio > 0 ? '▲' : '▼'}</span> : null}
          {pos ? <span className="lb-nivel"><b>#{pos}</b><small>{subio ? (subio > 0 ? 'SUBISTE ' + subio : 'BAJASTE ' + -subio) : 'TU PUESTO'}</small></span>
            : <span className="lb-nivel"><b>#1</b><small>{uno ? limpio(uno.n).toUpperCase() : 'LA TEMPORADA'}</small></span>}
          <small>{pos ? 'en la Temporada' : 'Las tablas de la temporada'}</small>
        </a>
        <a className="pu lb lb-tj" href="#/tarjetas" onClick={() => { if (tuya) guardar('lg:lb-carta', tuya); }}>
          <span className="lb-t">TARJETAS</span>
          {cartaNueva ? <span className="lb-glob nueva">NUEVA</span> : null}
          <span className="lb-abanico">{tuya ? <img alt="" loading="lazy" src={tuya} className="sola" />
            : otras.map((f) => <img key={f.k} alt="" loading="lazy" src={liga.cartaUrl(f.k, 'temporada')} />)}</span>
          <small>{tuya ? (cartaNueva ? 'Tu carta cambió' : 'La tuya') : 'Las de cada rapero'}</small>
        </a>
        <a className="pu lb lb-pa" href="#/pase">
          <span className="lb-t">PASE</span>
          {a ? <span className="lb-reloj">TAREAS: {falta(hastaMedianocheET(ahora))}</span> : null}
          <span className="lb-nivel"><b>{a ? P.nivel : 30}</b><small>{a ? 'TU NIVEL' : 'NIVELES'}</small></span>
          <i className="lb-barra"><u style={{ width: (a ? Math.round((100 * a.lleva) / a.de) : 0) + '%' }} /></i>
          <small>{a ? num(a.falta) + ' XP para el siguiente' : 'Tareas que dan premios'}</small>
        </a>
        <a className="pu lb lb-ti" href="#/tienda">
          <span className="lb-big"><Ico n="moneda" t={34} /></span>
          <span className="lb-ti-t"><span className="lb-t">TIENDA</span>
            <small>{saldo != null ? 'Tenés ' + num(saldo) + ' Puntos de Tienda' : 'Puntos, el precio por cabeza y la ropa'}</small></span>
        </a>
      </div>
    </section>
  );
}
