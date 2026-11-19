// 🎤 LA GIRA (6.87; Dlx, 19/11/2026, a «¿qué idea de fondo?»: «La gira»). El Pase como la gira de un rapero: cada diez
// niveles son una FECHA en un escenario distinto —la plaza, el bar, el club, el teatro y el estadio—, de la ronda en la
// calle al estadio lleno. Arriba, el afiche de la gira con las cinco fechas (hechas, la de esta noche y las que vienen);
// abajo, la fecha elegida: su entrada, su escenario dibujado y sus diez niveles enteros, gratis arriba y premium abajo
// con la XP al medio (la pista de dos filas que Dlx pidió el 15/11), sin deslizar en la compu.
// ⚠️ Los escenarios son planos (nada de degradés ni desenfoque: la regla del remake) y viven acá, en SVG. Los niveles y
// los premios son los de siempre (`libres` y `prem`, de bot/pase.py): la gira sólo los agrupa de a diez.
import { useEffect, useRef, useState } from 'react';
import { num } from './liga.js';
import { premioLargo } from './pase_iconos.jsx';
import { Objeto } from './pase_objetos.jsx';
import { Casilla, Detalle, nivelQueDa, premiosDe } from './pase_doble.jsx';

export const GIRA = [
  { k: 'plaza', n: 'La plaza', c: '#29B298', f: '#0B1A16', d: 'Donde empieza todo: la ronda en la calle' },
  { k: 'bar', n: 'El bar', c: '#FF4F93', f: '#1C0A12', d: 'La primera fecha con escenario y micrófono' },
  { k: 'club', n: 'El club', c: '#9B5CFF', f: '#130A24', d: 'Luces, humo y la gente que ya te conoce' },
  { k: 'teatro', n: 'El teatro', c: '#FF5A4F', f: '#1E0A0A', d: 'Butacas llenas y telón rojo' },
  { k: 'estadio', n: 'El estadio', c: '#F5C542', f: '#1A1506', d: 'La última fecha: el estadio lleno' },
];
export const fechaDe = (n) => Math.max(0, Math.min(GIRA.length - 1, Math.ceil(n / 10) - 1));

