// 🔒 EL DASHBOARD DEL DUEÑO (Dlx, 04/10/2026: «el bot y la página, que esté en una página nueva creada sólo para el
// owner… la única manera de iniciar sesión ahí es con mi cuenta… ahí poné esa información y configuraciones extras»).
//
// ⚠️ LA PUERTA NO ES ESTA PÁGINA: es `/avisos/dueno` en bot/avisos.js, que le pregunta a Discord (o a la sesión) quién
// es y contesta 403 a cualquiera que no sea Dlx. Acá sólo se dibuja lo que el servidor manda. Sin cuenta, el botón de
// entrar; con otra cuenta, «esta página es del dueño» y nada más. Los ajustes pasan por la misma puerta
// (`/avisos/dueno/ajuste`), y el servidor valida cada valor antes de guardarlo.
import { useEffect, useState } from 'react';
import { hora, limpio, mult, num, siglaDe } from './liga.js';
import { DosToques, Ico } from './piezas.jsx';
// 🔒 su CSS viene con este pedazo y no con el paquete de todos (ver dashboard.css)
import ESTILO from './dashboard.css?inline';

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
    ['ENTRARON CON DISCORD', s.web, antes(s.web, a.web) || 'a la página, con su cuenta'],
    ['EN TOTAL', s.personas, antes(s.personas, a.personas) || 'en el bot o en la página'],
    // ⚠️ «VISITAS» SOLO NO DECÍA A QUÉ (Dlx, 07/10/2026: «visitas, pero visitas a qué?»): es cuántos celulares o
    // compus abrieron la página en el día —cada uno cuenta una vez, con o sin cuenta (`lg:visita` de App.jsx)—
    ['ABRIERON LA PÁGINA', s.visitas_dia, antes(s.visitas_dia, a.visitas_dia) || 'celus o compus por día, en promedio'],
  ];
  return <div className="act-4">{cajas.map(([t, v, d]) => <div key={t}><span>{t}</span><b>{num(v || 0)}</b><small>{d}</small></div>)}</div>;
}

