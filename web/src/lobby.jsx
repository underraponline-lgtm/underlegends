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
import { Cara, Ico, aDiscord, accion, useCampana } from './piezas.jsx';
import { avance, usePase } from './pase.js';
import { cobrarRacha, useRacha } from './racha.js';
import { esDoble, eventoDelBoton, ganador, lados, llaveEnVivo, momentosLlave } from './arriba.jsx';

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

// ── ⏳ LA TEMPORADA: cuánto falta y dónde estás contra el top 16 (Dlx, 13/10/2026, a las ideas del research: «me gustan
// todas»). La fecha es la de `comun/temporada.py` (`fase.termina` del payload): el último día entero, en hora del este
// —en diciembre, EST—. El top 16 es el del torneo de cierre, contado igual que el Ranking (`clasificados()` de
// ranking.jsx): los primeros 16 CON NÚMERO de la Temporada, por OVR. Sin número tuyo, sólo los días
function cuentaT1(liga) {
  const fin = (liga.d.fase || {}).termina;
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(liga.ahora));
  const dias = fin ? Math.round((Date.parse(fin) - Date.parse(hoy)) / 86400000) : NaN;
  if (!(dias >= 0)) return null;
  const yo = liga.yo;
  let top = '';
  if (yo && yo.pos) {
    const clas = (liga.d.tabla || []).filter((f) => f.pos).sort((a, b) => a.pos - b.pos).slice(0, 16);
    if (clas.some((f) => f.k === yo.k)) top = 'Estás en el top 16: jugás la Clausura';
    else if (clas.length === 16) {
      const d = (clas[15].ovr || 0) - (yo.ovr || 0);
      top = d > 0 ? 'A ' + d + ' de OVR del top 16' : 'Pegado al top 16';
    }
  }
  return { tag: (liga.temp || 'T1') + ' · ' + (dias === 0 ? 'TERMINA HOY' : dias === 1 ? 'FALTA 1 DÍA' : dias + ' DÍAS'), top };
}

// eslint-disable-next-line no-unused-vars
function Temporada({ liga }) {
  const fin = (liga.d.fase || {}).termina;
  // días de calendario en el este: del 13/10 al 31/12 son 79, aunque queden horas de hoy; el 31/12 «termina hoy»
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(liga.ahora));
  const dias = fin ? Math.round((Date.parse(fin) - Date.parse(hoy)) / 86400000) : NaN;
  if (!(dias >= 0)) return null;
  const yo = liga.yo;
  let top = '';
  if (yo && yo.pos) {
    const clas = (liga.d.tabla || []).filter((f) => f.pos).sort((a, b) => a.pos - b.pos).slice(0, 16);
    if (clas.some((f) => f.k === yo.k)) top = 'ESTÁS EN EL TOP 16: JUGÁS LA CLAUSURA';
    else if (clas.length === 16) {
      const d = (clas[15].ovr || 0) - (yo.ovr || 0);
      top = d > 0 ? 'A ' + d + ' DE OVR DEL TOP 16' : 'PEGADO AL TOP 16';
    }
  }
  return (
    <a className="lb-t1" href="#/ranking">
      <b>{(liga.temp || 'T1') + ' · ' + (dias === 0 ? 'TERMINA HOY' : dias === 1 ? 'FALTA 1 DÍA' : 'FALTAN ' + dias + ' DÍAS')}</b>
      {top ? <span>{top}</span> : null}
    </a>
  );
}

