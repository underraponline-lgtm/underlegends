// 🔰 LOS EMBLEMAS DE LA CUENTA (Dlx, 21/10/2026, al remake del perfil, con capturas de «Your badges» de Discord: «en
// Discord no aparece el nivel del emblema a menos que presiones en ella: la gente nota que es otro nivel porque el
// emblema cambió de forma, de color… y no todos son de la Liga Global, como las insignias, ya que es otra cosa»).
//
// · SON DE LA CUENTA EN UNDER LEGENDS, no de la competencia: lo de competir son las insignias (los Logros del perfil).
// · EL NIVEL SE VE EN EL DIBUJO, de Inicial a Rubí, como el Nitro de Discord: cambia la forma y el color. El número,
//   sólo al tocarlo (el panel).
// · Al lado del nombre se ven cinco y el resto en «+N» (Dlx, a la v8: «¿y qué pasa si uno tiene bastantes emblemas?»).
// · Los que suma Dlx a la v10 («me gusta»): Líder de crew, Coleccionista, Aplausos, Embajador y Promotor.
//
// ⚠️ SALEN DE LO QUE LA PÁGINA YA TIENE: sus eventos, su verificación, su Pase, su racha, sus seguidores, su crew, sus
// tarjetas, sus promos y sus roles. Los que todavía no tienen dato (Aplausos, Embajador, Voz del pueblo) van en «Para
// desbloquear» con lo que piden, y se encienden solos el día que su número viaje.
import { useEffect, useState } from 'react';
import { Ico } from './piezas.jsx';

// los niveles, como el Nitro de Discord: [nombre, color, forma, gemas]
export const TIER = [
  ['Inicial', '#8A8F9E', 'circ', 0], ['Bronce', '#D9782F', 'circ', 0], ['Plata', '#C9CDD4', 'anillo', 0], ['Oro', '#E7B622', 'anillo', 2],
  ['Platino', '#39C6E8', 'hex', 4], ['Diamante', '#8B5CF6', 'hex', 4], ['Esmeralda', '#22C55E', 'oct', 4], ['Rubí', '#E11D48', 'oct', 4],
];
const UNICO = ['Único', '#E7B622', 'oct', 4];
const ROLES_UNO = 3; // los de un solo nivel (los roles, Fundador, Líder de crew) se dibujan en Oro

// 🎨 el dibujo de un emblema en su nivel: la forma y el color dicen el nivel, sin número
export function Arte({ g, t, px = 28, lock = false, unico = false }) {
  const [, c0, forma, gemas] = unico ? UNICO : TIER[Math.max(0, Math.min(TIER.length - 1, t))];
  const c = lock && t === 0 ? '#4A4A50' : c0;
  let base;
  if (forma === 'circ') base = <><circle cx="20" cy="20" r="18" fill={c} /><circle cx="20" cy="20" r="14.5" fill="#15151A" /></>;
  else if (forma === 'anillo') {
    base = <><circle cx="20" cy="20" r="18" fill="none" stroke={c} strokeWidth="2" /><circle cx="20" cy="20" r="15" fill={c} />
      <circle cx="20" cy="20" r="11.5" fill="#15151A" /></>;
  } else if (forma === 'hex') {
    base = <><polygon points="20,2 35.6,11 35.6,29 20,38 4.4,29 4.4,11" fill={c} />
      <polygon points="20,7 31.3,13.5 31.3,26.5 20,33 8.7,26.5 8.7,13.5" fill="#15151A" /></>;
  } else {
    base = <><polygon points="13,2 27,2 38,13 38,27 27,38 13,38 2,27 2,13" fill={c} />
      <polygon points="15,7 25,7 33,15 33,25 25,33 15,33 7,25 7,15" fill="#15151A" /></>;
  }
  const pts = !gemas ? [] : gemas === 2 ? [[20, 1.5], [20, 38.5]] : [[20, 1.5], [38.5, 20], [20, 38.5], [1.5, 20]];
  return (
    <svg className={'emb-arte' + (lock ? ' bloq' : '')} viewBox="0 0 40 40" width={px} height={px} aria-hidden="true">
      {base}
      {pts.map(([x, y]) => <polygon key={x + '-' + y} points={`${x},${y - 3} ${x + 3},${y} ${x},${y + 3} ${x - 3},${y}`} fill="#F6F6F6" stroke={c} strokeWidth=".8" />)}
      <text x="20" y="21.5" textAnchor="middle" dominantBaseline="central" fontSize="17">{g}</text>
    </svg>
  );
}

