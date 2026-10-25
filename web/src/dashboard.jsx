// 🔒 EL DASHBOARD DEL DUEÑO (Dlx, 04/10/2026: «el bot y la página, que esté en una página nueva creada sólo para el
// owner… la única manera de iniciar sesión ahí es con mi cuenta… ahí poné esa información y configuraciones extras»).
//
// ⚠️ LA PUERTA NO ES ESTA PÁGINA: es `/avisos/dueno` en bot/avisos.js, que le pregunta a Discord (o a la sesión) quién
// es y contesta 403 a cualquiera que no sea Dlx. Acá sólo se dibuja lo que el servidor manda. Sin cuenta, el botón de
// entrar; con otra cuenta, «esta página es del dueño» y nada más. Los ajustes pasan por la misma puerta
// (`/avisos/dueno/ajuste`), y el servidor valida cada valor antes de guardarlo.
import { Fragment, useEffect, useRef, useState } from 'react';
import { diaISO, hora, limpio, mult, num, siglaDe } from './liga.js';
import { DosToques, Ico } from './piezas.jsx';
import { urlFondo } from './fondos.js';
import { pedirCrews, useCrews } from './crews.js';
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
  if (!r.ok) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : j.error || String(r.status));
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
    <div className="dz-nums">{cajas.map(([t, v, d]) => (
      <div key={t} className="dz-num"><span>{t.toLowerCase()}</span><b>{num(v || 0)}</b>
        {typeof d === 'number' ? <small className={d > 0 ? 'sube' : d < 0 ? 'baja' : ''}>{d > 0 ? '▲ ' : d < 0 ? '▼ ' : '= '}{num(Math.abs(d))} contra la semana anterior</small>
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

// 🐞 LO QUE SE ROMPIÓ EN LA PÁGINA (Dlx, 19/10/2026: «ok»). Lo manda web/src/errores.js: en qué parte, el mensaje y dónde
// del código, nunca quién. «inicio» es la página entera (cayó a la de respaldo); «global» y «promesa», lo que no agarró
// ninguna sección
function ErroresPagina({ e }) {
  if (!(e || []).length) return <p className="pronto-p">Ningún error en los últimos 7 días.</p>;
  return (
    <div className="db-aj">
      <ul className="db-corr">{e.map((x) => (
        <li key={x.donde + x.msg}><b>{x.donde}</b><span>{x.msg}</span>
          <small>{num(x.n)} {x.n === 1 ? 'vez' : 'veces'} · {x.dias === 1 ? 'un día' : x.dias + ' días'} · el último {hace(x.ultimo)}
            {x.f ? ' · ' + x.f : ''}{x.tipo ? ' · ' + x.tipo : ''}</small></li>
      ))}</ul>
      <p className="db-tx">Cada error una vez por sesión de cada navegador: «12 veces» son 12 visitas que lo vieron. El lugar del código es del archivo ya construido (<code>inicio/…js:línea:columna</code>).</p>
    </div>
  );
}

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
      else if (j.error === 'espera') setMsg('⏳ Ya se corrió hace poco: prueba en ' + (j.minutos || 10) + ' min.');
      else setMsg('⚠️ No se pudo: ' + (r.status === 401 ? 'la sesión venció, entra de nuevo' : j.error || r.status) + '.');
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
        <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para correrlo" onClick={correr}>▶️ Correr el ciclo ahora</DosToques>
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
// 📈 LA VUELTA AL SEGUNDO EVENTO (25/10/2026, el research del Dashboard: «el número del problema central, mostrado sin
// trampa»). De los que debutan en una semana, cuántos juegan otro evento, otro día, dentro de 14 días: la misma cuenta que
// `MetaLobby`, del ciclo. Cuatro reglas para no engañarse con pocos datos: cada porcentaje con su cantidad de personas;
// con menos de 30, el rango en que puede estar de verdad (Wilson, 95 %); la semana que todavía no cerró dice «abierta» y
// no suma; y el número grande junta las últimas 4 cerradas, porque una sola semana tiene muy poca gente
function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, m = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - m), Math.min(1, c + m)];
}
// 📌 LO QUE SALIÓ CADA SEMANA, para leer un salto con su causa (25/10/2026, el research: las marcas de Grafana). Las
// versiones de la página (`/cambios.json`, el mismo changelog público) y los ajustes del Dashboard que mueven a la gente
// (multiplicadores, campana, sorteo, promos), por el lunes de su semana en hora del este
let cambiosP = null;
const pedirCambios = () => (cambiosP = cambiosP || fetch('/cambios.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
function useCambios(activo) {
  const [c, setC] = useState(null);
  useEffect(() => { if (activo) pedirCambios().then((x) => setC((x && x.cambios) || [])); }, [activo]);
  return c;
}
const lunesDe = (dia) => { const d = new Date(String(dia).slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const MARCA_AJ = { multiplicadores: 'multiplicador a mano', campana_pausada: 'campana', pase_sorteo: 'sorteo', promos_mano: 'promos', aviso_web: 'aviso en la web' };
// ⚠️ LAS VERSIONES VAN CONTADAS, NO UNA POR UNA: hay semanas con 30 a 100, y una lista así no se lee. Los títulos
// quedan al pasar el mouse; los ajustes a mano, que son pocos, van con su nombre
function marcasPorSemana(cambios, hist) {
  const v = {}, a = {}, m = {};
  for (const c of cambios || []) if (c.dia && c.version) { const k = lunesDe(c.dia); (v[k] = v[k] || []).push(c.version + ' ' + (c.titulo || '')); }
  for (const h of hist || []) if (MARCA_AJ[h.cual]) { const k = lunesDe(new Date(msDe(h.t)).toISOString()); (a[k] = a[k] || new Set()).add('✍ ' + MARCA_AJ[h.cual]); }
  for (const k of new Set([...Object.keys(v), ...Object.keys(a)])) {
    const xs = (v[k] || []);
    m[k] = { corto: [xs.length ? num(xs.length) + (xs.length === 1 ? ' versión' : ' versiones') + ' de la página' : '', ...(a[k] || [])].filter(Boolean),
      largo: xs.concat([...(a[k] || [])]) };
  }
  return m;
}

function VueltaSegundo({ r, marcas }) {
  if (r === null) return <p className="pronto-p">Midiendo…</p>;
  if (!r || !(r.cohortes || []).length) return <p className="pronto-p">Todavía no hay una medición del ciclo.</p>;
  const cs = [...r.cohortes].sort((a, b) => String(a.semana).localeCompare(String(b.semana)));
  // ⚠️ LA PRIMERA SEMANA DE LA TEMPORADA NO CUENTA: ahí «debuta» todo el que ya jugaba antes del arranque, y la vuelta
  // sale inflada (71 % la del 21/9, contra 41 % la siguiente). Se ve en la lista, marcada, pero no entra al número grande
  const arranque = cs[0] && cs[0].semana;
  const cerradas = cs.filter((c) => c.completa && c.nuevos && c.semana !== arranque);
  const ult = cerradas.slice(-4);
  const n = ult.reduce((t, c) => t + c.nuevos, 0), k = ult.reduce((t, c) => t + c.volvieron, 0);
  const [lo, hi] = wilson(k, n);
  const ant = cerradas.slice(-8, -4);
  const na = ant.reduce((t, c) => t + c.nuevos, 0), ka = ant.reduce((t, c) => t + c.volvieron, 0);
  const [loA, hiA] = wilson(ka, na);
  // un cambio cuenta si los dos rangos no se pisan; si se pisan, «sin cambio claro»
  const claro = na >= 30 && n >= 30 && (lo > hiA || hi < loA);
  const pc = (x) => Math.round(100 * x);
  return (
    <div className="dz-vuelta">
      {n ? (
        <div className="dz-vuelta-c">
          <b>{pc(k / n)} %</b>
          <div>
            <p><b>{num(k)} de {num(n)}</b> que debutaron {ult.length === 1 ? 'en la última semana cerrada' : 'en las últimas ' + ult.length + ' semanas cerradas'} volvieron a jugar en 14 días.</p>
            <small>De verdad puede estar entre {pc(lo)} % y {pc(hi)} %{na ? '. Las 4 de antes: ' + pc(ka / na) + ' % (' + num(na) + ' personas)' + (claro ? (k / n > ka / na ? ': subió.' : ': bajó.') : ': sin cambio claro.') : '.'}</small>
          </div>
        </div>
      ) : <p className="db-tx">Todavía no cerró ninguna semana: la primera se sabe 14 días después del debut.</p>}
      <ol className="dz-vuelta-l" aria-label="Semana por semana">{cs.slice(-8).map((c) => {
        const p = c.nuevos ? c.volvieron / c.nuevos : 0, [a, b] = wilson(c.volvieron, c.nuevos);
        return (
          <li key={c.semana} className={!c.completa ? 'abierta' : c.semana === arranque ? 'arranque' : ''}>
            <span>{corto(c.semana)}</span>
            <i aria-hidden="true">{c.nuevos ? <><em style={{ left: pc(a) + '%', width: Math.max(1, pc(b) - pc(a)) + '%' }} /><u style={{ left: pc(p) + '%' }} /></> : null}</i>
            <b>{c.nuevos ? pc(p) + ' %' : '—'}</b>
            <small>{num(c.volvieron)} de {num(c.nuevos)}{!c.completa ? ' · abierta' : c.semana === arranque ? ' · arranque, no cuenta' : c.nuevos < 30 ? ' · pocos' : ''}</small>
            {(marcas || {})[c.semana] ? <em className="dz-marcas" title={marcas[c.semana].largo.join(' · ')}>📌 {marcas[c.semana].corto.join(' · ')}</em> : null}
          </li>
        );
      })}</ol>
      <p className="db-tx">La barra gris es el rango; la raya, lo medido. «Abierta»: todavía no pasaron los 14 días, así que va a subir. «Pocos»: menos de 30 personas, el rango es ancho. La semana del arranque no cuenta: ahí «debutaron» también los que ya jugaban antes. 📌 Lo que salió esa semana (versiones de la página y ajustes a mano): sirve para leer un salto con su causa, no prueba que la causa sea ésa.</p>
    </div>
  );
}
// 🔁 LOS PRIMERIZOS Y LOS ENFRIADOS, CON NOMBRE (25/10/2026, el research del Dashboard: «un número no dice a quién
// mirar; una lista sí»). Los arma el ciclo (`bot/primerizos.py`) y llegan sólo acá. La acción es avisarle por su campana
// con un texto fijo (`PLANTILLAS_VUELVE` de bot/avisos.js): nunca un DM. Sólo le llega a quien tiene cuenta
const VUELVE = [['evento', 'Te esperamos en el próximo evento'], ['pase', 'Tu Pase de rapero te espera'], ['crew', 'Súmate a una crew']];
function PrimerizosLista({ P, vuelve, liga, alVuelve }) {
  const [pest, setPest] = useState('una');
  const [sv, setSv] = useState('');
  const [q, setQ] = useState('');
  const [mas, setMas] = useState(false);
  const [que, setQue] = useState('evento');
  const [res, setRes] = useState({});
  if (!P) return <p className="pronto-p">La lista llega con la próxima vuelta del ciclo.</p>;
  const xs0 = pest === 'una' ? P.una || [] : P.frio || [];
  const svs = [...new Set(xs0.map((f) => f[1]).filter(Boolean))].sort();
  const xs = xs0.filter((f) => (!sv || f[1] === sv) && contiene([f[0]], q));
  const ver = mas ? xs.slice(0, 200) : xs.slice(0, 25);
  const hoy = Date.now();
  const dias = (d) => Math.max(0, Math.round((hoy - Date.parse(d + 'T12:00:00Z')) / 864e5));
  const haceDias = (d) => { const n = dias(d); return n === 0 ? 'hoy' : n === 1 ? 'ayer' : 'hace ' + n + ' días'; };
  const avisar = async (k) => {
    setRes((r) => Object.assign({}, r, { [k]: '…' }));
    try {
      const r = await fetch('/api/avisos/dueno/vuelve', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k, que }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) { alVuelve(j.avisados || {}); setRes((x) => Object.assign({}, x, { [k]: '' })); return; }
      setRes((x) => Object.assign({}, x, { [k]: j.error === 'sin_cuenta' ? 'No tiene cuenta en la página: no le llega.' : j.error === 'reciente' ? 'Ya se le avisó esta semana.'
        : j.error === 'tope' ? 'Llegaron a 40 avisos hoy: mañana.' : 'No se pudo: ' + (j.error || r.status) }));
    } catch (e) { setRes((x) => Object.assign({}, x, { [k]: 'No se pudo: sin red.' })); }
  };
  const h = P.hist || {}, hmax = Math.max(1, ...Object.values(h));
  return (
    <div className="dz-prim">
      {Object.keys(h).length ? (
        <div className="dz-hist" role="img" aria-label={'Cuántos eventos jugó cada uno: ' + Object.entries(h).map(([k, v]) => v + ' jugaron ' + (k === '10' ? '10 o más' : k)).join(', ')}>
          {Object.entries(h).map(([k, v]) => (
            <div key={k} className={k === '1' ? 'uno' : ''}><b>{num(v)}</b><i><u style={{ height: (100 * v / hmax).toFixed(1) + '%' }} /></i><span>{k === '10' ? '10+' : k}</span></div>
          ))}
          <small>eventos jugados · {num(P.jugadores || 0)} personas en la temporada</small>
        </div>
      ) : null}
      <div className="dz-subs" role="tablist" aria-label="Qué lista">
        <button type="button" role="tab" aria-selected={pest === 'una'} className={'dz-sub' + (pest === 'una' ? ' on' : '')} onClick={() => { setPest('una'); setSv(''); }}>Jugaron una sola vez<i>{num(P.n_una || 0)}</i></button>
        <button type="button" role="tab" aria-selected={pest === 'frio'} className={'dz-sub' + (pest === 'frio' ? ' on' : '')} onClick={() => { setPest('frio'); setSv(''); }}>Se enfriaron<i>{num(P.n_frio || 0)}</i></button>
      </div>
      <p className="db-tx">{pest === 'una' ? 'Jugaron un evento y no volvieron: los más nuevos arriba, porque a quien debutó hace poco todavía se lo puede traer.'
        : 'Jugaron dos o más y hace ' + (P.enfria_dias || 21) + ' días o más que no vuelven: los que más jugaron arriba.'} Lo midió el ciclo {hace(P.cuando)}.</p>
      <div className="dz-prim-f">
        <label className="db-buscar"><Ico n="buscar" t={16} /><input type="search" value={q} placeholder="Buscar un nombre" aria-label="Buscar en la lista" onChange={(e) => setQ(e.target.value)} /></label>
        {svs.length > 1 ? <select value={sv} aria-label="Servidor" onChange={(e) => setSv(e.target.value)}><option value="">Todos los servidores</option>{svs.map((x) => <option key={x} value={x}>{siglaDe(x)}</option>)}</select> : null}
        <select value={que} aria-label="Qué le llega" onChange={(e) => setQue(e.target.value)}>{VUELVE.map(([k, t]) => <option key={k} value={k}>Le llega: «{t}»</option>)}</select>
      </div>
      <ol className="dz-prim-l">{ver.map((f) => {
        const k = f[f.length - 1], av = (vuelve || {})[k];
        return (
          <li key={pest + k}>
            <div><b><Quien liga={liga} n={f[0]} /></b>
              <small>{siglaDe(f[1] || '—')} · {pest === 'una' ? 'jugó el ' + corto(f[2]) + ', ' + haceDias(f[2])
                : num(f[4]) + ' eventos · el último el ' + corto(f[3]) + ', ' + haceDias(f[3])}</small></div>
            {av ? <span className="dz-prim-ya">✓ Se le avisó {hace(av[0])}{av[2] ? ' (' + av[2] + ')' : ''}</span>
              : <button type="button" className="btn borde2 chico" disabled={res[k] === '…'} onClick={() => avisar(k)}>Avisarle</button>}
            {res[k] && res[k] !== '…' ? <small className="dz-prim-msg" role="status">{res[k]}</small> : null}
          </li>
        );
      })}{!ver.length ? <li className="dz-it-nada">Nadie{q ? ' con «' + q + '»' : ''}.</li> : null}</ol>
      {xs.length > 25 ? <button type="button" className="dz-lnk" onClick={() => setMas(!mas)}>{mas ? 'Ver menos' : 'Ver ' + Math.min(200, xs.length) + ' de ' + num(xs.length)}</button> : null}
      <p className="db-tx">«Avisarle» le deja una notificación en la página (y en el celular, si prendió la campana): nunca un mensaje directo. Uno por persona cada 7 días; sólo a quien tiene cuenta.</p>
    </div>
  );
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
const TIER_QUE = { 1: 'suma al ranking, todo', 2: 'el calendario, no suma', 3: 'su página y sus ligas, no suma' };
// 🎛️ los beneficios de cada servidor (Dlx, 20/10/2026: «qué beneficio dar que no, qué tier, a cada servidor nuevo»). El
// tier los prende en grupo (`PRESET` de bot/tiers.py); cada interruptor manda sobre el preset
const BENEF = [['pagina', 'Su página en Socios'], ['calendario', 'Sus eventos (calendario, campana, Publicaciones)'],
  ['ligas', 'Sus ligas en Ligas'], ['panel', 'El panel de su dueño'], ['suma', 'Sus llaves suman al ranking'],
  ['duelos', 'Sus ligas cuentan como duelos']];
const PRESET = { 1: ['pagina', 'calendario', 'ligas', 'panel', 'suma', 'duelos'], 2: ['pagina', 'calendario', 'ligas', 'panel'],
  3: ['pagina', 'calendario', 'ligas', 'panel'] };

function Beneficios({ x, tier, aj, hacer, ocup }) {
  const mios = (aj.beneficios || {})[x.sv] || {};
  const bloq = x.bloq || [];
  const val = (b) => (bloq.includes(b) ? false : b in mios ? mios[b] : (x.ben && b in x.ben ? x.ben[b] : PRESET[tier].includes(b)));
  const poner = (b, v) => hacer('beneficios', Object.assign({}, aj.beneficios || {}, { [x.sv]: Object.assign({}, mios, { [b]: v }) }),
    BENEF.find((y) => y[0] === b)[1] + (v ? ' prendido' : ' apagado') + ' para ' + siglaDe(x.sv) + '. El ciclo lo aplica en su próxima vuelta.');
  const volver = () => {
    const o = Object.assign({}, aj.beneficios || {});
    delete o[x.sv];
    hacer('beneficios', o, siglaDe(x.sv) + ' vuelve a lo que da su tier.');
  };
  return (
    <div className="ti-ben">
      <small>Lo que recibe {Object.keys(mios).length ? <button type="button" className="ti-ben-x" disabled={ocup} onClick={volver}>volver al tier</button> : null}</small>
      {BENEF.map(([b, t]) => (
        <label key={b} className={bloq.includes(b) ? 'off' : ''} title={bloq.includes(b) ? 'Para sumar al ranking hay que sumarlo al código: pídeselo a Claude.' : ''}>
          <input type="checkbox" checked={val(b)} disabled={ocup || bloq.includes(b)} onChange={(e) => poner(b, e.target.checked)} />
          <span>{t}{bloq.includes(b) ? ' · falta sumarlo al código' : ''}</span>
        </label>
      ))}
    </div>
  );
}

// ✋ LAS PROMOS A MANO (Dlx, 20/10/2026: «yo debería tener la opción de agregar y qué cosas añadir o borrar manualmente
// en PROMO»). Dos ajustes que aplica bot/promos.py en la vuelta siguiente: `promos_mano` (las que agregas, con sus días; van
// primero y sin el tope por persona) y `promos_quitar` (los links que sacas, vengan de donde vengan)
// a mano, cualquier link (Dlx, 20/10/2026: «servidores de Discord, cualquier link… sólo si es manual, o sea por mí»)
const PLATS = /^https:\/\/\S{6,300}$/;
function PromosMano({ aj, hacer, ocup }) {
  const mano = aj.promos_mano || [], quitar = aj.promos_quitar || [];
  const [f, setF] = useState({ u: '', quien: '', sv: '', dias: 7 });
  const [q, setQ] = useState('');
  const [mal, setMal] = useState('');
  const set = (k) => (e) => setF(Object.assign({}, f, { [k]: k === 'dias' ? Number(e.target.value) : e.target.value }));
  const agregar = async (e) => {
    e.preventDefault();
    const u = f.u.trim();
    if (!PLATS.test(u)) return setMal('Pega un link que empiece con https://.');
    if (mano.some((x) => x.u === u)) return setMal('Esa ya está.');
    setMal('');
    const sv = f.sv.trim().toUpperCase();
    const bien = await hacer('promos_mano', [{ u, quien: f.quien.trim(), sv, dias: f.dias, t: new Date().toISOString() }, ...mano].slice(0, 30),
      'Promo agregada por ' + f.dias + (f.dias === 1 ? ' día' : ' días') + '. Sale en la próxima vuelta del ciclo.');
    if (bien) setF({ u: '', quien: '', sv: '', dias: 7 });
    return null;
  };
  const sacarMia = (u) => hacer('promos_mano', mano.filter((x) => x.u !== u), 'Promo quitada. Se va en la próxima vuelta del ciclo.');
  const sacar = async (e) => {
    e.preventDefault();
    const u = q.trim();
    if (!/^https:\/\//.test(u)) return setMal('Pega el link de la promo que quieres sacar.');
    setMal('');
    const bien = await hacer('promos_quitar', [...new Set([u, ...quitar])].slice(0, 200), 'Esa promo deja de salir en la próxima vuelta del ciclo.');
    if (bien) setQ('');
    return null;
  };
  const devolver = (u) => hacer('promos_quitar', quitar.filter((x) => x !== u), 'Esa promo vuelve a salir en la próxima vuelta del ciclo.');
  return (
    <div className="pm">
      <form className="ti-alta" onSubmit={agregar}>
        <b>Agregar una promo</b>
        <div className="ti-alta-g">
          <input value={f.u} onChange={set('u')} placeholder="Cualquier link: un tema, un video, un servidor de Discord…" aria-label="Link" />
          <input value={f.quien} onChange={set('quien')} placeholder="De quién (nombre en la Lista, opcional)" maxLength={40} aria-label="De quién" />
          <input value={f.sv} onChange={set('sv')} placeholder="Servidor (sigla, opcional)" maxLength={6} aria-label="Servidor" />
          <select value={f.dias} onChange={set('dias')} aria-label="Cuántos días">{[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>)}</select>
          <button type="submit" className="btn chico" disabled={ocup}>Agregar</button>
        </div>
        <small>Va primera en Publicaciones, en las historias y, si pones de quién, en su perfil. Sin el tope de dos por persona.</small>
        {mano.length ? <ul className="ti-alta-p">{mano.map((x) => (
          <li key={x.u}><a href={x.u} target="_blank" rel="noopener noreferrer">{x.u.replace(/^https:\/\/(www\.)?/, '').slice(0, 48)}</a>
            {x.quien ? ' · ' + x.quien : ''} · {x.dias} {x.dias === 1 ? 'día' : 'días'} desde el {new Date(x.t).toLocaleDateString('es')}
            <button type="button" className="ti-ben-x" disabled={ocup} onClick={() => sacarMia(x.u)}>quitar</button></li>
        ))}</ul> : null}
      </form>
      <form className="ti-alta" onSubmit={sacar}>
        <b>Sacar una promo</b>
        <div className="ti-alta-g">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pega el link de la promo" aria-label="Link de la promo que sale" />
          <button type="submit" className="btn chico" disabled={ocup}>Sacar</button>
        </div>
        <small>Sirve para cualquiera: la de un canal de promoción, la de la Liga o una tuya. El link se copia de la promo en Publicaciones.</small>
        {quitar.length ? <ul className="ti-alta-p">{quitar.map((u) => (
          <li key={u}>{u.replace(/^https:\/\/(www\.)?/, '').slice(0, 56)}
            <button type="button" className="ti-ben-x" disabled={ocup} onClick={() => devolver(u)}>devolver</button></li>
        ))}</ul> : null}
      </form>
      {mal ? <p className="ti-bajo" role="alert">{mal}</p> : null}
    </div>
  );
}

// ➕ EL ALTA DE UN SERVIDOR (Dlx, 20/10/2026: «agrega esa función para yo agregar a los servidores manualmente»). Se guarda
// en el ajuste `altas` y el ciclo lo suma (`altas()` de bot/tiers.py): la entrada, el bot y la invitación de la Liga
function SumarServidor({ T, aj, hacer, ocup }) {
  const [f, setF] = useState({ sv: '', n: '', g: '', t: 3, tag: '' });
  const [mal, setMal] = useState('');
  const ya = new Set((T.servidores || []).map((x) => x.sv));
  const pend = Object.entries(aj.altas || {}).filter(([sv]) => !ya.has(sv));
  const set = (k) => (e) => setF(Object.assign({}, f, { [k]: k === 't' ? Number(e.target.value) : e.target.value }));
  const mandar = async (e) => {
    e.preventDefault();
    const sv = f.sv.trim().toUpperCase();
    if (!/^[A-Z]{2,6}$/.test(sv)) return setMal('La sigla: de 2 a 6 letras, sin números ni espacios.');
    if (ya.has(sv)) return setMal(sv + ' ya está en la Liga.');
    if (!f.n.trim()) return setMal('Falta el nombre.');
    if (!/^[0-9]{15,22}$/.test(f.g.trim())) return setMal('El ID del servidor: en Discord, clic derecho en el servidor → «Copiar ID del servidor».');
    setMal('');
    const nuevo = { n: f.n.trim(), g: f.g.trim(), t: f.t };
    if (f.tag.trim()) nuevo.tag = f.tag.trim().toUpperCase();
    const bien = await hacer('altas', Object.assign({}, aj.altas || {}, { [sv]: nuevo }),
      sv + ' entra en la próxima vuelta del ciclo, como Tier ' + f.t + '. Si el bot está adentro, también su invitación.');
    if (bien) setF({ sv: '', n: '', g: '', t: 3, tag: '' });
    return null;
  };
  const quitar = (sv) => {
    const o = Object.assign({}, aj.altas || {});
    delete o[sv];
    hacer('altas', o, sv + ' ya no se suma.');
  };
  return (
    <form className="ti-alta" onSubmit={mandar}>
      <b>Sumar un servidor</b>
      <div className="ti-alta-g">
        <input value={f.sv} onChange={set('sv')} placeholder="Sigla (FDS)" maxLength={6} aria-label="Sigla" />
        <input value={f.n} onChange={set('n')} placeholder="Nombre" maxLength={60} aria-label="Nombre" />
        <input value={f.g} onChange={set('g')} placeholder="ID del servidor de Discord" inputMode="numeric" aria-label="ID del servidor" />
        <input value={f.tag} onChange={set('tag')} placeholder="Etiqueta (opcional)" maxLength={24} aria-label="Etiqueta" />
        <select value={f.t} onChange={set('t')} aria-label="Tier">{[1, 2, 3].map((t) => <option key={t} value={t}>Tier {t}</option>)}</select>
        <button type="submit" className="btn verde chico" disabled={ocup}>Sumar</button>
      </div>
      <small>Entra confirmado y con lo que da su tier; después le cambias los beneficios en su caja. Sumar al ranking pide sumarlo al
        código (pídeselo a Claude): hasta entonces sus llaves no suman. El bot tiene que estar adentro para leer sus anuncios.</small>
      {mal ? <small className="ti-bajo" role="alert">{mal}</small> : null}
      {pend.length ? <ul className="ti-alta-p">{pend.map(([sv, x]) => (
        <li key={sv}><b>{sv}</b> {x.n} · Tier {x.t} · espera la próxima vuelta del ciclo
          <button type="button" className="ti-ben-x" disabled={ocup} onClick={() => quitar(sv)}>quitar</button></li>
      ))}</ul> : null}
    </form>
  );
}
const REC = { bien: ['✅', 'Bien'], subir: ['⬆️', 'Puede subir'], revisar: ['⚠️', 'Revisar'], casa: ['🏠', 'La casa'] };
const PARTES = [['actividad', 'Actividad', 35], ['alcance', 'Alcance', 25], ['calidad', 'Calidad', 25], ['comunidad', 'Comunidad', 15]];

/** 👑 El dueño de un socio para su panel (`#/socio`): el de Discord, que lee el ciclo, o el que pongas acá, que manda. */
function DuenoSocio({ x, aj, hacer, ocup }) {
  const mano = (aj.socios_duenos || {})[x.sv] || [];
  const [v, setV] = useState(mano.join(', '));
  const [mal, setMal] = useState('');
  const guardar = () => {
    const ids = v.split(/[\s,]+/).map((y) => y.trim()).filter(Boolean);
    if (ids.some((y) => !/^[0-9]{15,22}$/.test(y)) || ids.length > 3) { setMal('Hasta 3 Discord IDs (sólo números), separados por coma.'); return; }
    setMal('');
    const todos = Object.assign({}, aj.socios_duenos || {});
    if (ids.length) todos[x.sv] = ids; else delete todos[x.sv];
    hacer('socios_duenos', todos, ids.length ? 'El panel de ' + siglaDe(x.sv) + ' ahora lo ve ' + ids.join(', ') + '.' : 'El panel de ' + siglaDe(x.sv) + ' vuelve al dueño de Discord.');
  };
  return (
    <div className="ti-dueno">
      <small>Su panel lo ve: <b>{mano.length ? mano.join(', ') + ' (a mano)' : x.dueno ? x.dueno + ' (dueño en Discord)' : 'nadie todavía'}</b> · <a href={'#/socio?sv=' + x.sv}>Ver su panel</a></small>
      <span className="ti-dueno-f">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Otro Discord ID (hasta 3)" aria-label={'Quién ve el panel de ' + x.nombre} inputMode="numeric" />
        <button type="button" className="btn borde2 chico" disabled={ocup || v.trim() === mano.join(', ')} onClick={guardar}>Guardar</button>
      </span>
      {mal ? <small className="ti-bajo" role="alert">{mal}</small> : null}
    </div>
  );
}

function TierCaja({ x, liga, tier, cambiar, ocup, i, aj, hacer }) {
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
      <div className="ti-pts"><b>{pts}</b><small>de 100{x.antes && x.compara !== false ? ' · antes ' + x.antes : ''}</small></div>
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
      <Beneficios x={x} tier={tier} aj={aj} hacer={hacer} ocup={ocup} />
      <DuenoSocio x={x} aj={aj} hacer={hacer} ocup={ocup} />
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
      <p className="db-tx">Las últimas {T.semanas || 4} semanas. El puntaje recomienda; <b>el nivel lo eliges tú</b>. Tier 1 suma al ranking y
        lleva todo; Tier 2 sale en el calendario y la campana, pero sus llaves no suman; Tier 3 tiene su página y sus ligas en Ligas,
        sin sumar. Los eventos y las redes se promocionan en los tres. Para ser socio: 300 miembros como mínimo, se recomiendan 500.</p>
      {msg ? <p className="db-msg" role="status">{msg}</p> : null}
      <SumarServidor T={T} aj={aj} hacer={hacer} ocup={ocup} />
      <div className="ti-g">{T.servidores.map((x, i) => <TierCaja key={x.sv} x={x} liga={liga} tier={tierDe(x)} cambiar={cambiar} ocup={ocup} i={i} aj={aj} hacer={hacer} />)}</div>
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
    // 🎮 la pantalla de bienvenida (19/10/2026)
    ['VIERON LA BIENVENIDA', v('bienv'), num(v('bienv_unirse')) + ' tocaron «Unirme» · ' + num(v('bienv_listo')) + ' terminaron · '
      + num(v('bienv_luego')) + ' «en otro momento»'],
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
  tarjetas: 'Tarjetas', ligas: 'Ligas', crews: 'Crews', salon: 'Salón de la fama', pase: 'Pase', tienda: 'Tienda', socios: 'Socios', guia: 'Guía', perfil: 'Un perfil',
  servidor: 'Un servidor', crew: 'Una crew', pais: 'Un país', cuenta: 'Mi cuenta', cambios: 'Novedades',
  'i-historias': 'Las historias', 'i-envivo': 'Lo de arriba (Ahora)', 'i-semana': 'Esta semana', 'i-ira': 'La barra IR A',
  'i-fechas': 'Fechas', 'i-sebusca': 'Se busca', 'i-noticias': 'Lo último', 'i-encuestas': 'Encuestas y Tus eventos',
  'i-raperos': 'Los que mandan', 'i-panel': 'Misiones', 'i-merch': 'Merchandising', 'i-numeros': 'La Liga en números',
  'p-eventos': 'Puerta · Eventos', 'p-ranking': 'Puerta · Ranking', 'p-mw': 'Puerta · Se busca', 'p-tarjetas': 'Puerta · Tarjetas',
  'p-pase': 'Puerta · Pase', 'p-tienda': 'Puerta · Tienda' };
// 👥 LOS NÚMEROS DE LAS CREWS (19/10/2026, `crewNumeros()` de bot/crews.js): esta semana contra la anterior, y hoy
const CREW_NUM = [['creada', 'Crews armadas'], ['entro', 'Entraron a una crew'], ['link', '… con un link'],
  ['invito', 'Invitaciones mandadas'], ['se_cambio', 'Se cambiaron de crew'], ['link_nuevo', 'Links armados'],
  ['salio', 'Salieron'], ['cerrada', 'Crews cerradas o borradas'], ['quedo', 'Pasaron su primera semana'],
  ['verifico', 'Se verificaron (estaban sin verificar)'], ['salio_sin_verificar', 'Salieron por no verificarse']];
function CrewsNumeros({ c }) {
  const s = c.semana || {}, a = c.antes || {}, h = c.hoy || {};
  const filas = CREW_NUM.filter(([k]) => s[k] || a[k]);
  const tope = Math.max(1, ...filas.map(([k]) => s[k] || 0));
  return (
    <div className="db-aj">
      <p className="db-tx"><b>Hoy:</b> {num(h.crews || 0)} crews ({num(h.de_la_gente || 0)} armadas por la gente, {num(h.primera_semana || 0)} en su
        primera semana) · {num(h.gente || 0)} personas en una crew{h.sin_verificar ? ' (' + num(h.sin_verificar) + ' sin verificar)' : ''} · {num(h.links || 0)} links
        abiertos · {num(c.paneles || 0)} {c.paneles === 1 ? 'dueño abrió' : 'dueños abrieron'} su panel de socio esta semana.</p>
      {filas.length ? (
        <div className="db-q">{filas.map(([k, t]) => (
          <div key={k} className="db-q-f"><span>{t}</span><i><u style={{ width: ((100 * (s[k] || 0)) / tope).toFixed(1) + '%' }} /></i>
            <b>{num(s[k] || 0)} <small>{a[k] ? 'antes ' + num(a[k]) : 'esta semana'}</small></b></div>
        ))}</div>
      ) : <p className="pronto-p">Todavía no pasó nada esta semana.</p>}
      <p className="db-tx">Los últimos 7 días y, al lado, los 7 de antes. Sirve para saber qué se usa de las crews antes de cambiar algo.</p>
    </div>
  );
}

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

// 📊 EL TABLERO DEL PASE (25/10/2026; el informe «Pase de rapero enganche», cambio 1, y Dlx: «dale»): una fila por semana
// con cuántos había y qué parte estaba entre el 1 y el 3 —es la foto del antes para cada cambio del Pase—, y los días que
// la diaria tocó «mirar una llave en vivo» sin que nadie mirara ninguna (casi seguro, un día sin evento)
function FotosPase({ p }) {
  const fotos = p.fotos || [];
  const v = p.vivo || [0, 0];
  if (!fotos.length && !v[0]) return null;
  return (
    <>
      {fotos.length ? (
        <div className="db-tabla"><table><thead><tr><th>Semana</th><th>Con nivel</th><th>Del 1 al 3</th><th>Del 4 al 9</th><th>10 o más</th><th>El más alto</th></tr></thead>
          <tbody>{fotos.map(([s, d]) => {
            const xs = Object.entries(d || {}).map(([n, k]) => [Number(n), k]);
            const tot = xs.reduce((a, x) => a + x[1], 0) || 1;
            const de = (a, b) => xs.filter((x) => x[0] >= a && x[0] <= b).reduce((m, x) => m + x[1], 0);
            const pct = (k) => Math.round((100 * k) / tot) + ' %';
            return <tr key={s}><td>{s}</td><td>{num(tot)}</td><td>{pct(de(1, 3))}</td><td>{pct(de(4, 9))}</td><td>{pct(de(10, 999))}</td>
              <td>{xs.length ? Math.max(...xs.map((x) => x[0])) : '—'}</td></tr>;
          })}</tbody></table></div>
      ) : null}
      {v[0] ? <p className="db-tx">La diaria «Mira una llave en vivo» tocó <b>{v[0]}</b> {v[0] === 1 ? 'día' : 'días'}; en <b>{v[1]}</b> nadie miró ninguna (casi seguro, sin evento). Tiene que dar 0.</p> : null}
    </>
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
        <div className="db-aj"><div className="db-q">{dist.map(([n, k]) => {
          // 📊 trabados: de los de ese nivel, cuántos no cumplen una Tarea hace 7 días o más (25/10/2026)
          const tr = (p.trabados || {})[n];
          return (
            <div key={n} className="db-q-f"><span>Nivel {n}</span><i><u style={{ width: ((100 * k) / tope).toFixed(1) + '%' }} /></i>
              <b>{num(k)} <small>{k === 1 ? 'persona' : 'personas'}{tr && tr[1] ? ' · ' + tr[1] + ' trabad' + (tr[1] === 1 ? 'o' : 'os') : ''}</small></b></div>
          );
        })}</div>
        <p className="db-tx">«Trabados»: sin cumplir una Tarea hace 7 días o más. Es dónde se cae la gente del Pase.</p>
        {/* las Tareas de hoy, de la semana y de la temporada (con XP desde el 06/10/2026), con el % de los que tienen nivel */}
        {[['hoy', p.hoy], ['esta semana', p.tareas], ['en la temporada', p.temporada]].some(([, xs]) => (xs || []).length) ? (
          <ul className="db-corr">{[['hoy', p.hoy], ['esta semana', p.tareas], ['en la temporada', p.temporada]].flatMap(([cu, xs]) =>
            (xs || []).map(([t, k]) => <li key={cu + t}><b>{limpio(t)}</b><span>{num(k)} {k === 1 ? 'vez' : 'veces'} {cu}
              {p.con_nivel ? ' · ' + Math.round((100 * k) / p.con_nivel) + ' %' : ''}</span></li>))}</ul>
        ) : null}
        <FotosPase p={p} />
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
          : <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para pausar" onClick={() => hacer('campana_pausada', true, 'La campana quedó en pausa.')}>Pausar la campana</DosToques>}
      </div>
    </div>
  );
}

// ── 🎟️ EL SORTEO DEL PASE PREMIUM (Dlx, 25/10/2026: «voy a sortear el rol de Pase de temporada en DRA», y «algo
// interactivo en la página»). Se programa acá: un nombre, cuándo cierra y cuándo se sortea (tu hora). La gente entra
// gratis desde el Pase; a la hora, el vigía elige al ganador con una cuenta que cualquiera repite, la página lo muestra
// en vivo y sale en Publicaciones. El rol «Pase Premium» se lo pone el bot (`sorteoRol()`): «Pase T» es de la
// suscripción del servidor y nadie puede ponerlo a mano ──
const aLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); const z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()); };
function AjSorteo({ liga, aj, hacer, ocup }) {
  const S = aj.pase_sorteo || null;
  const [f, setF] = useState({ id: (S && S.id) || 'premium-t1', cierra: aLocal(S && S.cierra), sorteo: aLocal(S && S.sorteo) });
  const [est, setEst] = useState(null);
  useEffect(() => { setF({ id: (S && S.id) || 'premium-t1', cierra: aLocal(S && S.cierra), sorteo: aLocal(S && S.sorteo) }); }, [S && S.id, S && S.cierra, S && S.sorteo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!S) { setEst(null); return; }
    fetch('/api/avisos/sorteo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then((r) => (r.ok ? r.json() : null)).then(setEst).catch(() => setEst(null));
  }, [S && S.id, ocup]); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = /^[a-z0-9-]{3,30}$/.test(f.id) && f.cierra && f.sorteo && Date.parse(f.cierra) <= Date.parse(f.sorteo);
  const guardar = () => hacer('pase_sorteo', { id: f.id, cierra: new Date(f.cierra).toISOString(), sorteo: new Date(f.sorteo).toISOString() },
    'El sorteo quedó programado: la gente ya puede entrar desde el Pase.');
  const s = est && est.sorteo, res = est && est.resultado;
  const nom = (k) => (liga.T && liga.T[k] ? limpio(liga.T[k].n) : k);
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>El sorteo del premium</h3><span className={'db-est' + (S ? ' ok' : '')}>{res ? '✓ Sorteado' : S ? '● Programado' : 'Sin sorteo'}</span></div>
      <p className="db-tx">La gente entra gratis desde la pestaña Premium del Pase: 1 boleto, y uno más por cada semana con las cinco semanales (hasta 3). A la hora se sortea solo, se ve en vivo en la página y sale en Publicaciones. El bot le pone el rol «Pase Premium» al ganador.</p>
      {s ? <p className="db-tx"><b>{num(s.personas)}</b> {s.personas === 1 ? 'entró' : 'entraron'} · <b>{num(s.boletos)}</b> boletos.
        {res ? <> Ganó <b>{nom(res.k)}</b>{res.rol === 1 ? ': ya tiene el rol «Pase Premium».' : res.rol === -1 ? ': ya no está en DRA, el bot no pudo ponerle el rol.' : ': el bot le está poniendo el rol.'}</> : null}</p> : null}
      <div className="db-sorteo">
        <label>Nombre<input type="text" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value.toLowerCase() })} maxLength={30} placeholder="premium-t1" /></label>
        <label>Cierra (tu hora)<input type="datetime-local" value={f.cierra} onChange={(e) => setF({ ...f, cierra: e.target.value })} /></label>
        <label>Se sortea (tu hora)<input type="datetime-local" value={f.sorteo} onChange={(e) => setF({ ...f, sorteo: e.target.value })} /></label>
      </div>
      <div className="cu-btns">
        <button type="button" className="btn verde chico" disabled={ocup || !ok} onClick={guardar}>{S ? 'Guardar cambios' : 'Programar'}</button>
        {S ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para sacarlo" onClick={() => hacer('pase_sorteo', null, 'El sorteo se sacó de la página.')}>Sacar el sorteo</DosToques> : null}
      </div>
      {!ok && (f.cierra || f.sorteo) ? <p className="db-tx">El nombre va en minúsculas, números y guiones; y tiene que cerrar antes de sortearse.</p> : null}
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
          <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para sacarlo" onClick={() => hacer('aviso_web', null, 'Aviso sacado.')}>Sacarlo</DosToques>
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
      <p className="db-tx">Lo ve todo el mundo, arriba de cada página, hasta que vence o lo sacas. Cada uno lo puede cerrar.</p>
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
  const estado = (sv) => (dash[sv] === false ? 'Apagado por ti' : admin[sv] ? 'Lo prendió su admin'
    : dash[sv] === true ? 'Prendido por ti, en el chat general' : 'Apagado: su admin no eligió canal');
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
      <p className="db-tx">Durante un evento cuenta en el chat cómo va, y cuánto habla se elige: <b>lo justo</b> (el arranque y el campeón), <b>normal</b> (además quién pasa cada ronda y la final, como mucho un mensaje cada 10 minutos) o <b>cada batalla</b> (quién gana cada una apenas se sabe, como mucho uno cada 2 minutos). No menciona a nadie. Lo prende el admin de cada servidor con /settings; desde acá lo prendes en el chat general, lo apagas o le cambias cuánto habla aunque su admin haya elegido otra cosa.</p>
      {general ? <p className="db-tx">Si habla y cuánto, servidor por servidor, en Servidores.</p> : svs.length ? (
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
      {general ? <p className="db-tx">Dónde va el de cada servidor, en Servidores.</p> : null}
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
          {a ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para volver a lo de siempre"
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
          {s ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para sacarlo"
            onClick={() => hacer('silencio', null, 'Sin silencio: vuelve a hablar a toda hora.')}>Sacarlo</DosToques> : null}
        </div>
      </form>
    </div>
  );
}

// 👥 LAS CREWS (Dlx, 19/10/2026: «que yo tenga la configuración para elegir eso»): cuánto cuesta crear una, cómo se
// arma su ranking (todos, los N mejores o los representantes que elige el líder) y el líder de cada una —las 34 de antes
// arrancaron con el primero de la lista—. El precio y el ranking son ajustes; el líder va por `/avisos/dueno/crew`
const MODOS_CREW = [['todos', 'La suma de todos'], ['mejores', 'Los N mejores de cada una'], ['reps', 'Los representantes que elige el líder']];
// 🏆 los de siempre (bot/crews_tiers.py `SUBE`, `BAJA`, `JUEGAN`), por si el payload todavía no los trae
const TIERS_DEF = { nombres: ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro', 'Leyenda'],
  sube: [15000, 30000, 50000, 80000, 120000, 180000], baja: [5000, 15000, 25000, 40000, 60000, 90000], juegan: [0, 1, 2, 3, 4, 5, 6] };

/** 🏆 Los números de los tiers de las crews (Dlx, 19/10/2026: «Tiers en el Dashboard»): para subir, para no bajar y
 *  cuántos tienen que jugar, tier por tier. Los valida `tiersValidos()` de bot/crews.js y los usa el ciclo en el cierre
 *  de la semana (`bot/crews_tiers.py`); los de hoy llegan con el payload. */
function TiersCrew({ liga, aj, hacer, ocup }) {
  const P = (liga.d && liga.d.crews_tiers) || {};
  const de = aj.crews_tiers_num || { sube: (P.sube || TIERS_DEF.sube).slice(0, 6), baja: (P.baja || [null].concat(TIERS_DEF.baja)).slice(1),
    juegan: P.juegan || TIERS_DEF.juegan };
  const nombres = P.nombres || TIERS_DEF.nombres;
  const [t, setT] = useState(() => ({ sube: de.sube.map(String), baja: de.baja.map(String), juegan: de.juegan.map(String) }));
  const pon = (que, i, v) => setT((x) => Object.assign({}, x, { [que]: x[que].map((y, j) => (j === i ? v : y)) }));
  const num0 = (xs) => xs.map((x) => Number(x));
  return (
    <form className="db-form uno" onSubmit={(e) => {
      e.preventDefault();
      hacer('crews_tiers_num', { sube: num0(t.sube), baja: num0(t.baja), juegan: num0(t.juegan) },
        'Guardado: los tiers se mueven con estos números desde el próximo cierre (lunes 11 AM ET).');
    }}>
      <h4 className="db-sub">Los tiers · puntos de la semana</h4>
      <div className="db-tabla-x"><table className="db-tiers">
        <thead><tr><th>Tier</th><th>Para subir</th><th>Baja con menos de</th><th>Para entrar juegan</th></tr></thead>
        <tbody>{nombres.map((n, i) => (
          <tr key={n}>
            <th>{n}</th>
            <td>{i < 6 ? <input type="number" min="1" max="10000000" step="1000" value={t.sube[i]} aria-label={'Para subir desde ' + n}
              onChange={(e) => pon('sube', i, e.target.value)} /> : '—'}</td>
            <td>{i > 0 ? <input type="number" min="0" max="10000000" step="1000" value={t.baja[i - 1]} aria-label={'Baja de ' + n + ' con menos de'}
              onChange={(e) => pon('baja', i - 1, e.target.value)} /> : '—'}</td>
            <td><input type="number" min="0" max="20" value={t.juegan[i]} aria-label={'Para entrar a ' + n + ', cuántos juegan'}
              onChange={(e) => pon('juegan', i, e.target.value)} /></td>
          </tr>
        ))}</tbody>
      </table></div>
      <p className="db-tx">Cada número de una columna, igual o más que el de arriba. Lo que pide no bajar en un tier no puede ser más que lo
        que pidió subir a él. La tarjeta de crew se desbloquea en Diamante.</p>
      <div className="cu-btns">
        <button type="submit" className="btn verde chico" disabled={ocup}>Guardar los tiers</button>
        {aj.crews_tiers_num ? <button type="button" className="btn borde2 chico" disabled={ocup}
          onClick={() => hacer('crews_tiers_num', null, 'Listo: vuelven los números de siempre.')}>Volver a los de siempre</button> : null}
      </div>
    </form>
  );
}
function AjCrews({ liga, aj, hacer, ocup }) {
  const { todas } = useCrews();
  const r = aj.crews_ranking || { modo: 'todos', n: 5 };
  const [precio, setPrecio] = useState(String(aj.crew_precio ?? 2500));
  // 💸 cambiar el nombre (o la sigla) y el logo (Dlx, 19/10/2026: «cuesta plata»): lo de siempre, `PRECIO_NOMBRE` y
  // `PRECIO_LOGO` de bot/crews.js
  const [pNombre, setPNombre] = useState(String(aj.crew_precio_nombre ?? 1000));
  const [pLogo, setPLogo] = useState(String(aj.crew_precio_logo ?? 1000));
  const [modo, setModo] = useState(r.modo);
  const [n, setN] = useState(String(r.n || 5));
  const [msg, setMsg] = useState('');
  const [va, setVa] = useState(false);
  const lider = (crew, a) => {
    setVa(true);
    setMsg('');
    window.conCuenta('/api/avisos/dueno/crew', { que: 'lider', crew, a }, 's').then((j) => {
      setVa(false);
      if (j && j.ok) { setMsg('Listo: nuevo líder.'); pedirCrews(true); } else setMsg('No pude (' + ((j && j.error) || 'red') + ').');
    }).catch(() => { setVa(false); setMsg('No pude.'); });
  };
  const nombre = (k) => { const f = liga.T[k]; return f ? limpio(f.n) : k; };
  const crews = ((todas && todas.crews) || []).slice().sort((a, b) => (b.oficial - a.oficial) || String(a.nombre).localeCompare(b.nombre));
  return (
    <div className="db-aj db-aj-ancho">
      <div className="db-aj-c"><h3>Las crews</h3><span className="db-est">{crews.length} crews · crear cuesta {num(aj.crew_precio ?? 2500)}</span></div>
      <p className="db-tx">Las arma la gente: verificados, pagando Puntos de Tienda, hasta 20 cada una. Líder, Colíder, Veterano y Miembro; 7 días entre una crew y otra.</p>
      <form className="db-form uno" onSubmit={(e) => {
        e.preventDefault();
        // de a uno, sólo lo que cambió: cada ajuste se guarda solo
        (async () => {
          const cambios = [['crew_precio', precio, aj.crew_precio ?? 2500], ['crew_precio_nombre', pNombre, aj.crew_precio_nombre ?? 1000],
            ['crew_precio_logo', pLogo, aj.crew_precio_logo ?? 1000]].filter(([, v, antes]) => Number(v) !== Number(antes));
          for (const [k, v] of cambios) { if (!(await hacer(k, Number(v), 'Guardado: crear ' + num(Number(precio)) + ', cambiar el nombre ' + num(Number(pNombre)) + ', cambiar el logo ' + num(Number(pLogo)) + '.'))) break; }
        })();
      }}>
        <div className="db-fila">
          <label className="db-campo db-corto"><span>Crear cuesta (Puntos de Tienda)</span>
            <input type="number" min="0" max="50000" step="100" value={precio} onChange={(e) => setPrecio(e.target.value)} /></label>
          <label className="db-campo db-corto"><span>Cambiar el nombre o la sigla</span>
            <input type="number" min="0" max="50000" step="100" value={pNombre} onChange={(e) => setPNombre(e.target.value)} /></label>
          <label className="db-campo db-corto"><span>Cambiar el logo</span>
            <input type="number" min="0" max="50000" step="100" value={pLogo} onChange={(e) => setPLogo(e.target.value)} /></label>
        </div>
        <p className="db-tx">La descripción y los requisitos se cambian gratis. Un logo que no se aprueba se devuelve.</p>
        <div className="cu-btns"><button type="submit" className="btn verde chico" disabled={ocup}>Guardar los precios</button></div>
      </form>
      <form className="db-form uno" onSubmit={(e) => {
        e.preventDefault();
        hacer('crews_ranking', { modo, n: Number(n) }, 'Guardado: el ranking de crews cambia en la próxima vuelta del ciclo.');
      }}>
        <div className="db-fila">
          <label className="db-campo"><span>El ranking de crews suma</span>
            <select value={modo} onChange={(e) => setModo(e.target.value)}>{MODOS_CREW.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
          {modo !== 'todos' ? <label className="db-campo db-corto"><span>{modo === 'reps' ? 'Representantes' : 'Cuántos'}</span>
            <input type="number" min="1" max="20" value={n} onChange={(e) => setN(e.target.value)} /></label> : null}
        </div>
        <div className="cu-btns"><button type="submit" className="btn verde chico" disabled={ocup}>Guardar el ranking</button></div>
      </form>
      <TiersCrew liga={liga} aj={aj} hacer={hacer} ocup={ocup} />
      {crews.length ? (
        <details className="db-det">
          <summary>El líder de cada crew ({crews.length})</summary>
          <ul className="db-crews">{crews.map((c) => {
            const l = (c.gente.find((g) => g[1] === 'lider') || [])[0] || '';
            return (
              <li key={c.id}>
                <a href={'#/crew/' + encodeURIComponent(c.id)}><b>{limpio(c.nombre)}</b></a>{c.oficial ? <small> · de antes</small> : null}
                <select value={l} disabled={va} aria-label={'El líder de ' + c.nombre} onChange={(e) => lider(c.id, e.target.value)}>
                  {c.gente.map(([k]) => <option key={k} value={k}>{nombre(k)}</option>)}
                </select>
              </li>
            );
          })}</ul>
        </details>
      ) : null}
      {msg ? <p className="db-msg" role="status">{msg}</p> : null}
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
        {r ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para volver a lo de siempre"
          onClick={() => hacer('ritmo', null, 'Volvió el de siempre.')}>Volver a lo de siempre</DosToques> : null}
      </div>
      <p className="db-tx">Lo de siempre: uno cada {def.normal} minutos, y en «Cada batalla», uno cada {def.batalla}.</p>
    </div>
  );
}



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
    return <p className="pronto-p">{v ? 'Así va ' + v.nombre + ': los nominados salen el día 1 a las 11 AM, y desde ahí hasta las 6 PM puedes sacar a alguno acá.' : 'Todavía no hay MES AWARDS.'}</p>;
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
      <p className="pronto-p">Los nominados de <b>{ab.nombre}</b>. La votación abre el {corto(ab.abre)}: hasta entonces puedes sacar a alguno.
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
// ↩️ Y DESHACER POR 8 SEGUNDOS (25/10/2026, la maqueta: «cada cambio se puede deshacer»): guarda lo que había antes y
// el aviso de abajo lo vuelve a poner con un toque, sin ir al historial
function useHacer(onAj, getAj) {
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  const [aviso, setAviso] = useState(null);
  const tm = useRef(0);
  const mostrar = (a) => { clearTimeout(tm.current); setAviso(a); tm.current = setTimeout(() => setAviso(null), 8000); };
  const hacer = async (cual, valor, ok, sinDeshacer) => {
    const antes = getAj ? getAj()[cual] : undefined;
    setOcup(true); setMsg('');
    let bien = false;
    try {
      onAj(await ajustar(cual, valor));
      setMsg('✅ ' + ok); bien = true;
      mostrar({ ok: '✅ ' + ok, cual, antes: antes === undefined ? null : antes, puede: !sinDeshacer });
    } catch (e) {
      setMsg('⚠️ No se pudo: ' + e.message + '.');
      mostrar({ ok: '⚠️ No se pudo: ' + e.message + '.', puede: false });
    }
    setOcup(false);
    return bien;
  };
  const deshacer = async () => {
    const a = aviso;
    if (!a || !a.puede) return;
    setAviso(null);
    await hacer(a.cual, volverA(a.cual, a.antes), 'Deshecho: volvió a como estaba.', true);
  };
  return { hacer, msg, ocup, aviso, deshacer, cerrarAviso: () => setAviso(null) };
}
// lo que había antes, tal como se puede volver a poner: un aviso que ya venció no se republica (el servidor lo rechaza)
const volverA = (cual, v) => (cual === 'aviso_web' && v && Date.parse(v.hasta) <= Date.now() ? null : v);

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
      {v.apodo_dra ? ' como «' + v.apodo_dra + '»' : ''}{v.miembro ? ', con el Miembro' : ''}. Pregúntale por ahí antes de aprobar.</p>;
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
      .then(({ r, j }) => { setVa(0); if (r.ok && j.pedidos) alCambiar(j.pedidos); else setMsg(j.error === 'no' ? 'No tienes permiso.' : 'No pude: ' + (j.error || r.status)); })
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

// 🔔 LO QUE PIDE ATENCIÓN y no es una cola (las colas son los cuadrados de «Para decidir»): `[ícono, título, detalle,
// área, ancla]`, y el botón «Ir» lleva a donde se arregla (antes decía «Abajo, en…» o «Mira Sistema.» sin link)
function atencion(d, liga, q, logs) {
  const aj = d.ajustes || {};
  const ult = (d.corridas || [])[0];
  return [
    aj.campana_pausada ? ['⏸', 'La campana está en pausa', 'No sale ningún aviso de evento hasta que la reanudes.', 'web', 'aj-campana'] : null,
    d.sistema && d.sistema.ok === false ? ['⚠️', 'El lector de anuncios no contesta', 'Los avisos al minuto y el bot en vivo pueden estar quietos.', 'salud', 'sa-corridas'] : null,
    ult && ult.estado === 'completed' && ult.fin && ult.fin !== 'success' && ult.fin !== 'skipped'
      ? ['⚠️', 'La última vuelta del ciclo ' + String(FIN_CORRIDA[ult.fin] || ult.fin).replace(/^\S+\s/, ''), 'Puedes correrlo de nuevo desde Salud.', 'salud', 'sa-corridas'] : null,
    ...cuotasEnRojo(q).map(([, , t]) => ['⚠️', t + ' casi llenas hoy', 'Se renuevan a las 8 PM ET.', 'salud', 'sa-cuotas']),
    ...(d.reportes || []).filter((x) => x.estado === 'no_pude').map((x) => ['⚠️', 'No se pudo corregir la llave #' + x.llave, x.resultado, 'pendientes', '']),
    ...(() => {
      const v = logsVistos();
      const n = ((logs && logs.xs) || []).filter((x) => x.nivel === 'rojo' && !v.includes(x.id)).length;
      return n ? [['🔴', n === 1 ? 'Un aviso en rojo en Logs' : n + ' avisos en rojo en Logs', 'Lo que avisó el canal de Logs y no viste.', 'salud', 'sa-logs']] : [];
    })(),
  ].filter(Boolean);
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
          {man ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para volver al sorteo"
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
            {/* 📅 los eventos de Discord (19/10/2026): cada anuncio, un evento del servidor con «Me interesa» */}
            <label><span>Eventos de Discord</span>
              <select value={(aj.eventos_discord || {})[sv] === true ? 'si' : ''} disabled={ocup}
                onChange={(e) => cambiar('eventos_discord', aj.eventos_discord || {}, sv, e.target.value === 'si' ? true : '')}>
                <option value="">Apagados</option>
                <option value="si">Cada anuncio, un evento de su Discord</option>
              </select>
              {(c.evd || {})[sv] ? <small className="db-tx">{(c.evd[sv].creados || 0) + ' en 7 días'
                + (c.evd[sv].error === 'permiso' ? ' · ⚠️ al bot le falta «Crear eventos» ahí' : c.evd[sv].error ? ' · ⚠️ ' + c.evd[sv].error : '')}</small> : null}</label>
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
const NOMBRE_AJ = { campana_pausada: 'La campana', pase_sorteo: 'El sorteo del premium', multiplicadores: 'El multiplicador de la semana', aviso_web: 'El aviso en la página',
  en_vivo: 'El bot en vivo', en_vivo_nivel: 'Cuánto habla el bot en vivo', ritmo: 'El ritmo del bot en vivo', silencio: 'El horario de silencio',
  apuestas: 'Las apuestas', aviso_evento: 'Dónde va el aviso de cada evento', avisos_nivel: 'Cuánto dice el aviso de cada evento',
  // 🏷️ y los que salían con el código crudo (25/10/2026)
  eventos_discord: 'Los eventos de Discord', tiers: 'El tier de los servidores', beneficios: 'Lo que recibe cada servidor', altas: 'Sumar un servidor',
  socios_duenos: 'El dueño de un servidor socio', promos_mano: 'Las promos a mano', promos_quitar: 'Las promos sacadas', mes_sacar: 'Los nominados de los MES AWARDS',
  crew_precio: 'Lo que cuesta crear una crew', crew_precio_nombre: 'Lo que cuesta cambiarle el nombre a una crew', crew_precio_logo: 'Lo que cuesta cambiarle el logo a una crew',
  crews_ranking: 'El ranking de crews', crews_tiers_num: 'Los tiers de las crews' };
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
          {puede ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo: vuelve a como estaba"
            onClick={() => hacer(x.cual, volverA(x.cual, x.antes), 'Deshecho: volvió a como estaba.')}>Deshacer</DosToques> : null}
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
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : j.error || String(r.status));
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
          {p[2] === '739338101603696681' ? <small>Owner: sólo tú, siempre.</small> : null}
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
        <AjSorteo liga={liga} aj={aj} hacer={hacer} ocup={ocup} />
        <AjAviso liga={liga} aj={aj} hacer={hacer} ocup={ocup} />
        <AjVivo liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general />
        <AjRitmo aj={aj} hacer={hacer} ocup={ocup} chat={chat} />
        <AjSilencio aj={aj} hacer={hacer} ocup={ocup} />
        <AjApuestas liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general />
        <AjAvisos liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general />
        <AjCrews liga={liga} aj={aj} hacer={hacer} ocup={ocup} />
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
              {hecho[id] === 'falló' ? <small>No se pudo: prueba de nuevo.</small> : null}
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
const QUE_REP = { ganador: 'el ganador', gente: 'falta o sobra alguien', nombre: 'un nombre', otro: 'otra cosa', perfil: 'su perfil' };
// las partes de un lado: «Presagio, NC, Agus» son tres
const partes = (x) => String(x || '').split(/\s*[,+&]\s*/).map((s) => s.trim()).filter(Boolean);

async function decidirReporte(cuerpo) {
  const r = await fetch('/api/avisos/dueno/reporte', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : j.error || String(r.status));
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
        {!listo ? <small>{!nombre ? 'Elige el nombre.' : 'Elige quién es.'}</small> : null}
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
  const falta = modo === 'nombre' ? (!nombre ? 'Elige el nombre que está mal.' : !listo ? 'Elige de quién era.' : '')
    : (!b ? 'Elige la batalla.' : !gana ? 'Elige quién la ganó.' : '');
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
          <option value="">Elige la batalla</option>
          {batallas.map((x) => <option key={x.k} value={x.k}>{x.ronda} · {x.lados.join(' vs ')} (dice: {x.ganador || '—'})</option>)}
        </select>
        {b ? <>
          <span className="db-rep-p">¿Quién la ganó?</span>
          <div className="db-opc">{b.lados.map((x) => <button key={x} type="button" className={gana === x ? 'on' : ''} onClick={() => setGana(x)}>{x}{x === b.ganador ? ' (lo que dice hoy)' : ''}</button>)}</div>
        </> : null}
      </>}
      {yaDice ? <p className="db-rep-ya">La llave ya dice que ganó {gana}: no hay nada que corregir. Si el reporte pedía eso, ciérralo con «Listo».</p>
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
              : String(r.llave).startsWith('liga:') ? <a href={'#/ligas/' + encodeURIComponent(String(r.llave).slice(5))}>Liga {(ligaDe(liga, r.llave) || {}).n || String(r.llave).slice(5)}</a>
                // 🚩 reportar usuario (21/10/2026): `perfil:<clave>`
                : String(r.llave).startsWith('perfil:') ? <a href={'#/r/' + encodeURIComponent(String(r.llave).slice(7))}>Perfil de {limpio(((liga.T || {})[String(r.llave).slice(7)] || {}).n || String(r.llave).slice(7))}</a> : 'Llave en vivo'}</b>
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
    <div>{fs.length ? <h3>Fondos para revisar <small>el filtro automático no estuvo seguro: no se ven hasta que los apruebas</small></h3> : null}
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
      {fcs.length ? <h3>Fotos de tarjeta para revisar <small>el filtro automático no estuvo seguro: no salen hasta que las apruebas</small></h3> : null}
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

// 👥 LOS LOGOS DE LAS CREWS (19/10/2026, bot/crews.js `crewDueno()`): lo que el filtro no supo decidir no se ve hasta que
// lo aprobás, y lo que aprobó queda tres días acá con «Quitar» —lo mismo que los fondos—. Al Líder le llega a su campana
function LogosCrews({ cl }) {
  const [lista, setLista] = useState(cl || { pend: [], vistos: [] });
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  const [motivo, setMotivo] = useState({});
  const decidir = async (x, si, de) => {
    setOcup(x.id); setMsg('');
    try {
      const r = await fetch('/api/avisos/dueno/crew', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ que: 'logo', crew: x.id, url: x.url, si, motivo: si ? '' : motivo[x.id] || MOTIVOS_FONDO[0] }) });
      const j = await r.json().catch(() => ({}));
      // 🛡️ se decide sobre el logo que viste: si el Líder subió otro mientras tanto, el objeto contesta `cambio`
      if (j.error === 'cambio') throw new Error('el logo de esta crew cambió mientras lo mirabas: recarga el Dashboard');
      if (!r.ok || j.error) throw new Error(j.error || String(r.status));
      setLista(Object.assign({}, lista, { [de]: lista[de].filter((y) => y.id !== x.id) }));
    } catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup('');
  };
  const fila = (x, de) => (
    <li key={de + x.id}>
      <div className="db-l1"><b><a href={'#/crew/' + encodeURIComponent(x.id)}>{x.nombre}</a></b><small>{hace(x.t)}</small></div>
      <img className="db-logo-crew" src={x.url} alt={'El logo de ' + x.nombre} />
      <div className="cu-btns">
        {de === 'pend' ? <button type="button" className="btn verde chico" disabled={ocup === x.id} onClick={() => decidir(x, true, de)}>Aprobar</button> : null}
        <select className="db-sel db-sel-corto" value={motivo[x.id] || MOTIVOS_FONDO[0]} onChange={(e) => setMotivo(Object.assign({}, motivo, { [x.id]: e.target.value }))}>
          {MOTIVOS_FONDO.map((m) => <option key={m}>{m}</option>)}</select>
        <button type="button" className="btn borde2 chico" disabled={ocup === x.id} onClick={() => decidir(x, false, de)}>{de === 'pend' ? 'No' : 'Quitar'}</button>
      </div>
    </li>
  );
  if (!lista.pend.length && !lista.vistos.length) return null;
  return (
    <div>
      {lista.pend.length ? <><h3>Logos de crews para revisar <small>el filtro automático no estuvo seguro: no se ven hasta que los apruebas</small></h3>
        <ul>{lista.pend.map((x) => fila(x, 'pend'))}</ul></> : null}
      {lista.vistos.length ? <><h3>Logos de crews que ya se ven <small>los aprobó el filtro en los últimos 3 días</small></h3>
        <ul>{lista.vistos.map((x) => fila(x, 'vistos'))}</ul></> : null}
      {msg ? <small role="status">{msg}</small> : null}
    </div>
  );
}

// 🤝 lo que también te llega: los videos y los fondos para revisar. Los reportes y ✅ Decidir tienen su pestaña desde el
// 13/10/2026
function Llego({ d, alFondos, alFiltro, alFotos }) {
  const vs = d.videos || [], fs = d.fondos || [], fcs = d.fotos_carta || [], vivos = (d.filtro && d.filtro.vivos) || [];
  const cl = d.crews_logos || { pend: [], vistos: [] };
  const hayLogos = (cl.pend || []).length || (cl.vistos || []).length;
  if (!vs.length && !fs.length && !fcs.length && !vivos.length && !hayLogos) return <p className="pronto-p">Nada nuevo acá: los reportes de las llaves y lo de ✅ Decidir tienen su pestaña.</p>;
  return <div className="db-llego">{fs.length || fcs.length || vivos.length ? <FondosRevisar fs={fs} alCambiar={alFondos} filtro={d.filtro} alFiltro={alFiltro} fcs={fcs} alFotos={alFotos} /> : null}{hayLogos ? <LogosCrews cl={cl} /> : null}{vs.length ? <VideosRevisar vs={vs} /> : null}</div>;
}

// ── ✅ DECIDIR, EN EL DASHBOARD (13/10/2026). Dlx: «estaba pensando en mover lo de decidir del sheet, aquí», y a la
// propuesta, «Sí, con Reportes». Las MISMAS preguntas de la hoja —las publica el ciclo (`decidir.para_web()`)—, por
// evento, con sus pistas y sus opciones. Contestar lo guarda el objeto y lo aplica el ciclo en su próxima corrida
// como si estuviera escrito en la hoja (`decidir._respuestas()`). La hoja sigue una semana en paralelo ──
async function contestarDecidir(cuerpo) {
  const r = await fetch('/api/avisos/dueno/decidir', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : j.error || String(r.status));
  return j.decidir || {};
}
export const sinContestar = (dec) => ((dec && dec.preguntas) || []).filter((p) => !((dec.respuestas || {})[p.id])).length;

// ❔ QUÉ SE PREGUNTA Y QUÉ HACE CADA RESPUESTA (Dlx, 13/10/2026: «¿cómo lo resuelvo yo? ¿qué pongo?… que se pueda
// resolver bien y que se entienda bien»). Una línea por tipo, en palabras, y debajo de los botones lo que hace cada uno
const QUE_ES = {
  'Bracket incompleto': 'La llave no dice quién ganó y nadie la terminó. Si sabes quién salió campeón, toca «Ganó…». Si era de prueba o no se jugó, «No cuenta».',
  'Batalla sin ganador': 'La llave no dice quién ganó esta batalla. Elige al que pasó; si nadie siguió (no se presentó o lo reemplazaron), «Nadie siguió».',
  'Evento dudoso': 'Algo de este evento no le cierra al bot. Mira la llave al costado: si está bien así, confírmalo; si no, márcalo para revisar.',
  'Nombre desconocido': 'Este nombre está en una llave y el bot no sabe de quién es. Elige la cuenta, escribe quién es, o márcalo como nuevo.',
  'Alias posible': 'Una misma cuenta de Discord usó dos nombres. Di si son la misma persona: así suma todo junto.',
  'alta': 'Alguien que no está en la Lista apareció en el bot. Si es alguien nuevo de verdad, súmalo; si no, ciérralo.',
  'conflicto': 'Una cuenta de Discord apareció con un nombre que en la Lista ya tiene otra cuenta. Revísalo y ciérralo.',
  'ambiguo': 'Esta cuenta se parece a más de una persona de la Lista.',
  'Vidas cargado': 'El bot cargó solo un 5 vidas desde #veredictos. Confirma que está bien o sácalo.',
  'Evento duplicado': 'El mismo evento quedó cargado dos veces. Si es el mismo, se saca el repetido.',
  'Llave sin resolver': 'El bot no pudo leer esta llave.',
  'Liga terminada': 'Una liga de los servidores lleva tres semanas sin batallas. Si terminó, elige quién la ganó: entra al Salón de campeones con su insignia.',
};
const HACE = [
  [/^No cuenta$/, 'la llave no suma nada, para nadie.'],
  [/^Sí cuenta$/, 'la llave suma como cualquier evento.'],
  [/^La completo en Discord$/, 'la editas (o el organizador) en Discord con quién ganó, y el bot la lee sola en la próxima vuelta.'],
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
    setMsg(mal ? 'Quedaron ' + mal + ' sin contestar: prueba de nuevo.' : '✓ Contestadas ' + elegidas.length + ': «' + resp + '».');
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
        : <small>Estas preguntas no tienen ninguna respuesta en común: elige de un solo tipo (el filtro «Tipo» ayuda).</small>}
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

// ── 🧭 EL DASHBOARD, POR ÁREAS (25/10/2026). Dlx: «quisiera que lo remakees completamente… siento que está todo tirado
// pero no necesariamente organizado», y a la maqueta (artifact 9W34gdd8BspxH3A5QyDLxj), «una mezcla… de A el lado
// izquierdo, de B que aparece lo prioritario primero, en cuadrados». Siete áreas en la barra de la izquierda (arriba en el
// teléfono) y cada cosa vive en UNA sola: los ajustes de los servidores estaban repartidos entre Ajustes, Números (los
// tiers) y Hoy (los MES AWARDS). El Resumen abre con lo que hay que decidir, en cuadrados.
// El área elegida se recuerda en este navegador (`lg:db-area`)
const AREAS = [
  ['resumen', 'Resumen', 'M3 12l9-8 9 8M5 10v10h14V10'],
  ['pendientes', 'Pendientes', 'M4 4h16v12H14l-4 4v-4H4z'],
  ['servidores', 'Servidores', 'M4 5h16v5H4zM4 14h16v5H4zM7 7.5h.01M7 16.5h.01'],
  ['web', 'La página y el bot', 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4'],
  ['numeros', 'Números', 'M5 20V11M12 20V5M19 20v-7'],
  ['salud', 'Salud', 'M3 12h4l3-7 4 14 3-7h4'],
  ['historial', 'Historial y roles', 'M12 7v5l3 3M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4'],
];
// las cuatro colas de Pendientes
const SUBP = [['quien', '¿Quién es quién?'], ['llaves', 'Errores en las llaves'], ['imagenes', 'Imágenes y videos'], ['pedidos', 'Pedidos']];
const AREA = 'lg:db-area';
const leerArea = () => { try { const t = localStorage.getItem(AREA); return AREAS.some(([k]) => k === t) ? t : 'resumen'; } catch (e) { return 'resumen'; } };
const ponerArea = (t) => { try { localStorage.setItem(AREA, t); } catch (e) { /* sin almacenamiento */ } };
const msDe = (t) => (typeof t === 'number' ? t : Date.parse(t || '') || 0);

// 🔎 LO QUE ENCUENTRA «BUSCAR» (Ctrl+K): cada ajuste y cada lugar, con el área donde vive y el ancla a la que baja
const BUSCABLES = [
  ['La campana (pausar los avisos)', 'web', 'aj-campana'], ['El sorteo del premium', 'web', 'aj-sorteo'],
  ['Aviso arriba de la página', 'web', 'aj-aviso'], ['El bot en vivo', 'web', 'aj-vivo'], ['Cada cuánto habla el bot en vivo', 'web', 'aj-ritmo'],
  ['Horario de silencio', 'web', 'aj-silencio'], ['Las apuestas', 'web', 'aj-apuestas'], ['El aviso de cada evento', 'web', 'aj-avisos'],
  ['Las crews: precios, ranking y tiers', 'web', 'aj-crews'], ['MES AWARDS: sacar un nominado', 'web', 'aj-mes'], ['Promos a mano', 'web', 'aj-promos'],
  ['El multiplicador de la semana', 'servidores', 'sv-cada'], ['Bot en vivo, apuestas y aviso de cada servidor', 'servidores', 'sv-cada'],
  ['Los tiers de los servidores', 'servidores', 'sv-tiers'], ['Sumar un servidor', 'servidores', 'sv-tiers'], ['El dueño de un servidor socio', 'servidores', 'sv-tiers'],
  ['¿Quién es quién? (✅ Decidir)', 'pendientes', '', 'quien'], ['Errores en las llaves', 'pendientes', '', 'llaves'],
  ['Fondos, fotos de carta, logos y videos', 'pendientes', '', 'imagenes'], ['Pedidos de la gente', 'pendientes', '', 'pedidos'],
  ['Comparar semanas', 'numeros', 'nu-semanas'], ['El bot y la página, 7 días', 'numeros', 'nu-uso'], ['El tutorial', 'numeros', 'nu-tuto'],
  ['Qué se toca en la página', 'numeros', 'nu-clics'], ['¿El lobby hace volver a la gente?', 'numeros', 'nu-lobby'], ['Las crews (números)', 'numeros', 'nu-crews'],
  ['El Pase de rapero (números)', 'numeros', 'nu-pase'], ['Correr el ciclo ahora', 'salud', 'sa-corridas'], ['Lo que gasta Cloudflare hoy', 'salud', 'sa-cuotas'],
  ['Lo que avisó Logs', 'salud', 'sa-logs'], ['Errores de la página', 'salud', 'sa-errores'], ['El mapa en vivo y los atajos', 'salud', 'sa-atajos'],
  ['Historial de cambios (deshacer)', 'historial', 'hi-hist'], ['Roles de la página', 'historial', 'hi-roles'],
];

function BuscarTodo({ abierto, cerrar, ir, visibles }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  if (!abierto) return null;
  const n = normN(q);
  const xs = [...AREAS.filter(([k]) => visibles[k]).map(([k, t]) => [t, k, '']), ...BUSCABLES.filter((x) => visibles[x[1]])]
    .filter((x) => !n || normN(x[0]).includes(n)).slice(0, 12);
  const elegir = (x) => { if (x) { ir(x[1], x[2], x[3]); setQ(''); setI(0); cerrar(); } };
  const tecla = (e) => {
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(xs.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(xs[i]); }
  };
  return (
    <div className="dz-velo" role="presentation" onClick={cerrar}>
      <div className="dz-buscar" role="dialog" aria-modal="true" aria-label="Buscar en el Dashboard" onClick={(e) => e.stopPropagation()}>
        <label className="dz-bq"><Ico n="buscar" t={18} />
          <input autoFocus value={q} placeholder="Busca un ajuste, un lugar o una acción" onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={tecla} /></label>
        {xs.length ? <ul>{xs.map((x, j) => (
          <li key={x[0] + x[1]}><button type="button" className={j === i ? 'on' : ''} onMouseEnter={() => setI(j)} onClick={() => elegir(x)}>
            <b>{x[0]}</b><small>{(AREAS.find((a) => a[0] === x[1]) || [])[1]}</small></button></li>
        ))}</ul> : <p className="db-tx">Nada con «{q}».</p>}
      </div>
    </div>
  );
}

// 💚 LA SALUD EN UNA FRASE (la maqueta: «Todo anda»), y sólo si algo anda mal, qué. El cupo de escrituras con su ritmo:
// el día de Cloudflare es UTC, así que lo medido se proyecta a las 24 h desde la última medianoche UTC
function proyeccion(q) {
  const w = q && q.kv && q.kv.write;
  if (w == null || !q.cuando) return null;
  const t = Date.parse(q.cuando);
  const h = ((t % 86400000) + 86400000) % 86400000 / 3600000;
  return h >= 1 ? Math.round((w / h) * 24) : null;
}
function saludDe(d, q) {
  const s = d.sistema || {};
  const ult = (d.corridas || [])[0];
  const mal = [];
  if (s.ok === false) mal.push('el lector de anuncios no contesta (los avisos al minuto y el bot en vivo pueden estar quietos)');
  if (ult && ult.estado === 'completed' && ult.fin && ult.fin !== 'success' && ult.fin !== 'skipped') mal.push('la última vuelta del ciclo ' + String(FIN_CORRIDA[ult.fin] || ult.fin).replace(/^\S+\s/, ''));
  if (d.github) mal.push('GitHub anda lento: las vueltas del ciclo pueden atrasarse');
  for (const [, , t] of cuotasEnRojo(q)) mal.push(t.toLowerCase() + ' casi llenas hoy');
  const w = q && q.kv ? q.kv.write : null;
  const p = proyeccion(q);
  const partes = [
    ult ? 'la última vuelta del ciclo: ' + (ult.empezo || ult.creada ? hora(new Date(ult.empezo || ult.creada)) : '—') : '',
    s.vigia ? 'el lector de anuncios leyó ' + hace(s.vigia) : '',
    w != null ? 'escrituras del día: ' + num(w) + ' de 1.000' + (p != null ? (p < 1000 ? ', al ritmo de hoy alcanzan' : ', al ritmo de hoy no alcanzan (~' + num(p) + ')') : '') : '',
  ].filter(Boolean);
  return { ok: !mal.length, mal, partes };
}

// 🕓 «DESDE TU ÚLTIMA VISITA» (la maqueta): lo que pasó mientras no estabas, de lo que el Dashboard ya trae. La última
// visita se guarda en este navegador (`lg:db-visita`): no gasta nada del servidor
const VISITA = 'lg:db-visita';
// ⚠️ UNA VEZ POR CARGA DE LA PÁGINA, no por montaje: la página monta el Dashboard más de una vez al abrirlo (el lazy y el
// respaldo), y el segundo montaje leía la visita que acababa de anotar el primero («desde tu última visita: recién»)
let visitaPrevia = null;
function leerVisita() {
  if (visitaPrevia === null) {
    try { visitaPrevia = Number(localStorage.getItem(VISITA)) || 0; localStorage.setItem(VISITA, String(Date.now())); } catch (e) { visitaPrevia = 0; }
  }
  return visitaPrevia;
}
function desdeVisita(d, prev, logs) {
  if (!prev) return null;
  const xs = [];
  for (const h of d.ajustes_hist || []) if (msDe(h.t) > prev) xs.push([msDe(h.t), (NOMBRE_AJ[h.cual] || h.cual) + ' cambió' + (h.por && h.por !== 'Dlx' ? ' (lo cambió ' + h.por + ')' : ''), 'historial']);
  for (const r of d.reportes || []) if (msDe(r.t) > prev) xs.push([msDe(r.t), 'Un reporte nuevo de la llave #' + r.llave + (r.de ? ', de ' + r.de : ''), 'pendientes', 'llaves']);
  for (const p of d.pedidos || []) if (msDe(p.t) > prev) xs.push([msDe(p.t), 'Un pedido nuevo: ' + (PED_TIPO[p.tipo] || p.tipo).toLowerCase(), 'pendientes', 'pedidos']);
  for (const f of d.fondos || []) if (msDe(f.t) > prev) xs.push([msDe(f.t), 'Un fondo nuevo para revisar', 'pendientes', 'imagenes']);
  for (const c of d.corridas || []) if (msDe(c.creada) > prev && c.fin && c.fin !== 'success' && c.fin !== 'skipped') xs.push([msDe(c.creada), 'Una vuelta del ciclo ' + String(FIN_CORRIDA[c.fin] || c.fin).replace(/^\S+\s/, ''), 'salud']);
  for (const e of d.errores_pag || []) if (msDe(e.primero) > prev) xs.push([msDe(e.primero), 'Un error nuevo en la página: ' + e.donde, 'salud']);
  for (const l of (logs && logs.xs) || []) if (l.nivel === 'rojo' && msDe(l.t) > prev) xs.push([msDe(l.t), 'Logs, en rojo: ' + l.tit, 'salud']);
  return xs.sort((a, b) => b[0] - a[0]).slice(0, 8);
}

// 📅 LO QUE ESTÁ PROGRAMADO O PRENDIDO A MANO (la maqueta), con el área donde se cambia
function programado(aj, liga) {
  const fecha = (t) => { const x = new Date(t); return diaISO(x).slice(8, 10).replace(/^0/, '') + '/' + diaISO(x).slice(5, 7).replace(/^0/, '') + ' a las ' + hora(x); };
  const m = liga.d.mult || {};
  const av = avisoVigente(aj);
  return [
    aj.pase_sorteo ? ['El sorteo del premium', 'cierra el ' + fecha(aj.pase_sorteo.cierra) + ' y se sortea el ' + fecha(aj.pase_sorteo.sorteo), 'web', 'aj-sorteo'] : null,
    av ? ['Aviso en la página', '«' + av.texto.slice(0, 80) + (av.texto.length > 80 ? '…' : '') + '» hasta el ' + fecha(av.hasta), 'web', 'aj-aviso'] : null,
    aj.silencio ? ['Horario de silencio', 'el bot en vivo calla de ' + aj.silencio.desde + ' a ' + aj.silencio.hasta, 'web', 'aj-silencio'] : null,
    aj.multiplicadores && aj.multiplicadores.semana === m.id ? ['El multiplicador de esta semana', 'va a mano, no es el del sorteo', 'servidores', 'sv-cada'] : null,
    aj.campana_pausada ? ['La campana', 'está en pausa: no sale ningún aviso', 'web', 'aj-campana'] : null,
  ].filter(Boolean);
}

// ── 📥 LA BANDEJA (25/10/2026). Dlx, al Dashboard por áreas: «está bien que cambiaste el layout, pero me refería a que
// remakees todo… el diseño me gusta pero faltan las funciones». Las cinco colas eran cinco listas largas una abajo de la
// otra, cada una con sus botones a su manera. Ahora es UNA bandeja, como en la maqueta: a la izquierda todo lo que
// espera, con filtros y buscar; a la derecha el detalle grande y sus botones. Al decidir pasa solo al siguiente.
// ⌨️ En la compu: J y K para moverse, A aprobar y R rechazar (imágenes y videos), / para buscar
// Lo que ya revisó el filtro automático y lo que se resolvió solo quedan abajo, plegado
const TIPO_B = {
  quien: ['¿QUIÉN ES QUIÉN?', 'urg'], llave: ['ERROR EN UNA LLAVE', 'urg'], imagen: ['IMAGEN', 'ojo'], video: ['VIDEO', 'ojo'], pedido: ['PEDIDO', 'ojo'],
};
const SUB_A_FILTRO = { quien: 'quien', llaves: 'llave', imagenes: 'imagen', videos: 'video', pedidos: 'pedido' };
const FILTROS_B = [['', 'Todo'], ['quien', '¿Quién es quién?'], ['llave', 'Llaves'], ['imagen', 'Imágenes'], ['video', 'Videos'], ['pedido', 'Pedidos']];
const linea1 = (s) => String(s || '').split('\n').map((x) => x.trim()).find(Boolean) || '';

// todo lo que espera algo de ti, de las cinco colas, en una sola lista: lo urgente primero y, adentro, lo más nuevo
function itemsBandeja(d, ver) {
  const xs = [];
  const dec = d.decidir || {}, rs = dec.respuestas || {};
  if (ver.quien) for (const p of dec.preguntas || []) if (!rs[p.id]) xs.push({ k: 'q' + p.id, tipo: 'quien', t: msDe(dec.t), titulo: linea1(p.que), sub: p.sec || p.tipo, p });
  if (ver.llave) for (const r of d.reportes || []) if (r.estado === '' || r.estado === 'no_pude') {
    const llave = /^\d+$/.test(r.llave) ? 'Llave #' + r.llave : String(r.llave).startsWith('liga:') ? 'Una liga' : String(r.llave).startsWith('perfil:') ? 'Un perfil' : 'Una llave en vivo';
    xs.push({ k: 'r' + r.id, tipo: 'llave', t: msDe(r.t), titulo: llave + ' · ' + (QUE_REP[r.que] || r.que), sub: r.texto || (r.de ? 'lo mandó ' + r.de : ''), r });
  }
  if (ver.imagen) {
    for (const f of d.fondos || []) xs.push({ k: 'f' + f.quien, tipo: 'imagen', t: msDe(f.t), titulo: 'Fondo de ' + (f.k || 'una cuenta'), sub: 'el filtro no estuvo seguro', img: { cual: 'fondo', f } });
    for (const f of d.fotos_carta || []) xs.push({ k: 'p' + f.quien, tipo: 'imagen', t: msDe(f.t), titulo: 'Foto de tarjeta de ' + (f.k || 'una cuenta'), sub: 'para ' + (f.cartas || []).join(', '), img: { cual: 'foto', f } });
    for (const x of (d.crews_logos || {}).pend || []) xs.push({ k: 'l' + x.id, tipo: 'imagen', t: msDe(x.t), titulo: 'Logo de la crew ' + x.nombre, sub: 'el filtro no estuvo seguro', img: { cual: 'logo', x } });
  }
  if (ver.video) for (const v of d.videos || []) xs.push({ k: 'v' + v[0], tipo: 'video', t: 0, titulo: v[2] || v[3], sub: 'lo reclama ' + limpio(v[1]) + ' · ' + v[4], v });
  if (ver.pedido) for (const p of d.pedidos || []) if (p.estado === '') xs.push({ k: 'd' + p.id, tipo: 'pedido', t: msDe(p.t), titulo: PED_TIPO[p.tipo] || p.tipo, sub: p.k ? 'de ' + p.k : '', ped: p });
  const urg = (x) => (TIPO_B[x.tipo][1] === 'urg' ? 0 : 1);
  return xs.sort((a, b) => urg(a) - urg(b) || b.t - a.t);
}

// 🖼️ una imagen para revisar: aprobar, o no con su motivo (el mismo pedido que hacían las tres cajas de antes)
function DetalleImagen({ it, alCambiar, motivo, setMotivo }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const { cual } = it.img;
  const decidir = async (si) => {
    setOcup(true); setMsg('');
    try {
      let r, j;
      if (cual === 'logo') {
        const x = it.img.x;
        r = await fetch('/api/avisos/dueno/crew', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ que: 'logo', crew: x.id, url: x.url, si, motivo: si ? '' : motivo }) });
        j = await r.json().catch(() => ({}));
        if (j.error === 'cambio') throw new Error('el logo cambió mientras lo mirabas: recarga');
        if (!r.ok || j.error) throw new Error(j.error || String(r.status));
        alCambiar({ crews_logos: { pend: [], vistos: [] }, _sacarLogo: x.id });
      } else {
        const f = it.img.f;
        r = await fetch(cual === 'foto' ? '/api/avisos/dueno/foto-carta' : '/api/avisos/dueno/fondo', { method: 'POST', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quien: f.quien, si, motivo: si ? '' : motivo }) });
        j = await r.json().catch(() => ({}));
        if (!r.ok || j.error) throw new Error(j.error || String(r.status));
        const o = {};
        if (j.fondos) o.fondos = j.fondos;
        if (j.fotos_carta) o.fotos_carta = j.fotos_carta;
        if (j.filtro) o.filtro = j.filtro;
        alCambiar(o);
      }
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  const f = it.img.f, x = it.img.x;
  return (
    <>
      {cual === 'logo' ? <img className="dz-img logo" src={x.url} alt={'El logo de ' + x.nombre} />
        : <div className={'dz-img ' + cual} style={{ backgroundImage: (cual === 'foto' ? urlFoto(f.pend) : urlFondo(f.pend)) || 'none' }} role="img" aria-label="La imagen que subió" />}
      <p className="dz-dt-tx">No se ve en la página hasta que la apruebes. Si no, a quien la subió le llega a su campana con el motivo.
        {f && f.k ? <> · <a href={'#/r/' + f.k}>su perfil</a></> : x ? <> · <a href={'#/crew/' + encodeURIComponent(x.id)}>la crew</a></> : null}</p>
      <div className="dz-acc">
        <button type="button" className="btn verde" disabled={ocup} onClick={() => decidir(true)}>Aprobar <kbd>A</kbd></button>
        <select className="db-sel db-sel-corto" value={motivo} aria-label="El motivo si no" onChange={(e) => setMotivo(e.target.value)}>
          {MOTIVOS_FONDO.map((m) => <option key={m}>{m}</option>)}</select>
        <button type="button" className="btn borde2" disabled={ocup} onClick={() => decidir(false)}>No <kbd>R</kbd></button>
      </div>
      {msg ? <p className="dz-dt-msg" role="status">{msg}</p> : null}
    </>
  );
}