// ── 🎁 EL PREMIO DE LA SEMANA (Dlx, 13/10/2026, la misma tanda; y «lo de azar lo vamos a incluir eventualmente»: por
// ahora sin azar). 50 Puntos de Tienda y 50 por cada día que entraste la semana pasada, hasta 400, una vez por semana
// (`semanal()` en bot/avisos.js): se ve cuánto ANTES de tocar. Cobrado, dice cuándo viene el próximo. Sin cuenta, nada
const fechaCorta = (dia) => { const [, m, d] = String(dia || '').split('-'); return d && m ? Number(d) + '/' + Number(m) : ''; };
async function pedirSemanal(cobrar) {
  const r = await fetch('/api/avisos/semanal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cobrar }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || String(r.status));
  return j;
}
// ── 🔥 LA RACHA, A LA VISTA (Dlx, 13/10/2026: «eso de cobrado, si está cobrado, no debería estar ahí… ahí debería ser
// el DAILY STREAK que habíamos acordado»). La racha existe desde la 2.30 —entrar a la página, usar el bot o jugar— y
// sólo se veía como un 🔥 chiquito en tu barra. Ahora, con el premio de la semana ya cobrado, ocupa su lugar: los siete
// días de esta semana, cuántos llevás y cuánto falta para los próximos Puntos de Tienda (cada `cada` días, `premio`)
const LETRAS_DIA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
// 🔥 LA RACHA CON SU PREMIO DE CADA DÍA (Dlx, 13/10/2026: «que este daily streak tenga sus propias recompensas», y «La racha
// lo reemplaza» al premio de la semana). Los siete días de esta semana con lo que paga cada uno; el de hoy se cobra con un
// toque (si no, se pierde: no se cobra después) y el domingo es un cofre si entraste 5 días. Ver `RACHA_DIA` en avisos.js
function Racha({ R }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const r = (R && R.racha) || {};
  const ps = (R && R.premios) || [];
  if (!ps.length) return null;
  const actual = r.actual || 0;
  const hoy = ps.find((x) => x[0] === R.hoy);
  const cobrar = async () => {
    setOcup(true); setMsg('');
    const d = await cobrarRacha('dia').catch(() => null);
    setMsg(d && d.cobrado ? '+' + num(d.cobrado) + ' Puntos de Tienda' : 'No se pudo: probá de nuevo.');
    setOcup(false);
  };
  return (
    <section className="lb-racha" aria-label="Tu racha">
      <div className="lb-racha-cab">
        <span className="lb-racha-n"><Ico n="fuego" t={26} /><b>{actual}</b></span>
        <span className="lb-racha-tx"><b>{actual === 1 ? '1 DÍA SEGUIDO' : actual + ' DÍAS SEGUIDOS'}</b>
          <small>{R.hito ? 'A los ' + R.hito[0] + ' días: +' + num(R.hito[1]) : 'Entrá todos los días: la página, el bot o un evento'}
            {r.maxima > actual ? ' · tu mejor: ' + r.maxima : ''}</small></span>
        {hoy && hoy[3] ? <button type="button" className="btn verde chico" disabled={ocup} onClick={cobrar}>{ocup ? '…' : 'Cobrar ' + num(hoy[1])}</button>
          : msg ? <small className="lb-racha-ok" role="status">{msg}</small> : null}
      </div>
      <ol className="lb-premios">{ps.map(([d, monto, cobrado, , cofre], i) => (
        <li key={d} className={(cobrado ? 'si' : '') + (d === R.hoy ? ' hoy' : '') + (d > R.hoy ? ' luego' : '') + (i === 6 ? ' cofre' : '')}
          title={i === 6 ? (cofre ? 'Cofre: entraste ' + (R.cofre_dias || 5) + ' días' : 'Cofre si entrás ' + (R.cofre_dias || 5) + ' días de la semana') : d}>
          <small>{LETRAS_DIA[i]}</small>
          {cobrado ? <Ico n="ok" t={16} /> : <Ico n={i === 6 ? 'premio' : 'moneda'} t={16} />}
          <b>{num(monto)}</b>
        </li>
      ))}</ol>
      {ps[6] && !ps[6][4] && !ps[6][2] ? <small className="lb-racha-pie">El domingo es un cofre de {num(300)} si entrás {R.cofre_dias || 5} días de la semana.</small> : null}
    </section>
  );
}

// 🌱 «TUS PRIMEROS 7 DÍAS» (Dlx, 13/10/2026: «hacer así también uno especial para los nuevos», y «Así, con tareas»): en
// vez de la racha, la primera semana. Un paso por día; cada uno pide algo chico que enseña una parte de la Liga
const IR_PASO = { seguir: '#/ranking', campana: '#/avisos', llave: '#/eventos', verificar: '#/cuenta/verificar', anotarse: '#/eventos' };
function Bienvenida({ B }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const pasos = B.pasos || [];
  const ahora = pasos[B.paso];
  if (!ahora) return null;
  const cobrar = async () => {
    setOcup(true); setMsg('');
    const d = await cobrarRacha('bienvenida').catch(() => null);
    setMsg(d && d.cobrado ? '+' + num(d.cobrado) + ' Puntos de Tienda. Mañana, el que sigue.' : d && d.error === 'falta' ? 'Primero: ' + ahora[2].toLowerCase() + '.'
      : d && d.error === 'manana' ? 'Uno por día: volvé mañana.' : 'No se pudo: probá de nuevo.');
    setOcup(false);
  };
  return (
    <section className="lb-racha lb-bien" aria-label="Tus primeros 7 días">
      <div className="lb-racha-cab">
        <span className="lb-racha-n"><Ico n="premio" t={24} /><b>{B.paso + 1}</b><small>/7</small></span>
        <span className="lb-racha-tx"><b>TUS PRIMEROS 7 DÍAS</b>
          <small>{B.hoy ? 'Ya cobraste el de hoy: mañana viene el que sigue.' : B.hecha ? 'Listo: cobrá ' + num(ahora[0]) + ' Puntos de Tienda.'
            : 'Hoy: ' + ahora[2].toLowerCase() + ' y cobrás ' + num(ahora[0]) + '.'}</small></span>
        {!B.hoy && B.hecha ? <button type="button" className="btn verde chico" disabled={ocup} onClick={cobrar}>{ocup ? '…' : 'Cobrar ' + num(ahora[0])}</button>
          : !B.hoy && IR_PASO[ahora[1]] ? <a className="btn verde chico" href={IR_PASO[ahora[1]]}>Ir</a> : null}
      </div>
      <ol className="lb-premios">{pasos.map(([monto, clave, texto, cobrado], i) => (
        <li key={clave} className={(cobrado ? 'si' : '') + (i === B.paso ? ' hoy' : '') + (i > B.paso ? ' luego' : '') + (i === 6 ? ' cofre' : '')} title={texto}>
          <small>{i + 1}</small>
          {cobrado ? <Ico n="ok" t={16} /> : <Ico n={i === 6 ? 'premio' : 'moneda'} t={16} />}
          <b>{num(monto)}</b>
        </li>
      ))}</ol>
      {msg ? <small className="lb-racha-ok" role="status">{msg}</small> : null}
    </section>
  );
}

// eslint-disable-next-line no-unused-vars
function PremioSemanal({ dc, R }) {
  const [st, setSt] = useState(null);
  const [ocup, setOcup] = useState(false);
  useEffect(() => {
    if (!dc) return undefined;
    let vivo = true;
    pedirSemanal(false).then((j) => { if (vivo) setSt(j); }).catch(() => { /* sin sesión o sin red: no se dibuja */ });
    return () => { vivo = false; };
  }, [dc && dc.id]);
  if (!dc || !st) return null;
  const cobrar = async () => {
    setOcup(true);
    try {
      setSt(await pedirSemanal(true));
      // el saldo de tu barra se actualiza (avisa `lg:precios`)
      if (typeof W.pedirBilletera === 'function') { try { W.pedirBilletera(); } catch (e) { /* sin saldo */ } }
    } catch (e) { setSt(Object.assign({}, st, { error: true })); }
    setOcup(false);
  };
  // cobrado, el lugar es de la racha (y el próximo premio lo dice la racha misma: cada día que entres suma)
  if (st.cobrado) return <Racha R={R} />;
  return (
    <div className="lb-sem"><Ico n="moneda" t={24} />
      <span><b>PREMIO DE LA SEMANA · {num(st.monto)} PUNTOS</b>
        <small>{st.error ? 'No se pudo cobrar: probá de nuevo.' : st.dias
          ? 'Entraste ' + st.dias + (st.dias === 1 ? ' día' : ' días') + ' la semana pasada: 50 + 50 por cada uno.'
          : '50 de base, y la semana que viene 50 más por cada día que entres.'}</small></span>
      <button type="button" className="btn verde chico" disabled={ocup} onClick={cobrar}>{ocup ? '…' : 'Cobrar'}</button>
    </div>
  );
}

// ── 👀 TUS SEGUIDOS HOY (Dlx, 13/10/2026, la misma tanda): de la gente que seguís, quién juega hoy —anotado en un evento en
// vivo o de las próximas 18 horas, lo que junta el vigía de los canales de inscripción (`anotados()`)— y quién ganó en
// las últimas 36. Sin nada, no se dibuja: «sin dato no hay pieza»
// eslint-disable-next-line no-unused-vars
function Seguidos({ liga }) {
  const sig = new Set(liga.sigue || []);
  if (!sig.size) return null;
  const out = new Map();
  const vivos = liga.vivo();
  const hasta = liga.ahora + 18 * 3600000;
  for (const e of vivos.concat(liga.luego().filter((x) => utc(liga.cuandoDe(x)) <= hasta))) {
    for (const x of liga.anotados(e)) {
      const k = x.f && x.f.k;
      if (k && sig.has(k) && !out.has(k)) {
        out.set(k, { k, n: x.f.n, que: (vivos.includes(e) ? 'juega ahora' : 'juega ' + liga.dia(liga.cuandoDe(e))) + ' · ' + limpio(e.nombre) });
      }
    }
  }
  for (const ll of liga.llavesPorFecha()) {
    if (liga.ahora - utc(liga.fechaLlave(ll)) > 36 * 3600000) break;
    for (const n of liga.campeon(ll)) {
      const f = liga.fila(n);
      if (f && sig.has(f.k) && !out.has(f.k)) out.set(f.k, { k: f.k, n: f.n, que: 'ganó ' + limpio(ll.nombre) });
    }
  }
  const l = [...out.values()].slice(0, 6);
  if (!l.length) return null;
  return (
    <section className={'lb-sig' + (l.length === 1 ? ' uno' : '')} aria-label="Tus seguidos hoy">
      <span className="lb-sig-t">TUS SEGUIDOS<br />HOY</span>
      <ul>{l.map((x) => (
        <li key={x.k}><a href={'#/r/' + encodeURIComponent(x.k)}>
          <Cara liga={liga} k={x.k} nombre={x.n} cls="lb-sig-c" /><b>{limpio(x.n)}</b><small>{x.que}</small>
        </a></li>
      ))}</ul>
    </section>
  );
}

// ── 🎯 TU RIVAL (Dlx, 13/10/2026: «tus seguidos hoy está arriba, estamos repitiendo algo», y a la propuesta, «Sí, tu
// rival»). Lo que hacía «Tus seguidos hoy» ya lo dice la fila de arriba (los campeones y los que juegan). Esto es tuyo y
// no se repite: quién está justo arriba tuyo en la Temporada, cuántos puntos te faltan para pasarlo y su próximo evento
// (si está anotado). El primero ve al segundo, que lo persigue. Sin puesto, cómo conseguir uno; sin cuenta, nada
function Rival({ liga, dc }) {
  const yo = liga.yo;
  if (!dc) return null;
  const tabla = (liga.d.tabla || []).filter((f) => f.pos);
  if (!yo || !yo.pos) {
    return (
      <a className="lb-rival vacio" href="#/eventos">
        <span className="lb-rival-tx"><b>TU RIVAL</b><small>Jugá un evento: entrás al ranking y te ponemos a alguien para pasar.</small></span>
        <Ico n="flecha" t={18} />
      </a>
    );
  }
  const yoF = tabla.find((f) => f.k === yo.k) || yo;
  const arriba = yo.pos > 1;
  const otro = tabla.find((f) => f.pos === (arriba ? yo.pos - 1 : yo.pos + 1));
  if (!otro) return null;
  // ⚠️ POR OVR, NO POR PUNTOS: el ranking se ordena por OVR (Oasis es #1 con menos puntos que Snow), así que «te faltan
  // N puntos» podía decir algo que no te pasa de puesto
  const dif = Math.abs((otro.ovr || 0) - (yoF.ovr || 0));
  // su próximo evento: en vivo o de las próximas 24 h, si está anotado (lo que junta el vigía: `anotados()`)
  let prox = '';
  const vivos = liga.vivo();
  const hasta = liga.ahora + 24 * 3600000;
  for (const e of vivos.concat(liga.luego().filter((x) => utc(liga.cuandoDe(x)) <= hasta))) {
    if (liga.anotados(e).some((x) => x.f && x.f.k === otro.k)) {
      prox = (vivos.includes(e) ? 'juega ahora ' : 'juega ' + liga.dia(liga.cuandoDe(e)) + ' ') + '· ' + limpio(e.nombre);
      break;
    }
  }
  const pct = arriba && (otro.ovr || 0) > 0 ? Math.max(4, Math.min(100, Math.round((100 * (yoF.ovr || 0)) / otro.ovr))) : 100;
  const falta = !dif ? (arriba ? 'Empatados en OVR: un evento más y lo pasás' : 'Empatados en OVR: no aflojes')
    : arriba ? 'Te faltan ' + dif + ' de OVR para pasarlo' : 'Le llevás ' + dif + ' de OVR';
  return (
    <a className="lb-rival" href={'#/r/' + encodeURIComponent(otro.k)}>
      <span className="lb-rival-p"><Cara liga={liga} k={yo.k} nombre={yo.n} cls="lb-rival-c" /><b>#{yo.pos}</b></span>
      <span className="lb-rival-tx">
        <b>{arriba ? 'TU RIVAL: ' + limpio(otro.n).toUpperCase() : 'TE PERSIGUE ' + limpio(otro.n).toUpperCase()}</b>
        <small>{falta}{prox ? ' · ' + prox : ''}</small>
        <i className="lb-rival-barra"><u style={{ width: pct + '%' }} /></i>
      </span>
      <span className="lb-rival-p"><Cara liga={liga} k={otro.k} nombre={otro.n} cls="lb-rival-c otro" /><b>#{otro.pos}</b></span>
    </a>
  );
}

// ── ⚡ «¡TE TOCA!»: tu momento en tu llave en vivo (Dlx, 13/10/2026, de los toques del research de los lobbies: «¡Te
// toca!» en el botón). Con la misma lectura que la llave corta (`momentosLlave()`: «AHORA» sólo si se juega en orden):
// te toca, sos el próximo, esperás tu turno, pasaste, o quedaste afuera. La ronda más honda donde aparecés dice cómo te
// fue: si pasaste, ya estás en la siguiente. `null` si la llave todavía no te nombra
const sinBandera = (s) => String(s || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
export function tuMomento(liga, L) {
  const yo = liga.yo;
  if (!yo || !L) return null;
  const mio = (lado) => String(lado || '').split(/\s*[,+&]\s*/).some((n) => {
    const f = liga.fila(sinBandera(n));
    return !!(f && f.k === yo.k);
  });
  const contra = (ls) => ls.filter((x) => !mio(x)).map(sinBandera).join(' y ');
  const m = momentosLlave(L);
  if (m && m.ahora && m.ahora.lados.some(mio)) return { et: '¡TE TOCA!', sub: m.ahora.r + ' · contra ' + contra(m.ahora.lados), toca: true };
  if (m && m.sigue && m.sigue.lados.some(mio)) return { et: 'SOS EL PRÓXIMO', sub: m.sigue.r + ' · contra ' + contra(m.sigue.lados), toca: true };
  let ult = null;
  (L.rondas || []).forEach((R) => (R.b || []).forEach((b) => { if (lados(b).length >= 2 && lados(b).some(mio)) ult = { r: R.r, b }; }));
  if (!ult) return null;
  const r = String(ult.r || '');
  const g = ganador(ult.b);
  if (!g) return { et: 'ESPERÁ TU TURNO', sub: r + ' · contra ' + contra(lados(ult.b)) };
  if (mio(g)) {
    if (r === 'Final') return { et: '¡SOS EL CAMPEÓN!', sub: 'Ganaste la final' };
    if (r === 'Tercer puesto') return { et: '¡TERCER PUESTO!', sub: 'Ganaste el tercer puesto' };
    return { et: 'PASASTE ' + r.toUpperCase(), sub: 'Seguís en carrera: esperá la próxima ronda' };
  }
  if (r === 'Final') return { et: '¡SUBCAMPEÓN!', sub: 'Llegaste a la final' };
  if (r === 'Tercer puesto') return { et: 'CUARTO PUESTO', sub: 'Llegaste a las semifinales' };
  // la doble se ve por su llave de perdedores o, antes de que se escriba, por la de ganadores
  const doble = esDoble(L.rondas) || (L.rondas || []).some((R) => /ganadores/i.test(R.r || ''));
  if (doble && !/perdedores/i.test(r)) return { et: 'PERDISTE EN ' + r.toUpperCase(), sub: 'Bajás a la llave de perdedores: seguís' };
  return { et: 'QUEDASTE AFUERA EN ' + r.toUpperCase(), sub: 'Te ganó ' + sinBandera(g), afuera: true };
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
    let t = null;
    try { t = tuMomento(liga, L); } catch (err) { t = null; }
    // quedaste afuera: el próximo evento, para volver (sin otro botón: el de la llave se queda)
    const otro = t && t.afuera ? luego.find((x) => x !== vivoMio) : null;
    return (
      <div className={'lb-boton vivo' + (t && t.toca ? ' toca' : '')}>
        <span className="lb-b-et"><i />{t ? t.et : 'TU EVENTO ESTÁ EN VIVO'}</span>
        <span className="lb-b-ev"><img alt="" src={liga.logo(vivoMio.sv)} /><b>{limpio(vivoMio.nombre)}</b></span>
        {t ? (
          <span className="lb-b-pr">
            <em>{t.sub}</em>
            {otro ? <em className="gris">El próximo: {limpio(otro.nombre)} · en {falta(utc(otro.cuando) - ahora) || 'un rato'}</em> : null}
          </span>
        ) : null}
        {L ? <button type="button" className="btn verde" onClick={() => accion.llave('v:' + L.id)}>Ver la llave</button>
          : dd ? <a className="btn verde" href={dd.url} target="_blank" rel="noopener noreferrer">{dd.txt}</a> : null}
      </div>
    );
  }
  // 2 · en el que estás anotado, y 3 · si no, el próximo para anotarte (el de tu servidor primero, en las próximas 36 h):
  // `eventoDelBoton()`, que el escenario usa para no repetirlo
  const { e, anotado } = eventoDelBoton(liga);
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
  // 🎯 EL BUSCADO EN TU EVENTO (Dlx, 13/10/2026, «me gusta»): si alguien de Se busca que sigue suelto está anotado, el
  // botón lo dice y cuánto cobrás. Vos no contás: si te buscan a vos, eso ya lo dice Se busca
  const anot = liga.anotados(e);
  const juegan = ((liga.d.mw || {}).b || []).filter((b) => b.e !== 'cazado' && b.e !== 'escondio' && !(yo && b.k === yo.k)
    && anot.some((x) => x.f && x.f.k === b.k));
  const cobras = juegan.reduce((mx, b) => Math.max(mx, Number(b.v) || 0), 0);
  // 🔁 tu debut ya lo dice el escenario («Tu evento», las primeras 48 h): acá, recién después
  const debut = primero && (ahora - utc(liga.fechaLlave(primero[0]))) / 3600000 >= 48 ? primero : null;
  return (
    <div className={'lb-boton' + (anotado ? ' anotado' : '')}>
      <span className="lb-b-et">{et} · EMPIEZA EN {falta(utc(e.cuando) - ahora) || 'UN RATO'}</span>
      <span className="lb-b-ev"><img alt="" src={liga.logo(e.sv)} /><b>{limpio(e.nombre)}</b></span>
      {reto || m > 1 || debut || juegan.length ? (
        <span className="lb-b-pr">
          {juegan.length ? (
            <em className="mw">{juegan.length === 1 ? 'Juega ' + limpio(juegan[0].n) : 'Juegan ' + juegan.slice(0, 3).map((b) => limpio(b.n)).join(', ')}
              , de Se busca{cobras ? ': ' + (juegan.length === 1 ? 'ganale y cobrás ' : 'cobrás hasta ') + num(cobras) + ' pts' : ''}</em>
          ) : null}
          {reto ? <em>Jugalo antes del {liga.dia(new Date(vence))} y ganás 1.000 Puntos de Tienda</em> : null}
          {m > 1 ? <em>{siglaDe(e.sv)} va {mult(m)} esta semana</em> : null}
          {debut ? <em className="gris">Tu debut: {limpio(debut[0].nombre)} · +{num(debut[2])} pts</em> : null}
        </span>
      ) : null}
      {anotado ? <a className="btn verde" href="#/avisos"><Ico n="campana" t={18} />Avisame cuando empiece</a>
        : ins ? <a className="btn verde lb-b-ya" href={ins.url} target="_blank" rel="noopener noreferrer">Anotarme</a> : null}
    </div>
  );
}

// ── 🔔 LA CAMPANA, EN EL MOMENTO JUSTO (Dlx, 13/10/2026: «hacer todo»). El 13/10 la tenían 9 teléfonos, y todo aviso al
// celular —te toca, tu carta, te pasaron, tu racha— le llega sólo a esos: es lo que más multiplica lo demás. Se pide a
// quien ya jugó (ya le puede pasar algo), con su sesión, debajo de su próximo evento; no donde el botón grande ya la
// ofrece (sin evento anunciado, o ya anotado) ni a quien ya la tiene vinculada. Son dos pasos: activarla en este
// teléfono y vincularla con tu Discord (los tuyos). «Ahora no» la esconde una semana
function PedirCampana({ liga, dc }) {
  const c = useCampana();
  const [no, setNo] = useState(() => { const t = leer('lg:lb-camp-no'); return !!(t && Date.now() - t < 7 * 864e5); });
  const C = W.Campana;
  const yo = liga.yo;
  if (!dc || !yo || !(yo.ev >= 1) || no || !c || !C) return null;
  if (!c.soporta || c.negado || (c.ios && !c.instalada) || c.pausada) return null;
  if (c.activa && c.yo && c.yo.id) return null;
  const b = eventoDelBoton(liga);
  if (!b.e || b.anotado) return null;
  const paso2 = !!c.activa;
  return (
    <div className="lb-camp">
      <span className="lb-camp-ic"><Ico n="campana" t={22} /></span>
      <span className="lb-camp-t"><b>{paso2 ? 'FALTA UN PASO' : '¿TE AVISAMOS CUANDO TE TOQUE?'}</b>
        <small>{paso2 ? 'Vinculá este teléfono con tu Discord y te llegan los tuyos: te toca, tu carta, te pasaron.'
          : 'Cuando te toca pelear, sale tu carta o te pasan en el ranking: al teléfono, al momento. Nunca por DM.'}</small></span>
      <span className="lb-camp-b">
        <button type="button" className="btn verde chico" onClick={() => (paso2 ? C.vincular() : C.activar())}>{paso2 ? 'Vincular' : 'Activar'}</button>
        <button type="button" className="lb-camp-no" onClick={() => { guardar('lg:lb-camp-no', Date.now()); setNo(true); }}>Ahora no</button>
      </span>
    </div>
  );
}

// 🖼️ LAS PUERTAS CON ALGO PARA VER, como el abanico de Tarjetas (Dlx, 13/10/2026: «me gustaría que cada botón, o sea
// como Pase, Ranking y Eventos, tengan algo así visual»). Cada dibujo sale de un dato, no es adorno: los logos de los
// servidores que juegan esta semana (el que está en vivo, marcado), las caras del podio con el color de su letra, y las
// Tareas de hoy, hechas o no. Sin dato no hay dibujo
//: el ícono de cada Tarea, por cómo empieza su id (`bot/pase.py`: DIARIAS y SEMANALES)
const ICO_TAREA = [['entrar', 'yo'], ['dias', 'reloj'], ['felicitar', 'premio'], ['vivo', 'mira'], ['dra', 'micro'], ['precio', 'moneda']];
const icoTarea = (id) => (ICO_TAREA.find(([p]) => String(id || '').startsWith(p)) || [0, 'pase'])[1];

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
  const evSemana = (liga.d.calendario || []).filter((c) => !liga.canceladoCal(c) && utc(c.t) >= l0 && utc(c.t) < l0 + 7 * 86400000);
  const semana = evSemana.length;
  const vivos = liga.vivo();
  const enVivo = vivos.length;
  // 🖼️ los servidores de la semana, de más eventos a menos; el que está en vivo, primero
  const svVivo = new Set(vivos.map((e) => e.sv).filter(Boolean));
  const porSv = {};
  for (const c of evSemana) if (c.sv) porSv[c.sv] = (porSv[c.sv] || 0) + 1;
  const logos = Object.entries(porSv).filter(([sv]) => liga.logo(sv))
    .sort((x, y) => (svVivo.has(y[0]) - svVivo.has(x[0])) || y[1] - x[1]);
  // 🖼️ el podio: #2, #1 y #3, con el color de su letra
  const podio = [2, 1, 3].map((p) => (liga.d.tabla || []).find((f) => f.pos === p)).filter(Boolean);
  // ⏳ cuánto falta de la temporada: una etiqueta en la puerta del Ranking, como «VENCE EN» de Se busca (Dlx: «puede
  // estar en cualquier otro lado así ocupa menos espacio»)
  const t1 = cuentaT1(liga);
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
  const hoy = a && P.hoy && Array.isArray(P.hoy.tareas) && P.hoy.tareas.length ? P.hoy.tareas : null;
  const hechas = hoy ? hoy.filter((t) => t.hecha).length : 0;
  // 💰 la cabeza más cara de la semana (`valorCabezas()` de app.js; se redibuja con `lg:precios`, como el saldo)
  const valor = typeof window.valorCabezas === 'function' ? window.valorCabezas() || {} : {};
  const cara = Object.keys(valor).filter((c) => valor[c] > 0).sort((x, y) => valor[y] - valor[x])[0] || '';
  // 🔒 LA PUERTA SIN NADA TUYO DICE QUÉ LA ABRE (Dlx, 13/10/2026, «me gusta»; el research: como la Bloqueada dice cuánto
  // falta). Sin entrar con Discord no: eso ya lo pide tu barra, y tres puertas diciéndolo sería repetirlo
  const sinVerif = !!(dc && P && P.listo && !P.miembro);
  return (
    <section className="lobby" aria-label="Tu lobby">
      <TuBarra liga={liga} dc={dc} P={P} R={R} saldo={saldo} />
      {/* 🔥 la racha (o 🌱 la bienvenida, si sos nuevo) reemplaza al premio de la semana (Dlx: «La racha lo reemplaza») */}
      {dc && R ? (R.bienvenida ? <Bienvenida B={R.bienvenida} /> : <Racha R={R} />) : null}
      <ElBoton liga={liga} />
      <PedirCampana liga={liga} dc={dc} />
      <Rival liga={liga} dc={dc} />
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
          <span className="lb-fila">
            <span className="lb-nivel"><b>{semana}</b><small>{semana === 1 ? 'EVENTO' : 'EVENTOS'}</small></span>
            {logos.length ? <span className="lb-vis lb-logos" aria-hidden="true">{logos.slice(0, 4).map(([sv, n]) => (
              <span key={sv} className={'lb-logo' + (svVivo.has(sv) ? ' vivo' : '')}><img alt="" loading="lazy" src={liga.logo(sv)} /><i>{n}</i></span>
            ))}{logos.length > 4 ? <span className="lb-mas">+{logos.length - 4}</span> : null}</span> : null}
          </span>
          <small>esta semana en la Liga</small>
        </a>
        <a className="pu lb lb-rk" href="#/ranking" onClick={() => { if (pos) guardar('lg:lb-pos', pos); }}>
          <span className="lb-t">RANKING</span>
          {t1 ? <span className="lb-reloj">{t1.tag}</span> : null}
          {subio ? <span className="lb-glob" aria-label="cambió tu puesto">{subio > 0 ? '▲' : '▼'}</span> : null}
          <span className="lb-fila">
            {pos ? <span className="lb-nivel"><b>#{pos}</b><small>{subio ? (subio > 0 ? 'SUBISTE ' + subio : 'BAJASTE ' + -subio) : 'TU PUESTO'}</small></span>
              : <span className="lb-nivel"><b>#1</b><small>{uno ? limpio(uno.n).toUpperCase() : 'LA TEMPORADA'}</small></span>}
            {podio.length === 3 ? <span className="lb-vis lb-podio" aria-hidden="true">{podio.map((f) => (
              <span key={f.k} className={'lb-pod p' + f.pos} style={{ '--rgc': f.rgc || '#F5C542' }}>
                <Cara liga={liga} k={f.k} nombre={f.n} cls="lb-pod-c" /><b>{f.pos}</b></span>
            ))}</span> : null}
          </span>
          <small>{pos ? (t1 && t1.top ? t1.top : 'en la Temporada') : dc && !yo ? 'Jugá un evento y entrás a la tabla'
            : dc && (sinVerif || yo.fc) ? 'Verificate en DRA y entrás al ranking oficial' : 'Las tablas de la temporada'}</small>
        </a>
        <a className="pu lb lb-tj" href="#/tarjetas" onClick={() => { if (tuya) guardar('lg:lb-carta', tuya); }}>
          <span className="lb-t">TARJETAS</span>
          {cartaNueva ? <span className="lb-glob nueva">NUEVA</span> : null}
          <span className="lb-abanico">{tuya ? <img alt="" loading="lazy" src={tuya} className="sola" />
            : otras.map((f) => <img key={f.k} alt="" loading="lazy" src={liga.cartaUrl(f.k, 'temporada')} />)}</span>
          <small>{tuya ? (cartaNueva ? 'Tu carta cambió' : 'La tuya') : sinVerif ? 'Verificate en DRA y tenés tu primera carta'
            : 'Las de cada rapero'}</small>
        </a>
        {/* 🔁 CADA DATO UNA VEZ, también adentro del lobby (Dlx, 13/10/2026: «evitar que se repitan las cosas»): tu nivel
            y tus Puntos ya están en tu barra, así que la puerta del Pase muestra las Tareas de hoy y la de la Tienda, la
            cabeza más cara de la semana */}
        <a className="pu lb lb-pa" href="#/pase">
          <span className="lb-t">PASE</span>
          {a ? <span className="lb-reloj">VENCEN EN {falta(hastaMedianocheET(ahora))}</span> : null}
          <span className="lb-fila">
            {a && hoy ? <span className="lb-nivel"><b>{hechas}/{hoy.length}</b><small>{hechas === hoy.length ? 'HECHAS HOY' : 'TAREAS DE HOY'}</small></span>
              : <span className="lb-nivel"><b>30</b><small>NIVELES</small></span>}
            {a && hoy ? <span className="lb-vis lb-tareas">{hoy.map((t) => (
              <span key={t.id} className={'lb-tarea' + (t.hecha ? ' hecha' : '')} title={t.t + (t.hecha ? ' · hecha' : '')}>
                <Ico n={icoTarea(t.id)} t={22} />{t.hecha ? <i aria-hidden="true">✓</i> : null}</span>
            ))}</span> : <span className="lb-vis lb-ticket" aria-hidden="true"><Ico n="pase" t={34} /></span>}
          </span>
          <i className="lb-barra"><u style={{ width: (a && hoy ? Math.round((100 * hechas) / hoy.length) : 0) + '%' }} /></i>
          <small>{a && hoy ? (hechas === hoy.length ? 'Mañana vienen otras' : 'Cada una te da XP')
            : sinVerif ? 'Es de los miembros de DRA: verificate para subir de nivel' : 'Tareas que dan premios'}</small>
        </a>
        <a className="pu lb lb-ti" href="#/tienda">
          <span className="lb-big"><Ico n="moneda" t={34} /></span>
          <span className="lb-ti-t"><span className="lb-t">TIENDA</span>
            <small>{cara ? 'La cabeza más cara: ' + limpio((liga.fila(cara) || {}).n || cara) + ' · ' + num(valor[cara])
              : saldo != null ? 'Ponele precio a la cabeza de alguien' : 'Todos arrancan con Puntos de Tienda'}</small></span>
        </a>
      </div>
    </section>
  );
}