// día por día, las tres cosas en barras: el alto es contra el máximo de cada serie, así una no aplasta a las otras
function Dias({ dias }) {
  const tope = (k) => Math.max(1, ...dias.map((d) => d[k] || 0));
  const series = [['bot', 'Bot', 'var(--verde)'], ['web', 'Con su cuenta', 'var(--magenta)'], ['visitas', 'Abrieron la página', '#A5A5A0']];
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

// ── ▶️ las corridas del ciclo, y correrlo ahora (05/10/2026) ───────────────────────────────────────────────────────
// Esa tarde una corrida estuvo 15 minutos «en cola» en GitHub sin que nada lo dijera, y GitHub la canceló. Las cuatro
// últimas las trae la puerta (`corridasCiclo()` en bot/avisos.js, con el token del Worker); correrlo es el mismo
// `workflow_dispatch` que larga el cron cada media hora, como mucho una vez cada 10 minutos (`cicloAMano()`).
const ESTADO_CORRIDA = { queued: '⏳ en cola', waiting: '⏳ esperando', pending: '⏳ en cola', requested: '⏳ pedida', in_progress: '▶️ corriendo' };
const FIN_CORRIDA = { success: '✅ terminó bien', failure: '⚠️ falló', cancelled: '⛔ cancelada', timed_out: '⚠️ se pasó de tiempo', skipped: 'salteada' };
function Corridas({ corridas, s, github }) {
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  const correr = async () => {
    setOcup(true); setMsg('');
    try {
      const r = await fetch('/api/avisos/dueno/ciclo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setMsg('✅ Pedido: GitHub lo larga en uno o dos minutos.');
      else if (j.error === 'espera') setMsg('⏳ Ya se corrió hace poco: probá en ' + (j.minutos || 10) + ' min.');
      else setMsg('⚠️ No se pudo: ' + (r.status === 401 ? 'la sesión venció, entrá de nuevo' : j.error || r.status) + '.');
    } catch (e) { setMsg('⚠️ No se pudo: sin red.'); }
    setOcup(false);
  };
  const m = s.ciclo_mano || {};
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>Las corridas del ciclo</h3>{m.t ? <span className="db-est">a mano: {hace(m.t)}</span> : null}</div>
      {github ? (
        <p className="db-vig"><b>⚠️ A GitHub Actions le pasa algo ahora</b><small>{github.incidente || 'Anda lento'}{github.desde ? ' · desde ' + hora(github.desde) : ''}. Las corridas pueden quedar en cola o cancelarse solas; vuelven cuando GitHub se arregla. La página en vivo, la campana y el bot no dependen de esto.</small></p>
      ) : null}
      {(corridas || []).length ? (
        <ul className="db-corr">{corridas.map((c) => {
          const t = c.empezo || c.creada;
          const que = c.estado === 'completed' ? (FIN_CORRIDA[c.fin] || c.fin || 'terminó') : (ESTADO_CORRIDA[c.estado] || c.estado);
          const dura = c.estado === 'completed' && c.empezo && c.toco ? Math.max(1, Math.round((Date.parse(c.toco) - Date.parse(c.empezo)) / 60000)) : 0;
          return (
            <li key={c.creada} className={c.fin && c.fin !== 'success' && c.fin !== 'skipped' ? 'ojo' : ''}>
              <b>{que}</b>
              <span>{t ? hora(new Date(t)) : ''}{dura ? ' · ' + dura + ' min' : c.estado !== 'completed' && t ? ' · ' + hace(t) : ''}</span>
              {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">ver ↗</a> : null}
            </li>
          );
        })}</ul>
      ) : <p className="db-tx">No pude preguntarle a GitHub ahora.</p>}
      <div className="cu-btns">
        <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Tocá de nuevo para correrlo" onClick={correr}>▶️ Correr el ciclo ahora</DosToques>
      </div>
      <p className="db-tx">Es la misma corrida que sale sola cada media hora: lee Discord, procesa lo que terminó y actualiza la página. Como mucho una vez cada 10 minutos.</p>
      {msg ? <p className="db-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// ── 💸 lo que gasta Cloudflare hoy (05/10/2026: «¿cuántas escrituras tiene el KV ahora?») ──────────────────────────
// Lo mide el ciclo en cada corrida (`bot/cuotas.py`: KV, el objeto, el Worker y R2) y lo deja en `datos/estado_*.json`,
// que el mapa en vivo ya lee de GitHub: no cuesta nada nuevo. ⚠️ El día de Cloudflare es UTC: se renueva a las 8 PM ET
// (7 PM en invierno), y lo medido antes de esa hora es del día anterior.
const RAW = 'https://raw.githubusercontent.com/underraponline-lgtm/underlegends/main/datos/';
const TOPES = [
  ['kv', 'write', 'KV · escrituras', 1000],
  ['kv', 'read', 'KV · lecturas', 100000],
  ['objeto', 'leidas', 'El objeto · filas leídas', 5000000],
  ['objeto', 'escritas', 'El objeto · filas escritas', 100000],
  ['objeto', 'pedidos', 'El objeto · pedidos', 100000],
];
const corta = (n) => (n >= 1e6 ? String(Math.round(n / 1e5) / 10).replace('.', ',') + ' M' : num(n));
function useCuotas(activo) {
  const [q, setQ] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    Promise.all(['estado_dibujar.json', 'estado_escuchar.json'].map((f) =>
      fetch(RAW + f, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
      .then((xs) => {
        const c = xs.filter((x) => x && x.cuotas).sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)))[0];
        if (vivo) setQ(c ? Object.assign({ cuando: c.cuando }, c.cuotas) : false);
      });
    return () => { vivo = false; };
  }, [activo]);
  return q;
}
// lo que está cerca del techo, para el panel del Inicio
const cuotasEnRojo = (q) => (q ? TOPES.filter(([g, k, , tope]) => ((q[g] || {})[k] || 0) >= 0.9 * tope) : []);
function Cuotas({ q }) {
  if (q === null) return <p className="pronto-p">Midiendo…</p>;
  if (!q) return <p className="pronto-p">Todavía no hay una medición del ciclo.</p>;
  const ahora = new Date();
  const renueva = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + 1));
  const deAyer = String(q.cuando || '').slice(0, 10) !== ahora.toISOString().slice(0, 10);
  const w = q.worker || {}, r2 = q.r2 || {};
  return (
    <div className="db-aj">
      <div className={'db-q' + (deAyer ? ' viejo' : '')}>{TOPES.map(([g, k, t, tope]) => {
        const v = (q[g] || {})[k];
        if (v == null) return null;
        const p = Math.min(100, (100 * v) / tope);
        return (
          <div key={t} className={'db-q-f' + (p >= 90 ? ' lleno' : p >= 70 ? ' ojo' : '')}>
            <span>{t}</span>
            <i><u style={{ width: p.toFixed(1) + '%' }} /></i>
            <b>{p >= 90 ? '⚠️ ' : ''}{corta(v)} <small>de {corta(tope)}</small></b>
          </div>
        );
      })}</div>
      <dl className="db-sis">
        {w.pedidos != null ? <div><dt>El Worker · 24 h</dt><dd>{num(w.pedidos)} pedidos · CPU p99 {String(w.p99_ms).replace('.', ',')} ms de 10</dd></div> : null}
        {r2.objetos != null ? <div><dt>R2 · las tarjetas y las fotos</dt><dd>{num(r2.objetos)} archivos · {String(r2.gb).replace('.', ',')} GB de 10</dd></div> : null}
      </dl>
      <p className="db-tx">{deAyer ? 'Esto es de antes de las ' + hora(new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))) + ', cuando se renovó: la próxima corrida lo mide de nuevo. ' : ''}Lo midió el ciclo {hace(q.cuando)}. Se renueva todos los días a las {hora(renueva)}; si KV se llena, la página y /card se quedan quietos hasta esa hora.</p>
    </div>
  );
}