// 🎬 un video que alguien reclama
function DetalleVideo({ it, alCambiar }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const [id, raw, tit, url, motivo, resp] = it.v;
  const decidir = async (si) => {
    setOcup(true); setMsg('');
    try {
      const r = await fetch('/api/avisos/dueno/video', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, si }) });
      if (!r.ok) throw new Error(String(r.status));
      alCambiar({ _sacarVideo: id });
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  return (
    <>
      <p className="dz-dt-tx"><b>{limpio(raw)}</b> dice que este video es suyo. No entró solo porque: <b>{motivo}</b>.</p>
      <a className="dz-video" href={url} target="_blank" rel="noopener noreferrer"><Ico n="flecha" t={14} /> {tit || url}</a>
      {resp ? <p className="dz-dt-tx">Dice que aparece como <b>«{limpio(resp.nombre)}»</b>, en el <b>{resp.minuto}</b>. Cómo reconocerlo: {limpio(resp.como)}</p> : null}
      <div className="dz-acc">
        <button type="button" className="btn verde" disabled={ocup} onClick={() => decidir(true)}>Es suyo <kbd>A</kbd></button>
        <button type="button" className="btn borde2" disabled={ocup} onClick={() => decidir(false)}>No es suyo <kbd>R</kbd></button>
      </div>
      <p className="dz-dt-tx">Lo aplica el ciclo en su próxima vuelta.</p>
      {msg ? <p className="dz-dt-msg" role="status">{msg}</p> : null}
    </>
  );
}

