// 🏆 LA PÁGINA DE COMPETENCIAS (#/competencias). Nació el 26/10/2026 como tres listas; Dlx: «siento que es muy básica»,
// «tiene que ser más visual… como Top Eleven… y por qué todo está negro, recuerda seguir el estilo de las nuevas páginas
// remake», y eligió la maqueta B («Vestuario») con «que muestre completamente los 10 de la liga… elite league, gold
// league… y que muestre cómo se juega». Ideas de 21st y del research de Top Eleven (reports/), sin traer código.
// De arriba abajo, como la maqueta:
//   · la ESCENA: la semana, cuánto falta para el próximo cierre y TU PRÓXIMO CRUCE, carta contra carta
//   · la tira de días
//   · LAS LIGAS: la pirámide (Oro · Plata · Bronce · Ascenso) con la Élite aparte, la liga elegida ENTERA y su jornada
//   · la Copa y la Rapid
//   · los MINI EVENTOS que rotan, el EQUIPO DE LA SEMANA y una simulada por dentro (con su jurado sorteado)
//   · CÓMO SE JUEGA y las preguntas de quien entra nuevo
// Lo arma `bot/competencias.py`; acá sólo se dibuja.
// 🔒 QUÉ VE CADA UNO (Dlx, 04/11/2026: «el usuario que compite y está en la llave debería ver lo suyo nada más… si alguien
// no está en nada, que diga sus requisitos», y sobre las ligas, «que sí se pueda ver… oro, plata, bronce, ascenso… y todas
// las ligas»). Las ligas las ve todo el mundo. De la Copa, la Rapid y los mini eventos, cada uno ve lo suyo y de lo demás
// qué le falta para entrar. Dlx lo ve todo, con un selector de llaves. No es un candado de verdad: `/api/competencias` es
// público; es lo que cada uno tiene que mirar.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { hora, num, siglaDe, utc } from './liga.js';
import { Cara, Carta, Ico, accion, nombrePais } from './piezas.jsx';
import { PopCab } from './pop.jsx';
import {
  DIVISIONES, NIVEL, NIVELES, dondeEstoy, enFrase, enMini, faltaTxt, nombreDe, nombreLiga, todasLasLigas, ultimas, useCompetencias,
} from './competencias_datos.js';
import CSS_PAGINA from './css/competencias.css?inline';
import { usarCss } from './css.js';
import { useModsEstado, useQuienMod } from './mods.js';

usarCss('competencias', CSS_PAGINA);

const pct = (p) => Math.round((p || 0) * 100) + ' %';
const ancho = (p) => Math.round((p || 0) * 100) + '%';
const Candado = () => <svg className="cm9-cand" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2.6" /><rect x="4" y="11" width="16" height="10" fill="currentColor" /></svg>;
const Listo = () => <svg className="cm9-cand" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5 10 18 19.5 7" fill="none" stroke="currentColor" strokeWidth="3.2" /></svg>;
const inicial = (s) => (String(s || '?').replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '?').toUpperCase();
// 💰 los premios (Dlx, 27/10/2026): los montos viajan con los datos (`bot/competencias.py`, `PREMIO_*`), no se escriben acá
// 🔢 con `num()` como el resto de la página (18/11/2026): `toLocaleString('es')` no agrupa los de 4 cifras y salía «2500»
// al lado de un «12.500». Los montos de PdT son enteros
const pdt = (n) => num(n);
// 🕐 la hora del cierre (lunes 11 AM ET) en la zona de Ajustes (18/11/2026): «11 AM» escrito a mano, sin zona, era otra hora
// para quien no está en la del este (en México cierra a las 10). Sin fecha en el payload, lo de antes con su zona
const aLas = (t) => (t && !isNaN(utc(t)) && hora(t)) || '11 AM (hora del este)';
const montos = (C) => (C && C.premios && C.premios.m) || null;
const premioLiga = (C, nivel) => { const m = montos(C); return m && m.liga && m.liga[nivel]; };

function Nombre({ liga, C, k, yo }) {
  if (!k) return <span className="cm9-nadie">por definir</span>;
  const n = nombreDe(liga, C, k);
  // 🧑 el link a su perfil también para quien está fuera de las 200 filas (18/11/2026): `liga.T[k]` lo dejaba en texto
  // suelto, y los de fuera de la tabla tienen su perfil igual
  const tiene = liga && liga.existe(k);
  const cls = k === yo ? 'cm9-yo' : undefined;
  return tiene ? <a href={'#/r/' + encodeURIComponent(k)} className={cls}>{n}</a> : <span className={cls}>{n}</span>;
}

/** El cartel de cómo salió un cruce: REAL (con su evento), SIMULADO (y si fue a réplica) o POR JUGAR */
function Como({ m }) {
  if (m[3] === 'real') return <span className="cm9-tag real">REAL{m[5] ? ' · #' + m[5] : ''}</span>;
  if (m[3] === 'sim') return <span className="cm9-tags"><span className="cm9-tag sim">SIMULADO</span>{m[6] ? <span className="cm9-tag rep">RÉPLICA</span> : null}</span>;
  return <span className="cm9-tag pend">POR JUGAR</span>;
}

/** 🎭 Cómo llega alguien hoy (`C.est`, de `bot/competencias.py`): cada número va de 0 a 100 */
const ESTADOS = [['Cansancio', 0], ['Motivación', 1], ['Estrés', 2], ['Consistencia', 3]];
function ComoLlega({ e }) {
  return (
    <dl className="cm9-est">
      {ESTADOS.map(([n, i]) => <div key={n}><dt>{n}</dt><dd aria-label={e[i] + ' de 100'}><i style={{ width: e[i] + '%' }} /></dd></div>)}
    </dl>
  );
}
/** Los dos, uno contra el otro: el de la izquierda crece hacia el centro */
function VsEstado({ ea, eb }) {
  return (
    <div className="cm9-vse" role="group" aria-label="Cómo llegan hoy">
      {ESTADOS.map(([n, i]) => (
        <div key={n}>
          <span className="cm9-vse-b izq"><i style={{ width: ea[i] + '%' }} /></span>
          <small>{n}</small>
          <span className="cm9-vse-b"><i style={{ width: eb[i] + '%' }} /></span>
        </div>
      ))}
    </div>
  );
}

/** El jurado sorteado de una simulada: quién votó a quién */
function Jurado({ liga, C, m }) {
  if (m[3] !== 'sim' || !Array.isArray(m[5])) return null;
  const va = m[5].filter(([, v]) => v === 'a').length;
  return (
    <div className="cm9-jur">
      <small>Jurado sorteado · {Math.max(va, 3 - va)}–{Math.min(va, 3 - va)}{m[6] ? ' en la réplica' : ''}</small>
      {m[5].map(([q, v]) => (
        <span key={q}><i>{inicial(juradoNombre(liga, C, q))}</i>{juradoNombre(liga, C, q)}<b className={v === (m[2] === m[0] ? 'a' : 'b') ? 'ok' : 'no'}>{nombreDe(liga, C, v === 'a' ? m[0] : m[1])}</b></span>
      ))}
    </div>
  );
}
const juradoNombre = (liga, C, q) => ((C.jur || {})[q] || {}).n || nombreDe(liga, C, q);

function Cruce({ liga, C, m, yo, jurado }) {
  const [a, b, g, como, p] = m;
  // sin cuenta `yo` es '' (18/11/2026): el lado libre ('') de un cruce salía marcado como tuyo
  return (
    <li className={'cm9-cru ' + como + (!!yo && (a === yo || b === yo) ? ' tuyo' : '')}>
      <Como m={m} />
      <span className="cm9-cru-l">
        <span className={g && g === a ? 'gana' : g ? 'pierde' : ''}>{a ? <Cara liga={liga} k={a} nombre={nombreDe(liga, C, a)} cls="cara cm9-cara-ch" lazy /> : null}<Nombre liga={liga} C={C} k={a} yo={yo} /></span>
        <small>vs</small>
        <span className={g && g === b ? 'gana' : g ? 'pierde' : ''}>{b ? <Cara liga={liga} k={b} nombre={nombreDe(liga, C, b)} cls="cara cm9-cara-ch" lazy /> : null}<Nombre liga={liga} C={C} k={b} yo={yo} /></span>
      </span>
      {como === 'pend' && a && b ? (
        <span className="cm9-p" title={'Si no se cruzan antes del cierre, se simula: ' + nombreDe(liga, C, a) + ' gana ' + pct(p) + ' de las veces'}>
          <small>Chances si se simula</small>
          <span className="cm9-p-b"><i style={{ width: ancho(p) }} /></span>
          <span className="cm9-p-n"><b>{pct(p)}</b><b>{pct(1 - p)}</b></span>
        </span>
      ) : null}
      {jurado && m[6] ? <small className="cm9-cru-rep">Fue a réplica: 2 puntos al que ganó, 1 al que perdió.</small> : null}
      {jurado ? <Jurado liga={liga} C={C} m={m} /> : null}
    </li>
  );
}

/** «3–0»: cómo votó el jurado de una simulada */
const marcador = (m) => {
  if (!Array.isArray(m[5]) || !m[5].length) return '';
  const va = m[5].filter(([, v]) => v === 'a').length;
  return Math.max(va, m[5].length - va) + '–' + Math.min(va, m[5].length - va);
};

/** 🔎 LA FILA QUE SE ABRE AHÍ MISMO (Dlx, 04/11/2026: «click como en ranking para ver un poco de info»): su carta, sus
 *  números y cómo le fue en esta liga, jornada por jornada */
function DetalleFila({ liga, C, g, f, yo }) {
  const [k, pj, gg, , ptb] = f;
  const t = liga.T[k];
  const cual = t ? liga.cartaDe(k, { comp: true }) : null;
  const jornada = (C.ligas || {}).jornada;
  const suyos = (g.j || []).map((j) => ({ n: j.n, m: j.p.find((x) => x[0] === k || x[1] === k) })).filter((x) => x.m && (x.m[2] || x.n === jornada));
  return (
    <div className={'cm9-det' + (cual ? '' : ' sin')}>
      {cual ? <div className="cm9-det-carta"><Carta liga={liga} k={k} cual={cual} cls="cm9-det-ci" /></div> : null}
      <div className="cm9-det-l">
        <dl className="cm9-det-n">
          <div><dt>En esta liga</dt><dd>{gg}–{pj - gg}</dd></div>
          {ptb != null ? <div><dt>PTB</dt><dd>{ptb}</dd></div> : null}
          {t ? <div><dt>OVR</dt><dd>{t.ovr || '—'}</dd></div> : null}
          {t ? <div><dt>Puntos</dt><dd>{num(t.pts)}</dd></div> : null}
          {t ? <div><dt>Eventos</dt><dd>{t.ev || 0}</dd></div> : null}
          {t && t.wr ? <div><dt>Win%</dt><dd>{Math.round(parseFloat(String(t.wr).replace(',', '.')) || 0)}%</dd></div> : null}
        </dl>
        {C.est && C.est[k] ? <span className="cm9-et">Cómo llega hoy</span> : null}
        {C.est && C.est[k] ? <ComoLlega e={C.est[k]} /> : null}
        {suyos.length ? <span className="cm9-et">Sus cruces en esta liga</span> : null}
        {suyos.length ? (
          <ol className="cm9-det-c">
            {suyos.map(({ n, m }) => {
              const rival = m[0] === k ? m[1] : m[0];
              const gano = m[2] === k;
              const mia = m[0] === k ? m[4] : 1 - m[4];
              return (
                <li key={n}>
                  <small>J{n}</small>
                  <i className={m[2] ? (gano ? 'g' : 'p') : 'n'} aria-label={m[2] ? (gano ? 'ganó' : 'perdió') : 'por jugar'}>{m[2] ? (gano ? 'G' : 'P') : '·'}</i>
                  <span className="cm9-det-r"><Cara liga={liga} k={rival} nombre={nombreDe(liga, C, rival)} cls="cara cm9-cara-ch" lazy /><Nombre liga={liga} C={C} k={rival} yo={yo} /></span>
                  <em>{m[3] === 'real' ? 'REAL' + (m[5] && !Array.isArray(m[5]) ? ' · #' + m[5] : '') : m[3] === 'sim' ? ('SIM ' + marcador(m)).trim() + (m[6] ? ' · RÉPLICA' : '') : pct(mia)}</em>
                </li>
              );
            })}
          </ol>
        ) : null}
        {/* 🧑 «Ver su perfil» también para quien está fuera de las 200 filas (18/11/2026): tiene su perfil igual */}
        {liga.existe(k) ? <div className="cm9-det-acc"><a className="btn negro chico" href={'#/r/' + encodeURIComponent(k)}>Ver su perfil</a></div> : null}
      </div>
    </div>
  );
}

