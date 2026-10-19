// 🔒 EL DASHBOARD DEL DUEÑO (Dlx, 04/10/2026: «el bot y la página, que esté en una página nueva creada sólo para el
// owner… la única manera de iniciar sesión ahí es con mi cuenta… ahí poné esa información y configuraciones extras»).
//
// ⚠️ LA PUERTA NO ES ESTA PÁGINA: es `/avisos/dueno` en bot/avisos.js, que le pregunta a Discord (o a la sesión) quién
// es y contesta 403 a cualquiera que no sea Dlx. Acá sólo se dibuja lo que el servidor manda. Sin cuenta, el botón de
// entrar; con otra cuenta, «esta página es del dueño» y nada más. Los ajustes pasan por la misma puerta
// (`/avisos/dueno/ajuste`), y el servidor valida cada valor antes de guardarlo.
import { Fragment, useEffect, useState } from 'react';
import { diaISO, hora, limpio, mult, num, siglaDe } from './liga.js';
import { DosToques, Ico } from './piezas.jsx';
import { urlFondo } from './fondos.js';
import { useNumero } from './anima.js';

// 📸 la dirección de una foto de tarjeta, para el CSS: sólo del bucket de la Liga (las caras y las que esperan revisión)
const urlFoto = (u) => (/^https:\/\/pub-[a-z0-9]+\.r2\.dev\/(fotos\/[a-z0-9-]+\/[\p{L}\p{N}_]+@[a-z]+|pendientes\/[a-f0-9]{24})\.(webp|jpg|png)$/u.test(String(u || ''))
  ? 'url("' + u + '")' : '');
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

