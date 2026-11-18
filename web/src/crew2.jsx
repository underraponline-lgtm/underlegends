// 🛡️ LA PÁGINA DE UNA CREW Y SUS AJUSTES (el remake del 16/11/2026, la mezcla D de la maqueta privada
// BEZkuXnUvV98jPMy6NN7KA). Dlx: «me gusta más el club para las crews, o sea cada página de por sí, pero hay cosas que me
// gustan de ambas». La página es la del CLUB —el tier sobre el escudo (el nivel sobre el escudo de Clash of Clans), la
// jerarquía en pirámide (las crews de GTA Online), su gente con el aporte de cada uno (las asociaciones de Top Eleven) y
// «Lo que pasó» (el feed de Boom Beach)— con la SEMANA de la Liga al costado: la cuenta atrás, la barra entre el tier de
// abajo y el de arriba, cuánto le falta y el aviso de bajar (los Pro Clubs de EA FC).
// Los AJUSTES salen de abajo de la crew a su propia página: un menú con lo que configura cada rango y la sección al lado
// (en el celular, el menú y cada sección por separado). No se sacó nada: son los mismos bloques de `PanelCrew`, uno por
// pantalla (`solo`).
// ⚠️ Ningún número se inventa: el tier, la semana y la historia vienen de bot/crews_tiers.py (payload), la gente y los
// rangos del objeto (crews.js), los puntos de cada uno de la tabla de la temporada.
// 📅 «Por día» y «Estrellas de la semana» (17/11/2026, Dlx: «Sí, suma Estrellas de la semana y Por día»): los puntos de
// Temporada de la semana, de bot/crews_tiers.py (`T.dia` por crew y `T.gente` por persona). Sin nadie que sumó, no salen
import { limpio, num } from './liga.js';
import { Cara, Compartir, enlace, usePerfiles } from './piezas.jsx';
import { CrewCirculo } from './arriba.jsx';
import { useEffect, useRef, useState } from 'react';
import { ROL_NOMBRE, cierreCrews, crewViva, faltaCierre, ponerModCrew, useCrews } from './crews.js';
import { useModsEstado, useQuienMod } from './mods.js';
import { Anillo, EntrarCrew, PanelCrew, TierChip, consejosCrew } from './crewpanel.jsx';
import { Gente, Otros, Portada } from './entidad2.jsx';
import CSS_ENT from './css/entidad2.css?inline';
import CSS_PAGINA from './css/crew2.css?inline';
import { usarCss } from './css.js';
import { Banda, CrewHistorias, CrewMuro, CrewNoches, CrewRecords, CrewVistazo, useBalanceCrew, useCrewDatos, useMuroCrew } from './crew_bandas.jsx';

usarCss('entidad2', CSS_ENT);
usarCss('crew2', CSS_PAGINA);

