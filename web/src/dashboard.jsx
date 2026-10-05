// 🔒 EL DASHBOARD DEL DUEÑO (Dlx, 04/10/2026: «el bot y la página, que esté en una página nueva creada sólo para el
// owner… la única manera de iniciar sesión ahí es con mi cuenta… ahí poné esa información y configuraciones extras»).
//
// ⚠️ LA PUERTA NO ES ESTA PÁGINA: es `/avisos/dueno` en bot/avisos.js, que le pregunta a Discord (o a la sesión) quién
// es y contesta 403 a cualquiera que no sea Dlx. Acá sólo se dibuja lo que el servidor manda. Sin cuenta, el botón de
// entrar; con otra cuenta, «esta página es del dueño» y nada más. Los ajustes pasan por la misma puerta
// (`/avisos/dueno/ajuste`), y el servidor valida cada valor antes de guardarlo.
import { useEffect, useState } from 'react';
import { limpio, mult, num, siglaDe } from './liga.js';
import { DosToques } from './piezas.jsx';

const W = typeof window !== 'undefined' ? window : {};
const entrar = () => { if (W.urlLogin) W.location.href = W.urlLogin('o'); };
const corto = (dia) => Number(dia.slice(8, 10)) + '/' + Number(dia.slice(5, 7));
// los que se pueden elegir a mano (el servidor acepta de ×0,5 a ×5)
const FACTORES = [0.5, 1, 1.5, 2, 3, 5];
const DURACIONES = [['1 hora', 1], ['6 horas', 6], ['1 día', 24], ['3 días', 72], ['1 semana', 168]];
// ✅ Decidir vive en el Operativo (sheet/construir_padron.py); las corridas del ciclo, en GitHub
const ATAJOS = [
  ['El mapa en vivo', '/mapa'],
  ['✅ Decidir y la Lista', 'https://docs.google.com/spreadsheets/d/1DFar2NSlC9YvkMQ_uKzLmfOrmthJ1lp-l3exP0NFHm8/edit'],
  ['Las corridas del ciclo', 'https://github.com/underraponline-lgtm/underlegends/actions'],
  ['Cloudflare', 'https://dash.cloudflare.com'],
];

// lo que contesta la puerta: `{d}` con todo, o en qué estado quedó
function pedirDueno() {
  return fetch('/api/avisos/dueno', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    .then(async (r) => ({ r, j: await r.json().catch(() => ({})) }))
    .then(({ r, j }) => (r.status === 403 ? { no: true } : r.status === 401 ? { sinCuenta: true } : r.ok ? { d: j } : { error: j.error || String(r.status) }))
    .catch(() => ({ error: 'red' }));
}

async function ajustar(cual, valor) {
  const r = await fetch('/api/avisos/dueno/ajuste', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cual, valor }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 401 ? 'la sesión venció: entrá de nuevo' : j.error || String(r.status));
  return j.ajustes || {};
}

const avisoVigente = (aj) => (aj.aviso_web && Date.parse(aj.aviso_web.hasta) > Date.now() ? aj.aviso_web : null);

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

const hace = (t) => {
  if (!t) return '—';
  const m = Math.round((Date.now() - (typeof t === 'number' ? t : Date.parse(t))) / 60000);
  return m < 1 ? 'recién' : m < 60 ? 'hace ' + m + ' min' : m < 48 * 60 ? 'hace ' + Math.round(m / 60) + ' h' : 'hace ' + Math.round(m / 1440) + ' días';
};

