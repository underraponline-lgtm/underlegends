// 🎟️ EL PASE DE RAPERO (05/10/2026; con XP desde el 06/10; el remake, 25/10). Dlx: «sólo para DRA», «con TAREAS, no
// misiones», «como Brawl Stars». Al remake: «algo como el pase de brawl stars… más visual», «tampoco exactamente lo
// mismo», y a la v2, «más original… con el estilo de las páginas del remake… muy infantil». Se queda la ESTRUCTURA del
// Brawl Pass —pestañas Premios | Tareas | Premium, la barra de XP con el nivel que sigue, tu carta como la skin de la
// temporada, la pista con dos filas y el riel de números— y la PIEL es la del hub: negro, blanco, verde agua y magenta,
// fichas rectas, íconos planos (pase_iconos.jsx). La maqueta cerrada es la v8 (artifact 2bjXxHEMuNeDcg6orS3d6D).
//
// La cuenta la hace el servidor (bot/avisos.js; las reglas y los números, en bot/pase.py): acá sólo se muestra. Lo
// público (las Tareas, los premios y el Salón, sin nadie adentro) viaja con `/avisos/pases`, así quien no entró también
// ve qué es. ⚠️ EL PREMIUM NO TIENE PRECIO EN NINGÚN LADO: en la T1 lo desbloquea el rol de DRA, que se sortea acá.
import { useEffect, useMemo, useRef, useState } from 'react';
import { aQuienSigo, limpio, num } from './liga.js';
import { Cara, accion } from './piezas.jsx';
import { avance, multAhora, pasePost, pedirPase, usePase, usePases } from './pase.js';
import { PREMIUM_VIVO, PaseIcono, TareaIcono, premioCorto, premioLargo } from './pase_iconos.jsx';
import { PopPase } from './pase_pop.jsx';
import CSS_PAGINA from './css/pase.css?inline';
import { usarCss } from './css.js';

usarCss('pase', CSS_PAGINA);

const DIA = 86400000;
// la curva nueva (`CURVA_DESDE` de bot/pase.py: el lunes 26/10 a las 11 AM ET) y una semana para contarlo
const CURVA = [Date.UTC(2026, 9, 26, 15, 0), Date.UTC(2026, 10, 2, 16, 0)];

// «2 D 05 H», «3 H 12 MIN», «45 S»: la cuenta atrás de los cuadrados que todavía no se abren
function reloj(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const dos = (n) => (n < 10 ? '0' : '') + n;
  if (d) return d + ' D ' + dos(h) + ' H';
  if (h) return h + ' H ' + dos(m) + ' MIN';
  return m + ' MIN ' + dos(x) + ' S';
}
// «14 H», «2 D»: lo que falta, corto, como los relojes del Inicio
function corto(ms) {
  if (!(ms > 0)) return '';
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' MIN';
  const h = Math.round(m / 60);
  return h < 48 ? h + ' H' : Math.round(h / 24) + ' D';
}
const fechaET = (t, o) => new Intl.DateTimeFormat('es', Object.assign({ timeZone: 'America/New_York' }, o)).format(new Date(t));