const DIA = 86400000;
const clave = (c) => c.clave || c.crew;
const porLugar = (a, b) => (a.o || a.pos || 999) - (b.o || b.pos || 999);
const claveNombre = (s) => String(s || '').normalize('NFD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const enlaceCrew = (id) => '#/crew/' + encodeURIComponent(id);
const ENTRA = { abierta: 'Abierta', pedido: 'Con pedido', invitacion: 'Sólo invitados' };
const fecha = (ms) => new Date(ms).toLocaleDateString('es', { timeZone: 'America/New_York', day: '2-digit', month: '2-digit' });
const fechaSem = (s) => { const [, m, d] = String(s).split('-'); return d + '/' + m; };

/** Lo que hace falta de una crew, de los dos lados: el objeto (`viva`) y el payload (`c0`, sus puntos). */
function laCrew(liga, id) {
  const cs = liga.d.crews || [];
  const viva = crewViva(id);
  const c0 = cs.find((x) => clave(x) === id) || cs.find((x) => limpio(x.crew).toLowerCase() === limpio(id).toLowerCase())
    || (viva ? cs.find((x) => clave(x) === viva.id) : null);
  return { cs, viva, c0 };
}

function NoEsta() {
  return (
    <section className="sec"><div className="sec-t"><h2>Esa crew no existe</h2></div>
      <p className="pronto-p">Puede que la hayan cerrado o que el link esté mal. <a className="te-link" href="#/crews">Ver las crews</a></p></section>
  );
}

// ═══ LA PÁGINA ═══════════════════════════════════════════════════════════════════════════════════════════════════════
/** 🛠️ ¿Quien mira maneja crews ajenas ahora? Owner o Admin, con el interruptor de MODS prendido (mods.js). */
function useComoMod(liga) {
  const dc = window.DC || null;
  const Q = useQuienMod(dc, (liga && liga.yo && liga.yo.k) || (dc && dc.clave) || '');
  const M = useModsEstado();
  return !!(Q.admin && M.crews);
}

export function PaginaCrew({ liga, id }) {
  const { mia } = useCrews();
  const comoMod = useComoMod(liga);
  // 🙋 la fila de quien quedó más allá de los 200 del lobby viene en su perfil (`/api/perfiles`, `p[k].f`)
  const perf = usePerfiles();
  const compu = useCompu();
  const raiz = useRef(null);
  const [todaLaGente, setTodaLaGente] = useState(false);
  const { cs, viva, c0 } = laCrew(liga, id);
  const existe = !!(c0 || viva);
  const c = Object.assign({}, c0 || (viva ? { crew: viva.nombre, clave: viva.id, n: 0, pts: 0, gente: [] } : { crew: id, clave: id, n: 0, pts: 0, gente: [] }),
    viva && viva.logo ? { logo: viva.logo } : {});
  const nombre = limpio((viva && viva.nombre) || c.crew);
  const conPuesto = cs.filter((x) => x.rk !== 0);
  const pos = c0 ? conPuesto.indexOf(c0) + 1 : 0;
  const roles = viva ? Object.fromEntries(viva.gente.map(([k, r]) => [k, r])) : null;
  const pend = viva ? Object.fromEntries(viva.gente.filter((g) => g[3]).map((g) => [g[0], g[3]])) : null;
  const jugo = Object.fromEntries((c.gente || []).map((n) => [claveNombre(n), limpio(n)]));
  const filaDe = (k) => liga.T[k] || (perf && perf.p && perf.p[k] && perf.p[k].f) || null;
  const gente = (viva ? viva.gente.map(([k]) => filaDe(k) || { k, n: jugo[k] || k })
    : (c.gente || []).map((n) => liga.fila(n) || filaDe(claveNombre(n)) || { k: claveNombre(n), n: limpio(n) })).sort(porLugar);
  const jugaron = gente.filter((f) => f.pos || f.o || jugo[f.k]);
  const sinJugar = gente.filter((f) => !(f.pos || f.o) && !jugo[f.k]);
  const mejor = c.mejor ? liga.fila(c.mejor) : null;
  const T = liga.d.crews_tiers && liga.d.crews_tiers.nombres ? liga.d.crews_tiers : null;
  const cid = viva ? viva.id : clave(c);
  const fila = (T && T.crews && T.crews[cid]) || [0, 0, 0, null];
  const tier = fila[0];
  const color = T ? T.colores[tier] : '#E41373';
  const otras = conPuesto.filter((x) => x !== c0);
  const nGente = viva ? viva.gente.length : c.n || gente.length;
  const miCrew = !!(mia && mia.crew && viva && mia.crew.id === viva.id);
  const total = gente.reduce((a, f) => a + (f.pts || 0), 0);
  const aporte = (f) => (total && f.pts ? <small className="k2-aporte"><i style={{ width: Math.round((100 * f.pts) / total) + '%', background: color }} />{Math.round((100 * f.pts) / total)} % de la crew</small> : null);
  const dias = viva && viva.creada && !viva.oficial ? Math.floor((liga.ahora - viva.creada) / DIA) : null;
  const req = (viva && viva.req) || {};
  // 🎨 EN BANDAS, COMO EL PERFIL DEL RAPERO Y EL DEL SERVIDOR (17/11/2026, crew_bandas.jsx). Antes del `return` de «no
  // existe»: son hooks
  const ks = gente.map((f) => f.k);
  const D = useCrewDatos(liga, ks, perf);
  const muro = useMuroCrew(liga, ks, cid, nombre);
  const B = useBalanceCrew(raiz, cid, !!perf);
  if (!existe) return <NoEsta />;
  // en la compu la tabla muestra las filas que equilibran la banda (el resto, detrás de «Ver los N»); en el celular, todas
  // (la lista ya se corta sola a las 15)
  const corta = compu && !todaLaGente && jugaron.length > B.ge;
  const verGente = corta ? jugaron.slice(0, B.ge) : jugaron;
  const temporada = !!(D || muro.length || viva || T);
  return (
    <>
      <Portada forma="redondo" color={color} nombre={nombre} lado={<CrewHistorias liga={liga} ks={ks} id={cid} nombre={nombre} crew={c} />}
        emblema={<span className="k2-emb"><CrewCirculo c={c} cls="ent-crew" />{T ? <TierChip n={tier} T={T} /> : null}</span>}
        tag={pos ? '#' + pos + ' DE LAS CREWS' : 'SIN PUESTO · HACEN FALTA TRES RAPEROS'}
        sub={<>
          <span className="k2-chips">
            {viva && viva.sigla ? <span className="k2-sig">[{viva.sigla}]</span> : null}
            <span className="k2-chip">{nGente}/{(mia && mia.max) || 20}</span>
            {viva ? <span className="k2-chip">{ENTRA[viva.entrada] || 'Con pedido'}</span> : null}
            {req.rg || req.ev ? <span className="k2-chip">Pide {[req.rg ? 'letra ' + req.rg : '', req.ev ? req.ev + ' eventos' : ''].filter(Boolean).join(' y ')}</span>
              : viva ? <span className="k2-chip ok">No pide nada</span> : null}
            {dias !== null ? <span className="k2-chip">{dias <= 0 ? 'Fundada hoy' : 'Fundada hace ' + dias + (dias === 1 ? ' día' : ' días')}</span> : null}
          </span>
          {viva && viva.desc ? <p className="k2-lema">«{viva.desc}»</p> : null}</>}
        acciones={<>{viva && !miCrew ? <EntrarCrew c={viva} /> : null}
          {miCrew ? <a className="btn verde" href={enlaceCrew(viva.id) + '/ajustes'}>Ajustes de la crew</a> : null}
          {!miCrew && viva && comoMod ? <a className="btn k2-mod" href={enlaceCrew(viva.id) + '/ajustes'}>Ajustes · como mod</a> : null}
          <Compartir cls="btn borde" url={enlace(enlaceCrew(clave(c)))} texto={nombre + ' en la Liga Global'} /></>}
        numeros={[['PUNTOS', num(c.pts || 0), 'dest'], ['POR RAPERO', nGente ? num(Math.round((c.pts || 0) / nGente)) : '—'],
          ['EL MEJOR', mejor ? <a className="te-link ent-toque" href={'#/r/' + encodeURIComponent(mejor.k)}>{limpio(mejor.n)}</a> : limpio(c.mejor || '—')],
          ['JUGARON ESTA SEMANA', T ? fila[2] + '/' + nGente : '—']]} />
      <div className="pf9-pag k2-pag" ref={raiz}>
        <Banda color="negra">
          {/* 🧱 «Por día» adentro de «Esta semana», al pie (18/11/2026, «asegúrate que todas las páginas no tengan espacios
              innecesarios»): en la columna de la derecha la hacía más alta que la semana, que se estira hasta terminar junto
              a ella y quedaba vacía abajo (568×344, medido a 1333). Es lo que sumó cada día de esa misma semana */}
          <div className="pf9-g pf9-g-forma k2-b1">
            {T && viva ? <SemanaCaja liga={liga} T={T} viva={viva} fila={fila} abajo={<PorDia liga={liga} xs={(T.dia || {})[viva.id]} />} /> : null}
            <div className="pf9-pila">
              <CrewVistazo D={D} c={c} pos={pos} N={nGente} T={T && viva ? T : null} fila={fila} cid={cid} />
            </div>
          </div>
        </Banda>
        <Banda color="blanca" titulo="Su gente" link="Ranking de crews" ir="#/ranking/crews">
          <div className="pf9-g pf9-g-2 k2-b2">
            <div className="pf9-pila">
              <section className="pf9-pz k2-gente">
                <header className="pf9-h"><h3>Sus raperos · {gente.length}</h3><span>por puntos de la temporada</span></header>
                {jugaron.length ? <Gente liga={liga} gente={verGente} roles={roles} pend={pend} conFlag extra={aporte} /> : null}
                {corta || (compu && todaLaGente && jugaron.length > B.ge) ? (
                  <button type="button" className="pf9-btn" aria-expanded={todaLaGente} onClick={() => setTodaLaGente(!todaLaGente)}>{todaLaGente ? 'Ver menos' : 'Ver los ' + jugaron.length}</button>
                ) : null}
                {sinJugar.length ? (
                  <div className="ent-sin">
                    <span className="ent-sin-t">Todavía no jugaron la temporada · {sinJugar.length}</span>
                    <ul>{sinJugar.map((f) => (
                      <li key={f.k}><a href={'#/r/' + encodeURIComponent(f.k)} title={limpio(f.n)}>
                        <Cara liga={liga} k={f.k} nombre={f.n} cls="ent-sin-c" lazy /><small>{limpio(f.n)}</small></a></li>
                    ))}</ul>
                  </div>
                ) : null}
                {!gente.length ? <p className="pf9-pie">Todavía nadie de la crew jugó la temporada.</p>
                  : total ? <p className="pf9-pie">el aporte es su parte de los puntos de la crew</p> : null}
              </section>
            </div>
            <div className="pf9-pila">
              {viva ? <Piramide liga={liga} viva={viva} /> : null}
              {T && viva ? <Estrellas liga={liga} T={T} viva={viva} /> : null}
              {viva ? <Representantes liga={liga} viva={viva} gente={jugaron} /> : null}
            </div>
          </div>
        </Banda>
        {temporada ? (
          <Banda color="negra" titulo="Su temporada" link="Ranking" ir="#/ranking">
            <div className="pf9-g pf9-g-rail k2-b3">
              {/* el muro arriba de todo en el celular; con menos de tres publicaciones, sus noches van abajo del muro (si no, la
                  columna de al lado le sacaba cientos de píxeles) */}
              <div className="pf9-pila pf9-t-main">
                {muro.length ? <CrewMuro liga={liga} xs={muro} id={cid} nombre={nombre} n={B.mu} /> : null}
                {muro.length < 3 ? <CrewNoches liga={liga} D={D} n={B.no} /> : null}
              </div>
              <div className="pf9-pila pf9-t-lat">
                {muro.length >= 3 ? <CrewNoches liga={liga} D={D} n={B.no} /> : null}
                {viva ? <LoQuePaso liga={liga} T={T} viva={viva} /> : null}
                <CrewRecords D={D} T={T} cid={cid} />
              </div>
            </div>
          </Banda>
        ) : null}
      </div>
      <section className="sec" id="ent-otros">
        <div className="sec-t"><h2>Las otras crews</h2></div>
        <Otros href="#/crews" et="Todas las crews"
          // eslint-disable-next-line react/jsx-key
          items={otras.slice(0, 11).map((x) => [clave(x), enlaceCrew(clave(x)), <CrewCirculo c={x} cls="ent-o-crew" />, limpio(x.crew),
            T && T.crews && T.crews[clave(x)] ? T.nombres[T.crews[clave(x)][0]] : x.pts ? num(x.pts) + ' pts' : ''])} />
      </section>
    </>
  );
}

/** 🖥️ ¿Es la compu (900 px o más)? Para cortar la tabla de la gente sólo donde las columnas van lado a lado. */
function useCompu() {
  const q = '(min-width: 900px)';
  const [si, setSi] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(q).matches);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(q);
    const f = () => setSi(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return si;
}

const nombreDe = (liga, k) => { const f = liga.T[k]; return f ? limpio(f.n) : k; };

/** 👑 LA JERARQUÍA EN PIRÁMIDE (las crews de GTA Online): el Líder arriba con su corona, y cada rango debajo, más chico. */
function Piramide({ liga, viva }) {
  const de = (r) => viva.gente.filter((g) => g[1] === r).map((g) => g[0]);
  const niveles = [['lider', de('lider')], ['colider', de('colider')], ['veterano', de('veterano')], ['miembro', de('miembro')]];
  const faltan = niveles.filter(([r, ks]) => r !== 'lider' && r !== 'miembro' && !ks.length).map(([r]) => ROL_NOMBRE[r] || r);
  return (
    <div className="k2-bloque">
      <div className="k2-tit"><h2>La jerarquía</h2><small>quién manda, de arriba a abajo</small></div>
      <div className="k2-pir">
        {niveles.filter(([, ks]) => ks.length).map(([r, ks]) => (
          <ul key={r} className={'k2-niv ' + r} aria-label={ROL_NOMBRE[r] || r}>
            {ks.map((k) => {
              const f = liga.T[k];
              return (
                <li key={k}><a href={'#/r/' + encodeURIComponent(k)}>
                  {r === 'lider' ? <span className="k2-corona">♛ LÍDER</span> : null}
                  <Cara liga={liga} k={k} nombre={nombreDe(liga, k)} cls="cara k2-pc" lazy />
                  <b>{nombreDe(liga, k)}</b><small>{f && f.pos ? '#' + f.pos : r !== 'miembro' ? ROL_NOMBRE[r] : '—'}</small>
                </a></li>
              );
            })}
          </ul>
        ))}
        {faltan.length ? <p className="k2-nota">Sin {faltan.join(' ni ').toLowerCase()}</p> : null}
      </div>
    </div>
  );
}

/**
 * ⏳ ESTA SEMANA (la Liga de la mezcla D): la cuenta atrás al lunes 11 AM, cuántos jugaron, la barra entre el tier de abajo
 * y el de arriba con la raya magenta de bajar, cuánto le falta y, desde el viernes, el aviso si va a bajar.
 */
function SemanaCaja({ liga, T, viva, fila, abajo }) {
  const [n, pts, jug] = fila;
  const N = viva.gente.length;
  const sig = n + 1 < T.nombres.length ? n + 1 : null;
  const sube = sig !== null ? T.sube[n] : null;
  const baja = T.baja[n];
  const tope = sube || Math.max(pts, baja || 1);
  const cierre = cierreCrews(liga);
  const pct = N ? Math.round((100 * jug) / N) : 0;
  const falta = sube ? Math.max(0, sube - pts) : 0;
  const juegan = sig !== null ? T.juegan[sig] : 0;
  // 📅 desde el viernes (hora del este) la semana ya casi cierra: si está debajo de la raya, se avisa
  const diaET = new Date(new Date(liga.ahora).toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
  const tarde = diaET === 5 || diaET === 6 || diaET === 0;
  const cae = baja && pts < baja;
  const kj = Object.keys(((T.gente || {})[viva.id]) || {});
  return (
    <div className="k2-caja k2-sem" style={{ '--tier': T.colores[n] }}>
      <div className="k2-tit"><h2>Esta semana</h2><small>cierra el lunes a las 11 AM (hora del este)</small></div>
      {cierre ? <span className="k2-cuenta">{faltaCierre(cierre, liga.ahora)}</span> : null}
      <div className="k2-fila">
        <Anillo pct={pct} tam={64} grosor={8}><b>{pct}%</b></Anillo>
        <span><b className="k2-gr">{num(pts)}</b><small>{jug} de {N} {jug === 1 ? 'jugó' : 'jugaron'}</small></span>
      </div>
      <div className="k2-barra" role="img" aria-label={sube ? Math.min(100, Math.round((100 * pts) / sube)) + '% de lo que pide ' + T.nombres[sig] : 'El tier más alto'}>
        <u style={{ width: Math.min(100, Math.round((100 * pts) / tope)) + '%' }} />
        {baja ? <em style={{ left: Math.min(100, (100 * baja) / tope) + '%' }} /> : null}
      </div>
      <div className="k2-extremos">
        <span>{n > 0 ? <><TierChip n={n - 1} T={T} chico /> debajo de {num(baja)}</> : 'Bronce no baja'}</span>
        <span>{sube ? <>{num(sube)} <TierChip n={sig} T={T} chico /></> : 'el más alto'}</span>
      </div>
      <p className="k2-zona">{sube ? (falta ? <>Le faltan <b>{num(falta)}</b> para {T.nombres[sig]}{juegan > 1 ? ' y que jueguen ' + juegan : ''}.</>
        : jug >= juegan ? <>Si cierra así, <b>sube a {T.nombres[sig]}</b>.</> : <>Ya tiene los puntos: faltan {juegan - jug} que jueguen para subir.</>)
        : <>Es el tier más alto.</>}
        {baja ? (cae ? ' Hoy está debajo de la raya.' : ' A ' + T.nombres[n] + ' ya no la baja nada esta semana.') : ''}</p>
      {cae && tarde ? <p className="k2-aviso">Si cierra así, el lunes baja a {T.nombres[n - 1]}: faltan {num(baja - pts)} para quedarse.</p> : null}
      {kj.length ? (
        <div className="k2-jug"><span>Jugaron</span><span className="k2-caras">{kj.slice(0, 12).map((k) => <a key={k} href={'#/r/' + encodeURIComponent(k)} title={nombreDe(liga, k)}>
          <Cara liga={liga} k={k} nombre={nombreDe(liga, k)} cls="cara k2-c" lazy /></a>)}</span></div>
      ) : null}
      <p className="k2-nota">{n >= T.tarjeta ? 'La crew tiene desbloqueada su tarjeta.' : 'En ' + T.nombres[T.tarjeta] + ' se desbloquea la tarjeta de la crew.'}</p>
      {abajo}
    </div>
  );
}

// 📅 cada barra es un tramo de 24 h desde el arranque de la semana (lunes 11 AM ET), como lo arma bot/divisiones.py
const DIAS_L = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const DIAS_N = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** 📅 Por día: cuánto sumó la crew en cada día de la semana, con el de hoy marcado y los que vienen apagados. */
function PorDia({ liga, xs, caja }) {
  if (!Array.isArray(xs) || xs.length !== 7 || !xs.some((x) => x > 0)) return null;
  const max = Math.max(...xs);
  const cierre = cierreCrews(liga);
  const hoy = cierre ? Math.floor((liga.ahora - (cierre - 7 * DIA)) / DIA) : -1;
  const dibujo = (
    <div className="k2-dias-w">
      {caja ? null : <span className="k2-et">Por día</span>}
      <div className="k2-dias" role="img" aria-label={'Puntos por día: ' + xs.map((x, i) => DIAS_N[i] + ' ' + num(x)).join(', ')}>
        {xs.map((x, i) => (
          <span key={i} className={i === hoy ? 'hoy' : i > hoy && hoy >= 0 ? 'viene' : ''} title={DIAS_N[i] + ' 11 AM a ' + DIAS_N[(i + 1) % 7] + ' 11 AM · ' + num(x) + ' pts'}>
            <i style={{ height: (x ? Math.max(4, Math.round((100 * x) / max)) : 0) + '%' }} /><small>{DIAS_L[i]}</small>
          </span>
        ))}
      </div>
    </div>
  );
  if (!caja) return dibujo;
  return (
    <div className="k2-caja k2-pordia">
      <div className="k2-tit"><h2>Por día</h2><small>lo que sumó cada día de esta semana</small></div>
      {dibujo}
    </div>
  );
}

/** ⭐ Las estrellas de la semana: los tres que más sumaron para la crew, en podio (el 1.º al medio). */
function Estrellas({ liga, T, viva }) {
  const xs = Object.entries((T.gente || {})[viva.id] || {}).filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!xs.length) return null;
  const lugar = (k) => xs.findIndex((x) => x[0] === k) + 1;
  const orden = xs.length === 3 ? [xs[1], xs[0], xs[2]] : xs.length === 2 ? [xs[1], xs[0]] : xs;
  return (
    <div className="k2-caja k2-estr">
      <div className="k2-tit"><h2>Estrellas de la semana</h2><small>los que más sumaron para la crew</small></div>
      <ol className="k2-podio">{orden.map(([k, p]) => (
        <li key={k} className={'k2-pp l' + lugar(k)}>
          <a href={'#/r/' + encodeURIComponent(k)}>
            <Cara liga={liga} k={k} nombre={nombreDe(liga, k)} cls={'cara k2-pc'} lazy />
            <b>{nombreDe(liga, k)}</b><small>{num(p)} pts</small>
          </a>
          <span className="k2-esc" aria-label={lugar(k) + '.º'}>{lugar(k)}</span>
        </li>
      ))}</ol>
    </div>
  );
}

/** 🏅 Los representantes: los que cuentan en el ranking de crews (los elige quien manda), o los N mejores si no eligió. */
function Representantes({ liga, viva, gente }) {
  const { todas } = useCrews();
  const rk = (todas && todas.ranking) || {};
  const nMax = rk.n || 5;
  const reps = viva.reps || [];
  const ks = reps.length ? reps : gente.slice(0, nMax).map((f) => f.k);
  if (!ks.length) return null;
  return (
    <div className="k2-caja">
      <div className="k2-tit"><h2>Los representantes</h2><small>los que cuentan en el ranking de crews</small></div>
      <p className="k2-nota">{reps.length ? 'Los eligió quien manda: ' + reps.length + ' de ' + nMax + '.' : 'Todavía no los eligieron: cuentan los ' + nMax + ' mejores.'}</p>
      <ul className="k2-reps">{ks.map((k) => (
        <li key={k}><a href={'#/r/' + encodeURIComponent(k)}><Cara liga={liga} k={k} nombre={nombreDe(liga, k)} cls="cara k2-c" lazy /><b>{nombreDe(liga, k)}</b></a></li>
      ))}</ul>
    </div>
  );
}

/** 📜 LO QUE PASÓ: los tiers que subió y bajó (el cierre de los lunes), quién entró y cuándo se fundó. */
function LoQuePaso({ liga, T, viva, solo }) {
  const xs = [];
  for (const [f, cid, de, a] of (T && T.hist) || []) {
    if (cid === viva.id) xs.push({ t: new Date(f + 'T16:00:00Z').getTime(), c: T.colores[a], b: (a > de ? 'Subió a ' : 'Bajó a ') + T.nombres[a], s: 'lunes ' + fechaSem(f) });
  }
  const desde = viva.creada || 0;
  for (const [k, r, d] of viva.gente || []) {
    if (d && d - desde > 3600000 && liga.ahora - d < 60 * DIA) xs.push({ t: d, c: '#29B298', b: nombreDe(liga, k) + ' entró', s: fecha(d) + (r !== 'miembro' ? ' · hoy es ' + (ROL_NOMBRE[r] || r) : '') });
  }
  if (desde && !viva.oficial) xs.push({ t: desde, c: '#E41373', b: 'Se fundó la crew', s: fecha(desde) });
  xs.sort((a, b) => b.t - a.t);
  if (!xs.length) return null;
  const ver = solo ? xs : xs.slice(0, 6);
  return (
    <div className="k2-caja">
      <div className="k2-tit"><h2>Lo que pasó</h2><small>tiers, entradas y la fundación</small></div>
      <ul className="k2-feed">{ver.map((x, i) => (
        <li key={i}><i style={{ background: x.c }} aria-hidden="true" /><span><b>{x.b}</b><small>{x.s}</small></span></li>
      ))}</ul>
    </div>
  );
}

// ═══ LOS AJUSTES ═════════════════════════════════════════════════════════════════════════════════════════════════════
// 🔐 Quién puede qué, en palabras (los permisos viven en bot/crews.js `puede()`: esto sólo los muestra, y son fijos para
// todas las crews, como dijo el research: la matriz de 16 casillas de World of Warcraft no)
const PERMISOS = [['Invitar', 1, 1, 1, 0], ['Aceptar pedidos', 1, 1, 0, 0], ['Elegir representantes', 1, 1, 0, 0],
  ['Cambiar rangos y sacar', 1, 'a Veteranos y Miembros', 0, 0], ['Nombre, logo, lema y cómo se entra', 1, 0, 0, 0],
  ['Pasar el liderazgo y cerrar', 1, 0, 0, 0]];

export function AjustesCrew({ liga, id, sec }) {
  const { mia: mia0, todas, miaNo, miaMod, miaModNo } = useCrews();
  const { viva, c0 } = laCrew(liga, id);
  const comoMod = useComoMod(liga);
  const suya = !!(viva && mia0 && mia0.crew && mia0.crew.id === viva.id);
  // 🛠️ como mod (Owner o Admin con MODS prendido) y no es la tuya: se pide lo que ve su Líder, y se suelta al irse
  const mod = !!(viva && comoMod && !suya && mia0);
  useEffect(() => {
    ponerModCrew(mod ? viva.id : '');
    return () => ponerModCrew('');
  }, [mod, viva && viva.id]);
  if (!viva) return <NoEsta />;
  const logo = viva.logo || (c0 && c0.logo) || '';
  const mia = mod ? miaMod : mia0;
  const miCrew = !!(mia && mia.crew && mia.crew.id === viva.id);
  if (!miCrew) {
    if (mod) {
      return (
        <section className="sec k2-s"><div className="sec-t"><h2>Los Ajustes de {limpio(viva.nombre)}</h2></div>
          <p className="pronto-p">{miaModNo === 'no' ? 'Tu cuenta no tiene el rol para manejar crews ajenas.' : miaModNo ? 'No pude traer los Ajustes. Prueba de nuevo en un rato.'
            : 'Cargando los Ajustes como mod…'} <a className="te-link" href={enlaceCrew(viva.id)}>Ver la crew</a></p></section>
      );
    }
    return (
      <section className="sec k2-s"><div className="sec-t"><h2>Los Ajustes de {limpio(viva.nombre)}</h2></div>
        <p className="pronto-p">{!mia && miaNo ? 'Tu sesión de Discord venció: entra de nuevo para ver los Ajustes de tu crew.'
          : mia ? 'Sólo la gente de la crew ve sus Ajustes.' : 'Cargando…'} <a className="te-link" href={enlaceCrew(viva.id)}>Ver la crew</a></p></section>
    );
  }
  const rol = mia.rol;
  const manda = rol === 'lider' || rol === 'colider';
  const invita = manda || rol === 'veterano';
  const T = liga.d.crews_tiers && liga.d.crews_tiers.nombres ? liga.d.crews_tiers : null;
  const maxReps = (todas && todas.ranking && todas.ranking.n) || 5;
  const ped = (mia.pedidos || []).length;
  const consejos = manda ? consejosCrew(liga, viva, mia, T, todas) : [];
  const S = [
    manda ? ['consejos', 'Consejos', consejos.length ? consejos.length + (consejos.length === 1 ? ' para hacer' : ' para hacer') : 'la crew está al día'] : null,
    rol === 'lider' ? ['crew', 'La crew', 'nombre, sigla, lema y escudo'] : null,
    rol === 'lider' ? ['entrada', 'Cómo se entra', 'abierta, con pedido o invitados'] : null,
    invita ? ['invitar', 'Invitar', 'tu link, sugeridos y buscar'] : null,
    manda ? ['pedidos', 'Pedidos' + (ped ? ' · ' + ped : ''), 'quién quiere entrar'] : null,
    ['gente', manda ? 'La gente y los rangos' : 'Los rangos', manda ? viva.gente.length + (viva.gente.length === 1 ? ' persona' : ' personas') : 'quién puede qué'],
    manda ? ['reps', 'Representantes', 'hasta ' + maxReps] : null,
    ['pasado', 'Lo que pasó', 'tiers y entradas'],
    mod ? null : ['yo', rol === 'lider' ? 'Salir o cerrar' : 'Salir de la crew', ''],
  ].filter(Boolean);
  const actual = S.find((s) => s[0] === sec) ? sec : S[0][0];
  const base = enlaceCrew(viva.id) + '/ajustes';
  const irSec = (s) => { location.hash = base + '/' + s; };
  const tp = consejos[0];
  return (
    <>
      <div className="escena pub-esc k2-aj-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.85 }}>
        <section className="pub-cab k2-aj-cab">
          <div className="k2-aj-id"><CrewCirculo c={{ logo, crew: viva.nombre }} cls="crw-logo" />
            <span><span className={'tag' + (mod ? ' k2-tag-mod' : '')}>{mod ? 'AJUSTES · COMO MOD · TODO QUEDA ANOTADO' : 'AJUSTES · ERES ' + (ROL_NOMBRE[rol] || rol).toUpperCase()}</span><h1 className="hero-ev largo">{limpio(viva.nombre)}</h1></span></div>
          <a className="btn borde" href={enlaceCrew(viva.id)}>Ver la crew ›</a>
        </section>
      </div>
      <div className={'k2-aj' + (sec ? ' con-sec' : '')}>
        {tp && actual !== 'consejos' ? (
          <div className="k2-franja"><span><small>LO QUE CONVIENE HACER</small><b>{tp.ico} {tp.t}</b><span>{tp.d}</span></span>
            <a className="btn negro" href={base + '/consejos'}>{consejos.length > 1 ? 'Ver los ' + consejos.length : 'Ver'}</a></div>
        ) : null}
        <div className="k2-aj-g">
          <nav className="k2-aj-m" aria-label="Ajustes de la crew">
            {S.map(([k, t, s]) => (
              <a key={k} href={base + '/' + k} className={k === actual ? 'on' : ''} aria-current={k === actual ? 'page' : undefined}>
                <span><b>{t}</b>{s ? <small>{s}</small> : null}</span><i aria-hidden="true">›</i></a>
            ))}
          </nav>
          <div className="k2-aj-sec">
            <a className="k2-volver" href={base}>‹ Ajustes</a>
            <div className="k2-tit"><h2>{(S.find((s) => s[0] === actual) || [])[1]}</h2></div>
            {actual === 'gente' ? (
              <div className="k2-perm-w">
                <table className="k2-perm">
                  <thead><tr><th scope="col"><span className="sr">Qué</span></th>{['lider', 'colider', 'veterano', 'miembro'].map((r) => <th key={r} scope="col" className={r === rol ? 'yo' : ''}>{ROL_NOMBRE[r]}</th>)}</tr></thead>
                  <tbody>{PERMISOS.map(([t, ...xs]) => (
                    <tr key={t}><th scope="row">{t}</th>{xs.map((x, i) => <td key={i} className={x ? 'si' : 'no'}>{typeof x === 'string' ? x : x ? '✓' : '—'}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
            ) : null}
            {actual === 'pasado' ? <LoQuePaso liga={liga} T={T} viva={viva} solo />
              : actual === 'consejos' ? <PanelCrew liga={liga} c={viva} solo="consejos" onIr={irSec} mod={mod} />
                : <PanelCrew liga={liga} c={viva} solo={actual} onIr={irSec} mod={mod} />}
          </div>
        </div>
      </div>
    </>
  );
}

