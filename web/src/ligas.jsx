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
import { Cara, Compartir, Ico, Sec, accion, enlace, silueta } from './piezas.jsx';

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
    if (t.length < 2) { setEst('Contá quién es.'); return; }
    if (!window.conCuenta) { setEst('No pude mandarlo. Probá de nuevo en un rato.'); return; }
    setVa(true);
    setEst('');
    window.conCuenta('/api/avisos/reportar', { llave: 'liga:' + L.id, que: 'nombre', texto: t, batalla: nombre }).then((j) => {
      setVa(false);
      if (j && j.ok) { setOk(true); return; }
      const e = (j && j.error) || '';
      setEst((window.errorCuenta && window.errorCuenta(e)) || (j && j.status === 401 ? 'Para avisar, entrá con Discord desde Mi cuenta.'
        : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva para avisar.'
          : e === 'tope' ? 'Ya mandaste varios hoy: probá mañana.' : 'No pude mandarlo. Probá de nuevo en un rato.'));
    }).catch(() => { setVa(false); setEst('No pude mandarlo. Probá de nuevo en un rato.'); });
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
  fetch('/api/ligas', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || !d.ligas) return;
      DET.d = d.ligas;
      DET.t = t;
      DET.oyentes.forEach((f) => f());
    })
    .catch(() => { /* sin el detalle se ve la tabla */ });
}
function useDetalle(t) {
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

// 📋 LOS RESULTADOS DE CADA FECHA: la jornada si el veredicto la dice; si no, el día en que se cerró. La más nueva
// abierta, las otras plegadas. Las que no tienen cierre todavía también van: es la fecha entera
function Fechas({ liga, L, nombre }) {
  const fs = L.fechas || [];
  if (!fs.length) return null;
  return (
    <div className="lgt-fechas">
      <h4 className="lg-st">Las fechas</h4>
      {fs.map((f, i) => {
        const con = f.b.filter((b) => b[2]).length;
        const tit = f.j ? 'Jornada ' + f.j : cap(diaDe(f.d));
        return (
          <details key={(f.j || '') + f.d + i} className="lgt-fecha" open={i === 0}>
            <summary><b>{tit}</b><small>{f.j && f.d ? cap(diaDe(f.d)) + ' · ' : ''}{con} de {f.b.length} con veredicto</small></summary>
            <ul className="lg-ult">
              {f.b.map(([a, b, g, como], k) => (
                <li key={k}>
                  {g ? <>{nombre(g, 'lg-g')} le ganó a {nombre(g === a ? b : a, 'lg-p')}<small>{como === 'replica' ? 'en réplica' : 'directo'}</small></>
                    : <>{nombre(a, 'lg-p')} vs {nombre(b, 'lg-p')}<small>sin cierre todavía</small></>}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
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
    if (!window.conCuenta) { setErr('No pude guardar tu voto. Probá de nuevo en un rato.'); return; }
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
          : e === 'opcion' ? 'La tabla cambió: recargá la página y votá de nuevo.' : 'No pude guardar tu voto. Probá de nuevo en un rato.'));
    }).catch(() => { setVa(''); setErr('No pude guardar tu voto. Probá de nuevo en un rato.'); });
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
              {abierta ? <> Tocá el % de quien creés que gana: un voto por cuenta de Discord, y lo podés cambiar hasta que la liga termine.</>
                : <> La encuesta cerró: la liga lleva tres semanas sin batallas.</>}</p>
            <small>{tot ? num(tot) + (tot === 1 ? ' voto' : ' votos') + (top ? ' · va ganando ' + limpio(top[0]) : '') : abierta ? 'Todavía nadie votó: ¿sos el primero?' : 'Nadie votó.'}
              {abierta ? ' · cierra el ' + diaDe(liga.diaClave(L.vota)).replace(/^\S+ /, '') + ' si no hay más batallas' : ''}</small>
            {err === 'entrar' ? (
              <p className="lgt-enc-e">Para votar, entrá con Discord. <button type="button" className="btn verde chico" onClick={() => accion.entrar()}>Entrar con Discord</button>
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
        <Fechas liga={liga} L={L} nombre={h.nombre} />
        <p className="lg-nota">La tabla sale de los veredictos que se pudieron leer: directa 3 puntos, réplica 2 y 1, sin los invitados.
          {L.link ? <> La oficial, con sanciones y defaults, está en <a className="te-link" href={L.link} target="_blank" rel="noopener noreferrer">su Discord</a>.</> : null}</p>
        <AvisarLiga key={L.id} L={L} />
      </div>
    </div>
  );
}

// 🥇 los tres de arriba, como el podio del Ranking pero con la cara: muchos de los que juegan ligas no tienen carta
function Podio3({ L, h }) {
  const top = (L.tabla || []).slice(0, 3);
  if (top.length < 2) return null;
  return (
    <ol className="lgp-podio" aria-label={'Los primeros de ' + L.n}>
      {top.map(([raw, pj, pg, pts], i) => (
        <li key={raw} className={'lgp-p p' + (i + 1) + (h.esYo(raw) ? ' yo' : '')}>
          {h.cara(raw, 'lgp-cara')}
          <span className="lgp-pn">{i + 1}º</span>
          {h.nombre(raw, 'lgp-nom')}
          <small>{pts} PTS · {pg}/{pj}</small>
        </li>
      ))}
    </ol>
  );
}

// ── 🏟️ EL PERFIL DE CADA LIGA (`#/ligas/<id>`): su servidor, cómo va, el podio, el torneo y las otras ──────────────────
function LigaPerfil({ liga, id }) {
  const D = liga.d.ligas;
  const det = useDetalle(D ? D.t : null);
  useEffect(() => { window.scrollTo(0, 0); }, [id]);
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
              {L.link ? <a className="btn verde" href={L.link} target="_blank" rel="noopener noreferrer">Su tabla en Discord ↗</a> : null}
              <Compartir cls="btn borde" url={enlace(aLiga(L))} texto={'La tabla de ' + L.n + ' en la Liga Global'} />
            </div>
          </div>
          <dl className="svp-num lgp-num">
            {L.j ? <div><dt>JORNADA</dt><dd>{L.j}</dd></div> : <div><dt>ÚLTIMA</dt><dd>{ultima || '—'}</dd></div>}
            <div><dt>BATALLAS</dt><dd>{num(L.bat)}</dd></div>
            <div><dt>RAPEROS</dt><dd>{num((L.tabla || []).length)}</dd></div>
          </dl>
        </section>
        <Podio3 L={L} h={h} />
      </div>
      <Sec id="lgp-tabla" titulo="La tabla" extra="lgp-sec"><Torneo liga={liga} L={L} h={h} /></Sec>
      {otras.length ? (
        <Sec id="lgp-otras" titulo="Las otras ligas" enlace="Todas" href="#/ligas">
          <nav className="lgp-otras" aria-label="Las otras ligas">
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
          <ul className="lgh-grid">{ver.map((L) => <li key={L.id}><TarjetaLiga liga={liga} L={L} est={est[L.id]} /></li>)}</ul>
        </Sec>
      ) : null}
      {ls.length ? <LoMejor liga={liga} ls={ls} hs={hs} /> : null}
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
        <b>{yo ? 'Vos' : limpio(f.n)}</b>
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
    txt = cual === 'competitivo' ? (i < 4 ? <>Si la temporada terminara hoy, <b>entrás directo a la Superliga</b>.</> : <>Si la temporada terminara hoy, <b>vas al duelo a muerte</b> por un lugar en la Superliga.</>)
      : <>Si la temporada terminara hoy, <b>jugás la Clausura</b> como {i + 1}º.</>;
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
        bajada={<>Los 16 primeros del <a href="#/ranking/competitivo">Competitivo</a>{fin ? <> al cierre de la temporada, el {diaSin(fin)}</> : null}. La Temporada 2 arranca cuando termina.</>}
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
      <Sec id="lgf-otra" titulo="Y la Clausura">
        <p className="lgf-p0">Los 16 primeros de la <b>Temporada</b> juegan su propia llave para cerrarla. Quien está en las dos, juega las dos.</p>
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
        bajada={<>Los 16 primeros de la <a href="#/ranking/temporada">Temporada</a>{fin ? <> al {diaSin(fin)}</> : null} juegan una llave desde octavos para cerrarla.</>}
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
      <Sec id="lgf-otra" titulo="Y la Superliga">
        <p className="lgf-p0">Los 16 primeros del <b>Competitivo</b> juegan la Superliga: los 4 primeros directo y los otros 12, un duelo a muerte por 6 lugares.</p>
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
      <a className="lgf-d sup" href="#/ligas/superliga">
        <span className="lgf-d-tag">LIGA GLOBAL{falta ? ' · ' + falta : ''}</span>
        <b>Superliga</b>
        <span>Los 16 del Competitivo: los 4 primeros directo, los otros 12 a un duelo a muerte, y 10 en la liga.</span>
        {sup.length ? <span className="lgf-d-hoy">{caras(sup.slice(0, 4))}<small>Hoy entrarían directo {sup.slice(0, 4).map((f) => limpio(f.n)).join(', ')}</small></span> : null}
        <i>Ver la Superliga <Ico n="flecha" t={16} /></i>
      </a>
      <a className="lgf-d cla" href="#/ligas/clausura">
        <span className="lgf-d-tag">LIGA GLOBAL{falta ? ' · ' + falta : ''}</span>
        <b>Clausura</b>
        <span>Los 16 de la Temporada, en una llave desde octavos.</span>
        {cla.length ? <span className="lgf-d-hoy">{caras(cla.slice(0, 4))}<small>Hoy arriba de todo: {cla.slice(0, 4).map((f) => limpio(f.n)).join(', ')}</small></span> : null}
        <i>Ver la Clausura <Ico n="flecha" t={16} /></i>
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
      <ol className="lgh-top">{xs.map((p, i) => (
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

// `#/ligas` es la portada y `#/ligas/<id>` el perfil de esa liga; la Superliga y la Clausura, las dos de la Liga Global
export function LigasPagina({ liga, id = '' }) {
  if (id === 'superliga') return <Superliga liga={liga} />;
  if (id === 'clausura') return <Clausura liga={liga} />;
  return id ? <LigaPerfil liga={liga} id={id} /> : <LigasInicio liga={liga} />;
}
