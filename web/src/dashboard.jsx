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
  return { ajustes: j.ajustes || {}, hist: j.hist };
}

const avisoVigente = (aj) => (aj.aviso_web && Date.parse(aj.aviso_web.hasta) > Date.now() ? aj.aviso_web : null);

function Cajas({ u }) {
  const s = u.semana || {}, a = u.anterior || {};
  // ▲▼ contra la semana anterior, con color (13/10/2026); sin una semana entera antes, lo que mide cada caja
  const antes = (x, y) => ((a.dias || 0) >= 7 && y != null ? (x || 0) - y : null);
  const cajas = [
    ['USARON EL BOT', s.bot, antes(s.bot, a.bot) ?? 'personas distintas'],
    ['ENTRARON CON DISCORD', s.web, antes(s.web, a.web) ?? 'a la página, con su cuenta'],
    ['EN TOTAL', s.personas, antes(s.personas, a.personas) ?? 'en el bot o en la página'],
    // ⚠️ «VISITAS» SOLO NO DECÍA A QUÉ (Dlx, 07/10/2026: «visitas, pero visitas a qué?»): es cuántos celulares o
    // compus abrieron la página en el día —cada uno cuenta una vez, con o sin cuenta (`lg:visita` de App.jsx)—
    ['ABRIERON LA PÁGINA', s.visitas_dia, antes(s.visitas_dia, a.visitas_dia) ?? 'celus o compus por día, en promedio'],
  ];
  return (
    <div className="act-4">{cajas.map(([t, v, d]) => (
      <div key={t}><span>{t}</span><b>{num(v || 0)}</b>
        {typeof d === 'number' ? <small className={d > 0 ? 'db-sube' : d < 0 ? 'db-baja' : ''}>{d > 0 ? '▲ ' : d < 0 ? '▼ ' : '= '}{num(Math.abs(d))} contra la semana anterior</small>
          : <small>{d}</small>}</div>
    ))}</div>
  );
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
// los dos estados del ciclo, una vez por visita: los leen las cuotas y la meta del lobby
let estadosP = null;
const estados = () => (estadosP = estadosP || Promise.all(['estado_dibujar.json', 'estado_escuchar.json'].map((f) =>
  fetch(RAW + f, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null))));
function useCuotas(activo) {
  const [q, setQ] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    estados()
      .then((xs) => {
        const c = xs.filter((x) => x && x.cuotas).sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)))[0];
        if (vivo) setQ(c ? Object.assign({ cuando: c.cuando }, c.cuotas) : false);
      });
    return () => { vivo = false; };
  }, [activo]);
  return q;
}
// ── 🎯 LA META DEL LOBBY, ESCRITA ANTES DE MIRAR (Dlx, 13/10/2026: «hacer todo»; el research «Lobbies de juegos que
// enganchan», decisión 9 A: «se mide dos semanas antes y cuatro después contra una meta escrita»). El número es
// «Vuelven a jugar» (`rankings.retencion()`): de los que debutan en una semana, cuántos juegan otro evento, otro día,
// dentro de 14 días. Antes = las semanas de debut del 28/09 y el 05/10; con el lobby (para todos desde el 13/10) = las
// del 12/10, 19/10, 26/10 y 02/11. La del 21/09 no cuenta: fue la del arranque, con todos nuevos. ⚠️ Una semana se
// sabe recién 21 días después de su lunes (7 de debut + 14), por eso «completa». ⚠️ LA META NO SE CAMBIA DESPUÉS DE
// MIRAR: es lo que la hace una meta
const META_LOBBY = {
  puntos: 10, escrita: '2026-10-13',
  antes: ['2026-09-28', '2026-10-05'], despues: ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'],
  // lo que puede torcer el número, anotado antes (el research: «una semana rara, un feriado o un servidor nuevo»)
  ojo: ['FVS entró a la Liga el 12/10: gente nueva de otro servidor justo en la primera semana con el lobby'],
};
function useRetencion(activo) {
  const [r, setR] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    estados().then((xs) => {
      const c = xs.filter((x) => x && x.retencion && x.retencion.cohortes).sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)))[0];
      if (vivo) setR(c ? c.retencion : false);
    });
    return () => { vivo = false; };
  }, [activo]);
  return r;
}
function MetaLobby({ r }) {
  if (r === null) return <p className="pronto-p">Midiendo…</p>;
  if (!r) return <p className="pronto-p">Todavía no hay una medición del ciclo.</p>;
  const por = Object.fromEntries((r.cohortes || []).map((c) => [c.semana, c]));
  const pct = (xs) => {
    const cs = xs.map((k) => por[k]).filter((c) => c && c.completa && c.nuevos);
    const n = cs.reduce((t, c) => t + c.nuevos, 0);
    return cs.length === xs.length && n ? (100 * cs.reduce((t, c) => t + c.volvieron, 0)) / n : null;
  };
  const a = pct(META_LOBBY.antes), d = pct(META_LOBBY.despues);
  const fila = (k, cuando) => {
    const c = por[k];
    return (
      <tr key={k}><td>{corto(k)}</td><td>{cuando}</td><td>{c ? num(c.nuevos) : '—'}</td>
        <td>{c ? num(c.volvieron) + ' · ' + Math.round((100 * c.volvieron) / Math.max(1, c.nuevos)) + ' %' : '—'}</td>
        <td>{c && c.completa ? 'completa' : 'se está midiendo'}</td></tr>
    );
  };
  const fin = new Date(Date.parse(META_LOBBY.despues[META_LOBBY.despues.length - 1] + 'T12:00:00Z') + 21 * 864e5);
  return (
    <div className="db-aj">
      <p className="db-tx"><b>La meta, escrita el {corto(META_LOBBY.escrita)} antes de mirar:</b> «Vuelven a jugar» sube <b>{META_LOBBY.puntos} puntos</b> con el
        lobby. Es la parte de los que debutan en una semana que juega otro evento, otro día, dentro de 14 días.</p>
      <div className="db-tabla"><table>
        <thead><tr><th>Debut</th><th></th><th>Nuevos</th><th>Volvieron</th><th></th></tr></thead>
        <tbody>{META_LOBBY.antes.map((k) => fila(k, 'antes'))}{META_LOBBY.despues.map((k) => fila(k, 'con el lobby'))}</tbody>
      </table></div>
      <p className="db-tx">{a == null ? 'Antes: se sabe cuando cierre la semana del ' + corto(META_LOBBY.antes[1]) + '. '
        : 'Antes: ' + Math.round(a) + ' %. '}{d == null ? 'Con el lobby: se sabe el ' + corto(fin.toISOString().slice(0, 10)) + '.'
        : 'Con el lobby: ' + Math.round(d) + ' %. ' + (d - a >= META_LOBBY.puntos ? '✅ Se cumplió la meta.' : '❌ No llegó a la meta (' + (d >= a ? '+' : '') + Math.round(d - a) + ' puntos).')}</p>
      {META_LOBBY.ojo.map((x) => <p key={x} className="db-tx">⚠️ {x}.</p>)}
    </div>
  );
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
// ── 🧭 EL TUTORIAL (Dlx, 12/10/2026, «E. Dale»): cuántos navegadores nuevos lo vieron y cuántos lo terminaron. Cada cosa
// cuenta una vez por navegador (web/src/primera.js) y acá llega sumada, nunca de quién (`tutorialResumen()`)
const PASOS_TUTO = ['la bienvenida', 'Eventos', 'Ranking', 'Tarjetas', 'Pase'];
function TutorialNumeros({ t }) {
  const v = (k) => ((t && t.n) || {})[k] || 0;
  const pct = (a, b) => (b ? Math.round((100 * a) / b) + ' %' : '—');
  const cajas = [
    ['VIERON EL RECORRIDO', v('tour'), v('repite') ? 'y ' + num(v('repite')) + ' lo pidieron otra vez en la Guía' : 'la primera vez que entraron, por el Inicio'],
    ['LO TERMINARON', v('tour_fin'), pct(v('tour_fin'), v('tour')) + ' de los que lo vieron'],
    ['LLEGARON POR UN LINK', v('franja'), num(v('franja_si')) + ' tocaron «Ver cómo»'],
    ['PRIMEROS PASOS', v('pasos_fin'), 'completos, de ' + num(v('pasos')) + ' que los vieron en el Inicio'],
  ];
  const saltos = PASOS_TUTO.map((x, i) => [x, v('salta' + i)]).filter((x) => x[1]);
  return (
    <>
      <div className="act-4">{cajas.map(([k, n, d]) => <div key={k}><span>{k}</span><b>{num(n || 0)}</b><small>{d}</small></div>)}</div>
      <p className="db-tx">{saltos.length ? 'Dónde lo cortaron: ' + saltos.map(([x, n]) => x + ' ' + num(n)).join(' · ') + '.'
        : 'Nadie lo cortó a la mitad.'} Cuenta navegadores, no personas: quien cambia de celular cuenta otra vez.</p>
    </>
  );
}

// ── 📊 QUÉ SECCIONES SE ABREN (Dlx, 12/10/2026, el research «página sencilla»: medir antes de mover la tira). Cada
// navegador cuenta cada sección una vez por día (App.jsx, `lg:secc`) y acá llega sumado: esta semana y la anterior
const NOMBRE_SECC = { inicio: 'Inicio', eventos: 'Eventos', ranking: 'Ranking', publicaciones: 'Publicaciones',
  tarjetas: 'Tarjetas', pase: 'Pase', tienda: 'Tienda', socios: 'Socios', guia: 'Guía', perfil: 'Un perfil',
  servidor: 'Un servidor', crew: 'Una crew', pais: 'Un país', cuenta: 'Mi cuenta', cambios: 'Novedades',
  'i-historias': 'Las historias', 'i-envivo': 'Lo de arriba (Ahora)', 'i-semana': 'Esta semana', 'i-ira': 'La barra IR A',
  'i-fechas': 'Fechas', 'i-sebusca': 'Se busca', 'i-noticias': 'Lo último', 'i-encuestas': 'Encuestas y Tus eventos',
  'i-raperos': 'Los que mandan', 'i-panel': 'Misiones', 'i-merch': 'Merchandising', 'i-numeros': 'La Liga en números',
  'p-eventos': 'Puerta · Eventos', 'p-ranking': 'Puerta · Ranking', 'p-mw': 'Puerta · Se busca', 'p-tarjetas': 'Puerta · Tarjetas',
  'p-pase': 'Puerta · Pase', 'p-tienda': 'Puerta · Tienda' };
function SeccionesNumeros({ s, toques }) {
  // `toques`: lo que se toca en el Inicio (`i-` y `p-`); si no, las secciones que se abren
  const filas = Object.entries((s && s.n) || {}).filter(([k]) => /^[ip]-/.test(k) === !!toques).map(([k, v]) => [k, v[0] || 0, v[1] || 0])
    .filter((f) => f[1] || f[2]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
  const tope = Math.max(1, ...filas.map((f) => f[1]));
  if (!filas.length) return <p className="pronto-p">Todavía no se abrió ninguna.</p>;
  return (
    <div className="db-aj">
      <div className="db-q">{filas.map(([k, n, ant]) => (
        <div key={k} className="db-q-f"><span>{NOMBRE_SECC[k] || k}</span><i><u style={{ width: ((100 * n) / tope).toFixed(1) + '%' }} /></i>
          <b>{num(n)} <small>{ant ? 'antes ' + num(ant) : 'esta semana'}</small></b></div>
      ))}</div>
      <p className="db-tx">{toques ? 'Cuántos celus o compus tocaron algo de cada bloque del Inicio, o cada puerta, en los últimos 7 días (una vez por día cada uno). Para decidir qué sube, qué baja y qué sobra con números.'
        : 'Cuántos celus o compus abrieron cada sección en los últimos 7 días (cada uno cuenta una vez por día), y la semana anterior al lado. Sirve para ordenar la barra de abajo por lo que la gente usa.'}</p>
    </div>
  );
}

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
function AjVivo({ liga, aj, hacer, ocup, chat, general }) {
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
      {general ? <p className="db-tx">Si habla y cuánto, servidor por servidor, en su tarjeta de arriba.</p> : svs.length ? (
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
function AjAvisos({ liga, aj, hacer, ocup, chat, general }) {
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
      <label className="db-campo"><span>Cuánto dice</span>
        <select value={v} disabled={ocup} aria-label="Cuánto dice el aviso de cada evento"
          onChange={(e) => hacer('avisos_nivel', e.target.value, 'Guardado: vale desde el próximo evento.')}>
          {Object.keys(NIVELES_AVISO).map((k) => <option key={k} value={k}>{NIVELES_AVISO[k][0]}</option>)}
        </select></label>
      {general ? <p className="db-tx">Dónde va el de cada servidor, en su tarjeta de arriba.</p> : null}
      {!general && svs.length ? (
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

// 🎲 las apuestas: los botones, cuánto quedan abiertas, el tope por batalla, dónde van en cualquier nivel y dónde no van
function AjApuestas({ liga, aj, hacer, ocup, chat, general }) {
  const def = ((chat || {}).def || {}).apuestas || DEF_AP;
  const a = aj.apuestas || null;
  const firma = JSON.stringify(a);
  const [montos, setMontos] = useState((a || def).montos.join(', '));
  const [minutos, setMinutos] = useState((a || def).minutos);
  const [tope, setTope] = useState((a || def).tope);
  const [fuera, setFuera] = useState((a && a.apagadas) || {});
  // 🎲 prendidas a mano, en cualquier nivel del bot en vivo (13/10/2026, ver `hayApuestas()` en avisos.js)
  const [dentro, setDentro] = useState((a && a.prendidas) || {});
  useEffect(() => {
    const r = a || def;
    setMontos(r.montos.join(', ')); setMinutos(r.minutos); setTope(r.tope); setFuera((a && a.apagadas) || {});
    setDentro((a && a.prendidas) || {});
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
      <p className="db-tx">Con el bot en vivo en <b>A full</b> salen solas, en el mensaje de cada cruce. <b>Prendidas</b> en un servidor salen en cualquier nivel: un mensaje con la batalla que viene y sus botones (el admin de cada servidor también las puede prender con <code>/settings</code>). Se apuesta con Puntos de Tienda y el pozo se reparte entre los que aciertan. «No hay apuestas en» gana sobre todo.</p>
      <form className="db-form uno" onSubmit={(e) => {
        e.preventDefault();
        if (!mal) hacer('apuestas', { montos: ms, minutos: Number(minutos), tope: t, apagadas: fuera, prendidas: dentro }, 'Guardado: vale para la próxima apuesta.');
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
        {!general && svs.length ? (
          <fieldset className="db-chk"><legend>Prendidas en <small>(en cualquier nivel)</small></legend>
            {svs.map((sv) => (
              <label key={sv}><input type="checkbox" checked={!!dentro[sv]} disabled={!!fuera[sv]} onChange={(e) => {
                const n = Object.assign({}, dentro);
                if (e.target.checked) n[sv] = true; else delete n[sv];
                setDentro(n);
              }} /><img alt="" src={liga.logo(sv)} />{siglaDe(sv)}</label>
            ))}
          </fieldset>
        ) : null}
        {!general && svs.length ? (
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


// ── 🧭 EL DASHBOARD, ORDENADO (13/10/2026, Dlx a las ideas: «me gustan todas»). Eran catorce bloques uno abajo del
// otro; ahora cuatro pestañas —Hoy, Ajustes, Números, Sistema—, la de Hoy con lo que pide atención; los ajustes de cada
// servidor juntos en su tarjeta; las flechas contra la semana anterior; y el historial de cambios con «Deshacer».
// La pestaña elegida se recuerda en este navegador (`lg:db-tab`)
// 📣✅ Reportes y Decisiones, desde el 13/10/2026 (Dlx: «agregar quizás reportes y una ventana de decisiones»)
const PESTANAS = [['hoy', 'Hoy'], ['reportes', 'Reportes'], ['decisiones', 'Decisiones'], ['ajustes', 'Ajustes'], ['numeros', 'Números'], ['sistema', 'Sistema']];
const TAB = 'lg:db-tab';
const leerTab = () => { try { const t = localStorage.getItem(TAB); return PESTANAS.some(([k]) => k === t) ? t : 'hoy'; } catch (e) { return 'hoy'; } };
const ponerTab = (t) => { try { localStorage.setItem(TAB, t); } catch (e) { /* sin almacenamiento */ } };

// el `hacer` de los ajustes: guarda, avisa y dice si salió. Lo comparten los ajustes y el historial
function useHacer(onAj) {
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  const hacer = async (cual, valor, ok) => {
    setOcup(true); setMsg('');
    let bien = false;
    try { onAj(await ajustar(cual, valor)); setMsg('✅ ' + ok); bien = true; } catch (e) { setMsg('⚠️ No se pudo: ' + e.message + '.'); }
    setOcup(false);
    return bien;
  };
  return { hacer, msg, ocup };
}

// 🔔 lo que pide atención: lo mismo que marca el panel del Inicio, y la última corrida del ciclo si salió mal
function atencion(d, liga, q) {
  const aj = d.ajustes || {};
  const m = liga.d.mult || {};
  const ult = (d.corridas || [])[0];
  const av = avisoVigente(aj);
  return [
    aj.campana_pausada ? ['⏸', 'La campana está en pausa', 'No sale ningún aviso de evento hasta que la reanudes (Ajustes).'] : null,
    av ? ['📣', 'Hay un aviso publicado en la página', av.texto] : null,
    aj.multiplicadores && aj.multiplicadores.semana === m.id ? ['✍', 'El multiplicador de esta semana va a mano', 'No es el del sorteo.'] : null,
    d.sistema && d.sistema.ok === false ? ['⚠️', 'El vigía no contesta', 'Los avisos al minuto y el bot en vivo pueden estar quietos.'] : null,
    ult && ult.estado === 'completed' && ult.fin && ult.fin !== 'success' && ult.fin !== 'skipped'
      ? ['⚠️', 'La última corrida del ciclo ' + String(FIN_CORRIDA[ult.fin] || ult.fin).replace(/^\S+\s/, ''), 'Mirá Sistema.'] : null,
    ...cuotasEnRojo(q).map(([, , t]) => ['⚠️', t + ' casi llenas hoy', 'Se renuevan a las 8 PM ET.']),
    // 📣 los reportes de las llaves sin mirar, y una corrección que no se pudo (13/10/2026)
    ...(() => { const r = (d.reportes || []).filter((x) => x.estado === ''); return r.length ? [['📣', r.length === 1 ? 'Un reporte de una llave sin mirar' : r.length + ' reportes de llaves sin mirar', 'En la pestaña Reportes: corregilo o marcalo como listo.']] : []; })(),
    ...(d.reportes || []).filter((x) => x.estado === 'no_pude').map((x) => ['⚠️', 'No se pudo corregir la llave #' + x.llave, x.resultado]),
    // ✅ y lo de ✅ Decidir sin contestar (13/10/2026)
    ...(sinContestar(d.decidir) ? [['✅', sinContestar(d.decidir) === 1 ? 'Una pregunta de ✅ Decidir sin contestar' : sinContestar(d.decidir) + ' preguntas de ✅ Decidir sin contestar', 'En la pestaña Decisiones.']] : []),
  ].filter(Boolean);
}
function Atencion({ xs }) {
  if (!xs.length) return <p className="db-ok">✅ Todo en orden: nada pide tu atención ahora.</p>;
  return <ul className="db-at">{xs.map(([ic, t, s]) => <li key={t}><span aria-hidden="true">{ic}</span><div><b>{t}</b>{s ? <small>{s}</small> : null}</div></li>)}</ul>;
}

// ── 🏟️ AJUSTES POR SERVIDOR: todo lo de cada uno en su tarjeta —el bot en vivo y cuánto habla, las apuestas, el aviso de
// cada evento y el multiplicador de la semana— en vez de que cada ajuste repita la lista de servidores. Cada selector
// guarda con el mismo `ajustar()` y el mismo valor entero que guardaban las cajas de antes
function AjServidores({ liga, aj, hacer, ocup, chat }) {
  const c = chat || {};
  const svs = svsDe(chat, aj);
  if (!svs.length) return <p className="db-tx">Todavía no sé el chat general de ningún servidor: el vigía lo busca en su próxima vuelta.</p>;
  const dash = aj.en_vivo || {}, dashNivel = aj.en_vivo_nivel || {};
  const niveles = c.niveles || NIVELES_VIVO;
  const admin = c.admin || {};
  const nivelAdmin = (sv) => (c.nivel || {})[sv] || 'normal';
  const prendido = (sv) => dash[sv] !== false && (!!admin[sv] || dash[sv] === true);
  const defAp = (c.def || {}).apuestas || DEF_AP;
  const ap = aj.apuestas || null;
  const apBase = { montos: (ap || defAp).montos, minutos: (ap || defAp).minutos, tope: (ap || defAp).tope,
    apagadas: (ap && ap.apagadas) || {}, prendidas: (ap && ap.prendidas) || {} };
  const apDe = (sv) => (apBase.apagadas[sv] ? 'no' : apBase.prendidas[sv] ? 'si' : '');
  const ae = aj.aviso_evento || {};
  const porSv = ae.sv || {};
  const m = liga.d.mult || {};
  const base = m.sv || {};
  const man = aj.multiplicadores && aj.multiplicadores.semana === m.id ? aj.multiplicadores.sv || {} : null;
  const ref = Object.assign({}, base, man || {});
  const YA = 'Guardado: vale desde el próximo minuto.';
  const cambiar = (cual, obj, sv, v) => { const n = Object.assign({}, obj); if (v === '') delete n[sv]; else n[sv] = v; return hacer(cual, n, YA); };
  const cambiarAp = (sv, v) => {
    const ag = Object.assign({}, apBase.apagadas), pr = Object.assign({}, apBase.prendidas);
    delete ag[sv]; delete pr[sv];
    if (v === 'no') ag[sv] = true; else if (v === 'si') pr[sv] = true;
    return hacer('apuestas', Object.assign({}, apBase, { apagadas: ag, prendidas: pr }), 'Guardado: vale para la próxima apuesta.');
  };
  const cambiarAviso = (sv, v) => {
    const n = Object.assign({}, porSv);
    if (v) n[sv] = v; else delete n[sv];
    return hacer('aviso_evento', { sv: n, resto: ae.resto || '' }, 'Guardado: vale desde el próximo evento.');
  };
  const cambiarMult = (sv, x) => hacer('multiplicadores', { semana: m.id, sv: Object.assign({}, ref, { [sv]: x }) },
    'Guardado. Entra en la próxima corrida del ciclo.');
  return (
    <>
      {m.id ? (
        <div className="db-svs-c">
          <span className={'db-est' + (man ? ' ojo' : '')}>{man ? '✍ El multiplicador de esta semana va a mano' : 'El multiplicador de esta semana es el del sorteo'}</span>
          {man ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Tocá de nuevo para volver al sorteo"
            onClick={() => hacer('multiplicadores', null, 'Vuelve el sorteo en la próxima corrida del ciclo.')}>Volver al sorteo</DosToques> : null}
        </div>
      ) : null}
      <div className="db-svs">{svs.map((sv) => {
        const ops = base[sv] == null ? [] : FACTORES.indexOf(ref[sv]) < 0 ? [...FACTORES, ref[sv]].sort((a, b) => a - b) : FACTORES;
        return (
          <section key={sv} className="db-svc" aria-label={'Ajustes de ' + siglaDe(sv)}>
            <header><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b>
              <span className={'db-est' + (prendido(sv) ? ' ok' : '')}>{prendido(sv) ? '● bot en vivo' : 'bot apagado'}</span></header>
            <label><span>Bot en vivo</span>
              <select value={dash[sv] === true ? 'si' : dash[sv] === false ? 'no' : ''} disabled={ocup}
                onChange={(e) => cambiar('en_vivo', dash, sv, e.target.value === '' ? '' : e.target.value === 'si')}>
                <option value="">{admin[sv] ? 'Lo que eligió su admin: prendido' : 'Lo que eligió su admin: apagado'}</option>
                <option value="si">Prendido, en su chat general</option>
                <option value="no">Apagado</option>
              </select></label>
            <label><span>Cuánto habla</span>
              <select value={niveles[dashNivel[sv]] ? dashNivel[sv] : ''} disabled={ocup || !prendido(sv)}
                onChange={(e) => cambiar('en_vivo_nivel', dashNivel, sv, e.target.value)}>
                <option value="">{'Lo que eligió su admin: ' + ((niveles[nivelAdmin(sv)] || ['normal'])[0]).toLowerCase()}</option>
                {Object.keys(niveles).map((k) => <option key={k} value={k}>{niveles[k][0]}</option>)}
              </select></label>
            <label><span>Apuestas</span>
              <select value={apDe(sv)} disabled={ocup} onChange={(e) => cambiarAp(sv, e.target.value)}>
                <option value="">Como siempre: sólo en «A full»</option>
                <option value="si">Prendidas, en cualquier nivel</option>
                <option value="no">Apagadas</option>
              </select></label>
            <label><span>Aviso de cada evento</span>
              <select value={porSv[sv] || ''} disabled={ocup} onChange={(e) => cambiarAviso(sv, e.target.value)}>
                <option value="">Donde habla el bot en vivo</option>
                <option value="chat">En su chat general, siempre</option>
                <option value="no">Apagado</option>
              </select></label>
            {ops.length ? (
              <label><span>Multiplicador de la semana</span>
                <select value={String(ref[sv])} disabled={ocup} onChange={(e) => cambiarMult(sv, Number(e.target.value))}>
                  {ops.map((x) => <option key={x} value={String(x)}>{mult(x)}</option>)}
                </select></label>
            ) : null}
          </section>
        );
      })}</div>
    </>
  );
}

// ── 🕓 LOS ÚLTIMOS CAMBIOS, CON «DESHACER» (13/10/2026): lo anota el objeto en cada ajuste (`ajuste()` en avisos.js), con
// lo que había antes. «Deshacer» sólo en el último cambio de cada ajuste: deshacer uno más viejo pisaría los de después
const NOMBRE_AJ = { campana_pausada: 'La campana', multiplicadores: 'El multiplicador de la semana', aviso_web: 'El aviso en la página',
  en_vivo: 'El bot en vivo', en_vivo_nivel: 'Cuánto habla el bot en vivo', ritmo: 'El ritmo del bot en vivo', silencio: 'El horario de silencio',
  apuestas: 'Las apuestas', aviso_evento: 'Dónde va el aviso de cada evento', avisos_nivel: 'Cuánto dice el aviso de cada evento' };
function Historial({ hist, hacer, ocup }) {
  const xs = (hist || []).slice(0, 15);
  if (!xs.length) return <p className="db-tx">Todavía no hay cambios anotados: el historial empezó el 13/10/2026.</p>;
  const ultimo = new Set();
  return (
    <ul className="db-hist">{xs.map((x) => {
      const puede = !ultimo.has(x.cual);
      ultimo.add(x.cual);
      return (
        <li key={x.t + x.cual}>
          <div><b>{NOMBRE_AJ[x.cual] || x.cual}</b>
            <small>{hace(x.t)} · {x.despues === null ? 'volvió a lo de siempre' : x.antes === null ? 'pasó a tu gusto' : 'cambió'}</small></div>
          {puede ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Tocá de nuevo: vuelve a como estaba"
            onClick={() => hacer(x.cual, x.antes, 'Deshecho: volvió a como estaba.')}>Deshacer</DosToques> : null}
        </li>
      );
    })}</ul>
  );
}

// ── 🏷️ LOS ROLES DE LA PÁGINA (13/10/2026). Dlx: «roles superiores ÚNICAMENTE decididos por mí: Moderador de la página
// web, asistente, Admin y owner únicamente yo». Los que salen solos (Competidor, Socio, Staff, Organizador, Jurado,
// Host) los arma el ciclo desde Discord; acá se ponen los de Dlx y se corrige cualquiera. Owner es sólo Dlx ──
const ROLES_MANO = [['admin', 'Admin'], ['asistente', 'Asistente'], ['moderador', 'Moderador de la página'], ['socio', 'Socio'],
  ['staff', 'Staff'], ['organizador', 'Organizador'], ['jurado', 'Jurado'], ['host', 'Host'], ['competidor', 'Competidor']];
const nombreRol = (r) => ((ROLES_MANO.find((x) => x[0] === r) || [r, r === 'owner' ? 'Owner' : r])[1]);
const normN = (s) => String(s || '').normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

async function ponerRol(cuerpo) {
  const r = await fetch('/api/avisos/dueno/rol', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entrá de nuevo' : j.error || String(r.status));
  return j.roles || {};
}

function Roles({ roles, alCambiar }) {
  const [x, setX0] = useState(roles || {});
  useEffect(() => { setX0(roles || {}); }, [roles]);
  const setX = (y) => { setX0(y); if (alCambiar) alCambiar(y); };
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const dir = x.dir || [], man = x.manual || {};
  if (!dir.length) return <p className="pronto-p">El ciclo todavía no mandó la lista de la gente: aparece en su próxima corrida.</p>;
  const q = normN(busca);
  const hallados = q.length >= 2 ? dir.filter((p) => normN(p[1]).includes(q)).slice(0, 8) : [];
  const p = sel && dir.find((y) => y[2] === sel);
  const conMano = dir.filter((y) => man[y[2]] && Object.keys(man[y[2]]).length);
  const cambiar = async (rol, si) => {
    setOcup(true); setMsg('');
    try { setX(await ponerRol({ id: p[2], rol, si })); } catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup(false);
  };
  const chips = (l) => (l || []).map((r) => <span key={r[0]} className="db-chip">{nombreRol(r[0])}{r[1] ? ' · ' + r[1].join(', ') : ''}</span>);
  return (
    <div className="db-roles">
      <label className="db-campo"><span>Buscar a alguien de la Lista</span>
        <input type="search" className="db-sel" value={busca} placeholder="su nombre" onChange={(e) => setBusca(e.target.value)} /></label>
      {hallados.length ? <div className="db-opc">{hallados.map((y) => (
        <button key={y[2]} type="button" className={sel === y[2] ? 'on' : ''} onClick={() => setSel(y[2])}>{y[1]}</button>))}</div> : null}
      {p ? (
        <div className="db-rep-form">
          <span className="db-rep-p">{p[1]}{p[0] ? <> · <a href={'#/r/' + p[0]}>su perfil</a></> : null}</span>
          <div className="db-l1">{p[3].length ? chips(p[3]) : <small>Sin roles.</small>}</div>
          {p[2] === '739338101603696681' ? <small>Owner: sólo vos, siempre.</small> : null}
          <ul className="db-roles-l">{ROLES_MANO.map(([rol, n]) => {
            const m = (man[p[2]] || {})[rol];
            const solo = p[4] && p[4][rol];
            return (
              <li key={rol}>
                <b>{n}</b>
                <small>{solo ? 'sale solo' + (solo.length ? ' (' + solo.join(', ') + ')' : '') : ['admin', 'asistente', 'moderador'].includes(rol) ? '' : 'no sale solo'}</small>
                <select className="db-sel" disabled={ocup} value={m === 1 ? 'si' : m === 0 ? 'no' : 'auto'}
                  onChange={(e) => cambiar(rol, e.target.value === 'si' ? true : e.target.value === 'no' ? false : null)}>
                  <option value="auto">{['admin', 'asistente', 'moderador'].includes(rol) ? 'No' : 'Como sale solo'}</option>
                  <option value="si">Sí</option>
                  {['admin', 'asistente', 'moderador'].includes(rol) ? null : <option value="no">No, aunque salga solo</option>}
                </select>
              </li>
            );
          })}</ul>
          {msg ? <small role="status">{msg}</small> : null}
        </div>
      ) : null}
      {conMano.length ? <><span className="db-rep-p">Con roles puestos a mano</span>
        <ul className="db-roles-c">{conMano.map((y) => (
          <li key={y[2]}><button type="button" className="db-link" onClick={() => setSel(y[2])}>{y[1]}</button>
            {Object.entries(man[y[2]]).map(([r, si]) => <span key={r} className="db-chip">{si ? '' : 'sin '}{nombreRol(r)}</span>)}</li>))}</ul></> : null}
      {(x.hist || []).length ? <><span className="db-rep-p">Los últimos cambios</span>
        <ul className="db-roles-c">{x.hist.slice(0, 8).map((h) => (
          <li key={h.t + h.rol}><small>{hace(h.t)}</small> {h.n || h.id}: {h.si === null ? 'como sale solo' : h.si ? 'sí' : 'no'} {nombreRol(h.rol)}</li>))}</ul></> : null}
    </div>
  );
}

function Ajustes({ liga, aj, chat, hist, hacer, msg, ocup, roles, alRoles }) {
  return (
    <>
      <h2 className="db-h">Cada servidor</h2>
      <AjServidores liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} />
      {msg ? <p className="db-msg" role="status">{msg}</p> : null}
      <h2 className="db-h">Para todos</h2>
      <div className="db-ajs">
        <AjCampana aj={aj} hacer={hacer} ocup={ocup} />
        <AjAviso liga={liga} aj={aj} hacer={hacer} ocup={ocup} />
        <AjVivo liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general />
        <AjRitmo aj={aj} hacer={hacer} ocup={ocup} chat={chat} />
        <AjSilencio aj={aj} hacer={hacer} ocup={ocup} />
        <AjApuestas liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general />
        <AjAvisos liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general />
      </div>
      <h2 className="db-h">Los últimos cambios</h2>
      <Historial hist={hist} hacer={hacer} ocup={ocup} />
      <h2 className="db-h">Roles</h2>
      <Roles roles={roles} alCambiar={alRoles} />
    </>
  );
}

// 🎬 LOS VIDEOS QUE NO ENTRARON SOLOS (12/10/2026): un canal grande, un nombre famoso o parecido, o dos de la Liga con
// el mismo nombre. Aprobar o no lo aplica el ciclo (`bot/videos_propios.py`); acá sale de la lista al tocar
function VideosRevisar({ vs }) {
  const [hecho, setHecho] = useState({});
  const decidir = async (id, si) => {
    setHecho(Object.assign({}, hecho, { [id]: '…' }));
    try {
      const r = await fetch('/api/avisos/dueno/video', { method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, si }) });
      setHecho((h) => Object.assign({}, h, { [id]: r.ok ? (si ? 'aprobado' : 'no') : 'falló' }));
    } catch (e) { setHecho((h) => Object.assign({}, h, { [id]: 'falló' })); }
  };
  return (
    <div><h3>Videos para revisar <small>los que no entraron solos</small></h3>
      <ul>{vs.map(([id, raw, tit, url, motivo]) => (
        <li key={id}>
          <div className="db-l1"><b>{limpio(raw)}</b><span className="db-chip ojo">{motivo}</span></div>
          <a className="db-link" href={url} target="_blank" rel="noopener noreferrer">{tit || url}</a>
          {hecho[id] && hecho[id] !== 'falló' ? <small>{hecho[id] === '…' ? 'mandando…' : hecho[id] === 'aprobado' ? '✓ aprobado: entra en la próxima corrida' : '✗ no entra'}</small> : (
            <div className="cu-btns">
              <button type="button" className="btn verde chico" onClick={() => decidir(id, true)}>Aprobar</button>
              <button type="button" className="btn borde2 chico" onClick={() => decidir(id, false)}>No</button>
              {hecho[id] === 'falló' ? <small>No se pudo: probá de nuevo.</small> : null}
            </div>
          )}
        </li>
      ))}</ul>
    </div>
  );
}

// ── 📣 LOS ERRORES REPORTADOS EN LAS LLAVES, CON QUÉ HACER (13/10/2026). Dlx: «me llegaron los reportes pero ¿qué
// acciones puedo hacer acá?», y a la propuesta, «Sí, todas». «Corregir» elige de quién era un nombre de esa llave —quien
// lo reportó, otro de la Lista o alguien que no está— o quién ganó una batalla; vale SÓLO para ese evento, lo aplica el
// ciclo en su próxima corrida (`bot/reportes.py --corregir`) y a quien reportó le llega a su campana. «Listo» y «Era una
// prueba» lo sacan de la lista. Lo que se ve de cada llave sale de `/api/llaves`, como las llaves viejas de la página ──
let LLAVES = null;
const pedirLlaves = () => {
  if (!LLAVES) {
    LLAVES = fetch('/api/llaves', { headers: { accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((t) => (t && t.llaves) || t || {})
      .catch(() => { LLAVES = null; return null; });
  }
  return LLAVES;
};
const ESTADO_REP = {
  corregir: ['⏳ en la próxima corrida', ''], aplicado: ['✅ corregido', 'ok'], no_pude: ['⚠️ no se pudo', 'ojo'],
  listo: ['listo', ''], prueba: ['era una prueba', ''],
};
const QUE_REP = { ganador: 'el ganador', gente: 'falta o sobra alguien', nombre: 'un nombre', otro: 'otra cosa' };
// las partes de un lado: «Presagio, NC, Agus» son tres
const partes = (x) => String(x || '').split(/\s*[,+&]\s*/).map((s) => s.trim()).filter(Boolean);

async function decidirReporte(cuerpo) {
  const r = await fetch('/api/avisos/dueno/reporte', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entrá de nuevo' : j.error || String(r.status));
  return j.reportes || [];
}

// el formulario de «Corregir»: un nombre o el ganador, con lo que la llave de verdad trae
function Corregir({ r, liga, alListo, hermanos }) {
  const [L, setL] = useState(undefined);
  const [modo, setModo] = useState(r.que === 'ganador' ? 'ganador' : 'nombre');
  const [nombre, setNombre] = useState('');
  const [quien, setQuien] = useState('reporta');
  const [conHermanos, setConHermanos] = useState(true);
  const [es, setEs] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [bat, setBat] = useState('');
  const [gana, setGana] = useState('');
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  useEffect(() => { let vivo = true; pedirLlaves().then((t) => { if (vivo) setL((t && t[r.llave]) || null); }); return () => { vivo = false; }; }, [r.llave]);
  if (L === undefined) return <p className="db-rep-nota">Trayendo la llave…</p>;
  if (!L) return <p className="db-rep-nota">No encuentro la llave #{r.llave} en la página: no se puede corregir desde acá.</p>;
  // los nombres de la llave, una vez: la tabla y cada parte de cada lado
  const nombres = [];
  for (const f of L.tabla || []) if (f[0] && !nombres.includes(f[0])) nombres.push(f[0]);
  for (const ro of L.rondas || []) for (const b of ro.b || []) for (const lado of b[0] || []) for (const p of partes(lado)) if (!nombres.includes(p)) nombres.push(p);
  const batallas = [];
  (L.rondas || []).forEach((ro, i) => (ro.b || []).forEach((b, j) => { if ((b[0] || []).length >= 2) batallas.push({ k: i + ':' + j, ronda: ro.r, lados: b[0], ganador: b[1] }); }));
  const b = batallas.find((x) => x.k === bat);
  const lista = ((liga && liga.d && liga.d.tabla) || []).map((x) => x.n);
  const listo = modo === 'nombre' ? !!nombre && (quien === 'reporta' || (quien === 'es' ? !!es.trim() : !!nuevo.trim()))
    : !!b && !!gana && gana !== b.ganador;
  // ⚠️ ELEGIR LO QUE LA LLAVE YA DICE NO CAMBIA NADA, y el botón apagado no lo decía (Dlx, con el de Zetryko: «estoy
  // haciendo click a aplicar pero nada»): se dice, y se ofrece cerrarlo
  const yaDice = modo === 'ganador' && !!b && !!gana && gana === b.ganador;
  const falta = modo === 'nombre' ? (!nombre ? 'Elegí el nombre que está mal.' : !listo ? 'Elegí de quién era.' : '')
    : (!b ? 'Elegí la batalla.' : !gana ? 'Elegí quién la ganó.' : '');
  const aplicar = async () => {
    setOcup(true); setMsg('');
    try {
      const c = modo === 'nombre'
        ? Object.assign({ accion: 'nombre', n: r.llave, nombre }, quien === 'reporta' ? { reporta: true } : quien === 'es' ? { es: es.trim() } : { nuevo: nuevo.trim() })
        : { accion: 'ganador', n: r.llave, ronda: b.ronda, lados: b.lados, ganador: gana };
      // 🧩 y lo mismo para los otros reportes abiertos de esta llave, si se marcó (Dlx: «hazlo sencillo de solucionar
      // múltiples problemas»): el ciclo los da por corregidos con la misma regla
      let l = await decidirReporte(Object.assign({ id: r.id }, c));
      for (const h of (conHermanos ? hermanos : [])) l = await decidirReporte(Object.assign({ id: h.id }, c));
      alListo(l);
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  const cerrarListo = async () => {
    setOcup(true);
    try { alListo(await decidirReporte({ id: r.id, accion: 'listo' })); } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  const id = 'rep' + r.id;
  return (
    <div className="db-rep-form">
      <div className="db-opc" role="group" aria-label="Qué corregir">
        <button type="button" className={modo === 'nombre' ? 'on' : ''} onClick={() => setModo('nombre')}>Un nombre</button>
        <button type="button" className={modo === 'ganador' ? 'on' : ''} onClick={() => setModo('ganador')}>El ganador</button>
      </div>
      {modo === 'nombre' ? <>
        <span className="db-rep-p">¿Qué nombre está mal en la #{r.llave}?</span>
        <div className="db-opc">{nombres.map((x) => <button key={x} type="button" className={nombre === x ? 'on' : ''} onClick={() => setNombre(x)}>{x}</button>)}</div>
        {nombre ? <>
          <span className="db-rep-p">«{nombre}» era…</span>
          <div className="db-rep-q">
            {/* quien lo mandó, siempre: el ciclo sabe su cuenta aunque no tenga perfil en la página */}
            <label><input type="radio" name={id} checked={quien === 'reporta'} onChange={() => setQuien('reporta')} /> quien lo mandó{r.evid && r.evid.quien ? ' (' + r.evid.quien + ')' : r.de ? ' (' + r.de + ')' : ''}</label>
            <label><input type="radio" name={id} checked={quien === 'es'} onChange={() => setQuien('es')} /> otro de la Lista:
              <input type="text" list={id + 'l'} value={es} placeholder="su nombre" onFocus={() => setQuien('es')} onChange={(e) => setEs(e.target.value)} maxLength={60} /></label>
            <label><input type="radio" name={id} checked={quien === 'nuevo'} onChange={() => setQuien('nuevo')} /> alguien que no está en la Lista:
              <input type="text" value={nuevo} placeholder="Agustin 🇺🇾" onFocus={() => setQuien('nuevo')} onChange={(e) => setNuevo(e.target.value)} maxLength={40} /></label>
            <datalist id={id + 'l'}>{lista.map((x) => <option key={x} value={x} />)}</datalist>
          </div>
        </> : null}
      </> : <>
        <span className="db-rep-p">¿Qué batalla de la #{r.llave}?</span>
        <select className="db-sel" value={bat} onChange={(e) => { setBat(e.target.value); setGana(''); }}>
          <option value="">Elegí la batalla</option>
          {batallas.map((x) => <option key={x.k} value={x.k}>{x.ronda} · {x.lados.join(' vs ')} (dice: {x.ganador || '—'})</option>)}
        </select>
        {b ? <>
          <span className="db-rep-p">¿Quién la ganó?</span>
          <div className="db-opc">{b.lados.map((x) => <button key={x} type="button" className={gana === x ? 'on' : ''} onClick={() => setGana(x)}>{x}{x === b.ganador ? ' (lo que dice hoy)' : ''}</button>)}</div>
        </> : null}
      </>}
      {yaDice ? <p className="db-rep-ya">La llave ya dice que ganó {gana}: no hay nada que corregir. Si el reporte pedía eso, cerralo con «Listo».</p>
        : <p className="db-rep-nota">Cambia sólo en la #{r.llave}. Lo aplica el ciclo en su próxima corrida y a quien lo reportó le llega a la campana.</p>}
      {hermanos.length && !yaDice ? <label className="db-rep-herm"><input type="checkbox" checked={conHermanos} onChange={(e) => setConHermanos(e.target.checked)} />
        {' '}lo mismo para {hermanos.length === 1 ? 'el otro reporte' : 'los otros ' + hermanos.length + ' reportes'} de la #{r.llave}</label> : null}
      <div className="cu-btns">
        {yaDice ? <button type="button" className="btn verde chico" disabled={ocup} onClick={cerrarListo}>Listo</button>
          : <button type="button" className="btn verde chico" disabled={!listo || ocup} onClick={aplicar}>{ocup ? 'Guardando…' : 'Aplicar'}</button>}
        {!yaDice && falta ? <small>{falta}</small> : null}
        {msg ? <small role="status">{msg}</small> : null}
      </div>
    </div>
  );
}

// 🔎 LO QUE ENCONTRÓ EL BOT de un reporte (13/10/2026, Dlx: «para cada cosa necesitaremos evidencia… que el bot nos dé
// evidencia»): una línea por prueba —las inscripciones con la cuenta que las escribió, la llamada, lo ya decidido— y,
// si todo apunta a una persona, la corrección sugerida para aplicar con un toque. Es una pista: decide Dlx
function Evidencia({ r, alListo }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const s = r.evid.sugerencia;
  const abierto = r.estado === '' || r.estado === 'no_pude';
  const aplicar = async () => {
    setOcup(true); setMsg('');
    try {
      alListo(await decidirReporte(Object.assign({ id: r.id, accion: 'nombre', n: r.llave, nombre: s.nombre },
        s.reporta ? { reporta: true } : { es: s.es })));
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  return (
    <div className="db-evid">
      <span className="db-rep-p">🔎 Lo que encontró el bot</span>
      <ul>{r.evid.lineas.slice(1).map(([ic, t]) => <li key={t}><span aria-hidden="true">{ic}</span>{t}</li>)}</ul>
      {s && abierto && /^\d+$/.test(r.llave) ? (
        <div className="cu-btns">
          <button type="button" className="btn verde chico" disabled={ocup} onClick={aplicar}>
            {ocup ? 'Guardando…' : 'Aplicar lo sugerido: «' + s.nombre + '» era ' + (s.reporta ? 'quien lo mandó' : s.es_txt || s.es)}</button>
          {msg ? <small role="status">{msg}</small> : null}
        </div>) : null}
    </div>
  );
}

function Reportes({ rep, liga, alCambiar }) {
  const [lista, setLista0] = useState(rep);
  useEffect(() => { setLista0(rep); }, [rep]);
  // y el número de la pestaña, al día (ver `alCambiar` en el Dashboard)
  const setLista = (l) => { setLista0(l); if (alCambiar) alCambiar(l); };
  const [abierto, setAbierto] = useState(null);
  const [msg, setMsg] = useState({});
  const cerrar = async (r, accion) => {
    setMsg((m) => Object.assign({}, m, { [r.id]: '…' }));
    try { setLista(await decidirReporte({ id: r.id, accion })); setMsg((m) => Object.assign({}, m, { [r.id]: '' })); } catch (e) { setMsg((m) => Object.assign({}, m, { [r.id]: 'No se pudo: ' + e.message })); }
  };
  if (!lista.length) return null;
  // 🧩 todo lo que el bot ya sabe cómo corregir, de una (Dlx: «hazlo sencillo de solucionar múltiples problemas»)
  const sugeridos = lista.filter((x) => (x.estado === '' || x.estado === 'no_pude') && x.evid && x.evid.sugerencia && /^\d+$/.test(x.llave));
  const todos = async () => {
    setMsg((m) => Object.assign({}, m, { todos: '…' }));
    try {
      let l = lista;
      for (const x of sugeridos) {
        const s = x.evid.sugerencia;
        l = await decidirReporte(Object.assign({ id: x.id, accion: 'nombre', n: x.llave, nombre: s.nombre }, s.reporta ? { reporta: true } : { es: s.es }));
      }
      setLista(l); setMsg((m) => Object.assign({}, m, { todos: '' }));
    } catch (e) { setMsg((m) => Object.assign({}, m, { todos: 'No se pudo: ' + e.message })); }
  };
  return (
    <div><h3>Errores en las llaves <small>reportados</small></h3>
      {sugeridos.length >= 2 ? <div className="cu-btns">
        <button type="button" className="btn verde chico" disabled={msg.todos === '…'} onClick={todos}>Aplicar todo lo sugerido ({sugeridos.length})</button>
        {msg.todos && msg.todos !== '…' ? <small role="status">{msg.todos}</small> : null}
      </div> : null}
      <ul>{lista.map((r) => {
        const est = ESTADO_REP[r.estado];
        const abiertoA = r.estado === '' || r.estado === 'no_pude';
        return (
          <li key={r.id}>
            <div className="db-l1"><b>{/^\d+$/.test(r.llave) ? <a href={'#/llave/' + r.llave}>Llave #{r.llave}</a> : 'Llave en vivo'}</b>
              <span className="db-chip">{QUE_REP[r.que] || r.que}</span>{est ? <span className={'db-chip ' + est[1]}>{est[0]}</span> : null}</div>
            {/* 👤 quién lo mandó: el nombre de la Lista que pone el ciclo (`evid.quien`), aunque no tenga perfil en la página
                (Dlx, 13/10/2026: «¿pero quién lo dice?») */}
            <small>{hace(r.t)}{r.batalla ? ' · ' + r.batalla : ''}{r.evid && r.evid.quien ? <> · lo mandó {r.de ? <a href={'#/r/' + r.de}>{r.evid.quien}</a> : r.evid.quien}</>
              : r.de ? <> · lo mandó <a href={'#/r/' + r.de}>{r.de}</a></> : <> · quién lo mandó: lo dice el ciclo en su próxima corrida</>}</small>
            {r.texto ? <p>{r.texto}</p> : null}
            {r.evid && (r.evid.lineas || []).length > 1 ? <Evidencia r={r} alListo={setLista} /> : null}
            {r.estado === 'corregir' && r.fix ? <small>{r.fix.tipo === 'ganador' ? 'Ganó ' + r.fix.ganador + ' (' + r.fix.ronda + ')'
              : '«' + r.fix.nombre + '» era ' + (r.fix.reporta ? 'quien lo reportó' : r.fix.es || r.fix.nuevo)}</small> : null}
            {r.resultado ? <small>{r.resultado}</small> : null}
            {abiertoA || r.estado === 'corregir' ? (
              abierto === r.id ? <Corregir r={r} liga={liga} alListo={(l) => { setLista(l); setAbierto(null); }}
                hermanos={lista.filter((x) => x.id !== r.id && x.llave === r.llave && (x.estado === '' || x.estado === 'no_pude'))} /> : (
                <div className="cu-btns">
                  {/^\d+$/.test(r.llave) ? <button type="button" className="btn verde chico" onClick={() => setAbierto(r.id)}>{r.estado === 'corregir' ? 'Cambiar la corrección' : 'Corregir'}</button> : null}
                  <button type="button" className="btn borde2 chico" disabled={msg[r.id] === '…'} onClick={() => cerrar(r, 'listo')}>Listo</button>
                  <button type="button" className="btn borde2 chico" disabled={msg[r.id] === '…'} onClick={() => cerrar(r, 'prueba')}>Era una prueba</button>
                  {msg[r.id] && msg[r.id] !== '…' ? <small role="status">{msg[r.id]}</small> : null}
                </div>)
            ) : null}
          </li>
        );
      })}</ul>
    </div>
  );
}

// 🤝 lo que también te llega: los videos para revisar. Los reportes y ✅ Decidir tienen su pestaña desde el 13/10/2026
function Llego({ d }) {
  const vs = d.videos || [];
  if (!vs.length) return <p className="pronto-p">Nada nuevo acá: los reportes de las llaves y lo de ✅ Decidir tienen su pestaña.</p>;
  return <div className="db-llego"><VideosRevisar vs={vs} /></div>;
}

// ── ✅ DECIDIR, EN EL DASHBOARD (13/10/2026). Dlx: «estaba pensando en mover lo de decidir del sheet, aquí», y a la
// propuesta, «Sí, con Reportes». Las MISMAS preguntas de la hoja —las publica el ciclo (`decidir.para_web()`)—, por
// evento, con sus pistas y sus opciones. Contestar lo guarda el objeto y lo aplica el ciclo en su próxima corrida
// como si estuviera escrito en la hoja (`decidir._respuestas()`). La hoja sigue una semana en paralelo ──
async function contestarDecidir(cuerpo) {
  const r = await fetch('/api/avisos/dueno/decidir', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entrá de nuevo' : j.error || String(r.status));
  return j.decidir || {};
}
export const sinContestar = (dec) => ((dec && dec.preguntas) || []).filter((p) => !((dec.respuestas || {})[p.id])).length;

function Pregunta({ p, r, alListo }) {
  const [libre, setLibre] = useState('');
  const [nota, setNota] = useState((r && r.nota) || '');
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const mandar = async (cuerpo) => {
    setOcup(true); setMsg('');
    try { alListo(await contestarDecidir(Object.assign({ id: p.id }, cuerpo))); } catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup(false);
  };
  return (
    <li className={r ? 'db-dec-hecha' : ''}>
      <div className="db-l1"><span className="db-chip">{p.tipo}</span></div>
      <p className="db-dec-que">{p.que}</p>
      {p.pistas && p.pistas !== '—' ? <p className="db-dec-pistas">{p.pistas}</p> : null}
      {r ? (
        <div className="cu-btns">
          <small>✍️ <b>{r.r}</b>{r.nota ? ' · ' + r.nota : ''} · lo aplica el ciclo en su próxima corrida</small>
          <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => mandar({ borrar: true })}>Deshacer</button>
        </div>
      ) : <>
        <div className="db-opc">{p.opciones.map((x) => <button key={x} type="button" disabled={ocup} onClick={() => mandar({ r: x, nota })}>{x}</button>)}</div>
        {p.libre ? (
          <div className="db-rep-q"><label>Es otro de la Lista:
            <input type="text" value={libre} placeholder="su nombre como figura en la Lista" maxLength={56} onChange={(e) => setLibre(e.target.value)} />
            <button type="button" className="btn verde chico" disabled={ocup || !libre.trim()} onClick={() => mandar({ r: 'Es ' + libre.trim(), nota })}>Es éste</button>
          </label></div>) : null}
        <div className="db-rep-q"><label>Nota (opcional):
          <input type="text" value={nota} placeholder="queda en la hoja con la respuesta" maxLength={300} onChange={(e) => setNota(e.target.value)} /></label></div>
      </>}
      {msg ? <small role="status">{msg}</small> : null}
    </li>
  );
}

function Decisiones({ dec, alCambiar }) {
  const [x, setX0] = useState(dec || {});
  useEffect(() => { setX0(dec || {}); }, [dec]);
  const setX = (y) => { setX0(y); if (alCambiar) alCambiar(y); };
  const ps = x.preguntas || [], rs = x.respuestas || {};
  if (!ps.length) {
    return <p className="pronto-p">{x.t ? 'Nada para decidir: el ciclo no tiene preguntas abiertas.' : 'Las preguntas aparecen cuando el ciclo las publique, en su próxima corrida.'}</p>;
  }
  // por evento, en el orden en que vienen (el de la hoja: primero lo que mueve puntos)
  const secs = [];
  for (const p of ps) {
    const s = secs.find((y) => y.sec === p.sec);
    if (s) s.ps.push(p); else secs.push({ sec: p.sec, ps: [p] });
  }
  return (
    <div className="db-dec">
      <p className="db-rep-nota">{sinContestar(x)} sin contestar de {ps.length}{x.t ? ' · el ciclo las publicó ' + hace(x.t) : ''}. Lo que contestes acá vale igual que en la hoja.</p>
      {secs.map((s) => {
        const link = (s.ps.find((p) => p.link) || {}).link;
        return (
          <div key={s.sec} className="db-dec-sec">
            <h3>{s.sec}{link ? <> <a className="db-link" href={link} target="_blank" rel="noopener noreferrer">la llave en Discord ↗</a></> : null}</h3>
            <ul>{s.ps.map((p) => <Pregunta key={p.id} p={p} r={rs[p.id]} alListo={setX} />)}</ul>
          </div>
        );
      })}
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
  const retencion = useRetencion(!!st.d);
  // `ajustar()` devuelve los ajustes y el historial (ver `ajuste()` en avisos.js)
  const onAj = (r) => setSt((x) => (x.d ? { d: Object.assign({}, x.d, { ajustes: r.ajustes }, r.hist ? { ajustes_hist: r.hist } : {}) } : x));
  const { hacer, msg, ocup } = useHacer(onAj);
  // lo que cambia una pestaña (un reporte, una respuesta) vuelve al panel: así el número de cada pestaña está al día
  const cambiarD = (o) => setSt((x) => (x.d ? { d: Object.assign({}, x.d, o) } : x));
  const [tab, setTab] = useState(leerTab);
  const elegir = (t) => { setTab(t); ponerTab(t); };
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
    const at = atencion(d, liga, cuotas);
    // el número de cada pestaña: lo que espera algo de vos
    const cuenta = { hoy: at.length, reportes: (d.reportes || []).filter((x) => x.estado === '' || x.estado === 'no_pude').length,
      decisiones: sinContestar(d.decidir) };
    const sec = (titulo, em, hijo) => <section className="act"><div className="mis-cab"><span>{titulo}</span>{em ? <em>{em}</em> : null}</div>{hijo}</section>;
    cuerpo = (
      <>
        <nav className="db-tabs" role="tablist" aria-label="El Dashboard">{PESTANAS.map(([k, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={'db-tab' + (tab === k ? ' on' : '')} onClick={() => elegir(k)}>
            {n}{cuenta[k] ? <i aria-label={cuenta[k] === 1 ? 'una cosa' : cuenta[k] + ' cosas'}>{cuenta[k]}</i> : null}
          </button>
        ))}</nav>
        {tab === 'hoy' ? <>
          {sec('LO QUE PIDE ATENCIÓN', null, <Atencion xs={at} />)}
          {(d.vivo || []).length ? sec('EN VIVO AHORA', 'se actualiza al abrir el Dashboard',
            <EnVivo vivo={d.vivo} liga={liga} aj={d.ajustes || {}} chat={d.chat} />) : null}
          {sec('LO QUE TE LLEGÓ', null, <Llego d={d} />)}
          {sec('ATAJOS', null, <ul className="db-atajos">{ATAJOS.map(([t, h]) => (
            <li key={h}><a href={h} target={h[0] === '/' ? undefined : '_blank'} rel={h[0] === '/' ? undefined : 'noopener noreferrer'}>{t} ↗</a></li>
          ))}</ul>)}
        </> : null}
        {tab === 'reportes' ? sec('ERRORES REPORTADOS EN LAS LLAVES', 'se borran a los 14 días',
          (d.reportes || []).length ? <div className="db-llego"><Reportes rep={d.reportes} liga={liga} alCambiar={(l) => cambiarD({ reportes: l })} /></div>
            : <p className="pronto-p">Nadie reportó nada en los últimos 14 días.</p>) : null}
        {tab === 'decisiones' ? sec('✅ DECIDIR', 'las mismas preguntas que la hoja', <Decisiones dec={d.decidir} alCambiar={(y) => cambiarD({ decidir: y })} />) : null}
        {tab === 'ajustes' ? sec('CONFIGURACIÓN · SÓLO VOS', null,
          <Ajustes liga={liga} aj={d.ajustes || {}} chat={d.chat} hist={d.ajustes_hist} hacer={hacer} msg={msg} ocup={ocup}
            roles={d.roles} alRoles={(y) => cambiarD({ roles: y })} />) : null}
        {tab === 'numeros' ? <>
          {sec('EL BOT Y LA PÁGINA · 7 DÍAS', u.desde ? 'se cuenta desde el ' + corto(u.desde) : null, <Cajas u={u} />)}
          {(d.dias || []).length ? sec('DÍA POR DÍA · DOS SEMANAS', null, <Dias dias={d.dias} />) : null}
          {d.tutorial && Object.keys(d.tutorial.n || {}).length ? sec('EL TUTORIAL · DOS SEMANAS',
            d.tutorial.desde ? 'se cuenta desde el ' + corto(d.tutorial.desde) : null, <TutorialNumeros t={d.tutorial} />) : null}
          {d.secciones && Object.keys(d.secciones.n || {}).length ? sec('QUÉ SECCIONES SE ABREN · 7 DÍAS',
            d.secciones.desde ? 'se cuenta desde el ' + corto(d.secciones.desde) : null, <SeccionesNumeros s={d.secciones} />) : null}
          {d.secciones && Object.keys(d.secciones.n || {}).some((k) => /^[ip]-/.test(k)) ? sec('QUÉ SE TOCA EN EL INICIO · 7 DÍAS', null,
            <SeccionesNumeros s={d.secciones} toques />) : null}
          {sec('¿EL LOBBY HACE VOLVER A LA GENTE?', 'la meta del research', <MetaLobby r={retencion} />)}
          {d.pase ? sec('EL PASE DE RAPERO', d.pase.semana ? 'la semana del ' + corto(d.pase.semana) : null, <PaseNumeros p={d.pase} liga={liga} />) : null}
        </> : null}
        {tab === 'sistema' ? <>
          {sec('LO QUE GASTA CLOUDFLARE HOY', 'el plan gratis', <Cuotas q={cuotas} />)}
          {sec('CÓMO ANDA TODO', null, <><Corridas corridas={d.corridas} s={d.sistema || {}} github={d.github} /><Sistema s={d.sistema || {}} sesiones={d.sesiones} /></>)}
        </> : null}
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
          </dl>
          {marcas.length ? <p className="db-ini-m">{marcas.join(' · ')}</p> : null}
        </>
      ) : <p className="db-ini-m">{st.sinCuenta ? 'Entrá con Discord para verlo.' : 'No pude leerlo ahora.'}</p>}
    </section>
  );
}
