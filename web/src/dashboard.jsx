// 🔒 EL DASHBOARD DEL DUEÑO (Dlx, 04/10/2026: «el bot y la página, que esté en una página nueva creada sólo para el
// owner… la única manera de iniciar sesión ahí es con mi cuenta… ahí poné esa información y configuraciones extras»).
//
// ⚠️ LA PUERTA NO ES ESTA PÁGINA: es `/avisos/dueno` en bot/avisos.js, que le pregunta a Discord (o a la sesión) quién
// es y contesta 403 a cualquiera que no sea Dlx. Acá sólo se dibuja lo que el servidor manda. Sin cuenta, el botón de
// entrar; con otra cuenta, «esta página es del dueño» y nada más.
import { useEffect, useState } from 'react';
import { num } from './liga.js';

const W = typeof window !== 'undefined' ? window : {};
const entrar = () => { if (W.urlLogin) W.location.href = W.urlLogin('o'); };
const corto = (dia) => Number(dia.slice(8, 10)) + '/' + Number(dia.slice(5, 7));

function Cajas({ u }) {
  const s = u.semana || {}, a = u.anterior || {};
  const antes = (x, y) => ((a.dias || 0) >= 7 && y != null ? (x >= y ? '+' : '') + num(x - y) + ' contra la anterior' : null);
  const cajas = [
    ['USARON EL BOT', s.bot, antes(s.bot, a.bot) || 'personas distintas'],
    ['CON SU CUENTA', s.web, antes(s.web, a.web) || 'entraron a la página con Discord'],
    ['EN TOTAL', s.personas, antes(s.personas, a.personas) || 'en el bot o en la página'],
    ['VISITAS POR DÍA', s.visitas_dia, antes(s.visitas_dia, a.visitas_dia) || 'navegadores, en promedio'],
  ];
  return <div className="act-4">{cajas.map(([t, v, d]) => <div key={t}><span>{t}</span><b>{num(v || 0)}</b><small>{d}</small></div>)}</div>;
}

// día por día, las tres cosas en barras: el alto es contra el máximo de cada serie, así una no aplasta a las otras
function Dias({ dias }) {
  const tope = (k) => Math.max(1, ...dias.map((d) => d[k] || 0));
  const series = [['bot', 'Bot', 'var(--verde)'], ['web', 'Con su cuenta', 'var(--magenta)'], ['visitas', 'Visitas', '#A5A5A0']];
  return (
    <div className="db-dias">
      {series.map(([k, t, c]) => (
        <div key={k} className="db-serie">
          <span className="db-t">{t}</span>
          <div className="db-barras">{dias.map((d) => (
            <i key={d.dia} title={corto(d.dia) + ' · ' + (d[k] || 0)}><u style={{ height: (100 * (d[k] || 0) / tope(k)).toFixed(1) + '%', background: c }} /></i>
          ))}</div>
          <em>{num(dias[dias.length - 1][k] || 0)} hoy</em>
        </div>
      ))}
      <div className="db-fechas"><span>{corto(dias[0].dia)}</span><span>{corto(dias[dias.length - 1].dia)}</span></div>
    </div>
  );
}

function Sistema({ s, sesiones }) {
  const hace = (t) => {
    if (!t) return '—';
    const m = Math.round((Date.now() - (typeof t === 'number' ? t : Date.parse(t))) / 60000);
    return m < 1 ? 'recién' : m < 60 ? 'hace ' + m + ' min' : 'hace ' + Math.round(m / 60) + ' h';
  };
  const d = (s.disparador || {}).ultimo || {};
  const filas = [
    ['El vigía', s.ok ? 'anda · ' + hace(s.vigia) : '⚠️ no contesta · ' + hace(s.vigia)],
    ['El ciclo', d.t ? (d.ok ? 'disparado ' : '⚠️ falló ') + hace(d.t) : '—'],
    ['Dispositivos con la campana', num(s.suscripciones || 0)],
    ['Avisos en 24 h', num((s.ultimas_24h || {}).avisos || 0) + ' · ' + num((s.ultimas_24h || {}).enviados || 0) + ' enviados'],
    ['Sesiones abiertas', num(sesiones || 0) + ' personas'],
    ['Último error', s.ultimo_error ? s.ultimo_error.error + ' · ' + hace(s.ultimo_error.t) : 'ninguno'],
  ];
  return <dl className="db-sis">{filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

export function Dashboard({ dc }) {
  const [st, setSt] = useState({ cargando: true });
  useEffect(() => {
    if (!dc) { setSt({ sinCuenta: true }); return undefined; }
    let vivo = true;
    fetch('/api/avisos/dueno', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(async (r) => ({ r, j: await r.json().catch(() => ({})) }))
      .then(({ r, j }) => {
        if (!vivo) return;
        setSt(r.status === 403 ? { no: true } : r.status === 401 ? { sinCuenta: true } : r.ok ? { d: j } : { error: j.error || String(r.status) });
      })
      .catch(() => { if (vivo) setSt({ error: 'red' }); });
    return () => { vivo = false; };
  }, [dc]);
  useEffect(() => { W.scrollTo && W.scrollTo(0, 0); }, []);
  let cuerpo;
  if (st.cargando) cuerpo = <p className="pronto-p">Cargando…</p>;
  else if (st.sinCuenta) {
    cuerpo = (<><p className="pronto-p">Esta página es del dueño de la Liga. Entrá con tu cuenta de Discord.</p>
      <div className="cu-btns"><button type="button" className="btn verde chico" onClick={entrar}>Entrar con Discord</button></div></>);
  } else if (st.no) cuerpo = <p className="pronto-p">Esta página es sólo del dueño de la Liga.</p>;
  else if (st.error) cuerpo = <p className="pronto-p">No pude leerlo ({st.error}). Probá en un rato.</p>;
  else {
    const d = st.d || {};
    const u = d.uso || {};
    cuerpo = (
      <>
        <section className="act">
          <div className="mis-cab"><span>EL BOT Y LA PÁGINA · 7 DÍAS</span>{u.desde ? <em>se cuenta desde el {corto(u.desde)}</em> : null}</div>
          <Cajas u={u} />
        </section>
        {(d.dias || []).length ? (
          <section className="act">
            <div className="mis-cab"><span>DÍA POR DÍA · DOS SEMANAS</span></div>
            <Dias dias={d.dias} />
          </section>
        ) : null}
        <section className="act">
          <div className="mis-cab"><span>CÓMO ANDA TODO</span><em><a href="/mapa">el mapa en vivo ↗</a></em></div>
          <Sistema s={d.sistema || {}} sesiones={d.sesiones} />
        </section>
        <section className="act">
          <div className="mis-cab"><span>CONFIGURACIÓN</span></div>
          <p className="pronto-p">Acá van los ajustes de la Liga que sólo cambiás vos. Decime cuáles querés y los sumo.</p>
        </section>
      </>
    );
  }
  return (
    <section className="sec db">
      <div className="sec-t"><h1>Dashboard</h1></div>
      {cuerpo}
    </section>
  );
}