// ── 📊 COMPARAR SEMANAS (Dlx, 18/10/2026: «para tener la opción de comparar actividad, gente y mejoras de gente o peores,
// para comparar con otras semanas»). La competencia y el ranking salen de `datos/semanas.json` (bot/semanas.py: todo
// público, las llaves y el ranking); el uso de la página y del bot, del objeto (`uso_semanas`, sólo acá) ──────────────
let semanasP = null;
const pedirSemanas = () => (semanasP = semanasP || fetch(RAW + 'semanas.json', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null));
function useSemanas(activo) {
  const [s, setS] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    pedirSemanas().then((x) => { if (vivo) setS(x || false); });
    return () => { vivo = false; };
  }, [activo]);
  return s;
}
const MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const masDias = (dia, n) => new Date(Date.parse(dia + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
// «12–18 oct», «28 sep–4 oct»
const rangoSem = (lunes) => {
  const a = new Date(lunes + 'T12:00:00Z'), b = new Date(a.getTime() + 6 * 864e5);
  return a.getUTCDate() + (a.getUTCMonth() === b.getUTCMonth() ? '' : ' ' + MES_C[a.getUTCMonth()]) + '–' + b.getUTCDate() + ' ' + MES_C[b.getUTCMonth()];
};
// el día de hoy en hora del este: las semanas de la Liga van de lunes a domingo en esa hora
const hoyET = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// los números de la semana `i`; con `k`, sólo sus primeros `k` días (para comparar «a igual día»)
function medirSemana(ss, i, k) {
  const w = ss[i];
  if (!w) return null;
  if (!k) {
    return { eventos: w.eventos, raperos: w.raperos, part: w.part, debut: w.debut.length, volvieron: w.volvieron,
      batallas: w.batallas, fuera: w.completa ? w.fuera.length : null };
  }
  const antes = new Set();
  ss.slice(0, i).forEach((x) => x.dias.forEach((d) => d[3].forEach((n) => antes.add(n))));
  const tope = masDias(w.lunes, k);
  const ds = w.dias.filter((d) => d[0] < tope);
  const gente = new Set();
  ds.forEach((d) => d[3].forEach((n) => gente.add(n)));
  let debut = 0, volvieron = 0;
  gente.forEach((n) => { if (antes.has(n)) volvieron += 1; else debut += 1; });
  return { eventos: ds.reduce((t, d) => t + d[1], 0), raperos: gente.size, part: ds.reduce((t, d) => t + d[2], 0),
    debut, volvieron, batallas: null, fuera: null };
}

// quién sumó, subió y bajó en la semana `i`: la foto del ranking al empezarla contra la del lunes siguiente (o la de ahora)
function movimientos(S, i) {
  const ss = S.semanas, w = ss[i];
  const ini = (S.fotos || {})[w.lunes] || {};
  const sig = ss[i + 1];
  const fin = sig ? (S.fotos || {})[sig.lunes] : (S.ultima || {}).foto;
  if (!fin) return null;
  const filas = Object.entries(fin).map(([n, [pos, pts]]) => {
    const a = ini[n] || [0, 0];
    return { n, pos, pts, dPts: pts - a[1], dPos: a[0] && pos ? a[0] - pos : null };
  });
  return {
    sumaron: filas.filter((f) => f.dPts > 0).sort((a, b) => b.dPts - a.dPts).slice(0, 8),
    subieron: filas.filter((f) => f.dPos > 0).sort((a, b) => b.dPos - a.dPos || a.pos - b.pos).slice(0, 8),
    bajaron: filas.filter((f) => f.dPos < 0).sort((a, b) => a.dPos - b.dPos || a.pos - b.pos).slice(0, 8),
  };
}

// una caja: el número de la semana, cuánto cambió contra la otra (▲▼ y %), y el de la otra. `menos`: bajar es mejor
function CajaSem({ t, a, b, menos, i }) {
  const x = useNumero(a == null ? null : a);
  if (a == null) return null;
  const d = b == null ? null : a - b;
  const pct = d != null && b ? Math.round((100 * d) / b) : null;
  const bien = d == null || d === 0 ? '' : (d > 0) !== !!menos ? 'db-sube' : 'db-baja';
  return (
    <div className="cs-caja" style={{ '--i': i }}>
      <span>{t}</span><b>{num(x || 0)}</b>
      {d == null ? <small>sin dato de la otra semana</small> : (
        <small className={bien}>{d > 0 ? '▲ ' : d < 0 ? '▼ ' : '= '}{num(Math.abs(d))}{pct != null && d ? ' · ' + (pct > 0 ? '+' : '') + pct + ' %' : ''}
          <em> · antes {num(b)}</em></small>
      )}
    </div>
  );
}

// un nombre con link a su perfil, si es de la Liga
function Quien({ liga, n }) {
  const f = liga && liga.fila ? liga.fila(n) : null;
  return f ? <a href={'#/r/' + encodeURIComponent(f.k)}>{limpio(n)}</a> : <span>{limpio(n)}</span>;
}

// una lista de gente: los primeros a la vista y el resto detrás de «y N más»
function Gente({ liga, t, xs, d, vs }) {
  const [todo, setTodo] = useState(false);
  if (!xs) return null;
  const ver = todo ? xs : xs.slice(0, 10);
  return (
    <div className="cs-gente">
      <h4>{t} <b>{num(xs.length)}</b>{vs != null ? <em> · antes {num(vs)}</em> : null}</h4>
      {d ? <p className="db-tx">{d}</p> : null}
      {xs.length ? <p className="cs-nombres">{ver.map((n, j) => <Fragment key={n}>{j ? ' · ' : ''}<Quien liga={liga} n={n} /></Fragment>)}
        {xs.length > 10 ? <>{' '}<button type="button" className="cs-mas" onClick={() => setTodo((v) => !v)}>{todo ? 'menos' : 'y ' + (xs.length - 10) + ' más'}</button></> : null}</p>
        : <p className="db-tx">Nadie.</p>}
    </div>
  );
}

function Movidos({ liga, t, xs, f }) {
  if (!xs || !xs.length) return null;
  return (
    <div className="cs-mov">
      <h4>{t}</h4>
      <ol>{xs.map((x, j) => <li key={x.n} style={{ '--i': j }}><Quien liga={liga} n={x.n} /><em>{f(x)}</em></li>)}</ol>
    </div>
  );
}

// la temporada en barras, semana por semana: la elegida en magenta y la otra en verde
function Temporada({ ss, a, b, setA }) {
  const series = [['raperos', 'Raperos'], ['eventos', 'Eventos']];
  return (
    <div className="cs-temp">{series.map(([k, t]) => {
      const tope = Math.max(1, ...ss.map((w) => w[k] || 0));
      return (
        <div key={k} className="cs-serie">
          <span className="db-t">{t}</span>
          <div className="cs-barras">{ss.map((w, j) => (
            <button key={w.lunes} type="button" className={'cs-b' + (j === a ? ' a' : j === b ? ' b' : '') + (w.completa ? '' : ' curso')}
              onClick={() => setA(j)} title={rangoSem(w.lunes) + ' · ' + num(w[k] || 0)} aria-label={t + ' de la semana del ' + rangoSem(w.lunes) + ': ' + num(w[k] || 0)}>
              <u style={{ height: (100 * (w[k] || 0) / tope).toFixed(1) + '%', '--i': j }} /><small>{num(w[k] || 0)}</small>
            </button>
          ))}</div>
        </div>
      );
    })}
    <div className="cs-fechas">{ss.map((w) => <span key={w.lunes}>{rangoSem(w.lunes)}</span>)}</div>
    </div>
  );
}

function CompararSemanas({ S, uso, liga }) {
  const ss = (S && S.semanas) || [];
  const [a, setA0] = useState(Math.max(0, ss.length - 1));
  const [b, setB] = useState(Math.max(0, ss.length - 2));
  const [igual, setIgual] = useState(true);
  if (S === null) return <p className="pronto-p">Midiendo…</p>;
  if (!ss.length) return <p className="pronto-p">Todavía no hay semanas para comparar.</p>;
  const setA = (j) => { setA0(j); if (j === b) setB(j > 0 ? j - 1 : Math.min(ss.length - 1, j + 1)); };
  const wa = ss[a], wb = ss[b];
  // 📅 «a igual día»: si la semana elegida va por la mitad, la otra se mide en los mismos días
  const enCurso = !wa.completa;
  const k0 = enCurso && igual ? Math.max(1, Math.round((Date.parse(hoyET() + 'T12:00:00Z') - Date.parse(wa.lunes + 'T12:00:00Z')) / 864e5) + 1) : 0;
  // el domingo «a igual día» ya es la semana entera: así se ven también las batallas
  const k = k0 >= 7 ? 0 : k0;
  const ma = medirSemana(ss, a, k), mb = medirSemana(ss, b, k);
  const ua = (uso || []).find((x) => x.lunes === wa.lunes), ub = (uso || []).find((x) => x.lunes === wb.lunes);
  const u = (x) => (x ? (k ? x.k || x : x) : null);
  const UA = u(ua), UB = u(ub);
  const comp = [
    ['EVENTOS JUGADOS', ma.eventos, mb.eventos], ['RAPEROS DISTINTOS', ma.raperos, mb.raperos],
    ['PARTICIPACIONES', ma.part, mb.part], ['DEBUTARON', ma.debut, mb.debut],
    ['YA HABÍAN JUGADO', ma.volvieron, mb.volvieron], ['BATALLAS', ma.batallas, mb.batallas],
    ['SE FUERON', ma.fuera, mb.fuera, true],
  ];
  const pag = UA ? [
    ['PERSONAS (BOT O PÁGINA)', UA.personas, UB && UB.personas], ['ENTRARON CON DISCORD', UA.web, UB && UB.web],
    ['USARON EL BOT', UA.bot, UB && UB.bot], ['VISITAS A LA PÁGINA', UA.visitas, UB && UB.visitas],
  ] : [];
  const mv = movimientos(S, a), mvb = movimientos(S, b);
  const opciones = ss.map((w, j) => <option key={w.lunes} value={j}>{rangoSem(w.lunes)}{w.completa ? '' : ' (en curso)'}</option>);
  return (
    <div className="cs">
      <div className="cs-elige">
        <label><span>La semana</span><select value={a} onChange={(e) => setA(Number(e.target.value))}>{opciones}</select></label>
        <button type="button" className="btn borde2 chico" onClick={() => { setA0(b); setB(a); }} aria-label="Dar vuelta las dos semanas">⇄</button>
        <label><span>contra</span><select value={b} onChange={(e) => setB(Number(e.target.value))}>{opciones.filter((_, j) => j !== a)}</select></label>
        {enCurso ? <label className="cs-igual"><input type="checkbox" checked={igual} onChange={(e) => setIgual(e.target.checked)} />
          <span>A igual día{k ? ' (los primeros ' + k + ' días de cada una)' : ''}</span></label> : null}
      </div>
      <Temporada ss={ss} a={a} b={b} setA={setA} />
      <h3 className="cs-t">La competencia</h3>
      <div className="cs-cajas" key={'c' + a + ':' + b + ':' + k}>{comp.map(([t, x, y, menos], j) => <CajaSem key={t} t={t} a={x} b={y} menos={menos} i={j} />)}</div>
      {enCurso && !k ? <p className="db-tx">⚠️ La semana del {rangoSem(wa.lunes)} todavía no terminó: contra una entera, casi todo va a dar menos.</p> : null}
      {pag.length ? <>
        <h3 className="cs-t">La página y el bot</h3>
        <div className="cs-cajas" key={'p' + a + ':' + b + ':' + k}>{pag.map(([t, x, y], j) => <CajaSem key={t} t={t} a={x} b={y} i={j} />)}</div>
      </> : <p className="db-tx">El uso de la página y del bot de esa semana ya no está guardado (se cuenta 35 días por persona).</p>}
      <h3 className="cs-t">La gente</h3>
      <div className="cs-grilla">
        <Gente liga={liga} t="Debutaron" xs={wa.debut} vs={wb.debut.length} />
        <Gente liga={liga} t="Volvieron después de faltar" xs={wa.regreso} vs={wb.regreso.length} d="Habían jugado antes, pero no la semana anterior." />
        {wa.completa ? <Gente liga={liga} t="Se fueron" xs={wa.fuera} vs={wb.completa ? wb.fuera.length : null} d="Jugaron la semana anterior y ésta no." /> : null}
      </div>
      {mv ? <>
        <h3 className="cs-t">Mejoraron y empeoraron</h3>
        <p className="db-tx">El ranking de Temporada al empezar la semana contra el de {a === ss.length - 1 ? 'ahora' : 'al terminarla'}.
          {mvb && mvb.sumaron.length ? <> La del {rangoSem(wb.lunes)}, el que más sumó fue <Quien liga={liga} n={mvb.sumaron[0].n} /> (+{num(mvb.sumaron[0].dPts)} pts).</> : null}</p>
        <div className="cs-grilla">
          <Movidos liga={liga} t="Sumaron más puntos" xs={mv.sumaron} f={(x) => '+' + num(x.dPts) + ' pts'} />
          <Movidos liga={liga} t="Subieron más puestos" xs={mv.subieron} f={(x) => '▲ ' + x.dPos + ' · #' + x.pos} />
          <Movidos liga={liga} t="Bajaron más puestos" xs={mv.bajaron} f={(x) => '▼ ' + Math.abs(x.dPos) + ' · #' + x.pos} />
        </div>
      </> : null}
    </div>
  );
}

// ── 🤝 LOS TIERS (Dlx, 18/10/2026: «3 tier levels of association… el sistema recomienda y muestra qué tan bien los
// servidores han hecho su trabajo»). Cada servidor con su nivel —que se elige acá: ajuste `tiers`, el ciclo lo copia a
// datos/niveles.json—, su puntaje de las últimas 4 semanas y lo que recomienda `bot/tiers.py`. El puntaje no sale de acá
const TIER_QUE = { 1: 'suma al ranking, todo', 2: 'el calendario, no suma', 3: 'el directorio, sin bot' };
const REC = { bien: ['✅', 'Bien'], subir: ['⬆️', 'Puede subir'], revisar: ['⚠️', 'Revisar'], casa: ['🏠', 'La casa'] };
const PARTES = [['actividad', 'Actividad', 35], ['alcance', 'Alcance', 25], ['calidad', 'Calidad', 25], ['comunidad', 'Comunidad', 15]];

function TierCaja({ x, liga, tier, cambiar, ocup, i }) {
  const pts = useNumero(x.puntos);
  const m = x.m || {};
  const [ic, et] = REC[x.rec] || ['', x.rec];
  return (
    <article className={'ti-caja r-' + x.rec} style={{ '--i': i }}>
      <header>
        {liga && liga.logo ? <img alt="" src={liga.logo(x.sv)} /> : null}
        <span><b>{x.nombre}</b><small>{siglaDe(x.sv)}</small></span>
        <label className="ti-sel"><span className="rk-sr">El tier de {x.nombre}</span>
          <select value={tier} disabled={ocup} onChange={(e) => cambiar(x.sv, Number(e.target.value))}>
            {[1, 2, 3].map((t) => <option key={t} value={t}>Tier {t}</option>)}
          </select></label>
      </header>
      <p className="ti-que">Tier {tier}: {TIER_QUE[tier]}</p>
      <div className="ti-pts"><b>{pts}</b><small>de 100{x.antes ? ' · antes ' + x.antes : ''}</small></div>
      <div className="ti-partes">{PARTES.map(([k, t, tope]) => (
        <div key={k} title={t + ': ' + ((x.partes || {})[k] || 0) + ' de ' + tope}>
          <span>{t}</span><i><u style={{ width: (100 * ((x.partes || {})[k] || 0) / tope).toFixed(0) + '%' }} /></i>
        </div>
      ))}</div>
      <p className="ti-m">{m.miembros ? <b className={m.miembros < 300 ? 'ti-bajo' : ''}>{num(m.miembros)} miembros{m.miembros < 300 ? ' (mínimo 300)' : m.miembros < 500 ? ' (se recomiendan 500)' : ''} · </b> : null}{num(m.por_semana || 0)} eventos por semana · {num(m.por_evento || 0)} por evento · {num(m.nuevos || 0)} nuevos
        {m.nuevos ? ' (volvieron ' + Math.round((100 * (m.volvieron || 0)) / m.nuevos) + ' %)' : ''}
        {m.eventos ? ' · ' + (Math.round((10 * (m.ayudas || 0)) / m.eventos) / 10) + ' ayudas por llave' : ''}
        {m.anuncios ? ' · staff en ' + Math.round((100 * (m.con_staff || 0)) / m.anuncios) + ' % de sus anuncios' : ''}
        {m.cancelados ? ' · ' + m.cancelados + ' cancelados' : ''}{m.promos ? ' · ' + m.promos + ' promos' : ''}{m.ligas ? ' · ' + m.ligas + ' ligas' : ''}</p>
      <p className="ti-rec"><span>{ic} {et}</span> {x.porque}</p>
    </article>
  );
}

function Tiers({ T, aj, hacer, ocup, msg, liga }) {
  if (!T || !(T.servidores || []).length) return <p className="pronto-p">El puntaje llega con la próxima vuelta del ciclo.</p>;
  const elegidos = aj.tiers || {};
  const tierDe = (x) => elegidos[x.sv] || x.tier || 1;
  const cambiar = (sv, t) => hacer('tiers', Object.assign({}, elegidos, { [sv]: t }),
    siglaDe(sv) + ' pasa a Tier ' + t + '. El ciclo lo aplica en su próxima vuelta' + (t === 1 ? ': vuelve a sumar al ranking.' : ': sus llaves dejan de sumar.'));
  return (
    <div className="ti">
      <p className="db-tx">Las últimas {T.semanas || 4} semanas. El puntaje recomienda; <b>el nivel lo elegís vos</b>. Tier 1 suma al ranking y
        lleva todo; Tier 2 sale en el calendario y la campana, pero sus llaves no suman; Tier 3 es el directorio, sin bot. Para ser
        socio: 300 miembros como mínimo, se recomiendan 500.</p>
      {msg ? <p className="db-msg" role="status">{msg}</p> : null}
      <div className="ti-g">{T.servidores.map((x, i) => <TierCaja key={x.sv} x={x} liga={liga} tier={tierDe(x)} cambiar={cambiar} ocup={ocup} i={i} />)}</div>
      {T.t ? <p className="db-tx">Medido {hace(T.t)}.</p> : null}
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
  tarjetas: 'Tarjetas', ligas: 'Ligas', salon: 'Salón de la fama', pase: 'Pase', tienda: 'Tienda', socios: 'Socios', guia: 'Guía', perfil: 'Un perfil',
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

// 👆 QUÉ SE TOCA EN TODA LA PÁGINA (16/10/2026, `clics()` en bot/avisos.js): cada botón o link, por sección
const NOMBRE_SECC_C = Object.assign({}, NOMBRE_SECC, { otra: 'Otra', dashboard: 'Dashboard', ajustes: 'Ajustes',
  misiones: 'Misiones', ligas: 'Ligas' });
function ClicsNumeros({ c }) {
  const filas = Object.entries((c && c.n) || {}).map(([k, v]) => [k, v[0] || 0, v[1] || 0]).filter((f) => f[1] || f[2]);
  if (!filas.length) return <p className="pronto-p">Todavía no se tocó nada desde que se cuenta.</p>;
  const tope = Math.max(1, ...filas.map((f) => f[1]));
  return (
    <div className="db-aj">
      <div className="db-q">{filas.slice(0, 50).map(([k, n, ant]) => {
        const i = k.indexOf(':');
        const sec = k.slice(0, i), et = k.slice(i + 1);
        return (
          <div key={k} className="db-q-f"><span><small>{NOMBRE_SECC_C[sec] || sec}</small> {et}</span>
            <i><u style={{ width: ((100 * n) / tope).toFixed(1) + '%' }} /></i>
            <b>{num(n)} <small>{ant ? 'antes ' + num(ant) : 'esta semana'}</small></b></div>
        );
      })}</div>
      <p className="db-tx">Cuántas veces se tocó cada botón o link en los últimos 7 días, en cada sección, y la semana anterior al lado. «→ perfil» es un link que lleva a un perfil; lo demás es el texto del botón. Nunca dice quién.</p>
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

// 🏆 LOS MES AWARDS (16/10/2026, Dlx a «¿de dónde salen los nominados?»: «solos, de los números», y vos podés sacar
// alguno antes de que abra la votación). Los nominados salen el día 1 a las 11 AM ET y la votación abre a las 6 PM: en
// ese rato, sacar a uno guarda `mes_sacar` y en la vuelta siguiente del ciclo entra el que sigue (`bot/mes_awards.py`)
function MesAwardsDueno({ aj, hacer, ocup }) {
  const [S, setS] = useState(null);
  useEffect(() => {
    fetch('/api/salon', { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null)).then((d) => setS(d || {})).catch(() => setS({}));
  }, []);
  if (!S) return <p className="pronto-p">Cargando…</p>;
  const ab = S.abierto;
  if (!ab) {
    const v = S.vivo;
    return <p className="pronto-p">{v ? 'Así va ' + v.nombre + ': los nominados salen el día 1 a las 11 AM, y desde ahí hasta las 6 PM podés sacar a alguno acá.' : 'Todavía no hay MES AWARDS.'}</p>;
  }
  if (ab.votando) return <p className="pronto-p">Se está votando {ab.nombre}: los nominados ya no se cambian. Cierra el {corto(ab.cierra)}.</p>;
  const ya = ((aj.mes_sacar || {}).mes === ab.mes ? (aj.mes_sacar.quitar || []) : []);
  // 🔁 EL DESCANSO DE QUIEN REPITE LO DECIDE LA DIRECTIVA (Dlx, 18/10/2026): no hay regla automática. Acá se ve quién ya
  // ganó esa misma categoría en un mes anterior, para sacarlo si les parece
  const gano = {};
  for (const h of S.hist || []) {
    for (const [c, x] of Object.entries(h.cats || {})) {
      const f = (x.nom || []).find((y) => y.op === x.gana);
      for (const q of (f && (f.quien || [f.op])) || []) (gano[c + ':' + q] = gano[c + ':' + q] || []).push(h.nombre || h.mes);
    }
  }
  const yaGano = (c, x) => [...new Set((x.quien || [x.op]).flatMap((q) => gano[c + ':' + q] || []))];
  const alternar = (k) => {
    const q = ya.includes(k) ? ya.filter((x) => x !== k) : ya.concat([k]);
    hacer('mes_sacar', q.length ? { mes: ab.mes, quitar: q } : null, ya.includes(k) ? 'Vuelve a estar nominado.' : 'Sacado: en la próxima vuelta del ciclo entra el que sigue.');
  };
  return (
    <div className="db-mes">
      <p className="pronto-p">Los nominados de <b>{ab.nombre}</b>. La votación abre el {corto(ab.abre)}: hasta entonces podés sacar a alguno.
        El descanso de quien repite lo decide la directiva: «ya ganó» marca a quien se llevó esa categoría antes.</p>
      {(S.cats || []).map(([c, n]) => {
        const nom = ((ab.cats || {})[c] || {}).nom || [];
        const fuera = ya.filter((k) => k.startsWith(c + ':')).map((k) => k.slice(c.length + 1));
        return nom.length || fuera.length ? (
          <div key={c} className="db-mes-c"><b>{n}</b>
            {/* los que sacaste ya no van en la lista: salían dos veces, y «Sacar» los volvía a poner (pasada del 19/10/2026) */}
            <ul>{nom.filter((x) => !ya.includes(c + ':' + x.op)).map((x) => (
              <li key={x.op}><span>{x.n}{yaGano(c, x).length ? <em className="db-mes-gano"> · ya ganó en {yaGano(c, x).join(', ')}</em> : null}</span><button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => alternar(c + ':' + x.op)}>Sacar</button></li>
            ))}{fuera.map((op) => (
              <li key={'f' + op} className="fuera"><span>{op} · sacado</span><button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => alternar(c + ':' + op)}>Volver a poner</button></li>
            ))}</ul>
          </div>
        ) : null;
      })}
      {/* 🏟️ y los de cada servidor Tier 1 (18/10/2026): se sacan igual, con la clave `SV/cat:op` */}
      {Object.keys(ab.sv || {}).sort().map((sv) => (
        <div key={sv} className="db-mes-sv">
          <h4>{sv}</h4>
          {(S.cats_sv || []).map(([c, n]) => {
            const pre = sv + '/' + c + ':';
            const nom = (((ab.sv[sv] || {}).cats || {})[c] || {}).nom || [];
            const fuera = ya.filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length));
            return nom.length || fuera.length ? (
              <div key={c} className="db-mes-c"><b>{n}</b>
                <ul>{nom.filter((x) => !ya.includes(pre + x.op)).map((x) => (
                  <li key={x.op}><span>{x.n}</span><button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => alternar(pre + x.op)}>Sacar</button></li>
                ))}{fuera.map((op) => (
                  <li key={'f' + op} className="fuera"><span>{op} · sacado</span><button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => alternar(pre + op)}>Volver a poner</button></li>
                ))}</ul>
              </div>
            ) : null;
          })}
        </div>
      ))}
    </div>
  );
}

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
// 🔴 LO QUE AVISÓ EL CANAL DE LOGS (Dlx, 17/10/2026: «en el canal de registros aparecen cosas que están malas, en 🔴…
// ¿o aparecer en el dashboard quizás?»): los 🔴 y ⚠️ de los últimos días, del Worker (`/avisos/dueno-logs`). «Ya lo vi»
// los esconde en este navegador; un aviso que vuelve al día siguiente es otro mensaje y aparece de nuevo
const LOGS_VISTO = 'lg:db-logs';
function logsVistos() { try { return JSON.parse(localStorage.getItem(LOGS_VISTO) || '[]') || []; } catch (e) { return []; } }
function useLogs(activo) {
  const [l, setL] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    fetch('/api/avisos/dueno-logs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(async (r) => (r.ok ? r.json() : { error: r.status }))
      .then((j) => { if (vivo) setL(j || { error: 'vacío' }); })
      .catch(() => { if (vivo) setL({ error: 'red' }); });
    return () => { vivo = false; };
  }, [activo]);
  return l;
}
function Logs({ l }) {
  const [vistos, setVistos] = useState(logsVistos);
  if (!l) return <p className="pronto-p">Leyendo Logs…</p>;
  if (l.error) return <p className="pronto-p">No pude leer Logs ({String(l.error)}).</p>;
  const xs = (l.xs || []).filter((x) => !vistos.includes(x.id));
  const ver = (id) => {
    const v = vistos.concat([id]).slice(-200);
    setVistos(v);
    try { localStorage.setItem(LOGS_VISTO, JSON.stringify(v)); } catch (e) { /* sin guardar: vuelve al recargar */ }
  };
  if (!xs.length) return <p className="db-ok">✅ Nada en rojo ni en amarillo en Logs en los últimos días.</p>;
  return (
    <ul className="db-logs">{xs.map((x) => (
      <li key={x.id} className={'db-log ' + x.nivel}>
        <div><b>{x.tit}</b><small>{corto(x.t)}{' · '}<a href={'https://discord.com/channels/' + l.guild + '/' + l.canal + '/' + x.id} target="_blank" rel="noopener noreferrer">en Discord ↗</a></small>
          {x.mas.length ? <details><summary>Ver el detalle</summary><ul>{x.mas.map((m, i) => <li key={i}>{m}</li>)}</ul></details> : null}
        </div>
        <button type="button" className="btn borde2 chico" onClick={() => ver(x.id)}>Ya lo vi</button>
      </li>
    ))}</ul>
  );
}