// 🔎 POR QUÉ SE CIERRA UN REPORTE (25/10/2026, el research: el motivo de cierre de Battlefy). La misma lista que
// `CAUSAS_REPORTE` de bot/avisos.js: cerrar pide una, y el Dashboard cuenta cuál falla más (`CausasLinea`)
const CAUSAS = [['nombre_bot', 'El bot leyó mal un nombre', 'nombres mal leídos'], ['llave_bot', 'El bot leyó mal la llave', 'llaves mal leídas'],
  ['organizador', 'Se equivocó el organizador', 'del organizador'], ['no_corresponde', 'Estaba bien', 'estaban bien'], ['prueba', 'Era una prueba', 'pruebas']];
// «qué falla más», en una línea: los últimos 30 días, de más a menos (sin quién: sólo cuántos)
function CausasLinea({ cs }) {
  const xs = (cs || []).filter((c) => c.n30 && c.causa !== 'prueba').sort((a, b) => b.n30 - a.n30);
  if (!xs.length) return null;
  return (
    <p className="dz-causas"><b>Qué falló en 30 días:</b> {xs.map((c, i) => (
      <span key={c.causa} className={i ? '' : 'top'}>{num(c.n30)} {(CAUSAS.find((x) => x[0] === c.causa) || [0, 0, c.causa])[2]}</span>
    ))}</p>
  );
}

