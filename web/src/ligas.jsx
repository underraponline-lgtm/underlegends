// 🏟️ LAS LIGAS DE LOS SERVIDORES (Dlx, 12/10/2026: «2. Me gusta», a la pestaña «Ligas» con la tabla de cada una; y a
// la Copa de Campeones, no: «cada liga tiene su inicio y su fin aleatoriamente… no podemos controlar eso»). La cuenta
// la hace el ciclo (`bot/ligas.py`) con los veredictos de cada liga y viaja en el lobby (`ligas`): acá sólo se muestra.
//
// 🏆 CADA LIGA COMO UN TORNEO (Dlx, 14/10/2026: «Rework de la página de Ligas»): su tabla, su próxima fecha con la
// cuenta atrás —si el anuncio dice cuándo; si no, no hay pieza—, los resultados de cada fecha y su flyer. Y la encuesta
// «¿quién gana la liga?» (Dlx, el mismo día): el % de cada uno al lado de la tabla, se vota tocándolo (uno por cuenta,
// se cambia, con «Entrar con Discord») y cierra cuando la liga termina (`vota`, ver `ligas.vota()`).
//
// 🏟️ Y DESDE EL 16/10/2026 SON UNA SECCIÓN, NO UNA PESTAÑA DEL RANKING (Dlx: «que cada liga tenga su propio perfil y
// que ligas tenga su propio espacio aparte de ranking… al costado de tarjetas… y que esté bonito y tenga todo lo
// necesario»). `#/ligas` es la portada —todas, con su flyer, cómo van y quién lidera— y `#/ligas/<id>` el perfil de cada
// una. `#/ranking/ligas[/<id>]`, el link que ya circula en Publicaciones y las historias, lleva acá (App.jsx).
//
// ⚠️ LA TABLA ES LA QUE SALE DE LOS VEREDICTOS QUE SE PUDIERON LEER: directa 3 y 0, réplica 2 y 1, sin los ExtraPlayers.
// La oficial de cada liga puede tener sanciones o defaults que acá no están; por eso va el link a la suya.
import { useEffect, useMemo, useRef, useState } from 'react';
import { DIAS, MESES, limpio, num, siglaDe, utc } from './liga.js';
import { Bandera, Cara, Compartir, Ico, Sec, accion, enlace, silueta } from './piezas.jsx';
import { Numero, useDesliza } from './anima.js';
import { Miniatura, abrirVideo } from './video.jsx';
import { pedirLigas } from './ligas_datos.js';

// 🏟️ ¿UN NOMBRE ESTÁ MAL? (Dlx, 14/10/2026: «Sí, a Reportes», a ForceGP: «¿no hay manera de que uno pueda corregir
// eso?»). Elegís el nombre, contás quién es, y le llega a la Liga en Reportes del Dashboard con tu cuenta; lo decide la
// Liga y el ciclo lo deja como el nombre de esa persona en ESE servidor (`reportes.corregir_liga()`). Como el de las llaves
function AvisarLiga({ L }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [txt, setTxt] = useState('');
  const [est, setEst] = useState('');
  const [va, setVa] = useState(false);
  const [ok, setOk] = useState(false);
  if (ok) return <p className="lk-rep-ok">✓ ¡Gracias! Lo revisa la Liga.</p>;
  if (!abierto) return <button type="button" className="btn borde2 chico lg-avisar" onClick={() => setAbierto(true)}>¿Un nombre está mal?</button>;
  const nombres = [];
  for (const f of L.tabla || []) if (f[0] && !nombres.includes(f[0])) nombres.push(f[0]);
  for (const u of L.ult || []) for (const x of u.slice(0, 2)) if (x && !nombres.includes(x)) nombres.push(x);
  const enviar = () => {
    const t = txt.replace(/\s+/g, ' ').trim();
    if (!nombre || va) return;
    if (t.length < 2) { setEst('Cuenta quién es.'); return; }
    if (!window.conCuenta) { setEst('No pude mandarlo. Prueba de nuevo en un rato.'); return; }
    setVa(true);
    setEst('');
    window.conCuenta('/api/avisos/reportar', { llave: 'liga:' + L.id, que: 'nombre', texto: t, batalla: nombre }).then((j) => {
      setVa(false);
      if (j && j.ok) { setOk(true); return; }
      const e = (j && j.error) || '';
      setEst((window.errorCuenta && window.errorCuenta(e)) || (j && j.status === 401 ? 'Para avisar, entra con Discord desde Mi cuenta.'
        : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva para avisar.'
          : e === 'tope' ? 'Ya mandaste varios hoy: prueba mañana.' : 'No pude mandarlo. Prueba de nuevo en un rato.'));
    }).catch(() => { setVa(false); setEst('No pude mandarlo. Prueba de nuevo en un rato.'); });
  };
  return (
    <div className="lk-rep">
      <p className="lk-rep-t">¿Qué nombre de {L.n} está mal?</p>
      <div className="lk-rep-q" role="group" aria-label="El nombre que está mal">
        {nombres.map((x) => <button key={x} type="button" aria-pressed={nombre === x} className={nombre === x ? 'on' : ''} onClick={() => setNombre(x)}>{limpio(x)}</button>)}
      </div>
      {nombre ? <textarea aria-label="Quién es" maxLength={300} rows={2} value={txt} onChange={(e) => setTxt(e.target.value)}
        placeholder={'¿Quién es «' + limpio(nombre) + '»? Su nombre en la Liga o su Discord (o «soy yo»)'} /> : null}
      <div className="lk-rep-pie">
        <button type="button" className="btn verde chico" disabled={!nombre || va} onClick={enviar}>{va ? 'Enviando…' : 'Enviar'}</button>
        <span aria-live="polite">{est}</span>
      </div>
      <p className="lk-rep-nota">Se guarda con tu cuenta de Discord 14 días, para revisarlo. Lo decide la Liga.</p>
    </div>
  );
}

// ── 🏟️ el detalle de cada liga: las fechas y el flyer entero ───────────────────────────────────────────────────────────
// No viajan en el lobby —ya estaba al tope de lo que pesa—: se piden al abrir Ligas (`/api/ligas`, `ligas.separar()` en
// bot/ligas.py), una vez, y otra cuando el ciclo trae un lobby nuevo (`t`). Mientras tanto, la tabla y la encuesta ya están
const DET = { d: null, t: null, pedido: 0, oyentes: new Set() };
function pedirDetalle(t) {
  if ((DET.d && DET.t === t) || Date.now() - DET.pedido < 20000) return;
  DET.pedido = Date.now();
  // el mismo pedido que trae lo de la portada (web/src/ligas_datos.js): uno solo por lobby
  pedirLigas(t)
    .then((d) => {
      if (!d || !d.ligas) return;
      DET.d = d.ligas;
      DET.t = t;
      DET.oyentes.forEach((f) => f());
    })
    .catch(() => { /* sin el detalle se ve la tabla */ });
}
export function useDetalle(t) {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    DET.oyentes.add(f);
    pedirDetalle(t);
    return () => { DET.oyentes.delete(f); };
  }, [t]);
  return DET.d || {};
}

// ── 🗳️ los votos de «¿quién gana la liga?» ─────────────────────────────────────────────────────────────────────────────
// Cuántos lleva cada uno lo dice `/api/avisos/ligas-votos` (30 s en el borde; nunca quién); lo que votaste lo recuerda
// tu navegador (`lg:ligavotos`), como las encuestas (`lg:votos`). Uno solo para todas las ligas: se pide una vez cada
// dos minutos aunque cambies de pestaña
const VOTOS = { t: 0, pedido: 0, votos: {}, post: {}, oyentes: new Set() };
function leerMios() { try { return JSON.parse(localStorage.getItem('lg:ligavotos') || '{}') || {}; } catch (e) { return {}; } }
function pedirVotos(forzar) {
  if (!forzar && Date.now() - VOTOS.pedido < 110000) return;
  VOTOS.pedido = Date.now();
  fetch('/api/avisos/ligas-votos', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || !d.votos) return;
      VOTOS.votos = d.votos;
      VOTOS.t = d.t || 0;
      VOTOS.oyentes.forEach((f) => f());
    })
    .catch(() => { /* sin los votos se ve igual, sin porcentajes */ });
}
function useVotos() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    VOTOS.oyentes.add(f);
    pedirVotos(false);
    const t = setInterval(() => pedirVotos(true), 120000);
    return () => { VOTOS.oyentes.delete(f); clearInterval(t); };
  }, []);
  return VOTOS;
}
// los de una liga: los de mi voto si son más nuevos que los de la caché del borde
function cuentaDe(id) {
  const p = VOTOS.post[id];
  return p && p.t >= VOTOS.t ? p.cuenta : (VOTOS.votos[id] || {});
}
const pct = (n, tot) => (tot ? Math.round((100 * n) / tot) : 0);

// 🗓️ «domingo 18 de octubre» de un AAAA-MM-DD (el día de la liga, sin pasarlo por ninguna zona)
function diaDe(d) {
  const [y, m, dd] = String(d || '').split('-').map(Number);
  if (!y || !m || !dd) return '';
  return DIAS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()] + ' ' + dd + ' de ' + MESES[m - 1];
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ⏱️ LA PRÓXIMA FECHA, CON SU CUENTA ATRÁS. Al segundo sólo si el anuncio dijo la hora (`t`: la marca de Discord o una
// hora con bandera); con el día solo, cuántos días faltan. Sin fecha anunciada, la pieza no se dibuja
function Proxima({ liga, P }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!P.t) return undefined;
    const i = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(i);
  }, [P.t]);
  let cuenta = null;
  let cuando = '';
  if (P.t) {
    const seg = Math.max(0, Math.floor((utc(P.t) - ahora) / 1000));
    const d = Math.floor(seg / 86400);
    const h = Math.floor((seg % 86400) / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    const dos = (x) => String(x).padStart(2, '0');
    cuenta = seg ? (d ? d + 'd ' : '') + dos(h) + ':' + dos(m) + ':' + dos(s) : 'YA EMPIEZA';
    cuando = liga.dia(P.t);
  } else {
    const hoy = liga.diaClave(liga.ahora);
    const faltan = Math.round((Date.parse(P.d) - Date.parse(hoy)) / 86400000);
    cuenta = faltan <= 0 ? 'HOY' : faltan === 1 ? 'MAÑANA' : 'EN ' + faltan + ' DÍAS';
    cuando = diaDe(P.d);
  }
  return (
    <div className="lgt-prox">
      <small>LA PRÓXIMA FECHA{P.j ? ' · JORNADA ' + P.j : ''}</small>
      <b className={P.t ? 'reloj' : ''} aria-live="off">{cuenta}</b>
      <span>{cap(cuando)}{P.t ? '' : ' · la hora la dice el servidor'}</span>
      {P.link ? <a className="te-link" href={P.link} target="_blank" rel="noopener noreferrer">El anuncio ↗</a> : null}
    </div>
  );
}