// ── 🔴 lo que está en vivo ahora (05/10/2026: «estas llaves en vivo no se detectan») ───────────────────────────────
// De cada llave que se está tocando: a qué anuncio se juntó y cómo —por el nombre, o por la serie cuando el número no
// coincide (`LlaveVivo.deEvento()`)—, en qué ronda va y qué dijo el bot en el chat (`vivoDueno()` en bot/avisos.js).
function EnVivo({ vivo, liga, aj, chat }) {
  const dash = aj.en_vivo || {}, dashNivel = aj.en_vivo_nivel || {};
  const c = chat || {}, admin = c.admin || {}, niveles = c.niveles || {};
  const elBot = (sv) => {
    if (dash[sv] === false || (!admin[sv] && dash[sv] !== true)) return 'apagado en ' + siglaDe(sv);
    const n = niveles[dashNivel[sv]] ? dashNivel[sv] : niveles[(c.nivel || {})[sv]] ? c.nivel[sv] : 'normal';
    return 'prendido · ' + ((niveles[n] || [n])[0]).toLowerCase();
  };
  return (
    <ul className="db-vv">{vivo.map((v) => (
      <li key={v.link || v.titulo + v.ed}>
        <div className="db-l1">
          <img alt="" src={liga.logo(v.sv)} width="20" height="20" />
          <b>{limpio(v.anuncio || v.titulo || 'La llave')}</b>
          <span className="db-chip">{v.terminada ? 'terminó' : v.ronda || 'en juego'}</span>
          {!v.anuncio ? <span className="db-chip ojo">sin anuncio</span> : v.como === 'huerfana' ? <span className="db-chip ojo">por la serie</span> : null}
        </div>
        <small>
          {v.como === 'huerfana' ? 'La llave dice «' + limpio(v.titulo) + '»: el número no coincide, se juntó por la serie. ' : ''}
          {!v.anuncio ? 'No la pude juntar con ningún anuncio de las últimas 36 h: en la página sale con el título de la llave. ' : ''}
          {v.como === 'guardado' ? 'Su anuncio ya quedó atrás: es el nombre que el bot le dio cuando lo tenía. ' : ''}
          {v.gente ? v.gente + ' en la llave · ' : ''}tocada {hace(v.ed)}
        </small>
        <small>El bot: {elBot(v.sv)} · {v.chat && v.chat.mensajes ? v.chat.mensajes + ' mensaje(s), el último ' + hace(v.chat.t) : 'todavía no dijo nada'}</small>
        {v.link ? <a className="db-link" href={v.link} target="_blank" rel="noopener noreferrer">Abrir la llave en Discord ↗</a> : null}
      </li>
    ))}</ul>
  );
}