// 📣 un error en una llave: lo que dice, la evidencia del bot y corregir ahí mismo
function DetalleLlave({ it, liga, d, alCambiar, corrige }) {
  const r = it.r;
  const [abierto, setAbierto] = useState(false);
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  const setLista = (l) => alCambiar({ reportes: l });
  // cerrar sin corregir: con su causa, que vuelve al conteo
  const cerrar = async (accion, causa) => {
    setOcup(true); setMsg('');
    try {
      const rq = await fetch('/api/avisos/dueno/reporte', { method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id, accion, causa }) });
      const j = await rq.json().catch(() => ({}));
      if (!rq.ok || j.error) throw new Error(rq.status === 401 ? 'la sesión venció: entra de nuevo' : j.error || String(rq.status));
      alCambiar(Object.assign({ reportes: j.reportes || [] }, j.reportes_causas ? { reportes_causas: j.reportes_causas } : {}));
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  const hermanos = (d.reportes || []).filter((x) => x.id !== r.id && x.llave === r.llave && (x.estado === '' || x.estado === 'no_pude'));
  const enlace = /^\d+$/.test(r.llave) ? '#/llave/' + r.llave : String(r.llave).startsWith('liga:') ? '#/ligas/' + encodeURIComponent(String(r.llave).slice(5))
    : String(r.llave).startsWith('perfil:') ? '#/r/' + encodeURIComponent(String(r.llave).slice(7)) : '';
  return (
    <>
      {r.texto ? <blockquote className="dz-cita">«{r.texto}»</blockquote> : null}
      <p className="dz-dt-tx">{r.batalla ? r.batalla + ' · ' : ''}{r.evid && r.evid.quien ? 'lo mandó ' + r.evid.quien : r.de ? 'lo mandó ' + r.de : 'quién lo mandó: lo dice el ciclo en su próxima vuelta'}
        {enlace ? <> · <a href={enlace}>abrirla</a></> : null}{r.estado === 'no_pude' && r.resultado ? <> · <b className="db-mal">no se pudo: {r.resultado}</b></> : null}</p>
      {r.evid && (r.evid.lineas || []).length > 1 ? <Evidencia r={r} alListo={setLista} corrige={corrige} /> : null}
      {abierto ? (String(r.llave).startsWith('liga:') ? <CorregirLiga r={r} liga={liga} alListo={setLista} />
        : <Corregir r={r} liga={liga} alListo={setLista} hermanos={hermanos} />) : null}
      <div className="dz-acc">
        {corrige && !abierto && (/^\d+$/.test(r.llave) || String(r.llave).startsWith('liga:')) ? <button type="button" className="btn verde" onClick={() => setAbierto(true)}>Corregir</button> : null}
      </div>
      {/* cerrarlo sin corregir dice por qué: es lo que arma «qué falló» */}
      <div className="dz-cerrar" role="group" aria-label="Cerrarlo sin corregir: por qué">
        <span>Cerrarlo sin corregir, porque…</span>
        {CAUSAS.map(([c, t]) => (
          <button key={c} type="button" className="btn borde2 chico" disabled={ocup} onClick={() => cerrar(c === 'prueba' ? 'prueba' : 'listo', c)}>{t}</button>
        ))}
      </div>
      {msg ? <p className="dz-dt-msg" role="status">{msg}</p> : null}
    </>
  );
}