function Sistema({ s, sesiones }) {
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

// ── 🔔 la campana: pausarla (no sale ningún aviso) y reanudarla ──────────────────────────────────────────────────────
function AjCampana({ aj, hacer, ocup }) {
  const p = !!aj.campana_pausada;
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>La campana</h3><span className={'db-est' + (p ? ' ojo' : ' ok')}>{p ? '⏸ En pausa' : '● Suena'}</span></div>
      <p className="db-tx">En pausa no sale ningún aviso. Los de los eventos que se anuncien en ese rato no se mandan; los personales esperan y salen al reanudar, si siguen frescos. La página de Eventos dice que está en pausa.</p>
      <div className="cu-btns">
        {p ? <button type="button" className="btn verde chico" disabled={ocup} onClick={() => hacer('campana_pausada', false, 'La campana vuelve a sonar.')}>Reanudar</button>
          : <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Tocá de nuevo para pausar" onClick={() => hacer('campana_pausada', true, 'La campana quedó en pausa.')}>Pausar la campana</DosToques>}
      </div>
    </div>
  );
}

// ── ⚙️ el multiplicador de la semana, a mano: vale desde que se guarda (ver `a_mano()` de bot/multiplicadores.py) ────
function AjMult({ liga, aj, hacer, ocup }) {
  const m = liga.d.mult || {};
  const base = m.sv || {};
  const man = aj.multiplicadores && aj.multiplicadores.semana === m.id ? aj.multiplicadores.sv || {} : null;
  const ref = Object.assign({}, base, man || {});
  const [sel, setSel] = useState(ref);
  const firma = JSON.stringify(ref);
  useEffect(() => { setSel(JSON.parse(firma)); }, [firma]);
  const svs = Object.keys(base).sort((a, b) => (base[b] - base[a]) || (a < b ? -1 : 1));
  if (!m.id || !svs.length) {
    return <div className="db-aj"><div className="db-aj-c"><h3>El multiplicador de la semana</h3></div><p className="db-tx">No hay una semana sorteada ahora.</p></div>;
  }
  const cambio = svs.some((sv) => sel[sv] !== ref[sv]);
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>El multiplicador de la semana</h3><span className={'db-est' + (man ? ' ojo' : '')}>{man ? '✍ Elegido a mano' : 'El del sorteo'}</span></div>
      <div className="db-mult">
        {svs.map((sv) => {
          const ops = FACTORES.indexOf(ref[sv]) < 0 ? [...FACTORES, ref[sv]].sort((a, b) => a - b) : FACTORES;
          return (
            <label key={sv} className="db-sv">
              <span><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b></span>
              <select value={String(sel[sv])} disabled={ocup} aria-label={'Multiplicador de ' + siglaDe(sv)}
                onChange={(e) => setSel(Object.assign({}, sel, { [sv]: Number(e.target.value) }))}>
                {ops.map((x) => <option key={x} value={String(x)}>{mult(x)}</option>)}
              </select>
            </label>
          );
        })}
      </div>
      <p className="db-tx">Vale desde que lo guardás: lo que ya se jugó esta semana se queda con el de antes. El ciclo lo pone en su próxima corrida (a las :22 y a las :52) y ahí lo ve todo el mundo.</p>
      <div className="cu-btns">
        <button type="button" className="btn verde chico" disabled={ocup || !cambio}
          onClick={() => hacer('multiplicadores', { semana: m.id, sv: sel }, 'Guardado. Entra en la próxima corrida del ciclo.')}>Guardar</button>
        {man ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Tocá de nuevo para volver al sorteo"
          onClick={() => hacer('multiplicadores', null, 'Vuelve el sorteo en la próxima corrida del ciclo.')}>Volver al sorteo</DosToques> : null}
        {cambio ? <button type="button" className="evp-lnk" onClick={() => setSel(ref)}>Deshacer</button> : null}
      </div>
    </div>
  );
}