// ── los cinco escenarios, planos ──
function Plaza({ c }) {
  const edif = [[0, 40, 120], [130, 20, 90], [230, 55, 140], [380, 30, 110], [500, 50, 90], [600, 15, 130], [740, 45, 100], [850, 25, 120], [980, 50, 110], [1100, 30, 100]];
  return (
    <g>
      {edif.map(([x, y, w], i) => <g key={i}><rect x={x} y={y} width={w} height={140 - y} fill="#122620" />
        {[0, 1, 2].map((f) => [0, 1, 2].map((k) => <rect key={f + '-' + k} x={x + 14 + k * (w / 3.2)} y={y + 14 + f * 26} width="10" height="12" fill={c} opacity={(i + f + k) % 3 ? 0.08 : 0.32} />))}</g>)}
      {[180, 560, 930].map((x) => <g key={x}><rect x={x} y="54" width="5" height="86" fill="#08110E" /><rect x={x - 10} y="50" width="25" height="7" fill="#08110E" /><circle cx={x + 2} cy="62" r="7" fill="#F5C542" /></g>)}
      {Array.from({ length: 26 }, (_, i) => <circle key={i} cx={720 + i * 13 + (i % 2) * 4} cy={128 - (i % 3) * 3} r="9" fill="#050807" />)}
      <rect x="0" y="134" width="1200" height="6" fill={c} opacity=".5" />
    </g>
  );
}
function Bar({ c }) {
  const ladrillos = [];
  for (let f = 0; f < 6; f++) for (let k = -1; k < 26; k++) ladrillos.push(<rect key={f + '-' + k} x={k * 48 + (f % 2) * 24} y={f * 18} width="44" height="14" fill="#26101A" />);
  return (
    <g>
      {ladrillos}
      <rect x="0" y="108" width="1200" height="32" fill="#0F0609" />
      <rect x="0" y="104" width="1200" height="6" fill="#3A1A10" />
      <g fill="none" stroke={c} strokeWidth="5" strokeLinejoin="round" transform="translate(260 0)"><rect x="520" y="18" width="160" height="62" rx="4" /><path d="M548 64V34h18a9 9 0 010 18h-18 M566 52a9 9 0 010 12h-18 M592 64l14-30 14 30 M598 54h16 M636 64V34h18a9 9 0 010 18h-18 M650 52l12 12" /></g>
      {[150, 240, 330, 870, 960, 1050].map((x, i) => <g key={x}><rect x={x} y="40" width="10" height="34" fill={i % 2 ? c : '#F5C542'} opacity=".55" /><rect x={x + 2} y="30" width="6" height="12" fill={i % 2 ? c : '#F5C542'} opacity=".55" /></g>)}
      {[420, 500, 700, 780].map((x) => <g key={x}><rect x={x} y="112" width="6" height="28" fill="#1A0B10" /><rect x={x - 14} y="108" width="34" height="7" fill="#2A1218" /></g>)}
    </g>
  );
}
function Club({ c }) {
  return (
    <g>
      {[[300, -40], [600, 40], [900, -40]].map(([x, sk], i) => <polygon key={i} points={`${x - 12},0 ${x + 12},0 ${x + 140 + sk},140 ${x - 140 + sk},140`} fill={c} opacity=".13" />)}
      <circle cx="840" cy="26" r="20" fill="#2A2238" stroke={c} strokeWidth="3" />
      <path d="M820 26h40 M840 6v40 M826 12l28 28 M854 12l-28 28" stroke={c} strokeWidth="1.5" opacity=".7" />
      {[[30, 1], [1090, -1]].map(([x, s]) => <g key={x}>{[0, 1, 2].map((f) => <g key={f}><rect x={x} y={34 + f * 34} width="80" height="32" fill="#0B0714" stroke="#2A2238" strokeWidth="2" />
        <circle cx={x + 40} cy={50 + f * 34} r="11" fill="#1A1228" stroke={c} strokeWidth="2" /></g>)}</g>)}
      {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={200 + i * 27} cy={130 - (i % 2) * 5} r="10" fill="#07040D" />)}
      {[[250, 70], [470, 40], [760, 60], [980, 30]].map(([x, y]) => <rect key={x} x={x} y={y} width="6" height="6" fill="#fff" opacity=".7" transform={`rotate(45 ${x + 3} ${y + 3})`} />)}
    </g>
  );
}
function Teatro({ c }) {
  const pliegues = (x0, n) => Array.from({ length: n }, (_, i) => <rect key={i} x={x0 + i * 22} y="0" width="22" height="140" fill={i % 2 ? '#7A1414' : '#9E1C1C'} />);
  return (
    <g>
      <rect x="0" y="0" width="1200" height="140" fill="#140606" />
      {pliegues(0, 12)}{pliegues(936, 12)}
      <rect x="0" y="0" width="1200" height="20" fill="#5E0E0E" />
      {Array.from({ length: 31 }, (_, i) => <circle key={i} cx={i * 40} cy="20" r="20" fill="#7A1414" />)}
      <path d="M330 140V70Q600 0 870 70V140" fill="none" stroke="#C9A24A" strokeWidth="6" />
      {Array.from({ length: 14 }, (_, i) => <circle key={i} cx={350 + i * 38.5} cy="132" r="5" fill="#F5C542" />)}
      <rect x="560" y="70" width="6" height="62" fill="#2A1010" /><circle cx="563" cy="66" r="9" fill="#2A1010" stroke={c} strokeWidth="2" />
    </g>
  );
}
function Estadio({ c }) {
  const gente = [];
  for (let f = 0; f < 5; f++) for (let k = 0; k < 60; k++) {
    const x = k * 20 + (f % 2) * 10, y = 46 + f * 16;
    const luz = (k * 7 + f * 13) % 11 === 0;
    gente.push(<circle key={f + '-' + k} cx={x} cy={y} r="5.5" fill={luz ? c : f % 2 ? '#2A2410' : '#211C0C'} opacity={luz ? 0.9 : 1} />);
  }
  return (
    <g>
      {[[80, 0], [1110, 0]].map(([x]) => <g key={x}><rect x={x} y="0" width="8" height="140" fill="#100D04" />
        <rect x={x - 26} y="0" width="60" height="30" fill="#100D04" />{[0, 1, 2].map((f) => [0, 1, 2, 3].map((k) => <rect key={f + '-' + k} x={x - 22 + k * 14} y={4 + f * 9} width="10" height="6" fill="#FFF4C8" />))}</g>)}
      {gente}
      <rect x="380" y="112" width="440" height="28" fill="#0B0903" />
      <rect x="380" y="108" width="440" height="6" fill={c} />
      <path d="M400 108V60H800V108" fill="none" stroke="#3A320F" strokeWidth="6" />
    </g>
  );
}
const DIBUJO = { plaza: Plaza, bar: Bar, club: Club, teatro: Teatro, estadio: Estadio };
export function Escenario({ k, c, cls = '' }) {
  const D = DIBUJO[k] || Plaza;
  return <svg className={'pg-dib ' + cls} viewBox="0 0 1200 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><D c={c} /></svg>;
}