// 🖼️ EL FLYER (Dlx, 14/10/2026: «y su flyer»): el último afiche que publicó la liga, re-alojado por el ciclo. Un toque
// lo abre grande, sin salir de la página
function Flyer({ liga, L }) {
  const [grande, setGrande] = useState(false);
  const cerrar = useRef(null);
  useEffect(() => {
    if (!grande) return undefined;
    if (cerrar.current) cerrar.current.focus();
    const k = (e) => { if (e.key === 'Escape') setGrande(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [grande]);
  const F = L.flyer;
  const alt = 'El flyer de ' + L.n + (F.tit ? ': ' + limpio(F.tit) : '');
  return (
    <figure className="lgt-flyer">
      <button type="button" className="lgt-flyer-b" onClick={() => setGrande(true)} aria-label={'Ver grande: ' + alt}>
        <img alt={alt} src={F.u} width={F.w || undefined} height={F.h || undefined} loading="lazy" />
      </button>
      <figcaption>{F.tit ? <b>{limpio(F.tit)}</b> : null}<small>{liga.cuando(F.t)}{F.link ? <> · <a className="te-link" href={F.link} target="_blank" rel="noopener noreferrer">en Discord ↗</a></> : null}</small></figcaption>
      {grande ? (
        <div className="lgt-zoom" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setGrande(false)}>
          <img alt={alt} src={F.u} />
          <button type="button" ref={cerrar} className="btn borde2 chico" onClick={() => setGrande(false)}>Cerrar</button>
        </div>
      ) : null}
    </figure>
  );
}

// 📋 LAS FECHAS (Dlx, 17/10/2026: «las fechas, mejor»): cada jornada con todas sus batallas a la vista —quién ganó,
// directa o réplica, el PTB de cada lado, el veredicto en Discord y el video si un canal de los socios la subió—. Lo que
// el veredicto no dice de qué jornada es va por SEMANA (`ligas._fechas()`): no se inventa una jornada. Arriba, lo que
// viene: la próxima fecha y el último afiche. Las tres más nuevas abiertas; las demás, plegadas
const ptbTx = (x) => (x === '' || x == null ? '' : String(x).replace('.', ','));
const dmy = (d) => (d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) : '');
function sumaDias(d, n) {
  const [y, m, dd] = String(d || '').split('-').map(Number);
  if (!y) return '';
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
}
function tituloFecha(f) {
  if (f.j) return 'Jornada ' + f.j;
  if (f.s) return 'Semana del ' + dmy(f.s) + ' al ' + dmy(sumaDias(f.s, 6));
  return cap(diaDe(f.d));
}
function Fechas({ liga, L, h }) {
  const fs = L.fechas || [];
  if (!fs.length) return null;
  const sig = L.flyer && L.flyer.tit && /\svs\s/i.test(L.flyer.tit) ? L.flyer : null;
  return (
    <div className="lpg-fechas">
      {L.prox || sig ? (
        <div className="lpg-viene">
          {L.prox ? <Proxima liga={liga} P={L.prox} /> : null}
          {sig ? <p className="lpg-sig"><small>LO ÚLTIMO QUE ANUNCIÓ</small><b>{limpio(sig.tit)}</b>{sig.link ? <a className="te-link" href={sig.link} target="_blank" rel="noopener noreferrer">El anuncio ↗</a> : null}</p> : null}
        </div>
      ) : null}
      {fs.map((f, i) => {
        const con = f.b.filter((b) => b[2]).length;
        return (
          <details key={(f.j || '') + (f.s || f.d) + i} className="lpg-fecha" open={i < 3}>
            <summary><b>{tituloFecha(f)}</b><small>{f.j && f.d ? cap(diaDe(f.d)) + ' · ' : ''}{con === f.b.length ? (con === 1 ? '1 batalla' : con + ' batallas') : con + ' de ' + f.b.length + ' con veredicto'}</small></summary>
            <ul className="lpg-bats">
              {f.b.map(([a, b, g, como, pa, pb, mid, vid], k) => {
                const ganoA = g && g === a;
                return (
                  <li key={k} className={(h.esYo(a) || h.esYo(b) ? 'yo ' : '') + (g ? '' : 'pend')}>
                    <span className="lpg-lados">
                      <span className={g ? (ganoA ? 'gana' : 'pierde') : ''}>{h.nombre(a)}</span>
                      <i aria-hidden="true">vs</i>
                      <span className={g ? (ganoA ? 'pierde' : 'gana') : ''}>{h.nombre(b)}</span>
                    </span>
                    <span className="lpg-res">
                      {g ? <em className={'lpg-como ' + (como === 'replica' ? 'rep' : 'dir')}>{como === 'replica' ? 'Réplica' : 'Directa'}</em> : <em className="lpg-como sin">Sin veredicto</em>}
                      {pa !== '' && pb !== '' && pa != null ? <span className="lpg-ptb" title="PTB de cada lado">{ptbTx(pa)} – {ptbTx(pb)}</span> : null}
                      {vid ? <button type="button" className="lpg-vid" onClick={() => abrirVideo({ vid, tit: limpio(a) + ' vs ' + limpio(b), link: 'https://www.youtube.com/watch?v=' + vid })} aria-label={'Ver el video de ' + limpio(a) + ' contra ' + limpio(b)}>▶</button> : null}
                      {L.vlink && mid ? <a className="lpg-ver" href={L.vlink + mid} target="_blank" rel="noopener noreferrer" aria-label="El veredicto en Discord">↗</a> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
      <p className="lg-nota">«Semana del…»: su servidor no escribe la jornada en el veredicto, así que van por la semana en que se cerraron. El PTB es el que dijo el veredicto.</p>
    </div>
  );
}

// ── 🚦 CÓMO VA CADA LIGA: la próxima fecha, en juego o sin batallas ────────────────────────────────────────────────────
// «Sin batallas» es lo mismo que cierra la encuesta (`ligas.vota()`: tres semanas sin batallas y sin una fecha anunciada).
// No se dice «terminó»: eso lo dice su servidor, y una liga puede volver después de un parón. ⚠️ En las clases va como
// `lgx-<c>`: `.prox` ya existe en estilo.css (las fechas del Inicio) y le redondeaba el flyer a la tarjeta
function diaCorto(d) {
  const [y, m, dd] = String(d || '').split('-').map(Number);
  if (!y || !m || !dd) return '';
  return DIAS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()].slice(0, 3).toUpperCase() + ' ' + dd;
}
function estadoLiga(liga, L) {
  // 🏆 terminó y se sabe quién la ganó (✅ Decidir, `fin`): eso manda sobre «sin batallas»
  if (L.fin && L.fin.c) return { c: 'fin', t: 'TERMINÓ · CAMPEÓN ' + limpio(L.fin.c).toUpperCase(), largo: 'Terminó: la ganó ' + limpio(L.fin.c) };
  const P = L.prox;
  if (P && P.d) {
    const hoy = liga.diaClave(liga.ahora);
    const dia = P.t ? liga.diaClave(P.t) : P.d;
    const faltan = Math.round((Date.parse(dia) - Date.parse(hoy)) / 86400000);
    if (faltan >= 0) {
      return {
        c: 'prox', t: (faltan === 0 ? 'SE JUEGA HOY' : 'PRÓXIMA · ' + (faltan === 1 ? 'MAÑANA' : diaCorto(dia))) + (P.j ? ' · J' + P.j : ''),
        largo: (faltan === 0 ? 'Se juega hoy' : faltan === 1 ? 'Se juega mañana' : 'Se juega el ' + diaDe(dia)) + (P.j ? ', jornada ' + P.j : ''),
      };
    }
  }
  const viva = L.vota ? utc(L.vota) > liga.ahora : !!(L.ult_t && liga.ahora - utc(L.ult_t) < 21 * 86400000);
  if (viva) return { c: 'juego', t: 'EN JUEGO' + (L.j ? ' · J' + L.j : ''), largo: 'En juego' + (L.j ? ', va por la jornada ' + L.j : '') };
  const sem = Math.max(3, Math.floor((liga.ahora - utc(L.ult_t)) / (7 * 86400000)));
  return { c: 'quieta', t: 'SIN BATALLAS · ' + sem + ' SEM', largo: 'Sin batallas desde el ' + diaDe(liga.diaClave(L.ult_t)).replace(/^\S+ /, '') };
}

// 🔑 el perfil de cada nombre y quién sos vos: el de la tabla del lobby, y si no está ahí, el que manda el ciclo (`ks`,
// 14/10/2026: ForceGP es staff, no está entre los que jugaron eventos, y «le pico donde dice FORCE y no me lleva a nada»)
function herramientas(liga, L) {
  const yo = liga.yo;
  const kDe = (raw) => { const f = liga.fila(raw); return f ? f.k : ((L.ks || {})[raw] || ''); };
  const miK = (window.DC && window.DC.clave) || (yo && yo.k) || '';
  const esYo = (raw) => (!!yo && liga.esDe(raw, yo.k)) || (!!miK && kDe(raw) === miK);
  const nombre = (raw, cls) => {
    const k = kDe(raw);
    return k ? <a className={cls} href={'#/r/' + encodeURIComponent(k)}>{limpio(raw)}</a> : <span className={cls}>{limpio(raw)}</span>;
  };
  const cara = (raw, cls = 'cara dv-cara') => {
    const k = kDe(raw);
    return k ? <Cara liga={liga} k={k} nombre={raw} cls={cls} /> : <span className={cls + ' ini'}>{(limpio(raw).slice(0, 1) || '?').toUpperCase()}</span>;
  };
  return { kDe, esYo, nombre, cara, miK };
}
// la del lobby y su detalle (`fechas`, `flyer` y los perfiles de los nombres que sólo están en las fechas)
function conDetalle(L0, det) {
  if (!L0) return null;
  const dL = det[L0.id] || {};
  return Object.assign({}, L0, dL, { ks: Object.assign({}, L0.ks || {}, dL.ks || {}) });
}
const aLiga = (L) => '#/ligas/' + encodeURIComponent(L.id);

// ── 🏆 EL TORNEO: la encuesta, la tabla y las fechas; al costado, el flyer y la próxima ────────────────────────────────
function Torneo({ liga, L, h }) {
  const V = useVotos();
  const [mios, setMios] = useState(leerMios);
  const [va, setVa] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { setErr(''); }, [L.id]);
  // el voto que se tocó antes de entrar con Discord: sale solo al volver a la liga
  useEffect(() => {
    let p = null;
    try { p = JSON.parse(sessionStorage.getItem('lg:ligavoto-pend') || 'null'); } catch (e) { p = null; }
    if (!p || p.liga !== L.id || !window.conCuenta) return;
    try { sessionStorage.removeItem('lg:ligavoto-pend'); } catch (e) { /* igual */ }
    votar(p.op, true);
  }, [L.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const cuenta = cuentaDe(L.id);
  const tot = useMemo(() => (L.tabla || []).reduce((s, f) => s + (Number(cuenta[f[0]]) || 0), 0), [L, cuenta, V.t]); // eslint-disable-line react-hooks/exhaustive-deps
  const abierta = !!(L.vota && utc(L.vota) > liga.ahora);
  const mio = mios[L.id] || '';
  function votar(op, solo) {
    if (!abierta || va) return;
    if (!window.conCuenta) { setErr('No pude guardar tu voto. Prueba de nuevo en un rato.'); return; }
    setVa(op);
    setErr('');
    window.conCuenta('/api/avisos/liga-votar', { liga: L.id, op }).then((j) => {
      setVa('');
      if (j && j.ok) {
        const m = Object.assign(leerMios(), { [L.id]: op });
        try { localStorage.setItem('lg:ligavotos', JSON.stringify(m)); } catch (e) { /* igual */ }
        setMios(m);
        VOTOS.post[L.id] = { t: j.t || Date.now(), cuenta: j.cuenta || {} };
        VOTOS.oyentes.forEach((f) => f());
        return;
      }
      const e = (j && j.error) || '';
      if (j && j.status === 401 && !solo) {
        try { sessionStorage.setItem('lg:ligavoto-pend', JSON.stringify({ liga: L.id, op })); } catch (x) { /* igual */ }
        setErr('entrar');
        return;
      }
      setErr((window.errorCuenta && window.errorCuenta(e)) || (e === 'cerrada' ? 'La encuesta de esta liga ya cerró.'
        : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva para votar.'
          : e === 'opcion' ? 'La tabla cambió: recarga la página y vota de nuevo.' : 'No pude guardar tu voto. Prueba de nuevo en un rato.'));
    }).catch(() => { setVa(''); setErr('No pude guardar tu voto. Prueba de nuevo en un rato.'); });
  }
  const top = (L.tabla || []).map((f) => [f[0], Number(cuenta[f[0]]) || 0]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1])[0];
  const lado = L.flyer || L.prox;
  return (
    <div className={'lgt sin-cab' + (lado ? ' con-lado' : '')}>
      {lado ? (
        <aside className="lgt-lado">
          {L.flyer ? <Flyer liga={liga} L={L} /> : null}
          {L.prox ? <Proxima liga={liga} P={L.prox} /> : null}
        </aside>
      ) : null}
      <div className="lgt-main">
        {L.vota ? (
          <div className={'lgt-enc' + (abierta ? '' : ' cerrada')}>
            <p className="lgt-enc-t"><b>🗳️ ¿Quién gana {L.n}?</b>
              {abierta ? <> Toca el % de quien crees que gana: un voto por cuenta de Discord, y lo puedes cambiar hasta que la liga termine.</>
                : <> La encuesta cerró: la liga lleva tres semanas sin batallas.</>}</p>
            <small>{tot ? num(tot) + (tot === 1 ? ' voto' : ' votos') + (top ? ' · va ganando ' + limpio(top[0]) : '') : abierta ? 'Todavía nadie votó: ¿eres el primero?' : 'Nadie votó.'}
              {abierta ? ' · cierra el ' + diaDe(liga.diaClave(L.vota)).replace(/^\S+ /, '') + ' si no hay más batallas' : ''}</small>
            {err === 'entrar' ? (
              <p className="lgt-enc-e">Para votar, entra con Discord. <button type="button" className="btn verde chico" onClick={() => accion.entrar()}>Entrar con Discord</button>
                <small>Tu voto queda guardado: sale solo cuando vuelvas a esta liga.</small></p>
            ) : err ? <p className="lgt-enc-e" role="status">{err}</p> : null}
          </div>
        ) : null}
        {/* 🗣️ qué es cada número (lo que no se entiende no se usa): «5/6» solo no dice que son ganadas de jugadas */}
        <p className="lgt-ley"><span><b>G/J</b> ganadas de jugadas</span><span><b>PTS</b> puntos</span>{L.vota ? <span><b>%</b> quién gana, según los votos</span> : null}</p>
        <ol className={'dv-tabla lg-tabla lgt-tabla' + (L.vota ? ' con-voto' : '')}>
          {(L.tabla || []).map(([raw, pj, pg, pts], i) => {
            const n = Number(cuenta[raw]) || 0;
            const p = pct(n, tot);
            const esMio = mio === raw;
            return (
              <li key={raw} className={h.esYo(raw) ? 'yo' : ''}>
                <span className="dv-i">{i + 1}</span>
                {h.cara(raw)}
                {h.nombre(raw, 'dv-n')}
                <span className="lg-pj" title="ganadas de jugadas">{pg}/{pj}</span>
                <b className="dv-p">{pts}</b>
                {L.vota ? (abierta ? (
                  <button type="button" className={'lgt-v' + (esMio ? ' mio' : '') + (va === raw ? ' va' : '')} aria-pressed={esMio}
                    disabled={!!va} onClick={() => votar(raw)} style={{ '--p': p + '%' }}
                    aria-label={(esMio ? 'Tu voto: ' : 'Votar a ') + limpio(raw) + ' para ganar ' + L.n + ' · ' + p + '% de los votos'}>
                    <i aria-hidden="true" />{esMio ? '✓ ' : ''}{p}%</button>
                ) : <span className="lgt-v cerrada" style={{ '--p': p + '%' }} aria-label={p + '% de los votos'}><i aria-hidden="true" />{p}%</span>) : null}
              </li>
            );
          })}
        </ol>
        <p className="lg-nota">La tabla sale de los veredictos que se pudieron leer: directa 3 puntos, réplica 2 y 1, sin los invitados.
          {L.link ? <> La oficial, con sanciones y defaults, está en <a className="te-link" href={L.link} target="_blank" rel="noopener noreferrer">su Discord</a>.</> : null}</p>
        <AvisarLiga key={L.id} L={L} />
      </div>
    </div>
  );
}

// 🥇 LOS TRES DE ARRIBA, COMO UN PODIO DE VERDAD (Dlx, 18/10/2026: «el top 3 podría ser mejor»): cada uno arriba de su
// escalón —el primero en el más alto, al medio—, con el color de su medalla, y los escalones apoyados en el piso del
// encabezado. Con la cara: muchos de los que juegan ligas no tienen carta
function Podio3({ L, h }) {
  const top = (L.tabla || []).slice(0, 3);
  if (top.length < 2) return null;
  return (
    <ol className="lgp-podio" aria-label={'Los primeros de ' + L.n}>
      {top.map(([raw, pj, pg, pts], i) => (
        <li key={raw} className={'lgp-p p' + (i + 1) + (h.esYo(raw) ? ' yo' : '')}>
          <span className="lgp-quien">
            {h.cara(raw, 'lgp-cara')}
            {h.nombre(raw, 'lgp-nom')}
            <small><b>{typeof pts === 'number' ? <Numero v={pts} /> : pts}</b> PTS · {pg} de {pj}</small>
          </span>
          <span className="lgp-paso">{i + 1}º</span>
        </li>
      ))}
    </ol>
  );
}

// ── 📊 LOS NÚMEROS DE LA LIGA (Dlx, 17/10/2026): sale de las fechas que ya viajan —nada nuevo que pesar—. El MVP de
// cada jornada es el de más PTB (como lo cuentan las FMH), y con el PTB también la mejor batalla y la más pareja; sin
// PTB (FZ League no lo publica) quedan la racha y las directas ────────────────────────────────────────────────────────
// ⚠️ LOS 🎮 INVITADOS NO CUENTAN (no son de la liga: UKNOW salía MVP de FMH España), y un PTB muy lejos del resto de la
// liga tampoco se compara: es otra escala (un veredicto que publicó la suma de los jurados en vez del promedio)
const ptbOk = (v, tope) => v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= tope;
function numerosDe(L) {
  const fs = L.fechas || [];
  const orden = [];
  for (let i = fs.length - 1; i >= 0; i--) for (const b of fs[i].b) orden.push([fs[i], b]);
  const todos = [];
  for (const f of fs) for (const b of f.b) for (const v of [b[4], b[5]]) if (ptbOk(v, Infinity)) todos.push(Number(v));
  todos.sort((u, v) => u - v);
  const tope = todos.length ? 2 * todos[Math.floor(todos.length / 2)] : Infinity;
  const mvp = [];
  let mejor = null, pareja = null;
  const racha = {}, top = {}, dir = {};
  for (const f of fs) {
    let m = null;
    for (const [a, b, g, , pa, pb, , , ex = ''] of f.b) {
      if (!g) continue;
      for (const [n, v, lado] of [[a, pa, 'a'], [b, pb, 'b']]) {
        if (ex.includes(lado) || !ptbOk(v, tope)) continue;
        if (!m || Number(v) > m[1]) m = [n, Number(v)];
      }
    }
    if (m) mvp.push([tituloFecha(f), m[0], m[1]]);
  }
  for (const [f, [a, b, g, como, pa, pb, , , ex = '']] of orden) {
    if (!g) continue;
    if (!ex && ptbOk(pa, tope) && ptbOk(pb, tope)) {
      const x = Number(pa), y = Number(pb);
      if (!mejor || x + y > mejor[2]) mejor = [a, b, x + y, tituloFecha(f)];
      const d = Math.abs(x - y);
      if (!pareja || d < pareja[2]) pareja = [a, b, d, tituloFecha(f)];
    }
    const lg = g === a ? 'a' : 'b', lp = g === a ? 'b' : 'a';
    const p = g === a ? b : a;
    if (!ex.includes(lp)) racha[p] = 0;
    if (ex.includes(lg)) continue;
    racha[g] = (racha[g] || 0) + 1;
    if (!top[g] || racha[g] > top[g]) top[g] = racha[g];
    if (como === 'directa') dir[g] = (dir[g] || 0) + 1;
  }
  const max = (o) => Object.entries(o).sort((u, v) => v[1] - u[1])[0];
  return { mvp, mejor, pareja, racha: max(top), directas: max(dir), ahora: max(racha) };
}
function Numeros({ L, h }) {
  const N = useMemo(() => numerosDe(L), [L]);
  const tarjetas = [];
  if (N.mejor) tarjetas.push(['🔥', 'La batalla con más PTB', <>{h.nombre(N.mejor[0])} vs {h.nombre(N.mejor[1])}</>, ptbTx(Math.round(N.mejor[2] * 10) / 10) + ' PTB · ' + N.mejor[3]]);
  if (N.pareja) tarjetas.push(['⚖️', 'La más pareja', <>{h.nombre(N.pareja[0])} vs {h.nombre(N.pareja[1])}</>, (N.pareja[2] ? ptbTx(Math.round(N.pareja[2] * 10) / 10) + ' de diferencia' : 'empataron en PTB') + ' · ' + N.pareja[3]]);
  if (N.racha && N.racha[1] >= 2) tarjetas.push(['📈', 'La racha más larga', h.nombre(N.racha[0]), N.racha[1] + ' ganadas seguidas']);
  if (N.ahora && N.ahora[1] >= 2 && (!N.racha || N.ahora[0] !== N.racha[0] || N.ahora[1] !== N.racha[1])) tarjetas.push(['⚡', 'En racha ahora', h.nombre(N.ahora[0]), N.ahora[1] + ' ganadas seguidas']);
  if (N.directas) tarjetas.push(['🎯', 'Más directas', h.nombre(N.directas[0]), N.directas[1] + (N.directas[1] === 1 ? ' victoria directa' : ' victorias directas')]);
  if (!tarjetas.length && !N.mvp.length) return <p className="pronto-p">Todavía no hay batallas con veredicto para sacar números.</p>;
  return (
    <div className="lpg-num">
      {tarjetas.length ? (
        <ul className="lpg-tarjetas">
          {tarjetas.map(([ico, t, quien, extra]) => (
            <li key={t}><span className="lpg-ico" aria-hidden="true">{ico}</span><small>{t}</small><b>{quien}</b><span>{extra}</span></li>
          ))}
        </ul>
      ) : null}
      {N.mvp.length ? (
        <>
          <h4 className="lg-st">El MVP de cada fecha</h4>
          <ol className="lpg-mvp">
            {N.mvp.map(([f, n, v]) => (
              <li key={f}><small>{f}</small>{h.cara(n, 'cara dv-cara')}{h.nombre(n, 'lpg-mvp-n')}<b>{ptbTx(v)} PTB</b></li>
            ))}
          </ol>
          <p className="lg-nota">El MVP es el de más PTB en una batalla de esa fecha, con el PTB que dijo cada veredicto.</p>
        </>
      ) : null}
    </div>
  );
}

// ── 🧑‍⚖️ EL STAFF (Dlx, 17/10/2026): quién la organiza y quiénes la juzgan o la hostean. Sale de quién publica en sus
// canales de anuncios y de veredictos (`ligas.staff_de()`); quien sólo juega no está ─────────────────────────────────────
function Staff({ liga, L }) {
  const st = L.staff || [];
  const kDe = (k) => (k ? '#/r/' + encodeURIComponent(k) : '');
  const fila = ([n, k, an, ver]) => (
    <li key={n + k}>
      {k ? <Cara liga={liga} k={k} nombre={n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{(limpio(n).slice(0, 1) || '?').toUpperCase()}</span>}
      {k ? <a className="lpg-st-n" href={kDe(k)}>{limpio(n)}</a> : <span className="lpg-st-n">{limpio(n)}</span>}
      <small>{[an ? an + (an === 1 ? ' anuncio' : ' anuncios') : '', ver ? ver + (ver === 1 ? ' veredicto' : ' veredictos') : ''].filter(Boolean).join(' · ')}</small>
    </li>
  );
  const org = st.filter((x) => x[2] >= 2);
  const jur = st.filter((x) => x[2] < 2 && x[3] >= 3);
  return (
    <div className="lpg-staff">
      {org.length ? <><h4 className="lg-st">La organizan</h4><ul className="lpg-st">{org.map(fila)}</ul></> : null}
      {jur.length ? <><h4 className="lg-st">Jurados y hosts</h4><ul className="lpg-st">{jur.map(fila)}</ul></> : null}
      <p className="lg-nota">Sale de quién publica en sus canales de anuncios y de veredictos de los últimos dos meses.</p>
    </div>
  );
}

// ── 🖼️ LOS FLYERS (Dlx, 17/10/2026: «más flyers»): los afiches de la temporada, re-alojados por el ciclo. Un toque abre
// el grande, sin salir de la página ────────────────────────────────────────────────────────────────────────────────────
function Flyers({ liga, L }) {
  const [abierto, setAbierto] = useState(null);
  const cerrar = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    if (cerrar.current) cerrar.current.focus();
    const k = (e) => { if (e.key === 'Escape') setAbierto(null); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [abierto]);
  const fl = L.flyers || [];
  return (
    <div className="lpg-flyers">
      <ul className="lpg-gal">
        {fl.map((F) => (
          <li key={F.u}>
            <button type="button" onClick={() => setAbierto(F)} aria-label={'Ver grande: ' + (F.tit ? limpio(F.tit) : 'el flyer')}>
              <img alt="" src={F.u} width={F.w || undefined} height={F.h || undefined} loading="lazy" decoding="async" />
            </button>
            <small>{F.tit ? <b>{limpio(F.tit)}</b> : null}{liga.cuando(F.t)}</small>
          </li>
        ))}
      </ul>
      {abierto ? (
        <div className="lgt-zoom" role="dialog" aria-modal="true" aria-label={abierto.tit ? limpio(abierto.tit) : 'El flyer'} onClick={() => setAbierto(null)}>
          <img alt={abierto.tit ? limpio(abierto.tit) : 'El flyer de ' + L.n} src={abierto.u} />
          <span className="lpg-zoom-b" onClick={(e) => e.stopPropagation()}>
            {abierto.link ? <a className="btn borde2 chico" href={abierto.link} target="_blank" rel="noopener noreferrer">En Discord ↗</a> : null}
            <a className="btn borde2 chico" href={abierto.u} target="_blank" rel="noopener noreferrer">Abrir la imagen</a>
            <button type="button" ref={cerrar} className="btn borde2 chico" onClick={() => setAbierto(null)}>Cerrar</button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ── 🎬 LOS VIDEOS (Dlx, 17/10/2026): las batallas de la liga que subieron los canales de los socios (`bot/videos.py`), de
// esta temporada y de las anteriores ─────────────────────────────────────────────────────────────────────────────────
function Videos({ L }) {
  return (
    <ul className="lpg-vids">
      {(L.vids || []).map(([vid, tit]) => (
        <li key={vid}>
          <button type="button" onClick={() => abrirVideo({ vid, tit, link: 'https://www.youtube.com/watch?v=' + vid })}>
            <span className="lpg-vid-m"><Miniatura vid={vid} cls="lpg-vid-img" /><i aria-hidden="true">▶</i></span>
            <b>{tit}</b>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── 📖 CÓMO FUNCIONA Y EL HISTORIAL (Dlx, 17/10/2026): lo que publicó su servidor (`datos/ligas_info.json`) y los
// campeones: los de antes y el de esta temporada, si Dlx ya lo confirmó (el Salón) ─────────────────────────────────────
function Como({ L, h }) {
  const inf = L.info || {};
  const hist = [...(inf.hist || [])];
  if (L.fin && L.fin.c) hist.push(['Esta temporada', L.fin.c, 'campeón']);
  return (
    <div className="lpg-comof">
      {(inf.fmt || []).length ? <ul className="lpg-reglas">{inf.fmt.map((x) => <li key={x}>{x}</li>)}</ul> : null}
      {hist.length ? (
        <>
          <h4 className="lg-st">Los campeones</h4>
          <ol className="lpg-hist">
            {hist.slice().reverse().map(([t, c, nota]) => (
              <li key={t + c}><small>{t}</small><b>🏆 {h.nombre(c)}</b>{nota ? <span>{nota}</span> : null}</li>
            ))}
          </ol>
        </>
      ) : null}
      {inf.fuente ? <p className="lg-nota">{inf.fuente}, relevado por la Liga. Si algo cambió, lo que vale es lo que diga su servidor.</p> : null}
    </div>
  );
}

// ── 🔔 SEGUIR LA LIGA (Dlx, 17/10/2026): la campana avisa cuando hay resultados o una fecha nueva (`ligasSeguidas()` en
// bot/avisos.js). Con Discord; las que seguís se piden una vez y se recuerdan mientras la página está abierta ─────────────
const MIAS = { ligas: null, celular: false, pedido: false, oyentes: new Set() };
function pedirMias() {
  if (MIAS.pedido || !window.conCuenta || !window.DC) return;
  MIAS.pedido = true;
  window.conCuenta('/api/avisos/mis-ligas', {}).then((j) => {
    if (j && j.ok) { MIAS.ligas = j.ligas || []; MIAS.celular = !!j.celular; MIAS.oyentes.forEach((f) => f()); } else MIAS.pedido = false;
  }).catch(() => { MIAS.pedido = false; });
}
function SeguirLiga({ L }) {
  const [, setN] = useState(0);
  const [va, setVa] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    MIAS.oyentes.add(f);
    pedirMias();
    return () => { MIAS.oyentes.delete(f); };
  }, []);
  const sigo = !!(MIAS.ligas && MIAS.ligas.includes(L.id));
  const tocar = () => {
    if (va) return;
    if (!window.conCuenta) { setErr('No pude. Prueba de nuevo en un rato.'); return; }
    setVa(true);
    setErr('');
    window.conCuenta('/api/avisos/liga-seguir', { liga: L.id, on: !sigo }, 's').then((j) => {
      setVa(false);
      if (j === null) return;
      if (j && j.ok) { MIAS.ligas = j.ligas || []; MIAS.celular = !!j.celular; MIAS.pedido = true; MIAS.oyentes.forEach((f) => f()); return; }
      setErr((window.errorCuenta && window.errorCuenta(j && j.error)) || (j && j.error === 'tope' ? 'Ya sigues muchas ligas.' : 'No pude. Prueba de nuevo en un rato.'));
    }).catch(() => { setVa(false); setErr('No pude. Prueba de nuevo en un rato.'); });
  };
  return (
    <span className="lpg-seguir">
      <button type="button" className={'btn ' + (sigo ? 'borde2' : 'verde')} aria-pressed={sigo} disabled={va} onClick={tocar}>
        {va ? '…' : sigo ? '✓ La sigues' : '🔔 Seguir la liga'}
      </button>
      {sigo ? <small>{MIAS.celular ? 'Te avisamos en la campana y al celular cuando hay resultados o una fecha nueva.' : 'Te avisamos en la campana de arriba. Para que llegue al celular, activa los avisos en Mi cuenta → Avisos de eventos.'}</small> : null}
      {err ? <small role="status">{err}</small> : null}
    </span>
  );
}

// ── 🗂️ LAS PESTAÑAS DE CADA LIGA (Dlx, 17/10/2026, a «¿qué le sumamos?»: las ocho). Una sola página larga con todo
// sería demasiado: van en pestañas, y cada una sólo si tiene con qué ────────────────────────────────────────────────────
const PEST = [['tabla', 'La tabla'], ['ascenso', 'Ascenso'], ['fechas', 'Fechas'], ['numeros', 'Números'], ['staff', 'Staff'], ['flyers', 'Flyers'],
  ['videos', 'Videos'], ['como', 'Cómo funciona']];
function hay(L, k) {
  return k === 'tabla' ? true : k === 'ascenso' ? !!(L.asc && (L.asc.filas || []).length) : k === 'fechas' ? (L.fechas || []).length > 0 : k === 'numeros' ? (L.fechas || []).some((f) => f.b.some((b) => b[2]))
    : k === 'staff' ? (L.staff || []).some((x) => x[2] >= 2 || x[3] >= 3) : k === 'flyers' ? (L.flyers || []).length > 0
      : k === 'videos' ? (L.vids || []).length > 0 : k === 'como' ? !!(L.info || (L.fin && L.fin.c)) : false;
}

// ── 🏟️ EL PERFIL DE CADA LIGA (`#/ligas/<id>`): su servidor, cómo va, el podio, el torneo y las otras ──────────────────
function LigaPerfil({ liga, id }) {
  const D = liga.d.ligas;
  const det = useDetalle(D ? D.t : null);
  useEffect(() => { window.scrollTo(0, 0); }, [id]);
  // 🗂️ la pestaña, ANTES de cualquier `return`: un hook después de uno se rompe cuando la liga todavía no llegó
  const [tab, setTab] = useState('tabla');
  useEffect(() => { setTab('tabla'); }, [id]);
  const desliza = useDesliza(tab, PEST.map(([k]) => k));
  const ls = liga.ligas();
  const L = conDetalle(ls.find((x) => x.id === id), det);
  if (!L) return <LigasInicio liga={liga} falta={id} />;
  const h = herramientas(liga, L);
  const s = liga.svs[L.sv] || {};
  const sig = siglaDe(L.sv);
  const color = s.color || '#E41373';
  const est = estadoLiga(liga, L);
  const ultima = L.ult_t ? diaDe(liga.diaClave(L.ult_t)).replace(/^\S+ (\d+) de (\S+)$/, (m, d, mes) => d + '/' + String(MESES.indexOf(mes) + 1).padStart(2, '0')) : '';
  // las de su servidor primero
  const otras = ls.filter((x) => x.id !== L.id).sort((a, b) => (b.sv === L.sv) - (a.sv === L.sv));
  const pest = PEST.filter(([k]) => hay(L, k));
  const tv = pest.some(([k]) => k === tab) ? tab : 'tabla';
  return (
    <>
      <div className={'escena lgp-esc lgx-' + est.c} style={{ '--mo-c': color, '--mo-o': 0.9, ...silueta(L.sv, color) }}>
        <nav className="lgp-miga" aria-label="Volver"><a href="#/ligas"><Ico n="flecha" t={16} />Todas las ligas</a></nav>
        <section className="svp lgp-cab">
          <img className="svp-logo" alt="" src={liga.logo(L.sv, true)} />
          <div className="svp-tx">
            <span className="tag">LIGA · {sig}</span>
            <h1 className="hero-ev largo">{L.n}</h1>
            <p className="hero-p lgp-p0"><span className={'lgp-est lgx-' + est.c}>{est.largo}</span> · de <a href={'#/sv/' + sig}>{s.nombre || sig}</a></p>
            <div className="hero-acc">
              <SeguirLiga key={L.id} L={L} />
              <Compartir cls="btn borde" url={enlace(aLiga(L))} texto={'La tabla de ' + L.n + ' en la Liga Global'} />
            </div>
            {/* la suya, como link: tres botones se apilaban en dos renglones (Dlx, 18/10/2026: «está muy pegado») */}
            {L.link ? <a className="te-link lgp-dc" href={L.link} target="_blank" rel="noopener noreferrer">Su tabla en Discord ↗</a> : null}
          </div>
          <dl className="svp-num lgp-num">
            {L.j ? <div><dt>JORNADA</dt><dd>{L.j}</dd></div> : <div><dt>ÚLTIMA</dt><dd>{ultima || '—'}</dd></div>}
            <div><dt>BATALLAS</dt><dd>{num(L.bat)}</dd></div>
            <div><dt>RAPEROS</dt><dd>{num((L.tabla || []).length)}</dd></div>
          </dl>
        </section>
        {L.fin && L.fin.c ? <p className="lgp-campeon"><Ico n="copa" t={18} /> Campeón: {h.nombre(L.fin.c, 'lgp-campeon-n')}</p> : null}
        <Podio3 L={L} h={h} />
      </div>
      {pest.length > 1 ? (
        <nav className="lpg-tabs" role="tablist" aria-label={'Lo de ' + L.n}>
          {pest.map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={tv === k} className={tv === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>
          ))}
        </nav>
      ) : null}
      <div className="lpg-pest" ref={desliza}>
      {tv === 'tabla' ? (
        <>
          <Sec id="lgp-tabla" titulo="La tabla" extra="lgp-sec"><Torneo liga={liga} L={L} h={h} /></Sec>
        </>
      ) : null}
      {tv === 'ascenso' ? (
        <Sec id="lgp-asc" titulo={'Ascenso a la ' + L.asc.n} extra="lgp-sec"><Ascenso A={L.asc} h={h} desde={L.id} /></Sec>
      ) : null}
      {tv === 'fechas' ? <Sec id="lgp-fechas" titulo="Las fechas" extra="lgp-sec"><Fechas liga={liga} L={L} h={h} /></Sec> : null}
      {tv === 'numeros' ? <Sec id="lgp-numeros" titulo="Los números" extra="lgp-sec"><Numeros L={L} h={h} /></Sec> : null}
      {tv === 'staff' ? <Sec id="lgp-staff" titulo="El staff" extra="lgp-sec"><Staff liga={liga} L={L} /></Sec> : null}
      {tv === 'flyers' ? <Sec id="lgp-flyers" titulo="Los flyers" extra="lgp-sec"><Flyers liga={liga} L={L} /></Sec> : null}
      {tv === 'videos' ? <Sec id="lgp-videos" titulo="Los videos" extra="lgp-sec"><Videos L={L} /></Sec> : null}
      {tv === 'como' ? <Sec id="lgp-como" titulo="Cómo funciona" extra="lgp-sec"><Como L={L} h={h} /></Sec> : null}
      </div>
      {otras.length ? (
        <Sec id="lgp-otras" titulo="Las otras ligas" enlace="Todas" href="#/ligas">
          {/* filas parejas en la compu (18/10/2026): diez en dos de cinco, no siete y tres con un hueco al lado */}
          <nav className="lgp-otras" aria-label="Las otras ligas" style={{ '--cols': Math.ceil(otras.length / Math.ceil(otras.length / 6)) }}>
            {otras.map((x) => (
              <a key={x.id} href={aLiga(x)} style={{ '--c': (liga.svs[x.sv] || {}).color || '#E41373' }}>
                <img alt="" src={liga.logo(x.sv)} /><b>{x.n}</b><small>{siglaDe(x.sv)}</small>
              </a>
            ))}
          </nav>
        </Sec>
      ) : null}
    </>
  );
}

// 📈 EL ASCENSO, AL DÍA (Dlx, 17/10/2026: «crear un ascenso actualizado para cada servidor para sus ligas», «y también
// que esté en la página, obvio»; y a «¿mostramos sólo la oficial o también la calculada?», «Va»). Lo arma el ciclo
// (`bot/ascenso.py`): SU tabla oficial más lo que vino después, con SUS reglas, y lo que no se sabe no suma y se dice.
// Lo oficial lo decide su staff: la página lo aclara arriba. Los que suben y el play-off, marcados; `+N`, lo sumado
const dm = (d) => (d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) : '');
export function Ascenso({ A, h, desde = '' }) {
  const [todo, setTodo] = useState(false);
  const filas = A.filas || [];
  const ver = todo ? filas : filas.slice(0, 12);
  const suben = A.suben || 0, po = A.po || 0;
  return (
    <div className="asc-caja">
      {/* en las otras ligas del servidor, el ascenso es el camino de abajo: se dice adónde lleva */}
      {desde && A.dest && desde !== A.dest ? (
        <p className="asc-p asc-camino">En {siglaDe(A.sv)}, a la <b>{A.n}</b> se sube con este ranking. <a className="te-link" href={'#/ligas/' + encodeURIComponent(A.dest)}>Ver la {A.n} →</a></p>
      ) : null}
      <p className="asc-p">La tabla oficial de {siglaDe(A.sv)}{A.of ? ' (la del ' + dm(A.of) + ')' : ''} más lo que se jugó después,
        con sus mismas reglas. <b>Lo oficial lo decide su staff.</b></p>
      <ol className="asc-t">
        {ver.map(([n, cc, pts, suma, k], i) => (
          <li key={i + n} className={(i < suben ? 'sube' : i < suben + po ? 'po' : '') + (k && k === h.miK ? ' yo' : '')}>
            <span className="asc-i">{i + 1}</span>
            <span className="asc-n">{cc ? <Bandera cc={cc} /> : null}{k ? <a href={'#/r/' + encodeURIComponent(k)}>{limpio(n)}</a> : <span>{limpio(n)}</span>}</span>
            {suma ? <em className="asc-mas">+{num(suma)}</em> : <span />}
            <b className="asc-pts">{num(pts)}</b>
          </li>
        ))}
      </ol>
      {filas.length > 12 ? <button type="button" className="btn borde2 chico" onClick={() => setTodo(!todo)}>{todo ? 'Ver menos' : 'Ver los ' + filas.length}</button> : null}
      <p className="asc-ley"><span className="asc-c sube">Sube</span>{po ? <span className="asc-c po">Play-off</span> : null}<em className="asc-mas">+N</em> lo que se sumó a la oficial</p>
      {(A.sum || []).length ? <p className="asc-p">🆕 Se sumó: {A.sum.map(([e, d, r]) => limpio(e) + ' (' + dm(d) + ', rango ' + String(r).toUpperCase() + ')').join(' · ')}.</p> : null}
      {(A.pend || []).length ? <p className="asc-p">⏳ Todavía no suma: {A.pend.map(([e, d, q]) => limpio(e) + ' (' + dm(d) + '): ' + (q === 'rango' ? 'falta saber su rango' : q)).join(' · ')}</p> : null}
    </div>
  );
}

// 🃏 cada liga en la portada: su flyer (o el escudo de su servidor si no publicó ninguno), cómo va y quién lidera. La
// tarjeta entera es el link: adentro no va otro (por eso el nombre del primero es texto)
function TarjetaLiga({ liga, L, est }) {
  const s = liga.svs[L.sv] || {};
  const h = herramientas(liga, L);
  const lider = (L.tabla || [])[0];
  return (
    <a className={'lgh-c lgx-' + est.c} href={aLiga(L)} style={{ '--c': s.color || '#E41373' }}>
      <span className="lgh-img">
        {L.fl ? <img alt="" src={L.fl} loading="lazy" decoding="async" />
          : <span className="lgh-sin"><img alt="" src={liga.logo(L.sv, true)} loading="lazy" decoding="async" /></span>}
      </span>
      <span className="lgh-tx">
        <span className={'lgh-est lgx-' + est.c}>{est.t}</span>
        <b className="lgh-n">{L.n}</b>
        <span className="lgh-sv"><img alt="" src={liga.logo(L.sv)} />{siglaDe(L.sv)} · {num(L.bat)} {L.bat === 1 ? 'batalla' : 'batallas'} · {(L.tabla || []).length} raperos</span>
        {lider ? (
          <span className="lgh-lider">{h.cara(lider[0], 'lgh-cara')}<small>1º</small><b>{limpio(lider[0])}</b><i>{lider[3]} PTS</i></span>
        ) : null}
      </span>
    </a>
  );
}

// ── 🏟️ LA PORTADA (`#/ligas`): todas, cómo va cada una, las tuyas, las próximas fechas y lo último que pasó ─────────────
function LigasInicio({ liga, falta = '' }) {
  const ls = liga.ligas();
  const [sv, setSv] = useState('');
  const svs = useMemo(() => {
    const c = {};
    ls.forEach((L) => { c[L.sv] = (c[L.sv] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a] || siglaDe(a).localeCompare(siglaDe(b)));
  }, [ls]);
  const est = {};
  ls.forEach((L) => { est[L.id] = estadoLiga(liga, L); });
  const hs = {};
  ls.forEach((L) => { hs[L.id] = herramientas(liga, L); });
  const enJuego = ls.filter((L) => est[L.id].c !== 'quieta').length;
  const bat = ls.reduce((n, L) => n + (L.bat || 0), 0);
  const gente = new Set();
  ls.forEach((L) => (L.tabla || []).forEach(([raw]) => gente.add(hs[L.id].kDe(raw) || limpio(raw).toLowerCase())));
  // 🙋 las tuyas, con tu puesto: lo primero que se busca al entrar
  const mias = [];
  ls.forEach((L) => {
    const i = (L.tabla || []).findIndex(([raw]) => hs[L.id].esYo(raw));
    if (i >= 0) mias.push([L, i, L.tabla[i]]);
  });
  const prox = ls.filter((L) => est[L.id].c === 'prox').sort((a, b) => String(a.prox.t || a.prox.d).localeCompare(String(b.prox.t || b.prox.d)));
  // lo último que pasó: el último veredicto de cada liga (ya vienen de la más nueva a la más vieja: `para_web()`)
  const ultimos = ls.filter((L) => (L.ult || []).length && est[L.id].c !== 'quieta').slice(0, 6);
  const ver = sv ? ls.filter((L) => L.sv === sv) : ls;
  const fls = ls.filter((L) => L.fl).slice(0, 3);
  return (
    <>
      <div className="escena lgh-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.9, '--mo-c2': '#29B298' }}>
        <section className="rk-cab lgh-cab">
          <div className="rk-tx">
            <span className="tag">LIGAS · {liga.temp}</span>
            <h1 className="hero-ev largo">Ligas</h1>
            <p className="hero-p">Las ligas de los servidores, como torneos: cada una con su tabla, sus jornadas y su flyer. Arrancan y terminan cuando
              las organiza su servidor, y sus batallas suman a tus <b>duelos</b>.</p>
            {ls.length ? (
              <dl className="svp-num lgh-num">
                <div><dt>EN JUEGO</dt><dd>{enJuego}</dd></div>
                <div><dt>BATALLAS</dt><dd>{num(bat)}</dd></div>
                <div><dt>RAPEROS</dt><dd>{num(gente.size)}</dd></div>
                <div><dt>SERVIDORES</dt><dd>{svs.length}</dd></div>
              </dl>
            ) : null}
          </div>
          {fls.length >= 3 ? (
            <ol className="lgh-abanico" aria-label="Los últimos flyers">
              {[fls[1], fls[0], fls[2]].map((L, i) => (
                <li key={L.id} className={['izq', 'centro', 'der'][i]}><a href={aLiga(L)} aria-label={'Ver ' + L.n}><img alt="" src={L.fl} /></a></li>
              ))}
            </ol>
          ) : null}
        </section>
      </div>
      {/* 🏆 las dos de la Liga Global, arriba de las de los servidores */}
      <section className="sec lgf-dsec" aria-label="Las de la Liga Global"><Destacadas liga={liga} /></section>
      {falta ? <p className="sec lgh-falta" role="status">Esa liga no está: puede que todavía no tenga batallas, o que haya cambiado de nombre. Acá están todas.</p> : null}
      {!ls.length ? (
        <Sec id="lgh-todas" titulo="Todas las ligas"><p className="pronto-p">Todavía ninguna liga tiene batallas: aparecen solas con la primera.</p></Sec>
      ) : null}
      {mias.length ? (
        <Sec id="lgh-mias" titulo="Tus ligas">
          <ul className="lgh-mias">{mias.map(([L, i, [, pj, pg, pts]]) => (
            <li key={L.id}><a href={aLiga(L)} style={{ '--c': (liga.svs[L.sv] || {}).color || '#E41373' }}>
              <span className="lgh-pos">{i + 1}º<small>de {L.tabla.length}</small></span>
              <span className="lgh-mt"><b>{L.n}</b><small>{pg} de {pj} {pj === 1 ? 'ganada' : 'ganadas'} · {pts} PTS · {est[L.id].t}</small></span>
              <Ico n="flecha" t={18} />
            </a></li>
          ))}</ul>
        </Sec>
      ) : null}
      {ls.length ? (
        <Sec id="lgh-todas" titulo="Todas las ligas">
          {svs.length > 1 ? (
            <div className="rk-chips lgh-fil" role="group" aria-label="Filtrar por servidor">
              <button type="button" className={!sv ? 'on' : ''} aria-pressed={!sv} onClick={() => setSv('')}>Todas · {ls.length}</button>
              {svs.map((x) => (
                <button type="button" key={x} className={sv === x ? 'on' : ''} aria-pressed={sv === x} onClick={() => setSv(sv === x ? '' : x)}>
                  <img alt="" src={liga.logo(x)} />{siglaDe(x)}
                </button>
              ))}
            </div>
          ) : null}
          <ul className="lgh-grid aparece">{ver.map((L) => <li key={L.id}><TarjetaLiga liga={liga} L={L} est={est[L.id]} /></li>)}</ul>
        </Sec>
      ) : null}
      {ls.length ? <LoMejor liga={liga} ls={ls} hs={hs} /> : null}
      <Salon liga={liga} />
      {/* 🗓️ lo que viene y lo que pasó, en una fila en la compu: una sola fecha por delante dejaba media pantalla vacía */}
      {prox.length || ultimos.length ? (
        <div className={'lgh-fila' + (prox.length && ultimos.length ? ' dos' : '')}>
          {prox.length ? (
            <Sec id="lgh-prox" titulo="Las próximas fechas">
              <div className="lgh-proxs">{prox.map((L) => (
                <div key={L.id} className="lgh-px">
                  {L.fl ? <a className="lgh-px-fl" href={aLiga(L)} tabIndex={-1} aria-hidden="true"><img alt="" src={L.fl} loading="lazy" decoding="async" /></a> : null}
                  <div className="lgh-px-d">
                    <a className="lgh-px-n" href={aLiga(L)}><img alt="" src={liga.logo(L.sv)} /><b>{L.n}</b></a>
                    <Proxima liga={liga} P={L.prox} />
                  </div>
                </div>
              ))}</div>
            </Sec>
          ) : null}
          {ultimos.length ? (
            <Sec id="lgh-ult" titulo="Lo último que pasó">
              <ul className="lgh-res">{ultimos.slice(0, prox.length ? 4 : 6).map((L) => {
                const [a, b, g, como, j] = L.ult[0];
                const h = hs[L.id];
                return (
                  <li key={L.id}>
                    <a className="lgh-res-l" href={aLiga(L)}><img alt="" src={liga.logo(L.sv)} /><b>{L.n}</b></a>
                    <span className="lgh-res-t">{h.nombre(g, 'lg-g')} le ganó a {h.nombre(g === a ? b : a, 'lg-p')}</span>
                    <small>{como === 'replica' ? 'en réplica' : 'directo'}{j ? ' · jornada ' + j : ''} · {liga.cuando(L.ult_t)}</small>
                  </li>
                );
              })}</ul>
            </Sec>
          ) : null}
        </div>
      ) : null}
      <Sec id="lgh-como" titulo="Cómo funcionan">
        <ul className="lgh-como">
          <li><b>Cada servidor arma la suya</b><span>Con sus jornadas, su tabla y sus reglas. Arranca y termina cuando la organiza su servidor.</span></li>
          <li><b>Los puntos</b><span>Ganar directo da 3 puntos; en réplica, 2 al que gana y 1 al que pierde. La tabla sale de los veredictos que leyó el bot: la oficial, con sanciones, está en el Discord de cada liga.</span></li>
          <li><b>Qué te suman</b><span>Cada batalla cuenta para tus <b>duelos</b>: el Ranking Duelos y tu Win%. Al Score competitivo, no.</span></li>
          <li><b>¿Quién gana?</b><span>En cada liga se vota quién la gana: un voto por cuenta de Discord, y se cierra cuando lleva tres semanas sin batallas.</span></li>
        </ul>
      </Sec>
    </>
  );
}

// ── 🏆 LA SUPERLIGA Y LA CLAUSURA: el cierre de la temporada, de la Liga Global ─────────────────────────────────────────
// Dlx, 16/10/2026: *«crear una superliga, agregar ahí un espacio de la Liga Global donde participará el top 16 del
// competitivo. El top 4 clasifica directo… los 12 se hacen un duelo a muerte aleatoriamente… pasarían 6, una liga de
// 10»* y *«para el evento de clausura del ranking de temporada, el top 16 simplemente se hará un torneo de 8vos»*. Y a
// las preguntas: mostrarlas ya con «si terminara hoy», la liga de 10 todos contra todos a una vuelta, y la insignia
// del campeón es del campeón de la Superliga. Las dos viven acá como dos ligas más (`#/ligas/superliga` y
// `#/ligas/clausura`): la portada de Ligas lleva una tarjeta de cada una.
//
// ⚠️ LOS 16 SE CUENTAN IGUAL QUE EL RANKING (`clasificados()` de ranking.jsx): los primeros CON NÚMERO —sin los que
// juegan fuera de concurso—, la Temporada por su puesto y el Competitivo por Score entre los que tienen rango.
// 🎟️ LOS PASES SON EL PREMIUM DE LA T2, y se dice (Dlx, 16/10/2026: «acuérdate: el pase rapero premium de la temporada
// 2, no simplemente pase rapero»). El precio sigue siendo privado.
const CIERRE = 16;
function topCierre(liga, cual) {
  const t = liga.d.tabla || [];
  if (cual === 'competitivo') return t.filter((f) => f.rg && !f.fc).sort((a, b) => (b.sc || 0) - (a.sc || 0)).slice(0, CIERRE);
  return t.filter((f) => f.pos && !f.fc).sort((a, b) => a.pos - b.pos).slice(0, CIERRE);
}
const coma = (x) => String(x == null ? '' : x).replace('.', ',');
// el último día de la temporada (`fase.termina`, de comun/temporada.py) y cuántos días faltan, en hora del este
function cierreDe(liga) {
  const fin = (liga.d.fase || {}).termina;
  if (!fin) return { fin: '', dias: NaN };
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(liga.ahora));
  return { fin, dias: Math.round((Date.parse(fin) - Date.parse(hoy)) / 86400000) };
}
const diaSin = (d) => diaDe(d).replace(/^\S+ /, '');

// una persona de las que entrarían: su número, su cara y su dato (rango y Score, o el OVR)
function Clasificado({ liga, f, n, cual, grande = false }) {
  const yo = liga.yo && f.k === liga.yo.k;
  const dato = cual === 'competitivo' ? (f.rg ? f.rg + ' · ' : '') + coma(f.sc) : 'OVR ' + (f.ovr || '—');
  return (
    <li className={'lgf-p' + (grande ? ' grande' : '') + (yo ? ' yo' : '')}>
      <a href={'#/r/' + encodeURIComponent(f.k)}>
        <span className="lgf-n">{n}</span>
        <Cara liga={liga} k={f.k} nombre={f.n} cls="lgf-cara" />
        <b>{yo ? 'Tú' : limpio(f.n)}</b>
        <small>{dato}</small>
      </a>
    </li>
  );
}

// dónde estás vos contra el corte: adentro, cuánto te falta, o qué te falta para estar en la tabla
function TuLugar({ liga, top, cual }) {
  const yo = liga.yo;
  if (!yo) return null;
  const i = top.findIndex((f) => f.k === yo.k);
  const que = cual === 'competitivo' ? 'la Superliga' : 'la Clausura';
  let txt;
  if (i >= 0) {
    txt = cual === 'competitivo' ? (i < 4 ? <>Si la temporada terminara hoy, <b>entras directo a la Superliga</b>.</> : <>Si la temporada terminara hoy, <b>vas al duelo a muerte</b> por un lugar en la Superliga.</>)
      : <>Si la temporada terminara hoy, <b>juegas la Clausura</b> como {i + 1}º.</>;
  } else if (cual === 'competitivo' && !yo.rg) {
    const pide = 10;
    txt = <>Para entrar al Competitivo hacen falta <b>{pide} eventos</b> en la temporada: llevás {yo.ev || 0}.</>;
  } else if (top.length === CIERRE) {
    const c = top[CIERRE - 1];
    const d = cual === 'competitivo' ? Math.round(((c.sc || 0) - (yo.sc || 0)) * 10) / 10 : (c.ovr || 0) - (yo.ovr || 0);
    txt = d > 0 ? <>Te faltan <b>{cual === 'competitivo' ? coma(d) + ' de Score' : d + ' de OVR'}</b> para entrar a {que}: el 16º es {limpio(c.n)}.</>
      : <>Estás pegado al 16º para entrar a {que}.</>;
  }
  return txt ? <p className="lgf-tu" role="note">{txt}</p> : null;
}

function Premios({ items }) {
  return (
    <ul className="lgf-premios">{items.map(([q, d]) => <li key={q}><b>{q}</b><span>{d}</span></li>)}</ul>
  );
}

const PREMIOS_SUPER = [
  ['El campeón', 'Una insignia especial al costado de su carta Competitiva y en su tarjeta de la Superliga, y el Pase de rapero premium de la Temporada 2.'],
  ['2º y 3º', 'El Pase de rapero premium de la Temporada 2.'],
  ['Los 10 de la Superliga', 'Su tarjeta especial de integrante de la Superliga.'],
  ['Los 6 que caen en el duelo a muerte', 'Su tarjeta especial, su reconocimiento y premios.'],
  ['El #1 del Competitivo', 'El que cierra primero el ranking gana el Pase de rapero premium de la Temporada 2.'],
];
const PREMIOS_CLAUSURA = [
  ['Campeón, 2º y 3º', 'El Pase de rapero premium de la Temporada 2, sus emblemas y más premios.'],
  ['El #1 de la Temporada', 'El que cierra primero el ranking gana el Pase de rapero premium de la Temporada 2.'],
  ['Los 16', 'Todo queda guardado: quién jugó, hasta dónde llegó y su emblema. Esta no tiene tarjeta especial.'],
];

// la cabecera de las dos: la misma del perfil de cada liga, con el logo de la Liga en vez del de un servidor
function CabFinal({ liga, tag, titulo, bajada, nums, id }) {
  return (
    <div className="escena lgp-esc lgf-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.9, '--mo-c2': '#29B298' }}>
      <nav className="lgp-miga" aria-label="Volver"><a href="#/ligas"><Ico n="flecha" t={16} />Todas las ligas</a></nav>
      <section className="svp lgp-cab">
        <img className="svp-logo" alt="" src="/ul.png" />
        <div className="svp-tx">
          <span className="tag">{tag}</span>
          <h1 className="hero-ev largo">{titulo}</h1>
          <p className="hero-p lgp-p0">{bajada}</p>
          <div className="hero-acc"><Compartir cls="btn borde" url={enlace('#/ligas/' + id)} texto={'La ' + titulo + ' de la Liga Global'} /></div>
        </div>
        <dl className="svp-num lgf-num">{nums.map(([t, v]) => <div key={t}><dt>{t}</dt><dd>{v}</dd></div>)}</dl>
      </section>
    </div>
  );
}

function Superliga({ liga }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const top = topCierre(liga, 'competitivo');
  const { fin, dias } = cierreDe(liga);
  return (
    <>
      <CabFinal liga={liga} id="superliga" tag={'LIGA GLOBAL · AL CIERRE DE LA ' + (liga.temp || 'T1')} titulo="Superliga"
        bajada={<>Los 16 primeros del <a href="#/ranking/competitivo">Competitivo</a>{fin ? <> al cierre de la temporada, el {diaSin(fin)}</> : null}. Se juega después de la Clausura y es parte de la T1: la Temporada 2 arranca cuando termina.</>}
        nums={[[dias === 0 ? 'CIERRA' : 'DÍAS AL CIERRE', dias > 0 ? dias : dias === 0 ? 'HOY' : '—'], ['CLASIFICAN', CIERRE], ['DIRECTOS', 4], ['FECHAS', 9]]} />
      <Sec id="lgf-como" titulo="Cómo se juega">
        <ol className="lgf-pasos">
          <li><span className="lgf-pn">1</span><b>Del 1º al 4º</b><span>Entran directo a la Superliga.</span></li>
          <li><span className="lgf-pn">2</span><b>Del 5º al 16º: duelo a muerte</b><span>Se sortean 6 duelos —puede tocar el 5º contra el 16º— y pasan los 6 que ganan.</span></li>
          <li><span className="lgf-pn">3</span><b>La Superliga</b><span>10 raperos, todos contra todos a una vuelta: 9 fechas. Directo da 3 puntos; réplica, 2 y 1. Gana el que más puntos hace.</span></li>
        </ol>
      </Sec>
      {top.length ? (
        <Sec id="lgf-hoy" titulo="Si terminara hoy" enlace="El Competitivo" href="#/ranking/competitivo">
          <TuLugar liga={liga} top={top} cual="competitivo" />
          <h3 className="lgf-st">Directo a la Superliga</h3>
          <ol className="lgf-lista directos">{top.slice(0, 4).map((f, i) => <Clasificado key={f.k} liga={liga} f={f} n={i + 1} cual="competitivo" grande />)}</ol>
          {top.length > 4 ? <>
            <h3 className="lgf-st">Al duelo a muerte <small>los cruces se sortean al cierre</small></h3>
            <ol className="lgf-lista" start={5}>{top.slice(4).map((f, i) => <Clasificado key={f.k} liga={liga} f={f} n={i + 5} cual="competitivo" />)}</ol>
          </> : null}
        </Sec>
      ) : null}
      <Sec id="lgf-premios" titulo="Los premios"><Premios items={PREMIOS_SUPER} /></Sec>
      <Sec id="lgf-otra" titulo="Antes, la Clausura">
        <p className="lgf-p0">El orden: cierra la temporada, primero se juega la <b>Clausura</b> —los 16 primeros de la Temporada, en una llave— y
          después la Superliga. Quien está en las dos, juega las dos. Lo que se juegue en los servidores mientras tanto ya cuenta para la pre-temporada 2.</p>
        <a className="btn borde2 chico" href="#/ligas/clausura">Ver la Clausura</a>
      </Sec>
    </>
  );
}

function Clausura({ liga }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const top = topCierre(liga, 'temporada');
  const { fin, dias } = cierreDe(liga);
  return (
    <>
      <CabFinal liga={liga} id="clausura" tag={'LIGA GLOBAL · AL CIERRE DE LA ' + (liga.temp || 'T1')} titulo="Clausura"
        bajada={<>Los 16 primeros de la <a href="#/ranking/temporada">Temporada</a>{fin ? <> al {diaSin(fin)}</> : null} juegan una llave desde octavos para cerrarla. Es lo primero después del cierre: después viene la Superliga.</>}
        nums={[[dias === 0 ? 'CIERRA' : 'DÍAS AL CIERRE', dias > 0 ? dias : dias === 0 ? 'HOY' : '—'], ['CLASIFICAN', CIERRE], ['RONDAS', 4], ['PODIO', 3]]} />
      <Sec id="lgf-como" titulo="Cómo se juega">
        <ol className="lgf-pasos">
          <li><span className="lgf-pn">1</span><b>Los 16 primeros</b><span>Los de la Temporada al cierre, por su puesto: el que juega fuera de concurso no cuenta.</span></li>
          <li><span className="lgf-pn">2</span><b>Una llave desde octavos</b><span>Octavos, cuartos, semifinal y final.</span></li>
          <li><span className="lgf-pn">3</span><b>El podio</b><span>Campeón, 2º y 3º se llevan sus premios. Todo queda guardado.</span></li>
        </ol>
      </Sec>
      {top.length ? (
        <Sec id="lgf-hoy" titulo="Si terminara hoy" enlace="La Temporada" href="#/ranking/temporada">
          <TuLugar liga={liga} top={top} cual="temporada" />
          <ol className="lgf-lista">{top.map((f) => <Clasificado key={f.k} liga={liga} f={f} n={f.pos} cual="temporada" />)}</ol>
        </Sec>
      ) : null}
      <Sec id="lgf-premios" titulo="Los premios"><Premios items={PREMIOS_CLAUSURA} /></Sec>
      <Sec id="lgf-otra" titulo="Después, la Superliga">
        <p className="lgf-p0">Cuando termina la Clausura, los 16 primeros del <b>Competitivo</b> juegan la Superliga: los 4 primeros directo y los otros
          12, un duelo a muerte por 6 lugares. Es parte de la T1, y la Temporada 2 arranca cuando termina.</p>
        <a className="btn borde2 chico" href="#/ligas/superliga">Ver la Superliga</a>
      </Sec>
    </>
  );
}

// 🃏 las dos en la portada de Ligas: lo que son en una línea, cuántos días faltan y las caras de los que estarían
function Destacadas({ liga }) {
  const { dias } = cierreDe(liga);
  const falta = dias >= 0 ? (dias === 0 ? 'CIERRA HOY' : 'CIERRA EN ' + dias + (dias === 1 ? ' DÍA' : ' DÍAS')) : '';
  const caras = (fs) => (
    <span className="lgf-caras" aria-hidden="true">{fs.map((f) => <Cara key={f.k} liga={liga} k={f.k} nombre={f.n} cls="lgf-cc" />)}</span>
  );
  const sup = topCierre(liga, 'competitivo');
  const cla = topCierre(liga, 'temporada');
  return (
    <div className="lgf-dest">
      <a className="lgf-d cla" href="#/ligas/clausura">
        <span className="lgf-d-tag">LIGA GLOBAL{falta ? ' · ' + falta : ''}</span>
        <b>Clausura</b>
        <span>Primero, al cierre: los 16 de la Temporada, en una llave desde octavos.</span>
        {cla.length ? <span className="lgf-d-hoy">{caras(cla.slice(0, 4))}<small>Hoy arriba de todo: {cla.slice(0, 4).map((f) => limpio(f.n)).join(', ')}</small></span> : null}
        <i>Ver la Clausura <Ico n="flecha" t={16} /></i>
      </a>
      <a className="lgf-d sup" href="#/ligas/superliga">
        <span className="lgf-d-tag">LIGA GLOBAL{falta ? ' · ' + falta : ''}</span>
        <b>Superliga</b>
        <span>Después de la Clausura: los 16 del Competitivo, los 4 primeros directo, los otros 12 a un duelo a muerte, y 10 en la liga.</span>
        {sup.length ? <span className="lgf-d-hoy">{caras(sup.slice(0, 4))}<small>Hoy entrarían directo {sup.slice(0, 4).map((f) => limpio(f.n)).join(', ')}</small></span> : null}
        <i>Ver la Superliga <Ico n="flecha" t={16} /></i>
      </a>
    </div>
  );
}

// ── 🏅 LO MEJOR DE LAS LIGAS (Dlx, 16/10/2026: «reconocimiento a estos participantes de las ligas»): cruza todas, por
// persona. Victorias, jugadas y el porcentaje; e invictos: 5 o más ganadas sin perder ninguna en una liga ────────────
const INVICTO = 5;
function LoMejor({ liga, ls, hs }) {
  const por = {};
  const invictos = [];
  ls.forEach((L) => (L.tabla || []).forEach(([raw, pj, pg]) => {
    const k = hs[L.id].kDe(raw);
    const id = k || 'n:' + limpio(raw).toLowerCase();
    const p = por[id] || (por[id] = { k, raw, pj: 0, pg: 0, ls: [] });
    p.pj += pj || 0;
    p.pg += pg || 0;
    p.ls.push(L.n);
    if (pg >= INVICTO && pg === pj) invictos.push({ k, raw, pg, L });
  }));
  const xs = Object.values(por).filter((p) => p.pg > 0)
    .sort((a, b) => b.pg - a.pg || b.pg / b.pj - a.pg / a.pj || a.pj - b.pj).slice(0, 10);
  if (!xs.length) return null;
  invictos.sort((a, b) => b.pg - a.pg);
  const nombre = (p) => (p.k ? <a href={'#/r/' + encodeURIComponent(p.k)}>{limpio(p.raw)}</a> : <span>{limpio(p.raw)}</span>);
  const cara = (p) => (p.k ? <Cara liga={liga} k={p.k} nombre={p.raw} cls="lgh-cara" /> : <span className="lgh-cara ini">{(limpio(p.raw).slice(0, 1) || '?').toUpperCase()}</span>);
  return (
    <Sec id="lgh-mejor" titulo="Lo mejor de las ligas" bajada="Todas las ligas juntas: quién ganó más batallas, sumando cada una en la que juega.">
      {invictos.length ? (
        <div className="lgh-inv">
          <h3 className="lgf-st">Invictos <small>{INVICTO} o más ganadas sin perder ninguna</small></h3>
          <ul>{invictos.map((p) => (
            <li key={p.L.id + p.raw}>{cara(p)}<span><b>{nombre(p)}</b><small>{p.pg} de {p.pg} en <a href={aLiga(p.L)}>{p.L.n}</a></small></span></li>
          ))}</ul>
        </div>
      ) : null}
      <ol className="lgh-top aparece">{xs.map((p, i) => (
        <li key={p.k || p.raw} className={liga.yo && p.k === liga.yo.k ? 'yo' : ''}>
          <span className="lgh-top-i">{i + 1}</span>{cara(p)}
          <span className="lgh-top-n"><b>{nombre(p)}</b><small>{p.ls.length === 1 ? p.ls[0] : p.ls.length + ' ligas'}</small></span>
          <span className="lgh-top-v"><b>{p.pg}</b><small>de {p.pj}</small></span>
          <span className="lgh-top-p">{Math.round((100 * p.pg) / p.pj)}%</span>
        </li>
      ))}</ol>
    </Sec>
  );
}

// ── 🏆 EL SALÓN DE CAMPEONES (Dlx, 16/10/2026): cada liga que terminó, con su campeón y su podio, por temporada.
// El campeón lo confirma Dlx en ✅ Decidir (`decidir.ligas_terminadas()`): el bot no sabe cuándo termina una liga.
// Viaja en el lobby (`ligas.salon`). Sin ninguna todavía, la sección dice cómo se entra: es lo que se quiere ver ───
function Salon({ liga }) {
  const xs = ((liga.d.ligas || {}).salon) || [];
  const nombre = (x, n) => {
    const k = (x.ks || {})[n] || (liga.fila(n) || {}).k;
    return k ? <a href={'#/r/' + encodeURIComponent(k)}>{limpio(n)}</a> : <span>{limpio(n)}</span>;
  };
  const cara = (x, n) => {
    const k = (x.ks || {})[n] || (liga.fila(n) || {}).k;
    return k ? <Cara liga={liga} k={k} nombre={n} cls="lgh-sc-cara" /> : <span className="lgh-sc-cara ini">{(limpio(n).slice(0, 1) || '?').toUpperCase()}</span>;
  };
  return (
    <Sec id="lgh-salon" titulo="Salón de campeones" extra="negra">
      {xs.length ? (
        <ul className="lgh-salon">{xs.map((x) => (
          <li key={x.id + x.ult}>
            {cara(x, x.c)}
            <span className="lgh-sc-t">
              <small><img alt="" src={liga.logo(x.sv)} />{x.n} · {siglaDe(x.sv)}{x.temp ? ' · ' + (x.temp === 'prueba' ? 'T1' : String(x.temp).toUpperCase()) : ''}</small>
              <b>{nombre(x, x.c)}</b>
              {(x.p || []).length > 1 ? <span>2º {nombre(x, x.p[1])}{x.p[2] ? <> · 3º {nombre(x, x.p[2])}</> : null}</span> : null}
            </span>
            <a className="lgh-sc-ir" href={'#/ligas/' + encodeURIComponent(x.id)} aria-label={'Ver ' + x.n}><Ico n="flecha" t={18} /></a>
          </li>
        ))}</ul>
      ) : (
        <p className="lgh-sc-vacio">Cuando una liga termina, su campeón entra acá con su podio, y se lleva la insignia de <b>Campeón de liga</b>.
          {' '}Todavía no terminó ninguna en esta temporada.</p>
      )}
    </Sec>
  );
}

// `#/ligas` es la portada y `#/ligas/<id>` el perfil de esa liga; la Superliga y la Clausura, las dos de la Liga Global
export function LigasPagina({ liga, id = '' }) {
  if (id === 'superliga') return <Superliga liga={liga} />;
  if (id === 'clausura') return <Clausura liga={liga} />;
  return id ? <LigaPerfil liga={liga} id={id} /> : <LigasInicio liga={liga} />;
}