// ── 📣 un aviso arriba de la página, para todos, hasta una hora ──────────────────────────────────────────────────────
function AjAviso({ liga, aj, hacer, ocup }) {
  const vig = avisoVigente(aj);
  const [txt, setTxt] = useState('');
  const [horas, setHoras] = useState(24);
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>Aviso en la página</h3><span className={'db-est' + (vig ? ' ojo' : '')}>{vig ? '📣 Publicado' : 'Ninguno'}</span></div>
      {vig ? (
        <div className="db-vig">
          <p>{vig.texto}</p>
          <small>Hasta {liga.dia(vig.hasta)}</small>
          <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Tocá de nuevo para sacarlo" onClick={() => hacer('aviso_web', null, 'Aviso sacado.')}>Sacarlo</DosToques>
        </div>
      ) : null}
      <form className="db-form" onSubmit={(e) => {
        e.preventDefault();
        if (!txt.trim()) return;
        hacer('aviso_web', { texto: txt.trim(), hasta: new Date(Date.now() + horas * 3600000).toISOString() },
          'Publicado. Aparece arriba de la página en unos minutos.').then((ok) => { if (ok) setTxt(''); });
      }}>
        <label className="db-campo"><span>{vig ? 'Reemplazarlo por otro' : 'Qué dice'} <small>{txt.length}/240</small></span>
          <textarea rows={2} maxLength={240} value={txt} onChange={(e) => setTxt(e.target.value)}
            placeholder="Ej.: hoy el bot está en mantenimiento, las tarjetas vuelven a la noche." /></label>
        <label className="db-campo db-corto"><span>Por cuánto</span>
          <select value={horas} onChange={(e) => setHoras(Number(e.target.value))}>
            {DURACIONES.map(([t, h]) => <option key={h} value={h}>{t}</option>)}
          </select></label>
        <div className="cu-btns"><button type="submit" className="btn verde chico" disabled={ocup || !txt.trim()}>Publicar</button></div>
      </form>
      <p className="db-tx">Lo ve todo el mundo, arriba de cada página, hasta que vence o lo sacás. Cada uno lo puede cerrar.</p>
    </div>
  );
}

// ── 🎤 el bot en vivo: en qué servidores habla (ver `chatVivo()` en bot/avisos.js) ───────────────────────────────────
// Lo prende el admin de cada servidor con /settings (elige el canal); desde acá Dlx lo prende en el chat general o lo
// apaga aunque el admin lo haya prendido. «Lo decide su admin» es no tocarlo.
function AjVivo({ liga, aj, hacer, ocup, chat }) {
  const c = chat || {};
  const dash = aj.en_vivo || {};
  const admin = c.admin || {};
  const svs = [...new Set([...(c.generales || []).map((x) => x.sv), ...Object.keys(admin), ...Object.keys(dash)])].sort();
  const prendido = (sv) => dash[sv] !== false && (!!admin[sv] || dash[sv] === true);
  const estado = (sv) => (dash[sv] === false ? 'Apagado por vos' : admin[sv] ? 'Lo prendió su admin'
    : dash[sv] === true ? 'Prendido por vos, en el chat general' : 'Apagado: su admin no eligió canal');
  const cambiar = (sv, v) => {
    const n = Object.assign({}, dash);
    if (v === '') delete n[sv]; else n[sv] = v === 'si';
    return hacer('en_vivo', n, 'Guardado: vale desde el próximo minuto.');
  };
  const u = c.ultimo || {};
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>El bot en vivo</h3><span className={'db-est' + (svs.some(prendido) ? ' ok' : '')}>{svs.filter(prendido).length} prendido(s)</span></div>
      <p className="db-tx">Durante un evento cuenta en el chat cómo va: cuando sale la llave, quién pasa cada ronda, la final y el campeón. No menciona a nadie y manda como mucho un mensaje cada 10 minutos. Lo prende el admin de cada servidor con /settings; desde acá lo prendés en el chat general o lo apagás aunque su admin lo haya prendido.</p>
      {svs.length ? (
        <div className="db-mult">{svs.map((sv) => (
          <label key={sv} className="db-sv db-sv-vivo" title={estado(sv)}>
            <span><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b></span>
            <select value={dash[sv] === true ? 'si' : dash[sv] === false ? 'no' : ''} disabled={ocup}
              aria-label={'El bot en vivo en ' + siglaDe(sv)} onChange={(e) => cambiar(sv, e.target.value)}>
              <option value="">{admin[sv] ? 'Su admin: prendido' : 'Su admin: apagado'}</option>
              <option value="si">Prendido</option>
              <option value="no">Apagado</option>
            </select>
          </label>
        ))}</div>
      ) : <p className="db-tx">Todavía no sé el chat general de ningún servidor: el vigía lo busca en su próxima vuelta.</p>}
      {u.t ? <p className="db-tx">Última vez {hace(u.t)}: {num(u.mandados || 0)} mensaje(s), {num(u.editados || 0)} edición(es){(u.errores || []).length ? ' · ⚠️ Discord dijo que no: ' + u.errores.join(', ') : ''}{u.error ? ' · ⚠️ ' + u.error : ''}</p> : null}
    </div>
  );
}

