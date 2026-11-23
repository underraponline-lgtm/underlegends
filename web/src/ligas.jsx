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
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { DIAS, MESES, limpio, num, siglaDe, utc } from './liga.js';
import { Bandera, Cara, Compartir, Ico, Sec, accion, enlace, nombrePais, silueta } from './piezas.jsx';
import { Numero, useDesliza } from './anima.js';
import { Miniatura, abrirVideo } from './video.jsx';
import { pedirLigas } from './ligas_datos.js';
import { BatallasAhora } from './ligas_ahora.jsx';
import { escenaDe } from './arriba.jsx';
import CSS_PAGINA from './css/ligas.css?inline';
import { usarCss } from './css.js';
import { useModsEstado } from './mods.js';
import { pedirRoles } from './panelsocio.js';
// 🛠️ la corrección del staff, sólo para quien la abre con los lápices de Mods (es del panel del socio: se baja aparte)
const LigasStaff = lazy(() => import('./socio2.jsx').then((m) => ({ default: m.LigasStaff })));

// 🎨 lo del remake (web/src/css/ligas.css): la portada nueva y el Álbum
usarCss('ligas', CSS_PAGINA);

// 🏟️ ¿ALGO ESTÁ MAL EN ESTA LIGA? (Dlx, 14/10/2026: «Sí, a Reportes», a ForceGP: «¿no hay manera de que uno pueda corregir
// eso?»). Le llega a la Liga en Reportes del Dashboard con tu cuenta, y lo decide la Liga. Hasta el 18/11/2026 sólo se podía
// decir «un nombre está mal», y Forza, con OG en FMH España, escribió «no esta en la liga xd» en la caja de «¿quién es?»:
// ahora primero se elige qué pasó (`que`: nombre, gente, ganador u otro) y el Dashboard abre la corrección que corresponde
const QUE_LIGA = [['nombre', 'Un nombre está mal'], ['gente', 'Alguien no es de esta liga'], ['ganador', 'Una batalla está mal'], ['otro', 'Otra cosa']];
function AvisarLiga({ L }) {
  const [abierto, setAbierto] = useState(false);
  const [que, setQue] = useState('');
  const [nombre, setNombre] = useState('');
  const [txt, setTxt] = useState('');
  const [est, setEst] = useState('');
  const [va, setVa] = useState(false);
  const [ok, setOk] = useState(false);
  if (ok) return <p className="lk-rep-ok">✓ ¡Gracias! Lo revisa la Liga.</p>;
  if (!abierto) return <button type="button" className="btn borde2 chico lg-avisar" onClick={() => setAbierto(true)}>¿Algo está mal?</button>;
  const nombres = [];
  for (const f of L.tabla || []) if (f[0] && !nombres.includes(f[0])) nombres.push(f[0]);
  for (const u of L.ult || []) for (const x of u.slice(0, 2)) if (x && !nombres.includes(x)) nombres.push(x);
  // con un nombre (un nombre mal, alguien que no es de la liga) se elige; una batalla o lo demás, se cuenta
  const conNombre = que === 'nombre' || que === 'gente';
  const PIDE = {
    nombre: '¿Quién es «' + limpio(nombre) + '»? Su nombre en la Liga o su Discord (o «soy yo»)',
    gente: '¿Por qué? Por ejemplo: «jugó de invitado», «es de otra liga»',
    ganador: '¿Qué batalla y qué pasó? Por ejemplo: «ORTIZ vs ERIAN era una exhibición», «la ganó Trot en réplica»',
    otro: '¿Qué está mal?',
  };
  const listo = !!que && (!conNombre || !!nombre);
  const enviar = () => {
    const t = txt.replace(/\s+/g, ' ').trim();
    if (!listo || va) return;
    if (t.length < (que === 'gente' ? 0 : 2)) { setEst(que === 'nombre' ? 'Cuenta quién es.' : 'Cuenta qué pasó.'); return; }
    if (!window.conCuenta) { setEst('No pude mandarlo. Prueba de nuevo en un rato.'); return; }
    setVa(true);
    setEst('');
    // 🏆 la de una temporada que terminó va con su liga (`L.liga`, 18/11/2026): su id es `<liga>~<día>`, el Worker no acepta
    // la «~» (`validarReporte()`, 400 'llave') y se leía «No pude mandarlo» siempre
    window.conCuenta('/api/avisos/reportar', { llave: 'liga:' + (L.liga || L.id), que, texto: t, batalla: conNombre ? nombre : '' }).then((j) => {
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
      <p className="lk-rep-t">¿Qué está mal en {L.n}?</p>
      <div className="lk-rep-q" role="group" aria-label="Qué está mal">
        {QUE_LIGA.map(([k, t]) => <button key={k} type="button" aria-pressed={que === k} className={que === k ? 'on' : ''}
          onClick={() => { setQue(k); setEst(''); }}>{t}</button>)}
      </div>
      {conNombre ? <>
        <p className="lk-rep-t">{que === 'gente' ? '¿Quién?' : '¿Qué nombre?'}</p>
        <div className="lk-rep-q" role="group" aria-label="El nombre">
          {nombres.map((x) => <button key={x} type="button" aria-pressed={nombre === x} className={nombre === x ? 'on' : ''} onClick={() => setNombre(x)}>{limpio(x)}</button>)}
        </div>
      </> : null}
      {listo ? <textarea aria-label="Qué pasó" maxLength={300} rows={2} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={PIDE[que]} /> : null}
      <div className="lk-rep-pie">
        <button type="button" className="btn verde chico" disabled={!listo || va} onClick={enviar}>{va ? 'Enviando…' : 'Enviar'}</button>
        <span aria-live="polite">{est}</span>
      </div>
      <p className="lk-rep-nota">Se guarda con tu cuenta de Discord 14 días, para revisarlo. Lo decide la Liga.</p>
    </div>
  );
}

// ── 🏟️ el detalle de cada liga: las fechas y el flyer entero ───────────────────────────────────────────────────────────
// No viajan en el lobby —ya estaba al tope de lo que pesa—: se piden al abrir Ligas (`/api/ligas`, `ligas.separar()` en
// bot/ligas.py), una vez, y otra cuando el ciclo trae un lobby nuevo (`t`). Mientras tanto, la tabla y la encuesta ya están
const DET = { d: null, c: {}, t: null, pedido: 0, oyentes: new Set() };
function pedirDetalle(t) {
  if ((DET.d && DET.t === t) || Date.now() - DET.pedido < 20000) return;
  DET.pedido = Date.now();
  // el mismo pedido que trae lo de la portada (web/src/ligas_datos.js): uno solo por lobby
  pedirLigas(t)
    .then((d) => {
      if (!d || !d.ligas) return;
      DET.d = d.ligas;
      // 🏟️ y quién tiene carta de liga (`cartas`, de 05_Liga/ciclo.py): «Los que mandan» y el Álbum
      DET.c = d.cartas || {};
      // 🏆 y las temporadas que terminaron, enteras (`comp`, `ligas.para_web()`): «Ligas completadas»
      DET.comp = d.comp || {};
      // 📈 el ascenso de los servidores que no suben a ninguna liga (FFA): va aparte (`_con_ascenso()`)
      DET.ascsv = d.ascsv || {};
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
// 📈 el ranking de ascenso de un servidor sin liga a la que se sube (FFA), o undefined si todavía no llegó
export const ascensoSinLiga = (sv) => (DET.ascsv || {})[sv];

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
    // (sólo con la pestaña a la vista: oculta seguía pidiendo cada dos minutos, 10/11/2026)
    const t = setInterval(() => { if (!document.hidden) pedirVotos(true); }, 120000);
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
                      {vid ? <button type="button" className="lpg-vid" onClick={() => abrirVideo({ vid, tit: h.ak(a) + ' vs ' + h.ak(b), link: 'https://www.youtube.com/watch?v=' + vid })} aria-label={'Ver el video de ' + h.ak(a) + ' contra ' + h.ak(b)}>▶</button> : null}
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
// 🏆 cómo se llama una temporada de una liga: «T5» si su servidor la numeró; si no, hasta cuándo se jugó —su última
// batalla, no el día en que el bot vio que terminó—. Sólo la que terminó: la que se juega no necesita nombre
export function etiquetaTemp(L, liga) {
  if (!L) return '';
  if (L.lt) return 'T' + L.lt;
  if (!L.hasta && !L.cerrada && !(L.fin && L.fin.c)) return '';
  const h = L.ult_t || L.hasta || L.cerrada || '';
  // 🗓️ un instante, en el día de quien mira (18/11/2026): cortado del ISO en UTC, la Champions LKR decía «hasta el 21/10»
  // y su última batalla fue el 20/10 a las 8:38 PM ET. Un día suelto (AAAA-MM-DD) va tal cual
  const dia = /T/.test(String(h)) && liga ? liga.diaClave(h) : String(h);
  return dia ? 'hasta el ' + dia.slice(8, 10) + '/' + dia.slice(5, 7) : '';
}
function estadoLiga(liga, L) {
  // 🏆 terminó y se sabe quién la ganó (lo anunció su servidor o lo confirmó Dlx en ✅ Decidir, `fin`): eso manda sobre
  // «sin batallas»
  const tt = L.lt ? ' la T' + L.lt : '';
  if (L.fin && L.fin.c) return { c: 'fin', t: 'TERMINÓ · CAMPEÓN ' + limpio(L.fin.c).toUpperCase(), largo: 'Terminó' + tt + ': la ganó ' + limpio(L.fin.c) };
  // 🔚 su servidor ya cerró sus canales (`cerrada`): terminó, y su campeón todavía no se confirmó
  if (L.cerrada) return { c: 'fin', t: 'TERMINÓ', largo: 'Terminó' + tt + ': su campeón se confirma pronto' };
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
  // 🆔 un nombre que trae pegado un ID de Discord (21/11/2026: «MOTE RA 1320135304916762695» en la tira de Lo último): el
  // ID no se muestra nunca, y sin él (y sin el espacio del medio) se vuelve a buscar quién es
  const sinId = (raw) => String(raw || '').replace(/\s*\b\d{17,20}\b\s*/g, ' ').trim();
  const kDe0 = (raw) => { const f = liga.quien(raw); return f ? f.k : ((L.ks || {})[raw] || ''); };
  const kDe = (raw) => {
    const k = kDe0(raw);
    const s = sinId(raw);
    if (k || s === String(raw || '').trim() || !s) return k;
    return kDe0(s) || kDe0(s.replace(/\s+/g, ''));
  };
  // 🪪 el nombre que se lee: el oficial si se sabe quién es (17/11/2026, Dlx: «si alguien escribe velatzzzz, debería
  // mostrarse con su aka oficial, Velatz»); si no, como lo escribieron
  const ak = (raw) => { const k = kDe(raw); return k ? liga.aka(raw, k) : liga.aka(sinId(raw)); };
  const miK = (window.DC && window.DC.clave) || (yo && yo.k) || '';
  const esYo = (raw) => (!!yo && liga.esDe(raw, yo.k)) || (!!miK && kDe(raw) === miK);
  const nombre = (raw, cls) => {
    const k = kDe(raw);
    return k ? <a className={cls} href={'#/r/' + encodeURIComponent(k)}>{ak(raw)}</a> : <span className={cls}>{ak(raw)}</span>;
  };
  const cara = (raw, cls = 'cara dv-cara') => {
    const k = kDe(raw);
    return k ? <Cara liga={liga} k={k} nombre={raw} cls={cls} /> : <span className={cls + ' ini'}>{(limpio(raw).slice(0, 1) || '?').toUpperCase()}</span>;
  };
  return { kDe, esYo, nombre, cara, miK, ak };
}
// la del lobby y su detalle (`fechas`, `flyer` y los perfiles de los nombres que sólo están en las fechas)
function conDetalle(L0, det) {
  if (!L0) return null;
  const dL = det[L0.id] || {};
  return Object.assign({}, L0, dL, { ks: Object.assign({}, L0.ks || {}, dL.ks || {}) });
}
const aLiga = (L) => '#/ligas/' + encodeURIComponent(L.id);

// ── 🏆 EL TORNEO: la encuesta, la tabla y las fechas; al costado, el flyer y la próxima ────────────────────────────────
function Torneo({ liga, L, h, sinLado = false, corta = 0 }) {
  const V = useVotos();
  const [todos, setTodos] = useState(false);
  const [mios, setMios] = useState(leerMios);
  // 📱 lo que votaste en otro dispositivo llega con tu cuenta (`usarMios()` de social.js, 23/11/2026)
  useEffect(() => { const f = () => setMios(leerMios()); window.addEventListener('lg:ligavotos', f); return () => window.removeEventListener('lg:ligavotos', f); }, []);
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
  const lado = !sinLado && (L.flyer || L.prox);
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
                : (L.fin && L.fin.c) || L.cerrada ? <> La encuesta cerró: la liga terminó.</>
                  : <> La encuesta cerró: la liga lleva tres semanas sin batallas.</>}</p>
            <small>{tot ? num(tot) + (tot === 1 ? ' voto' : ' votos') + (top ? ' · va ganando ' + h.ak(top[0]) : '') : abierta ? 'Todavía nadie votó: ¿eres el primero?' : 'Nadie votó.'}
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
          {(corta && !todos ? (L.tabla || []).slice(0, corta) : (L.tabla || [])).map(([raw, pj, pg, pts], i) => {
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
                    aria-label={(esMio ? 'Tu voto: ' : 'Votar a ') + h.ak(raw) + ' para ganar ' + L.n + ' · ' + p + '% de los votos'}>
                    <i aria-hidden="true" />{esMio ? '✓ ' : ''}{p}%</button>
                ) : <span className="lgt-v cerrada" style={{ '--p': p + '%' }} aria-label={p + '% de los votos'}><i aria-hidden="true" />{p}%</span>) : null}
              </li>
            );
          })}
        </ol>
        {/* 📏 las primeras y «Ver los N» (15/11/2026): con las 23 de Plaza abiertas, el costado quedaba vacío a media página */}
        {corta && (L.tabla || []).length > corta ? <button type="button" className="btn borde2 chico lp3-mas" onClick={() => setTodos(!todos)}>{todos ? 'Ver menos' : 'Ver los ' + L.tabla.length}</button> : null}
        <p className="lg-nota">La tabla sale de los veredictos que se pudieron leer: directa 3 puntos, réplica 2 y 1, sin los invitados.
          {/* 🏳️ una liga que suma los DF (`df_cuenta` en bot/ligas.py, FMS Ceuta, 16/11/2026): suman puntos, no batallas */}
          {L.dfc ? ' En esta liga los DF también suman, como en su tabla: 3 al que se presentó, y el punto que dé la liga cuando no vino ninguno. No cuentan como batallas jugadas.' : null}
          {L.link ? <> La oficial, con sanciones{L.dfc ? '' : ' y defaults'}, está en <a className="te-link" href={L.link} target="_blank" rel="noopener noreferrer">su Discord</a>.</> : null}</p>
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
      {k ? <a className="lpg-st-n" href={kDe(k)}>{liga.aka(n, k)}</a> : <span className="lpg-st-n">{liga.aka(n)}</span>}
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
function Como({ liga, L, h }) {
  const inf = L.info || {};
  const hist = [...(inf.hist || [])];
  // 🏆 lo que el bot vio terminar (11/11/2026): las de antes (`temps`, con el link a su tabla) y la que se ve. La que
  // ya está en lo que publicó su servidor (el mismo número) no se repite
  const ya = (n) => !!n && hist.some((x) => new RegExp('\\b' + n + '\\b').test(String(x[0])));
  // 🗓️ «Hasta el…» es su última batalla (`ult_t` de la temporada entera, en el detalle), en el día de quien mira, como
  // la cabecera de esa temporada (`etiquetaTemp()`). Con `t.h` —el día en que se vio el cierre— FMS Ceuta decía «Hasta
  // el 11/11» acá y «hasta el 27/10» al abrirla (18/11/2026). Sin el detalle, el día del cierre
  const hasta = (t) => { const u = ((DET.comp || {})[t.id] || {}).ult_t; return dm(u && liga ? liga.diaClave(u) : t.h); };
  (L.temps || []).forEach((t) => { if (t.c && !ya(t.lt)) hist.push([t.lt ? 'Temporada ' + t.lt : 'Hasta el ' + hasta(t), t.c, '', t.id]); });
  if (L.fin && L.fin.c && !ya(L.lt)) hist.push([(L.lt ? 'Temporada ' + L.lt : L.liga ? 'Esa temporada' : 'Esta temporada'), L.fin.c, 'campeón']);
  return (
    <div className="lpg-comof">
      {(inf.fmt || []).length ? <ul className="lpg-reglas">{inf.fmt.map((x) => <li key={x}>{x}</li>)}</ul> : null}
      {hist.length ? (
        <>
          <h4 className="lg-st">Los campeones</h4>
          <ol className="lpg-hist">
            {hist.slice().reverse().map(([t, c, nota, id]) => (
              <li key={t + c}><small>{id ? <a href={'#/ligas/' + encodeURIComponent(id)}>{t}</a> : t}</small><b>🏆 {h.nombre(c)}</b>{nota ? <span>{nota}</span> : null}</li>
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
const PEST = [['tabla', 'La tabla'], ['album', 'Álbum'], ['ascenso', 'Ascenso'], ['fechas', 'Fechas'], ['numeros', 'Números'], ['staff', 'Staff'], ['flyers', 'Flyers'],
  ['videos', 'Videos'], ['como', 'Cómo funciona']];
function hay(L, k) {
  return k === 'tabla' ? true : k === 'album' ? (L.album || []).length > 0 : k === 'ascenso' ? !!(L.asc && (L.asc.filas || []).length) : k === 'fechas' ? (L.fechas || []).length > 0 : k === 'numeros' ? (L.fechas || []).some((f) => f.b.some((b) => b[2]))
    : k === 'staff' ? (L.staff || []).some((x) => x[2] >= 2 || x[3] >= 3) : k === 'flyers' ? (L.flyers || []).length > 0
      : k === 'videos' ? (L.vids || []).length > 0 : k === 'como' ? !!(L.info || (L.fin && L.fin.c) || (L.temps || []).some((t) => t.c)) : false;
}

// ── 🏟️ EL PERFIL DE CADA LIGA (`#/ligas/<id>`): su servidor, cómo va, el podio, el torneo y las otras ──────────────────
// ══ 🏟️ EL REMAKE DE LIGAS (15/11/2026). Dlx, a las tres maquetas (https://claude.ai/artifact/UxDtamjFHPgd4ZoXtT3mvm):
// «una fusión entre los 3… para el inicio, el de cartelera está genial… la B tiene data buenísima»; a la fusión D, «quitaría
// la última línea» y «Cómo funcionan, como un botón como está ahora»; y a la página de cada liga, «Si a todo». La portada:
// la tira de lo último, tus ligas, LA CARTELERA (la que más se decide en grande, la próxima como boleto, el último
// campeón con su podio), los números de todas, la tabla de todas que se abre ahí mismo y el estante de campeones ══════

// 🚦 cómo está cada una, con un estado más que `estadoLiga()`: la que se juega y el 1.º le saca 2 o menos, SE DECIDE
function estado3(liga, L) {
  const e = estadoLiga(liga, L);
  const t = L.tabla || [];
  const gap = t.length > 1 ? t[0][3] - t[1][3] : null;
  return Object.assign({}, e, { k: e.c === 'juego' && gap !== null && gap <= 2 ? 'decide' : e.c, gap });
}
const EST3 = { decide: 'Se decide', juego: 'En juego', prox: 'Próxima fecha', fin: 'Terminó', quieta: 'En pausa' };
const ORDEN3 = ['decide', 'juego', 'prox', 'quieta', 'fin'];
// ⚠️ el estado va como `k3-<estado>` y no suelto: `.prox` es una clase del prototipo (estilo.css: grilla, borde y 12 px de
// relleno) y convertía la marca de «Con fecha» en una caja
const Tag3 = ({ k }) => <span className={'lq3-tag k3-' + k}>{EST3[k]}</span>;
const fondo3 = (L) => L.fl || escenaDe(L.sv) || '';
const desde3 = (liga, t) => (t ? liga.cuando(t) : '');
// la carta de liga de alguien (o su cara), para el cara a cara y el campeón
function Carta3({ liga, L, raw, h, cls = '' }) {
  const k = h.kDe(raw);
  const u = k ? cartaLiga(liga, L.id, k) : '';
  return u ? <img className={'lq3-carta ' + cls} src={u} alt={'Carta de liga de ' + limpio(raw)} loading="lazy" decoding="async" />
    : <span className={'lq3-sinc ' + cls}>{h.cara(raw, 'cara lq3-sinc-c')}</span>;
}
// 📈 la carrera del 1.º y el 2.º fecha a fecha (de las fechas del detalle): los puntos acumulados, directa 3, réplica 2 y 1
function carrera3(L) {
  const t = L.tabla || [];
  if (t.length < 2) return [];
  const [a, b] = [t[0][0], t[1][0]];
  const fs = (L.fechas || []).slice().sort((x, y) => String(x.d || x.s || '').localeCompare(String(y.d || y.s || '')));
  const acc = { [a]: 0, [b]: 0 };
  const out = [];
  for (const f of fs) {
    for (const x of f.b) {
      const [p, q, g, como] = x;
      if (!g) continue;
      for (const n of [a, b]) {
        if (g === n) acc[n] += como === 'replica' ? 2 : 3;
        else if ((p === n || q === n) && como === 'replica') acc[n] += 1;
      }
    }
    out.push([acc[a], acc[b]]);
  }
  return out.slice(-12);
}
function Carrera3({ liga, L }) {
  const c = carrera3(L);
  if (c.length < 2) return null;
  const mx = Math.max(1, ...c.map((x) => Math.max(x[0], x[1])));
  const pts = (i) => c.map((x, j) => ((j / (c.length - 1)) * 300).toFixed(1) + ',' + (54 - (x[i] / mx) * 50).toFixed(1)).join(' ');
  const t = L.tabla;
  return (
    <div className="lq3-carrera" aria-label={'Cómo vienen ' + (liga ? liga.aka(t[0][0]) : limpio(t[0][0])) + ' y ' + (liga ? liga.aka(t[1][0]) : limpio(t[1][0])) + ', fecha a fecha'}>
      <svg viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={pts(1)} fill="none" stroke="#F6F6F6" strokeWidth="2" vectorEffect="non-scaling-stroke" opacity=".7" />
        <polyline points={pts(0)} fill="none" stroke="#E41373" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <small><span>Fecha a fecha</span><span className="a">{liga ? liga.aka(t[0][0]) : limpio(t[0][0])}</span><span>{liga ? liga.aka(t[1][0]) : limpio(t[1][0])}</span></small>
    </div>
  );
}
// el cara a cara del 1.º y el 2.º, con sus cartas
function CaraACara3({ liga, L, h, e }) {
  const [a, b] = L.tabla;
  return (
    <div className="lq3-vs">
      <span className="lq3-vs-c"><Carta3 liga={liga} L={L} raw={a[0]} h={h} /><b>{h.ak(a[0])}</b><small>{a[2]} de {a[1]} ganadas</small></span>
      <span className="lq3-vs-x">{a[3]}–{b[3]}<small>{e.gap === 0 ? 'EMPATADOS' : 'A ' + e.gap}</small></span>
      <span className="lq3-vs-c"><Carta3 liga={liga} L={L} raw={b[0]} h={h} /><b>{h.ak(b[0])}</b><small>{b[2]} de {b[1]} ganadas</small></span>
    </div>
  );
}
// 📖 «Cómo funcionan», como un botón (Dlx, 15/11/2026: «como un botón como está ahora»): se abre ahí mismo y se cierra
// tocando afuera o con Escape
function BotonComo({ titulo, children }) {
  const [ab, setAb] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!ab) return undefined;
    const afuera = (e) => { if (ref.current && !e.composedPath().includes(ref.current)) setAb(false); };
    const tecla = (e) => { if (e.key === 'Escape') setAb(false); };
    document.addEventListener('pointerdown', afuera);
    window.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', afuera); window.removeEventListener('keydown', tecla); };
  }, [ab]);
  return (
    <span className="lq3-como" ref={ref}>
      <button type="button" aria-expanded={ab} onClick={() => setAb(!ab)}><i aria-hidden="true">?</i>{titulo}</button>
      {ab ? (
        <div className="lq3-pop" role="dialog" aria-label={titulo}>
          <p className="lq3-pop-t"><b>{titulo}</b><button type="button" onClick={() => setAb(false)}>Cerrar ✕</button></p>
          {children}
        </div>
      ) : null}
    </span>
  );
}
const COMO_LIGAS = (
  <ul className="lq3-pop-l">
    <li><b>Cada servidor arma la suya</b><span>Con sus jornadas, su tabla y sus reglas. Arranca y termina cuando la organiza su servidor.</span></li>
    <li><b>Los puntos</b><span>Ganar directo da 3; en réplica, 2 al que gana y 1 al que pierde. La tabla sale de los veredictos que leyó el bot: la oficial, con sanciones, está en el Discord de cada liga.</span></li>
    <li><b>Qué te suman</b><span>Cada batalla cuenta para tus duelos: el Ranking Duelos y tu Win%. Al Score competitivo, no.</span></li>
    <li><b>¿Quién gana?</b><span>En cada liga se vota quién la gana: un voto por cuenta de Discord, y se cierra cuando lleva tres semanas sin batallas.</span></li>
  </ul>
);
// ⏱️ cuántos días faltan para la próxima fecha (con la hora si el anuncio la dijo). ⚠️ Negativo si para quien mira ya
// pasó (18/11/2026): el ciclo la saca recién cuando terminó su día en la zona de la liga, y recortado a 0 un domingo se
// leía «Se juega hoy · Sábado 21 de noviembre». Quien lo usa pregunta `>= 0`, como `estadoLiga()`
function faltan3(liga, P) {
  const hoy = liga.diaClave(liga.ahora);
  const dia = P.t ? liga.diaClave(P.t) : P.d;
  return Math.round((Date.parse(dia) - Date.parse(hoy)) / 86400000);
}

// ── 🧱 LA CARTELERA: el bento ─────────────────────────────────────────────────────────────────────────────────────────
// La que más se decide en grande (2×2), las otras que se juegan (1×1), la próxima fecha como boleto (2×1) y el último
// campeón con su podio (2×1). En la compu son cuatro columnas y la pared se llena entera: si sobra un lugar, la última chica
// va a lo ancho (`w4`); si sobran tres, una chica pasa a la tabla de abajo. En la tableta y el celular, dos columnas (`w2`)
function Chica3({ liga, L, h, e, w4, w2 }) {
  const t = L.tabla || [];
  const mx = Math.max(1, t[0] ? t[0][3] : 1);
  return (
    <a className={'lq3-t' + (w4 ? ' w4' : '') + (w2 ? ' w2' : '')} href={aLiga(L)} style={{ backgroundImage: fondo3(L) ? 'url(' + fondo3(L) + ')' : undefined }}>
      <Tag3 k={e.k} />
      <h3>{L.n}</h3>
      <p>{L.j ? 'Jornada ' + L.j + ' · ' : ''}{num(L.bat)} {L.bat === 1 ? 'batalla' : 'batallas'} · {desde3(liga, L.ult_t)}</p>
      <span className="lq3-duelo">{t.slice(0, 2).map((f) => (
        <span key={f[0]}>{h.cara(f[0], 'cara lq3-d-c')}<b>{h.ak(f[0])}</b><em>{f[3]}</em><i><u style={{ width: (100 * f[3]) / mx + '%' }} /></i></span>
      ))}</span>
    </a>
  );
}
function Bento3({ liga, top, chicas, prox, camp, hs, est }) {
  // cuántas celdas: la grande 4, el boleto y el campeón 2 cada uno (4 si van «altos»), cada chica 1 (2 si va ancha)
  let n4 = 4 + (prox ? 2 : 0) + (camp ? 2 : 0);
  let xs = chicas.slice();
  let anchas = 0, alto = false;
  const prueba = () => {
    for (let fuera = 0; fuera <= Math.min(3, xs.length); fuera++) {
      for (let a = 0; a <= xs.length - fuera; a++) if ((n4 + xs.length - fuera + a) % 4 === 0) return [fuera, a];
    }
    return null;
  };
  let r = prueba();
  // sin chicas para emparejar (una grande y un boleto: 6), el boleto o el campeón va alto, de dos filas
  if (!r && (prox || camp)) { alto = true; n4 += 2; r = prueba(); }
  if (r) { xs = xs.slice(0, xs.length - r[0]); anchas = r[1]; }
  const impar = xs.length % 2 === 1;
  const chica = (L, i) => <Chica3 key={L.id} liga={liga} L={L} h={hs[L.id]} e={est[L.id]} w4={i >= xs.length - anchas} w2={impar && i === xs.length - 1} />;
  const h = top ? hs[top.id] : null;
  const e = top ? est[top.id] : null;
  const grande = top ? (
    <div className="lq3-t g" style={{ backgroundImage: escenaDe(top.sv) || top.fl ? 'url(' + (escenaDe(top.sv) || top.fl) + ')' : undefined }}>
      <Tag3 k={e.k} />
      <span className="lq3-t-sv"><img alt="" src={liga.logo(top.sv)} />{top.n}</span>
      {(top.tabla || []).length > 1 ? <CaraACara3 liga={liga} L={top} h={h} e={e} /> : null}
      <h3>{e.gap === 0 ? 'Empatados arriba' : e.gap !== null ? 'A ' + e.gap + (e.gap === 1 ? ' punto' : ' puntos') + ' de la punta' : top.n}</h3>
      <p>{top.j ? 'Jornada ' + top.j + ' · ' : ''}{num(top.bat)} batallas · la próxima decide quién manda.</p>
      <Carrera3 liga={liga} L={top} />
      <span className="lq3-acc"><a className="btn verde" href={aLiga(top)}>Ver la liga</a>{top.vota ? <a className="btn borde" href={aLiga(top)}>¿Quién gana? · Vota</a> : null}</span>
    </div>
  ) : null;
  const boleto = prox ? (
    <a className={'lq3-t w lq3-tk-t' + (alto ? ' alto' : '')} href={aLiga(prox)}>
      <span className="lq3-tk">
        <span className="lq3-tk-f" style={{ backgroundImage: fondo3(prox) ? 'url(' + fondo3(prox) + ')' : undefined }} />
        {/* (con su punto: `liga.dia()` no lo trae y se leía «… 8:00 PM Te avisa la campana», 18/11/2026) */}
        <span className="lq3-tk-i"><Tag3 k="prox" /><h3>{prox.n}</h3><p>{prox.prox.t ? 'Con hora: ' + liga.dia(prox.prox.t) + '.' : 'La hora la dice el servidor.'} Te avisa la campana si sigues la liga.</p></span>
        <span className="lq3-tk-n"><small>La próxima fecha</small><b>{faltan3(liga, prox.prox) || 'HOY'}</b><small>{faltan3(liga, prox.prox) ? (faltan3(liga, prox.prox) === 1 ? 'día' : 'días') : ''}</small></span>
      </span>
    </a>
  ) : null;
  const campeon = camp ? (
    <a className={'lq3-t w' + (alto && !prox ? ' alto' : '')} href={aLiga(camp)} style={{ backgroundImage: fondo3(camp) ? 'url(' + fondo3(camp) + ')' : undefined }}>
      <Tag3 k="fin" />
      <span className="lq3-t-sv"><img alt="" src={liga.logo(camp.sv)} />{camp.n} · {desde3(liga, camp.ult_t)}</span>
      <span className="lq3-camp">
        <Carta3 liga={liga} L={camp} raw={camp.fin.c} h={hs[camp.id]} />
        <span><h3>{hs[camp.id].ak(camp.fin.c)} se queda con la liga</h3>
          <ol>{(camp.fin.p || [camp.fin.c]).slice(0, 3).map((n, i) => <li key={n}><i>{i + 1}</i><span>{hs[camp.id].ak(n)}</span></li>)}</ol></span>
      </span>
    </a>
  ) : null;
  return (
    <div className="lq3-bento">
      {grande}{xs[0] ? chica(xs[0], 0) : null}{xs[1] ? chica(xs[1], 1) : null}{boleto}
      {xs.slice(2, 4).map((L, i) => chica(L, i + 2))}{campeon}{xs.slice(4).map((L, i) => chica(L, i + 4))}
    </div>
  );
}

// ── 📊 LOS NÚMEROS de todas las ligas juntas (lo de la B, sin repetir lo que la pared ya muestra) ─────────────────────
function Numeros3({ liga, ls, hs, det, est, top }) {
  const V = useVotos();
  const { ps, cs } = useMemo(() => cuentas(liga, ls, hs, det), [liga, ls, hs, det]);
  const invictos = [];
  ls.forEach((L) => (L.tabla || []).forEach(([raw, pj, pg]) => { if (pg >= INVICTO && pg === pj) invictos.push({ raw, pg, L }); }));
  invictos.sort((a, b) => b.pg - a.pg);
  const vivas = ls.filter((L) => est[L.id].k === 'decide' || est[L.id].k === 'juego').filter((L) => (L.tabla || []).length);
  if (!cs.length && !vivas.length) return null;
  const rey = cs[0];
  const mxc = cs.length ? cs[0].g : 1, mxp = ps.length ? ps[0][1].g : 1;
  const lider = (L) => {
    const f = L.tabla[0];
    return <a key={L.id} className="lq3-ld" href={aLiga(L)}>{hs[L.id].cara(f[0], 'cara lq3-ld-c')}<span><b>{limpio(f[0])}</b><small><img alt="" src={liga.logo(L.sv)} />{corto(L.n)} · {f[3]} pts</small></span></a>;
  };
  const cuenta = top ? cuentaDe(top.id) : {};
  const cand = top ? (top.tabla || []).slice(0, 4) : [];
  const tot = top ? (top.tabla || []).reduce((s, f) => s + (Number(cuenta[f[0]]) || 0), 0) : 0;
  return (
    <div className="lq3-num">
      <div className="lq3-caja mg">
        <h3>La carrera<small>batallas ganadas</small></h3>
        <ol className="lq3-lista">{cs.slice(0, 7).map((q, i) => (
          <li key={q.raw + i}><i>{i + 1}</i>{hs[q.L.id].cara(q.raw, 'cara lq3-l-c')}<span><b>{hs[q.L.id].nombre(q.raw)}</b><small>{q.ls.size > 1 ? 'en ' + q.ls.size + ' ligas' : corto(q.L.n)} · de {q.j}</small><u><s style={{ width: (100 * q.g) / mxc + '%' }} /></u></span><em>{q.g}</em></li>
        ))}</ol>
        {invictos.length ? (
          <p className="lq3-inv"><b>Sin perder</b>{invictos.slice(0, 5).map((x) => <span key={x.L.id + x.raw}>{hs[x.L.id].cara(x.raw, 'cara lq3-inv-c')}{hs[x.L.id].ak(x.raw)} <em>{x.pg}–0</em></span>)}</p>
        ) : null}
      </div>
      {rey ? (
        <div className="lq3-rey">
          <p className="lq3-rey-t"><b>El que más gana en las ligas</b><small>y los que mandan en cada una</small></p>
          <span className="lq3-lados">{vivas.slice(0, 3).map(lider)}</span>
          <span className="lq3-rey-c"><Carta3 liga={liga} L={rey.L} raw={rey.raw} h={hs[rey.L.id]} /><b>{hs[rey.L.id].ak(rey.raw)}</b><small>{rey.g} ganadas de {rey.j}</small></span>
          <span className="lq3-lados">{vivas.slice(3, 6).map(lider)}</span>
        </div>
      ) : null}
      <div className="lq3-col">
        {top && top.vota ? (
          <div className="lq3-caja vd">
            <h3>¿Quién gana {corto(top.n)}?<small>{tot ? num(tot) + (tot === 1 ? ' voto' : ' votos') : 'nadie votó todavía'}</small></h3>
            <ul className="lq3-poll">{cand.map((f) => {
              const p = tot ? Math.round((100 * (Number(cuenta[f[0]]) || 0)) / tot) : 0;
              return <li key={f[0]}><a href={aLiga(top)}><i style={{ width: p + '%' }} />{hs[top.id].cara(f[0], 'cara lq3-l-c')}<b>{hs[top.id].ak(f[0])}</b><em>{p}%</em></a></li>;
            })}</ul>
            <small className="lq3-nota">{V.t ? 'Toca a quien crees que gana: se vota en la página de la liga, un voto por cuenta.' : 'Se vota en la página de la liga, un voto por cuenta.'}</small>
          </div>
        ) : null}
        {ps.length ? (
          <div className="lq3-caja">
            <h3>Los países<small>batallas ganadas</small></h3>
            <ol className="lq3-lista">{ps.slice(0, 5).map(([cc, P], i) => (
              <li key={cc}><i>{i + 1}</i><Bandera cc={cc} cls="lq3-band" /><span><b>{nombrePais(cc)}</b><u><s style={{ width: (100 * P.g) / mxp + '%' }} /></u></span><em>{P.g}</em></li>
            ))}</ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── 📋 TODAS LAS LIGAS, cada una con su miniatura GRANDE (Dlx, 16/11/2026: «A mí me gustaba siempre ver las ligas con un
// thumbnail» y «like a big thumbnail like we had before»): la tarjeta de antes (TarjetaLiga, hasta la 5.55), con el flyer a
// sangre a la izquierda —o el escudo de su servidor sobre su color— y al lado cómo va, con los datos de la tabla de la D (el
// líder, cuánto le saca al 2.º y cuándo fue la última). Los filtros por estado y por servidor siguen; la tabla entera de cada
// una está en su página
function Todas3({ liga, ls, hs, est }) {
  const [fil, setFil] = useState('');
  const svs = [...new Set(ls.map((L) => L.sv))];
  const cuenta = (k) => ls.filter((L) => est[L.id].k === k || (k === 'juego' && est[L.id].k === 'decide')).length;
  const xs = ls.filter((L) => !fil || (fil.startsWith('sv:') ? L.sv === fil.slice(3) : fil === 'juego' ? ['decide', 'juego'].includes(est[L.id].k) : est[L.id].k === fil))
    .sort((a, b) => ORDEN3.indexOf(est[a.id].k) - ORDEN3.indexOf(est[b.id].k) || String(b.ult_t || '').localeCompare(String(a.ult_t || '')));
  const chips = [['', 'Todas', ls.length], ['decide', 'Se deciden', cuenta('decide')], ['juego', 'En juego', cuenta('juego')], ['prox', 'Con fecha', cuenta('prox')],
    ['quieta', 'En pausa', cuenta('quieta')], ['fin', 'Terminadas', cuenta('fin')]].filter((c) => !c[0] || c[2]);
  return (
    <Sec id="lq3-todas" titulo={'Todas las ligas · ' + ls.length}>
      <div className="lq3-chips" role="group" aria-label="Filtrar las ligas">
        {chips.map(([k, t, n]) => <button key={k || 'todas'} type="button" className={fil === k ? 'on' : ''} aria-pressed={fil === k} onClick={() => setFil(k)}>{t} <b>{n}</b></button>)}
        {svs.length > 1 ? svs.map((s) => <button key={s} type="button" className={fil === 'sv:' + s ? 'on' : ''} aria-pressed={fil === 'sv:' + s} onClick={() => setFil(fil === 'sv:' + s ? '' : 'sv:' + s)}><img alt="" src={liga.logo(s)} />{siglaDe(s)}</button>) : null}
      </div>
      <ul className="lq3-cs">{xs.map((L) => {
        const e = est[L.id];
        const h = hs[L.id];
        const [x, y] = L.tabla || [];
        const s = liga.svs[L.sv] || {};
        const fin = !!(L.fin && L.fin.c);
        return (
          <li key={L.id}>
            <a className={'lq3-c k3-' + e.k} href={aLiga(L)} style={{ '--c': s.color || '#E41373' }}>
              <span className="lq3-c-img">
                {L.fl ? <img alt="" src={L.fl} loading="lazy" decoding="async" />
                  : <span className="lq3-c-sin"><img alt="" src={liga.logo(L.sv, true)} loading="lazy" decoding="async" /></span>}
              </span>
              <span className="lq3-c-tx">
                <span className="lq3-c-k"><Tag3 k={e.k} />{L.j && !fin ? <small>Jornada {L.j}</small> : null}</span>
                <b className="lq3-c-n">{L.n}</b>
                <span className="lq3-c-sv"><img alt="" src={liga.logo(L.sv)} />{siglaDe(L.sv)} · {num(L.bat)} {L.bat === 1 ? 'batalla' : 'batallas'} · {(L.tabla || []).length} raperos</span>
                {x ? (
                  <span className="lq3-c-l">{h.cara(fin ? L.fin.c : x[0], 'cara lq3-c-cara')}<small>{fin ? 'Campeón' : '1º'}</small><b>{h.ak(fin ? L.fin.c : x[0])}</b>{fin ? null : <i>{x[3]} PTS</i>}</span>
                ) : null}
                <small className="lq3-c-u">{y && !fin ? (e.gap === 0 ? 'Empatado con ' + h.ak(y[0]) : 'Le saca ' + e.gap + ' a ' + h.ak(y[0])) + ' · ' : ''}{L.ult_t ? 'la última, ' + desde3(liga, L.ult_t) : 'todavía sin batallas'}</small>
              </span>
            </a>
          </li>
        );
      })}</ul>
    </Sec>
  );
}

// ── 🏆 EL ESTANTE DE CAMPEONES (el Salón, con sus cartas de liga) ────────────────────────────────────────────────────
// 🏆 LA TEMPORADA QUE SE CERRÓ, NO LA LIGA DE HOY (18/11/2026): el Salón manda la liga base (`id`) y un día (`ult`). Cuando
// esa liga ya arrancó otra temporada, la cerrada vive en el detalle como `<liga>~<día>` (`comp`), y con ese id están sus
// cartas: con el de la base, Trot salía sin su carta de FMS Ceuta y el link llevaba a la temporada nueva, donde no está.
// Devuelve su id y el instante de su última batalla; sin el detalle, la base, como antes
function cerradaDe(liga, x) {
  const cs = DET.comp || {};
  const ids = Object.keys(cs).filter((c) => cs[c].liga === x.id);
  const dia = ids.find((c) => String(cs[c].ult_t || '').slice(0, 10) === x.ult);
  if (dia) return [dia, cs[dia].ult_t];
  // la de hoy terminó con ese campeón: es ésa (un campeón que repite no se va a la temporada vieja)
  const hoy = liga.ligas().find((L) => L.id === x.id);
  if (hoy && hoy.fin && hoy.fin.c === x.c) return [x.id, hoy.ult_t || ''];
  const c = ids.find((y) => (cs[y].fin || {}).c === x.c);
  return c ? [c, cs[c].ult_t] : [x.id, ''];
}
function Estante3({ liga }) {
  const xs = ((liga.d.ligas || {}).salon) || [];
  return (
    <section className="lq3-osc lq3-est-s" aria-labelledby="lq3-estante">
      <div className="lq3-in">
        <div className="lq3-sub"><h2 id="lq3-estante">El estante de campeones</h2>{xs.length ? <small>Ligas completadas · {xs.length}</small> : null}</div>
        {/* 🏆 el premio de cada título (Dlx, 15/11/2026): una temporada de Pase premium, en el Inventario del campeón */}
        <p className="lgh-sc-premio"><Ico n="pase" t={18} /><span>Cada campeón de liga gana <b>una temporada de Pase premium</b>: la usa desde su Inventario, en esta temporada o en la que elija.</span></p>
        {xs.length ? <div className="lq3-estante">{xs.map((x) => {
          const k = (x.ks || {})[x.c] || (liga.quien(x.c) || {}).k || '';
          const [cid, ut] = cerradaDe(liga, x);
          const u = k ? cartaLiga(liga, cid, k) : '';
          // 🗓️ el día: el instante de su última batalla; si no, `ult` (AAAA-MM-DD) al mediodía UTC. Solo, `liga.cuando()` lo
          // leía como la medianoche UTC y en toda América caía el día anterior: FMH España «el 10» y fue el 11 (18/11/2026)
          const t = ut || (x.ult ? x.ult + 'T12:00:00Z' : '');
          return (
            <a key={x.id + x.ult} href={'#/ligas/' + encodeURIComponent(cid)}>
              {u ? <img className="lq3-carta" src={u} alt={'Carta de liga de ' + liga.aka(x.c, k)} loading="lazy" decoding="async" />
                : <span className="lq3-sinc">{k ? <Cara liga={liga} k={k} nombre={x.c} cls="cara lq3-sinc-c" /> : <span className="cara lq3-sinc-c ini">{(limpio(x.c).slice(0, 1) || '?').toUpperCase()}</span>}</span>}
              <span className="lq3-placa">{liga.aka(x.c, k)}<small>{x.n}{x.lt ? ' T' + x.lt : ''} · {desde3(liga, t)}</small></span>
            </a>
          );
        })}</div> : <p className="lq3-vacia">Cuando una liga termina, su campeón entra acá con su carta de liga, y se lleva la insignia de <b>Campeón de liga</b>. Todavía no terminó ninguna en esta temporada.</p>}
      </div>
    </section>
  );
}

function LigasPortada({ liga, falta = '' }) {
  const ls = liga.ligas();
  // 🔑 con el sello del lobby, la misma clave con la que App.jsx pide /api/ligas (18/11/2026): con `ligas.t`, que es otro
  // instante, pasado el minuto de ligas_datos.js se volvía a bajar y mientras tanto la liga decía «Todavía nadie»
  const det = useDetalle(liga.d.sello);
  // las de la portada, con sus fechas del detalle (para la carrera fecha a fecha del cuadro grande)
  const ld = useMemo(() => ls.map((L) => conDetalle(L, det)), [ls, det]);
  const hs = useMemo(() => { const o = {}; ld.forEach((L) => { o[L.id] = herramientas(liga, L); }); return o; }, [liga, ld]);
  const est = {};
  ld.forEach((L) => { est[L.id] = estado3(liga, L); });
  const nuevo = (a, b) => String(b.ult_t || '').localeCompare(String(a.ult_t || ''));
  const vivas = ld.filter((L) => (est[L.id].k === 'decide' || est[L.id].k === 'juego') && (L.tabla || []).length).sort(nuevo);
  // la que más se decide: la más pareja arriba y, entre las parejas, la que más se jugó
  const top = vivas.slice().sort((a, b) => ((est[a.id].gap ?? 99) - (est[b.id].gap ?? 99)) || (b.bat || 0) - (a.bat || 0))[0] || null;
  const prox = ld.filter((L) => est[L.id].k === 'prox').sort((a, b) => String(a.prox.t || a.prox.d).localeCompare(String(b.prox.t || b.prox.d)))[0] || null;
  const camp = ld.filter((L) => est[L.id].k === 'fin' && L.fin && L.fin.c && L.ult_t && liga.ahora - utc(L.ult_t) < 21 * 86400000).sort(nuevo)[0] || null;
  const chicas = vivas.filter((L) => L !== top);
  const ultimas = ld.filter((L) => (L.ult || []).length && L.ult_t).sort(nuevo).slice(0, 10);
  const mias = [];
  ld.forEach((L) => {
    const i = (L.tabla || []).findIndex(([raw]) => hs[L.id].esYo(raw));
    if (i >= 0 && est[L.id].k !== 'fin') mias.push([L, i, L.tabla[i]]);
  });
  const gente = new Set();
  ld.forEach((L) => (L.tabla || []).forEach(([raw]) => gente.add(hs[L.id].kDe(raw) || limpio(raw).toLowerCase())));
  const tira = ultimas.map((L) => {
    const [a, b, g, como] = L.ult[0];
    // 🪪 con el nombre que resuelve cada liga (`ak`, 21/11/2026): con `limpio` sobre el crudo salía un ID de Discord
    // («MOTERA 1320135304916762695 LE GANÓ A…») y los nombres con letras decorativas
    const ak = hs[L.id].ak;
    return <span key={L.id}><img alt="" src={liga.logo(L.sv)} />{corto(L.n)} · <b>{ak(g)}</b> le ganó a {ak(g === a ? b : a)} · {como === 'replica' ? 'réplica' : 'directo'} · {desde3(liga, L.ult_t)}</span>;
  });
  return (
    <>
      <BatallasAhora liga={liga} cls="sec" />
      {falta ? <p className="sec lgh-falta" role="status">Esa liga no está: puede que todavía no tenga batallas, o que haya cambiado de nombre. Acá están todas.</p> : null}
      <section className="lq3-osc" aria-labelledby="lq3-cart">
        <div className="lq3-in lq3-cab">
          <div className="lq3-tit">
            <h1 id="lq3-cart">La cartelera</h1>
            <span className="lq3-tit-d"><small>{vivas.length} en juego · {vivas.filter((L) => est[L.id].k === 'decide').length} se deciden · {num(ld.reduce((n, L) => n + (L.bat || 0), 0))} batallas · {num(gente.size)} raperos</small>
              <BotonComo titulo="¿Primera vez? Cómo funcionan">{COMO_LIGAS}</BotonComo></span>
          </div>
        </div>
        {/* 📰 la tira y tus ligas, debajo del título: arriba a la derecha de cada página va su «¿Cómo funciona?» (comofunciona.jsx), y
            encima de la tira la tapaba */}
        {tira.length ? (
          <div className="lq3-ticker" aria-label="Lo último que pasó en las ligas">
            <div className="lq3-ticker-in"><span className="lq3-ticker-cab">Lo último</span>{tira}<span className="lq3-ticker-cab" aria-hidden="true">Lo último</span>{tira.map((x) => <span key={'2' + x.key} aria-hidden="true">{x.props.children}</span>)}</div>
          </div>
        ) : null}
        {mias.length ? (
          <div className="lq3-tuyas"><small>Tus ligas</small>{mias.map(([L, i, f]) => (
            <a key={L.id} href={aLiga(L)}>{L.fl ? <img alt="" src={L.fl} /> : <img alt="" src={liga.logo(L.sv)} />}<span className="p">{i + 1}º</span>
              <span><b>{corto(L.n)}</b><small>de {L.tabla.length} · {f[3]} pts · {i ? 'a ' + (L.tabla[0][3] - f[3]) + ' del 1.º' : 'vas primero'}</small></span></a>
          ))}</div>
        ) : null}
        <div className="lq3-in">
          {top || prox || camp ? <Bento3 liga={liga} top={top} chicas={chicas} prox={prox} camp={camp} hs={hs} est={est} />
            : <p className="lq3-vacia">Ahora no se está jugando ninguna liga: abajo están todas, con su última tabla.</p>}
          {ld.length ? <><div className="lq3-sub"><h2>Los números</h2><small>todas las ligas juntas</small></div>
            <Numeros3 liga={liga} ls={ld} hs={hs} det={det} est={est} top={top} /></> : null}
        </div>
      </section>
      {/* 🏆 las dos de la Liga Global, arriba de las de los servidores */}
      <section className="sec lgf-dsec" aria-label="Las de la Liga Global"><Destacadas liga={liga} /></section>
      {ld.length ? <Todas3 liga={liga} ls={ld} hs={hs} est={est} /> : <Sec id="lgh-todas" titulo="Todas las ligas"><p className="pronto-p">Todavía ninguna liga tiene batallas: aparecen solas con la primera.</p></Sec>}
      <Estante3 liga={liga} />
    </>
  );
}

// ══ 🏟️ LA PÁGINA DE CADA LIGA, CON EL MISMO LENGUAJE (15/11/2026, Dlx: «Si a todo») ══════════════════════════════════
// Arriba lo que pasa ahora: el cara a cara si se juega, el campeón con su podio si terminó, el boleto si tiene fecha. Cuatro
// cuadros (la próxima fecha, la última batalla, el que más gana acá, tu lugar) y las pestañas: La tabla —con ¿Quién gana?—,
// Jornadas, Álbum y Números; Ascenso, Staff, Flyers y Videos sólo si la liga los tiene. «Cómo funciona», un botón
function Jornadas3({ L, h }) {
  const fs = L.fechas || [];
  const [j, setJ] = useState(0);
  useEffect(() => { setJ(0); }, [L.id]);
  if (!fs.length) return null;
  const F = fs[Math.min(j, fs.length - 1)];
  const corta = (f) => (f.j ? 'J' + f.j : dmy(f.s || f.d));
  return (
    <div className="lp3-jor">
      <div className="lp3-jor-ch" role="tablist" aria-label="Las fechas">{fs.map((f, i) => (
        <button key={(f.j || '') + (f.s || f.d) + i} type="button" role="tab" aria-selected={i === j} className={i === j ? 'on' : ''} onClick={() => setJ(i)}>{corta(f)}<small>{f.b.length}</small></button>
      ))}</div>
      <p className="lp3-jor-t"><b>{tituloFecha(F)}</b><small>{F.j && F.d ? cap(diaDe(F.d)) + ' · ' : ''}{F.b.length === 1 ? '1 batalla' : F.b.length + ' batallas'}</small></p>
      <ul className="lp3-bts">{F.b.map(([a, b, g, como, pa, pb, mid, vid], k) => (
        <li key={k} className={(g ? '' : 'pend ') + (h.esYo(a) || h.esYo(b) ? 'yo' : '')}>
          <span className={'lp3-ld' + (g === a ? ' g' : '')}>{h.cara(a, 'cara lp3-ld-c')}{h.nombre(a)}<em>{ptbTx(pa)}</em></span>
          <span className="lp3-vs">VS</span>
          <span className={'lp3-ld d' + (g === b ? ' g' : '')}>{h.cara(b, 'cara lp3-ld-c')}{h.nombre(b)}<em>{ptbTx(pb)}</em></span>
          <small>{g ? (como === 'replica' ? 'Réplica' : 'Directo') + ' · ganó ' + h.ak(g) : 'Sin veredicto todavía'}
            {vid ? <button type="button" className="lpg-vid" onClick={() => abrirVideo({ vid, tit: h.ak(a) + ' vs ' + h.ak(b), link: 'https://www.youtube.com/watch?v=' + vid })} aria-label={'Ver el video de ' + h.ak(a) + ' contra ' + h.ak(b)}>▶</button> : null}
            {L.vlink && mid ? <a className="lpg-ver" href={L.vlink + mid} target="_blank" rel="noopener noreferrer" aria-label="El veredicto en Discord">↗</a> : null}</small>
        </li>
      ))}</ul>
      <p className="lg-nota">«Semana del…»: su servidor no escribe la jornada en el veredicto, así que van por la semana en que se cerraron. Los números son el PTB que dijo cada veredicto.</p>
    </div>
  );
}
// 🔢 los cuatro cuadros de arriba
function Minis3({ liga, L, h }) {
  const u = (L.ult || [])[0];
  const gana = {};
  (L.fechas || []).forEach((f) => f.b.forEach((b) => { if (b[2]) gana[b[2]] = (gana[b[2]] || 0) + 1; }));
  const mg = Object.entries(gana).sort((a, b) => b[1] - a[1])[0];
  const N = numerosDe(L);
  const i = (L.tabla || []).findIndex(([raw]) => h.esYo(raw));
  const f = i >= 0 ? L.tabla[i] : null;
  const sabe = !!(h.miK || window.DC);
  // una fecha que ya pasó para quien mira no es «la próxima» (18/11/2026, ver `faltan3()`)
  const f3 = L.prox ? faltan3(liga, L.prox) : -1;
  const d = f3 >= 0 ? f3 : null;
  const fin = !!((L.fin && L.fin.c) || L.cerrada);
  return (
    <div className="lp3-minis">
      <div className="lp3-mini" style={{ '--c': 'var(--oro3)' }}><span className="ic">{d === null ? '—' : d || 'HOY'}</span><span><small>La próxima fecha</small>
        <b>{d === null ? (fin ? 'Terminó' : 'Sin anunciar') : d === 0 ? 'Se juega hoy' : 'En ' + d + (d === 1 ? ' día' : ' días')}</b>
        <span>{d !== null ? cap(L.prox.t ? liga.dia(L.prox.t) : diaDe(L.prox.d)) : fin ? 'La próxima temporada, cuando la anuncien' : 'La anuncia ' + siglaDe(L.sv) + ' en su Discord'}</span></span></div>
      <div className="lp3-mini" style={{ '--c': 'var(--verde)' }}><span className="ic">{u ? h.cara(u[2], 'cara lp3-mini-c') : '—'}</span><span><small>La última batalla{L.ult_t ? ' · ' + desde3(liga, L.ult_t) : ''}</small>
        <b>{u ? h.ak(u[2]) + ' le ganó a ' + h.ak(u[2] === u[0] ? u[1] : u[0]) : 'Todavía ninguna'}</b>
        <span>{u ? (u[3] === 'replica' ? 'En réplica' : 'Directo') + (u[4] ? ' · jornada ' + u[4] : '') : ''}</span></span></div>
      <div className="lp3-mini" style={{ '--c': 'var(--magenta)' }}><span className="ic">{mg ? mg[1] : '—'}</span><span><small>El que más gana acá</small>
        <b>{mg ? h.ak(mg[0]) : 'Todavía nadie'}</b><span>{mg ? mg[1] + (mg[1] === 1 ? ' ganada' : ' ganadas') + (N.racha && N.racha[0] === mg[0] && N.racha[1] >= 2 ? ' · racha de ' + N.racha[1] : '') : ''}</span></span></div>
      {/* 🪪 sin saber quién mira (ni `liga.yo` ni una cuenta de Discord) no se afirma «No juegas esta liga»: se invita a
          entrar (18/11/2026). El botón, como link: un `.btn` no entra en el cuadro a 360 px */}
      <div className="lp3-mini" style={{ '--c': '#F6F6F6' }}><span className="ic">{f ? i + 1 + 'º' : '?'}</span><span><small>Tu lugar</small>
        <b>{f ? i + 1 + 'º de ' + L.tabla.length : sabe ? 'No juegas esta liga' : 'Entra para ver tu lugar'}</b><span>{f ? (i ? 'A ' + (L.tabla[0][3] - f[3]) + ' del 1.º' : 'Vas primero')
          : sabe ? 'Se entra por el Discord de ' + siglaDe(L.sv) : <button type="button" className="lp3-entra" onClick={() => accion.entrar()}>Entrar con Discord</button>}</span></span></div>
    </div>
  );
}

// ✎ LOS LÁPICES DE MODS EN UNA LIGA (20/11/2026, la página Mods). Dlx, o Admin y Moderador de la página (`liga` de
// `socio-roles`): lo mismo que el staff de su servidor en su panel —quién ganó, una que no cuenta, cargar una batalla, un
// DF, un nombre, un invitado, el campeón—, desde la liga misma. Lo valida el Worker (`socioLiga()`) y lo aplica el ciclo
function ModsLiga({ L }) {
  const M = useModsEstado();
  const [r, setR] = useState(null);
  useEffect(() => {
    if (!M.lapices) { setR(null); return undefined; }
    let vivo = true;
    pedirRoles().then((x) => { if (vivo) setR(x || null); });
    return () => { vivo = false; };
  }, [M.lapices]);
  if (!M.lapices || !r || !L || !L.sv) return null;
  const rol = (r.roles || {})[L.sv] || (r.dlx ? 'dlx' : r.liga ? 'liga' : '');
  if (!rol) return null;
  return (
    <section className="lp3-mods" aria-label="Corregir esta liga">
      <h2><span aria-hidden="true">✎</span> Corregir esta liga <small>Mods · entra en la próxima media hora y queda anotado con tu nombre</small></h2>
      <Suspense fallback={<p className="lp3-mods-c">Cargando…</p>}><LigasStaff sv={L.sv} rol={rol} permisos={r.permisos || {}} lid0={L.id} /></Suspense>
    </section>
  );
}

function LigaPerfil({ liga, id }) {
  // 🔑 el detalle, con el sello del lobby (18/11/2026, ver LigasPortada)
  const det = useDetalle(liga.d.sello);
  useEffect(() => { window.scrollTo(0, 0); }, [id]);
  // 🗂️ la pestaña, ANTES de cualquier `return`: un hook después de uno se rompe cuando la liga todavía no llegó
  const [tab, setTab] = useState('tabla');
  useEffect(() => { setTab('tabla'); }, [id]);
  const desliza = useDesliza(tab, PEST.map(([k]) => k));
  const ls = liga.ligas();
  // 🏆 una temporada que terminó (`<liga>~<día>`, de «Ligas completadas»): viene entera en el detalle, con «Cómo
  // funciona» de su liga
  const C = ls.find((x) => x.id === id) ? null : (DET.comp || {})[id];
  const vieja = !!C;
  const L = C ? Object.assign({}, C, { info: (det[C.liga] || {}).info }) : conDetalle(ls.find((x) => x.id === id), det);
  if (!L) return id.indexOf('~') > 0 && !DET.d ? null : <LigasPortada liga={liga} falta={id} />;
  const et = etiquetaTemp(L, liga);
  const h = herramientas(liga, L);
  // 🃏 el álbum: la carta de liga de cada uno de la tabla que la tiene, en el orden de la tabla
  L.album = (L.tabla || []).map((f, i) => [f, i, h.kDe(f[0])]).map(([f, i, k]) => [f, i, k, k ? cartaLiga(liga, L.id, k) : ''])
    .filter((x) => x[3]);
  const s = liga.svs[L.sv] || {};
  const sig = siglaDe(L.sv);
  const color = s.color || '#E41373';
  const e = estado3(liga, L);
  const fin = !!((L.fin && L.fin.c) || L.cerrada);
  // las de su servidor primero
  const otras = ls.filter((x) => x.id !== L.id).sort((a, b) => (b.sv === L.sv) - (a.sv === L.sv));
  // «Cómo funciona» se mudó a un botón (Dlx, 15/11/2026): no es una pestaña más
  const pest = PEST.filter(([k]) => k !== 'como' && hay(L, k));
  const tv = pest.some(([k]) => k === tab) ? tab : 'tabla';
  const t = L.tabla || [];
  // lo que pasa ahora, a la derecha de arriba
  let vis = null;
  if (fin && L.fin && L.fin.c) {
    const p = (L.fin.p && L.fin.p.length ? L.fin.p : t.map((f) => f[0])).slice(0, 3);
    vis = (
      <div className="lp3-camp">
        <Carta3 liga={liga} L={L} raw={L.fin.c} h={h} />
        <span><Tag3 k="fin" /><h3>{limpio(L.fin.c)} se queda con la liga</h3>
          <ol className="lp3-podio">{[1, 0, 2].map((i) => (p[i] ? <li key={p[i]} className={'p' + (i + 1)}>{h.cara(p[i], 'cara lp3-p-c')}<b>{h.nombre(p[i])}</b><span>{i + 1}</span></li> : <li key={'v' + i} className="vacio" />))}</ol></span>
      </div>
    );
  } else if (e.k === 'prox' && L.prox) {
    vis = (
      <div className="lp3-tk">
        <span className="lp3-tk-f" style={{ backgroundImage: L.fl ? 'url(' + L.fl + ')' : escenaDe(L.sv) ? 'url(' + escenaDe(L.sv) + ')' : undefined }} />
        <span className="lp3-tk-n"><Proxima liga={liga} P={L.prox} /></span>
      </div>
    );
  } else if (t.length > 1 && (e.k === 'decide' || e.k === 'juego')) {
    vis = <div className="lp3-vs"><CaraACara3 liga={liga} L={L} h={h} e={e} /><Carrera3 liga={liga} L={L} /></div>;
  } else if (t.length > 1) vis = <Podio3 L={L} h={h} />;
  const fondo = escenaDe(L.sv) || L.fl;
  return (
    <>
      <section className={'lp3-h lgx-' + e.c} style={{ '--c': color }}>
        {fondo ? <span className="lp3-fondo" style={{ backgroundImage: 'url(' + fondo + ')' }} /> : null}
        <div className="lp3-in">
          <nav className="lp3-miga" aria-label="Volver">
            <span><a href="#/ligas"><Ico n="flecha" t={16} />Todas las ligas</a>
              {vieja && ls.some((x) => x.id === L.liga) ? <a href={'#/ligas/' + encodeURIComponent(L.liga)}>La temporada de ahora</a> : null}</span>
          </nav>
          {vieja ? null : <BatallasAhora liga={liga} id={L.id} />}
          <div className="lp3-top">
            <div className="lp3-id">
              <img className="lp3-logo" alt="" src={liga.logo(L.sv, true)} />
              <div>
                <span className="lp3-meta"><Tag3 k={e.k} /><span>Liga · {sig}{et ? ' · ' + et : L.j ? ' · jornada ' + L.j : ''}</span></span>
                <h1 className={L.n.length > 24 ? 'muy-largo' : L.n.length > 14 ? 'largo' : ''}>{L.n}</h1>
                <p>{e.largo} · de <a href={'#/sv/' + sig}>{s.nombre || sig}</a> · {num(L.bat)} {L.bat === 1 ? 'batalla' : 'batallas'} · {t.length} raperos</p>
                <div className="lp3-acc">
                  {/* una temporada que terminó, o una liga cuyos canales ya no están, no tiene nada que seguir */}
                  {vieja || fin ? null : <SeguirLiga key={L.id} L={L} />}
                  <Compartir cls="btn borde" url={enlace(aLiga(L))} texto={'La tabla de ' + L.n + (et ? ' ' + et : '') + ' en la Liga Global'} />
                  {/* 📖 junto a Seguir y no arriba a la derecha: ahí va el «¿Cómo funciona?» de la página (comofunciona.jsx), y se pisaban */}
                  <BotonComo titulo="Cómo funciona esta liga">{hay(L, 'como') ? <Como liga={liga} L={L} h={h} /> : COMO_LIGAS}</BotonComo>
                  {L.link && !vieja && !L.cerrada ? <a className="lp3-dc" href={L.link} target="_blank" rel="noopener noreferrer">Su tabla en Discord ↗</a> : null}
                </div>
              </div>
            </div>
            {vis ? <div className="lp3-vis">{vis}</div> : null}
          </div>
          <Minis3 liga={liga} L={L} h={h} />
        </div>
      </section>
      {pest.length > 1 ? (
        <nav className="lp3-tabs" role="tablist" aria-label={'Lo de ' + L.n}>
          {pest.map(([k, tt]) => (
            <button key={k} type="button" role="tab" aria-selected={tv === k} className={tv === k ? 'on' : ''} onClick={() => setTab(k)}>
              {k === 'fechas' ? 'Jornadas' : tt}{k === 'fechas' ? <small>{(L.fechas || []).length}</small> : k === 'album' ? <small>{L.album.length}</small> : null}</button>
          ))}
        </nav>
      ) : null}
      <div className="lpg-pest" ref={desliza}>
        {tv === 'tabla' ? (
          <section className="sec lp3-2" id="lgp-tabla">
            <div><div className="sec-t"><h2>La tabla</h2></div><Torneo liga={liga} L={L} h={h} sinLado corta={12} /></div>
            <aside className="lp3-lado">
              {(L.ult || []).length ? (
                <div className="lp3-caja"><h3>Lo último<small>{desde3(liga, L.ult_t)}</small></h3>
                  <ul className="lq3-ult">{L.ult.slice(0, 3).map(([a, b, g, como, j], i) => (
                    <li key={i}>{h.cara(g, 'cara lq3-l-c')}<span><b>{h.nombre(g)}</b> le ganó a {h.nombre(g === a ? b : a)}<small>{como === 'replica' ? 'en réplica' : 'directo'}{j ? ' · jornada ' + j : ''}</small></span></li>
                  ))}</ul></div>
              ) : null}
              {L.flyer ? <div className="lp3-caja"><h3>El último flyer<small>{sig}</small></h3><Flyer liga={liga} L={L} /></div> : null}
              {/* ⏱️ y no la que ya pasó para quien mira: Proxima decía «HOY» (18/11/2026, ver `faltan3()`) */}
              {L.prox && e.k !== 'prox' && faltan3(liga, L.prox) >= 0 ? <div className="lp3-caja"><Proxima liga={liga} P={L.prox} /></div> : null}
            </aside>
          </section>
        ) : null}
        {tv === 'album' ? (
          <Sec id="lgp-album" titulo="El álbum" extra="lgp-sec">
            <ul className="lq-alb">{L.album.map(([f, i, k, u]) => (
              <li key={k}>
                <a href={'#/r/' + encodeURIComponent(k)} aria-label={'El perfil de ' + liga.aka(f[0], k)}><img src={u} alt={'Carta de liga de ' + liga.aka(f[0], k)} loading="lazy" decoding="async" /></a>
                <small>{i + 1}º · {liga.aka(f[0], k)}</small>
              </li>
            ))}</ul>
            <p className="pronto-p">{vieja ? 'Las cartas de esa temporada, como quedaron al terminar: ya no cambian.'
              : 'Cada uno que juega la liga tiene su carta, y se pone al día con cada jornada.'}</p>
          </Sec>
        ) : null}
        {tv === 'ascenso' ? (
          <Sec id="lgp-asc" titulo={'Ascenso a la ' + L.asc.n} extra="lgp-sec"><Ascenso A={L.asc} h={h} desde={L.id} /></Sec>
        ) : null}
        {tv === 'fechas' ? <Sec id="lgp-fechas" titulo="Jornadas" extra="lgp-sec"><Jornadas3 L={L} h={h} /></Sec> : null}
        {tv === 'numeros' ? <Sec id="lgp-numeros" titulo="Los números" extra="lgp-sec"><Numeros L={L} h={h} /></Sec> : null}
        {tv === 'staff' ? <Sec id="lgp-staff" titulo="El staff" extra="lgp-sec"><Staff liga={liga} L={L} /></Sec> : null}
        {tv === 'flyers' ? <Sec id="lgp-flyers" titulo="Los flyers" extra="lgp-sec"><Flyers liga={liga} L={L} /></Sec> : null}
        {tv === 'videos' ? <Sec id="lgp-videos" titulo="Los videos" extra="lgp-sec"><Videos L={L} /></Sec> : null}
      </div>
      {otras.length ? (
        <Sec id="lgp-otras" titulo="Las otras ligas" enlace="Todas" href="#/ligas">
          {/* filas parejas en la compu (18/10/2026): diez en dos de cinco, no siete y tres con un hueco al lado */}
          {/* 🏁 como cartelera, con el flyer grande (19/11/2026): las primeras 10 en dos filas; «Todas» lleva a la cartelera */}
          <nav className="lgp-otras" aria-label="Las otras ligas" style={{ '--cols': Math.ceil(Math.min(10, otras.length) / Math.ceil(Math.min(10, otras.length) / 6)) }}>
            {otras.slice(0, 10).map((x) => (
              <a key={x.id} href={aLiga(x)} style={{ '--c': (liga.svs[x.sv] || {}).color || '#E41373' }}>
                {x.fl ? <img className="th" alt="" src={x.fl} loading="lazy" decoding="async" /> : <img alt="" src={liga.logo(x.sv)} />}<b>{x.n}</b><small>{siglaDe(x.sv)}</small>
              </a>
            ))}
          </nav>
        </Sec>
      ) : null}
      {vieja ? null : <ModsLiga L={L} />}
    </>
  );
}

// 📈 EL ASCENSO, AL DÍA (Dlx, 17/10/2026: «crear un ascenso actualizado para cada servidor para sus ligas», «y también
// que esté en la página, obvio»; y a «¿mostramos sólo la oficial o también la calculada?», «Va»). Lo arma el ciclo
// (`bot/ascenso.py`): SU tabla oficial más lo que vino después, con SUS reglas, y lo que no se sabe no suma y se dice.
// Lo oficial lo decide su staff: la página lo aclara arriba. Los que suben y el play-off, marcados; `+N`, lo sumado
const dm = (d) => (d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) : '');
// 🪪 `liga` (21/11/2026, la pestaña Ascensos del Ranking): con ella, cada renglón con perfil lleva su cara y el nombre de
// la Liga, como las demás tablas del Ranking. La tabla oficial de cada servidor trae los nombres en MAYÚSCULAS
export function Ascenso({ A, h, desde = '', liga = null }) {
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
        {/* 🪪 sin nombre, el mismo texto que los podios de bot/ascenso.py (18/11/2026): 7 de las 168 de FFA llegaban con el
            nombre vacío —un Discord ID que no está en la Lista— y el renglón era un puesto y unos puntos sin nadie */}
        {ver.map(([n, cc, pts, suma, k], i) => (
          <li key={i + n} className={(i < suben ? 'sube' : i < suben + po ? 'po' : '') + (k && k === h.miK ? ' yo' : '')}>
            <span className="asc-i">{i + 1}</span>
            {/* sin clave, la inicial (22/11/2026, la 2.ª revisión): sin cara, la bandera y el nombre arrancaban ~36 px más a la
                izquierda que los de arriba y abajo */}
            <span className="asc-n">{liga ? (k ? <Cara liga={liga} k={k} nombre={n} cls="cara asc-cara" />
              : <span className="cara asc-cara ini" aria-hidden="true">{(limpio(n) || '?').slice(0, 1).toUpperCase()}</span>) : null}{cc ? <Bandera cc={cc} /> : null}
              {k ? <a href={'#/r/' + encodeURIComponent(k)}>{liga && liga.T[k] ? limpio(liga.T[k].n) : limpio(n)}</a> : <span>{limpio(n) || 'Una cuenta de Discord'}</span>}</span>
            {suma ? <em className="asc-mas">+{num(suma)}</em> : <span />}
            <b className="asc-pts">{num(pts)}</b>
          </li>
        ))}
      </ol>
      {filas.length > 12 ? <button type="button" className="btn borde2 chico" onClick={() => setTodo(!todo)}>{todo ? 'Ver menos' : 'Ver los ' + filas.length}</button> : null}
      <p className="asc-ley">{suben ? <span className="asc-c sube">Sube</span> : null}{po ? <span className="asc-c po">Play-off</span> : null}<em className="asc-mas">+N</em> lo que se sumó a la oficial</p>
      {(A.sum || []).length ? <p className="asc-p">🆕 Se sumó: {A.sum.map(([e, d, r]) => limpio(e) + ' (' + dm(d) + ', rango ' + String(r).toUpperCase() + ')').join(' · ')}.</p> : null}
      {(A.pend || []).length ? <p className="asc-p">⏳ Todavía no suma: {A.pend.map(([e, d, q]) => limpio(e) + ' (' + dm(d) + '): ' + (q === 'rango' ? 'falta saber su rango' : q)).join(' · ')}</p> : null}
    </div>
  );
}

const corto = (n) => String(n || '').replace('FMH ', '').replace('FMS ', '').replace('Snake League ', '').replace('Champions League ', 'Champions ').replace('Snake ', '');
// la carta de liga de esa clave en esa liga (la chica: se dibuja en chico), o '' si no tiene
function cartaLiga(liga, lid, k, grande = false) {
  const x = ((DET.c || {})[k] || []).find((y) => y[0] === lid);
  return x ? liga.d.r2 + '/' + encodeURIComponent(k) + '/liga-' + lid + (grande ? '' : '.chica') + '.webp?v=' + x[1] : '';
}
// 🌎 los países y 🏃 la carrera de todos: las batallas con ganador de todas las ligas (las fechas del detalle)
function cuentas(liga, ls, hs, det) {
  const pais = {}, gente = {};
  ls.forEach((L) => {
    const h = hs[L.id];
    ((det[L.id] || {}).fechas || []).forEach((f) => f.b.forEach((b) => {
      if (!b[2]) return;
      [b[0], b[1]].forEach((raw) => {
        const k = h.kDe(raw);
        const g = b[2] === raw ? 1 : 0;
        const id = k || limpio(raw).toLowerCase();
        // 🏟️ y en cuántas ligas (`ls`, 18/11/2026): las batallas son de todas, y el rótulo con la primera sola decía
        // «FMS Ceuta · de 33» de alguien que juega ocho, cuando Ceuta tiene 4
        const q = gente[id] = gente[id] || { raw, L, g: 0, j: 0, ls: new Set() };
        q.ls.add(L.id);
        q.g += g;
        q.j += 1;
        const fi = k && (liga.T[k] || (liga.X && liga.X[k]));
        const cc = fi && fi.cc;
        if (!cc) return;
        const P = pais[cc] = pais[cc] || { g: 0, j: 0, ks: new Set() };
        P.g += g;
        P.j += 1;
        P.ks.add(k);
      });
    }));
  });
  const ps = Object.entries(pais).filter(([, P]) => P.g).sort((a, b) => b[1].g - a[1].g).slice(0, 8);
  const cs = Object.values(gente).filter((q) => q.g).sort((a, b) => b.g - a.g || a.j - b.j).slice(0, 8);
  return { ps, cs };
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
  } else if (yo.fc) {
    // 🪪 fuera de concurso (18/11/2026): `topCierre()` lo saca, y acá leía «Estás pegado al 16º» o «Te faltan 3 de OVR»
    // aunque no puede entrar. Lo que le falta es verificarse, como dice el Ranking
    txt = <>Hoy juegas <b>fuera de concurso</b>: para entrar a {que} tienes que verificarte en Discord Rap Español.</>;
  } else if (cual === 'competitivo' && !yo.rg) {
    // 🎯 los eventos que cuentan son los de Tier 1 (`evc`, como el Ranking): con `ev`, Vilca leía «hacen falta 10…: llevás
    // 26» (18/11/2026). Y cuántos pide, de `requisitos` del payload, como `req()` de ranking.jsx
    const q = (liga.d.requisitos || []).find((x) => x.id === 'competitivo');
    const m = q && /(\d+)/.exec((q.pide || [])[0] || '');
    const pide = m ? Number(m[1]) : 10;
    txt = <>Para entrar al Competitivo hacen falta <b>{pide} eventos</b> de servidores Tier 1 o 2 en la temporada: llevas {(typeof yo.evc === 'number' ? yo.evc : yo.ev) || 0}.</>;
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

// los invictos: 5 o más ganadas sin perder ninguna en una liga (lo de «Lo mejor de las ligas», 16/10/2026)
const INVICTO = 5;

// `#/ligas` es la portada y `#/ligas/<id>` el perfil de esa liga; la Superliga y la Clausura, las dos de la Liga Global
export function LigasPagina({ liga, id = '' }) {
  if (id === 'superliga') return <Superliga liga={liga} />;
  if (id === 'clausura') return <Clausura liga={liga} />;
  // ⏳ las ligas llegan aparte del lobby (/api/ligas, App.jsx): mientras no están, «Cargando» —el mismo de App.jsx— y no
  // «Esa liga no está» ni «Ahora no se está jugando ninguna liga», que es lo que leía quien abría un link compartido
  // (18/11/2026). La Superliga y la Clausura salen de la tabla del lobby: no esperan. Va acá y no en LigaPerfil ni en
  // LigasPortada: ahí el `return` quedaría antes de sus hooks
  if (!liga.d.ligas) return <div className="cargando" role="status"><span>Cargando…</span><i className="cargando-b" aria-hidden="true"><i /></i></div>;
  return id ? <LigaPerfil liga={liga} id={id} /> : <LigasPortada liga={liga} />;
}