// 🙋 un pedido: lo que pide, lo que el bot vio de las dos cuentas y Sí / No (el mismo pedido que la lista de antes)
function DetallePedido({ p, liga, alCambiar }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const f = p.k ? liga.T[p.k] : null;
  const pr = p.prueba || {};
  const resolver = (si) => {
    setOcup(true); setMsg('');
    fetch('/api/avisos/dueno-pedido', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, si }) })
      .then(async (r) => ({ r, j: await r.json().catch(() => ({})) }))
      .then(({ r, j }) => { if (r.ok && j.pedidos) alCambiar(j.pedidos); else { setOcup(false); setMsg(j.error === 'no' ? 'No tienes permiso.' : 'No pude: ' + (j.error || r.status)); } })
      .catch(() => { setOcup(false); setMsg('No pude: la red.'); });
  };
  const filas = [
    ['Quién', f ? <a key="q" href={'#/r/' + p.k}>{limpio(f.n)}</a> : p.k || '—'],
    p.cc ? ['País que pide', p.cc.toUpperCase()] : null,
    p.tipo === 'cuenta' ? ['La cuenta que pide', <Fragment key="c">{pr.usuario ? '@' + pr.usuario : 'sin nombre'}{pr.creada ? ' · creada el ' + pr.creada : ''} · {pr.en_dra === false ? 'no está en DRA'
      : 'en DRA' + (pr.apodo_dra ? ' como «' + pr.apodo_dra + '»' : '') + (pr.miembro ? ', con el Miembro' : ', sin el Miembro')}</Fragment>] : null,
    p.vid ? ['El video', <a key="v" href={'https://youtu.be/' + p.vid} target="_blank" rel="noopener noreferrer">abrirlo ↗</a>] : null,
  ].filter(Boolean);
  return (
    <>
      {p.texto ? <blockquote className="dz-cita">«{p.texto}»</blockquote> : null}
      <dl className="dz-dl">{filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {p.tipo === 'cuenta' ? <Vieja v={pr.vieja} /> : null}
      <div className="dz-acc">
        <button type="button" className="btn verde" disabled={ocup} onClick={() => resolver(true)}>{PED_SI[p.tipo] || 'Sí'}</button>
        <button type="button" className="btn borde2" disabled={ocup} onClick={() => resolver(false)}>No</button>
      </div>
      <p className="dz-dt-tx">{p.tipo === 'identidad' ? 'Éste lo arreglas tú: «Ya lo arreglé» es para cuando está hecho.' : p.tipo === 'video' ? 'El video se saca solo.' : 'Lo aplica el ciclo en su próxima vuelta.'}</p>
      {msg ? <p className="dz-dt-msg" role="alert">{msg}</p> : null}
    </>
  );
}

// ❓ una pregunta de ✅ Decidir, con la llave al lado
function DetalleQuien({ it, d, alCambiar }) {
  const p = it.p;
  return (
    <div className="db-dec-cuerpo dz-quien">
      <ul className="dz-solo"><Pregunta p={p} r={null} alListo={(y) => alCambiar({ decidir: y })} /></ul>
      <LlaveAlCostado s={{ sec: p.sec, ps: [p] }} />
    </div>
  );
}

// 💤 POSPONER «HASTA QUE CAMBIE» (25/10/2026, el research: Linear y Sentry). Un caso pospuesto se va de la lista hasta
// que cambia lo que dice (su firma: la llave que vuelve con un nombre nuevo, un fondo nuevo, otra respuesta) o hasta 24
// horas, lo que pase primero. Es de cada uno: vive en este navegador (`lg:db-pospuesto`), y nunca borra nada
const POSP = 'lg:db-pospuesto';
const firmaDe = (x) => JSON.stringify([x.titulo, x.sub, x.r && [x.r.estado, x.r.texto, x.r.evid && (x.r.evid.lineas || []).length],
  x.p && x.p.opciones, x.img && (x.img.f ? x.img.f.pend : x.img.x && x.img.x.url), x.ped && x.ped.estado]);
const leerPosp = () => { try { return JSON.parse(localStorage.getItem(POSP) || '{}') || {}; } catch (e) { return {}; } };
// la clave de un caso para «lo está viendo»: la misma de la bandeja, sin lo que el Worker no guarda
const kViendo = (k) => String(k).replace(/[^0-9A-Za-z:_.-]/g, '_').slice(0, 80);
// ⏳ la edad de un caso: un día ya es para mirar, tres es viejo
const edadDe = (t) => (!t ? '' : Date.now() - t > 3 * 864e5 ? 'mal' : Date.now() - t > 864e5 ? 'ojo' : '');