function Ajustes({ liga, aj, onAj, chat }) {
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  // devuelve si salió, así el formulario sabe si vaciarse
  const hacer = async (cual, valor, ok) => {
    setOcup(true); setMsg('');
    let bien = false;
    try { onAj(await ajustar(cual, valor)); setMsg('✅ ' + ok); bien = true; } catch (e) { setMsg('⚠️ No se pudo: ' + e.message + '.'); }
    setOcup(false);
    return bien;
  };
  return (
    <>
      <div className="db-ajs">
        <AjCampana aj={aj} hacer={hacer} ocup={ocup} />
        <AjMult liga={liga} aj={aj} hacer={hacer} ocup={ocup} />
        <AjAviso liga={liga} aj={aj} hacer={hacer} ocup={ocup} />
        <AjVivo liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} />
      </div>
      {msg ? <p className="db-msg" role="status">{msg}</p> : null}
    </>
  );
}

const TIPO = { servidor: 'Servidor', marca: 'Marca', creador: 'Creador', otro: 'Otro' };

// 🤝 lo que también te llega por DM: las postulaciones de /sumate y los errores reportados en las llaves
function Llego({ d }) {
  const pos = d.postulaciones || [], rep = d.reportes || [];
  if (!pos.length && !rep.length) return <p className="pronto-p">Nada todavía: ni postulaciones de /sumate ni errores reportados en las llaves.</p>;
  return (
    <div className="db-llego">
      {pos.length ? (
        <div><h3>Quieren sumarse <small>/sumate</small></h3>
          <ul>{pos.map((p) => (
            <li key={p.t + p.nombre}>
              <div className="db-l1"><b>{limpio(p.nombre)}</b><span className="db-chip">{TIPO[p.tipo] || p.tipo}</span>{!p.llego ? <span className="db-chip ojo">no llegó por DM</span> : null}</div>
              <small>{hace(p.t)}{p.miembros != null ? ' · ' + num(p.miembros) + ' miembros' : ''}{p.eventos != null ? ' · ' + p.eventos + ' eventos por semana' : ''}{p.de ? <> · <a href={'#/r/' + p.de}>quién la mandó</a></> : null}</small>
              {p.link ? <a className="db-link" href={p.link} target="_blank" rel="noopener noreferrer">{p.link}</a> : null}
              {p.mensaje ? <p>{p.mensaje}</p> : null}
            </li>
          ))}</ul>
        </div>
      ) : null}
      {rep.length ? (
        <div><h3>Errores en las llaves <small>reportados</small></h3>
          <ul>{rep.map((r) => (
            <li key={r.t + r.llave}>
              <div className="db-l1"><b><a href={'#/llave/' + r.llave}>Llave #{r.llave}</a></b><span className="db-chip">{r.que}</span></div>
              <small>{hace(r.t)}{r.batalla ? ' · ' + r.batalla : ''}{r.de ? <> · <a href={'#/r/' + r.de}>quién lo reportó</a></> : null}</small>
              {r.texto ? <p>{r.texto}</p> : null}
            </li>
          ))}</ul>
        </div>
      ) : null}
    </div>
  );
}