/** La tabla de una liga ENTERA, con sus zonas: campeón, suben, bajan. Cada fila se abre ahí mismo, como en el Ranking */
function TablaLiga({ liga, C, g, yo }) {
  const [abierta, setAbierta] = useState(null);
  const n = g.t.length;
  const esElite = g.id === 'elite';
  const zona = (i) => {
    if (i === 0) return 'campeon';
    if (!esElite && g.nv !== 'oro' && i < 2) return 'sube';
    if (!esElite && g.nv !== 'ascenso' && n >= 6 && i >= n - 2) return 'baja';
    return '';
  };
  // ⚖️ el PTB viene de `bot/competencias.py` desde la temporada 2 de las ligas: mientras no venga, no hay columna
  const conPtb = g.t.some((f) => f[4] != null);
  return (
    <div className="cm9-tw">
      <table className="cm9-tabla">
        <thead><tr><th>#</th><th aria-label="Foto" /><th>Rapero</th><th>PJ</th><th>G</th><th>P</th><th>Últimas</th>{conPtb ? <th title="Votos de jurado a favor">PTB</th> : null}<th>PTS</th></tr></thead>
        <tbody>
          {g.t.map((f, i) => {
            const [k, pj, gg, pts, ptb] = f;
            const ab = abierta === k;
            // sin cuenta `yo` es '' (18/11/2026): una fila de clave vacía salía marcada como tuya
            return (
              <Fragment key={k}>
                <tr className={(zona(i) + (!!yo && k === yo ? ' yo' : '')).trim() || undefined} aria-expanded={ab} tabIndex={0}
                  onClick={(e) => { if (!e.target.closest('a, button')) setAbierta(ab ? null : k); }}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setAbierta(ab ? null : k); } }}>
                  <td>{i + 1}</td>
                  <td><Cara liga={liga} k={k} nombre={nombreDe(liga, C, k)} cls="cara cm9-cara" lazy /></td>
                  <td><Nombre liga={liga} C={C} k={k} yo={yo} /></td>
                  <td>{pj}</td><td>{gg}</td><td>{pj - gg}</td>
                  <td><span className="cm9-fo">{ultimas(g, k).concat(Array(5).fill('')).slice(0, 5).map((x, j) => <i key={j} className={x[0] === 'G' ? 'g' : x[0] === 'P' ? 'p' : ''} title={x.length > 1 ? (x[0] === 'G' ? 'Ganó en réplica' : 'Perdió en réplica') : undefined}>{x.length > 1 ? 'R' : x}</i>)}</span></td>
                  {conPtb ? <td>{ptb}</td> : null}
                  <td className="cm9-pts"><b>{pts}</b></td>
                </tr>
                {ab ? <tr className="cm9-det-f"><td colSpan={conPtb ? 9 : 8}><DetalleFila liga={liga} C={C} g={g} f={f} yo={yo} /></td></tr> : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="cm9-ley">
        <span><i className="campeon" />{esElite ? 'Campeón de la Élite' : 'Campeón'}</span>
        {!esElite && g.nv !== 'oro' ? <span><i className="sube" />Suben de liga</span> : null}
        {!esElite && g.nv !== 'ascenso' ? <span><i className="baja" />Bajan de liga</span> : null}
        <span><i className="g" />G ganó · <i className="p" />P perdió{g.t.some((f) => ultimas(g, f[0], 9).some((x) => x.length > 1)) ? ' · R fue a réplica: 2 puntos al que gana y 1 al que pierde' : ''}</span>
        {conPtb ? <span><b>PTB</b> votos de jurado a favor, 3 en juego por batalla. Desempata</span> : null}
        <span className="cm9-ley-toca">Toca una fila para ver más</span>
      </div>
    </div>
  );
}

/** Un lado de un cruce: cara, nombre y, según cómo va, la ✓ del que pasó o sus chances si se simula */
function Lado({ liga, C, k, m, pos, yo }) {
  const [a, b, g, como, p] = m;
  if (!k) return <span className="cm9-br-l vacio">{como === 'pase' ? 'pase libre' : 'por definir'}</span>;
  const n = nombreDe(liga, C, k);
  const gano = g && g === k;
  const chance = como === 'pend' && a && b ? (pos === 0 ? p : 1 - p) : null;
  return (
    <span className={'cm9-br-l' + (gano ? ' g' : g ? ' out' : '') + (k === yo ? ' yo' : '')}>
      <Cara liga={liga} k={k} nombre={n} cls="cara cm9-br-cara" lazy />
      <b>{n}</b>
      {gano ? <i className="cm9-br-ok" aria-label="pasó">✓</i> : chance != null ? <i className="cm9-br-pc">{pct(chance)}</i> : null}
    </span>
  );
}

/** 🏆 UNA LLAVE COMO CUADRO (Dlx, 26/10/2026: «esto es muy simple»): una columna por ronda con los cruces centrados entre
 *  los dos de los que vienen, la cara de cada uno, quién pasó y las chances de lo que falta, tu camino marcado, y al
 *  final la copa. En el celular se desliza de costado y abre en la ronda que se está jugando */
function Llave({ liga, C, r, yo }) {
  const caja = useRef(null);
  const [entera, setEntera] = useState(false);
  const ia = r.campeon ? r.r.length : Math.max(0, r.r.findIndex((rd) => rd.p.some((m) => !m[2] && m[0] && m[1])));
  // 🏆 la de 32 son dieciséis cruces de alto: quien la juega ve SU CAMINO —su cruce en cada ronda, y dónde cae el que
  // sigue— y la abre entera si quiere. Un lugar de una ronda baja a la mitad en la siguiente
  const larga = r.r[0].p.length >= 16;
  const mio = yo ? r.r[0].p.findIndex((m) => m[0] === yo || m[1] === yo) : -1;
  const camino = larga && mio >= 0 && !entera;
  useEffect(() => {
    const el = caja.current;
    const col = el && el.children[ia];
    // ⚠️ por la caja y no por `offsetLeft`, que mide contra el padre posicionado y no contra el que se desliza
    if (el && col && ia > 0 && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, col.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft - 16);
  }, [ia, camino]);
  return (
    <>
    <div className={'cm9-br' + (larga ? ' larga' : '')} ref={caja} style={{ '--n': r.r.length + 1 }}>
      {r.r.map((rd, ri) => (
        <div key={rd.r} className={'cm9-br-c' + (ri === ia ? ' hoy' : ri < ia ? ' ya' : '')}>
          <small className="cm9-br-t">{rd.r === 'Semifinal' ? 'Semis' : rd.r}<i>{ri < ia ? 'jugada' : faltaTxt(rd.hasta)}</i></small>
          <div className="cm9-br-ms">
            {(camino ? [rd.p[mio >> ri]] : rd.p).map((m, i) => (
              <div key={i} className={'cm9-br-m ' + m[3] + (yo && (m[0] === yo || m[1] === yo) ? ' tuyo' : '')}
                title={m[3] === 'real' ? 'Se cruzaron de verdad' + (m[5] && !Array.isArray(m[5]) ? ' en el #' + m[5] : '') : m[3] === 'sim' ? 'Simulado al cierre' : undefined}>
                <Lado liga={liga} C={C} k={m[0]} m={m} pos={0} yo={yo} />
                <Lado liga={liga} C={C} k={m[1]} m={m} pos={1} yo={yo} />
                {m[3] === 'real' || m[3] === 'sim' ? <em className={'cm9-br-como ' + m[3]}>{m[3] === 'real' ? 'REAL' : m[6] ? 'RÉPLICA' : 'SIM'}</em> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className={'cm9-br-c fin' + (r.campeon ? ' hoy' : '')}>
        <small className="cm9-br-t">Campeón</small>
        <div className="cm9-br-ms">
          <div className={'cm9-br-copa' + (r.campeon ? ' ok' : '') + (r.campeon && r.campeon === yo ? ' tuyo' : '')}>
            <span aria-hidden="true">🏆</span>
            {r.campeon ? <><Cara liga={liga} k={r.campeon} nombre={nombreDe(liga, C, r.campeon)} cls="cara cm9-br-cara" /><b><Nombre liga={liga} C={C} k={r.campeon} yo={yo} /></b></> : <b>por definir</b>}
          </div>
        </div>
      </div>
    </div>
    {larga && mio >= 0 ? <button type="button" className="cm9-br-ver" onClick={() => setEntera(!entera)}>{entera ? 'Ver sólo mi camino' : 'Ver la llave entera'}</button> : null}
    </>
  );
}

/** «Octavos», «Afuera en cuartos», «Campeón»: en qué va alguien en una llave */
const estado = (e) => (!e ? '' : e.campeon ? 'Campeón' : e.fuera ? 'Afuera en ' + ((e.ronda || {}).r || '').toLowerCase() : (e.ronda || {}).r || '');

/** 🎯 Tu situación en una llave, en una línea: contra quién vas, tus chances y cuándo cierra */
function TuLlave({ liga, C, e, yo }) {
  if (e.campeon) return <p className="cm9-br-tu"><b>🏆 Campeón</b> de esta llave.</p>;
  if (e.fuera) return <p className="cm9-br-tu">Quedaste <b>afuera en {((e.ronda || {}).r || '').toLowerCase()}</b>. El lunes arranca otra.</p>;
  const m = ((e.ronda || {}).p || []).find((x) => x[0] === yo || x[1] === yo);
  if (!m) return null;
  const rival = m[0] === yo ? m[1] : m[0];
  const mia = m[0] === yo ? m[4] : 1 - m[4];
  return (
    <p className="cm9-br-tu">Vas en <b>{e.ronda.r === 'Semifinal' ? 'semis' : e.ronda.r.toLowerCase()}</b>
      {rival ? <> contra <b><Nombre liga={liga} C={C} k={rival} yo={yo} /></b>: <b>{pct(mia)}</b> si se simula</> : <>: esperando rival</>}
      {/* 🕚 con `enFrase` (18/11/2026): entre el cierre y la corrida del ciclo decía «cierra en cerrado» */}
      {' '}· {enFrase(e.ronda.hasta, 'cierra en ')}. Si se cruzan en cualquier evento, cuenta esa batalla.</p>
  );
}

/** 🔒 QUIEN NO ESTÁ EN NINGUNA LLAVE VE QUÉ LE FALTA, en vez de la llave de otro. Si ya jugó, que ya cumplió: pedirle un
 *  evento a quien lo acaba de jugar es la respuesta equivocada con la cara de la correcta */
function SinLlave({ C, yo, conCuenta }) {
  const ya = !!yo && (C.entran || []).includes(yo);
  const m = montos(C);
  return (
    <section className="cm9-blq-s" aria-label="La Copa y la Rapid">
      <div className={'cm9-blq' + (ya ? ' ok' : '')}>
        <span className="cm9-blq-i">{ya ? <Listo /> : <Candado />}</span>
        {ya ? (
          <div className="cm9-blq-t"><h3>EL LUNES ENTRAS</h3><p>Ya jugaste en las últimas 2 semanas: el lunes a las {aLas(C.fin)} te toca tu llave de la Copa y tu Rapid. {enFrase(C.fin, 'Faltan ', 'Ya casi')}.</p></div>
        ) : conCuenta ? (
          <div className="cm9-blq-t"><h3>TODAVÍA NO JUEGAS LA COPA NI LA RAPID</h3><p>Para desbloquearlas, <b>juega 1 evento</b> de cualquier servidor antes del lunes y ese mismo día te toca tu llave. {enFrase(C.fin, 'Te quedan ', 'Se está cerrando')}.</p></div>
        ) : (
          <div className="cm9-blq-t"><h3>CADA UNO VE SU LLAVE</h3><p>Entra con Discord y te decimos en cuál estás o qué te falta. Para jugarlas hace falta <b>1 evento</b> en las 2 semanas antes del lunes.</p></div>
        )}
        {ya ? null : conCuenta ? <a className="btn negro" href="#/eventos">Ver los eventos</a> : <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>}
      </div>
      <div className="cm9-blq-dos">
        <article className="cm9-card">
          <header className="mag"><h3>🏆 COPA</h3><small>Cada lunes</small></header>
          <p>Una llave a eliminación con gente de tu división, que se juega durante la semana.</p>
          {m ? <p className="cm9-premio">💰 Campeón <b>{pdt(m.copa[0])}</b> · finalista <b>{pdt(m.copa[1])}</b> Puntos de Tienda</p> : null}
        </article>
        <article className="cm9-card">
          <header className="ver"><h3>⚡ RAPID</h3><small>Cada lunes</small></header>
          <p>Una llave de 8 con gente de tu mismo nivel: cuartos hasta el jueves, semis hasta el sábado, final hasta el lunes.</p>
          {m ? <p className="cm9-premio">💰 El campeón se lleva <b>{pdt(m.rapid)}</b> Puntos de Tienda</p> : null}
        </article>
      </div>
    </section>
  );
}

/** El selector de Dlx, el único que ve todas las llaves */
function ElegirLlave({ xs, v, set, nombre }) {
  return (
    <label className="cm9-elegir">
      <span>Ver la llave</span>
      <select value={v} onChange={(e) => set(e.target.value)}>
        {xs.map((x) => <option key={x.id} value={x.id}>{nombre(x)}</option>)}
      </select>
      <small>{xs.length} esta semana · sólo tú las ves</small>
    </label>
  );
}

/** 🎲 Cada mini evento explicado: qué es, quién juega y cómo se gana (la subpágina, #/competencias/mini). «Quién juega» es
 *  también lo que le falta a quien no está: un solo lugar, dicho para que se entienda sin saber qué es un «activo» */
const EXPLICA = {
  derbi: ['Dos servidores sorteados entre los que tienen 5 o más activos. Sus 5 mejores se cruzan uno contra uno.', 'Estar entre los 5 mejores de uno de los dos servidores sorteados.', 'Gana el servidor que se lleve más cruces. Cuenta lo real si se cruzan en un evento; si no, se simula al cierre.'],
  paises: ['Dos países sorteados entre los que tienen 5 o más activos. Sus 5 mejores se cruzan uno contra uno.', 'Estar entre los 5 mejores de uno de los dos países sorteados.', 'Gana el país que se lleve más cruces. Real si se cruzan, simulado si no.'],
  meta: ['Una meta para toda la Liga: llegar a una cantidad de batallas en la semana entre todos.', 'Jugar 1 evento esta semana.', 'Si se llega, cobran todos los que jugaron. La meta sale de la semana anterior, un 10 % más.'],
  supercopa: ['Una sola batalla al cierre: el que lidera la Élite contra el que lidera el Oro.', 'Ir primero en la Élite o en la Liga Oro.', 'Real si se cruzan durante la semana; si no, se simula.'],
  duos: ['Parejas sorteadas entre los que juegan: suman los puntos de Temporada de los dos en la semana.', 'Jugar 1 evento en las 2 semanas antes del lunes: ahí se sortean las parejas.', 'Gana la pareja que más puntos sume.'],
  pandillas: ['Grupos de 5 sorteados (no son las crews): suman los puntos de Temporada de todos en la semana.', 'Jugar 1 evento en las 2 semanas antes del lunes: ahí se sortean los grupos.', 'Gana la pandilla que más puntos sume.'],
  rey: ['Hay un rey: el de más nivel al arrancar. Quien le gane en un cruce real se queda con la corona.', 'Jugar 1 evento y cruzarte con el rey.', 'Es rey quien tenga la corona al cierre. Cada batalla que el rey gana es una defensa.'],
  revancha: ['Te vuelve a tocar quien te ganó la última vez.', 'Haber perdido un 1v1 en los últimos 60 días.', 'Si esta semana le ganas a quien te ganó, revancha cumplida: vale doble.'],
  racha: ['Victorias seguidas en la semana, en cualquier evento.', 'Jugar 1v1 esta semana.', 'Gana la racha más larga de la semana.'],
  novatos: ['Una llave de 8 sólo para quienes tienen menos de 5 eventos.', 'Tener menos de 5 eventos y haber jugado en las 2 semanas antes del lunes. Entran 8, sorteados.', 'Como la Rapid: cuartos, semis y final, real si se cruzan y simulado si no.'],
  maraton: ['Quien juega más eventos en la semana, en cualquier servidor.', 'Jugar 1 evento esta semana.', 'Gana quien juegue más eventos. A igual cantidad, quien sumó más puntos.'],
  trotamundos: ['Quien juega en más servidores distintos en la semana.', 'Jugar 1 evento esta semana.', 'Gana quien juegue en más servidores. A igual cantidad, quien sumó más puntos.'],
  podios: ['Quien sube más veces al podio en la semana: campeón, subcampeón o tercero.', 'Jugar 1 evento esta semana.', 'Gana quien tenga más podios. A igual cantidad, más títulos y después más puntos.'],
  batacazo: ['La mayor sorpresa de la semana: ganarle a alguien con mucho más nivel. El % es la chance que tenía de ganar.', 'Jugar 1v1 esta semana.', 'Gana el batacazo más grande.'],
  jurado: ['Quien se lleva más votos de los jurados en la semana, de lo que el bot ve en las votaciones.', 'Jugar 1 evento esta semana, en un servidor donde se vote a la vista.', 'Gana quien tenga más votos a favor. A igual cantidad, quien sumó más puntos.'],
  escalera: ['10 escalones: tu carta contra otra de tu nivel. Ganas subes, pierdes bajas, y de los escalones dorados no se baja.', 'Todos, con 3 intentos por día.', 'Se prepara: pide que juegues desde la página.'],
  fantasy: ['Eliges 3 raperos y sumas las notas que saquen en la semana.', 'Todos los que armen su equipo.', 'Se prepara: pide elegir desde la página.'],
  crews: ['Crew contra crew el fin de semana. Suma el que sube, el que se mantiene y hasta el que baja.', 'Las crews de la Liga.', 'Se prepara.'],
};

/** Lo de adentro de cada mini evento */
/** El color de cada mini evento: el cuadro de su ícono y su barra */
const COLOR_MINI = { derbi: '#E41373', paises: '#29B298', meta: '#E41373', supercopa: '#F5C542', duos: '#B07CFF', pandillas: '#56A2F2',
  rey: '#F5C542', revancha: '#E41373', racha: '#FF7A2F', novatos: '#29B298', maraton: '#29B298', trotamundos: '#56A2F2', podios: '#F5C542',
  batacazo: '#E41373', jurado: '#B07CFF' };
/** Lo que cuenta cada mini evento de tabla, y lo mínimo para cobrar (los números viajan con los datos: `MINI_MINIMO`) */
const CUENTA_MINI = { maraton: ['evento', 'eventos'], trotamundos: ['servidor', 'servidores'], podios: ['podio', 'podios'], jurado: ['voto', 'votos'] };
const minimoTxt = (C, id) => {
  const n = ((montos(C) || {}).minimo || {})[id];
  if (!n) return '';
  if (id === 'batacazo') return ' Tiene que haber tenido un ' + pct(n) + ' de chances o menos.';
  return CUENTA_MINI[id] && n > 1 ? ' Hacen falta al menos ' + n + ' ' + CUENTA_MINI[id][1] + '.' : '';
};
const MEDALLA = ['🥇', '🥈', '🥉'];

/** Un podio de 3 con barra (Dúos, Pandillas, Racha): el 1.º llena la barra y los demás en proporción */
function Podio({ filas, yo, nombre, valor, sufijo = '', texto }) {
  if (!filas.length) return <p className="cm9-ev-nada">Todavía nadie suma esta semana.</p>;
  const tope = Math.max(1, ...filas.map(valor));
  return (
    <ol className="cm9-pod">
      {filas.map((f, i) => (
        <li key={i} className={nombre(f).yo ? 'yo' : undefined}>
          <span className="cm9-pod-m" aria-hidden="true">{MEDALLA[i] || i + 1}</span>
          <span className="cm9-pod-n">{nombre(f).t}</span>
          <b>{texto ? texto(f) : num(valor(f)) + sufijo}</b>
          <i className="cm9-pod-b" style={{ width: Math.max(6, Math.round(valor(f) / tope * 100)) + '%' }} />
        </li>
      ))}
    </ol>
  );
}

/** 🔒 Un mini evento en el que no estás: qué es y qué pide. Sin cómo va, que es de los que lo juegan */
function MiniBloqueado({ C, x, completo }) {
  const ex = EXPLICA[x.id] || ['', '', ''];
  return (
    <article className={'cm9-ev rico bloq' + (completo ? ' completo' : '')} style={{ '--c': COLOR_MINI[x.id] || '#29B298' }}>
      <div className="cm9-ev-t">
        <span className="cm9-ev-ic" aria-hidden="true">{x.ic}</span>
        <span className="cm9-tag pend"><Candado />BLOQUEADO</span>
      </div>
      <h3>{x.nombre.toUpperCase()}</h3>
      <p className="cm9-ev-q">{ex[0]}</p>
      <p className="cm9-ev-pide"><b>Para entrar:</b> {ex[1]}{montos(C) && x.id !== 'meta' ? ' Premio: ' + pdt(montos(C).mini) + ' Puntos de Tienda.' : ''}</p>
    </article>
  );
}

/** Lo de adentro de cada mini evento: qué es en una línea, cómo va (con números que se leen de un vistazo) y tu lugar */
function Mini({ liga, C, x, yo, completo }) {
  const N = (k) => nombreDe(liga, C, k);
  // 🔤 el servidor, con la sigla que se lee (18/11/2026): decía «DDS 0 – 0 CH» y en el resto de la web CH es «CYH»
  const lado = (s) => (x.id === 'paises' ? nombrePais(s) : siglaDe(s));
  const ex = EXPLICA[x.id] || ['', '', ''];
  let cuerpo = null, tuyo = null;
  if (x.id === 'derbi' || x.id === 'paises') {
    const [a, b] = x.score;
    const t = a + b || 1;
    cuerpo = (
      <div className="cm9-guerra">
        <div className="cm9-guerra-n"><span>{lado(x.svs[0])}</span><b>{a} – {b}</b><span>{lado(x.svs[1])}</span></div>
        <div className="cm9-guerra-b" aria-hidden="true"><i style={{ width: Math.round(a / t * 100) + '%' }} /></div>
        <small>{x.p.filter((m) => m[2]).length} de {x.p.length} cruces resueltos · {x.p.filter((m) => m[3] === 'real').length} reales</small>
      </div>
    );
    const m = x.p.find((p) => p[0] === yo || p[1] === yo);
    if (m) tuyo = 'Estás en la guerra: contra ' + N(m[0] === yo ? m[1] : m[0]);
  } else if (x.id === 'meta') {
    const pc = Math.min(100, Math.round(x.n / x.objetivo * 100));
    cuerpo = (
      <div className="cm9-meta-v">
        <b>{x.n}<small> / {x.objetivo}</small></b>
        <div className="cm9-meta"><i style={{ width: pc + '%' }} /></div>
        {/* (con 1, en singular: decía «Faltan 1 batallas», 18/11/2026) */}
        <small>{x.n >= x.objetivo ? '¡Cumplida! Cobran todos los que jugaron.' : (x.objetivo - x.n === 1 ? 'Falta 1 batalla' : 'Faltan ' + (x.objetivo - x.n) + ' batallas') + ' · ' + pc + ' %'}</small>
      </div>
    );
  } else if (x.id === 'supercopa' && x.p) {
    cuerpo = (
      <div className="cm9-guerra">
        <div className="cm9-guerra-n"><span>{N(x.p[0])}</span><b>vs</b><span>{N(x.p[1])}</span></div>
        <small>{x.p[2] ? 'Ganó ' + N(x.p[2]) + (x.p[3] === 'real' ? ' · real' : ' · simulado') : 'Por jugar · ' + Math.round(x.p[4] * 100) + ' % – ' + Math.round((1 - x.p[4]) * 100) + ' %'}</small>
      </div>
    );
  } else if (x.id === 'duos' || x.id === 'pandillas') {
    const filas = completo ? x.t : x.t.slice(0, 3);
    cuerpo = <Podio filas={filas} yo={yo} nombre={([g]) => ({ t: g.map(N).join(' · '), yo: g.includes(yo) })} valor={([, p]) => p} />;
    const i = x.t.findIndex(([g]) => g.includes(yo));
    if (i >= 0) tuyo = 'Tu ' + (x.id === 'duos' ? 'pareja' : 'pandilla') + ' va ' + (i + 1) + '.ª de ' + x.n;
  } else if (x.id === 'rey') {
    cuerpo = (
      <div className="cm9-rey">
        <span className="cm9-rey-c" aria-hidden="true">👑</span>
        <div><b>{N(x.rey)}</b><small>{x.defensas ? x.defensas + (x.defensas === 1 ? ' defensa' : ' defensas') : 'Todavía nadie lo desafió'}</small></div>
        {x.reyes.length > 1 ? <p className="cm9-rey-h">{x.reyes.map(N).join(' → ')}</p> : null}
      </div>
    );
    if (x.rey === yo) tuyo = 'Eres el rey: defiéndelo';
  } else if (x.id === 'revancha') {
    cuerpo = (
      <div className="cm9-meta-v">
        <b>{x.hechas.length}<small> cobradas</small></b>
        <small>{x.hechas.length ? x.hechas.slice(0, 3).map(([a, b]) => N(a) + ' a ' + N(b)).join(' · ') : 'Nadie se cobró la revancha todavía'} · {x.pendientes} con una pendiente</small>
      </div>
    );
  } else if (x.id === 'racha') {
    cuerpo = <Podio filas={completo ? x.t : x.t.slice(0, 3)} yo={yo} nombre={([k]) => ({ t: N(k), yo: k === yo })} valor={([, n]) => n} sufijo=" 🔥" />;
  } else if (CUENTA_MINI[x.id]) {
    const [uno, varios] = CUENTA_MINI[x.id];
    cuerpo = <Podio filas={completo ? x.t : x.t.slice(0, 3)} yo={yo} nombre={([k]) => ({ t: N(k), yo: k === yo })} valor={([, n]) => n} texto={([, n]) => n + ' ' + (n === 1 ? uno : varios)} />;
    const i = x.t.findIndex(([k]) => k === yo);
    if (i >= 0) tuyo = 'Vas ' + (i + 1) + '.º';
  } else if (x.id === 'batacazo') {
    cuerpo = <Podio filas={completo ? x.t : x.t.slice(0, 3)} yo={yo} nombre={([g, p]) => ({ t: N(g) + ' a ' + N(p), yo: g === yo })} valor={([, , pc]) => 1 - pc} texto={([, , pc]) => pct(pc)} />;
    if (x.t[0] && x.t[0][0] === yo) tuyo = 'El batacazo más grande es tuyo';
  } else if (x.id === 'novatos') {
    cuerpo = x.campeon ? <div className="cm9-rey"><span className="cm9-rey-c" aria-hidden="true">🌱</span><div><b>{N(x.campeon)}</b><small>Campeón de los novatos</small></div></div>
      : <small>{(x.r[0] || { p: [] }).p.map((m) => N(m[0]) + ' vs ' + N(m[1])).slice(0, 2).join(' · ')}</small>;
  }
  return (
    <article className={'cm9-ev rico' + (completo ? ' completo' : '')} style={{ '--c': COLOR_MINI[x.id] || '#29B298' }}>
      <div className="cm9-ev-t">
        <span className="cm9-ev-ic" aria-hidden="true">{x.ic}</span>
        <span className="cm9-ev-cierra"><span className="cm9-tag real">ABIERTO</span><small>{enFrase(C.fin, 'cierra en ')}</small></span>
      </div>
      <h3>{x.nombre.toUpperCase()}</h3>
      <p className="cm9-ev-q">{ex[0]}</p>
      {cuerpo}
      {tuyo ? <p className="cm9-ev-tuyo">⭐ {tuyo}</p> : null}
      {completo && (x.id === 'derbi' || x.id === 'paises') ? <ul className="cm9-crus">{x.p.map((m) => <Cruce key={m[0] + m[1]} liga={liga} C={C} m={m} yo={yo} jurado />)}</ul> : null}
      {completo && x.id === 'novatos' ? <Llave liga={liga} C={C} r={x} yo={yo} /> : null}
      {completo ? <dl className="cm9-ex"><div><dt>Quién juega</dt><dd>{ex[1]}</dd></div><div><dt>Cómo se gana</dt><dd>{ex[2]}{minimoTxt(C, x.id)}</dd></div></dl>
        : <p className="cm9-ev-gana"><b>Cómo se gana:</b> {ex[2]}{minimoTxt(C, x.id)}{montos(C) && x.id !== 'meta' ? ' Premio: ' + pdt(montos(C).mini) + ' Puntos de Tienda.' : ''}</p>}
    </article>
  );
}

/** ⏳ «Abre en 7 h»: los que vienen la semana que viene, y los que se preparan */
function Vienen({ C, completo }) {
  if (!(C.proxima || []).length && !(C.pronto || []).length) return null;
  return (
    <div className="cm9-vienen">
      {(C.proxima || []).map(([id, ic, n]) => (
        <article key={id} className="cm9-ev viene">
          <div className="cm9-ev-t"><span aria-hidden="true">{ic}</span><span className="cm9-tag pend">{enFrase(C.fin, 'abre en ', 'abre ahora').toUpperCase()}</span></div>
          <h3>{n.toUpperCase()}</h3>
          {completo && EXPLICA[id] ? <p>{EXPLICA[id][0]}</p> : null}
        </article>
      ))}
      {(C.pronto || []).map(([id, ic, n]) => (
        <article key={id} className="cm9-ev prep">
          <div className="cm9-ev-t"><span aria-hidden="true">{ic}</span><span className="cm9-tag pend">EN PREPARACIÓN</span></div>
          <h3>{n.toUpperCase()}</h3>
          {completo && EXPLICA[id] ? <p>{EXPLICA[id][0]}</p> : null}
        </article>
      ))}
    </div>
  );
}

/** 🥇 LAS LIGAS, EN DETALLE (#/competencias/ligas). Dlx, 26/10/2026: «un botón al costado de las barras que indican en
 * qué jornada van… más información, y ahí se ve su propia página explicando más a detalle» */
function LigasInfo({ liga, C, yo }) {
  const L = C.ligas || {};
  const donde = dondeEstoy(C, yo);
  const fecha = (iso) => new Date(iso).toLocaleDateString('es', { timeZone: 'America/New_York', weekday: 'long', day: 'numeric', month: 'long' });
  const todas = todasLasLigas(C);
  return (
    <div className="cm9">
      <section className="cm9-esc corta" aria-label="Las ligas">
        <div className="cm9-esc-t">
          <a className="cm9-volver" href="#/competencias">← Competencias</a>
          <span className="cm9-chip">LIGAS · TEMPORADA {L.temp}</span>
          <h1>CÓMO FUNCIONAN LAS LIGAS</h1>
          <p>Ligas de 10 por niveles, como en Top Eleven. Cada temporada dura <b>3 semanas</b> y tiene <b>9 jornadas</b>: al final, los 2 primeros de cada liga suben y los 2 últimos bajan.</p>
          <dl className="cm9-stats">
            <div><dt>Jornada</dt><dd>{L.jornada} / 9</dd></div>
            <div><dt>Ligas</dt><dd>{(L.g || []).length}</dd></div>
            <div><dt>Termina</dt><dd className="v">{faltaTxt(L.hasta)}</dd></div>
          </dl>
          {donde && (donde.liga || donde.elite) ? (
            <p>Estás en la <b>Liga {nombreLiga(C, (donde.liga || donde.elite).g)}</b>, {(donde.liga || donde.elite).pos}.º{donde.liga && donde.elite ? ', y además en la Élite (' + donde.elite.pos + '.º)' : ''}.</p>
          ) : null}
        </div>
      </section>

      <section className="cm9-sec" aria-label="Las reglas">
        <div className="cm9-cab"><div><h2>LAS REGLAS</h2></div></div>
        <ol className="cm9-reglas">
          <li><b>Los niveles</b><p>De arriba abajo: <b>Oro</b> (1 liga), <b>Plata</b> (2), <b>Bronce</b> (4) y <b>Ascenso</b> (las que hagan falta). Cada liga tiene unos 10 raperos.</p></li>
          <li><b>Quién juega</b><p>Todos los que jugaron al menos un evento en las 2 semanas antes de que arranque la temporada. Quien entra después empieza en Ascenso la temporada siguiente.</p></li>
          <li><b>Las jornadas</b><p>Todos contra todos: en cada jornada te toca un rival. Las jornadas cierran los <b>lunes, miércoles y viernes a las 11 AM</b> (hora del este).</p></li>
          <li><b>Cómo sale cada cruce</b><p>Si te enfrentas a tu rival en un 1v1 de <b>cualquier evento de cualquier servidor</b> antes del cierre, cuenta esa batalla. Si no se cruzan, se simula: quién gana sale del nivel de cada uno y de cómo llega, y por cuánto lo vota un jurado sorteado.</p></li>
          <li><b>Cómo llega cada uno</b><p>Desde la temporada 2 pesan en toda simulada: el <b>cansancio</b> (cuántas rondas viene de pelear y hace cuánto), la <b>motivación</b> (si viene rindiendo sobre lo esperado), el <b>estrés</b> (la presión de venir ganando seguido), la <b>consistencia</b> (cuánto le varían las notas), su experiencia y cómo le fue contra ese rival. El nivel sigue mandando.</p></li>
          <li><b>La réplica</b><p>Desde la temporada 2, si el jurado queda dividido la batalla puede ir a <b>réplica</b>: ahí nadie se lleva los 3 puntos. Se simula otra vez, con más peso del cansancio, el estrés y la consistencia. <b>2 puntos al que gana y 1 al que pierde.</b></p></li>
          <li><b>Los puntos</b><p>Ganar directo da <b>3 puntos</b>, y en réplica, 2 y 1. La tabla se ordena por puntos; a igual de puntos, por <b>PTB</b> (desde la temporada 2), después por victorias reales y después por nivel.</p></li>
          <li><b>El PTB</b><p>Desde la temporada 2, la tabla muestra tu <b>PTB</b>, y <b>desempata</b>: los votos de jurado a tu favor, con 3 en juego por batalla. En una simulada votan 3 jueces de verdad, sorteados, y cada uno vota como suele votar: lo aprendemos de sus votos. En una real, cuentan los votos que dejó el jurado llevados a 3, y sin votos anotados, los 3 al que ganó. Una jornada cerrada ya no cambia.</p></li>
          <li><b>Subir y bajar</b><p>Al terminar las 9 jornadas, los <b>2 primeros suben</b> de nivel y los <b>2 últimos bajan</b>. En Oro no se sube más; en Ascenso no se baja.</p></li>
          <li><b>⭐ La Élite</b><p>Se juega <b>además</b> de tu liga, con el mismo calendario. Es de los 10 mejores del Competitivo que estén activos y <b>tengan su carta Competitiva</b>: sin la carta no se entra.</p></li>
          <li><b>Los premios</b><p>Subir de liga, y Puntos de Tienda para los 3 primeros de cada liga al terminar la temporada{montos(C) ? ': ' + ['elite', 'oro', 'plata', 'bronce', 'ascenso'].map((n) => (n === 'elite' ? 'Élite' : NIVEL[n] ? NIVEL[n].n : n) + ' ' + montos(C).liga[n].map(pdt).join(' / ')).join(' · ') : ''}. <b>Para cobrar hay que haber jugado al menos 1 evento</b> en esa temporada.</p></li>
        </ol>
      </section>

      <section className="cm9-sec" aria-label="El calendario">
        <div className="cm9-cab"><div><h2>EL CALENDARIO</h2><p>Las 9 jornadas de esta temporada.</p></div></div>
        <ol className="cm9-cal">
          {(L.cierres || []).map((x, i) => (
            <li key={x} className={i + 1 < L.jornada ? 'ya' : i + 1 === L.jornada ? 'hoy' : undefined}>
              <b>J{i + 1}</b><span>Cierra el {fecha(x)}</span><small>{new Date(x).getTime() < Date.now() ? 'cerrada' : 'en ' + faltaTxt(x)}</small>
            </li>
          ))}
        </ol>
      </section>

      <section className="cm9-sec" aria-label="Todas las ligas">
        <div className="cm9-cab"><div><h2>TODAS LAS LIGAS</h2><p>El que va primero en cada una.</p></div></div>
        <div className="cm9-todas">
          {/* sin cuenta `yo` es '' (18/11/2026): la liga con una fila de clave vacía salía marcada como tuya */}
          {todas.map((g) => (
            <a key={g.id} href="#/competencias" className={!!yo && g.t.some((x) => x[0] === yo) ? 'yo' : undefined} style={{ '--c': g.id === 'elite' ? '#F5C542' : NIVEL[g.nv].c }}>
              <b>{nombreLiga(C, g)}</b>
              <span>{g.t[0] ? nombreDe(liga, C, g.t[0][0]) : '—'}</span>
              <small>{g.t[0] ? g.t[0][3] + ' pts' : ''}</small>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

/** 🎲 LA SUBPÁGINA DE LOS MINI EVENTOS (#/competencias/mini). Dlx, 26/10/2026: «puedes crear una subpágina sobre ellos…
 * y ahí explicar más… para lo que dice pronto crear un countdown… abre en X» */
function MiniPagina({ liga, C, yo, juega }) {
  return (
    <div className="cm9">
      <section className="cm9-esc corta" aria-label="Mini eventos">
        <div className="cm9-esc-t">
          <a className="cm9-volver" href="#/competencias">← Competencias</a>
          <span className="cm9-chip">MINI EVENTOS · T1</span>
          <h1>CADA SEMANA, OTROS</h1>
          <p>Cada lunes a las {aLas(C.fin)} se abren <b>{(C.mini || []).length || 4} mini eventos</b>, sorteados de un catálogo de {Object.keys(EXPLICA).length}. Duran la semana y se juegan solos con tus batallas, como todo en Competencias.</p>
          <dl className="cm9-stats">
            <div><dt>Abiertos</dt><dd>{(C.mini || []).length}</dd></div>
            <div><dt>Los próximos abren en</dt><dd className="v">{faltaTxt(C.fin)}</dd></div>
          </dl>
        </div>
      </section>
      <section className="cm9-sec" aria-label="Abiertos esta semana">
        <div className="cm9-cab"><div><h2>ABIERTOS ESTA SEMANA</h2><p>Cierran el lunes a las {aLas(C.fin)}.</p></div></div>
        <div className="cm9-evs grande">{(C.mini || []).map((x) => (juega(x) ? <Mini key={x.id} liga={liga} C={C} x={x} yo={yo} completo /> : <MiniBloqueado key={x.id} C={C} x={x} completo />))}</div>
      </section>
      <section className="cm9-sec" aria-label="Los que vienen">
        <div className="cm9-cab"><div><h2>LOS QUE VIENEN</h2><p>Los de la semana que viene ya están sorteados. Los que se preparan todavía no tienen fecha.</p></div></div>
        <Vienen C={C} completo />
      </section>
    </div>
  );
}

function Simulada({ liga, C }) {
  // una simulada de verdad con su jurado: de la jornada que se cerró, o de la Copa
  const todas = todasLasLigas(C).flatMap((g) => (g.j || []).flatMap((j) => j.p))
    .concat((C.copa || []).concat(C.rapid || []).flatMap((r) => r.r.flatMap((rd) => rd.p)));
  const m = todas.find((x) => x[3] === 'sim' && Array.isArray(x[5]));
  if (!m) return null;
  return (
    <article className="cm9-card">
      <header className="neg"><h3>ASÍ SE VE UNA SIMULADA</h3><span className="cm9-tag sim">SIMULADO</span></header>
      <div className="cm9-simv">
        <div><b>{nombreDe(liga, C, m[0])}</b><small>{pct(m[4])}</small></div>
        <b className="cm9-tag real">{m[2] === m[0] ? 'GANA' : 'PIERDE'}</b>
        <div><b>{nombreDe(liga, C, m[1])}</b><small>{pct(1 - m[4])}</small></div>
      </div>
      <Jurado liga={liga} C={C} m={m} />
      <p className="cm9-nota">Cada simulada sortea 3 jueces de verdad, y cada uno vota como suele votar: lo aprendemos de sus votos (si se va con el favorito, si tira para su servidor, a quién le suele ir). Quién gana sale del nivel y de cómo llega cada uno; ellos dicen por cuánto, y si queda dividida puede ir a réplica.</p>
    </article>
  );
}

const PREGUNTAS = [
  ['¿Por qué no aparezco?', 'Entra quien jugó al menos un evento en las 2 semanas antes del lunes. En las ligas entras al arrancar la temporada que viene, en Ascenso.'],
  ['¿Por qué no veo la Copa ni la Rapid?', 'Las ligas las ve todo el mundo. De lo demás, cada uno ve lo suyo: tu llave y los mini eventos en los que estás. De lo que no juegas, ahí mismo te decimos qué te falta.'],
  ['¿Es sólo para los del Competitivo?', 'No: las ligas, la Copa, la Rapid y los mini eventos son para todos los que jugaron en las últimas 2 semanas. Sólo la Élite pide la carta Competitiva: es de los 10 mejores del Competitivo, y ellos juegan además su liga.'],
  ['¿Tengo que hacer algo?', 'No. No hay inscripción ni botón: tus batallas de siempre cuentan solas. Sólo mira quién te toca y búscalo en los eventos.'],
  ['¿Se puede arreglar una simulación?', 'No. Lo mismo da siempre el mismo resultado, y una jornada cerrada ya no cambia. Un resultado real nunca se inventa.'],
  ['¿Qué gano?', 'Subir de liga y Puntos de Tienda según tu puesto, si jugaste al menos 1 evento en ese tiempo. Y la Élite: los 10 mejores del Competitivo, con su carta Competitiva, la juegan además de su liga.'],
];

// ── 🧩 LA PÁGINA, OPCIÓN C (15/11/2026) ─────────────────────────────────────────────────────────────────────────────
// Dlx, 15/11/2026: «remakees la página de competencias basado en el estilo de inicio»; a la maqueta de dos opciones
// (artifact privado U3z52B3buadVvXGmDoPmRY), «una mezcla entre A y B»; a la C, «me gusta, sólo asegúrate que la parte de
// abajo esté estirada… que ocupe todo el ancho para que no haya espacios vacíos» y «el estilo es que tiene que haber
// partes negras y blancas, más negras que blancas pero sí»; y «Yes, build C». De arriba abajo:
//   · los CUATRO CUADROS de B (tu liga, la Copa, la Rapid y la semana), como la fila de arriba del Inicio
//   · el PANEL de A: tu cruce con las dos cartas y sus cuatro botones; a la izquierda el equipo de la semana y el mejor
//     jurado; a la derecha tu liga (puesto, últimas 5, premio) y cómo se simula, con cómo llega cada uno
//   · la TABLA de la liga (B) con los niveles en pestañas; al costado los cruces de la jornada y quién cobró
//   · los MINI EVENTOS a todo el ancho: los de un número en la franja blanca (la de «El próximo evento» del Inicio), los
//     de lista lado a lado, así ninguno queda con el fondo vacío
// «Cómo se juega» y las preguntas, las llaves de la Copa y la Rapid, los cruces con su jurado y la lista entera de quién
// cobró van en VENTANAS, como los pop-ups del panel del Inicio: hoy eran media página en el celular. No se sacó nada.

/** Los mini eventos que son un número y su regla (van en la franja blanca); los demás son una lista (van abajo) */
const CORTOS = new Set(['meta', 'revancha', 'rey', 'supercopa', 'derbi', 'paises', 'novatos']);
const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es', { timeZone: 'America/New_York', day: 'numeric', month: 'numeric' });
/** Cuándo entra a una liga quien no está, en una línea para su cuadro. La temporada que viene arranca en `L.hasta` con los
 *  que jugaron en las 2 semanas de antes (`ACTIVO_DIAS` de bot/competencias.py). Sin la fecha, al lado de la Copa que dice
 *  «el lunes entras» se leía como si entrara ya (Walker, 16/11/2026) */
const entrarLiga = (L) => {
  if (!L.hasta) return 'Juega 1 evento y entras en Ascenso';
  const desde = new Date(new Date(L.hasta).getTime() - 14 * 864e5);
  return Date.now() < desde.getTime() ? 'Entras el ' + fechaCorta(L.hasta) + ' si juegas desde el ' + fechaCorta(desde)
    : 'Juega 1 evento antes del ' + fechaCorta(L.hasta) + ' y entras';
};
const abrir = (r) => { if (r.current && r.current.showModal) r.current.showModal(); };
/** El próximo cierre de lo que sea: una jornada de las ligas o la semana (la Copa y la Rapid) */
const proxCierre = (C) => [C.fin].concat((C.ligas || {}).cierres || []).filter((x) => new Date(x).getTime() > Date.now())
  .sort((a, b) => new Date(a) - new Date(b))[0];

/** Una ventana como las del panel del Inicio (`pn-pop` + `PopCab`, de pop.jsx) */
function Ventana({ dref, ico, t, sub, cls = '', children }) {
  const cerrar = () => { if (dref.current) dref.current.close(); };
  return (
    <dialog className={'pn-pop cmx-pop ' + cls} ref={dref} aria-label={t} onClick={(e) => { if (e.target === dref.current) cerrar(); }}>
      <PopCab ico={ico} t={t} sub={sub} cerrar={cerrar} />
      <div className="cmx-pop-in">{children}</div>
    </dialog>
  );
}

/** Un cuadro de la fila de arriba: ícono (o el anillo de la semana), etiqueta, lo importante y una línea */
/** `resto` lleva la marca del tutorial: se escribe `data-tuto="x"` donde se usa, que es lo que lee tuto_marcas.py */
function Cuadro({ c, ico, anillo, et, t, s, onClick, ...resto }) {
  return (
    <button type="button" className="cmx-c" style={{ '--tc': c }} onClick={onClick} {...resto}>
      {anillo ? <span className="cmx-anillo" style={{ '--p': anillo[0] }}><b>{anillo[1]}</b></span> : <span className="cmx-ci"><Ico n={ico} t={20} /></span>}
      <span className="cmx-ct"><i>{et}</i><b>{t}</b>{s ? <small>{s}</small> : null}</span>
    </button>
  );
}

/** Tu llave en una línea, para su cuadro: `[estado, lo importante, lo de abajo]` */
function lineaLlave(liga, C, e, yo) {
  if (e.campeon) return ['Campeón', 'Ganaste la llave', 'El lunes arranca otra'];
  const ronda = (e.ronda || {}).r || '';
  const rd = ronda === 'Semifinal' ? 'semis' : ronda.toLowerCase();
  const m = ((e.ronda || {}).p || []).find((x) => x[0] === yo || x[1] === yo);
  const rival = m ? (m[0] === yo ? m[1] : m[0]) : '';
  if (e.fuera) return ['Afuera', rival ? 'Caíste en ' + rd + ' contra ' + nombreDe(liga, C, rival) : 'Quedaste afuera en ' + rd, 'El lunes arranca otra'];
  // 🕚 con `enFrase` (18/11/2026): entre el cierre y la corrida del ciclo decía «Cierra en cerrado»
  if (!rival) return [ronda, 'Esperando rival', enFrase(e.ronda.hasta, 'Cierra en ', 'Se está cerrando')];
  return [ronda, 'Vas contra ' + nombreDe(liga, C, rival), pct(m[0] === yo ? m[4] : 1 - m[4]) + ' si se simula · ' + enFrase(e.ronda.hasta, 'cierra en ')];
}

/** En qué zona de la tabla va alguien: la misma regla que pinta los bordes de `TablaLiga` */
function zonaDe(g, pos) {
  if (g.id === 'elite') return pos === 1 ? 'Puntero' : '';
  if (g.nv !== 'oro' && pos <= 2) return 'Zona de ascenso';
  if (g.nv !== 'ascenso' && g.t.length >= 6 && pos >= g.t.length - 1) return 'Zona de descenso';
  return pos === 1 ? 'Puntero' : '';
}

/** 🃏 Tu cruce, carta contra carta, con sus cuatro botones. Sin cruce tuyo, el primero por jugar de la Élite */
function TuCruce({ liga, C, cru, botones }) {
  return (
    <div className="cmx-centro">
      {cru ? (
        <>
          <span className="cmx-blanco">{cru.t}</span>
          <div className="cmx-cartas">
            <Carta liga={liga} k={cru.a} cual={liga.cartaDe(cru.a, { comp: true }) || 'temporada'} cls="cmx-carta" nombre={nombreDe(liga, C, cru.a)} />
            <b className="cmx-vs">VS</b>
            <Carta liga={liga} k={cru.b} cual={liga.cartaDe(cru.b, { comp: true }) || 'temporada'} cls="cmx-carta" nombre={nombreDe(liga, C, cru.b)} />
          </div>
          <div className="cm9-barra cmx-barra" aria-hidden="true"><i style={{ width: ancho(cru.p) }} /></div>
          <div className="cmx-vs-n"><span>{nombreDe(liga, C, cru.a)} {pct(cru.p)}</span><span>{pct(1 - cru.p)} {nombreDe(liga, C, cru.b)}</span></div>
        </>
      ) : <p className="cmx-sin">No hay cruces por jugar en esta jornada. Mira tu liga, la Copa y la Rapid abajo.</p>}
      <div className="cmx-acc">
        {botones.map(([ico, t, s, fn]) => (
          <button key={t} type="button" className="cmx-ac" onClick={fn}><span className="cmx-ai"><Ico n={ico} t={18} /></span><span><b>{t}</b><small>{s}</small></span></button>
        ))}
      </div>
    </div>
  );
}

/** El equipo de la semana: las 5 mejores notas */
function EquipoCaja({ liga, C, yo }) {
  if (!(C.equipo || []).length) return null;
  return (
    <article className="cmx-t cmx-verde">
      <header><h4>Equipo de la semana</h4><span className="cmx-chip ver">Notas 1–10</span></header>
      <ol className="cmx-eq">
        {C.equipo.slice(0, 5).map(([k, nota], i) => (
          <li key={k} className={k === yo ? 'yo' : undefined}>
            <span className="cmx-eq-p">{i === 0 ? 'MVP' : i + 1}</span>
            <Cara liga={liga} k={k} nombre={nombreDe(liga, C, k)} cls="cara cmx-cara" lazy />
            <Nombre liga={liga} C={C} k={k} yo={yo} />
            <b className={nota >= 8 ? 'alta' : ''}>{nota.toFixed(1)}</b>
          </li>
        ))}
      </ol>
      <small className="cmx-nota">Sale de la nota 1–10 de cada batalla de la semana.</small>
    </article>
  );
}

/** ⚖️ El mejor jurado: la ficha de jurado (`C.jur`, la del perfil) con la nota más alta y, a igual nota, más votos.
 *  ⚠️ NO es «de la semana»: las fichas cuentan todo lo votado en #veredictos desde el 26/10, y la caja lo dice */
function JuradoCaja({ liga, C }) {
  const xs = Object.entries(C.jur || {}).filter(([, f]) => f && f.nota != null && f.v);
  if (!xs.length) return null;
  xs.sort((a, b) => b[1].nota - a[1].nota || b[1].v - a[1].v);
  const [k, f] = xs[0];
  const P = (x) => (x == null ? '—' : Math.round(x * 100) + ' %');
  return (
    <article className="cmx-t cmx-gris">
      <header><h4>El mejor jurado</h4><span className="cmx-ti"><Ico n="jurado" t={18} /></span></header>
      <div className="cmx-jr"><b>{f.n}</b><span className="cmx-n10">{f.nota.toFixed(1)}</span></div>
      <div className="cmx-ms3">
        <span className="cmx-ms"><small>Votos</small><b>{f.v}</b></span>
        <span className="cmx-ms"><small>Acierta</small><b>{P(f.co)}</b></span>
        <span className="cmx-ms"><small>Favorito</small><b>{P(f.fa)}</b></span>
      </div>
      <small className="cmx-nota">
        {/* 🪪 con su AKA oficial (18/11/2026): `mas` y `menos` viajan con el nombre como se escribió en #veredictos. Y
            «su ficha» también para quien está fuera de las 200 filas, que tiene su perfil igual */}
        {[f.mas && f.mas[0] ? 'Votó más a favor de ' + liga.aka(f.mas[0]) : '', f.menos && f.menos[0] ? 'más en contra de ' + liga.aka(f.menos[0]) : '', 'el mejor de ' + Object.keys(C.jur).length + ' jurados desde el 26/10']
          .filter(Boolean).join(' · ')}
        {liga.existe(k) ? <> · <a href={'#/r/' + encodeURIComponent(k)}>su ficha</a></> : null}
      </small>
    </article>
  );
}

/** Tu liga en un cuadro: tu puesto, tus últimas 5 y qué se cobra; sin liga, qué te falta para entrar */
function TuLigaCaja({ C, yo, dl, conCuenta }) {
  const L = C.ligas || {};
  if (!dl) {
    return (
      <article className="cmx-t cmx-violeta">
        <header><h4>Tu liga</h4></header>
        <p className="cmx-nota">{conCuenta ? <>Todavía no estás en ninguna. Juega <b>1 evento</b> en las 2 semanas antes del {fechaCorta(L.hasta)} y entras en <b>Ascenso</b> con la temporada que viene.</> : <>¿Juegas? <b>Entra con Discord</b> y te marcamos tu liga, tu llave y tus cruces.</>}</p>
        <span className="cmx-et">Los niveles, de arriba abajo</span>
        <ol className="cmx-niv">
          {NIVELES.map(([nv, nn, c]) => { const k = (L.g || []).filter((x) => x.nv === nv).length; return k ? <li key={nv} style={{ '--c': c }}><b>{nn}</b><small>{k} {k === 1 ? 'liga' : 'ligas'}</small></li> : null; })}
        </ol>
        {conCuenta ? null : <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>}
      </article>
    );
  }
  const { g, pos, n } = dl;
  const zona = zonaDe(g, pos);
  const nv = g.id === 'elite' ? 'elite' : g.nv;
  const pr = premioLiga(C, nv);
  const i = NIVELES.findIndex(([x]) => x === g.nv);
  const sube = g.id !== 'elite' && i > 0 ? 'Los 2 primeros suben a ' + NIVELES[i - 1][1] + '. ' : '';
  return (
    <article className="cmx-t cmx-violeta">
      <header><h4>Tu liga</h4>{zona ? <span className="cmx-chip vio">{zona}</span> : null}</header>
      <p className="cmx-big"><b>#{pos}</b><span>de {n} · {nombreLiga(C, g)}</span></p>
      <div className="cmx-fila">
        <span className="cm9-fo">{ultimas(g, yo).concat(Array(5).fill('')).slice(0, 5).map((x, j) => <i key={j} className={x[0] === 'G' ? 'g' : x[0] === 'P' ? 'p' : ''}>{x.length > 1 ? 'R' : x}</i>)}</span>
        <small>últimas 5</small>
      </div>
      <small className="cmx-nota">{sube}{pr ? 'Al cierre: ' + pdt(pr[0]) + ' al 1.º, ' + pdt(pr[1]) + ' al 2.º y ' + pdt(pr[2]) + ' al 3.º, en Puntos de Tienda.' : ''}</small>
    </article>
  );
}

/** Así se simula tu cruce: las chances, cómo llega cada uno (`C.est`) y el jurado */
function SimulaCaja({ liga, C, cru }) {
  const est = cru && C.est && C.est[cru.a] && C.est[cru.b];
  return (
    <article className="cmx-t cmx-gris">
      <header><h4>Así se simula</h4><span className="cmx-chip neg">Simulada</span></header>
      {cru ? <p className="cmx-mx"><b>{nombreDe(liga, C, cru.a)}</b> {pct(cru.p)} contra {nombreDe(liga, C, cru.b)}</p> : null}
      {est ? <span className="cmx-et">Cómo llegan hoy</span> : null}
      {est ? <VsEstado ea={C.est[cru.a]} eb={C.est[cru.b]} /> : null}
      <small className="cmx-nota">Si no se cruzan en un evento antes del cierre, decide el nivel de cada uno y cómo llega, y lo votan 3 jueces de verdad, sorteados: cada uno vota como suele votar. Si quedan divididos, réplica: 2 puntos al que gana y 1 al que pierde.</small>
    </article>
  );
}

/** 🥇 La tabla de una liga ENTERA con los niveles en pestañas (B). La liga elegida la comparten la tabla y la jornada */
function TablaCaja({ liga, C, yo, g, dl, setSel, conCuenta, tref }) {
  const L = C.ligas || {};
  const todas = todasLasLigas(C);
  const mia = dl ? dl.g.id : null;
  const nivelDe = (x) => (x.id === 'elite' ? 'elite' : x.nv);
  const nivelSel = nivelDe(g);
  const delNivel = todas.filter((x) => nivelDe(x) === nivelSel);
  const niveles = (L.e ? [['elite', 'Élite']] : []).concat(NIVELES.filter(([nv]) => todas.some((x) => x.nv === nv)).map(([nv, n]) => [nv, n]));
  const ir = (nv) => setSel(nv === 'elite' ? 'elite' : (dl && dl.g.nv === nv ? mia : (todas.find((x) => x.nv === nv) || {}).id));
  const pr = premioLiga(C, nivelSel);
  const cierre = (L.cierres || [])[(L.jornada || 1) - 1];
  return (
    <article className="cmx-t cmx-violeta cmx-tb" ref={tref} id="cm9-ligas" aria-label="Las ligas">
      <header data-tuto="cm-ligas">
        <h4>Liga {nombreLiga(C, g)}{g.id === mia ? <small> · la tuya</small> : null}</h4>
        <span className="cmx-tabs" role="tablist" aria-label="Los niveles">
          {niveles.map(([nv, n]) => <button key={nv} type="button" role="tab" aria-selected={nivelSel === nv} className={nivelSel === nv ? 'on' : ''} onClick={() => ir(nv)}>{n}</button>)}
        </span>
      </header>
      {delNivel.length > 1 ? (
        <div className="cmx-sub" role="tablist" aria-label="Las ligas de este nivel">
          {delNivel.map((x) => <button key={x.id} type="button" role="tab" aria-selected={x.id === g.id} className={x.id === g.id ? 'on' : ''} onClick={() => setSel(x.id)}>{nombreLiga(C, x)}{x.id === mia ? ' · tú' : ''}</button>)}
        </div>
      ) : null}
      <p className="cmx-nota">
        {g.id === 'elite' ? 'Los 10 mejores del Competitivo con su carta Competitiva, además de su liga · ' : 'Ligas de 10 · '}jornada {L.jornada} de 9
        {cierre ? ' · ' + enFrase(cierre, 'cierra en ') : ''}{pr ? ' · premios ' + pr.map(pdt).join(' / ') + ' Puntos de Tienda' : ''} · <a href="#/competencias/ligas">Cómo funcionan las ligas</a>
      </p>
      <TablaLiga key={g.id} liga={liga} C={C} g={g} yo={yo} />
      {!mia ? (
        <p className="cm9-fuera">{conCuenta ? <>Todavía no estás en ninguna liga. Juega <b>1 evento</b> en las 2 semanas antes del {fechaCorta(L.hasta)} y entras en <b>Ascenso</b> con la temporada que viene.</> : <>¿Juegas? <b>Entra con Discord</b> y te marcamos tu liga, tu llave y tus cruces.</>}</p>
      ) : null}
    </article>
  );
}

/** La jornada de la liga elegida, un cruce por renglón (el tuyo primero). El detalle con su jurado, en una ventana */
function JornadaCaja({ liga, C, jor, yo, onVer }) {
  if (!jor) return null;
  const tuyo = (m) => !!yo && (m[0] === yo || m[1] === yo);
  const ps = jor.p.filter((m) => m[0] || m[1]).slice().sort((x, y) => tuyo(y) - tuyo(x));
  const lado = (m, k, der) => (
    <span className={'cmx-cr-l' + (der ? ' der' : '') + (m[2] ? (m[2] === k ? ' g' : ' p') : '')}>
      {k ? <Cara liga={liga} k={k} nombre={nombreDe(liga, C, k)} cls="cara cmx-cara" lazy /> : null}
      <b>{k ? nombreDe(liga, C, k) : 'libre'}</b>
    </span>
  );
  return (
    <article className="cmx-t cmx-violeta cmx-jor">
      <header><h4>Jornada {jor.n}</h4><span className="cmx-chip vio">Los {ps.length} cruces</span></header>
      <ol className="cmx-cr">
        {ps.map((m) => (
          <li key={m[0] + '|' + m[1]} className={tuyo(m) ? 'yo' : undefined}>
            {lado(m, m[0])}
            <span className="cmx-cr-m">{m[3] === 'pend' ? <span className="cmx-pb" title={nombreDe(liga, C, m[0]) + ' ' + pct(m[4]) + ' si se simula'}><i style={{ width: ancho(m[4]) }} /></span>
              : <em className={m[3]}>{m[3] === 'real' ? 'REAL' : m[6] ? 'RÉPL.' : 'SIM'}</em>}</span>
            {lado(m, m[1], true)}
          </li>
        ))}
      </ol>
      <small className="cmx-nota">{ps.some(tuyo) ? 'El primero es el tuyo. ' : ''}La barra es quién llega mejor si se simula{jor.fin ? ' · ' + enFrase(jor.fin, 'cierra en ') : ''}.</small>
      <button type="button" className="cmx-link" onClick={onVer}>Ver cada cruce con su jurado</button>
    </article>
  );
}

/** 💰 Quién cobró en el último cierre: los 3 primeros como podio y la lista entera en una ventana */
function CobraronCaja({ liga, C, yo, onTodos }) {
  const u = (C.premios && C.premios.u) || [];
  if (!u.length) return null;
  const top = u.length >= 3 ? [u[1], u[0], u[2]] : u.slice(0, 2);
  return (
    <article className="cmx-t cmx-oro">
      <header><h4>Cobraron</h4><span className="cmx-chip oro">Último cierre</span></header>
      <div className="cmx-podio" style={{ '--n': top.length }}>
        {top.map(([k, m, por]) => (
          <span key={k + por} className={'cmx-pd' + (k === u[0][0] && por === u[0][2] ? ' p1' : '') + (k === yo ? ' yo' : '')}>
            <Cara liga={liga} k={k} nombre={nombreDe(liga, C, k)} cls="cara cmx-cara l" lazy />
            <b><Nombre liga={liga} C={C} k={k} yo={yo} /></b><small>{por}</small><i>+{pdt(m)}</i>
          </span>
        ))}
      </div>
      {u.length > 3 ? (
        <ol className="cmx-cob" start={4}>
          {u.slice(3, 5).map(([k, m, por]) => (
            <li key={k + por} className={k === yo ? 'yo' : undefined}>
              <Cara liga={liga} k={k} nombre={nombreDe(liga, C, k)} cls="cara cmx-cara" lazy />
              <Nombre liga={liga} C={C} k={k} yo={yo} /><small>{por}</small><b>+{pdt(m)}</b>
            </li>
          ))}
        </ol>
      ) : null}
      <small className="cmx-nota">{u.length} cobraron en el último cierre, en Puntos de Tienda · <button type="button" className="cmx-link" onClick={onTodos}>ver todos</button></small>
    </article>
  );
}

/** 🎲 Los mini eventos a todo el ancho: los de un número en la franja blanca, los de lista lado a lado */
function Minis({ liga, C, yo, juega, conCuenta }) {
  const xs = C.mini || [];
  if (!xs.length) return null;
  const pinta = (x) => (juega(x) ? <Mini key={x.id} liga={liga} C={C} x={x} yo={yo} /> : <MiniBloqueado key={x.id} C={C} x={x} />);
  const blancos = xs.filter((x) => CORTOS.has(x.id));
  const negros = xs.filter((x) => !CORTOS.has(x.id));
  return (
    <section className="cmx-minis" aria-label="Mini eventos">
      <header className="cmx-regla">
        <div><h2>Mini eventos</h2><small>Rotan cada semana · cuentan solos con lo que juegas{conCuenta ? '' : ' · entra con Discord para ver en cuáles estás'}</small></div>
        <a className="cm9-ver" href="#/competencias/mini">Todos y cómo se juegan →</a>
      </header>
      {blancos.length ? <div className="cmx-blanca" style={{ '--n': blancos.length }}>{blancos.map(pinta)}</div> : null}
      {negros.length ? <div className="cmx-negros" style={{ '--n': negros.length }}>{negros.map(pinta)}</div> : null}
      {(C.proxima || []).length ? (
        <p className="cm9-pronto"><span className="cm9-tag pend">LA SEMANA QUE VIENE · {enFrase(C.fin, 'abren en ', 'abren ahora').toUpperCase()}</span>{C.proxima.map(([id, ic, n]) => <span key={id}>{ic} {n}</span>)}</p>
      ) : null}
    </section>
  );
}

/** 🏆⚡ La llave de la Copa o la Rapid, en su ventana (Dlx, 26/10/2026: sólo tu llave; 04/11/2026: él ve todas) */
function LlaveVentana({ liga, C, yo, donde, verTodo, conCuenta, cual }) {
  const e = donde && donde[cual];
  const xs = C[cual] || [];
  const [v, setV] = useState('');
  const r = verTodo ? (xs.find((x) => x.id === v) || (e && e.r) || xs[0]) : e && e.r;
  if (!r) return <SinLlave C={C} yo={yo} conCuenta={conCuenta} />;
  const divs = (liga.d.div && liga.d.div.m === 'elo' && liga.d.div.n) || DIVISIONES;
  const m = montos(C);
  return (
    <>
      {verTodo ? <ElegirLlave xs={xs} v={r.id} set={setV} nombre={(x) => x.id + (cual === 'copa' ? ' · ' + divs[x.div] : '') + ' · ' + x.gente.length + ' raperos'} /> : null}
      {e && r === e.r ? <TuLlave liga={liga} C={C} e={e} yo={yo} /> : null}
      {m ? <p className="cm9-premio">💰 {cual === 'copa' ? <>Campeón <b>{pdt(m.copa[0])}</b> · finalista <b>{pdt(m.copa[1])}</b></> : <>El campeón se lleva <b>{pdt(m.rapid)}</b></>} Puntos de Tienda</p> : null}
      <Llave key={r.id} liga={liga} C={C} r={r} yo={yo} />
    </>
  );
}

export function Competencias({ liga, dc, sub = '' }) {
  // 🔁 `otra` vuelve a pedir (18/11/2026): si la primera carga fallaba, la página se quedaba en «Cargando…» para siempre.
  // Va antes que los otros hooks y nunca después de un return
  const [otra, setOtra] = useState(0);
  const C = useCompetencias(otra);
  const yo = (liga && liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  const donde = useMemo(() => dondeEstoy(C, yo), [C, yo]);
  // 🛠️ VER TODO Y «COMO QUIEN NO JUEGA» VIVEN EN EL MENÚ MODS DESDE EL 16/11/2026 (Dlx: «que en competencias no me aparezca
  // a mí precisamente siempre eso de ver como admin o miembro»). Owner y Admin; arranca apagado, así se ve como todos
  const admin = useQuienMod(dc, yo).admin;
  const M = useModsEstado();
  const comoFuera = admin && !!M.fuera;
  // la liga elegida en la tabla (null: la tuya); la comparten la tabla, la jornada y su ventana
  const [sel, setSel] = useState(null);
  const vComo = useRef(null), vCopa = useRef(null), vRapid = useRef(null), vCruces = useRef(null), vCobro = useRef(null), tabla = useRef(null);
  if (C === false) return <div className="cargando">No pude traer las competencias. <button type="button" className="btn negro" onClick={() => setOtra((n) => n + 1)}>Reintentar</button></div>;
  if (!C) return <div className="cargando">Cargando las competencias…</div>;
  if (!C.ligas) return <div className="cargando">Las competencias se están armando: vuelve en un rato.</div>;
  const verTodo = admin && !!M.todo && !comoFuera;
  const conCuenta = !!(yo || dc);
  const yoL = comoFuera ? '' : yo;
  const dondeL = comoFuera ? null : donde;
  const juega = (x) => verTodo || enMini(x, yoL, !!(dondeL && (dondeL.copa || dondeL.rapid)), (C.entran || []).includes(yoL));
  if (sub === 'mini') return <MiniPagina liga={liga} C={C} yo={yo} juega={juega} />;
  if (sub === 'ligas') return <LigasInfo liga={liga} C={C} yo={yo} />;

  const L = C.ligas;
  const todas = todasLasLigas(C);
  const dl = donde && (donde.liga || donde.elite);
  const gid = sel || (dl ? dl.g.id : (L.e ? 'elite' : (todas[0] || {}).id));
  const g = todas.find((x) => x.id === gid) || todas[0];
  const jor = g ? ((g.j || []).find((j) => j.n === L.jornada) || (g.j || [])[0]) : null;
  // tu cruce; sin cruce tuyo, el primero por jugar de la Élite, para que el panel siempre muestre un cara a cara
  const pr = donde && donde.prox;
  const ej = !pr && L.e ? (L.e.j.find((j) => j.n === L.jornada) || { p: [] }).p.find((m) => !m[2] && m[0] && m[1]) : null;
  const cru = pr && pr[1].rival ? { a: yo, b: pr[1].rival, p: pr[1].p, t: 'Tu cruce · ' + pr[0] }
    : ej ? { a: ej[0], b: ej[1], p: ej[4], t: 'En la Élite · jornada ' + L.jornada } : null;
  const irTabla = () => { if (tabla.current) tabla.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const pc = proxCierre(C);

  const cuadroLlave = (cual, c, ico, nombre, ref) => {
    const e = dondeL && dondeL[cual];
    let et, t, s;
    if (e) { const [est, tt, ss] = lineaLlave(liga, C, e, yoL); et = nombre + ' ' + e.r.id + ' · ' + est; t = tt; s = ss; }
    else if (verTodo) { et = nombre; t = 'Ver las ' + (C[cual] || []).length + ' llaves'; s = 'Sólo tú las ves todas'; }
    else if (yoL && (C.entran || []).includes(yoL)) { et = nombre + ' · el lunes entras'; t = 'Te toca tu llave el lunes'; s = enFrase(C.fin, 'Faltan ', 'Ya casi'); }
    else if (conCuenta) { et = nombre + ' · bloqueada'; t = 'Juega 1 evento'; s = 'y el lunes te toca tu llave'; }
    else { et = nombre; t = 'Entra con Discord'; s = 'y te decimos en cuál estás'; }
    return <Cuadro c={c} ico={ico} et={et} t={t} s={s} onClick={() => abrir(ref)} />;
  };
  const ec = dondeL && dondeL.copa, er = dondeL && dondeL.rapid;
  const botones = [
    ['ligas', 'Tu liga', dl ? nombreLiga(C, dl.g) + ' · la tabla entera' : 'Todas las ligas', irTabla],
    ['copa', ec ? 'Tu Copa' : 'La Copa', ec ? 'Copa ' + ec.r.id + ' · tu llave' : 'Cada lunes', () => abrir(vCopa)],
    ['xp', er ? 'Tu Rapid' : 'La Rapid', er ? er.r.id + ' · tu llave' : 'Una llave de 8', () => abrir(vRapid)],
    ['guia', 'Cómo se juega', 'En 4 pasos, sin anotarte', () => abrir(vComo)],
  ];
  const hayIzq = (C.equipo || []).length || Object.values(C.jur || {}).some((f) => f && f.nota != null && f.v);
  return (
    <div className="cm9 cmx">
      <header className="cmx-cab">
        <div>
          <span className="cm9-chip">COMPETENCIAS · T1</span>
          <h1>La semana</h1>
          <p>Ligas, Copa y Rapid que se juegan <b>solas con tus batallas</b>. Si te cruzas con tu rival en cualquier evento, cuenta esa batalla; si no, se simula al cierre con tu nivel.</p>
        </div>
        <button type="button" className="cmx-como" onClick={() => abrir(vComo)}>¿Cómo se juega?</button>
      </header>

      <div className="cmx-fila4" data-tuto="cm-cab">
        {dl ? <Cuadro c="#8b5cf6" ico="ligas" et={'Tu liga · ' + nombreLiga(C, dl.g)} t={'#' + dl.pos + ' · ' + ((dl.g.t[dl.pos - 1] || [])[3] || 0) + ' pts'}
          s={(zonaDe(dl.g, dl.pos) || 'Jornada ' + L.jornada + ' de 9') + (donde.liga && donde.elite ? ' · y #' + donde.elite.pos + ' en la Élite' : '')} onClick={irTabla} />
          : <Cuadro c="#8b5cf6" ico="ligas" et="Las ligas" t={conCuenta ? 'Todavía no estás' : 'Entra con Discord'} s={conCuenta ? entrarLiga(L) : 'y te marcamos tu liga'} onClick={irTabla} />}
        {cuadroLlave('copa', '#E41373', 'copa', 'Copa', vCopa)}
        {cuadroLlave('rapid', '#29B298', 'xp', 'Rapid', vRapid)}
        <Cuadro c="#3b82f6" anillo={[Math.round((C.dia || 0) / 7 * 100), (C.dia || 0) + '/7']} et={'La semana · día ' + C.dia + ' de 7'}
          t={pc ? 'Cierra en ' + faltaTxt(pc) : 'Cerrando'} s={'Jornada ' + L.jornada + ' de 9 · ' + C.activos + ' juegan'} onClick={() => abrir(vComo)} data-tuto="cm-dias" />
      </div>

      <div className={'cmx-heroe' + (hayIzq ? '' : ' sin-izq')}>
        {hayIzq ? <div className="cmx-col cmx-izq"><EquipoCaja liga={liga} C={C} yo={yo} /><JuradoCaja liga={liga} C={C} /></div> : null}
        <TuCruce liga={liga} C={C} cru={cru} botones={botones} />
        <div className="cmx-col cmx-der"><TuLigaCaja C={C} yo={yo} dl={dl} conCuenta={conCuenta} /><SimulaCaja liga={liga} C={C} cru={cru} /></div>
      </div>

      {g ? (
        <div className="cmx-tabla">
          <TablaCaja liga={liga} C={C} yo={yo} g={g} dl={dl} setSel={setSel} conCuenta={conCuenta} tref={tabla} />
          <div className="cmx-col">
            <JornadaCaja liga={liga} C={C} jor={jor} yo={yo} onVer={() => abrir(vCruces)} />
            <CobraronCaja liga={liga} C={C} yo={yo} onTodos={() => abrir(vCobro)} />
          </div>
        </div>
      ) : null}

      <Minis liga={liga} C={C} yo={yoL} juega={juega} conCuenta={conCuenta} />

      <Ventana dref={vComo} ico="guia" t="Cómo se juega" sub="No hay que anotarse: juegas tus eventos y esto se arma solo" cls="cmx-pop-como">
        <ol className="cm9-pasos">
          <li><b>1</b><h3>JUEGA</h3><p>Cualquier evento de un servidor de la Liga. Con <b>1 evento en las últimas 2 semanas</b> ya entras el lunes.</p></li>
          <li><b>2</b><h3>TE TOCAN RIVALES</h3><p>Tu liga (y la Élite, si estás entre los 10 mejores), tu llave de la Copa y tu Rapid. Los ves arriba, en «Tu cruce».</p></li>
          <li><b>3</b><h3>CRÚZATE</h3><p>Si te enfrentas a tu rival en un 1v1 de <b>cualquier evento</b> antes del cierre, cuenta esa batalla. Si no, se simula con tu nivel.</p></li>
          <li><b>4</b><h3>SUMA Y SUBE</h3><p>Ganar da <b>3 puntos</b>, o 2 y 1 si va a réplica. Al final de las 9 jornadas, los 2 primeros de cada liga suben y los 2 últimos bajan. Las jornadas cierran lunes, miércoles y viernes a las {aLas(pc || C.fin)}.</p></li>
        </ol>
        <ul className="cm9-glos">
          <li><span className="cm9-tag real">REAL</span>Se cruzaron de verdad en un evento: cuenta esa batalla, y dice en cuál.</li>
          <li><span className="cm9-tag sim">SIMULADO</span>No se cruzaron: deciden el nivel de cada uno y cómo llega, y lo vota un jurado de jueces de verdad, sorteado. Si queda dividido, puede ir a réplica. Los batacazos pasan.</li>
          <li><span className="cm9-tag pend">65 %</span>Tus chances si se simula. Salen de tu nivel: a quién le ganaste y con quién perdiste en todas tus batallas 1v1 de la temporada.</li>
        </ul>
        <Simulada liga={liga} C={C} />
        <h3 className="cmx-pop-t">Preguntas</h3>
        <div className="cm9-faq">{PREGUNTAS.map(([p, r]) => <div key={p}><h3>{p}</h3><p>{r}</p></div>)}</div>
      </Ventana>
      <Ventana dref={vCopa} ico="copa" t={ec ? 'Tu Copa' : 'La Copa'} sub={ec ? 'Copa ' + ec.r.id + ' · ' + estado(ec) : 'Una llave a eliminación, cada lunes'} cls="cmx-pop-llave">
        <LlaveVentana liga={liga} C={C} yo={yoL} donde={dondeL} verTodo={verTodo} conCuenta={conCuenta} cual="copa" />
      </Ventana>
      <Ventana dref={vRapid} ico="xp" t={er ? 'Tu Rapid' : 'La Rapid'} sub={er ? er.r.id + ' · ' + estado(er) : 'Una llave de 8 de tu nivel, cada lunes'} cls="cmx-pop-llave">
        <LlaveVentana liga={liga} C={C} yo={yoL} donde={dondeL} verTodo={verTodo} conCuenta={conCuenta} cual="rapid" />
      </Ventana>
      {jor ? (
        <Ventana dref={vCruces} ico="cruce" t={'Jornada ' + jor.n} sub={'Liga ' + nombreLiga(C, g) + ' · cada cruce con su jurado'}>
          <ul className="cm9-crus">{jor.p.map((m) => <Cruce key={m[0] + '|' + m[1]} liga={liga} C={C} m={m} yo={yo} jurado />)}</ul>
        </Ventana>
      ) : null}
      {((C.premios && C.premios.u) || []).length ? (
        <Ventana dref={vCobro} ico="premio" t="Cobraron" sub="En el último cierre, para quien ganó y jugó al menos 1 evento en ese tiempo">
          <ul className="cm9-cobro">
            {C.premios.u.map(([k, m, por]) => (
              <li key={k + por} className={k === yo ? 'yo' : ''}><Cara liga={liga} k={k} nombre={nombreDe(liga, C, k)} cls="cara cm9-cara-ch" lazy /><Nombre liga={liga} C={C} k={k} yo={yo} /><small>{por}</small><b>+{pdt(m)}</b></li>
            ))}
          </ul>
        </Ventana>
      ) : null}
    </div>
  );
}