function Bandeja({ d, liga, ve, cambiarD, sub }) {
  const ver = { quien: ve('decidir'), llave: ve('reportes') || ve('reportes_cerrar'), imagen: ve('fondos'), video: ve('videos') || ve('fondos'), pedido: ve('reportes_cerrar') };
  // el cuadrado del Resumen que se tocó abre la bandeja con su filtro puesto
  const [filtro, setFiltro] = useState(SUB_A_FILTRO[sub] || '');
  useEffect(() => { if (sub) { setFiltro(SUB_A_FILTRO[sub] || ''); setSel(''); } }, [sub]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS_FONDO[0]);
  const [listaDec, setListaDec] = useState(false);
  const det = useRef(null), buscar = useRef(null);
  // lo sacado a mano (un logo, un video): el servidor no devuelve la lista entera de esos
  const [fuera, setFuera] = useState({});
  const [posp, setPosp0] = useState(leerPosp);
  const setPosp = (o) => { setPosp0(o); try { localStorage.setItem(POSP, JSON.stringify(o)); } catch (e) { /* vuelve al recargar */ } };
  const todos0 = itemsBandeja(d, ver).filter((x) => !fuera[x.k]);
  // lo pospuesto sigue pospuesto mientras no cambie y no pasen 24 h
  const dormido = (x) => { const p0 = posp[x.k]; return !!p0 && p0.f === firmaDe(x) && Date.now() < p0.hasta; };
  const todos = todos0.filter((x) => !dormido(x));
  const pospuestos = todos0.filter(dormido);
  const cuenta = {};
  for (const x of todos) cuenta[x.tipo] = (cuenta[x.tipo] || 0) + 1;
  const xs = (filtro === 'posp' ? pospuestos : todos).filter((x) => (!filtro || filtro === 'posp' || x.tipo === filtro) && contiene([x.titulo, x.sub], q));
  const viejo = todos.reduce((m, x) => (x.t && (!m || x.t < m) ? x.t : m), 0);
  const i0 = Math.max(0, xs.findIndex((x) => x.k === sel));
  const it = xs[i0] || null;
  // 👀 «LO ESTÁ VIENDO» (25/10/2026, el research: Battlefy y Help Scout): el caso que tienes abierto se anota en el
  // objeto, y cada 30 s se lee lo que tienen abierto los demás. Un caso por persona; vence a los 10 minutos
  const [viendo, setViendo] = useState([]);
  const kAbierto = it ? kViendo(it.k) : '';
  useEffect(() => {
    let vivo = true;
    const avisar = () => fetch('/api/avisos/dueno/viendo', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ k: kAbierto }) }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j && j.viendo) setViendo(j.viendo); }).catch(() => {});
    avisar();
    const id = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') avisar(); }, 30000);
    return () => { vivo = false; clearInterval(id); };
  }, [kAbierto]);
  const quienVe = (x) => (viendo.find((v) => v.k === kViendo(x.k)) || {}).por;
  const posponer = (x) => {
    const sig = xs[i0 + 1] || xs[i0 - 1];
    setPosp(Object.assign({}, Object.fromEntries(Object.entries(posp).filter(([, v]) => Date.now() < v.hasta)), { [x.k]: { f: firmaDe(x), hasta: Date.now() + 864e5 } }));
    setSel(sig ? sig.k : '');
  };
  const despertar = (x) => { const o = Object.assign({}, posp); delete o[x.k]; setPosp(o); };
  // decidir uno: vuelve lo nuevo al panel, y el siguiente queda elegido (el que ocupa su lugar)
  const alCambiar = (o) => {
    const sig = xs[i0 + 1] || xs[i0 - 1];
    if (o._sacarLogo) setFuera((f) => Object.assign({}, f, { ['l' + o._sacarLogo]: 1 }));
    if (o._sacarVideo != null) setFuera((f) => Object.assign({}, f, { ['v' + o._sacarVideo]: 1 }));
    const limpio0 = Object.assign({}, o); delete limpio0._sacarLogo; delete limpio0._sacarVideo; delete limpio0.crews_logos;
    if (Object.keys(limpio0).length) cambiarD(limpio0);
    setSel(sig ? sig.k : '');
  };
  // ⌨️ J/K, A/R y /
  useEffect(() => {
    const f = (e) => {
      const tg = e.target && e.target.tagName;
      if (e.ctrlKey || e.metaKey || e.altKey || tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'j' || k === 'k') { const n = xs[i0 + (k === 'j' ? 1 : -1)]; if (n) { e.preventDefault(); setSel(n.k); } }
      else if (k === '/') { e.preventDefault(); if (buscar.current) buscar.current.focus(); }
      else if (k === 'h' && it && filtro !== 'posp') { e.preventDefault(); posponer(it); }
      else if ((k === 'a' || k === 'r') && it && (it.tipo === 'imagen' || it.tipo === 'video')) {
        const b = det.current && det.current.querySelectorAll('.dz-acc .btn')[k === 'a' ? 0 : 1];
        if (b && !b.disabled) { e.preventDefault(); b.click(); }
      }
    };
    W.addEventListener && W.addEventListener('keydown', f);
    return () => { W.removeEventListener && W.removeEventListener('keydown', f); };
  });
  const elegir = (x) => {
    setSel(x.k);
    // en el teléfono el detalle va abajo: se baja hasta él
    if (W.innerWidth < 900 && det.current) setTimeout(() => det.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const vivos = (d.filtro && d.filtro.vivos) || [];
  const clv = (d.crews_logos || {}).vistos || [];
  return (
    <div className="dz-band">
      <div className="dz-band-f">
        <div className="dz-subs" role="tablist" aria-label="Qué mirar">{FILTROS_B.filter(([k]) => !k || ver[k]).map(([k, t]) => (
          <button key={k || 'todo'} type="button" role="tab" aria-selected={filtro === k} className={'dz-sub' + (filtro === k ? ' on' : '')}
            onClick={() => { setFiltro(k); setSel(''); setListaDec(false); }}>{t}{(k ? cuenta[k] : todos.length) ? <i>{k ? cuenta[k] : todos.length}</i> : null}</button>
        ))}{pospuestos.length ? <button type="button" role="tab" aria-selected={filtro === 'posp'} className={'dz-sub dz-sub-posp' + (filtro === 'posp' ? ' on' : '')}
          onClick={() => { setFiltro('posp'); setSel(''); setListaDec(false); }}>💤 Pospuestos<i>{pospuestos.length}</i></button> : null}</div>
        <label className="db-buscar dz-band-q"><Ico n="buscar" t={16} />
          <input ref={buscar} type="search" value={q} placeholder="Buscar un nombre o una llave ( / )" aria-label="Buscar en los pendientes" onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      {viejo || (d.reportes_causas || []).length ? (
        <div className="dz-band-meta">
          {viejo ? <p className={'dz-viejo ' + edadDe(viejo)}>El caso más viejo espera desde <b>{hace(viejo)}</b>.</p> : null}
          <CausasLinea cs={d.reportes_causas} />
        </div>
      ) : null}
      {filtro === 'quien' && listaDec ? (
        <><button type="button" className="dz-lnk" onClick={() => setListaDec(false)}>← Volver a la bandeja</button>
          <Decisiones dec={d.decidir} liga={liga} alCambiar={(y) => cambiarD({ decidir: y })} /></>
      ) : !todos.length && filtro !== 'posp' ? (
        <div className="dz-vacio"><b>✓ Al día</b><span>No hay nada esperando una decisión tuya.</span></div>
      ) : (
        <div className="dz-band-g">
          <ol className="dz-band-l" aria-label="Lo que espera">{xs.map((x) => (
            <li key={x.k}><button type="button" className={'dz-it' + (it && x.k === it.k ? ' on' : '')} aria-current={it && x.k === it.k ? 'true' : undefined} onClick={() => elegir(x)}>
              <span className={'dz-tipo ' + TIPO_B[x.tipo][1]}>{TIPO_B[x.tipo][0]}</span>
              <b>{x.titulo}</b>
              {x.sub ? <small>{x.sub}</small> : null}
              {x.t ? <small className={'dz-it-t ' + edadDe(x.t)}>{hace(x.t)}{edadDe(x.t) === 'mal' ? ' · VIEJO' : ''}</small> : null}
              {quienVe(x) ? <small className="dz-it-ve">👀 {quienVe(x)} lo está viendo</small> : null}
            </button></li>
          ))}{!xs.length ? <li className="dz-it-nada">Nada con este filtro{q ? ' y «' + q + '»' : ''}.</li> : null}</ol>
          <article className="dz-det" ref={det} aria-live="polite">
            {it ? <>
              <span className={'dz-tipo ' + TIPO_B[it.tipo][1]}>{TIPO_B[it.tipo][0]} · {i0 + 1} DE {xs.length}</span>
              <h3 className="dz-det-t">{it.titulo}</h3>
              {quienVe(it) ? <p className="dz-ve">👀 <b>{quienVe(it)}</b> también lo tiene abierto: fíjate antes de decidir para no hacerlo dos veces.</p> : null}
              {it.tipo === 'quien' ? <DetalleQuien key={it.k} it={it} d={d} alCambiar={alCambiar} /> : null}
              {it.tipo === 'llave' ? <DetalleLlave key={it.k} it={it} liga={liga} d={d} alCambiar={alCambiar} corrige={ve('reportes')} /> : null}
              {it.tipo === 'imagen' ? <DetalleImagen key={it.k} it={it} alCambiar={alCambiar} motivo={motivo} setMotivo={setMotivo} /> : null}
              {it.tipo === 'video' ? <DetalleVideo key={it.k} it={it} alCambiar={alCambiar} /> : null}
              {it.tipo === 'pedido' ? <DetallePedido key={it.k} p={it.ped} liga={liga} alCambiar={(y) => alCambiar({ pedidos: y })} /> : null}
              <div className="dz-acc dz-acc-pos">{filtro === 'posp'
                ? <button type="button" className="dz-lnk" onClick={() => despertar(it)}>Devolverlo a la lista</button>
                : <button type="button" className="dz-lnk" onClick={() => posponer(it)}>💤 Posponer hasta que cambie (o 24 h)</button>}</div>
              <p className="dz-teclas">J / K para moverte · A aprobar · R rechazar · H posponer · / buscar</p>
            </> : <p className="db-tx">Elige algo de la lista.</p>}
          </article>
        </div>
      )}
      {filtro === 'quien' && !listaDec && (d.decidir || {}).preguntas && d.decidir.preguntas.length ? (
        <button type="button" className="dz-lnk" onClick={() => setListaDec(true)}>Ver todas las preguntas juntas (con filtros y para contestar varias a la vez)</button>
      ) : null}
      {/* lo que ya pasó por el filtro automático o se resolvió solo: para quitar o deshacer, plegado */}
      {(vivos.length || clv.length || ((d.decidir || {}).solas || []).length) ? (
        <details className="dz-plegado">
          <summary>Lo que ya se ve o se resolvió solo · {vivos.length + clv.length + ((d.decidir || {}).solas || []).length}</summary>
          <div className="db-llego">
            {vivos.length ? <FondosRevisar fs={[]} fcs={[]} filtro={d.filtro} alCambiar={(fs) => cambiarD({ fondos: fs })} alFiltro={(fl) => cambiarD({ filtro: fl })} alFotos={(x) => cambiarD({ fotos_carta: x })} /> : null}
            {clv.length ? <LogosCrews cl={{ pend: [], vistos: clv }} /> : null}
          </div>
          {((d.decidir || {}).solas || []).length ? <Solas x={d.decidir} alListo={(y) => cambiarD({ decidir: y })} /> : null}
        </details>
      ) : null}
    </div>
  );
}

// ── 🏟️ LOS SERVIDORES, EN UNA TABLA (la maqueta: «todo lo de cada servidor en una fila: se cambia ahí mismo»). Eran
// tarjetas sueltas con seis selectores cada una, y el tier y el dueño vivían en otra pestaña. Ahora una fila por servidor
// —tier, multiplicador, bot en vivo, cuánto habla, apuestas, aviso de cada evento y eventos de Discord— y «Ficha» abre
// debajo lo que mide el puntaje, lo que recibe y quién es su dueño. Guardan lo mismo que guardaban las tarjetas
function ServidoresTabla({ liga, aj, hacer, ocup, chat, T }) {
  const [ficha, setFicha] = useState('');
  const fichaRef = useRef(null);
  const c = chat || {};
  const tiersT = (T && T.servidores) || [];
  const svs = [...new Set([...svsDe(chat, aj), ...tiersT.map((x) => x.sv)])];
  if (!svs.length) return <p className="db-tx">Todavía no sé el chat general de ningún servidor: lo busca el lector de anuncios en su próxima vuelta.</p>;
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
  const man = aj.multiplicadores && aj.multiplicadores.semana === m.id ? aj.multiplicadores.sv || {} : null;
  const ref = Object.assign({}, m.sv || {}, man || {});
  const elegidos = aj.tiers || {};
  const tierDe = (sv) => { const x = tiersT.find((y) => y.sv === sv); return elegidos[sv] || (x && x.tier) || 0; };
  const YA = 'Guardado: vale desde el próximo minuto.';
  const cambiar = (cual, obj, sv, v) => { const n = Object.assign({}, obj); if (v === '') delete n[sv]; else n[sv] = v; return hacer(cual, n, siglaDe(sv) + ': ' + YA); };
  const cambiarAp = (sv, v) => {
    const ag = Object.assign({}, apBase.apagadas), pr = Object.assign({}, apBase.prendidas);
    delete ag[sv]; delete pr[sv];
    if (v === 'no') ag[sv] = true; else if (v === 'si') pr[sv] = true;
    return hacer('apuestas', Object.assign({}, apBase, { apagadas: ag, prendidas: pr }), siglaDe(sv) + ': vale para la próxima apuesta.');
  };
  const cambiarAviso = (sv, v) => { const n = Object.assign({}, porSv); if (v) n[sv] = v; else delete n[sv]; return hacer('aviso_evento', { sv: n, resto: ae.resto || '' }, siglaDe(sv) + ': vale desde el próximo evento.'); };
  const cambiarMult = (sv, x) => hacer('multiplicadores', { semana: m.id, sv: Object.assign({}, ref, { [sv]: x }) }, siglaDe(sv) + ' pasa a ' + mult(x) + ': entra en la próxima vuelta del ciclo.');
  const cambiarTier = (sv, t) => hacer('tiers', Object.assign({}, elegidos, { [sv]: t }),
    siglaDe(sv) + ' pasa a Tier ' + t + (t === 1 ? ': vuelve a sumar al ranking.' : ': sus llaves dejan de sumar.'));
  const xFicha = tiersT.find((y) => y.sv === ficha);
  return (
    <div className="dz-svt">
      {m.id ? (
        <div className="dz-svt-c">
          <span className={'db-est' + (man ? ' ojo' : '')}>{man ? '✍ El multiplicador de esta semana va a mano' : 'El multiplicador de esta semana salió del sorteo del lunes'}</span>
          {man ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para volver al sorteo"
            onClick={() => hacer('multiplicadores', null, 'Vuelve el sorteo en la próxima vuelta del ciclo.')}>Volver al sorteo</DosToques> : null}
        </div>
      ) : null}
      <div className="dz-tabla">
        <table>
          <thead><tr>
            <th scope="col">Servidor</th><th scope="col">Tier</th>{m.id ? <th scope="col">Multiplicador</th> : null}<th scope="col">Bot en vivo</th>
            <th scope="col">Cuánto habla</th><th scope="col">Apuestas</th><th scope="col">Aviso de evento</th><th scope="col">Eventos Discord</th><th scope="col"><span className="rk-sr">Ficha</span></th>
          </tr></thead>
          <tbody>{svs.map((sv) => {
            const vm = ref[sv] == null ? 1 : ref[sv];
            const ops = FACTORES.indexOf(vm) < 0 ? [...FACTORES, vm].sort((a, b) => a - b) : FACTORES;
            const evd = (c.evd || {})[sv];
            const t = tierDe(sv);
            return (
              <Fragment key={sv}>
                <tr className={ficha === sv ? 'on' : ''}>
                  <th scope="row"><span className="dz-svt-n"><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b><i className={prendido(sv) ? 'ok' : ''} title={prendido(sv) ? 'el bot habla ahí' : 'el bot no habla ahí'} /></span></th>
                  <td><select aria-label={'El tier de ' + siglaDe(sv)} value={t ? String(t) : ''} disabled={ocup} onChange={(e) => cambiarTier(sv, Number(e.target.value))}>
                    {!t ? <option value="">—</option> : null}{[1, 2, 3].map((n) => <option key={n} value={String(n)}>Tier {n}</option>)}</select></td>
                  {m.id ? <td><select aria-label={'El multiplicador de ' + siglaDe(sv)} value={String(vm)} disabled={ocup} onChange={(e) => cambiarMult(sv, Number(e.target.value))}>
                    {ops.map((x) => <option key={x} value={String(x)}>{mult(x)}</option>)}</select></td> : null}
                  <td><select aria-label={'El bot en vivo en ' + siglaDe(sv)} value={dash[sv] === true ? 'si' : dash[sv] === false ? 'no' : ''} disabled={ocup}
                    onChange={(e) => cambiar('en_vivo', dash, sv, e.target.value === '' ? '' : e.target.value === 'si')}>
                    <option value="">{admin[sv] ? 'Admin: sí' : 'Admin: no'}</option><option value="si">Prendido</option><option value="no">Apagado</option></select></td>
                  <td><select aria-label={'Cuánto habla el bot en ' + siglaDe(sv)} value={niveles[dashNivel[sv]] ? dashNivel[sv] : ''} disabled={ocup || !prendido(sv)}
                    onChange={(e) => cambiar('en_vivo_nivel', dashNivel, sv, e.target.value)}>
                    <option value="">{'Admin: ' + ((niveles[nivelAdmin(sv)] || ['normal'])[0]).toLowerCase()}</option>
                    {Object.keys(niveles).map((k) => <option key={k} value={k}>{niveles[k][0]}</option>)}</select></td>
                  <td><select aria-label={'Las apuestas en ' + siglaDe(sv)} value={apDe(sv)} disabled={ocup} onChange={(e) => cambiarAp(sv, e.target.value)}>
                    <option value="">Sólo «A full»</option><option value="si">Siempre</option><option value="no">Apagadas</option></select></td>
                  <td><select aria-label={'El aviso de cada evento en ' + siglaDe(sv)} value={porSv[sv] || ''} disabled={ocup} onChange={(e) => cambiarAviso(sv, e.target.value)}>
                    <option value="">Donde habla</option><option value="chat">Chat general</option><option value="no">Apagado</option></select></td>
                  <td><select aria-label={'Los eventos de Discord de ' + siglaDe(sv)} value={(aj.eventos_discord || {})[sv] === true ? 'si' : ''} disabled={ocup}
                    onChange={(e) => cambiar('eventos_discord', aj.eventos_discord || {}, sv, e.target.value === 'si' ? true : '')}>
                    <option value="">Apagados</option><option value="si">Prendidos</option></select>
                    {evd ? <small className={evd.error ? 'db-mal' : ''}>{(evd.creados || 0) + ' en 7 días' + (evd.error === 'permiso' ? ' · falta permiso' : evd.error ? ' · ' + evd.error : '')}</small> : null}</td>
                  <td><button type="button" className="dz-lnk" aria-expanded={ficha === sv} disabled={!tiersT.some((y) => y.sv === sv)}
                    onClick={() => {
                      setFicha(ficha === sv ? '' : sv);
                      if (ficha !== sv) setTimeout(() => { if (fichaRef.current) fichaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60);
                    }}>{ficha === sv ? 'Cerrar' : 'Ficha'}</button></td>
                </tr>
              </Fragment>
            );
          })}</tbody>
        </table>
      </div>
      {/* la ficha va abajo de la tabla y no adentro: adentro heredaba el ancho de las nueve columnas y quedaba corrida de costado */}
      {ficha && xFicha ? (
        <div className="dz-svt-ficha" ref={fichaRef}>
          <div className="dz-svt-c"><b>La ficha de {siglaDe(ficha)}</b><button type="button" className="dz-lnk" onClick={() => setFicha('')}>Cerrar</button></div>
          <TierCaja x={xFicha} liga={liga} tier={tierDe(ficha) || 1} cambiar={cambiarTier} ocup={ocup} i={0} aj={aj} hacer={hacer} />
        </div>
      ) : null}
      <p className="db-tx">El punto al lado de la sigla es verde si el bot habla en su chat. Tier 1 suma al ranking; Tier 2 sale en el calendario y la campana, sin sumar; Tier 3 tiene su página y sus ligas.</p>
    </div>
  );
}

// ── 🎛️ LA PÁGINA Y EL BOT, EN FILAS (25/10/2026, la maqueta: «cada ajuste en una fila: qué hace en una línea, cómo está
// hoy y su control»). Eran once cajas con su título, un párrafo largo y el formulario abierto, todas iguales de altas:
// para saber cómo estaba algo había que leerlas enteras. Ahora la fila dice cómo está; «Cambiar» abre el formulario de
// siempre debajo (el mismo componente, sin su cabecera). Lo de un toque —pausar la campana— se hace en la fila misma
const corte = (s, n) => (String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || ''));
function Fila({ id, t, que, val, tono, abierta, alAbrir, accion, children }) {
  return (
    <li className={'dz-fila' + (abierta ? ' on' : '')} id={id}>
      <div className="dz-fila-c">
        <div className="dz-fila-t"><b>{t}</b><small>{que}</small></div>
        <span className={'dz-fila-v' + (tono ? ' ' + tono : '')}>{val}</span>
        <div className="dz-fila-a">
          {accion}
          {children ? <button type="button" className="btn borde2 chico" aria-expanded={!!abierta} onClick={alAbrir}>{abierta ? 'Cerrar' : 'Cambiar'}</button> : null}
        </div>
      </div>
      {abierta && children ? <div className="dz-fila-ed">{children}</div> : null}
    </li>
  );
}

function AjustesFilas({ liga, aj, hacer, ocup, chat, ir, abrir }) {
  const [ab, setAb] = useState(abrir || '');
  useEffect(() => { if (abrir) setAb(abrir); }, [abrir]);
  const f = (id) => ({ id, abierta: ab === id, alAbrir: () => setAb(ab === id ? '' : id) });
  const c = chat || {};
  const p = !!aj.campana_pausada;
  const vig = avisoVigente(aj);
  const nv = NIVELES_AVISO[aj.avisos_nivel] ? aj.avisos_nivel : 'normal';
  const dash = aj.en_vivo || {}, admin = c.admin || {};
  const svs = svsDe(chat, aj);
  const prendidos = svs.filter((sv) => dash[sv] !== false && (!!admin[sv] || dash[sv] === true)).length;
  const defR = (c.def || {}).ritmo || DEF_RIT, r = aj.ritmo || null;
  const s = aj.silencio || null;
  const defA = (c.def || {}).apuestas || DEF_AP, a = aj.apuestas || null;
  const S = aj.pase_sorteo || null;
  const ms = aj.mes_sacar || null;
  const promos = (aj.promos_mano || []).length;
  return (
    <div className="dz-filas">
      <h3 className="dz-h">Avisos</h3>
      <ul>
        <Fila {...f('aj-campana')} t="La campana" que="Avisa a los celulares cuando un servidor anuncia un evento."
          val={p ? '⏸ En pausa' : '● Suena'} tono={p ? 'ojo' : 'ok'}
          accion={p ? <button type="button" className="btn verde chico" disabled={ocup} onClick={() => hacer('campana_pausada', false, 'La campana vuelve a sonar.')}>Reanudar</button>
            : <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para pausar" onClick={() => hacer('campana_pausada', true, 'La campana quedó en pausa.')}>Pausar</DosToques>} />
        <Fila {...f('aj-aviso')} t="Aviso en la página" que="Un mensaje arriba de todas las páginas, hasta la hora que elijas."
          val={vig ? '«' + corte(vig.texto, 34) + '» · hasta ' + liga.dia(vig.hasta) : 'Ninguno'} tono={vig ? 'ojo' : ''}>
          <AjAviso liga={liga} aj={aj} hacer={hacer} ocup={ocup} /></Fila>
        <Fila {...f('aj-avisos')} t="El aviso de cada evento" que="Lo que cuenta el bot en el chat cuando el ciclo carga un evento."
          val={NIVELES_AVISO[nv][0]} tono="ok">
          <AjAvisos liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general /></Fila>
      </ul>
      <h3 className="dz-h">El bot en vivo</h3>
      <ul>
        <Fila id="aj-vivo" t="El bot en vivo" que="Cuenta en el chat cómo va un evento. Se prende servidor por servidor."
          val={prendidos + ' de ' + svs.length + ' servidores'} tono={prendidos ? 'ok' : ''}
          accion={<button type="button" className="btn borde2 chico" onClick={() => ir('servidores', 'sv-cada')}>Ir a Servidores</button>} />
        <Fila {...f('aj-ritmo')} t="El ritmo" que="Cada cuánto puede mandar un mensaje nuevo en un mismo chat."
          val={'Uno cada ' + (r || defR).normal + ' min · ' + (r || defR).batalla + ' en «Cada batalla»' + (r ? ' · ✍' : '')} tono={r ? 'ojo' : ''}>
          <AjRitmo aj={aj} hacer={hacer} ocup={ocup} chat={chat} /></Fila>
        <Fila {...f('aj-silencio')} t="Horario de silencio" que="Horas (en hora del este) en que el bot en vivo no habla en ningún chat."
          val={s ? '🌙 De ' + s.desde + ' a ' + s.hasta : 'Sin silencio'} tono={s ? 'ojo' : ''}>
          <AjSilencio aj={aj} hacer={hacer} ocup={ocup} /></Fila>
        <Fila {...f('aj-apuestas')} t="Las apuestas" que="Los botones, cuánto quedan abiertas y el tope por batalla."
          val={(a || defA).montos.map(num).join(' · ') + ' · tope ' + num((a || defA).tope) + (a ? ' · ✍' : '')} tono={a ? 'ojo' : ''}>
          <AjApuestas liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general /></Fila>
      </ul>
      <h3 className="dz-h">El Pase, las crews y el Salón</h3>
      <ul>
        <Fila {...f('aj-sorteo')} t="El sorteo del premium" que="La gente entra gratis desde el Pase y se sortea solo a la hora."
          val={S ? 'Se sortea ' + liga.dia(S.sorteo) : 'Sin sorteo'} tono={S ? 'ok' : ''}>
          <AjSorteo liga={liga} aj={aj} hacer={hacer} ocup={ocup} /></Fila>
        <Fila {...f('aj-crews')} t="Las crews" que="Cuánto cuesta crear una, cómo se arma su ranking y quién es el líder."
          val={'Crear: ' + num(aj.crew_precio ?? 2500) + ' PdT'}>
          <AjCrews liga={liga} aj={aj} hacer={hacer} ocup={ocup} /></Fila>
        <Fila {...f('aj-mes')} t="MES AWARDS" que="Los nominados salen solos el día 1; hasta las 6 PM puedes sacar a alguno."
          val={ms && (ms.quitar || []).length ? 'Sacaste ' + ms.quitar.length : 'Sin cambios'}>
          <MesAwardsDueno aj={aj} hacer={hacer} ocup={ocup} /></Fila>
        <Fila {...f('aj-promos')} t="Promos a mano" que="Agregar una promo que el lector no vio, o sacar una que no va."
          val={promos ? promos + ' a mano' : 'Ninguna'}>
          <PromosMano aj={aj} hacer={hacer} ocup={ocup} /></Fila>
      </ul>
    </div>
  );
}

// ── 💚 LA SALUD, PIEZA POR PIEZA (25/10/2026, la maqueta). Antes eran cinco cajas de texto y para saber si algo andaba mal
// había que leerlas todas. Ahora cada pieza es un cuadro con su punto —verde anda, amarillo ojo, rojo mal— y lo que
// mide en una línea; tocarlo baja al detalle, que sigue siendo el de antes. Arriba, el cupo de escrituras de KV con su
// ritmo: lo que va, a dónde llega al ritmo de hoy y a qué hora se renueva
function piezasDe(d, q, logs) {
  const s = d.sistema || {};
  const aj = d.ajustes || {};
  const ult = (d.corridas || [])[0];
  const xs = [];
  if (ult) {
    const t = ult.empezo || ult.creada;
    const fallo = ult.estado === 'completed' && ult.fin && ult.fin !== 'success' && ult.fin !== 'skipped';
    const trabada = ult.estado !== 'completed' && t && Date.now() - Date.parse(t) > 20 * 60000;
    xs.push(['El ciclo', fallo ? 'mal' : trabada ? 'ojo' : 'ok', (ult.estado === 'completed' ? (FIN_CORRIDA[ult.fin] || 'terminó').replace(/^\S+\s/, '') : (ESTADO_CORRIDA[ult.estado] || ult.estado).replace(/^\S+\s/, '')) + (t ? ' · ' + hora(new Date(t)) : ''), 'sa-corridas']);
  }
  if (s.vigia || s.ok === false) xs.push(['El lector de anuncios', s.ok === false ? 'mal' : 'ok', (s.ok === false ? 'no contesta · ' : 'leyó ') + hace(s.vigia), 'sa-corridas']);
  xs.push(['GitHub', d.github ? 'ojo' : 'ok', d.github ? (d.github.incidente || 'anda lento') : 'normal', 'sa-corridas']);
  const w = q && q.kv ? q.kv.write : null;
  if (w != null) {
    const p = proyeccion(q);
    xs.push(['KV · escrituras', w >= 900 || (p != null && p >= 1000) ? 'mal' : w >= 700 || (p != null && p >= 850) ? 'ojo' : 'ok', num(w) + ' de 1.000' + (p != null ? ' · llega a ~' + num(p) : ''), 'sa-cuotas']);
  }
  const ob = q && q.objeto;
  if (ob) {
    const pc = Math.max(...TOPES.filter(([g]) => g === 'objeto').map(([, k, , tope]) => (100 * (ob[k] || 0)) / tope));
    xs.push(['El objeto', pc >= 90 ? 'mal' : pc >= 70 ? 'ojo' : 'ok', Math.round(pc) + ' % de lo más usado', 'sa-cuotas']);
  }
  const wk = q && q.worker;
  if (wk && wk.p99_ms != null) xs.push(['El Worker', wk.p99_ms >= 9 ? 'mal' : wk.p99_ms >= 7 ? 'ojo' : 'ok', 'CPU p99 ' + String(wk.p99_ms).replace('.', ',') + ' ms de 10', 'sa-cuotas']);
  xs.push(['La campana', aj.campana_pausada ? 'ojo' : 'ok', aj.campana_pausada ? 'en pausa' : num(s.suscripciones || 0) + ' dispositivos · ' + num((s.ultimas_24h || {}).enviados || 0) + ' envíos en 24 h', 'sa-corridas']);
  if (logs && !logs.error) {
    const v = logsVistos();
    const rojos = (logs.xs || []).filter((x) => x.nivel === 'rojo' && !v.includes(x.id)).length;
    const amar = (logs.xs || []).filter((x) => x.nivel !== 'rojo' && !v.includes(x.id)).length;
    xs.push(['Logs', rojos ? 'mal' : amar ? 'ojo' : 'ok', rojos ? rojos + ' en rojo sin ver' : amar ? amar + ' en amarillo sin ver' : 'nada sin ver', 'sa-logs']);
  }
  const ep = (d.errores_pag || []).reduce((n, x) => n + (x.n || 0), 0);
  xs.push(['Errores de la página', ep >= 20 ? 'mal' : ep ? 'ojo' : 'ok', ep ? num(ep) + ' en 7 días' : 'ninguno en 7 días', 'sa-errores']);
  return xs;
}

function Cupo({ q }) {
  const w = q && q.kv ? q.kv.write : null;
  if (w == null) return null;
  const p = proyeccion(q);
  const ahora = new Date();
  const renueva = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + 1));
  const hasta = (x) => Math.min(100, x / 10).toFixed(1) + '%';
  const mal = p != null && p >= 1000;
  return (
    <div className={'dz-cupo' + (mal ? ' mal' : w >= 700 ? ' ojo' : '')}>
      <div className="dz-cupo-c"><b>El cupo de hoy · KV</b><span>{num(w)} <small>de 1.000 escrituras</small></span></div>
      <div className="dz-cupo-b" role="img" aria-label={num(w) + ' de 1.000' + (p != null ? ', al ritmo de hoy ~' + num(p) : '')}>
        {p != null ? <i className="dz-cupo-p" style={{ width: hasta(p) }} /> : null}
        <u style={{ width: hasta(w) }} />
      </div>
      <p className="db-tx">{p != null ? (mal ? '⚠️ Al ritmo de hoy llega a ~' + num(p) + ': no alcanza. Si se llena, la página y /card se quedan quietos hasta que se renueve.' : 'Al ritmo de hoy llega a ~' + num(p) + ': alcanza.') : 'Recién se renovó: todavía no hay ritmo.'} Se renueva a las {hora(renueva)}.</p>
    </div>
  );
}

