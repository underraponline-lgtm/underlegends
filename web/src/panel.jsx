// ── 🎛️ EL PANEL NUEVO DEL INICIO (Dlx, 12/11/2026, en vivo conmigo y con la maqueta
// https://claude.ai/artifact/3QYBFKti9isEEnbn9SjgRD; a construirlo, «Yes, start»). Lo que pidió, en sus palabras:
//   · «en el panel ser más visual» y «asegúrate que el PANEL sea simétrico»: cada pieza con su par, del mismo ancho;
//   · la fila del nombre y los Puntos se fue («¿para qué serviría esa línea ahora?»);
//   · la racha y la campana, chicas, y «una vez que la campana esté activa, que no aparezca»: la racha ocupa la fila;
//   · el VS «con el estilo del inicio original», con «un porcentaje de ganar», y tus próximas batallas: una a la vista y
//     las demás en un pop-up («no que se agrande el panel»);
//   · «BATALLAR, o sea buscar rival… de momento será simulación»: sale alguien al azar y eliges la hora;
//   · en el centro, tus tarjetas, con los rankings «a los costados» (Temporada, Competitivo, ELO, País, tu servidor y tu
//     crew), lo último que te dijeron en Publicaciones con «Responder» y tu último evento al lado, que lleva a ese evento;
//   · en vez de Ranking, la Crew («ranking está arriba y es muy relevante»); Se busca entra en Misiones como carteles;
//   · el Pase, decorativo; y cada panel con su material y un solo color («mejora los otros paneles algo así»);
//   · Eventos: «los eventos generales en las barras vs los que tú participaste»;
//   · Tienda y La semana, en la misma línea.
// ⚠️ SIN DEGRADÉS: cada panel lleva su color en un fondo teñido y un borde (la regla del remake), no en un degradé.
// ⚠️ Los comentarios de los personajes de la Liga son BOTS y lo dicen (`bot`): Dlx, «Liga characters as bots yeah».
import { useEffect, useMemo, useRef, useState } from 'react';
import { limpio, num, siglaDe, srcLogo, utc } from './liga.js';
import { Bandera, Cara, Ico, accion, nombrePais, useCampana } from './piezas.jsx';
import { Escudo, escudoDe } from './escudo.jsx';
import { avance, usePase } from './pase.js';
import { cobrarRacha } from './racha.js';
import { dondeEstoy, nombreDe, useCompetencias } from './competencias_datos.js';
import { svElegido, useElegidos } from './elegidos.js';