// ── 🙋 LOS PEDIDOS DE LA GENTE (17/10/2026): perdí mi cuenta, ese no soy yo, mi país, un video que no es mío. Con lo que
// el bot vio de la cuenta que pide; «Sí» lo aprueba —el de cuenta y el de país los aplica el ciclo; los otros dos los
// resolvés vos y quedan hechos— y «No» lo cierra. Lo pueden contestar vos y los Moderadores
const PED_TIPO = { cuenta: 'Perdí mi cuenta de Discord', identidad: 'Ese no soy yo / mi nombre está mal', pais: 'Mi país está mal', video: 'Un video que no es mío' };
const PED_EST = { '': 'esperando', si: '✅ aprobado · lo aplica el ciclo', hecho: '✅ hecho', no: '⛔ no', no_pude: '⚠️ no se pudo aplicar' };
// lo que hace el «Sí» de cada uno: el de cuenta y el de país los aplica el ciclo; el video se saca solo; el de identidad
// lo arreglás vos, así que el botón es para cuando ya está hecho
const PED_SI = { cuenta: 'Sí, es su cuenta', pais: 'Sí, cambiarlo', video: 'Sí, sacar el video', identidad: 'Ya lo arreglé' };
// 🔎 la cuenta VIEJA (la que hoy tiene ese perfil en la Lista), que averigua el ciclo: si sigue en DRA, ojo
function Vieja({ v }) {
  if (!v) return <p className="db-ped-pr">La cuenta vieja: la mira el ciclo en su próxima vuelta.</p>;
  if (v.sin_cuenta) return <p className="db-ped-pr">La cuenta vieja: ese perfil no tenía cuenta en la Lista.</p>;
  const quien = v.usuario ? '@' + v.usuario : 'sin nombre';
  if (v.en_dra) {
    return <p className="db-ped-pr db-ped-ojo">⚠️ La cuenta vieja (<b>{quien}</b>{v.creada ? ', creada el ' + v.creada : ''}) <b>sigue en DRA</b>
      {v.apodo_dra ? ' como «' + v.apodo_dra + '»' : ''}{v.miembro ? ', con el Miembro' : ''}. Preguntale por ahí antes de aprobar.</p>;
  }
  return <p className="db-ped-pr">La cuenta vieja: <b>{quien}</b>{v.creada ? ', creada el ' + v.creada : ''} · {v.en_dra === false ? 'ya no está en DRA' : 'no se pudo ver si sigue en DRA'}.</p>;
}
function Pedidos({ ps, liga, alCambiar }) {
  const [va, setVa] = useState(0);
  const [msg, setMsg] = useState('');
  const resolver = (p, si) => {
    setVa(p.id); setMsg('');
    fetch('/api/avisos/dueno-pedido', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, si }) })
      .then(async (r) => ({ r, j: await r.json().catch(() => ({})) }))
      .then(({ r, j }) => { setVa(0); if (r.ok && j.pedidos) alCambiar(j.pedidos); else setMsg(j.error === 'no' ? 'No tenés permiso.' : 'No pude: ' + (j.error || r.status)); })
      .catch(() => { setVa(0); setMsg('No pude: la red.'); });
  };
  if (!ps.length) return <p className="pronto-p">Nadie pidió nada en los últimos días.</p>;
  return (
    <>
      {msg ? <p className="pronto-p" role="alert">{msg}</p> : null}
      <ul className="db-ped">{ps.map((p) => {
        const f = p.k ? liga.T[p.k] : null;
        const pr = p.prueba || {};
        return (
          <li key={p.id} className={p.estado === '' ? 'abierto' : ''}>
            <div>
              <b className="db-ped-t">{PED_TIPO[p.tipo] || p.tipo}{f ? ' · ' + limpio(f.n) : p.k ? ' · ' + p.k : ''}{p.cc ? ' · ' + p.cc.toUpperCase() : ''}</b>
              <small>{corto(diaISO(new Date(p.t)))} · {PED_EST[p.estado] || p.estado}{p.por ? ' (' + p.por + ')' : ''}{p.nota ? ' · ' + p.nota : ''}</small>
              {p.texto ? <p className="db-ped-tx">«{p.texto}»</p> : null}
              {p.k && f ? <p className="db-ped-pr"><a href={'#/r/' + p.k}>Ver el perfil de {limpio(f.n)} ↗</a></p> : null}
              {p.tipo === 'cuenta' ? <Vieja v={pr.vieja} /> : null}
              {p.tipo === 'cuenta' ? <p className="db-ped-pr">La cuenta que pide: <b>{pr.usuario ? '@' + pr.usuario : 'sin nombre'}</b>{pr.nombre ? ' («' + pr.nombre + '»)' : ''}
                {pr.creada ? ' · creada el ' + pr.creada : ''} · en DRA: {pr.en_dra === false ? 'no está' : (pr.apodo_dra ? '«' + pr.apodo_dra + '»' : 'sin apodo') + (pr.miembro ? ', Miembro' : ', sin el rol Miembro') + (pr.en_dra_desde ? ', desde el ' + pr.en_dra_desde : '')}</p> : null}
              {p.vid ? <p className="db-ped-pr"><a href={'https://youtu.be/' + p.vid} target="_blank" rel="noopener noreferrer">El video ↗</a></p> : null}
            </div>
            {p.estado === '' ? <div className="db-ped-b">
              <button type="button" className="btn verde chico" disabled={va === p.id} onClick={() => resolver(p, true)}>{PED_SI[p.tipo] || 'Sí'}</button>
              <button type="button" className="btn borde2 chico" disabled={va === p.id} onClick={() => resolver(p, false)}>No</button>
            </div> : null}
          </li>
        );
      })}</ul>
    </>
  );
}