// ── 🎟️ el Pase de rapero, en números (`paseResumen()` en bot/avisos.js: nunca quién) ───────────────────────────────
function PaseNumeros({ p, liga }) {
  const dist = Object.entries(p.dist || {}).map(([n, k]) => [Number(n), k]).sort((a, b) => a[0] - b[0]);
  const tope = Math.max(1, ...dist.map((x) => x[1]));
  const hechas = (p.tareas || []).reduce((s, x) => s + x[1], 0);
  const cajas = [
    ['MIEMBROS DE DRA', p.miembros, 'los que pueden jugarlo'],
    ['CON NIVEL', p.con_nivel, 'llegaron al nivel 1 o más'],
    ['TAREAS ESTA SEMANA', hechas, p.hasta ? 'hasta ' + liga.dia(p.hasta) : 'entre todos'],
    ['EL NIVEL MÁS ALTO', dist.length ? dist[dist.length - 1][0] : 0, 'de ' + p.niveles + (p.salon ? ' · ' + p.salon + ' en el Salón' : '')],
  ];
  return (
    <>
      <div className="act-4">{cajas.map(([t, v, d]) => <div key={t}><span>{t}</span><b>{num(v || 0)}</b><small>{d}</small></div>)}</div>
      {dist.length ? (
        <div className="db-aj"><div className="db-q">{dist.map(([n, k]) => (
          <div key={n} className="db-q-f"><span>Nivel {n}</span><i><u style={{ width: ((100 * k) / tope).toFixed(1) + '%' }} /></i><b>{num(k)} <small>{k === 1 ? 'persona' : 'personas'}</small></b></div>
        ))}</div>
        {/* las Tareas de hoy, de la semana y de la temporada (con XP desde el 06/10/2026) */}
        {[['hoy', p.hoy], ['esta semana', p.tareas], ['en la temporada', p.temporada]].some(([, xs]) => (xs || []).length) ? (
          <ul className="db-corr">{[['hoy', p.hoy], ['esta semana', p.tareas], ['en la temporada', p.temporada]].flatMap(([cu, xs]) =>
            (xs || []).map(([t, k]) => <li key={cu + t}><b>{limpio(t)}</b><span>{num(k)} {k === 1 ? 'vez' : 'veces'} {cu}</span></li>))}</ul>
        ) : null}
        </div>
      ) : <p className="pronto-p">Todavía nadie cumplió una Tarea.</p>}
    </>
  );
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
// 🔊 Y CUÁNTO HABLA (05/10/2026): lo justo, normal o cada batalla (`NIVELES_CHAT` de avisos.js, que llega en `chat`).
// También lo elige el admin con /settings; lo de acá gana.
const NIVELES_VIVO = { poco: ['Lo justo'], normal: ['Normal'], todo: ['Cada batalla'] };
function AjVivo({ liga, aj, hacer, ocup, chat }) {
  const c = chat || {};
  const dash = aj.en_vivo || {};
  const dashNivel = aj.en_vivo_nivel || {};
  const niveles = c.niveles || NIVELES_VIVO;
  const nivelAdmin = (sv) => (c.nivel || {})[sv] || 'normal';
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
  const cambiarNivel = (sv, v) => {
    const n = Object.assign({}, dashNivel);
    if (v === '') delete n[sv]; else n[sv] = v;
    return hacer('en_vivo_nivel', n, 'Guardado: vale desde el próximo minuto.');
  };
  const u = c.ultimo || {};
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>El bot en vivo</h3><span className={'db-est' + (svs.some(prendido) ? ' ok' : '')}>{svs.filter(prendido).length} prendido(s)</span></div>
      <p className="db-tx">Durante un evento cuenta en el chat cómo va, y cuánto habla se elige: <b>lo justo</b> (el arranque y el campeón), <b>normal</b> (además quién pasa cada ronda y la final, como mucho un mensaje cada 10 minutos) o <b>cada batalla</b> (quién gana cada una apenas se sabe, como mucho uno cada 2 minutos). No menciona a nadie. Lo prende el admin de cada servidor con /settings; desde acá lo prendés en el chat general, lo apagás o le cambiás cuánto habla aunque su admin haya elegido otra cosa.</p>
      {svs.length ? (
        <div className="db-mult db-mult-vivo">{svs.map((sv) => (
          <label key={sv} className="db-sv db-sv-vivo" title={estado(sv)}>
            <span><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b></span>
            <select value={dash[sv] === true ? 'si' : dash[sv] === false ? 'no' : ''} disabled={ocup}
              aria-label={'El bot en vivo en ' + siglaDe(sv)} onChange={(e) => cambiar(sv, e.target.value)}>
              <option value="">{admin[sv] ? 'Su admin: prendido' : 'Su admin: apagado'}</option>
              <option value="si">Prendido</option>
              <option value="no">Apagado</option>
            </select>
            <select value={niveles[dashNivel[sv]] ? dashNivel[sv] : ''} disabled={ocup || !prendido(sv)}
              aria-label={'Cuánto habla el bot en vivo en ' + siglaDe(sv)} onChange={(e) => cambiarNivel(sv, e.target.value)}>
              <option value="">{'Su admin: ' + ((niveles[nivelAdmin(sv)] || ['normal'])[0]).toLowerCase()}</option>
              {Object.keys(niveles).map((k) => <option key={k} value={k}>{niveles[k][0]}</option>)}
            </select>
          </label>
        ))}</div>
      ) : <p className="db-tx">Todavía no sé el chat general de ningún servidor: el vigía lo busca en su próxima vuelta.</p>}
      {u.t ? <p className="db-tx">Última vez {hace(u.t)}: {num(u.mandados || 0)} mensaje(s), {num(u.editados || 0)} edición(es){(u.errores || []).length ? ' · ⚠️ Discord dijo que no: ' + u.errores.join(', ') : ''}{u.error ? ' · ⚠️ ' + u.error : ''}</p> : null}
    </div>
  );
}