function SaludPiezas({ d, q, logs, ir }) {
  const xs = piezasDe(d, q, logs);
  const malas = xs.filter((x) => x[1] === 'mal').length, ojos = xs.filter((x) => x[1] === 'ojo').length;
  return (
    <div className="dz-sal">
      <p className={'dz-sal-r' + (malas ? ' mal' : ojos ? ' ojo' : '')}>{malas ? malas + (malas === 1 ? ' pieza anda mal' : ' piezas andan mal') : ojos ? 'Todo anda; ' + ojos + (ojos === 1 ? ' pieza para mirar' : ' piezas para mirar') : 'Todo anda.'}</p>
      <div className="dz-piezas">{xs.map(([t, e, s, an]) => (
        <button key={t} type="button" className={'dz-pieza ' + e} onClick={() => ir('salud', an)}>
          <span className="dz-pieza-t"><i aria-hidden="true" />{t}</span>
          <small>{s}</small>
          {e === 'ok' ? <em className="rk-sr">anda</em> : <em className="dz-pieza-e">{e === 'ojo' ? 'OJO' : 'MAL'}</em>}
        </button>
      ))}</div>
      <Cupo q={q} />
    </div>
  );
}

// ── 🕓 EL HISTORIAL, CON «DE → A» (25/10/2026, la maqueta). Decía «cambió» y nada más: para saber qué había que
// deshacer había que acordarse. Ahora cada fila dice cómo estaba y cómo quedó, en palabras; en los ajustes por servidor
// sólo los servidores que cambiaron. `enPalabras()` es corto a propósito: un valor que no conoce lo cuenta, no lo inventa
const VAL_SV = {
  en_vivo: (v) => (v === true ? 'prendido' : v === false ? 'apagado' : 'su admin'),
  en_vivo_nivel: (v) => ((NIVELES_VIVO[v] || [v])[0] || '').toLowerCase(),
  eventos_discord: (v) => (v ? 'prendidos' : 'apagados'),
  tiers: (v) => 'Tier ' + v,
  beneficios: () => 'a mano',
};
function enPalabras(cual, v, liga) {
  if (v === null || v === undefined) return 'lo de siempre';
  if (cual === 'campana_pausada') return v ? 'en pausa' : 'suena';
  if (cual === 'avisos_nivel') return ((NIVELES_AVISO[v] || [v])[0] || '').toLowerCase();
  if (cual === 'silencio') return 'de ' + v.desde + ' a ' + v.hasta;
  if (cual === 'aviso_web') return '«' + corte(v.texto, 40) + '»';
  if (cual === 'ritmo') return 'uno cada ' + v.normal + ' min · ' + v.batalla + ' en «Cada batalla»';
  if (cual === 'apuestas') return (v.montos || []).map(num).join(' · ') + ' · tope ' + num(v.tope || 0);
  if (cual === 'pase_sorteo') return v.id + (v.sorteo && liga ? ' · se sortea ' + liga.dia(v.sorteo) : '');
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'number') return num(v);
  if (typeof v === 'string') return corte(v, 40);
  if (Array.isArray(v)) return v.length === 1 ? '1 cosa' : v.length + ' cosas';
  const n = Object.keys(v).length;
  return n === 1 ? '1 ajuste' : n + ' ajustes';
}
// lo que cambió, como líneas «de → a»
function deA(x, liga) {
  const { cual } = x;
  let a = x.antes, d = x.despues;
  if (cual === 'multiplicadores') { a = a && a.sv; d = d && d.sv; }
  if (cual === 'aviso_evento') { a = a && a.sv; d = d && d.sv; }
  const porSv = VAL_SV[cual] || (cual === 'multiplicadores' ? mult : cual === 'aviso_evento' ? (v) => ({ chat: 'chat general', no: 'apagado' }[v] || v) : null);
  if (porSv && (a == null || typeof a === 'object') && (d == null || typeof d === 'object')) {
    const A = a || {}, D = d || {};
    const ks = [...new Set([...Object.keys(A), ...Object.keys(D)])].filter((k) => JSON.stringify(A[k]) !== JSON.stringify(D[k]));
    if (ks.length && ks.length <= 6) {
      const ver = (o, k) => (o[k] === undefined ? (cual === 'multiplicadores' ? '×1' : 'lo de siempre') : porSv(o[k]));
      return ks.map((k) => [siglaDe(k), ver(A, k), ver(D, k)]);
    }
  }
  return [['', enPalabras(cual, x.antes, liga), enPalabras(cual, x.despues, liga)]];
}

function HistorialDeA({ hist, hacer, ocup, liga }) {
  const [q, setQ] = useState('');
  const [mas, setMas] = useState(false);
  const todos = hist || [];
  if (!todos.length) return <p className="db-tx">Todavía no hay cambios anotados: el historial empezó el 13/10/2026.</p>;
  // sólo el último cambio de cada ajuste se puede deshacer: deshacer uno más viejo pisaría lo que vino después
  const ultimo = new Set();
  const filas = todos.map((x) => { const puede = !ultimo.has(x.cual); ultimo.add(x.cual); return [x, puede]; })
    .filter(([x]) => contiene([NOMBRE_AJ[x.cual] || x.cual, x.por], q));
  const ver = mas ? filas : filas.slice(0, 15);
  return (
    <div className="dz-hi">
      <label className="db-buscar dz-band-q"><Ico n="buscar" t={16} />
        <input type="search" value={q} placeholder="Buscar un ajuste o quién lo cambió" aria-label="Buscar en el historial" onChange={(e) => setQ(e.target.value)} /></label>
      <ol className="dz-hi-l">{ver.map(([x, puede]) => (
        <li key={x.t + x.cual}>
          <span className="dz-hora">{hace(x.t)}</span>
          <div className="dz-hi-q">
            <b>{NOMBRE_AJ[x.cual] || x.cual}{x.por && x.por !== 'Dlx' ? <small> · lo cambió {x.por}</small> : null}</b>
            <ul>{deA(x, liga).map(([k, de, a]) => (
              <li key={k + de + a}>{k ? <em>{k}</em> : null}<s>{de}</s><span aria-hidden="true">→</span><span className="rk-sr">pasó a</span><strong>{a}</strong></li>
            ))}</ul>
          </div>
          {puede ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo: vuelve a como estaba"
            onClick={() => hacer(x.cual, volverA(x.cual, x.antes), 'Deshecho: volvió a como estaba.')}>Deshacer</DosToques> : <small className="dz-hi-no">cambió después</small>}
        </li>
      ))}{!ver.length ? <li className="dz-it-nada">Nada con «{q}».</li> : null}</ol>
      {filas.length > 15 ? <button type="button" className="dz-lnk" onClick={() => setMas(!mas)}>{mas ? 'Ver menos' : 'Ver los ' + filas.length}</button> : null}
    </div>
  );
}

// ── 📊 LOS NÚMEROS, EN PESTAÑAS (25/10/2026, la maqueta: «la gente · la página · el Pase · las crews»). Eran diez
// secciones una abajo de la otra y la que importaba quedaba al final. Cada pestaña es una pregunta; la que no tiene
// datos no aparece (sin dato no hay pieza). La elegida se recuerda en este navegador
const NUM_TAB = 'lg:db-num';
function NumerosTabs({ tabs }) {
  const [t, setT0] = useState(() => { try { return localStorage.getItem(NUM_TAB) || ''; } catch (e) { return ''; } });
  const setT = (k) => { setT0(k); try { localStorage.setItem(NUM_TAB, k); } catch (e) { /* sin guardar */ } };
  const xs = tabs.filter(Boolean);
  const actual = xs.find(([k]) => k === t) || xs[0];
  if (!actual) return <p className="pronto-p">Todavía no hay números.</p>;
  return (
    <>
      <div className="dz-subs" role="tablist" aria-label="Qué números">{xs.map(([k, tt]) => (
        <button key={k} type="button" role="tab" aria-selected={actual[0] === k} className={'dz-sub' + (actual[0] === k ? ' on' : '')} onClick={() => setT(k)}>{tt}</button>
      ))}</div>
      {actual[2]}
    </>
  );
}

