// 🏟️ LAS LIGAS DE LOS SERVIDORES (Dlx, 12/10/2026: «2. Me gusta», a la pestaña «Ligas» con la tabla de cada una; y a
// la Copa de Campeones, no: «cada liga tiene su inicio y su fin aleatoriamente… no podemos controlar eso»). La cuenta
// la hace el ciclo (`bot/ligas.py`) con los veredictos de cada liga y viaja en el lobby (`ligas`): acá sólo se muestra.
//
// 🏆 CADA LIGA COMO UN TORNEO (Dlx, 14/10/2026: «Rework de la página de Ligas»): su tabla, su próxima fecha con la
// cuenta atrás —si el anuncio dice cuándo; si no, no hay pieza—, los resultados de cada fecha y su flyer. Y la encuesta
// «¿quién gana la liga?» (Dlx, el mismo día): el % de cada uno al lado de la tabla, se vota tocándolo (uno por cuenta,
// se cambia, con «Entrar con Discord») y cierra cuando la liga termina (`vota`, ver `ligas.vota()`).
//
// ⚠️ LA TABLA ES LA QUE SALE DE LOS VEREDICTOS QUE SE PUDIERON LEER: directa 3 y 0, réplica 2 y 1, sin los ExtraPlayers.
// La oficial de cada liga puede tener sanciones o defaults que acá no están; por eso va el link a la suya.
import { useEffect, useMemo, useRef, useState } from 'react';
import { DIAS, MESES, limpio, num, siglaDe, utc } from './liga.js';
import { Cara, accion } from './piezas.jsx';

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

export function Ligas({ liga, ver }) {
  const D = liga.d.ligas;
  const ls = (D && D.ligas) || [];
  const desdeRuta = Math.max(0, ls.findIndex((x) => x.id === ver));
  const [sel, setSel] = useState(desdeRuta);
  // `#/ranking/ligas/<id>` (el Inicio, Publicaciones y las historias llevan a una liga): cambia la elegida
  useEffect(() => { if (ver) setSel(Math.max(0, ls.findIndex((x) => x.id === ver))); }, [ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const V = useVotos();
  const det = useDetalle(D ? D.t : null);
  const [mios, setMios] = useState(leerMios);
  const [va, setVa] = useState('');
  const [err, setErr] = useState('');
  const L0 = ls.length ? ls[Math.min(sel, ls.length - 1)] : null;
  // la del lobby y su detalle (`fechas`, `flyer` y los perfiles de los nombres que sólo están en las fechas)
  const dL = (L0 && det[L0.id]) || {};
  const L = L0 ? Object.assign({}, L0, dL, { ks: Object.assign({}, L0.ks || {}, dL.ks || {}) }) : null;
  const tabs = useRef(null);
  useEffect(() => {
    setErr('');
    // en el teléfono las pestañas son una tira que se desliza: la elegida, a la vista (sin mover la página)
    const t = tabs.current;
    const on = t && t.querySelector('button.on');
    if (on && t.scrollWidth > t.clientWidth) t.scrollLeft = on.offsetLeft - t.offsetLeft - (t.clientWidth - on.offsetWidth) / 2;
  }, [sel]);
  // el voto que se tocó antes de entrar con Discord: sale solo al volver a la liga
  useEffect(() => {
    let p = null;
    try { p = JSON.parse(sessionStorage.getItem('lg:ligavoto-pend') || 'null'); } catch (e) { p = null; }
    if (!p || !L || p.liga !== L.id || !window.conCuenta) return;
    try { sessionStorage.removeItem('lg:ligavoto-pend'); } catch (e) { /* igual */ }
    votar(p.op, true);
  }, [L && L.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const cuenta = L ? cuentaDe(L.id) : {};
  const tot = useMemo(() => (L ? (L.tabla || []).reduce((s, f) => s + (Number(cuenta[f[0]]) || 0), 0) : 0), [L, cuenta, V.t]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!L) return null;
  const yo = liga.yo;
  // 🔑 el perfil de cada nombre: el de la tabla del lobby, y si no está ahí, el que manda el ciclo (`ks`, 14/10/2026:
  // ForceGP es staff, no está entre los que jugaron eventos, y «le pico donde dice FORCE y no me lleva a nada»)
  const kDe = (raw) => { const f = liga.fila(raw); return f ? f.k : ((L.ks || {})[raw] || ''); };
  const miK = (window.DC && window.DC.clave) || (yo && yo.k) || '';
  const esYo = (raw) => (!!yo && liga.esDe(raw, yo.k)) || (!!miK && kDe(raw) === miK);
  const nombre = (raw, cls) => {
    const k = kDe(raw);
    return k ? <a className={cls} href={'#/r/' + encodeURIComponent(k)}>{limpio(raw)}</a> : <span className={cls}>{limpio(raw)}</span>;
  };
  const cara = (raw) => {
    const k = kDe(raw);
    return k ? <Cara liga={liga} k={k} nombre={raw} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>;
  };
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
    <div className="dv lgs">
      <p className="dv-cab">Las ligas de los servidores, con sus jornadas: cada una arranca y termina cuando la organiza su servidor.
        {' '}Sus batallas suman a tus <b>duelos</b> (el Ranking Duelos y el Win%); al Score, no.</p>
      <div className="lg-tabs" role="tablist" aria-label="Las ligas" ref={tabs}>
        {ls.map((x, i) => (
          <button key={x.id} type="button" role="tab" aria-selected={i === sel} className={i === sel ? 'on' : ''} onClick={() => setSel(i)}>
            {x.n}<small>{siglaDe(x.sv)}</small>
          </button>
        ))}
      </div>
      <section className={'lgt' + (lado ? ' con-lado' : '')} aria-label={L.n}>
        <header className="lgt-cab">
          <img className="lgt-logo" alt="" src={liga.logo(L.sv)} />
          <div>
            <h3 className="dv-gt">{L.n}</h3>
            <small>{siglaDe(L.sv)}{L.j ? ' · jornada ' + L.j : ''} · {num(L.bat)} {L.bat === 1 ? 'batalla' : 'batallas'}{L.pend ? ' · ' + L.pend + ' sin cierre todavía' : ''}</small>
          </div>
        </header>
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
          <ol className={'dv-tabla lg-tabla lgt-tabla' + (L.vota ? ' con-voto' : '')}>
            {L.tabla.map(([raw, pj, pg, pts], i) => {
              const n = Number(cuenta[raw]) || 0;
              const p = pct(n, tot);
              const esMio = mio === raw;
              return (
                <li key={raw} className={esYo(raw) ? 'yo' : ''}>
                  <span className="dv-i">{i + 1}</span>
                  {cara(raw)}
                  {nombre(raw, 'dv-n')}
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
          <Fechas liga={liga} L={L} nombre={nombre} />
          <p className="lg-nota">La tabla sale de los veredictos que se pudieron leer: directa 3 puntos, réplica 2 y 1, sin los invitados.
            {L.link ? <> La oficial, con sanciones y defaults, está en <a className="te-link" href={L.link} target="_blank" rel="noopener noreferrer">su Discord</a>.</> : null}</p>
          <AvisarLiga key={L.id} L={L} />
        </div>
      </section>
    </div>
  );
}