// ── 📣 el aviso de cada evento en el canal de la Liga (`bot/aviso_evento.py`) ──────────────────────────────────────
// Dlx, 07/10/2026: «para la liga global, pero añade nivel de intensidad». Los mismos tres que `NIVELES_AVISO` de
// bot/avisos.js y `NIVELES` de aviso_evento.py: si se cambia uno, se cambian los tres
const NIVELES_AVISO = {
  poco: ['Lo justo', 'el evento, el campeón y cuántos jugaron'],
  normal: ['Normal', 'además el podio con sus puntos y la tarjeta del campeón'],
  todo: ['Todo', 'además quién subió en el ranking, quién debutó, las insignias, los rangos y la sorpresa'],
};
// 🎛️ Y DÓNDE VA (07/10/2026): ya no a LIGA GLOBAL —que está en «registros»— sino al chat de cada servidor; servidor por
// servidor se elige si va donde habla el bot en vivo, a su chat general siempre o a ningún lado, y a dónde va el que no
// tiene a dónde (ver `canalesChat()` en bot/avisos.js)
function AjAvisos({ liga, aj, hacer, ocup, chat }) {
  const v = NIVELES_AVISO[aj.avisos_nivel] ? aj.avisos_nivel : 'normal';
  const ae = aj.aviso_evento || {};
  const porSv = ae.sv || {};
  const svs = svsDe(chat, aj);
  const gens = [...new Set(((chat || {}).generales || []).map((x) => x.sv))].sort();
  const poner = (cambio, ok) => hacer('aviso_evento', Object.assign({ sv: porSv, resto: ae.resto || '' }, cambio), ok);
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>El aviso de cada evento</h3><span className="db-est ok">{NIVELES_AVISO[v][0]}</span></div>
      <p className="db-tx">Cuando el ciclo carga un evento, el bot lo cuenta en el chat del servidor donde se jugó: el mismo donde habla el bot en vivo. Después, sin volver a sonar, le suma lo que cambió y la tarjeta nueva del campeón. Cuánto dice: <b>{NIVELES_AVISO[v][0].toLowerCase()}</b>, {NIVELES_AVISO[v][1]}.</p>
      <div className="db-mult">
        <label className="db-sv">
          <span><b>Cuánto dice</b></span>
          <select value={v} disabled={ocup} aria-label="Cuánto dice el aviso de cada evento"
            onChange={(e) => hacer('avisos_nivel', e.target.value, 'Guardado: vale desde el próximo evento.')}>
            {Object.keys(NIVELES_AVISO).map((k) => <option key={k} value={k}>{NIVELES_AVISO[k][0]}</option>)}
          </select>
        </label>
      </div>
      {svs.length ? (
        <div className="db-mult db-mult-vivo">{svs.map((sv) => (
          <label key={sv} className="db-sv">
            <span><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b></span>
            <select value={porSv[sv] || ''} disabled={ocup} aria-label={'Dónde va el aviso de los eventos de ' + siglaDe(sv)}
              onChange={(e) => {
                const n = Object.assign({}, porSv);
                if (e.target.value) n[sv] = e.target.value; else delete n[sv];
                poner({ sv: n }, 'Guardado: vale desde el próximo evento.');
              }}>
              <option value="">Donde habla el bot en vivo</option>
              <option value="chat">En su chat general, siempre</option>
              <option value="no">Apagado</option>
            </select>
          </label>
        ))}</div>
      ) : null}
      {gens.length ? (
        <label className="db-campo"><span>Si un servidor no tiene a dónde</span>
          <select value={ae.resto || ''} disabled={ocup}
            onChange={(e) => poner({ resto: e.target.value }, 'Guardado: vale desde el próximo evento.')}>
            <option value="">No se manda</option>
            {gens.map((sv) => <option key={sv} value={sv}>Al chat general de {siglaDe(sv)}</option>)}
          </select></label>
      ) : null}
    </div>
  );
}

// ── 🎛️ LOS DE MÁS (Dlx, 07/10/2026: «dame más configuraciones», y a la lista: «Apuestas», «Aviso de cada evento»,
// «Horario de silencio»). Los validan `ajusteValido()` y los usan `apuestasCfg()`, `ritmoCfg()`, `enSilencio()` y
// `canalesChat()` de bot/avisos.js; lo de siempre llega en `chat.def`, así que los números no se escriben acá ──────────
function svsDe(chat, aj) {
  const c = chat || {};
  return [...new Set([...(c.generales || []).map((x) => x.sv), ...Object.keys(c.admin || {}), ...Object.keys(aj.en_vivo || {})])].sort();
}
const DEF_AP = { montos: [50, 100, 250, 500], minutos: 3, tope: 500 };
const DEF_RIT = { normal: 10, batalla: 2 };