// un reloj que se mueve solo, de a segundo, mientras la página está abierta
function useAhora(paso = 1000) {
  const [t, setT] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), paso); return () => clearInterval(i); }, [paso]);
  return t;
}
// en la compu las grillas son de cuatro; en el celular, de dos
function useCompu() {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 900px)') : null;
  const [si, setSi] = useState(!!(q && q.matches));
  useEffect(() => {
    if (!q) return undefined;
    const f = () => setSi(q.matches);
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return si;
}

// ── LA PISTA: dos filas (premium arriba, con candado si no lo tienes) y el riel de números en el medio ──
function Ficha({ p, prem, est, tiene, tienda }) {
  const esp = !!p[2];
  return (
    <div className={'ps-ti' + (prem ? ' p' : ' g') + (esp ? ' esp' : '') + (est ? ' ' + est : '')}>
      {!prem && est === 'cob' ? <em className="ps-st ok">✓ COBRADO</em> : null}
      {!prem && est === 'sgt' ? <em className="ps-st sg">SIGUIENTE</em> : null}
      {prem ? <span className={'ps-cand' + (tiene && est === 'cob' ? ' ok' : '')} aria-label={tiene ? '' : 'premium'}>{tiene ? (est === 'cob' ? '✓' : '') : '🔒'}</span> : null}
      <span className="ps-ti-i"><PaseIcono p={p} prem={prem} t={38} /></span>
      {esp ? <><b className="ps-pq">{premioCorto(p, prem)}</b><small>{premioLargo(p, prem)}</small></>
        : <><b className="ps-pq n">+{num(p[1] || tienda)}</b><small>Puntos de Tienda</small></>}
    </div>
  );
}

function Pista({ libres, prem, nivel, tiene, tienda, min, compu }) {
  const caja = useRef(null);
  const [puntas, setPuntas] = useState([true, false]);
  const medir = () => {
    const el = caja.current;
    if (el) setPuntas([el.scrollLeft < 4, el.scrollLeft + el.clientWidth > el.scrollWidth - 4]);
  };
  const ir = (n, suave) => {
    const el = caja.current;
    const li = el && el.querySelector('[data-n="' + n + '"]');
    if (li) el.scrollTo({ left: Math.max(0, li.offsetLeft - 4), behavior: suave ? 'smooth' : 'auto' });
  };
  // abre en tu nivel: el de antes a la izquierda (tres antes en la compu)
  useEffect(() => { ir(Math.max(1, nivel - (compu ? 3 : 1))); medir(); }, [nivel, compu, libres.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.addEventListener('resize', medir); return () => window.removeEventListener('resize', medir); }, []);
  if (!libres.length) return null;
  const mover = (k) => { const el = caja.current; if (el) el.scrollBy({ left: k * Math.max(120, el.clientWidth * 0.8), behavior: 'smooth' }); };
  const ult = libres.length;
  return (
    <div className="ps-pista-w">
      <div className="ps-pista-cab">
        <span>{nivel ? 'VAS EN EL NIVEL ' + nivel + ' DE ' + ult : 'LOS ' + ult + ' NIVELES Y SUS PREMIOS'}</span>
        <div className="ps-flechas">
          {nivel && nivel < ult ? <button type="button" className="ps-ir" onClick={() => ir(nivel + 1, true)}>▶ {nivel + 1}</button> : null}
          <button type="button" onClick={() => mover(-1)} disabled={puntas[0]} aria-label="Niveles anteriores">‹</button>
          <button type="button" onClick={() => mover(1)} disabled={puntas[1]} aria-label="Niveles siguientes">›</button>
        </div>
      </div>
      <div className="ps-pista">
        <div className="ps-filas" aria-hidden="true"><span className="fp">PREMIUM {tiene ? '' : '🔒'}</span><span className="fg">GRATIS</span></div>
        <ol className="ps-cols" ref={caja} onScroll={medir} aria-label="Los niveles del Pase y lo que da cada uno">
          {libres.map((p) => {
            const n = p[0];
            const est = n <= nivel ? 'cob' : n === nivel + 1 ? 'sgt' : '';
            const pp = prem[n - 1] || [n, tienda, '', ''];
            return (
              <li key={n} data-n={n} className={'ps-co' + (n < nivel ? ' cob' : n === nivel ? ' yo' : '')}>
                <Ficha p={pp} prem tiene={tiene} est={est} tienda={tienda} />
                <span className="ps-nn">{n}</span>
                <Ficha p={p} est={est} tienda={tienda} />
              </li>
            );
          })}
        </ol>
      </div>
      {tienda ? (
        <p className="ps-pdt"><b>{num(tienda)} por nivel.</b> Con {Math.ceil(min / tienda)} niveles le pones precio a una cabeza (desde {num(min)}) · con {Math.ceil(2500 / tienda)} armas tu crew ({num(2500)}).</p>
      ) : null}
    </div>
  );
}

// ── LAS TAREAS: tarjetas en lo blanco, con un ícono por lo que miden ──
function Tarea({ x, mide, cuando, cls = '' }) {
  const ok = !!x.hecha;
  const pct = x.meta ? Math.round((100 * Math.min(x.lleva || 0, x.meta)) / x.meta) : 0;
  return (
    <li className={'ps-qu' + (ok ? ' ok' : '') + (cls ? ' ' + cls : '')}>
      <div className="ps-qu-top"><span className="ps-qu-i"><TareaIcono mide={mide} /></span><em>{cuando}</em></div>
      <b>{x.t}</b>
      <small>{x.d}</small>
      <div className="ps-qu-pie">
        <span className="ps-qu-bar"><u style={{ width: (ok ? 100 : pct) + '%' }} /></span>
        <span className="ps-qu-n">{ok ? x.meta : Math.min(x.lleva || 0, x.meta)}/{x.meta}</span>
        <span className="ps-qu-xp">{ok ? '✓ HECHA' : '+' + num(x.xp) + ' XP'}</span>
      </div>
    </li>
  );
}
// 🔒 lo que viene, con su cuenta atrás (Dlx: «en vez de los espacios en blanco… que diga se desbloqueará en COUNTDOWN»)
function Bloq({ que, hasta, ahora, xp }) {
  return (
    <li className="ps-qu lock">
      <div className="ps-qu-top"><span className="ps-qu-i" aria-hidden="true">🔒</span><em>{que}</em></div>
      <b>Tarea nueva</b>
      <small>Se desbloquea en</small>
      <span className="ps-cd">{reloj(hasta - ahora)}</span>
      {xp ? <span className="ps-qu-xp lk">{xp}</span> : null}
    </li>
  );
}
const relleno = (n, cols, hacer) => Array.from({ length: (cols - (n % cols)) % cols }, (_, i) => hacer(i));

function Grupo({ titulo, nota, extra, children }) {
  return (
    <>
      <div className="ps-blk"><h3>{titulo}{nota ? <small>{nota}</small> : null}</h3>{extra || null}</div>
      <ol className="ps-qg">{children}</ol>
    </>
  );
}

function Avisos({ P }) {
  const [si, setSi] = useState(!!P.aviso);
  const [ocup, setOcup] = useState(false);
  useEffect(() => setSi(!!P.aviso), [P.aviso]);
  const cambiar = async () => {
    setOcup(true);
    const d = await pasePost('pase-avisos', { si: !si });
    if (d && d._ok) setSi(!!d.si);
    setOcup(false);
  };
  return (
    <div className="ps-avp">
      <span className="ps-avp-i" aria-hidden="true">🔔</span>
      <div><b>Avisos del Pase</b><span>Uno por semana, el domingo a la tarde: qué te falta para el siguiente nivel. Llegan al
        teléfono donde prendiste <a href="#/avisos">la campana</a>.</span></div>
      <button type="button" className={'ps-sw' + (si ? ' on' : '')} role="switch" aria-checked={si} disabled={ocup} onClick={cambiar}
        aria-label={si ? 'Apagar los avisos del Pase' : 'Prender los avisos del Pase'}><i /></button>
    </div>
  );
}

function Crew({ c, ahora }) {
  if (!c) return null;
  const pct = Math.round((100 * Math.min(c.hechas, c.meta)) / c.meta);
  return (
    <div className="ps-crw">
      <div className="ps-crw-t"><span className="ps-tag2">TU CREW</span><b>{limpio(c.nombre)} · {num(Math.min(c.hechas, c.meta))} de {num(c.meta)} Tareas esta semana</b></div>
      <span className="ps-crw-bar"><u style={{ width: pct + '%' }} /></span>
      <p>{c.cobrada ? <>¡Llegaron! Cobraste <b>+{num(c.xp)} XP</b>.</>
        : <>Si entre los {c.n} llegan a {num(c.meta)} antes del lunes ({corto(c.fin - ahora)}), cada uno gana <b>+{num(c.xp)} XP</b>.</>} Tú hiciste {num(c.mias)}.</p>
    </div>
  );
}

function Tareas({ P, cfg, miembro, compu, ahora }) {
  const cols = compu ? 4 : 2;
  const [todas, setTodas] = useState(false);
  // de cada Tarea, qué mide (para su ícono)
  const mide = useMemo(() => {
    const m = {};
    for (const t of [].concat(cfg.diarias || [], cfg.semanales || [], cfg.temporada || [], cfg.bienvenida || [], cfg.especiales || [])) m[t[0]] = t[3];
    return m;
  }, [cfg]);
  // sin tu Pase, las de la lista pública, sin progreso
  const sin = (xs) => (xs || []).map(([id, t, d, , meta, xp]) => ({ id, t, d, meta, xp, lleva: 0, hecha: false }));
  const hoy = miembro ? (P.hoy && P.hoy.tareas) || [] : sin(cfg.diarias).slice(0, cfg.por_dia || 2);
  const semana = miembro ? (P.semana && P.semana.tareas) || [] : sin(cfg.semanales);
  const temporada = miembro ? P.temporada || [] : sin(cfg.temporada);
  const bien = miembro ? P.bienvenida || [] : [];
  const esp = miembro ? P.especiales || [] : (cfg.especiales || []).map(([id, t, d, , meta, xp, ini, fin]) => ({ id, t, d, meta, xp, lleva: 0, hecha: false, ini, fin }));
  const gracia = miembro && P.gracia ? P.gracia : null;
  const hechas = (xs) => xs.filter((x) => x.hecha).length;
  const tem = compu || todas ? temporada : temporada.slice(0, 4);
  const finHoy = P && P.hoy ? P.hoy.fin : 0, finSem = P && P.semana ? P.semana.fin : 0;
  const bienOk = bien.length && bien.every((x) => x.hecha);
  // las especiales: las que corren, y las que vienen bloqueadas con su cuenta atrás
  const espYa = esp.filter((x) => !x.ini || x.ini <= ahora);
  const espVan = esp.filter((x) => x.ini && x.ini > ahora);
  return (
    <div className="ps-tareas">
      {miembro ? <Avisos P={P} /> : null}
      {miembro ? <Crew c={P.crew} ahora={ahora} /> : null}
      {bien.length ? (
        <details className="ps-bien" open={!bienOk}>
          <summary><b>{bienOk ? '✓ ' : ''}Para empezar</b><span>{hechas(bien)} de {bien.length} · +{num(bien.reduce((s, x) => s + x.xp, 0))} XP · una sola vez</span></summary>
          <ol className="ps-qg">{bien.map((x) => <Tarea key={x.id} x={x} mide={mide[x.id]} cuando="PARA EMPEZAR" />)}</ol>
        </details>
      ) : null}
      {esp.length ? (
        <Grupo titulo="⭐ Especiales" nota="duran poco">
          {espYa.map((x) => <Tarea key={x.id} x={x} mide={mide[x.id]} cls="esp"
            cuando={x.fin > ahora ? '⏱ ' + corto(x.fin - ahora) : 'TERMINÓ'} />)}
          {espVan.map((x) => <Bloq key={x.id} que={'⭐ ' + fechaET(x.ini, { day: 'numeric', month: 'numeric' })} hasta={x.ini} ahora={ahora} xp={'+' + num(x.xp) + ' XP'} />)}
        </Grupo>
      ) : null}
      {hoy.length ? (
        <Grupo titulo="Hoy" nota={miembro ? hechas(hoy) + ' de ' + hoy.length : 'cada día, ' + (cfg.por_dia || 2)}>
          {hoy.map((x) => <Tarea key={x.id} x={x} mide={mide[x.id]} cuando={finHoy ? '⏱ ' + corto(finHoy - ahora) : 'HOY'} />)}
          {finHoy ? relleno(hoy.length, cols, (i) => <Bloq key={'h' + i} que="MAÑANA" hasta={finHoy} ahora={ahora} />) : null}
        </Grupo>
      ) : null}
      {semana.length ? (
        <Grupo titulo="Esta semana" nota={miembro ? hechas(semana) + ' de ' + semana.length : semana.length + ' por semana'}
          extra={gracia ? <span className="ps-gr-t">+ {gracia.tareas.length} de la semana pasada</span> : null}>
          {gracia ? gracia.tareas.map((x) => (
            <Tarea key={'g' + x.id} x={Object.assign({}, x, { d: 'De la semana pasada: se te pasó, y tienes una semana más para cumplirla.' })}
              mide={mide[x.id]} cls="gr" cuando={'⏱ HASTA EL ' + fechaET(gracia.fin, { weekday: 'long' }).toUpperCase()} />
          )) : null}
          {semana.map((x) => <Tarea key={x.id} x={x} mide={mide[x.id]} cuando={finSem ? '⏱ ' + corto(finSem - ahora) : 'SEMANA'} />)}
          {finSem ? relleno(semana.length + (gracia ? gracia.tareas.length : 0), cols, (i) => <Bloq key={'s' + i} que="LA SEMANA QUE VIENE" hasta={finSem} ahora={ahora} />) : null}
        </Grupo>
      ) : null}
      {temporada.length ? (
        <Grupo titulo="De la temporada" nota={miembro ? hechas(temporada) + ' de ' + temporada.length : 'en cualquier orden'}>
          {tem.map((x) => <Tarea key={x.id} x={x} mide={mide[x.id]} cuando="TEMPORADA" />)}
        </Grupo>
      ) : null}
      {!compu && !todas && temporada.length > 4 ? (
        <button type="button" className="btn borde ps-ancho ps-mas" onClick={() => setTodas(true)}>Ver las {temporada.length} de la temporada</button>
      ) : null}
      <p className="ps-nota">Se cumplen solas: el Pase se entera de lo que haces en la página, en el bot y en los eventos. Las Tareas no son las
        Misiones: ésas son para todos y suman a la Temporada.</p>
    </div>
  );
}

// ── PREMIOS, abajo: el premium, lo exclusivo de la T1, la gente en el Pase y el Salón ──
function CtaPremium({ onIr }) {
  return (
    <section className="ps-cta">
      <span className="ps-tag2">PREMIUM</span>
      <b>Desbloquea la fila de arriba</b>
      <p>En la T1 se desbloquea con el rol «Pase de temporada» de DRA: se sortea acá en la página, y se gana en eventos.</p>
      <button type="button" className="btn borde chico" onClick={onIr}>Cómo se desbloquea →</button>
    </section>
  );
}

function Exclusivos({ libres, prem, oscuro, max = 8 }) {
  const xs = libres.filter((p) => p[2] === 'insignia' || p[2] === 'titulo').map((p) => ({ p, prem: false }))
    .concat(prem.filter((p) => p[2] === 'emblema' || p[2] === 'carta' || (p[2] === 'marco' && p[3] === 'Premium')).map((p) => ({ p, prem: true })))
    .slice(0, max);
  if (!xs.length) return null;
  return (
    <section className={'ps-ex' + (oscuro ? ' osc' : '')}>
      <div className="ps-blk"><h3>Lo exclusivo de la T1<small>te lo llevas para siempre</small></h3></div>
      <p className="ps-sub">Las insignias y los títulos del Pase son de esta temporada: quedan en tu perfil para siempre, y en la T2 llegan otros.</p>
      <ol>{xs.map(({ p, prem: pr }) => (
        <li key={(pr ? 'p' : 'g') + p[0]} className={pr ? 'p' : ''}>
          <PaseIcono p={p} prem={pr} t={34} /><b>{premioLargo(p, pr)}</b><small>{pr ? 'PREMIUM' : 'GRATIS'} · nivel {p[0]}</small>
        </li>
      ))}</ol>
    </section>
  );
}

function EnElPase({ liga, pub, nivel, max }) {
  const [quien, setQuien] = useState('sigo');
  const n = (pub && pub.n) || {};
  const todos = Object.entries(n).filter(([k]) => liga.T && liga.T[k]).sort((a, b) => b[1][0] - a[1][0]);
  if (!todos.length) return null;
  const sigo = new Set(aQuienSigo());
  const seguidos = todos.filter(([k]) => sigo.has(k));
  const lista = (quien === 'sigo' && seguidos.length ? seguidos : todos).slice(0, max);
  const yoK = liga.yo && liga.yo.k;
  const adelante = nivel ? seguidos.filter(([k, v]) => k !== yoK && v[0] > nivel)[0] : null;
  return (
    <section className="ps-lt">
      <div className="ps-blk"><h3>En el Pase<small>{num(todos.length)} con nivel</small></h3>
        {seguidos.length ? (
          <span className="ps-lt-tabs">
            <button type="button" className={quien === 'sigo' ? 'on' : ''} onClick={() => setQuien('sigo')}>A quién sigues</button>
            <button type="button" className={quien === 'todos' ? 'on' : ''} onClick={() => setQuien('todos')}>Todos</button>
          </span>
        ) : null}
      </div>
      <ol>{lista.map(([k, v]) => (
        <li key={k}><a href={'#/r/' + encodeURIComponent(k)} title={limpio(liga.T[k].n)}>
          <Cara liga={liga} k={k} nombre={liga.T[k].n} cls="cara ps-c40" /><b>{v[0]}</b>{v[3] ? <i className="ps-dia" aria-label="premium">◆</i> : null}</a></li>
      ))}</ol>
      {nivel ? (
        <p className="ps-tuL">Tú vas en el <b>nivel {nivel}</b>.{adelante ? <> {limpio(liga.T[adelante[0]].n)}, a quien sigues, va en el {adelante[1][0]}: <b>{adelante[1][0] - nivel} {adelante[1][0] - nivel === 1 ? 'nivel' : 'niveles'} adelante</b>.</> : null}</p>
      ) : null}
    </section>
  );
}

// 🏛️ EL SALÓN DEL PASE (Dlx, 06/10/2026: «4. B»): los que lo completaron, en el orden en que llegaron
function Salon({ liga, lista, temp }) {
  if (!lista || !lista.length) return null;
  return (
    <section className="ps-salon">
      <div className="ps-blk"><h3>Salón del Pase<small>{temp ? temp.toUpperCase() + ' · ' : ''}{lista.length} {lista.length === 1 ? 'lo completó' : 'lo completaron'}</small></h3></div>
      <ol>
        {lista.map(([k, t], i) => {
          const f = liga.T && liga.T[k];
          if (!f) return null;
          return (
            <li key={k}>
              <span className="ps-sp">{i + 1}.º</span>
              <Cara liga={liga} k={k} nombre={f.n} cls="cara ps-c28" />
              <a href={'#/r/' + encodeURIComponent(k)}>{limpio(f.n)}</a>
              <small>{liga.cuando(new Date(t).toISOString())}</small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// 🌱 quien no es de DRA: lo que ganaría (Dlx, 25/10/2026: «dale»)
function LoQueGanarias({ libres, cuantos }) {
  const xs = libres.filter((p) => p[2]).slice(0, 7);
  if (!xs.length) return null;
  return (
    <section className="ps-sd">
      <div className="ps-blk"><h3>Lo que ganarías<small>gratis</small></h3></div>
      <ol className="ps-sd-l">{xs.map((p) => <li key={p[0]}><PaseIcono p={p} t={30} /><b>{premioLargo(p)}</b><small>nivel {p[0]}</small></li>)}</ol>
      {cuantos ? <p className="ps-sub">{num(cuantos)} ya tienen nivel en el Pase.</p> : null}
    </section>
  );
}

// ── EL SORTEO DEL PREMIUM, en vivo en la página (Dlx, 25/10/2026: «algo interactivo en la página web para dar incentivo
// a usarla»). Gratis, sin puntos: entras, tienes 1 boleto y uno más por cada semana con las cinco semanales (hasta 3).
// A la hora, la página lo muestra en vivo; el ganador lo eligió el servidor con una cuenta que cualquiera repite ──
function Sorteo({ liga, dc, miembro }) {
  const [S, setS] = useState(undefined);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const [rueda, setRueda] = useState(null);
  const ahora = useAhora();
  const traer = () => pasePost('sorteo', {}).then((d) => setS(d && d.sorteo !== undefined ? d : null));
  useEffect(() => { traer(); }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = S && S.sorteo;
  const res = S && S.resultado;
  // a la hora, hasta que llega el resultado (lo saca el vigía, minuto a minuto), se vuelve a preguntar
  useEffect(() => {
    if (!s || res || ahora < s.cuando) return undefined;
    const i = setInterval(traer, 15000);
    return () => clearInterval(i);
  }, [!!s, !!res, ahora >= (s ? s.cuando : Infinity)]); // eslint-disable-line react-hooks/exhaustive-deps
  const nombre = (k) => (liga.T && liga.T[k] ? limpio(liga.T[k].n) : k);
  // 🎰 la rueda: pasan los que entraron, cada vez más lento, y se para en quien ganó. Una vez por sorteo y por navegador
  const girar = () => {
    if (!res) return;
    const ns = (S.nombres || []).length ? S.nombres : [res.k];
    const calma = typeof document !== 'undefined' && (document.querySelector('.app.calma')
      || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
    if (calma) { setRueda({ k: res.k, fin: true }); return; }
    let i = 0, paso = 60;
    const vuelta = () => {
      i += 1;
      if (paso > 420) { setRueda({ k: res.k, fin: true }); try { localStorage.setItem('lg:sorteo-visto', s.id); } catch (e) { /* nada */ } return; }
      setRueda({ k: ns[i % ns.length], fin: false });
      paso = Math.round(paso * 1.12);
      setTimeout(vuelta, paso);
    };
    vuelta();
  };
  if (S === undefined) return null;
  if (!s) {
    return (
      <section className="ps-srt">
        <div className="ps-blk"><h3>El sorteo del premium</h3></div>
        <p className="ps-sub">Todavía no hay uno programado. Cuando lo haya, se entra desde acá, gratis.</p>
      </section>
    );
  }
  const abierto = ahora < s.cierra;
  const entrar = async () => {
    setOcup(true); setMsg('');
    const d = await pasePost('sorteo-entrar', {});
    if (d && d._ok) setS(d);
    else setMsg(d && d.error === 'miembro' ? 'Es de los miembros de DRA con el Pase: verifícate primero.' : d && d.error === 'cerrado' ? 'Ya cerró.' : 'No se pudo: prueba de nuevo.');
    setOcup(false);
  };
  return (
    <section className="ps-srt">
      <div className="ps-blk"><h3>El sorteo del premium<small>gratis</small></h3></div>
      {res ? (
        <div className="ps-srt-res">
          <div className={'ps-rueda' + (rueda && rueda.fin ? ' fin' : '')}>
            {rueda ? <><Cara liga={liga} k={rueda.k} nombre={nombre(rueda.k)} cls="cara ps-c40" /><b>{nombre(rueda.k)}</b></>
              : <button type="button" className="btn verde" onClick={girar}>▶ Ver el sorteo</button>}
          </div>
          {rueda && rueda.fin ? <p className="ps-srt-gano"><span className="ps-tag2">GANÓ</span> <b>{nombre(res.k)}</b>{res.yo ? ': ¡eres tú! Dlx te da el rol en DRA.' : ' se lleva el rol «Pase de temporada» de DRA.'}</p> : null}
          <ul className="ps-srt-d">
            <li><b>{num(res.personas)} entraron</b>, con {num(res.boletos)} boletos en total.</li>
            <li><b>Cómo se eligió</b>: la semilla es el SHA-256 del sorteo y de la lista de boletos; el ganador, la semilla dividida por los boletos (lo que sobra). Cualquiera con la lista repite la cuenta.</li>
            <li className="ps-semilla">Semilla: <code>{res.semilla.slice(0, 16)}…</code></li>
          </ul>
        </div>
      ) : (
        <div className="ps-srt-a">
          <p>{abierto ? <>Se sortea el <b>{fechaET(s.cuando, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true })} (hora del este)</b>, en vivo acá. Cierra en <b className="ps-cd">{reloj(s.cierra - ahora)}</b>.</>
            : ahora < s.cuando ? <>Ya cerró. Se sortea en <b className="ps-cd">{reloj(s.cuando - ahora)}</b>, en vivo acá.</> : <>Sorteando…</>}</p>
          <p className="ps-sub">{num(s.personas)} {s.personas === 1 ? 'entró' : 'entraron'} · {num(s.boletos)} boletos. Entrar es gratis: <b>1 boleto</b>, y uno más por cada semana con las cinco semanales completas (hasta 3).</p>
          {S.mio ? <p className="ps-srt-ok">✓ Estás adentro con <b>{S.mio} {S.mio === 1 ? 'boleto' : 'boletos'}</b>.</p>
            : abierto ? (dc ? <button type="button" className="btn verde" disabled={ocup || !miembro} onClick={entrar}>{ocup ? '…' : miembro ? 'Entrar gratis' : 'Es de los miembros de DRA'}</button>
              : <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>) : null}
          {msg ? <p className="ps-mal" role="status">{msg}</p> : null}
        </div>
      )}
    </section>
  );
}

function Premium({ liga, dc, P, prem, nivel, miembro }) {
  const tiene = !!(P && P.premium && P.premium.hasta == null);
  const [col, setCol] = useState((P && P.color_premium) || '');
  const [msg, setMsg] = useState('');
  const nColor = (prem.find((p) => p[2] === 'color') || [7])[0];
  const elegir = async (c) => {
    setMsg('');
    const d = await pasePost('pase-color', { color: c });
    if (d && d._ok) { setCol(c); pedirPase(); } else setMsg('No se pudo: prueba de nuevo.');
  };
  const ya = prem.filter((p) => p[0] <= nivel);
  const esp = prem.filter((p) => p[2]);
  const boost = (P && P.boost) || 20;
  return (
    <div className="ps-pv">
      {tiene ? (
        <section className="ps-tuyo">
          <span className="ps-tag2">TIENES EL PREMIUM</span>
          <b>Desde el {fechaET(P.premium.desde, { day: 'numeric', month: 'long' })}</b>
          <p>Tus Tareas dan <b>+{boost} % de XP</b> mientras lo tengas, y cobras la fila de arriba nivel por nivel.</p>
          {nivel >= nColor && (P.colores || []).length ? (
            <div className="ps-colores" role="group" aria-label="El color de tu nombre">
              {P.colores.map((c) => <button key={c} type="button" className={c === col ? 'on' : ''} style={{ background: c }}
                aria-label={'Tu nombre en ' + c} aria-pressed={c === col} onClick={() => elegir(c)} />)}
              <small>El color de tu nombre{col ? '' : ': elige uno'}</small>
            </div>
          ) : null}
          {msg ? <p className="ps-mal">{msg}</p> : null}
        </section>
      ) : null}
      <section className="ps-pasos-w">
        <div className="ps-blk"><h3>Cómo se desbloquea<small>T1</small></h3></div>
        <ol className="ps-pasos">
          <li><b>1</b><div><strong>El rol «Pase de temporada» de DRA</strong><span>Es lo que lo desbloquea en la T1. Lo tienes o no lo tienes: el Pase se entera solo, en la próxima vuelta del ciclo.</span></div></li>
          <li><b>2</b><div><strong>Se sortea acá</strong><span>Entrar es gratis y se sortea en vivo en esta página. Más abajo.</span></div></li>
          <li><b>3</b><div><strong>Se gana en eventos</strong><span>Algunos eventos de la Liga lo dan como premio.</span></div></li>
        </ol>
      </section>
      <Sorteo liga={liga} dc={dc} miembro={miembro} />
      {miembro && !tiene && ya.length ? (
        <section className="ps-pv-b">
          <div className="ps-blk"><h3>Lo que cobras al toque<small>vas en el nivel {nivel}</small></h3></div>
          <p className="ps-sub">Cuando lo desbloqueas, cobras de una vez lo de los niveles que ya pasaste. A ti te tocarían estos {ya.length}:</p>
          <div className="ps-pv-ya">{ya.map((p) => <Ficha key={p[0]} p={p} prem est="" tienda={150} />)}</div>
        </section>
      ) : null}
      <section className="ps-pv-c">
        <div className="ps-blk"><h3>Todo lo de la fila premium<small>{esp.length} premios + Puntos de Tienda</small></h3></div>
        <ol className="ps-pv-l">{esp.map((p) => (
          <li key={p[0]}><PaseIcono p={p} prem t={34} /><b>{premioLargo(p, true)}</b>
            <small>nivel {p[0]}{PREMIUM_VIVO.has(p[2]) ? '' : ' · PRONTO'}</small></li>
        ))}</ol>
        <p className="ps-boost"><b>+{boost} %</b>de XP en el Pase mientras lo tengas: avanzas más rápido por la pista. Nada de esto suma al ranking.</p>
      </section>
    </div>
  );
}

// ── la barra de XP, «te faltan» y los avisos de arriba ──
function Barra({ P, ahora }) {
  const a = avance(P);
  if (!a) {
    return P.nivel >= P.niveles ? <p className="ps-com">Completaste el Pase{P.salon ? <>: entraste <b>{P.salon}.º</b> al Salón del Pase</> : null}.
      {P.cada ? <> Sigue la cola: cada {num(P.cada[0])} XP, {num(P.cada[1])} Puntos de Tienda (+{P.cola}).</> : null}</p> : null;
  }
  // 🎯 el camino más corto: las Tareas pendientes que más dan, hasta cubrir lo que falta (con la XP doble y el premium)
  const { x } = multAhora(P, ahora);
  const pend = [].concat((P.hoy && P.hoy.tareas) || [], (P.semana && P.semana.tareas) || [], (P.gracia && P.gracia.tareas) || [],
    (P.especiales || []).filter((e) => e.ini <= ahora && ahora < e.fin), P.bienvenida || []).filter((t) => !t.hecha)
    .sort((p, q) => q.xp - p.xp);
  const camino = [];
  let suma = 0;
  for (const t of pend) { if (suma >= a.falta) break; camino.push(t); suma += Math.round(t.xp * x); }
  const ok = suma >= a.falta && camino.length <= 3;
  return (
    <>
      <div className="ps-xpr">
        <b className="ps-xp-l">NIVEL {P.nivel}</b>
        <span className="ps-xp-bar" role="img" aria-label={num(a.lleva) + ' de ' + num(a.de) + ' XP'}><u style={{ width: Math.round((100 * a.lleva) / a.de) + '%' }} /></span>
        <span className="ps-xp-num">{num(a.lleva)} / {num(a.de)} XP</span>
        <b className="ps-xp-s">{P.nivel + 1}</b>
      </div>
      <p className="ps-com">Te faltan <b>{num(a.falta)} XP</b> para el {P.nivel + 1}{ok ? <>: con {camino.map((t, i) => (
        <span key={t.id}>{i ? (i === camino.length - 1 ? ' y ' : ', ') : ''}<b>{t.t}</b> (+{num(Math.round(t.xp * x))})</span>
      ))} ya subes.</> : '.'}</p>
    </>
  );
}

function Avisitos({ P, ahora }) {
  const out = [];
  if (ahora >= CURVA[0] && ahora < CURVA[1]) {
    out.push(<p key="c" className="ps-sube"><b>▲</b>Ajustamos la curva: los niveles del 4 al 8 ahora cuestan menos. Nadie baja de nivel.</p>);
  }
  const { doble } = multAhora(P, ahora);
  const prox = doble || (P.doble || []).find((w) => w[0] > ahora && w[0] - ahora < 21 * DIA);
  if (prox) {
    const d = (t) => fechaET(t, { weekday: 'long', day: 'numeric', month: 'long' });
    out.push(<p key="x2" className={'ps-x2' + (doble ? ' on' : '')}><b>×{prox[2]}</b>{doble
      ? 'Semana de XP doble: lo que cumplas vale el doble hasta el ' + d(prox[1]) + '.'
      : 'Semana de XP doble del Pase: del ' + d(prox[0]) + ' al ' + d(prox[1] - DIA) + '.'}</p>);
  }
  if (P.premium && P.premium.hasta == null && P.boost) out.push(<p key="b" className="ps-x2 prem"><b>+{P.boost} %</b>Tienes el premium: tus Tareas dan más XP.</p>);
  return out.length ? <div className="ps-avisos">{out}</div> : null;
}

const TABS = [['premios', 'Premios'], ['tareas', 'Tareas'], ['premium', 'Premium']];

export function Pase({ liga, dc }) {
  const P0 = usePase(!!dc, true);
  const pub = usePases();
  const compu = useCompu();
  const ahora = useAhora(30000);
  const [tab, setTab] = useState(() => (/premium/.test(String(location.hash)) ? 'premium' : /tareas/.test(String(location.hash)) ? 'tareas' : 'premios'));
  const P = dc && P0 && P0.listo ? P0 : null;
  const miembro = !!(P && P.miembro);
  const cfg = (pub && pub.cfg) || (P ? { premios: P.premios, niveles: P.niveles, temp: P.temp, premium: P.fila_premium } : {});
  const temp = (P && P.temp) || cfg.temp || '';
  const libres = cfg.premios || [];
  const prem = (P && P.fila_premium && P.fila_premium.length ? P.fila_premium : cfg.premium) || [];
  const nivel = miembro ? P.nivel : 0;
  const tiene = !!(P && P.premium && P.premium.hasta == null);
  const tienda = (libres[0] || [])[1] || 150;
  const min = (liga.d.tienda && liga.d.tienda.min) || 500;
  const yo = liga.yo;
  const carta = yo ? liga.cartaUrl(yo.k, 'temporada') : '';
  const fin = (liga.d.fase || {}).termina;
  const dias = fin ? Math.max(0, Math.round((Date.parse(fin) - ahora) / DIA)) : null;
  const cuantos = pub && pub.n ? Object.keys(pub.n).length : 0;
  // el globito de Tareas: las de hoy y de la semana que todavía no hiciste
  const pend = miembro ? [].concat((P.hoy && P.hoy.tareas) || [], (P.semana && P.semana.tareas) || []).filter((t) => !t.hecha).length : 0;
  const irTab = (t) => { setTab(t); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* nada */ } };
  const dra = (liga.svs && liga.svs.DRA) || {};
  const tabs = (
    <nav className="ps-tabs" aria-label="El Pase">
      {TABS.map(([k, t]) => (
        <button key={k} type="button" className={(tab === k ? 'on' : '') + (k === 'premium' ? ' pr' : '')} aria-current={tab === k ? 'page' : undefined}
          onClick={() => setTab(k)}>{t}{k === 'tareas' && pend ? <i>{pend}</i> : null}{k === 'premium' && !tiene ? ' 🔒' : k === 'premium' ? ' ✓' : ''}</button>
      ))}
    </nav>
  );
  // arriba, lo tuyo: tu nivel y tu barra; sin cuenta o sin DRA, qué hacer para tenerlo
  let tuyo;
  if (!dc) {
    tuyo = (
      <div className="ps-sd-cta">
        <b>Entra con tu cuenta de Discord</b><span>y mira tu nivel, tu XP y tus Tareas.</span>
        <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button>
      </div>
    );
  } else if (P0 === undefined) tuyo = <p className="ps-com">Buscando tu Pase…</p>;
  else if (P0 && P0.sinSesion) {
    tuyo = (
      <div className="ps-sd-cta"><b>Tu sesión venció</b><span>Entra de nuevo con Discord y aparece tu nivel.</span>
        <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button></div>
    );
  } else if (!P0) tuyo = <p className="ps-com ps-mal">No pude leer tu Pase. Prueba de nuevo en un rato.</p>;
  else if (!P0.listo) tuyo = <p className="ps-com">El Pase arranca en un rato: en la próxima vuelta del ciclo.</p>;
  else if (!miembro) {
    tuyo = (
      <>
        <p className="ps-sd-p">{libres.length || 30} niveles con premios para tu perfil y tu carta, más <b>{num(libres.reduce((s, p) => s + (p[1] || 0), 0))} Puntos de Tienda</b>. Se sube con Tareas cortas: entrar, seguir a alguien, felicitar.</p>
        <div className="ps-sd-cta">
          <b>Es de los miembros de Discord Rap Español.</b>
          <span>Entra al servidor, verifícate, y tu Pase arranca en el nivel 1, con tu tarjeta de Temporada.</span>
          <span className="ps-acc">{dra.invita ? <a className="btn verde chico" href={dra.invita} target="_blank" rel="noopener noreferrer">Unirme a DRA ↗</a> : null}
            <a className="btn borde chico" href="#/cuenta/verificar">Cómo verificarme</a></span>
        </div>
      </>
    );
  } else tuyo = <><Barra P={P} ahora={ahora} /><Avisitos P={P} ahora={ahora} /></>;
  const yoMini = miembro && yo ? (
    <div className="ps-yo">
      {carta ? <img src={carta} alt="Tu carta de Temporada" /> : null}
      <div><b>{limpio(yo.n)}</b><span>Nivel {nivel} · cobraste {num(P.cobrado)} Puntos de Tienda</span>
        {dias != null ? <span>{liga.temp} · termina en {dias} {dias === 1 ? 'día' : 'días'}</span> : null}</div>
    </div>
  ) : null;
  const skin = miembro && yo ? (
    <div className="ps-skin">
      <span className="ps-sk-t">TU CARTA · {liga.temp}</span>
      {carta ? <img src={carta} alt="Tu carta de Temporada" /> : null}
      <div className="ps-sk-p"><b>{limpio(yo.n)}</b><span>Nivel {nivel} · {num(P.cobrado)} Puntos de Tienda cobrados</span>
        {dias != null ? <span className="ps-sk-d">⏱ La {liga.temp} termina en {dias} {dias === 1 ? 'día' : 'días'}</span> : null}</div>
    </div>
  ) : null;
  // en lo negro: la pista (Premios), lo exclusivo de la T1 (Tareas, al lado de tu carta) o lo que cobras (Premium)
  const arriba = tab === 'premios' ? <Pista libres={libres} prem={prem} nivel={nivel} tiene={tiene} tienda={tienda} min={min} compu={compu} />
    : tab === 'tareas' && compu ? <Exclusivos libres={libres} prem={prem} oscuro /> : null;
  let abajo;
  if (tab === 'premios') {
    abajo = (
      <div className="ps-ab">
        <div className="ps-ab2">
          {!miembro && P ? <LoQueGanarias libres={libres} cuantos={cuantos} /> : null}
          {!tiene ? <CtaPremium onIr={() => irTab('premium')} /> : null}
          <Exclusivos libres={libres} prem={prem} max={compu ? 6 : 8} />
        </div>
        <div className="ps-ab2">
          <EnElPase liga={liga} pub={pub} nivel={nivel} max={compu ? 9 : 6} />
          <Salon liga={liga} lista={pub && pub.salon && pub.salon[temp]} temp={temp} />
        </div>
      </div>
    );
  } else if (tab === 'tareas') {
    abajo = <div className="ps-ab uno"><Tareas P={P} cfg={cfg} miembro={miembro} compu={compu} ahora={ahora} /></div>;
  } else {
    abajo = <div className="ps-ab uno"><Premium liga={liga} dc={dc} P={P} prem={prem} nivel={nivel} miembro={miembro} /></div>;
  }
  return (
    <>
      <section className={'ps-esc' + (skin && compu ? ' con-skin' : '')} aria-label="Pase de rapero">
        {compu ? skin : null}
        <div className="ps-der">
          <div className="ps-cab">
            <div className="ps-t"><span className="tag">PASE DE RAPERO · {liga.temp}</span><h1>Pase de rapero</h1></div>
            {tabs}
          </div>
          {compu ? null : yoMini}
          {tuyo}
          {arriba}
        </div>
      </section>
      {abajo}
      <PopPase P={P} onVer={() => irTab('premios')} />
    </>
  );
}