// 📋 el catálogo: [id, glifo, nombre, qué mide, escalera [[umbral, texto]] (null: un solo nivel), unidad]
const ANTIG = [[0, 'al empezar'], [30, '1 mes'], [90, '3 meses'], [180, '6 meses'], [365, '1 año'], [730, '2 años'], [1095, '3 años'], [1825, '5 años']];
export const CATALOGO = [
  ['owner', '👑', 'Propietario de UL', 'el dueño de Under Legends: hay uno solo', null],
  ['admin', '⚙️', 'Admin', 'lo pone Dlx', null],
  ['moderador', '🛡️', 'Moderador de la página', 'lo pone Dlx', null],
  ['asistente', '🧭', 'Asistente', 'lo pone Dlx', null],
  ['socio', '🏛️', 'Socio', 'dueño de un servidor socio de la Liga', null],
  ['staff', '⭐', 'Staff', 'staff de un servidor de la Liga', null],
  ['organizador', '🎯', 'Organizador', 'organiza eventos de la Liga', null],
  ['jurado', '⚖️', 'Jurado', 'jurado en eventos de la Liga', null],
  ['host', '🎙️', 'Host', 'conduce eventos de la Liga', null],
  ['fundador', '🌱', 'Fundador', 'verificado antes de que arrancara la T1', null],
  ['lider', '🚩', 'Líder de crew', 'lidera una crew de la Liga', null],
  ['antig', '🕰️', 'Antigüedad', 'el tiempo en Under Legends, desde su primer evento', ANTIG, 'días'],
  ['pase', '🎟️', 'Pase de rapero', 'el nivel más alto del Pase en la temporada', [[1, 'nivel 1'], [10, 'nivel 10'], [20, 'nivel 20'], [30, 'nivel 30']], 'niveles'],
  ['racha', '🔥', 'Racha diaria', 'días seguidos entrando a la Liga', [[7, '7 días'], [30, '30 días'], [100, '100 días'], [365, '365 días']], 'días'],
  ['seguidores', '👥', 'Seguidores', 'cuánta gente lo sigue', [[10, '10'], [50, '50'], [100, '100'], [500, '500'], [1000, '1.000']], 'seguidores'],
  ['coleccion', '🃏', 'Coleccionista', 'cuántas tarjetas tiene', [[2, '2 tarjetas'], [4, '4'], [6, '6'], [8, '8'], [12, '12']], 'tarjetas'],
  ['promotor', '📣', 'Promotor', 'promos que compartió en los servidores', [[1, '1 promo'], [5, '5'], [10, '10'], [25, '25']], 'promos'],
  ['aplausos', '👏', 'Aplausos', 'felicitaciones que recibió en sus publicaciones', [[10, '10'], [50, '50'], [100, '100'], [500, '500']], 'aplausos'],
  ['embajador', '📨', 'Embajador', 'gente que invitó a la Liga y se verificó', [[1, '1'], [5, '5'], [10, '10'], [25, '25']], 'personas'],
  ['voz', '🗳️', 'Voz del pueblo', 'votar en los MES AWARDS', [[1, '1 mes'], [3, '3 meses'], [6, '6 meses'], [12, '12 meses']], 'meses'],
];
const POR_ID = Object.fromEntries(CATALOGO.map((e) => [e[0], e]));
// lo que pide el primer nivel, para «Para desbloquear»
const PIDE = {
  racha: 'Entrar a la página 7 días seguidos', seguidores: 'Llegar a 10 seguidores', coleccion: 'Tener 2 tarjetas',
  promotor: 'Compartir una promo en los servidores', aplausos: 'Recibir 10 felicitaciones', embajador: 'Invitar a alguien que se verifique',
  voz: 'Votar en los MES AWARDS', pase: 'Llegar al nivel 1 del Pase', lider: 'Liderar una crew', fundador: 'Se dio a quien se verificó antes de la T1',
  staff: 'Lo da la Liga a quien es staff de un servidor', socio: 'Dueño de un servidor socio',
};

// el nivel de un valor en su escalera: -1 si no llega al primero
const nivelDe = (esc, v) => { let n = -1; esc.forEach(([u], i) => { if (v >= u) n = i; }); return n; };

/**
 * Los emblemas de un perfil, de lo que la página ya tiene: `[{id, g, n, que, esc, t, v, unico}]`, los únicos primero,
 * después los roles y después por nivel. `d`: `{dias, vd, pase, racha, seg, crewRol, cartas, promos, roles}`.
 */
export function emblemasDe(d) {
  const out = [];
  const uno = (id) => { const e = POR_ID[id]; if (e) out.push({ id, g: e[1], n: e[2], que: e[3], esc: null, t: ROLES_UNO, v: 1, unico: id === 'owner' }); };
  for (const r of d.roles || []) if (POR_ID[r] && !POR_ID[r][4]) uno(r);
  if (d.vd === 'pre') uno('fundador');
  if (d.crewRol === 'lider') uno('lider');
  const val = { antig: d.dias, pase: d.pase, racha: d.racha, seguidores: d.seg, coleccion: d.cartas, promotor: d.promos };
  for (const [id, v] of Object.entries(val)) {
    const e = POR_ID[id];
    if (v == null || !e) continue;
    const t = nivelDe(e[4], v);
    if (t >= 0) out.push({ id, g: e[1], n: e[2], que: e[3], esc: e[4], u: e[5], t, v });
  }
  const orden = (x) => (x.unico ? -100 : x.esc ? -x.t : -50);
  return out.sort((a, b) => orden(a) - orden(b));
}