// 🎲 las apuestas del nivel «A full»: los botones, cuánto quedan abiertas, el tope por batalla y dónde no van
function AjApuestas({ liga, aj, hacer, ocup, chat }) {
  const def = ((chat || {}).def || {}).apuestas || DEF_AP;
  const a = aj.apuestas || null;
  const firma = JSON.stringify(a);
  const [montos, setMontos] = useState((a || def).montos.join(', '));
  const [minutos, setMinutos] = useState((a || def).minutos);
  const [tope, setTope] = useState((a || def).tope);
  const [fuera, setFuera] = useState((a && a.apagadas) || {});
  useEffect(() => {
    const r = a || def;
    setMontos(r.montos.join(', ')); setMinutos(r.minutos); setTope(r.tope); setFuera((a && a.apagadas) || {});
  }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps
  const ms = montos.split(/[\s,;.]+/).filter(Boolean).map(Number);
  const t = Number(tope);
  const mal = ms.length < 2 || ms.length > 4 ? 'De 2 a 4 botones.'
    : ms.some((m, i) => !Number.isInteger(m) || m < 10 || m > 5000 || (i && m <= ms[i - 1])) ? 'Los botones van de menor a mayor, de 10 a 5.000.'
      : !Number.isInteger(t) || t < ms[ms.length - 1] || t > 20000 ? 'El tope va desde el botón más alto hasta 20.000.' : '';
  const svs = svsDe(chat, aj);
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>Las apuestas</h3><span className={'db-est' + (a ? ' ojo' : ' ok')}>{a ? '✍ A tu gusto' : 'Como siempre'}</span></div>
      <p className="db-tx">Salen con el bot en vivo en <b>A full</b>: botones en el mensaje de cada cruce, con Puntos de Tienda, y el pozo se reparte entre los que aciertan. Acá elegís los botones, cuántos minutos quedan abiertas, cuánto puede poner cada uno por batalla y en qué servidores no van.</p>
      <form className="db-form uno" onSubmit={(e) => {
        e.preventDefault();
        if (!mal) hacer('apuestas', { montos: ms, minutos: Number(minutos), tope: t, apagadas: fuera }, 'Guardado: vale para la próxima apuesta.');
      }}>
        <label className="db-campo"><span>Los botones <small>de menor a mayor, separados por coma</small></span>
          <input value={montos} inputMode="numeric" placeholder="50, 100, 250, 500" onChange={(e) => setMontos(e.target.value)} /></label>
        <div className="db-fila">
          <label className="db-campo db-corto"><span>Abiertas</span>
            <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))}>
              {Array.from({ length: 15 }, (_, i) => i + 1).map((x) => <option key={x} value={x}>{x} {x === 1 ? 'minuto' : 'minutos'}</option>)}
            </select></label>
          <label className="db-campo db-corto"><span>Tope por batalla</span>
            <input type="number" min={10} max={20000} step={10} value={tope} onChange={(e) => setTope(e.target.value)} /></label>
        </div>
        {svs.length ? (
          <fieldset className="db-chk"><legend>No hay apuestas en</legend>
            {svs.map((sv) => (
              <label key={sv}><input type="checkbox" checked={!!fuera[sv]} onChange={(e) => {
                const n = Object.assign({}, fuera);
                if (e.target.checked) n[sv] = true; else delete n[sv];
                setFuera(n);
              }} /><img alt="" src={liga.logo(sv)} />{siglaDe(sv)}</label>
            ))}
          </fieldset>
        ) : null}
        {mal ? <p className="db-tx db-mal">{mal}</p> : null}
        <div className="cu-btns">
          <button type="submit" className="btn verde chico" disabled={ocup || !!mal}>Guardar</button>
          {a ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Tocá de nuevo para volver a lo de siempre"
            onClick={() => hacer('apuestas', null, 'Volvieron los de siempre.')}>Volver a lo de siempre</DosToques> : null}
        </div>
      </form>
      <p className="db-tx">Lo de siempre: botones de {def.montos.map(num).join(', ')}, {def.minutos} minutos y hasta {num(def.tope)} por batalla.</p>
    </div>
  );
}

// 🌙 el horario de silencio del bot en vivo, en hora del este
function AjSilencio({ aj, hacer, ocup }) {
  const s = aj.silencio || null;
  const [desde, setDesde] = useState((s && s.desde) || '00:00');
  const [hasta, setHasta] = useState((s && s.hasta) || '09:00');
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>Horario de silencio</h3><span className={'db-est' + (s ? ' ojo' : '')}>{s ? '🌙 De ' + s.desde + ' a ' + s.hasta : 'Sin silencio'}</span></div>
      <p className="db-tx">En ese horario, en hora del este, el bot en vivo no habla en ningún chat ni cuenta quién se anotó. Las apuestas que estaban abiertas se siguen cerrando y pagando. Al terminar, sigue desde donde va la llave: lo que pasó en el medio no lo cuenta tarde. Puede cruzar la medianoche (de 23:00 a 08:00).</p>
      <form className="db-form uno" onSubmit={(e) => {
        e.preventDefault();
        if (desde !== hasta) hacer('silencio', { desde, hasta }, 'Guardado: vale desde el próximo minuto.');
      }}>
        <div className="db-fila">
          <label className="db-campo db-corto"><span>Desde</span><input type="time" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="db-campo db-corto"><span>Hasta</span><input type="time" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        </div>
        <div className="cu-btns">
          <button type="submit" className="btn verde chico" disabled={ocup || !desde || !hasta || desde === hasta}>Guardar</button>
          {s ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Tocá de nuevo para sacarlo"
            onClick={() => hacer('silencio', null, 'Sin silencio: vuelve a hablar a toda hora.')}>Sacarlo</DosToques> : null}
        </div>
      </form>
    </div>
  );
}