export function Dashboard({ dc, liga }) {
  const [st, setSt] = useState({ cargando: true });
  // la visita anterior: se lee una vez al abrir y se anota la de ahora
  const [prev] = useState(leerVisita);
  const [actualizado, setActualizado] = useState(0);
  useEffect(() => {
    if (!dc) { setSt({ sinCuenta: true }); return undefined; }
    let vivo = true;
    pedirDueno().then((x) => { if (vivo) { setSt(x); setActualizado(Date.now()); } });
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
  const { hacer, msg, ocup, aviso, deshacer, cerrarAviso } = useHacer(onAj, () => (st.d && st.d.ajustes) || {});
  // lo que cambia un área (un reporte, una respuesta) vuelve al panel: así los números de los cuadrados están al día
  const cambiarD = (o) => setSt((x) => (x.d ? { d: Object.assign({}, x.d, o) } : x));
  const [area, setArea0] = useState(leerArea);
  // 📌 lo que salió cada semana, para las marcas de Números (sólo se pide al abrir Números)
  const cambios = useCambios(!!st.d && area === 'numeros');
  // la cola que se abre: la que se eligió, o sola la primera que tiene algo
  const [sub, setSub] = useState('');
  const [abrir, setAbrir] = useState('');
  const [buscar, setBuscar] = useState(false);
  const raiz = useRef(null);
  // ir a un área (y bajar hasta un ajuste, o abrir una cola de Pendientes)
  const ir = (a, ancla, s) => {
    setArea0(a); ponerArea(a);
    setSub(s || '');
    setAbrir(ancla || '');
    setTimeout(() => {
      const el = ancla && raiz.current ? raiz.current.querySelector('#' + ancla) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (raiz.current) raiz.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };
  // ⌨️ Ctrl+K (o Cmd+K) abre el buscador
  useEffect(() => {
    const f = (e) => { if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setBuscar((b) => !b); } };
    W.addEventListener && W.addEventListener('keydown', f);
    return () => { W.removeEventListener && W.removeEventListener('keydown', f); };
  }, []);
  // 🔄 SE PONE AL DÍA SOLO en el Resumen y en Salud, cada 2 minutos y sólo con la pestaña a la vista. En las áreas donde
  // se escribe no: un formulario a medio llenar se pisaría con lo que llega
  useEffect(() => {
    if (!st.d || (area !== 'resumen' && area !== 'salud')) return undefined;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      pedirDueno().then((x) => { if (x.d) { setSt(x); setActualizado(Date.now()); } });
    }, 120000);
    return () => clearInterval(id);
  }, [area, !!st.d]); // eslint-disable-line react-hooks/exhaustive-deps
  const [, tic] = useState(0);
  useEffect(() => { const id = setInterval(() => tic((n) => n + 1), 30000); return () => clearInterval(id); }, []);
  const [panel, setPanel] = useState(() => !panelCerrado());

  let cuerpo;
  if (st.cargando) cuerpo = <p className="pronto-p">Cargando…</p>;
  else if (st.sinCuenta) {
    cuerpo = (<><p className="pronto-p">Esta página es del dueño de la Liga. Entra con tu cuenta de Discord.</p>
      <div className="cu-btns"><button type="button" className="btn verde chico" onClick={entrar}>Entrar con Discord</button></div></>);
  } else if (st.no) cuerpo = <p className="pronto-p">Esta página es sólo del dueño de la Liga.</p>;
  else if (st.error) cuerpo = <p className="pronto-p">No pude leerlo ({st.error}). Prueba en un rato.</p>;
  if (cuerpo) return <section className="sec db"><style>{ESTILO}</style><div className="sec-t"><h1>Dashboard</h1></div>{cuerpo}</section>;

  const d = st.d || {};
  const aj = d.ajustes || {};
  const u = d.uso || {};
  // 🔐 QUÉ PUEDE QUIEN MIRA (13/10/2026): el objeto lo dice (`permisos`); sin eso es Dlx con todo (un Worker de antes)
  const pm = d.permisos || ['panel', 'ajustes', 'ciclo', 'reportes', 'reportes_cerrar', 'decidir', 'videos', 'fondos', 'roles'];
  const ve = (k) => pm.includes(k);
  const cl0 = d.crews_logos || {};
  const nSub0 = (k) => ({ quien: sinContestar(d.decidir), llaves: (d.reportes || []).filter((x) => x.estado === '' || x.estado === 'no_pude').length,
    imagenes: (d.fondos || []).length + (d.fotos_carta || []).length + (cl0.pend || []).length + (d.videos || []).length,
    pedidos: (d.pedidos || []).filter((x) => x.estado === '').length })[k] || 0;
  const verSub = { quien: ve('decidir'), llaves: ve('reportes') || ve('reportes_cerrar'), imagenes: ve('fondos'), videos: ve('videos') || ve('fondos'), pedidos: ve('reportes_cerrar') };
  const visibles = { resumen: true, pendientes: Object.values(verSub).some(Boolean), servidores: ve('ajustes'), web: ve('ajustes'),
    numeros: ve('ajustes'), salud: ve('ajustes'), historial: ve('ajustes') };
  const areaV = visibles[area] ? area : 'resumen';
  const subV = verSub[sub] ? sub : (SUBP.find(([k]) => verSub[k] && nSub0(k)) || SUBP.find(([k]) => verSub[k]) || ['quien'])[0];
  // lo que espera algo de ti, por cola
  const cl = d.crews_logos || {};
  const n = {
    quien: sinContestar(d.decidir),
    llaves: (d.reportes || []).filter((x) => x.estado === '' || x.estado === 'no_pude').length,
    imagenes: (d.fondos || []).length + (d.fotos_carta || []).length + (cl.pend || []).length,
    videos: (d.videos || []).length,
    pedidos: (d.pedidos || []).filter((x) => x.estado === '').length,
  };
  const total = n.quien + n.llaves + n.imagenes + n.videos + n.pedidos;
  const nSub = { quien: n.quien, llaves: n.llaves, imagenes: n.imagenes + n.videos, pedidos: n.pedidos };
  // una sección del Dashboard: el mismo título y la misma caja que lo nuevo (antes la barrita fina del Inicio, con el
  // subtítulo en magenta: dos estilos de título en la misma página)
  const sec = (id, titulo, em, hijo) => <section className="dz-sec" id={id || undefined}><h3 className="dz-h">{titulo}{em ? <small>{em}</small> : null}</h3>{hijo}</section>;
  const at = atencion(d, liga, cuotas, logs);
  const sal = saludDe(d, cuotas);
  const nuevo = desdeVisita(d, prev, logs);
  const prog = programado(aj, liga);
  const primeroRep = (d.reportes || []).find((x) => x.estado === '');
  const primerPed = (d.pedidos || []).find((x) => x.estado === '');
  const CUADROS = [
    ['quien', n.quien, '¿Quién es quién?', 'nombres que el bot no reconoció', true, 'quien'],
    ['llaves', n.llaves, 'Errores en las llaves', primeroRep ? 'llave #' + primeroRep.llave + (primeroRep.de ? ' · lo reportó ' + primeroRep.de : '') : 'reportados por la gente', true, 'llaves'],
    ['imagenes', n.imagenes, 'Imágenes', 'fondos, fotos de carta y logos', false, 'imagenes'],
    ['videos', n.videos, 'Videos', 'alguien dice «es mío»', false, 'videos'],
    ['pedidos', n.pedidos, 'Pedidos', primerPed ? PED_TIPO[primerPed.tipo] || primerPed.tipo : 'cuenta perdida, país, un video', false, 'pedidos'],
  ].filter((x) => verSub[x[5]]);
  const hora0 = new Date();
  const saludo = hora0.getHours() < 12 ? 'Buenos días' : hora0.getHours() < 20 ? 'Buenas tardes' : 'Buenas noches';

  let vista;
  if (areaV === 'resumen') {
    vista = (
      <>
        <div className="dz-cab"><h2 className="dz-h1">{saludo}{d.yo ? ', ' + d.yo : ''}</h2></div>
        {/* 💚 la salud en una frase */}
        {ve('ajustes') ? (
          <div className={'dz-salud' + (sal.ok ? '' : ' mal')}>
            <span className="dz-pt" aria-hidden="true" />
            <p>{sal.ok ? <b>Todo anda.</b> : <b>Ojo: {sal.mal.join(' · ')}.</b>} {sal.partes.join(' · ')}{sal.partes.length ? '.' : ''}</p>
            <button type="button" className="dz-lnk" onClick={() => ir('salud')}>Ver la salud</button>
          </div>
        ) : null}
        {/* 🟥 lo prioritario primero, en cuadrados (Dlx: «lo que me gusta de B es que aparece lo prioritario primero… en cuadrados») */}
        <section className="dz-dec" aria-label="Para decidir">
          <h3 className="dz-h">Para decidir{total ? <span> · {total}</span> : null}</h3>
          <div className="dz-cuadros">{CUADROS.filter((x) => x[1]).map(([k, c, t, s, urg, a]) => (
            <button key={k} type="button" className={'dz-cuadro' + (c ? (urg ? ' urg' : ' ojo') : ' cero')} onClick={() => ir('pendientes', '', a)}>
              <b>{c || '✓'}</b><span>{t}</span><small>{c ? s : 'al día'}</small>
            </button>
          ))}</div>
          {/* lo que está en cero no ocupa un cuadrado: una línea */}
          {CUADROS.some((x) => !x[1]) ? <p className="dz-aldia">✓ Al día: {CUADROS.filter((x) => !x[1]).map((x) => x[2]).join(' · ')}</p> : null}
        </section>
        {/* lo que pide atención, con un botón que lleva a donde se arregla */}
        {at.length ? (
          <ul className="dz-at">{at.map(([ic, t, s, a, an]) => (
            <li key={t} className={ic === '🔴' ? 'mal' : 'ojo'}><span aria-hidden="true">{ic}</span><div><em>{ic === '🔴' ? 'URGENTE' : ic === '⏸' ? 'EN PAUSA' : 'OJO'}</em><b>{t}</b>{s ? <small>{s}</small> : null}</div>
              {a ? <button type="button" className="btn borde2 chico" onClick={() => ir(a, an)}>Ir</button> : null}</li>
          ))}</ul>
        ) : null}
        <div className="dz-dos">
          <section className="dz-caja">
            <h3 className="dz-h">Desde tu última visita{prev ? <small>{hace(prev)}</small> : null}</h3>
            {!nuevo ? <p className="db-tx">Es la primera vez que lo abres así: desde la próxima, acá aparece lo que pasó mientras no estabas.</p>
              : !nuevo.length ? <p className="db-tx">Nada nuevo desde entonces.</p>
                : <ul className="dz-lista">{nuevo.map(([t, tx, a, s]) => (
                  <li key={t + tx}><span className="dz-hora">{hora(new Date(t))}</span><button type="button" className="dz-lnk" onClick={() => ir(a, '', s)}>{tx}</button></li>
                ))}</ul>}
          </section>
          <section className="dz-caja">
            <h3 className="dz-h">Lo que está programado</h3>
            {prog.length ? <ul className="dz-lista">{prog.map(([t, s, a, an]) => (
              <li key={t}><span><b>{t}</b> · {s}</span><button type="button" className="dz-lnk" onClick={() => ir(a, an)}>Cambiar</button></li>
            ))}</ul> : <p className="db-tx">Nada programado ni prendido a mano.</p>}
          </section>
        </div>
        {(d.vivo || []).length ? sec('', 'EN VIVO AHORA', 'se pone al día solo', <EnVivo vivo={d.vivo} liga={liga} aj={aj} chat={d.chat} />) : null}
      </>
    );
  } else if (areaV === 'pendientes') {
    vista = <Bandeja d={d} liga={liga} ve={ve} cambiarD={cambiarD} sub={sub} />;
  } else if (areaV === 'servidores') {
    vista = (
      <>
        {msg ? <p className="db-msg dz-msg" role="status">{msg}</p> : null}
        {sec('sv-cada', 'LOS SERVIDORES', 'una fila cada uno: se cambia ahí mismo',
          <ServidoresTabla liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={d.chat} T={d.tiers} />)}
        {d.tiers ? sec('sv-sumar', 'SUMAR UN SERVIDOR', d.tiers.t ? 'el puntaje, medido ' + hace(d.tiers.t) : null,
          <SumarServidor T={d.tiers} aj={aj} hacer={hacer} ocup={ocup} />) : null}
      </>
    );
  } else if (areaV === 'web') {
    vista = (
      <>
        {msg ? <p className="db-msg dz-msg" role="status">{msg}</p> : null}
        <AjustesFilas liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={d.chat} ir={ir} abrir={abrir} />
      </>
    );
  } else if (areaV === 'numeros') {
    const S = d.secciones && Object.keys(d.secciones.n || {}).length ? d.secciones : null;
    vista = (
      <NumerosTabs tabs={[
        ['gente', 'La gente', <>
          {sec('nu-vuelta', 'LA VUELTA AL SEGUNDO EVENTO', 'el número del 42 %', <VueltaSegundo r={retencion} marcas={marcasPorSemana(cambios, d.ajustes_hist)} />)}
          {d.primerizos !== undefined ? sec('nu-primerizos', 'A QUIÉN TRAER DE VUELTA', 'con nombre: sólo lo ve el staff',
            <PrimerizosLista P={d.primerizos} vuelve={d.vuelve} liga={liga} alVuelve={(v) => cambiarD({ vuelve: v })} />) : null}
          {sec('nu-uso', 'ESTA SEMANA · EL BOT Y LA PÁGINA', u.desde ? 'se cuenta desde el ' + corto(u.desde) : null, <Cajas u={u} />)}
          {sec('nu-lobby', '¿VUELVE LA GENTE?', 'la meta del research', <MetaLobby r={retencion} />)}
          {sec('nu-semanas', 'COMPARAR SEMANAS', 'de lunes a domingo, en hora del este', <CompararSemanas S={semanas} uso={d.uso_semanas} liga={liga} />)}
          {(d.dias || []).length ? sec('', 'DÍA POR DÍA · DOS SEMANAS', 'hasta hoy', <Dias dias={d.dias} />) : null}
        </>],
        S || d.clics || (d.tutorial && Object.keys(d.tutorial.n || {}).length) ? ['pagina', 'La página', <>
          {S ? sec('nu-clics', 'QUÉ SECCIONES SE ABREN · 7 DÍAS', S.desde ? 'se cuenta desde el ' + corto(S.desde) : null, <SeccionesNumeros s={S} />) : null}
          {S && Object.keys(S.n || {}).some((k) => /^[ip]-/.test(k)) ? sec('', 'QUÉ SE TOCA EN EL INICIO · 7 DÍAS', S.desde ? 'se cuenta desde el ' + corto(S.desde) : null, <SeccionesNumeros s={S} toques />) : null}
          {d.clics ? sec('', 'QUÉ SE TOCA EN TODA LA PÁGINA · 7 DÍAS', d.clics.desde ? 'se cuenta desde el ' + corto(d.clics.desde) : null, <ClicsNumeros c={d.clics} />) : null}
          {d.tutorial && Object.keys(d.tutorial.n || {}).length ? sec('nu-tuto', 'EL TUTORIAL · DOS SEMANAS',
            d.tutorial.desde ? 'se cuenta desde el ' + corto(d.tutorial.desde) : null, <TutorialNumeros t={d.tutorial} />) : null}
        </>] : null,
        d.pase ? ['pase', 'El Pase', sec('nu-pase', 'EL PASE DE RAPERO', d.pase.semana ? 'la semana del ' + corto(d.pase.semana) : null, <PaseNumeros p={d.pase} liga={liga} />)] : null,
        d.crews_num ? ['crews', 'Las crews', sec('nu-crews', 'LAS CREWS · 7 DÍAS', 'contra los 7 de antes', <CrewsNumeros c={d.crews_num} />)] : null,
      ]} />
    );
  } else if (areaV === 'salud') {
    vista = (
      <>
        <SaludPiezas d={d} q={cuotas} logs={logs} ir={ir} />
        {sec('sa-corridas', 'EL CICLO Y EL LECTOR', 'se pone al día solo', <><Corridas corridas={d.corridas} s={d.sistema || {}} github={d.github} /><Sistema s={d.sistema || {}} sesiones={d.sesiones} /></>)}
        {sec('sa-cuotas', 'LO QUE GASTA CLOUDFLARE HOY', 'el plan gratis · se renueva a las 8 PM', <Cuotas q={cuotas} />)}
        {sec('sa-logs', 'LO QUE AVISÓ LOGS', 'los 🔴 y ⚠️ de los últimos 3 días', <Logs l={logs} />)}
        {sec('sa-errores', 'ERRORES DE LA PÁGINA · 7 DÍAS', 'nunca de quién', <ErroresPagina e={d.errores_pag} />)}
        {sec('sa-atajos', 'ATAJOS', null, <ul className="db-atajos">{ATAJOS.map(([t, h]) => (
          <li key={h}><a href={h} target={h[0] === '/' ? undefined : '_blank'} rel={h[0] === '/' ? undefined : 'noopener noreferrer'}>{t} ↗</a></li>
        ))}</ul>)}
      </>
    );
  } else {
    vista = (
      <>
        {sec('hi-hist', 'LOS ÚLTIMOS CAMBIOS', 'deshacer vuelve a como estaba', <HistorialDeA hist={d.ajustes_hist} hacer={hacer} ocup={ocup} liga={liga} />)}
        {ve('roles') ? sec('hi-roles', 'ROLES DE LA PÁGINA', 'sólo tú los pones', <Roles roles={d.roles} alCambiar={(y) => cambiarD({ roles: y })} />) : null}
      </>
    );
  }
  const titulo = (AREAS.find(([k]) => k === areaV) || [])[1];
  return (
    <section className="sec db dz" ref={raiz}>
      <style>{ESTILO}</style>
      {d.mis_roles && !d.mis_roles.includes('owner') ? <p className="db-rol">Entraste como <b>{(d.mis_roles || []).map((r) => ({ admin: 'Admin', asistente: 'Asistente', moderador: 'Moderador de la página' }[r] || r)).join(' y ')}</b>{d.yo ? ' (' + d.yo + ')' : ''}: lo que hagas queda con tu nombre.</p> : null}
      <div className="dz-marco">
        <nav className="dz-nav" aria-label="Áreas del Dashboard">
          <div className="dz-marca"><small>UNDER LEGENDS · {liga.temp}</small><b>Dashboard</b></div>
          {AREAS.filter(([k]) => visibles[k]).map(([k, t, ic]) => {
            const c = k === 'pendientes' ? total : 0;
            return (
              <button key={k} type="button" className={'dz-a' + (areaV === k ? ' on' : '')} aria-current={areaV === k ? 'page' : undefined} onClick={() => ir(k)}>
                <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d={ic} /></svg>{t}</span>
                {c ? <i>{c}</i> : null}
              </button>
            );
          })}
        </nav>
        <div className="dz-der">
          <div className="dz-top">
            <button type="button" className="dz-bbtn" onClick={() => setBuscar(true)}><Ico n="buscar" t={16} /><span>Busca un ajuste o una acción</span><kbd>Ctrl K</kbd></button>
            <span className="dz-act">{actualizado ? 'Actualizado ' + hace(actualizado) + ((areaV === 'resumen' || areaV === 'salud') ? ' · se pone al día solo' : '') : ''}</span>
            {!panel ? <button type="button" className="btn borde2 chico" onClick={() => { panelPoner(true); setPanel(true); }}>Mostrarlo en el Inicio</button> : null}
          </div>
          {areaV !== 'resumen' ? <h2 className="dz-h1">{titulo}</h2> : null}
          {vista}
        </div>
      </div>
      <BuscarTodo abierto={buscar} cerrar={() => setBuscar(false)} ir={ir} visibles={visibles} />
      {aviso ? (
        <div className="dz-toast" role="status">
          <span>{aviso.ok}</span>
          {aviso.puede ? <button type="button" onClick={deshacer}>Deshacer</button> : null}
          <button type="button" className="dz-tx" aria-label="Cerrar" onClick={cerrarAviso}><Ico n="cerrar" t={14} /></button>
        </div>
      ) : null}
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
      ) : <p className="db-ini-m">{st.sinCuenta ? 'Entra con Discord para verlo.' : 'No pude leerlo ahora.'}</p>}
    </section>
  );
}