/** 🗓️ El afiche: las cinco fechas de la gira, como en un póster de gira. Tocar una la abre abajo */
export function Fechas({ nivel, N, miembro, onIr }) {
  return (
    <ol className="pg-fechas" aria-label="Las fechas de tu gira">
      {GIRA.map((v, i) => {
        const a = i * 10 + 1, b = Math.min(N, (i + 1) * 10);
        if (a > N) return null;
        const hecha = miembro && nivel >= b;
        const aca = miembro ? nivel + 1 >= a && nivel + 1 <= b : i === 0;
        return (
          <li key={v.k} className={(hecha ? 'hecha' : '') + (aca ? ' aca' : '')} style={{ '--c': v.c }}>
            <button type="button" onClick={() => onIr(i)} aria-label={v.n + ', niveles ' + a + ' a ' + b + (hecha ? ': hecha' : aca ? ': vas acá' : '')}>
              <span className="pg-f-n">{a}–{b}</span><b>{v.n}</b><em>{hecha ? 'Hecha' : aca ? (miembro ? 'Esta noche' : 'La primera') : 'Próxima'}</em>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** 🎟️ La fecha elegida: las cinco entradas, el escenario y sus diez niveles enteros */
export function PistaGira({ libres, prem, nivel, tiene, falta, frac, q, miembro = true, fecha, setFecha }) {
  const N = libres.length || 50;
  const sigN = Math.min(N, (nivel || 0) + 1);
  const [sel, setSel] = useState(sigN);
  const premDe = premiosDe(prem);
  const caja = useRef(null);
  // la fecha la puede cambiar el afiche de arriba: el nivel elegido pasa a esa fecha (el tuyo si estás ahí)
  useEffect(() => { if (fechaDe(sel) !== fecha) setSel(fechaDe(sigN) === fecha ? sigN : fecha * 10 + 1); }, [fecha]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSel(sigN); setFecha(fechaDe(sigN)); }, [sigN]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const n = nivelQueDa(q, libres, prem); if (n) { setSel(n); setFecha(fechaDe(n)); } }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  // 📱 en el celular la fecha se desliza con el dedo: el nivel elegido, a la vista
  useEffect(() => {
    const c = caja.current;
    const col = c && c.querySelector('[data-n="' + sel + '"]');
    if (!col || c.scrollWidth <= c.clientWidth + 1) return;
    c.scrollLeft = Math.max(0, col.offsetLeft - (c.clientWidth - col.offsetWidth) / 2);
  }, [sel]);
  const elegir = (n) => { const m = Math.max(1, Math.min(N, n)); setSel(m); setFecha(fechaDe(m)); };
  const v = GIRA[fecha] || GIRA[0];
  const desde = fecha * 10 + 1, hasta = Math.min(N, fecha * 10 + 10);
  const cols = [];
  for (let n = desde; n <= hasta; n++) {
    const g = libres[n - 1] || [n, 150, '', ''];
    const pr = premDe[n] || [n, 150, '', ''];
    const ya = n <= nivel;
    const sig = miembro && n === nivel + 1 && n <= N;
    const relleno = ya ? 100 : sig ? Math.round(100 * Math.max(0, Math.min(1, frac || 0))) : 0;
    cols.push(
      <div key={n} className={'p2-col' + (sig ? ' p2-sig' : '') + (n === sel ? ' es' : '')} data-n={n}>
        {sig && falta > 0 ? <span className="p2-falta">Faltan {num(falta)} XP</span> : null}
        <Casilla p={g} n={n} sig={sig} ya={ya} sel={n === sel} onSel={() => setSel(n)} />
        <span className="p2-riel" aria-hidden="true">
          <i className="p2-base" /><i className="p2-lleno" style={{ width: relleno + '%' }} />
          <b className={'p2-nodo' + (ya ? ' ya' : sig ? ' p2-sig' : '')}><i>{n}</i></b>
          {sig ? <span className="p2-tu" style={{ left: Math.max(8, Math.min(92, relleno)) + '%' }}><b>TÚ</b></span> : null}
        </span>
        <Casilla p={pr} n={n} pr sig={sig} ya={ya && tiene} lock={!tiene} sel={n === sel} onSel={() => setSel(n)} />
      </div>,
    );
  }
  const hechosV = Math.max(0, Math.min(hasta - desde + 1, (nivel || 0) - desde + 1));
  const grande = [...libres.slice(desde - 1, hasta)].reverse().find((p) => p && p[2]);
  return (
    <section className="pg" id="ps-premios" aria-label="Los niveles del Pase, fecha por fecha" style={{ '--c': v.c, '--f': v.f }}>
      {/* 🧭 la marca del tutorial, sobre las cinco entradas y no la pista entera (CLAUDE.md: «sobre algo chico») */}
      <div className="pg-entradas" role="tablist" aria-label="Las fechas" data-tuto="ps-pista">
        {GIRA.map((x, i) => {
          const a = i * 10 + 1, b = Math.min(N, i * 10 + 10);
          if (a > N) return null;
          const h = Math.max(0, Math.min(b - a + 1, (nivel || 0) - a + 1));
          const aca = miembro && sigN >= a && sigN <= b && h < b - a + 1;
          return (
            <button key={x.k} type="button" role="tab" aria-selected={i === fecha} className={'pg-ent' + (i === fecha ? ' on' : '') + (aca ? ' aca' : '') + (h === b - a + 1 ? ' llena' : '')}
              style={{ '--c': x.c }} onClick={() => elegir(aca ? sigN : a)}>
              <span className="pg-ent-tal"><small>Niv.</small><b>{a}–{b}</b></span>
              <span className="pg-ent-cu"><b>{x.n}</b><small>{h === b - a + 1 ? 'Hecha' : aca ? 'Esta noche · ' + h + ' de ' + (b - a + 1) : miembro ? h + ' de ' + (b - a + 1) : (b - a + 1) + ' niveles'}</small>
                <i className="pg-ent-bar"><u style={{ width: Math.round((100 * h) / (b - a + 1)) + '%' }} /></i></span>
            </button>
          );
        })}
      </div>
      <div className="pg-escena">
        <Escenario k={v.k} c={v.c} />
        <div className="pg-cartel">
          <span className="pg-k">Fecha {fecha + 1} de {GIRA.length} · niveles {desde} a {hasta}</span>
          <h3>{v.n}</h3>
          <p>{v.d}{grande ? <> · el gran premio: <b>{premioLargo(grande)}</b></> : null}</p>
        </div>
        {grande ? <span className="pg-grande" aria-hidden="true"><Objeto p={grande} t={74} an /></span> : null}
        <span className="pg-cuenta">{miembro ? (hechosV === hasta - desde + 1 ? '✓ Hecha' : hechosV + ' de ' + (hasta - desde + 1)) : ''}</span>
      </div>
      <div className="p2-cuerpo">
        <div className="p2-labs" aria-hidden="true">
          <span className="p2-lab g"><b>Gratis</b><small>Los de DRA</small></span>
          <span className="p2-lab x"><b>XP</b></span>
          <span className="p2-lab p"><b>Premium</b><small>{tiene ? '+20 % de XP' : 'Con candado'}</small></span>
        </div>
        <div className="p2-caja pg-caja" ref={caja} tabIndex={0} aria-label={'Los niveles de ' + v.n}
          onKeyDown={(e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); elegir(sel - 1); } if (e.key === 'ArrowRight') { e.preventDefault(); elegir(sel + 1); } }}>
          <div className="p2-fila pg-fila">{cols}</div>
        </div>
      </div>
      <Detalle sel={sel} libres={libres} premDe={premDe} nivel={nivel} tiene={tiene} />
    </section>
  );
}