// ⏱️ el ritmo del bot en vivo: cada cuánto puede mandar un mensaje nuevo en un mismo chat
const RIT_NORMAL = [3, 5, 10, 15, 20, 30];
const RIT_BATALLA = [1, 2, 3, 5, 10];
function AjRitmo({ aj, hacer, ocup, chat }) {
  const def = ((chat || {}).def || {}).ritmo || DEF_RIT;
  const r = aj.ritmo || null;
  const [n, setN] = useState((r || def).normal);
  const [b, setB] = useState((r || def).batalla);
  const firma = JSON.stringify(r);
  useEffect(() => { setN((r || def).normal); setB((r || def).batalla); }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps
  const ops = (xs, v) => (xs.indexOf(v) < 0 ? [...xs, v].sort((x, y) => x - y) : xs);
  const cambio = n !== (r || def).normal || b !== (r || def).batalla;
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>El ritmo del bot en vivo</h3><span className={'db-est' + (r ? ' ojo' : ' ok')}>{r ? '✍ A tu gusto' : 'Como siempre'}</span></div>
      <p className="db-tx">Cada cuánto puede mandar un mensaje nuevo en un mismo chat. Editar el de las rondas no cuenta: no suena.</p>
      <div className="db-fila">
        <label className="db-campo db-corto"><span>En «Lo justo» y «Normal»</span>
          <select value={n} disabled={ocup} onChange={(e) => setN(Number(e.target.value))}>
            {ops(RIT_NORMAL, n).map((x) => <option key={x} value={x}>Uno cada {x} min</option>)}
          </select></label>
        <label className="db-campo db-corto"><span>En «Cada batalla» y más</span>
          <select value={b} disabled={ocup} onChange={(e) => setB(Number(e.target.value))}>
            {ops(RIT_BATALLA, b).map((x) => <option key={x} value={x}>Uno cada {x} min</option>)}
          </select></label>
      </div>
      <div className="cu-btns">
        <button type="button" className="btn verde chico" disabled={ocup || !cambio}
          onClick={() => hacer('ritmo', { normal: n, batalla: b }, 'Guardado: vale desde el próximo minuto.')}>Guardar</button>
        {r ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Tocá de nuevo para volver a lo de siempre"
          onClick={() => hacer('ritmo', null, 'Volvió el de siempre.')}>Volver a lo de siempre</DosToques> : null}
      </div>
      <p className="db-tx">Lo de siempre: uno cada {def.normal} minutos, y en «Cada batalla», uno cada {def.batalla}.</p>
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
        <AjRitmo aj={aj} hacer={hacer} ocup={ocup} chat={chat} />
        <AjSilencio aj={aj} hacer={hacer} ocup={ocup} />
        <AjApuestas liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} />
        <AjAvisos liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} />
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
  // ⚠️ por el id y no por el objeto: `dc` es uno nuevo en cada evento de la página (`quienMira()`), y el Dashboard
  // se volvía a pedir —con GitHub y lo en vivo— cada vez (revisión del 05/10/2026)
  }, [dc && dc.id]);
  useEffect(() => { W.scrollTo && W.scrollTo(0, 0); }, []);
  const cuotas = useCuotas(!!st.d);
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
        {(d.vivo || []).length ? (
          <section className="act">
            <div className="mis-cab"><span>EN VIVO AHORA</span><em>se actualiza al abrir el Dashboard</em></div>
            <EnVivo vivo={d.vivo} liga={liga} aj={d.ajustes || {}} chat={d.chat} />
          </section>
        ) : null}
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
        {d.pase ? (
          <section className="act">
            <div className="mis-cab"><span>EL PASE DE RAPERO</span>{d.pase.semana ? <em>la semana del {corto(d.pase.semana)}</em> : null}</div>
            <PaseNumeros p={d.pase} liga={liga} />
          </section>
        ) : null}
        <section className="act">
          <div className="mis-cab"><span>LO QUE TE LLEGÓ</span></div>
          <Llego d={d} />
        </section>
        <section className="act">
          <div className="mis-cab"><span>LO QUE GASTA CLOUDFLARE HOY</span><em>el plan gratis</em></div>
          <Cuotas q={cuotas} />
        </section>
        <section className="act">
          <div className="mis-cab"><span>CÓMO ANDA TODO</span></div>
          <Corridas corridas={d.corridas} s={d.sistema || {}} github={d.github} />
          <Sistema s={d.sistema || {}} sesiones={d.sesiones} />
          <ul className="db-atajos">{ATAJOS.map(([t, h]) => (
            <li key={h}><a href={h} target={h[0] === '/' ? undefined : '_blank'} rel={h[0] === '/' ? undefined : 'noopener noreferrer'}>{t} ↗</a></li>
          ))}</ul>
        </section>
      </>
    );
  }
  const [panel, setPanel] = useState(() => !panelCerrado());
  return (
    <section className="sec db">
      <style>{ESTILO}</style>
      <div className="sec-t"><h1>Dashboard</h1>
        {st.d && !panel ? <button type="button" className="btn borde2 chico" onClick={() => { panelPoner(true); setPanel(true); }}>Mostrarlo en el Inicio</button> : null}
      </div>
      {cuerpo}
    </section>
  );
}