// los que le faltan, con lo que pide el primero
export function faltanDe(tiene) {
  const ya = new Set(tiene.map((x) => x.id));
  return CATALOGO.filter((e) => !ya.has(e[0]) && PIDE[e[0]]).map((e) => ({ id: e[0], g: e[1], n: e[2], pide: PIDE[e[0]] }));
}

// 💊 la pastilla al lado del nombre: cinco y el resto en «+N»
export const VISIBLES = 5;
export function PildoraEmblemas({ xs, onAbrir }) {
  if (!xs.length) return null;
  const mas = xs.length - VISIBLES;
  return (
    <button type="button" className="emb-pild" onClick={() => onAbrir(xs[0].id)}
      aria-label={'Sus emblemas: ' + xs.map((x) => x.n).join(', ')}>
      {xs.slice(0, VISIBLES).map((x) => <span key={x.id} title={x.n}><Arte g={x.g} t={x.t} px={22} unico={x.unico} /></span>)}
      {mas > 0 ? <i className="emb-mas">+{mas}</i> : null}
    </button>
  );
}

// 🪟 el panel, como el de Discord: la grilla, el elegido grande, su progreso y su escalera, y lo que falta
export function PanelEmblemas({ xs, sel0, nombre, esYo, onCerrar }) {
  const [sel, setSel] = useState(sel0 || (xs[0] && xs[0].id));
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onCerrar]);
  const e = xs.find((x) => x.id === sel) || xs[0];
  const faltan = faltanDe(xs);
  const sig = e && e.esc && e.esc[e.t + 1];
  const de = e && e.esc ? e.esc[e.t][0] : 0;
  const pct = sig ? Math.max(3, Math.min(100, Math.round((100 * (e.v - de)) / Math.max(1, sig[0] - de)))) : 100;
  const falta = sig ? sig[0] - e.v : 0;
  return (
    <div className="emb-velo" role="presentation" onClick={onCerrar}>
      <div className="emb-panel" role="dialog" aria-modal="true" aria-label={'Los emblemas de ' + nombre} onClick={(ev) => ev.stopPropagation()}>
        <button type="button" className="emb-x" onClick={onCerrar} aria-label="Cerrar"><Ico n="cerrar" t={18} /></button>
        <div className="emb-izq">
          <h3>{esYo ? 'Tus emblemas' : 'Los emblemas de ' + nombre}</h3>
          <p>Son de {esYo ? 'tu' : 'su'} cuenta en Under Legends, no de la competencia (eso son {esYo ? 'tus' : 'sus'} logros). Toca uno.</p>
          <div className="emb-grid">
            {xs.map((x) => (
              <button key={x.id} type="button" className={'emb-c' + (x.id === (e && e.id) ? ' on' : '')} aria-pressed={x.id === (e && e.id)}
                onClick={() => setSel(x.id)} title={x.n}><Arte g={x.g} t={x.t} px={34} unico={x.unico} /></button>
            ))}
          </div>
          {faltan.length ? <>
            <h4>Para desbloquear</h4>
            <ul className="emb-faltan">
              {faltan.map((x) => <li key={x.id}><Arte g={x.g} t={0} px={30} lock /><span><b>{x.n}</b><small>{x.pide}</small></span></li>)}
            </ul>
          </> : null}
        </div>
        {e ? (
          <div className="emb-det">
            <Arte g={e.g} t={e.t} px={96} unico={e.unico} />
            <h4>{e.n}{e.esc ? ' · ' + TIER[e.t][0] : ''}</h4>
            <p className="emb-sub">{e.que}</p>
            {e.esc ? (
              <div className="emb-prog">
                <div className="emb-pt"><small>{esYo ? 'TU PROGRESO' : 'SU PROGRESO'}</small>
                  <b>{sig ? (falta === 1 ? 'Le falta 1' : 'Le faltan ' + falta.toLocaleString('es')) + ' ' + (e.u || '') + ' para ' + TIER[e.t + 1][0] : 'Nivel máximo'}</b></div>
                <div className="emb-bar"><Arte g={e.g} t={e.t} px={24} /><span><u style={{ width: pct + '%' }} /></span>
                  {sig ? <Arte g={e.g} t={e.t + 1} px={24} lock /> : null}</div>
                <ol className="emb-esc">
                  {e.esc.map(([, tx], i) => (
                    <li key={i} className={i < e.t ? 'hecho' : i === e.t ? 'ahora' : 'falta'}>
                      <Arte g={e.g} t={i} px={30} lock={i > e.t} /><b>{TIER[i][0]}</b><small>{tx}</small>
                    </li>
                  ))}
                </ol>
              </div>
            ) : <p className="emb-uno">{e.unico ? 'Único: lo tiene una sola persona.' : 'De un solo nivel.'}</p>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