const W = typeof window !== 'undefined' ? window : {};
const ET = 'America/New_York';
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const guardar = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIA_MS = 86400000;
// el lunes 00:00 de esta semana, en la hora de quien mira
function lunes(ahora) {
  const d = new Date(ahora);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
// «hoy 11 AM», «vie 6 PM», en la hora del este (la de la Liga)
function cuando(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const hoy = new Date().toLocaleDateString('en', { timeZone: ET }) === d.toLocaleDateString('en', { timeZone: ET });
  const h = d.toLocaleTimeString('en', { timeZone: ET, hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  return (hoy ? 'hoy' : d.toLocaleDateString('es', { timeZone: ET, weekday: 'short' }).replace('.', '')) + ' ' + h;
}
const quieto = () => { try { return W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

// ── 🔔 la campana chica: sólo si este teléfono la puede tener y todavía no está activa (y vinculada, con cuenta) ──
export function campanaPide(c, dc) {
  if (!c || !W.Campana || !c.soporta || c.negado || (c.ios && !c.instalada) || c.pausada) return false;
  if (!c.activa) return true;
  return !!dc && !(c.yo && c.yo.id);
}
function CampanaCorta({ dc }) {
  const c = useCampana();
  if (!campanaPide(c, dc)) return null;
  const paso2 = !!c.activa;
  return (
    <section className="pn-camp">
      <span className="pn-camp-ic"><Ico n="campana" t={20} /></span>
      <span className="pn-tx"><b>{paso2 ? 'Falta un paso' : 'Activa la campana'}</b>
        <small>{paso2 ? 'Vincula este teléfono con tu Discord: te llegan los tuyos' : 'Te avisa al minuto de cada evento. Nunca por DM'}</small></span>
      <button type="button" className="btn verde chico" onClick={() => (paso2 ? W.Campana.vincular() : W.Campana.activar())}>{paso2 ? 'Vincular' : 'Activar'}</button>
    </section>
  );
}

// ── 🔥 la racha, chica: los siete días de la semana, cuántos llevas y cobrar el de hoy (los números, de avisos.js) ──
function RachaCorta({ R, sola }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  if (!R) return null;
  if (R.bienvenida) return <BienvenidaCorta B={R.bienvenida} />;
  const r = R.racha || {};
  const ps = R.premios || [];
  const actual = r.actual || 0;
  const hoy = ps.find((x) => x[0] === R.hoy);
  const cobrar = async () => {
    setOcup(true); setMsg('');
    const d = await cobrarRacha('dia').catch(() => null);
    setMsg(d && d.cobrado ? '+' + num(d.cobrado) + ' Puntos' : 'No se pudo');
    setOcup(false);
  };
  return (
    <section className="pn-racha" aria-label="Tu racha">
      <span className="pn-fuego"><Ico n="fuego" t={22} />{actual}</span>
      <span className="pn-tx"><b>{actual === 1 ? '1 día seguido' : actual + ' días seguidos'}</b>
        {ps.length ? <span className="pn-dias" aria-hidden="true">{ps.map(([d, , cobrado], i) => <i key={d} title={LETRAS[i]} className={(cobrado ? 'si' : '') + (d === R.hoy ? ' hoy' : '')} />)}</span> : null}</span>
      {sola && R.hito ? <span className="pn-prox">a los {R.hito[0]}: +{num(R.hito[1])}</span> : null}
      {hoy && hoy[3] ? <button type="button" className="btn verde chico" disabled={ocup} onClick={cobrar}>{ocup ? '…' : 'Cobrar ' + num(hoy[1])}</button>
        : msg ? <small className="pn-ok" role="status">{msg}</small> : null}
    </section>
  );
}
// 🌱 los primeros 7 días de quien recién llega, chicos, en el lugar de la racha
const IR_PASO = { seguir: '#/ranking', campana: '#/avisos', llave: '#/eventos', verificar: '#/cuenta/verificar', anotarse: '#/eventos' };
function BienvenidaCorta({ B }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const pasos = B.pasos || [];
  const ahora = pasos[B.paso];
  if (!ahora) return null;
  const cobrar = async () => {
    setOcup(true); setMsg('');
    const d = await cobrarRacha('bienvenida').catch(() => null);
    setMsg(d && d.cobrado ? '+' + num(d.cobrado) + ' Puntos' : d && d.error === 'manana' ? 'Mañana el que sigue' : 'No se pudo');
    setOcup(false);
  };
  return (
    <section className="pn-racha bien" aria-label="Tus primeros 7 días">
      <span className="pn-fuego"><Ico n="premio" t={22} />{B.paso + 1}<small>/7</small></span>
      <span className="pn-tx"><b>Tus primeros 7 días</b>
        <small>{B.hoy ? 'Mañana viene el que sigue' : 'Hoy: ' + ahora[2].toLowerCase() + ' · +' + num(ahora[0])}</small></span>
      {!B.hoy && B.hecha ? <button type="button" className="btn verde chico" disabled={ocup} onClick={cobrar}>{ocup ? '…' : 'Cobrar ' + num(ahora[0])}</button>
        : !B.hoy && IR_PASO[ahora[1]] ? <a className="btn verde chico" href={IR_PASO[ahora[1]]}>Ir</a> : msg ? <small className="pn-ok">{msg}</small> : null}
    </section>
  );
}

// 🎉 el festejo de la racha a los 7 y a los 30 días, una vez por racha (lo que hacía tu barra)
function Festejo({ R }) {
  const [fest, setFest] = useState(null);
  const actual = R && R.racha ? R.racha.actual || 0 : 0;
  const inicio = R && R.racha ? R.racha.inicio || '' : '';
  useEffect(() => {
    const hito = actual >= 30 ? 30 : actual >= 7 ? 7 : 0;
    if (!hito || !inicio) return;
    const ya = leer('lg:racha-fest') || {};
    if (ya[hito] === inicio) return;
    setFest(hito);
    guardar('lg:racha-fest', Object.assign({}, ya, { [hito]: inicio }));
  }, [actual, inicio]);
  if (!fest) return null;
  return (
    <button type="button" className="lb-fest" onClick={() => setFest(null)}>
      <Ico n="fuego" t={26} /><span><b>¡{fest} DÍAS SEGUIDOS!</b><small>Tu racha llegó a {fest}. Toca para seguir.</small></span>
    </button>
  );
}

/** La fila de arriba: la racha y la campana, o la racha sola a lo ancho; sin cuenta, la invitación */
export function FilaRacha({ dc, R }) {
  const c = useCampana();
  const camp = campanaPide(c, dc);
  return (
    <>
      <Festejo R={R} />
      <div className={'pn-fila' + (camp ? '' : ' sola')}>
        {dc ? <RachaCorta R={R} sola={!camp} /> : (
          <section className="pn-racha invita">
            <span className="pn-tx"><b>¿Juegas en la Liga?</b><small>Entra con Discord: tu racha, tus tarjetas y tu Pase</small></span>
            <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar</button>
          </section>
        )}
        {camp ? <CampanaCorta dc={dc} /> : null}
      </div>
    </>
  );
}

// ── ⚔️ TUS PRÓXIMAS BATALLAS, CON EL ESTILO DEL VS ──────────────────────────────────────────────────────
const ESTIMADO = (ovrR, ovrY) => 1 / (1 + Math.pow(10, ((ovrR || 0) - (ovrY || 0)) / 25));
function caraACara(liga, a, b) {
  const R = liga.d.rivales || {};
  const par = R[[a, b].sort().join('|')];
  return par ? 'Cara a cara ' + (par[a] || 0) + '–' + (par[b] || 0) : 'Primer cruce';
}
function duelos(f) {
  const du = f && f.du;
  return du && du[1] ? <><span className="pn-largo">Duelos </span>{du[0]}/{du[1]} · {Math.round((du[0] / du[1]) * 100)} %</> : 'Sin duelos todavía';
}
// las horas para una batalla libre: las cuatro próximas de 6 y 9 PM del este
function horasLibres() {
  const out = [];
  const ahora = Date.now();
  const enET = (ms) => new Date(new Date(ms).toLocaleString('en-US', { timeZone: ET }));
  const corr = enET(ahora).getTime() - ahora;
  for (let d = 0; out.length < 4 && d < 4; d++) {
    for (const hh of [18, 21]) {
      const b = enET(ahora);
      b.setDate(b.getDate() + d); b.setHours(hh, 0, 0, 0);
      const real = b.getTime() - corr;
      if (real > ahora + 30 * 60000 && out.length < 4) out.push(new Date(real).toISOString());
    }
  }
  return out;
}

export function Batallas({ liga, dc }) {
  const C = useCompetencias();
  const yo = liga.yo;
  const [fase, setFase] = useState('nada');
  const [rival, setRival] = useState(null);
  const [libre, setLibre] = useState(() => { const x = leer('lg:batalla-libre'); return x && utc(x.t) > Date.now() ? x : null; });
  const [cara, setCara] = useState('');
  const dlg = useRef(null);
  const giro = useRef(null);
  const T = useMemo(() => (liga.d.tabla || []).filter((f) => f.pos).sort((a, b) => a.pos - b.pos), [liga]);
  const d = useMemo(() => (C && yo ? dondeEstoy(C, yo.k) : null), [C, yo]);
  const pend = (d && d.pend) || [];
  const enPend = new Set(pend.map((x) => x[1].rival));
  const candidatos = useMemo(() => (yo && yo.pos ? T.filter((f) => f.k !== yo.k && Math.abs(f.pos - yo.pos) <= 25 && !enPend.has(f.k)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [T, yo, pend.length]);
  const buscar = () => {
    if (!candidatos.length) return;
    clearInterval(giro.current);
    setFase('busca');
    const fin = () => { clearInterval(giro.current); setRival(candidatos[Math.floor(Math.random() * candidatos.length)]); setFase('hora'); };
    if (quieto()) { setTimeout(fin, 500); return; }
    let n = 0;
    giro.current = setInterval(() => { setCara(candidatos[n++ % candidatos.length].k); if (n > 14) fin(); }, 110);
  };
  useEffect(() => () => clearInterval(giro.current), []);
  // el botón «Batallar» del centro avisa por acá
  useEffect(() => {
    const f = () => buscar();
    W.addEventListener('lg:batallar', f);
    return () => W.removeEventListener('lg:batallar', f);
  });
  if (!dc || !yo) return null;
  const elegir = (iso) => {
    const x = { k: rival.k, t: iso };
    guardar('lg:batalla-libre', x); setLibre(x); setFase('nada'); setRival(null);
  };
  const cancelar = () => { guardar('lg:batalla-libre', null); setLibre(null); if (dlg.current && dlg.current.open) dlg.current.close(); };
  const yoF = T.find((f) => f.k === yo.k) || yo;
  if (fase === 'busca') {
    return (
      <section className="pn-vs pn-busca" aria-live="polite">
        <span className="pn-gira"><Cara liga={liga} k={cara || (candidatos[0] || {}).k} nombre="" cls="pn-gira-c" /></span>
        <span className="pn-tx"><b>Buscando rival…</b><small>Entre los que están cerca tuyo en el ranking</small></span>
        <span className="pn-sim">simulado</span>
      </section>
    );
  }
  if (fase === 'hora' && rival) {
    return (
      <section className="pn-vs pn-hora">
        <div className="pn-duo">
          <span><Cara liga={liga} k={yo.k} nombre={yo.n} cls="pn-vs-c" /><b>{limpio(yo.n)}</b></span>
          <span className="pn-vs-x">VS</span>
          <span><Cara liga={liga} k={rival.k} nombre={rival.n} cls="pn-vs-c otro" /><b>{limpio(rival.n)}</b><small>#{rival.pos} · OVR {rival.ovr || '—'}</small></span>
        </div>
        <div className="pn-elige"><b>¿Cuándo batallan?</b>
          <div className="pn-horas">{horasLibres().map((h) => <button key={h} type="button" onClick={() => elegir(h)}>{cuando(h)}</button>)}</div>
          <div className="pn-elige-pie"><button type="button" className="pn-x" onClick={buscar}>Otro rival</button>
            <button type="button" className="pn-x" onClick={() => setFase('nada')}>Cancelar</button><span className="pn-sim">simulado</span></div></div>
      </section>
    );
  }
  // la lista: la libre (si hay) y las de Competencias, por cierre
  const libreF = libre ? T.find((f) => f.k === libre.k) : null;
  const todas = [];
  if (libre && libreF) todas.push({ et: 'Batalla libre', f: libreF, k: libre.k, cuando: cuando(libre.t), p: ESTIMADO(libreF.ovr, yoF.ovr), libre: true });
  for (const [et, c, hasta] of pend) {
    const f = liga.T[c.rival] || null;
    todas.push({ et, f, k: c.rival, n: nombreDe(liga, C, c.rival), cuando: hasta ? 'se define ' + cuando(hasta) : '', p: c.p });
  }
  const p0 = todas[0];
  if (!p0) {
    return (
      <section className="pn-vs vacio">
        <span className="pn-tx"><b>Sin batallas por ahora</b><small>Las de Competencias aparecen acá. O busca una:</small></span>
        {candidatos.length ? <button type="button" className="btn verde chico" onClick={buscar}>Batallar</button> : null}
      </section>
    );
  }
  const pct = Math.round((p0.p || 0) * 100);
  const nom = (x) => limpio((x.f && x.f.n) || x.n || x.k);
  const fila = (x) => (
    <li key={x.et + x.k}><Cara liga={liga} k={x.k} nombre={nom(x)} cls="pn-bt-c" />
      <span><em className={x.libre ? 'libre' : ''}>{x.et}</em><b>vs {nom(x)}</b><small>{x.cuando}{x.p != null ? ' · ' + Math.round(x.p * 100) + ' % a favor' : ''}</small></span>
      {x.libre ? <button type="button" className="pn-x" onClick={cancelar}>cancelar</button> : null}</li>
  );
  return (
    <section className="pn-vs">
      <div className="pn-rv"><Cara liga={liga} k={yo.k} nombre={yo.n} cls="pn-vs-c" />
        <span><b>{limpio(yo.n)}</b><small><span className="pn-pos">#{yoF.pos || '—'} · </span>OVR {yoF.ovr || '—'}</small><small className="pn-du">{duelos(yoF)}</small></span></div>
      <div className="pn-mid">
        <em className={p0.libre ? 'libre' : ''}>{p0.et}</em>
        <b className="pn-vs-x">VS</b>
        <span className="pn-prob" aria-label={'Chance de ganar: ' + pct + ' % contra ' + (100 - pct) + ' %'}><b>{pct} %</b><i style={{ '--p': pct + '%' }} /><b>{100 - pct} %</b></span>
        <small>{p0.cuando}</small>
        <small className="pn-cac">{caraACara(liga, yo.k, p0.k)}{p0.libre ? ' · % estimado' : ''}</small>
        <span className="pn-acc-v">
          {p0.libre ? <button type="button" className="pn-x" onClick={cancelar}>cancelar</button> : null}
          {todas.length > 1 ? <button type="button" className="pn-ver" onClick={() => dlg.current && dlg.current.showModal()}>Ver las {todas.length}</button> : null}
        </span>
      </div>
      <div className="pn-rv der"><span><b>{nom(p0)}</b><small>{p0.f ? <><span className="pn-pos">#{p0.f.pos || '—'} · </span>OVR {p0.f.ovr || '—'}</> : ''}</small>
        <small className="pn-du">{duelos(p0.f)}</small></span><Cara liga={liga} k={p0.k} nombre={nom(p0)} cls="pn-vs-c otro" /></div>
      <dialog className="pn-pop" ref={dlg} aria-label="Tus próximas batallas" onClick={(e) => { if (e.target === dlg.current) dlg.current.close(); }}>
        <div className="pn-pop-cab"><b>Tus próximas batallas</b><button type="button" className="btn-ico" aria-label="Cerrar" onClick={() => dlg.current.close()}><Ico n="cerrar" t={18} /></button></div>
        <ul className="pn-pop-l">{todas.map(fila)}</ul>
      </dialog>
    </section>
  );
}

// ── 🃏 EL CENTRO: tus tarjetas, tus rankings a los costados, lo último que te dijeron y tu último evento ──────────────
const CARTAS = ['temporada', 'competitivo', 'servidor', 'pais'];
const NOM = { temporada: 'Temporada', competitivo: 'Competitiva', servidor: 'Servidor', pais: 'País' };
const BOTS = [['El Hype', 'EH'], ['ULAYA', 'UL'], ['El Jurado', 'EJ']];
function textoBot(res, nombre) {
  const r = String(res || '');
  if (/campe[oó]n/i.test(r) && !/sub/i.test(r)) return '¡Campeón en ' + nombre + '! Esa final la vimos todos 🔥';
  if (/subcampe/i.test(r)) return 'Subcampeón en ' + nombre + ': la próxima final es tuya';
  if (/semi/i.test(r)) return 'Semifinal en ' + nombre + '… estuviste cerca, ¿revancha?';
  return r ? r + ' en ' + nombre + '. ¿Cuándo vuelves a la llave?' : 'Te vimos en ' + nombre + '. ¿Cuándo vuelves?';
}
function hace(ms) {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (m < 60) return m + ' min';
  const h = Math.round(m / 60);
  return h < 48 ? h + ' h' : Math.round(h / 24) + ' d';
}
const ICO_RK = { Temporada: 'eventos', Competitivo: 'copa', ELO: 'cruce', Crew: 'escudo' };
const COLOR_RK = { Temporada: '#29B298', Competitivo: '#E8B923', ELO: '#FF4F93', 'País': '#58A6FF', Servidor: '#C9D1DB', Crew: '#AEB6C1' };

function rankingsDe(liga, yo, svEl) {
  const T = liga.oficiales();
  const comp = T.filter((f) => f.rg).sort((a, b) => (b.sc || 0) - (a.sc || 0));
  const elo = [];
  for (const g of ((liga.d.div || {}).d || [])) for (const gg of g || []) for (const x of gg || []) elo.push(x);
  elo.sort((a, b) => (b[1] || 0) - (a[1] || 0));
  // tu servidor: el que elegiste, si tienes puesto ahí; si no, donde más jugaste (el de tu carta de Servidor)
  const tienePuesto = (x) => x && T.some((f) => f.sv === x && f.k === yo.k);
  const sv = (tienePuesto(svEl) ? svEl : yo.sv) || svEl || '';
  const delSv = T.filter((f) => f.sv === sv).sort((a, b) => a.pos - b.pos);
  const delPais = yo.cc ? T.filter((f) => f.cc === yo.cc).sort((a, b) => a.pos - b.pos) : [];
  const crews = (liga.d.crews || []).filter((c) => c.rk !== 0);
  const mia = liga.crewDe(yo);
  const iCrew = mia ? crews.findIndex((c) => c.crew === mia.crew) : -1;
  const iDe = (l, fn) => { const i = l.findIndex(fn); return i >= 0 ? i + 1 : null; };
  return [
    ['Temporada', yo.pos || null, T.length, 0, 'Temporada'],
    ['Competitivo', iDe(comp, (f) => f.k === yo.k), comp.length, 1, 'Competitivo'],
    ['ELO', iDe(elo, (x) => x[0] === yo.n), elo.length, -1, 'ELO'],
    ['País', yo.cc ? iDe(delPais, (f) => f.k === yo.k) : null, delPais.length, 3, yo.cc ? limpio(nombrePais(yo.cc)) : 'País'],
    ['Servidor', sv ? iDe(delSv, (f) => f.k === yo.k) : null, delSv.length, 2, sv ? siglaDe(sv) : 'Servidor', sv],
    ['Crew', iCrew >= 0 ? iCrew + 1 : null, crews.length, -1, mia ? limpio(mia.crew) : 'Crew'],
  ];
}

function Chip({ liga, x, elegida, onElegir }) {
  const [n, p, de, carta, et, sv] = x;
  const top = p && de ? Math.max(1, Math.round((p / de) * 100)) : null;
  const ico = n === 'País' && liga.yo && liga.yo.cc ? <Bandera cc={liga.yo.cc} cls="pn-chip-flag" />
    : n === 'Servidor' && sv && liga.logo(sv) ? <img className="pn-chip-sv" alt="" src={liga.logo(sv)} /> : <Ico n={ICO_RK[n] || 'ranking'} t={16} />;
  const on = carta >= 0 && carta === elegida;
  return (
    <button type="button" className={'pn-chip' + (on ? ' on' : '') + (p ? '' : ' vacio')} style={{ '--c': COLOR_RK[n] }}
      onClick={() => { if (carta >= 0) onElegir(carta); }} aria-pressed={carta >= 0 ? on : undefined}>
      <span className="pn-chip-i">{ico}</span><span className="pn-chip-n">{et}</span>
      <strong>{p ? '#' + p : '—'}</strong>
      <span className="pn-chip-pie">{p ? <><i><u style={{ width: Math.max(4, Math.round((1 - (p - 1) / Math.max(1, de)) * 100)) + '%' }} /></i><small>top {top} %</small></>
        : <small>{n === 'Crew' ? 'sin crew' : 'sin puesto'}</small>}</span>
    </button>
  );
}

export function Vestuario({ liga, dc }) {
  const yo = liga.yo;
  const el = useElegidos();
  const disp = yo ? CARTAS.filter((c) => liga.cartaUrl(yo.k, c)) : [];
  const [elegida, setElegida] = useState(0);
  const i = disp.length ? Math.min(elegida, disp.length - 1) : 0;
  if (!yo) {
    const top = (liga.d.tabla || []).filter((f) => f.pos && liga.cartaUrl(f.k, 'temporada')).slice(0, 3);
    return (
      <div className="pn-cu pn-yo sin"><div className="pn-sin-in">
        <div className="pn-abre">{top.map((f, j) => <img key={f.k} alt="" data-o={j === 0 ? 0 : j === 1 ? 2 : 1} src={liga.cartaUrl(f.k, 'temporada')} />)}</div>
        <div className="pn-sin-tx"><b>Tus tarjetas</b>
          <small>{dc ? 'Juega tu primer evento y entras al ranking: tu carta sale con el nivel 1 del Pase.' : 'Entra con Discord: acá van tus tarjetas, tus rankings y lo que te dicen.'}</small>
          {dc ? <a className="btn verde chico" href="#/eventos">Ver los próximos eventos</a> : <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button>}</div>
      </div></div>
    );
  }
  const rks = rankingsDe(liga, yo, svElegido(liga, el, yo.k));
  const cartaDeChip = (c) => { const k = CARTAS[c]; const j = disp.indexOf(k); return j; };
  const conCarta = rks.map((x) => { const y = x.slice(); y[3] = x[3] >= 0 ? cartaDeChip(x[3]) : -1; return y; });
  // lo último: tu último evento y lo que dijo de él un personaje de la Liga (bot)
  const ult = (liga.semanaDe(yo.k) || [])[0] || null;
  const ll = ult ? ult[0] : null;
  const fechaUlt = ll ? utc(liga.fechaLlave(ll)) : 0;
  const bot = BOTS[(ll ? String(ll.n).split('').reduce((s, ch) => s + ch.charCodeAt(0), 0) : 0) % BOTS.length];
  return (
    <div className="pn-cu pn-yo">
      <div className="pn-yo-in">
        <div className="pn-izq">{conCarta.slice(0, 3).map((x) => <Chip key={x[0]} liga={liga} x={x} elegida={i} onElegir={setElegida} />)}</div>
        <div className="pn-car">
          <div className="pn-abre" role="button" tabIndex={0} aria-label="Ver la siguiente carta" onClick={() => setElegida((i + 1) % Math.max(1, disp.length))}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setElegida((i + 1) % Math.max(1, disp.length)); } }}>
            {disp.map((c, j) => <img key={c} alt={'Tu carta ' + NOM[c]} data-o={(j - i + disp.length) % disp.length} src={liga.cartaUrl(yo.k, c)} />)}
          </div>
          {disp.length > 1 ? (
            <div className="pn-nav"><button type="button" aria-label="Carta anterior" onClick={() => setElegida((i - 1 + disp.length) % disp.length)}>‹</button>
              <b>{NOM[disp[i]]}</b><button type="button" aria-label="Carta siguiente" onClick={() => setElegida((i + 1) % disp.length)}>›</button></div>
          ) : disp.length ? <div className="pn-nav"><b>{NOM[disp[0]]}</b></div> : <small className="pn-gris">Tus cartas salen con el nivel 1 del Pase</small>}
        </div>
        <div className="pn-der">{conCarta.slice(3).map((x) => <Chip key={x[0]} liga={liga} x={x} elegida={i} onElegir={setElegida} />)}</div>
        <div className="pn-com">
          <span className="pn-dice"><span className="pn-bot-av" aria-hidden="true">{bot[1]}</span>
            <b>{bot[0]}<span className="pn-tag-bot">bot</span><small>{fechaUlt ? '· ' + hace(fechaUlt) : ''}</small></b>
            <p>{ll ? textoBot(ult[1], limpio(ll.nombre)) : 'Todavía no jugaste en la ' + (liga.temp || 'T1') + '. ¿Te anotas al próximo?'}</p></span>
          <a className="pn-resp" href={ll ? '#/publicaciones' : '#/eventos'}>{ll ? 'Responder' : 'Ver eventos'}</a>
          {ll ? (
            <button type="button" className="pn-ult" onClick={() => accion.llave(ll.n)}>
              <span className="pn-cal"><i>{new Date(fechaUlt).toLocaleDateString('es', { weekday: 'short' }).replace('.', '')}</i><b>{new Date(fechaUlt).getDate()}</b></span>
              <span className="pn-ult-t"><em>Tu último evento · {ult[1]}</em><strong>{limpio(ll.nombre)}</strong></span><small>Ver el evento ›</small>
            </button>
          ) : null}
        </div>
        <nav className="pn-acc" aria-label="Lo tuyo">
          <a href={'#/r/' + encodeURIComponent(yo.k)}><Ico n="ranking" t={22} /><b>Estadísticas</b><small>Tus eventos</small></a>
          <a href="#/inventario"><Ico n="tarjetas" t={22} /><b>Inventario</b><small>Tus TAGs</small></a>
          <span className="pn-pronto" aria-disabled="true"><Ico n="mira" t={22} /><b>Entrenar</b><small>Pronto</small><em>pronto</em></span>
          <button type="button" className="pn-bat" onClick={() => W.dispatchEvent(new CustomEvent('lg:batallar'))}><Ico n="cruce" t={22} /><b>Batallar</b><small>Busca rival</small><em>simulado</em></button>
        </nav>
      </div>
    </div>
  );
}

// ── 📅 EVENTOS: los de la semana, todos contra los tuyos ─────────────────────────────────────────────────────────
export function PnEventos({ liga }) {
  const ahora = liga.ahora;
  const l0 = lunes(ahora);
  const hoyI = Math.floor((ahora - l0) / DIA_MS);
  const todos = [0, 0, 0, 0, 0, 0, 0];
  for (const c of liga.d.calendario || []) {
    if (liga.canceladoCal(c)) continue;
    const k = Math.floor((utc(c.t) - l0) / DIA_MS);
    if (k >= 0 && k < 7) todos[k] += 1;
  }
  const yo = liga.yo;
  const mios = [0, 0, 0, 0, 0, 0, 0];
  let pasada = 0;
  for (const [ll] of yo ? liga.semanaDe(yo.k) || [] : []) {
    const k = Math.floor((utc(liga.fechaLlave(ll)) - l0) / DIA_MS);
    if (k >= 0 && k < 7) mios[k] += 1; else if (k >= -7 && k < 0) pasada += 1;
  }
  const max = Math.max(1, ...todos);
  const total = todos.reduce((s, x) => s + x, 0);
  const jugaste = mios.reduce((s, x) => s + x, 0);
  const vivos = liga.vivo();
  const ult = (liga.d.pasados || [])[0];
  return (
    <a className="pn-cu pn-ev" href="#/eventos">
      <h4>Eventos{vivos.length ? <span className="pn-vivo">EN VIVO</span> : null}</h4>
      <div className="pn-ev-n"><span className="pn-n">{total}</span><small>esta semana</small></div>
      {yo ? <small className="pn-tuyos">jugaste <b>{jugaste}</b> · la pasada {pasada}</small> : null}
      <div className="pn-barras" aria-label={'Eventos por día: ' + todos.join(', ')}>{todos.map((n, i) => (
        <i key={i} className={i < hoyI ? 'si' : i === hoyI ? 'hoy' : ''} style={{ height: (i <= hoyI ? Math.max(8, Math.round((100 * n) / max)) : 8) + '%' }}>
          {mios[i] ? <u style={{ height: Math.round((100 * Math.min(mios[i], n || 1)) / Math.max(1, n)) + '%' }} /> : null}</i>))}</div>
      <div className="pn-letras" aria-hidden="true">{LETRAS.map((l, i) => <span key={i}>{l}</span>)}</div>
      {yo ? <div className="pn-ley"><span><i className="t" />Todos</span><span><i className="y" />Tú</span></div> : null}
      {ult ? <span className="pn-ult3">{liga.logo(ult.sv) ? <img alt="" src={liga.logo(ult.sv)} /> : null}<span>Último: {limpio(ult.nombre)}</span></span> : null}
    </a>
  );
}

// ── 🛡️ CREW: la tuya, o súmate (en el lugar del Ranking, que ya está arriba) ─────────────────────────────────────
export function PnCrew({ liga }) {
  const yo = liga.yo;
  const mia = yo ? liga.crewDe(yo) : null;
  const ct = liga.d.crews_tiers || {};
  const tierDe = (c) => { const t = ((ct.crews || {})[c.clave || c.crew] || [])[0]; return t != null ? [(ct.nombres || [])[t], (ct.colores || [])[t]] : null; };
  const crews = (liga.d.crews || []).filter((c) => c.rk !== 0);
  const logo = (c, cls) => (escudoDe(c.logo, limpio(c.crew)) ? <span className={cls}><Escudo e={escudoDe(c.logo, limpio(c.crew))} /></span>
    : c.logo ? <img className={cls} alt="" src={srcLogo(c.logo)} /> : <span className={cls + ' ini'}>{limpio(c.crew).slice(0, 2).toUpperCase()}</span>);
  if (mia) {
    const i = crews.findIndex((c) => c.crew === mia.crew);
    const t = tierDe(mia);
    return (
      <a className="pn-cu pn-cr" href={'#/crew/' + encodeURIComponent(mia.clave || mia.crew)}>
        <h4>Tu crew</h4>
        <span className="pn-cr-tu">{logo(mia, 'pn-cr-logo')}<span><b>{limpio(mia.crew)}</b>{t ? <em style={{ color: t[1] }}>{t[0]}</em> : null}</span></span>
        <small>{i >= 0 ? '#' + (i + 1) + ' de ' + crews.length + ' · ' : ''}{num(mia.pts || 0)} pts · {mia.n || (mia.gente || []).length} raperos</small>
      </a>
    );
  }
  return (
    <a className="pn-cu pn-cr" href="#/crews">
      <h4>Crew</h4>
      <span className="pn-q">Sin crew</span><small>Súmate a una o arma la tuya</small>
      <ul className="pn-cr-l">{crews.slice(0, 3).map((c) => { const t = tierDe(c); return (
        <li key={c.crew}>{logo(c, 'pn-cr-mini')}<b>{limpio(c.crew)}</b>{t ? <em style={{ color: t[1] }}>{t[0]}</em> : null}</li>); })}</ul>
    </a>
  );
}

// ── 🎯 MISIONES, con los carteles de Se busca ─────────────────────────────────────────────────────────────────────
export function PnMisiones({ liga }) {
  const M = liga.d.mis || {};
  const lista = M.lista || [];
  const yo = liga.yo;
  const mio = yo ? Object.keys(M.prog || {}).find((raw) => liga.esDe(raw, yo.k)) : null;
  const hechas = mio ? lista.filter((x, i) => ((M.prog[mio] || [])[i] || 0) >= x.m).length : 0;
  const mw = liga.d.mw || {};
  const sueltos = (mw.b || []).filter((b) => b.e !== 'cazado' && b.e !== 'escondio' && !(yo && b.k === yo.k))
    .sort((a, b) => (Number(b.v) || 0) - (Number(a.v) || 0)).slice(0, 3);
  const nSueltos = (mw.b || []).filter((b) => b.e !== 'cazado' && b.e !== 'escondio').length;
  const teBuscan = !!(yo && liga.buscado(yo.k));
  if (!lista.length && !sueltos.length) return null;
  return (
    <a className="pn-cu pn-mi" href={sueltos.length ? '#/ranking/mw' : '#/ranking/misiones'}>
      <div className="pn-mi-cab"><h4>Misiones</h4>{M.bono ? <span className="pn-bono">+{num(M.bono)} de bono</span> : null}</div>
      {lista.length ? <span className="pn-sellos" aria-label={hechas + ' de ' + lista.length}>{lista.map((x, i) => <i key={x.id} className={i < hechas ? 'si' : ''} />)}</span> : null}
      {sueltos.length ? <span className="pn-carteles">{sueltos.map((b) => (
        <span key={b.k} className="pn-cartel"><em>SE BUSCA</em><Cara liga={liga} k={b.k} nombre={b.n} cls="pn-cartel-c" /><b>{limpio(b.n)}</b><span>{num(Number(b.v) || 0)}</span></span>
      ))}</span> : null}
      <small>{teBuscan ? 'Te buscan a ti · ' : ''}{nSueltos} {nSueltos === 1 ? 'sigue suelto' : 'siguen sueltos'}</small>
    </a>
  );
}

// ── 🎟️ EL PASE, decorativo: tu nivel en un hexágono, la pista y lo que viene después del último ─────────────────────
export function PnPase({ dc }) {
  const P = usePase(!!dc);
  const a = P && P.listo && P.miembro ? avance(P) : null;
  const niveles = (P && P.niveles) || 30;
  const nivel = a ? P.nivel : 0;
  const tramos = 10;
  const llenos = Math.round((nivel / niveles) * tramos);
  return (
    <a className="pn-cu pn-pa" href="#/pase">
      <h4>Pase rapero</h4>
      <span className="pn-nv"><span className="pn-hex">{a ? nivel : niveles}</span>
        <span><b>{a ? 'Nivel ' + nivel + ' de ' + niveles : niveles + ' niveles'}</b>
          <small>{a ? (a.falta ? 'te faltan ' + num(a.falta) + ' XP para el ' + (nivel + 1) : 'lo completaste') : dc && P && P.listo ? 'para los miembros de DRA' : 'Tareas que dan premios'}</small></span></span>
      <span className="pn-pista" aria-hidden="true">{Array.from({ length: tramos }, (_, j) => <i key={j} className={(j < llenos ? 'si' : '') + ((j + 1) % 5 === 0 ? ' hito' : '')} />)}</span>
      <span className="pn-cola"><Ico n="premio" t={20} /><small>Del {niveles} en adelante, más Puntos por cada 1.000 XP</small></span>
    </a>
  );
}

// ── 🛍️ Tienda y 📅 La semana, en la misma línea ──────────────────────────────────────────────────────────────────
export function PnTienda({ saldo }) {
  const valor = typeof W.valorCabezas === 'function' ? W.valorCabezas() || {} : {};
  const tope = Object.values(valor).reduce((m, v) => Math.max(m, Number(v) || 0), 0);
  return (
    <a className="pn-baja-t pn-ti" href="#/tienda">
      <span className="pn-ti-ic" aria-hidden="true">$</span>
      <span className="pn-baja-tx"><b>Tienda</b>{saldo != null ? <span className="pn-saldo">{num(saldo)}</span> : null}<small>{saldo != null ? 'Puntos para gastar' : 'Tus Puntos de Tienda'}</small></span>
      {tope ? <span className="pn-mini"><span>La cabeza más cara</span><strong>{num(tope)}</strong></span> : null}
    </a>
  );
}
export function PnSemana({ liga }) {
  const C = useCompetencias();
  if (!C || !C.ligas) return null;
  const dia = C.dia || 1;
  const yo = liga.yo;
  const d = yo ? dondeEstoy(C, yo.k) : null;
  const copa = d && d.copa ? (d.copa.campeon ? 'Campeón' : d.copa.fuera ? 'Afuera' : (d.copa.ronda || {}).r || '—') : String((C.copa || []).length);
  const rapid = d && d.rapid ? (d.rapid.campeon ? 'Campeón' : d.rapid.fuera ? 'Afuera' : (d.rapid.ronda || {}).r || '—') : String((C.rapid || []).length);
  return (
    <a className="pn-baja-t pn-se" href="#/competencias" style={{ '--p': Math.round((dia / 7) * 100) }}>
      <span className="pn-anillo"><b>{dia}/7</b></span>
      <span className="pn-baja-tx"><b>La semana</b><small>Competencias ›</small></span>
      <span className="pn-mini"><span>Ligas</span><strong>{d && d.liga ? d.liga.pos + '.º' : 'J' + (C.ligas.jornada || 1)}</strong></span>
      <span className="pn-mini"><span>Copa</span><strong>{copa}</strong></span>
      <span className="pn-mini"><span>Rapid</span><strong>{rapid}</strong></span>
    </a>
  );
}