function atencion(d, liga, q, logs) {
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
    // 🖼️ y los fondos que esperan (13/10/2026)
    ...((d.fondos || []).length ? [['🖼️', (d.fondos.length === 1 ? 'Un fondo' : d.fondos.length + ' fondos') + ' para revisar', 'Abajo, en Lo que te llegó.']] : []),
    // 📸 y las fotos de tarjeta que esperan (13/10/2026)
    ...((d.fotos_carta || []).length ? [['📸', (d.fotos_carta.length === 1 ? 'Una foto de tarjeta' : d.fotos_carta.length + ' fotos de tarjeta') + ' para revisar', 'Abajo, en Lo que te llegó.']] : []),
    // ✅ y lo de ✅ Decidir sin contestar (13/10/2026)
    ...(sinContestar(d.decidir) ? [['✅', sinContestar(d.decidir) === 1 ? 'Una pregunta de ✅ Decidir sin contestar' : sinContestar(d.decidir) + ' preguntas de ✅ Decidir sin contestar', 'En la pestaña Decisiones.']] : []),
    // 🙋 y los pedidos de la gente sin contestar (17/10/2026)
    ...(() => { const n = (d.pedidos || []).filter((x) => x.estado === '').length; return n ? [['🙋', n === 1 ? 'Un pedido de la gente sin contestar' : n + ' pedidos de la gente sin contestar', 'En la pestaña Reportes.']] : []; })(),
    // 🔴 y lo que Logs avisó en rojo y todavía no viste (17/10/2026)
    ...(() => {
      const v = logsVistos();
      const n = ((logs && logs.xs) || []).filter((x) => x.nivel === 'rojo' && !v.includes(x.id)).length;
      return n ? [['🔴', n === 1 ? 'Un aviso en rojo en Logs' : n + ' avisos en rojo en Logs', 'Abajo, en Lo que avisó Logs.']] : [];
    })(),
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
        // 🔑 TAMBIÉN EL QUE NO ESTABA EN EL SORTEO (15/10/2026: FRZ entró el miércoles y el sorteo fue el lunes): sin
        // sortear vale ×1, y se puede elegir a mano igual (`a_mano()` de bot/multiplicadores.py lo acepta)
        const vm = ref[sv] == null ? 1 : ref[sv];
        const ops = FACTORES.indexOf(vm) < 0 ? [...FACTORES, vm].sort((a, b) => a - b) : FACTORES;
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
            {m.id ? (
              <label><span>Multiplicador de la semana</span>
                <select value={String(vm)} disabled={ocup} onChange={(e) => cambiarMult(sv, Number(e.target.value))}>
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
            <small>{hace(x.t)} · {x.despues === null ? 'volvió a lo de siempre' : x.antes === null ? 'pasó a tu gusto' : 'cambió'}{x.por && x.por !== 'Dlx' ? ' · lo cambió ' + x.por : ''}</small></div>
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

function Ajustes({ liga, aj, chat, hist, hacer, msg, ocup, roles, alRoles, conRoles = true }) {
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
      {conRoles ? <><h2 className="db-h">Roles</h2>
        <Roles roles={roles} alCambiar={alRoles} /></> : null}
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
      <ul>{vs.map(([id, raw, tit, url, motivo, resp]) => (
        <li key={id}>
          <div className="db-l1"><b>{limpio(raw)}</b><span className="db-chip ojo">{motivo}</span></div>
          <a className="db-link" href={url} target="_blank" rel="noopener noreferrer">{tit || url}</a>
          {/* 🎬 lo que contestó (16/10/2026): el link de arriba ya abre en ese minuto */}
          {resp ? <p className="db-tx">Dice que aparece como <b>«{limpio(resp.nombre)}»</b>, en el <b>{resp.minuto}</b>. Cómo reconocerlo: {limpio(resp.como)}</p> : null}
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

// 🏟️ CORREGIR UN NOMBRE DE UNA LIGA (14/10/2026, Dlx: «Sí, a Reportes»): era quien lo mandó u otro de la Lista. El ciclo
// lo deja como el AKA de ese servidor (`por_servidor`, `reportes.corregir_liga()`): vale para la liga y para las llaves
// de ese servidor. Alguien nuevo no: una liga no crea gente
export const ligaDe = (liga, llave) => (((liga && liga.d && liga.d.ligas) || {}).ligas || []).find((x) => 'liga:' + x.id === String(llave)) || null;
function CorregirLiga({ r, liga, alListo }) {
  const L = ligaDe(liga, r.llave);
  const nombres = [];
  for (const f of (L && L.tabla) || []) if (f[0] && !nombres.includes(f[0])) nombres.push(f[0]);
  for (const u of (L && L.ult) || []) for (const x of u.slice(0, 2)) if (x && !nombres.includes(x)) nombres.push(x);
  if (r.batalla && !nombres.includes(r.batalla)) nombres.unshift(r.batalla);
  const [nombre, setNombre] = useState(r.batalla || '');
  const [quien, setQuien] = useState('');
  const [es, setEs] = useState('');
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  const lista = ((liga && liga.d && liga.d.tabla) || []).map((x) => x.n);
  const listo = !!nombre && (quien === 'reporta' || (quien === 'es' && !!es.trim()));
  const aplicar = async () => {
    setOcup(true); setMsg('');
    try {
      alListo(await decidirReporte(Object.assign({ id: r.id, accion: 'nombre', liga: String(r.llave).slice(5), nombre },
        quien === 'reporta' ? { reporta: true } : { es: es.trim() })));
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  const id = 'repl' + r.id;
  return (
    <div className="db-rep-form">
      <span className="db-rep-p">¿Qué nombre de {L ? L.n : 'la liga'} está mal?</span>
      <div className="db-opc">{nombres.map((x) => <button key={x} type="button" className={nombre === x ? 'on' : ''} onClick={() => setNombre(x)}>{x}</button>)}</div>
      {nombre ? <>
        <span className="db-rep-p">«{nombre}» es…</span>
        <div className="db-rep-q">
          <label><input type="radio" name={id} checked={quien === 'reporta'} onChange={() => setQuien('reporta')} /> quien lo mandó{r.evid && r.evid.quien ? ' (' + r.evid.quien + ')' : r.de ? ' (' + r.de + ')' : ''}</label>
          <label><input type="radio" name={id} checked={quien === 'es'} onChange={() => setQuien('es')} /> otro de la Lista:
            <input type="text" list={id + 'l'} value={es} placeholder="su nombre" onFocus={() => setQuien('es')} onChange={(e) => setEs(e.target.value)} maxLength={60} /></label>
          <datalist id={id + 'l'}>{lista.map((x) => <option key={x} value={x} />)}</datalist>
        </div>
      </> : null}
      <p className="db-rep-nota">Queda como su nombre en {L ? L.sv : 'ese servidor'}: en la liga y en las llaves de ese servidor. Lo aplica el ciclo en su próxima corrida y a quien lo mandó le llega a la campana.</p>
      <div className="cu-btns">
        <button type="button" className="btn verde chico" disabled={!listo || ocup} onClick={aplicar}>{ocup ? 'Guardando…' : 'Aplicar'}</button>
        {!listo ? <small>{!nombre ? 'Elegí el nombre.' : 'Elegí quién es.'}</small> : null}
        {msg ? <small role="status">{msg}</small> : null}
      </div>
    </div>
  );
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
function Evidencia({ r, alListo, corrige }) {
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
      {s && abierto && corrige && /^\d+$/.test(r.llave) ? (
        <div className="cu-btns">
          <button type="button" className="btn verde chico" disabled={ocup} onClick={aplicar}>
            {ocup ? 'Guardando…' : 'Aplicar lo sugerido: «' + s.nombre + '» era ' + (s.reporta ? 'quien lo mandó' : s.es_txt || s.es)}</button>
          {msg ? <small role="status">{msg}</small> : null}
        </div>) : null}
    </div>
  );
}

// 🔎 LOS FILTROS DE REPORTES Y DECISIONES (Dlx, 13/10/2026: «¿puedes agregar filtros acá? tanto en reportes para ir por
// servidores, decisiones, nivel de importancia, etc.»). Botones por grupo con cuántos hay de cada uno; un grupo con una
// sola opción no se dibuja. Lo elegido queda en este navegador (`lg:db-f-<pestaña>`): al volver sigue igual
const IMP = [['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']];
const IMP_DICE = 'Alta: los puntos de un evento entero · Media: una batalla o un nombre · Baja: quién es quién y el Most Wanted';
function useFiltro(k) {
  const [f, setF0] = useState(() => { try { return JSON.parse(localStorage.getItem('lg:db-f-' + k) || '{}') || {}; } catch (e) { return {}; } });
  const poner = (n) => { setF0(n); try { localStorage.setItem('lg:db-f-' + k, JSON.stringify(n)); } catch (e) { /* sin guardar */ } };
  return [f, (g, v) => { const n = Object.assign({}, f); if (v) n[g] = v; else delete n[g]; poner(n); }, () => poner({})];
}
//: `[[valor, etiqueta, cuántos]]` de un campo, en el orden de `fijo` (si se da) o de más a menos
function opciones(xs, fn, fijo, etiqueta) {
  const m = new Map();
  for (const x of xs) { const v = fn(x); if (v) m.set(v, (m.get(v) || 0) + 1); }
  const ks = fijo ? fijo.map((y) => y[0]).filter((v) => m.has(v)) : [...m.keys()].sort((a, b) => m.get(b) - m.get(a));
  return ks.map((v) => [v, (fijo && (fijo.find((y) => y[0] === v) || [])[1]) || (etiqueta ? etiqueta(v) : v), m.get(v)]);
}
function Filtros({ grupos, f, setF, limpiar, n, total, nota }) {
  // ⚠️ lo elegido se muestra aunque hoy no haya ninguno, así se puede sacar
  const vis = grupos.map(([g, t, ops]) => [g, t, f[g] && !ops.some((o) => o[0] === f[g]) ? ops.concat([[f[g], f[g], 0]]) : ops])
    .filter(([, , ops]) => ops.length > 1);
  if (!vis.length) return null;
  return (
    <div className="db-filtros" role="group" aria-label="Filtros">
      {vis.map(([g, t, ops]) => (
        <div key={g} className="db-filtro"><span>{t}</span>
          <button type="button" className={'db-fch' + (!f[g] ? ' on' : '')} aria-pressed={!f[g]} onClick={() => setF(g, '')}>Todos</button>
          {ops.map(([v, e, c]) => (
            <button key={v} type="button" className={'db-fch' + (f[g] === v ? ' on' : '')} aria-pressed={f[g] === v}
              onClick={() => setF(g, f[g] === v ? '' : v)}>{e} <small>{c}</small></button>))}
        </div>))}
      {nota ? <p className="db-filtro-n">{nota}</p> : null}
      {Object.keys(f).length ? <p className="db-filtro-n">Mostrando {n} de {total} · <button type="button" className="evp-lnk" onClick={limpiar}>sacar los filtros</button></p> : null}
    </div>
  );
}
// 🔎 BUSCAR POR NOMBRE (Dlx, 13/10/2026, de las ideas del Dashboard): sin tildes ni banderas, en todo lo que se ve de
// cada uno (la pregunta, las pistas, las opciones, el evento; en Reportes, la llave, el texto y quién lo mandó)
const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/\s+/g, ' ').trim();
const contiene = (campos, q) => !q || plano(campos.join(' \n ')).includes(plano(q));
function Buscar({ q, setQ, que }) {
  return (
    <label className="db-buscar"><Ico n="buscar" t={16} />
      <input type="search" value={q} placeholder={'Buscar ' + que} aria-label={'Buscar ' + que} onChange={(e) => setQ(e.target.value)} />
    </label>
  );
}

//: el servidor de una pregunta, de su título («COPA · FFA · 12/10 · #380»): la parte que es una sigla de la Liga
const svDeSec = (sec, liga) => {
  const ps = String(sec || '').split(' · ');
  return ps.find((x) => liga && liga.svs && liga.svs[x]) || ps.slice(1).find((x) => /^[A-Z]{2,5}$/.test(x)) || '';
};
const estadoRep = (r) => (r.estado === '' || r.estado === 'no_pude' ? 'abierto' : r.estado === 'corregir' ? 'en_curso' : 'cerrado');
const impRep = (r) => (r.que === 'ganador' ? 'alta' : r.que === 'nombre' || r.que === 'gente' ? 'media' : 'baja');

function Reportes({ rep, liga, alCambiar, corrige = true }) {
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
  const [f, setF, limpiar] = useFiltro('rep');
  const [q, setQ] = useState('');
  if (!lista.length) return null;
  const pasa = (r) => (!f.sv || (r.evid && r.evid.sv) === f.sv) && (!f.estado || estadoRep(r) === f.estado)
    && (!f.que || r.que === f.que) && (!f.imp || impRep(r) === f.imp)
    && contiene(['#' + r.llave, r.texto, r.batalla, r.de, r.evid && r.evid.quien, ...((r.evid && r.evid.lineas) || []).map((l) => l[1])], q);
  const vista = lista.filter(pasa);
  // 🧩 todo lo que el bot ya sabe cómo corregir, de una (Dlx: «hazlo sencillo de solucionar múltiples problemas»): de
  // lo que se está mostrando, así se puede aplicar por servidor
  const sugeridos = vista.filter((x) => (x.estado === '' || x.estado === 'no_pude') && x.evid && x.evid.sugerencia && /^\d+$/.test(x.llave));
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
      <Buscar q={q} setQ={setQ} que="un nombre o una llave" />
      <Filtros f={f} setF={setF} limpiar={limpiar} n={vista.length} total={lista.length} grupos={[
        ['sv', 'Servidor', opciones(lista, (r) => r.evid && r.evid.sv)],
        ['estado', 'Estado', opciones(lista, estadoRep, [['abierto', 'Sin mirar'], ['en_curso', 'Corrigiéndose'], ['cerrado', 'Cerrados']])],
        ['que', 'Qué', opciones(lista, (r) => r.que, null, (v) => QUE_REP[v] || v)],
        ['imp', 'Importancia', opciones(lista, impRep, IMP)],
      ]} />
      {corrige && sugeridos.length >= 2 ? <div className="cu-btns">
        <button type="button" className="btn verde chico" disabled={msg.todos === '…'} onClick={todos}>Aplicar todo lo sugerido ({sugeridos.length})</button>
        {msg.todos && msg.todos !== '…' ? <small role="status">{msg.todos}</small> : null}
      </div> : null}
      {!vista.length ? <p className="pronto-p">Ninguno con estos filtros.</p> : null}
      <ul>{vista.map((r) => {
        const est = ESTADO_REP[r.estado];
        const abiertoA = r.estado === '' || r.estado === 'no_pude';
        return (
          <li key={r.id}>
            <div className="db-l1"><b>{/^\d+$/.test(r.llave) ? <a href={'#/llave/' + r.llave}>Llave #{r.llave}</a>
              : String(r.llave).startsWith('liga:') ? <a href={'#/ligas/' + encodeURIComponent(String(r.llave).slice(5))}>Liga {(ligaDe(liga, r.llave) || {}).n || String(r.llave).slice(5)}</a> : 'Llave en vivo'}</b>
              <span className="db-chip">{QUE_REP[r.que] || r.que}</span>{est ? <span className={'db-chip ' + est[1]}>{est[0]}</span> : null}</div>
            {/* 👤 quién lo mandó: el nombre de la Lista que pone el ciclo (`evid.quien`), aunque no tenga perfil en la página
                (Dlx, 13/10/2026: «¿pero quién lo dice?») */}
            <small>{hace(r.t)}{r.batalla ? ' · ' + r.batalla : ''}{r.evid && r.evid.quien ? <> · lo mandó {r.de ? <a href={'#/r/' + r.de}>{r.evid.quien}</a> : r.evid.quien}</>
              : r.de ? <> · lo mandó <a href={'#/r/' + r.de}>{r.de}</a></> : <> · quién lo mandó: lo dice el ciclo en su próxima corrida</>}</small>
            {r.texto ? <p>{r.texto}</p> : null}
            {r.evid && (r.evid.lineas || []).length > 1 ? <Evidencia r={r} alListo={setLista} corrige={corrige} /> : null}
            {r.estado === 'corregir' && r.fix ? <small>{r.fix.tipo === 'ganador' ? 'Ganó ' + r.fix.ganador + ' (' + r.fix.ronda + ')'
              : '«' + r.fix.nombre + '» era ' + (r.fix.reporta ? 'quien lo reportó' : r.fix.es || r.fix.nuevo)}</small> : null}
            {r.resultado ? <small>{r.resultado}</small> : null}
            {/* 🔐 quién lo decidió, si no fue Dlx (los permisos, 13/10/2026) */}
            {r.por && r.por !== 'Dlx' && r.estado ? <small>Lo decidió {r.por}.</small> : null}
            {abiertoA || r.estado === 'corregir' ? (
              abierto === r.id ? (String(r.llave).startsWith('liga:') ? <CorregirLiga r={r} liga={liga} alListo={(l) => { setLista(l); setAbierto(null); }} />
                : <Corregir r={r} liga={liga} alListo={(l) => { setLista(l); setAbierto(null); }}
                  hermanos={lista.filter((x) => x.id !== r.id && x.llave === r.llave && (x.estado === '' || x.estado === 'no_pude'))} />) : (
                <div className="cu-btns">
                  {corrige && (/^\d+$/.test(r.llave) || String(r.llave).startsWith('liga:')) ? <button type="button" className="btn verde chico" onClick={() => setAbierto(r.id)}>{r.estado === 'corregir' ? 'Cambiar la corrección' : 'Corregir'}</button> : null}
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

// 🖼️ LOS FONDOS PARA REVISAR (13/10/2026): la imagen que alguien subió como fondo no se ve hasta que la aprobás (hay
// menores en la Liga). Lo que no se aprueba le llega a su campana con el motivo. Ver `duenoFondo()` en avisos.js
const MOTIVOS_FONDO = ['No es apropiada para la Liga', 'Es de otra persona', 'Tiene datos personales', 'No se ve bien'];
function FondosRevisar({ fs, alCambiar, filtro, alFiltro, fcs = [], alFotos }) {
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  const [motivo, setMotivo] = useState({});
  const decidir = async (f, si) => {
    setOcup(f.quien); setMsg('');
    try {
      // 📸 una foto de tarjeta va por su ruta (13/10/2026)
      const r = await fetch(f.tipo === 'foto' ? '/api/avisos/dueno/foto-carta' : '/api/avisos/dueno/fondo', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quien: f.quien, si, motivo: si ? '' : motivo[f.quien] || MOTIVOS_FONDO[0] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || String(r.status));
      if (j.fondos) alCambiar(j.fondos);
      if (j.fotos_carta && alFotos) alFotos(j.fotos_carta);
      if (j.filtro && alFiltro) alFiltro(j.filtro);
    } catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup('');
  };
  const fl = filtro || {}, c = fl.cuenta || {}, vivos = fl.vivos || [];
  return (
    <div>{fs.length ? <h3>Fondos para revisar <small>el filtro automático no estuvo seguro: no se ven hasta que los aprobás</small></h3> : null}
      <ul>{fs.map((f) => (
        <li key={f.quien}>
          <div className="db-l1"><b>{f.k ? <a href={'#/r/' + f.k}>{f.k}</a> : 'una cuenta'}</b><small>{hace(f.t)}</small></div>
          <div className="db-fondo" style={{ backgroundImage: urlFondo(f.pend) || 'none' }} role="img" aria-label="El fondo que subió" />
          <div className="cu-btns">
            <button type="button" className="btn verde chico" disabled={ocup === f.quien} onClick={() => decidir(f, true)}>Aprobar</button>
            <select className="db-sel db-sel-corto" value={motivo[f.quien] || MOTIVOS_FONDO[0]} onChange={(e) => setMotivo(Object.assign({}, motivo, { [f.quien]: e.target.value }))}>
              {MOTIVOS_FONDO.map((m) => <option key={m}>{m}</option>)}</select>
            <button type="button" className="btn borde2 chico" disabled={ocup === f.quien} onClick={() => decidir(f, false)}>No</button>
          </div>
        </li>
      ))}</ul>
      {/* 📸 las fotos de tarjeta que el filtro no supo decidir (13/10/2026) */}
      {fcs.length ? <h3>Fotos de tarjeta para revisar <small>el filtro automático no estuvo seguro: no salen hasta que las aprobás</small></h3> : null}
      <ul>{fcs.map((f) => (
        <li key={'p' + f.quien}>
          <div className="db-l1"><b>{f.k ? <a href={'#/r/' + f.k}>{f.k}</a> : 'una cuenta'}</b><small>{hace(f.t)} · para {(f.cartas || []).join(', ')}</small></div>
          <div className="db-foto" style={{ backgroundImage: urlFoto(f.pend) || 'none' }} role="img" aria-label="La foto que subió" />
          <div className="cu-btns">
            <button type="button" className="btn verde chico" disabled={ocup === f.quien} onClick={() => decidir(Object.assign({ tipo: 'foto' }, f), true)}>Aprobar</button>
            <select className="db-sel db-sel-corto" value={motivo[f.quien] || MOTIVOS_FONDO[0]} onChange={(e) => setMotivo(Object.assign({}, motivo, { [f.quien]: e.target.value }))}>
              {MOTIVOS_FONDO.map((m) => <option key={m}>{m}</option>)}</select>
            <button type="button" className="btn borde2 chico" disabled={ocup === f.quien} onClick={() => decidir(Object.assign({ tipo: 'foto' }, f), false)}>No</button>
          </div>
        </li>
      ))}</ul>
      {/* 🛡️ lo que el filtro dejó ver estos días: si algo se le escapó, se quita acá (13/10/2026) */}
      {vivos.length ? <>
        <h3>Ya se ven <small>los aprobó el filtro automático · en 3 días: {[[c.ok, 'aprobado'], [c.no, 'frenado']].map(([n, t]) => (n || 0) + ' ' + t + ((n || 0) === 1 ? '' : 's')).join(', ')} y {c.revisar || 0} a revisar</small></h3>
        <ul>{vivos.map((f) => (
          <li key={'v' + (f.tipo || 'fondo') + f.quien}>
            <div className="db-l1"><b>{f.k ? <a href={'#/r/' + f.k}>{f.k}</a> : 'una cuenta'}</b><small>{hace(f.t)}{f.tipo === 'foto' ? ' · foto de tarjeta: ' + (f.cartas || []).join(', ') : ' · fondo'}</small></div>
            {f.tipo === 'foto' ? <div className="db-foto" style={{ backgroundImage: urlFoto(f.url) || 'none' }} role="img" aria-label="La foto que se ve" />
              : <div className="db-fondo" style={{ backgroundImage: urlFondo(f.url) || 'none' }} role="img" aria-label="El fondo que se ve" />}
            <div className="cu-btns">
              <select className="db-sel db-sel-corto" value={motivo[f.quien] || MOTIVOS_FONDO[0]} onChange={(e) => setMotivo(Object.assign({}, motivo, { [f.quien]: e.target.value }))}>
                {MOTIVOS_FONDO.map((m) => <option key={m}>{m}</option>)}</select>
              <button type="button" className="btn borde2 chico" disabled={ocup === f.quien} onClick={() => decidir(f, false)}>Quitar</button>
            </div>
          </li>
        ))}</ul>
      </> : null}
      {msg ? <small role="status">{msg}</small> : null}
    </div>
  );
}

// 🤝 lo que también te llega: los videos y los fondos para revisar. Los reportes y ✅ Decidir tienen su pestaña desde el
// 13/10/2026
function Llego({ d, alFondos, alFiltro, alFotos }) {
  const vs = d.videos || [], fs = d.fondos || [], fcs = d.fotos_carta || [], vivos = (d.filtro && d.filtro.vivos) || [];
  if (!vs.length && !fs.length && !fcs.length && !vivos.length) return <p className="pronto-p">Nada nuevo acá: los reportes de las llaves y lo de ✅ Decidir tienen su pestaña.</p>;
  return <div className="db-llego">{fs.length || fcs.length || vivos.length ? <FondosRevisar fs={fs} alCambiar={alFondos} filtro={d.filtro} alFiltro={alFiltro} fcs={fcs} alFotos={alFotos} /> : null}{vs.length ? <VideosRevisar vs={vs} /> : null}</div>;
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

// ❔ QUÉ SE PREGUNTA Y QUÉ HACE CADA RESPUESTA (Dlx, 13/10/2026: «¿cómo lo resuelvo yo? ¿qué pongo?… que se pueda
// resolver bien y que se entienda bien»). Una línea por tipo, en palabras, y debajo de los botones lo que hace cada uno
const QUE_ES = {
  'Bracket incompleto': 'La llave no dice quién ganó y nadie la terminó. Si sabés quién salió campeón, tocá «Ganó…». Si era de prueba o no se jugó, «No cuenta».',
  'Batalla sin ganador': 'La llave no dice quién ganó esta batalla. Elegí al que pasó; si nadie siguió (no se presentó o lo reemplazaron), «Nadie siguió».',
  'Evento dudoso': 'Algo de este evento no le cierra al bot. Mirá la llave al costado: si está bien así, confirmalo; si no, marcalo para revisar.',
  'Nombre desconocido': 'Este nombre está en una llave y el bot no sabe de quién es. Elegí la cuenta, escribí quién es, o marcalo como nuevo.',
  'Alias posible': 'Una misma cuenta de Discord usó dos nombres. Decí si son la misma persona: así suma todo junto.',
  'alta': 'Alguien que no está en la Lista apareció en el bot. Si es alguien nuevo de verdad, sumalo; si no, cerralo.',
  'conflicto': 'Una cuenta de Discord apareció con un nombre que en la Lista ya tiene otra cuenta. Revisalo y cerralo.',
  'ambiguo': 'Esta cuenta se parece a más de una persona de la Lista.',
  'Vidas cargado': 'El bot cargó solo un 5 vidas desde #veredictos. Confirmá que está bien o sacalo.',
  'Evento duplicado': 'El mismo evento quedó cargado dos veces. Si es el mismo, se saca el repetido.',
  'Llave sin resolver': 'El bot no pudo leer esta llave.',
  'Liga terminada': 'Una liga de los servidores lleva tres semanas sin batallas. Si terminó, elegí quién la ganó: entra al Salón de campeones con su insignia.',
};
const HACE = [
  [/^No cuenta$/, 'la llave no suma nada, para nadie.'],
  [/^Sí cuenta$/, 'la llave suma como cualquier evento.'],
  [/^La completo en Discord$/, 'la editás (o el organizador) en Discord con quién ganó, y el bot la lee sola en la próxima vuelta.'],
  [/^Ganó /, 'ése gana (o sale campeón) y el resto queda como está en la llave.'],
  [/^Pasó /, 'ése pasa de ronda y los otros quedan afuera.'],
  [/^Nadie siguió/, 'todos cobran esa ronda, nadie pasa y no cuenta como duelo.'],
  [/^No se jugó$/, 'la batalla se borra: nadie cobra ni suma duelo.'],
  [/^Dejar para después$/, 'queda para otro día, sin cambiar nada.'],
  [/^Está bien así$/, 'el bot deja todo como lo leyó.'],
  [/^Hay que revisarlo$/, 'queda marcado para revisarlo a mano.'],
  [/^Es la misma persona$/, 'une los dos nombres: los puntos y la tarjeta van juntos.'],
  [/^Es otra persona$/, 'quedan separados y no se vuelve a preguntar.'],
  [/^Es alguien nuevo$/, 'lo cuenta como una persona nueva.'],
  [/^Es un troll/, 'ese nombre no suma nada.'],
  [/^Es la cuenta /, 'ese nombre es de esa cuenta de Discord: suma a su persona.'],
  [/^Terminó: la ganó /, 'ése es el campeón de la liga: entra al Salón, con el 2º y el 3º de la tabla, y se publica.'],
  [/^Todavía no terminó$/, 'no se vuelve a preguntar hasta que juegue y pare otra vez.'],
  [/^Es /, 'ese nombre es de esa persona de la Lista.'],
  [/^(Ya está resuelto|Ya lo revisé)$/, 'sólo cierra la pregunta.'],
  [/^Sí, es el mismo/, 'se saca el repetido y queda uno solo.'],
  [/^No, son eventos distintos$/, 'quedan los dos.'],
];
const haceQue = (o) => (HACE.find(([re]) => re.test(o)) || [0, ''])[1];

function Pregunta({ p, r, alListo, marcada, alMarcar }) {
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
      <div className="db-l1">
        {/* ☑️ para contestar varias juntas (ver `Lote`) */}
        {!r && alMarcar ? <label className="db-marca"><input type="checkbox" checked={!!marcada} onChange={() => alMarcar(p.id)} aria-label="Elegir para contestar junto con otras" /></label> : null}
        <span className="db-chip">{p.tipo}</span></div>
      <p className="db-dec-que">{p.que}</p>
      {QUE_ES[p.tipo] && !r ? <p className="db-dec-ayuda">{QUE_ES[p.tipo]}</p> : null}
      {p.pistas && p.pistas !== '—' ? <p className="db-dec-pistas">{p.pistas}</p> : null}
      {r ? (
        <div className="cu-btns">
          <small>✍️ <b>{r.r}</b>{r.nota ? ' · ' + r.nota : ''}{r.por && r.por !== 'Dlx' ? ' · contestó ' + r.por : ''} · lo aplica el ciclo en su próxima corrida</small>
          <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => mandar({ borrar: true })}>Deshacer</button>
        </div>
      ) : <>
        <div className="db-opc">{p.opciones.map((x) => <button key={x} type="button" disabled={ocup} title={haceQue(x)} onClick={() => mandar({ r: x, nota })}>{x}</button>)}</div>
        {p.opciones.some(haceQue) ? (
          <details className="db-dec-hace"><summary>Qué hace cada respuesta</summary>
            <ul>{p.opciones.filter(haceQue).map((x) => <li key={x}><b>{x}</b>: {haceQue(x)}</li>)}</ul>
          </details>) : null}
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

// ── 🏆 LA LLAVE AL COSTADO (Dlx, 13/10/2026: «quizás al costado puedas poner la evidencia o el soporte o algo visual?
// por ejemplo la llave en sí que el bot no entiende»). Si el evento tiene número, la llave como la leyó el bot
// (`/api/llaves`, lo mismo que la página de cada llave), con quién ganó cada batalla; si todavía no entró, lo que dice la
// llave, armado de las pistas («Cuartos: A vs B vs C»). Los nombres de la pregunta van marcados ──
const sinB = (s) => limpio(String(s || '')).toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '');
//: los nombres que nombra una pregunta: «X» y los lados de «A 🆚 B»
function nombresDe(p) {
  const out = [];
  for (const m of String(p.que || '').matchAll(/«([^»]+)»/g)) out.push(m[1]);
  const vs = String(p.que || '').split('\n').find((l) => l.includes('🆚'));
  if (vs) out.push(...vs.split('🆚').flatMap((x) => x.split(',')));
  return out.map(sinB).filter(Boolean);
}
//: «Cuartos: a vs b vs c» de las pistas → rondas, para las llaves que todavía no entraron
function rondasDePistas(ps) {
  const rs = [];
  for (const p of ps) {
    for (const l of String(p.pistas || '').split('\n')) {
      const m = l.match(/^\s*([^:]{3,30}):\s*(.+\svs\s.+)$/i);
      if (!m) continue;
      const r = m[1].trim(), lados = m[2].split(/\s+vs\s+/i).map((x) => x.trim()).filter(Boolean);
      let ro = rs.find((x) => x.r === r);
      if (!ro) { ro = { r, b: [] }; rs.push(ro); }
      if (!ro.b.some((b) => b[0].join('|') === lados.join('|'))) ro.b.push([lados, '']);
    }
  }
  return rs;
}
function LlaveAlCostado({ s }) {
  const n = (String(s.sec || '').match(/#(\d+)/) || [])[1] || '';
  const [ll, setLl] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (n) pedirLlaves().then((t) => { if (vivo && t) setLl(t[n] || null); });
    return () => { vivo = false; };
  }, [n]);
  const marca = new Set(s.ps.flatMap(nombresDe));
  const rondas = ll && (ll.rondas || []).length ? ll.rondas : rondasDePistas(s.ps);
  if (!rondas.length) return null;
  const lado = (x, gano, i) => {
    const k = sinB(x);
    return <span key={i} className={'dl-l' + (gano && k === sinB(gano) ? ' dl-gano' : '') + ([...marca].some((m) => m && (k === m || k.includes(m))) ? ' dl-marca' : '')}>{limpio(x)}</span>;
  };
  return (
    <aside className="db-dec-llave" aria-label="La llave">
      <h4>{ll ? 'La llave #' + n + ', como la leyó el bot' : 'Lo que dice la llave'}</h4>
      {rondas.map((r) => (
        <div key={r.r} className="dl-r"><b>{r.r}</b>
          <ul>{(r.b || []).map((b, i) => (
            <li key={i}>{(b[0] || []).map((x, j) => <Fragment key={j}>{j ? <i>vs</i> : null}{lado(x, b[1], j)}</Fragment>)}
              {ll && !b[1] ? <em>sin ganador</em> : null}</li>
          ))}</ul>
        </div>
      ))}
      <p className="dl-pie">{ll ? <><span className="dl-l dl-gano">ganó</span> </> : null}<span className="dl-l dl-marca">de la pregunta</span>
        {ll && (ll.links || [])[0] ? <> · <a href={ll.links[0]} target="_blank" rel="noopener noreferrer">abrirla en Discord ↗</a></> : null}</p>
    </aside>
  );
}

// ☑️ CONTESTAR EN LOTE (Dlx, 13/10/2026, de las ideas del Dashboard): las elegidas, con una respuesta que tengan TODAS
// entre sus opciones («Es alguien nuevo», «Ya lo revisé», «Dejar para después»…). Se mandan de a una, como si se
// tocaran a mano: el objeto y el ciclo no saben que fue en lote
function Lote({ ps, sel, setSel, alListo, visibles }) {
  const [nota, setNota] = useState('');
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  const elegidas = ps.filter((p) => sel.has(p.id));
  const libres = visibles.filter((p) => !p.r);
  const comunes = elegidas.length ? elegidas[0].opciones.filter((o) => elegidas.every((p) => (p.opciones || []).includes(o))) : [];
  const contestar = async (resp) => {
    setOcup(resp); setMsg('');
    let ultimo = null, mal = 0;
    for (const p of elegidas) {
      try { ultimo = await contestarDecidir({ id: p.id, r: resp, nota }); } catch (e) { mal += 1; }
    }
    if (ultimo) alListo(ultimo);
    setSel(new Set()); setOcup(''); setNota('');
    setMsg(mal ? 'Quedaron ' + mal + ' sin contestar: probá de nuevo.' : '✓ Contestadas ' + elegidas.length + ': «' + resp + '».');
  };
  if (!elegidas.length) {
    return (
      <div className="db-lote apagado">
        {libres.length >= 2 ? <button type="button" className="evp-lnk" onClick={() => setSel(new Set(libres.map((p) => p.id)))}>Elegir las {libres.length} que se ven, para contestarlas juntas</button> : null}
        {msg ? <small role="status">{msg}</small> : null}
      </div>
    );
  }
  return (
    <div className="db-lote" role="region" aria-label="Contestar varias juntas">
      <p><b>{elegidas.length} elegida{elegidas.length === 1 ? '' : 's'}</b> · <button type="button" className="evp-lnk" onClick={() => setSel(new Set())}>soltarlas</button>
        {libres.length > elegidas.length ? <> · <button type="button" className="evp-lnk" onClick={() => setSel(new Set(libres.map((p) => p.id)))}>elegir las {libres.length} que se ven</button></> : null}</p>
      {comunes.length ? <div className="db-opc">{comunes.map((o) => <button key={o} type="button" disabled={!!ocup} onClick={() => contestar(o)}>{ocup === o ? '…' : o}</button>)}</div>
        : <small>Estas preguntas no tienen ninguna respuesta en común: elegí de un solo tipo (el filtro «Tipo» ayuda).</small>}
      {comunes.length ? <div className="db-rep-q"><label>Nota para todas (opcional):
        <input type="text" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} /></label></div> : null}
      {msg ? <small role="status">{msg}</small> : null}
    </div>
  );
}

// ── 🤖 LO QUE SE RESOLVIÓ SOLO (Dlx, 13/10/2026, de las ideas del Dashboard; y «si resolvés algunas cosas asegurate de
// que el bot y la página puedan resolverlo también»). Lo que una regla del ciclo cerró o contestó en los últimos 14 días,
// con la regla, la respuesta y su prueba. «Deshacer» la devuelve a ✅ Decidir en la próxima corrida y esa regla no la
// vuelve a tocar (`deshacer` de `/avisos/decidir-ciclo`) ──
function Solas({ x, alListo }) {
  const [ocup, setOcup] = useState('');
  const [abierto, setAbierto] = useState(false);
  const solas = x.solas || [];
  if (!solas.length) return null;
  const des = new Set(x.deshacer || []);
  const porRegla = {};
  for (const s of solas) porRegla[s.regla || 'otra'] = (porRegla[s.regla || 'otra'] || 0) + 1;
  const deshacer = async (s) => {
    setOcup(s.id);
    try { alListo(await contestarDecidir({ id: s.id, deshacer: true })); } catch (e) { /* queda como estaba */ }
    setOcup('');
  };
  const ver = abierto ? solas : solas.slice(0, 5);
  return (
    <div className="db-solas">
      <h3>🤖 Lo que se resolvió solo <small>{solas.length} en 14 días · {Object.entries(porRegla).map(([r, n]) => r + ' ' + n).join(' · ')}</small></h3>
      <ul>{ver.map((s) => (
        <li key={s.id} className={des.has(s.id) ? 'deshecha' : ''}>
          <div className="db-l1"><span className="db-chip">{s.regla}</span><span className="db-chip">{s.tipo}</span><small>{hace(s.t)}</small></div>
          <p className="db-dec-que">{s.que}{s.sec ? <small> · {s.sec}</small> : null}</p>
          <p className="db-solas-r">→ <b>{s.r}</b>{s.porque ? <span> · {s.porque}</span> : null}</p>
          {des.has(s.id) ? <small>Deshecha: vuelve a ✅ Decidir en la próxima corrida.</small>
            : <button type="button" className="btn borde2 chico" disabled={ocup === s.id} onClick={() => deshacer(s)}>Deshacer</button>}
        </li>
      ))}</ul>
      {solas.length > 5 ? <button type="button" className="evp-lnk" onClick={() => setAbierto(!abierto)}>{abierto ? 'Ver menos' : 'Ver las ' + solas.length}</button> : null}
    </div>
  );
}

function Decisiones({ dec, alCambiar, liga }) {
  const [f, setF, limpiar] = useFiltro('dec');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const marcar = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [x, setX0] = useState(dec || {});
  useEffect(() => { setX0(dec || {}); }, [dec]);
  const setX = (y) => { setX0(y); if (alCambiar) alCambiar(y); };
  const ps = x.preguntas || [], rs = x.respuestas || {};
  if (!ps.length) {
    return <>{(x.solas || []).length ? <Solas x={x} alListo={setX} /> : null}
      <p className="pronto-p">{x.t ? 'Nada para decidir: el ciclo no tiene preguntas abiertas.' : 'Las preguntas aparecen cuando el ciclo las publique, en su próxima corrida.'}</p></>;
  }
  // 🔎 los filtros: servidor (del título), tipo, importancia (`imp` lo pone el ciclo: `decidir.IMPORTANCIA`) y respuesta
  const sv = (p) => svDeSec(p.sec, liga);
  const imp = (p) => p.imp || 'media';
  const resp = (p) => (rs[p.id] ? 'si' : 'no');
  const vista = ps.filter((p) => (!f.sv || sv(p) === f.sv) && (!f.tipo || (p.grupo || p.tipo) === f.tipo)
    && (!f.imp || imp(p) === f.imp) && (!f.resp || resp(p) === f.resp)
    && contiene([p.que, p.pistas, p.sec, ...(p.opciones || [])], q));
  // por evento, en el orden en que vienen (el de la hoja: primero lo que mueve puntos)
  const secs = [];
  for (const p of vista) {
    const s = secs.find((y) => y.sec === p.sec);
    if (s) s.ps.push(p); else secs.push({ sec: p.sec, ps: [p] });
  }
  return (
    <div className="db-dec">
      <p className="db-rep-nota">{sinContestar(x)} sin contestar de {ps.length}{x.t ? ' · el ciclo las publicó ' + hace(x.t) : ''}. Lo que contestes acá vale igual que en la hoja.</p>
      <Solas x={x} alListo={setX} />
      <Buscar q={q} setQ={setQ} que="un nombre, un evento o una llave" />
      <Filtros f={f} setF={setF} limpiar={limpiar} n={vista.length} total={ps.length}
        nota={ps.some((p) => p.imp) ? IMP_DICE : ''} grupos={[
          ['sv', 'Servidor', opciones(ps, sv)],
          ['tipo', 'Tipo', opciones(ps, (p) => p.grupo || p.tipo)],
          ['imp', 'Importancia', ps.some((p) => p.imp) ? opciones(ps, imp, IMP) : []],
          ['resp', 'Respuesta', opciones(ps, resp, [['no', 'Sin contestar'], ['si', 'Contestadas']])],
        ]} />
      {!vista.length ? <p className="pronto-p">Ninguna con estos filtros.</p> : null}
      <Lote ps={ps} sel={sel} setSel={setSel} alListo={setX} visibles={vista.map((p) => Object.assign({ r: rs[p.id] }, p))} />
      {secs.map((s) => {
        const link = (s.ps.find((p) => p.link) || {}).link;
        return (
          <div key={s.sec} className="db-dec-sec">
            <h3>{s.sec}{link ? <> <a className="db-link" href={link} target="_blank" rel="noopener noreferrer">la llave en Discord ↗</a></> : null}</h3>
            <div className="db-dec-cuerpo">
              <ul>{s.ps.map((p) => <Pregunta key={p.id} p={p} r={rs[p.id]} alListo={setX} marcada={sel.has(p.id)} alMarcar={marcar} />)}</ul>
              <LlaveAlCostado s={s} />
            </div>
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
  // 🔴 lo de Logs, sólo para quien puede los ajustes (el Worker también lo pide)
  const logs = useLogs(!!st.d && (!(st.d.permisos) || st.d.permisos.includes('ajustes')));
  const retencion = useRetencion(!!st.d);
  // 📊 las semanas, para «Comparar semanas» (Números)
  const semanas = useSemanas(!!st.d);
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
    // 🔐 QUÉ PUEDE QUIEN MIRA (13/10/2026): el objeto lo dice (`permisos`); sin eso es Dlx con todo (un Worker de antes)
    const pm = d.permisos || ['panel', 'ajustes', 'ciclo', 'reportes', 'reportes_cerrar', 'decidir', 'videos', 'fondos', 'roles'];
    const ve = (k) => pm.includes(k);
    const verTab = { hoy: true, reportes: ve('reportes') || ve('reportes_cerrar'), decisiones: ve('decidir'), ajustes: ve('ajustes'),
      numeros: ve('ajustes'), sistema: ve('ajustes') };
    const tabV = verTab[tab] ? tab : 'hoy';
    const at = atencion(d, liga, cuotas, logs);
    // el número de cada pestaña: lo que espera algo de vos
    const cuenta = { hoy: at.length, reportes: (d.reportes || []).filter((x) => x.estado === '' || x.estado === 'no_pude').length
      + (d.pedidos || []).filter((x) => x.estado === '').length,
      decisiones: sinContestar(d.decidir) };
    const sec = (titulo, em, hijo) => <section className="act"><div className="mis-cab"><span>{titulo}</span>{em ? <em>{em}</em> : null}</div>{hijo}</section>;
    cuerpo = (
      <>
        {d.mis_roles && !d.mis_roles.includes('owner') ? <p className="db-rol">Entraste como <b>{(d.mis_roles || []).map((r) => ({ admin: 'Admin', asistente: 'Asistente', moderador: 'Moderador de la página' }[r] || r)).join(' y ')}</b>{d.yo ? ' (' + d.yo + ')' : ''}: ves {ve('ajustes') ? 'todo menos los roles' : [ve('reportes') ? 'los reportes' : ve('reportes_cerrar') ? 'los reportes (cerrarlos)' : '', ve('decidir') ? '✅ Decidir' : '', ve('fondos') ? 'los fondos y los videos' : ''].filter(Boolean).join(', ')}. Lo que hagas queda con tu nombre.</p> : null}
        <nav className="db-tabs" role="tablist" aria-label="El Dashboard">{PESTANAS.filter(([k]) => verTab[k]).map(([k, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tabV === k} className={'db-tab' + (tabV === k ? ' on' : '')} onClick={() => elegir(k)}>
            {n}{cuenta[k] ? <i aria-label={cuenta[k] === 1 ? 'una cosa' : cuenta[k] + ' cosas'}>{cuenta[k]}</i> : null}
          </button>
        ))}</nav>
        {tabV === 'hoy' ? <>
          {sec('LO QUE PIDE ATENCIÓN', null, <Atencion xs={at} />)}
          {ve('ajustes') ? sec('LO QUE AVISÓ LOGS', 'los 🔴 y ⚠️ de los últimos 3 días', <Logs l={logs} />) : null}
          {ve('ajustes') ? sec('MES AWARDS', 'los nominados del mes', <MesAwardsDueno aj={d.ajustes || {}} hacer={hacer} ocup={ocup} />) : null}
          {(d.vivo || []).length ? sec('EN VIVO AHORA', 'se actualiza al abrir el Dashboard',
            <EnVivo vivo={d.vivo} liga={liga} aj={d.ajustes || {}} chat={d.chat} />) : null}
          {sec('LO QUE TE LLEGÓ', null, <Llego d={d} alFondos={(fs) => cambiarD({ fondos: fs })} alFiltro={(fl) => cambiarD({ filtro: fl })} alFotos={(x) => cambiarD({ fotos_carta: x })} />)}
          {ve('ajustes') ? sec('ATAJOS', null, <ul className="db-atajos">{ATAJOS.map(([t, h]) => (
            <li key={h}><a href={h} target={h[0] === '/' ? undefined : '_blank'} rel={h[0] === '/' ? undefined : 'noopener noreferrer'}>{t} ↗</a></li>
          ))}</ul>) : null}
        </> : null}
        {tabV === 'reportes' ? sec('PEDIDOS DE LA GENTE', 'perdí mi cuenta, mi país, un video…',
          <Pedidos ps={d.pedidos || []} liga={liga} alCambiar={(y) => cambiarD({ pedidos: y })} />) : null}
        {tabV === 'reportes' ? sec('ERRORES REPORTADOS EN LAS LLAVES', 'se borran a los 14 días',
          (d.reportes || []).length ? <div className="db-llego"><Reportes rep={d.reportes} liga={liga} alCambiar={(l) => cambiarD({ reportes: l })} corrige={ve('reportes')} /></div>
            : <p className="pronto-p">Nadie reportó nada en los últimos 14 días.</p>) : null}
        {tabV === 'decisiones' ? sec('✅ DECIDIR', 'las mismas preguntas que la hoja', <Decisiones dec={d.decidir} liga={liga} alCambiar={(y) => cambiarD({ decidir: y })} />) : null}
        {tabV === 'ajustes' ? sec(ve('roles') ? 'CONFIGURACIÓN · SÓLO VOS' : 'CONFIGURACIÓN', null,
          <Ajustes liga={liga} aj={d.ajustes || {}} chat={d.chat} hist={d.ajustes_hist} hacer={hacer} msg={msg} ocup={ocup}
            roles={d.roles} alRoles={(y) => cambiarD({ roles: y })} conRoles={ve('roles')} />) : null}
        {tabV === 'numeros' ? <>
          {sec('COMPARAR SEMANAS', 'de lunes a domingo, en hora del este', <CompararSemanas S={semanas} uso={d.uso_semanas} liga={liga} />)}
          {ve('ajustes') ? sec('LOS TIERS · CÓMO TRABAJA CADA SERVIDOR', 'recomienda; vos elegís', <Tiers T={d.tiers} aj={d.ajustes || {}} hacer={hacer} ocup={ocup} msg={msg} liga={liga} />) : null}
          {sec('EL BOT Y LA PÁGINA · 7 DÍAS', u.desde ? 'se cuenta desde el ' + corto(u.desde) : null, <Cajas u={u} />)}
          {(d.dias || []).length ? sec('DÍA POR DÍA · DOS SEMANAS', null, <Dias dias={d.dias} />) : null}
          {d.tutorial && Object.keys(d.tutorial.n || {}).length ? sec('EL TUTORIAL · DOS SEMANAS',
            d.tutorial.desde ? 'se cuenta desde el ' + corto(d.tutorial.desde) : null, <TutorialNumeros t={d.tutorial} />) : null}
          {d.secciones && Object.keys(d.secciones.n || {}).length ? sec('QUÉ SECCIONES SE ABREN · 7 DÍAS',
            d.secciones.desde ? 'se cuenta desde el ' + corto(d.secciones.desde) : null, <SeccionesNumeros s={d.secciones} />) : null}
          {d.secciones && Object.keys(d.secciones.n || {}).some((k) => /^[ip]-/.test(k)) ? sec('QUÉ SE TOCA EN EL INICIO · 7 DÍAS', null,
            <SeccionesNumeros s={d.secciones} toques />) : null}
          {d.clics ? sec('QUÉ SE TOCA EN TODA LA PÁGINA · 7 DÍAS', d.clics.desde ? 'se cuenta desde el ' + corto(d.clics.desde) : null,
            <ClicsNumeros c={d.clics} />) : null}
          {sec('¿EL LOBBY HACE VOLVER A LA GENTE?', 'la meta del research', <MetaLobby r={retencion} />)}
          {d.pase ? sec('EL PASE DE RAPERO', d.pase.semana ? 'la semana del ' + corto(d.pase.semana) : null, <PaseNumeros p={d.pase} liga={liga} />) : null}
        </> : null}
        {tabV === 'sistema' ? <>
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