export function Dashboard({ dc, liga }) {
  const [st, setSt] = useState({ cargando: true });
  useEffect(() => {
    if (!dc) { setSt({ sinCuenta: true }); return undefined; }
    let vivo = true;
    pedirDueno().then((x) => { if (vivo) setSt(x); });
    return () => { vivo = false; };
  }, [dc]);
  useEffect(() => { W.scrollTo && W.scrollTo(0, 0); }, []);
  const onAj = (aj) => setSt((s) => (s.d ? { d: Object.assign({}, s.d, { ajustes: aj }) } : s));
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
          <div className="mis-cab"><span>CONFIGURACIÓN · SÓLO VOS</span></div>
          <Ajustes liga={liga} aj={d.ajustes || {}} onAj={onAj} chat={d.chat} />
        </section>
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
          <div className="mis-cab"><span>LO QUE TE LLEGÓ</span></div>
          <Llego d={d} />
        </section>
        <section className="act">
          <div className="mis-cab"><span>CÓMO ANDA TODO</span></div>
          <Sistema s={d.sistema || {}} sesiones={d.sesiones} />
          <ul className="db-atajos">{ATAJOS.map(([t, h]) => (
            <li key={h}><a href={h} target={h[0] === '/' ? undefined : '_blank'} rel={h[0] === '/' ? undefined : 'noopener noreferrer'}>{t} ↗</a></li>
          ))}</ul>
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

// 🏠 EN EL INICIO, SÓLO PARA VOS (Dlx, 04/10/2026: «y que me aparezca a mí únicamente en el inicio también»). Lo
// dibuja App.jsx cuando la cuenta del navegador es la de Dlx, y se apaga solo si la puerta dice que no (otra cuenta
// con el ID copiado, o la sesión vencida): lo que se ve sale de `/avisos/dueno`, igual que el Dashboard
export function PanelDueno({ liga }) {
  const [st, setSt] = useState(null);
  useEffect(() => {
    let vivo = true;
    pedirDueno().then((x) => { if (vivo) setSt(x); });
    return () => { vivo = false; };
  }, []);
  if (!st || st.no) return null;
  const d = st.d;
  const s = (d && d.uso && d.uso.semana) || {};
  const aj = (d && d.ajustes) || {};
  const m = liga.d.mult || {};
  const marcas = d ? [aj.campana_pausada ? '⏸ La campana está en pausa' : '',
    avisoVigente(aj) ? '📣 Hay un aviso publicado' : '',
    aj.multiplicadores && aj.multiplicadores.semana === m.id ? '✍ El multiplicador va a mano' : '',
    d.sistema && d.sistema.ok === false ? '⚠️ El vigía no contesta' : ''].filter(Boolean) : [];
  return (
    <section className="db-ini" aria-label="Tu Dashboard">
      <div className="db-ini-c">
        <b>TU DASHBOARD</b>
        <a className="btn borde2 chico" href="#/dashboard">Abrir</a>
      </div>
      {d ? (
        <>
          <dl className="db-ini-n">
            <div><dt>Usaron el bot</dt><dd>{num(s.bot || 0)}</dd></div>
            <div><dt>Con su cuenta</dt><dd>{num(s.web || 0)}</dd></div>
            <div><dt>Visitas por día</dt><dd>{num(s.visitas_dia || 0)}</dd></div>
            <div><dt>Postulaciones · 7 días</dt><dd>{num((d.postulaciones || []).filter((p) => Date.now() - p.t < 7 * 864e5).length)}</dd></div>
          </dl>
          {marcas.length ? <p className="db-ini-m">{marcas.join(' · ')}</p> : null}
        </>
      ) : <p className="db-ini-m">{st.sinCuenta ? 'Entrá con Discord para verlo.' : 'No pude leerlo ahora.'}</p>}
    </section>
  );
}