// 🏠 EN EL INICIO, SÓLO PARA VOS (Dlx, 04/10/2026: «y que me aparezca a mí únicamente en el inicio también»). Lo
// dibuja App.jsx cuando la cuenta del navegador es la de Dlx, y se apaga solo si la puerta dice que no (otra cuenta
// con el ID copiado, o la sesión vencida): lo que se ve sale de `/avisos/dueno`, igual que el Dashboard
// ✕ Y SE CIERRA (Dlx, 07/10/2026: «crea una X para cerrar ese panel para mí»). Queda cerrado en ese navegador
// (`lg:db-ini`) y se vuelve a prender desde el Dashboard («Mostrarlo en el Inicio»)
const PANEL = 'lg:db-ini';
const panelCerrado = () => { try { return localStorage.getItem(PANEL) === 'no'; } catch (e) { return false; } };
const panelPoner = (si) => { try { if (si) localStorage.removeItem(PANEL); else localStorage.setItem(PANEL, 'no'); } catch (e) { /* sin almacenamiento */ } };
export function PanelDueno({ liga }) {
  const [st, setSt] = useState(null);
  const [cerrado, setCerrado] = useState(panelCerrado);
  useEffect(() => {
    if (cerrado) return undefined;
    let vivo = true;
    pedirDueno().then((x) => { if (vivo) setSt(x); });
    return () => { vivo = false; };
  }, [cerrado]);
  const q = useCuotas(!!(st && st.d) && !cerrado);
  if (cerrado || !st || st.no) return null;
  const d = st.d;
  const s = (d && d.uso && d.uso.semana) || {};
  const aj = (d && d.ajustes) || {};
  const m = liga.d.mult || {};
  const marcas = d ? [aj.campana_pausada ? '⏸ La campana está en pausa' : '',
    avisoVigente(aj) ? '📣 Hay un aviso publicado' : '',
    aj.multiplicadores && aj.multiplicadores.semana === m.id ? '✍ El multiplicador va a mano' : '',
    d.sistema && d.sistema.ok === false ? '⚠️ El vigía no contesta' : '',
    ...cuotasEnRojo(q).map(([, , t]) => '⚠️ ' + t + ' casi llenas hoy'),
    (d.vivo || []).length ? '🔴 ' + d.vivo.length + ' llave(s) en vivo' : ''].filter(Boolean) : [];
  return (
    <section className="db-ini" aria-label="Tu Dashboard">
      <style>{ESTILO}</style>
      <div className="db-ini-c">
        <b>TU DASHBOARD</b>
        <span className="db-ini-a">
          <a className="btn borde2 chico" href="#/dashboard">Abrir</a>
          <button type="button" className="db-ini-x" aria-label="Cerrar este panel" title="Cerrar (se vuelve a prender desde el Dashboard)"
            onClick={() => { panelPoner(false); setCerrado(true); }}><Ico n="cerrar" t={18} /></button>
        </span>
      </div>
      {d ? (
        <>
          {/* cada número dice qué cuenta y de cuándo: «visitas» sola no decía a qué */}
          <dl className="db-ini-n">
            <div><dt>Usaron el bot</dt><dd>{num(s.bot || 0)}</dd><dd className="db-ini-s">personas · 7 días</dd></div>
            <div><dt>Entraron con Discord</dt><dd>{num(s.web || 0)}</dd><dd className="db-ini-s">a la página · 7 días</dd></div>
            <div><dt>Abrieron la página</dt><dd>{num(s.visitas_dia || 0)}</dd><dd className="db-ini-s">celus o compus por día · prom. 7 días</dd></div>
            <div><dt>Postulaciones</dt><dd>{num((d.postulaciones || []).filter((p) => Date.now() - p.t < 7 * 864e5).length)}</dd><dd className="db-ini-s">servidores, por /sumate · 7 días</dd></div>
          </dl>
          {marcas.length ? <p className="db-ini-m">{marcas.join(' · ')}</p> : null}
        </>
      ) : <p className="db-ini-m">{st.sinCuenta ? 'Entrá con Discord para verlo.' : 'No pude leerlo ahora.'}</p>}
    </section>
  );
}
