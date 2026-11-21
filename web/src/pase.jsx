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
import { DUENO, aQuienSigo, limpio, num } from './liga.js';
import { useModsEstado } from './mods.js';
import { Cara, Carta, Sec, accion } from './piezas.jsx';
import { Franja } from './ranking_a.jsx';
import { avance, multAhora, pasePost, pedirPase, proximoEspecial, refrescarPases, usePase, usePases } from './pase.js';
import { nombreMarco } from './marcos.jsx';
import { PREMIUM_VIVO, PaseIcono, TareaIcono, premioCorto, premioLargo } from './pase_iconos.jsx';
import { PopPase } from './pase_pop.jsx';
import { Fechas, PistaGira } from './pase_gira.jsx';
import { DropDia } from './pase_dia.jsx';
import { Objeto } from './pase_objetos.jsx';
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
// 🕐 un instante, en la zona y las 12/24 h de Ajustes (`fmtFecha()` de comun.js), 18/11/2026: `fechaET` lo clavaba en
// hora del este para todos. Sin comun.js (o si falla), vacío: quien la usa pone su respaldo
const fechaZ = (t, o) => (typeof window !== 'undefined' && window.fmtFecha ? window.fmtFecha(t, Object.assign({}, o)) : '');

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
  // 🔴 Y AHORA PARA (10/11/2026): sin nadie anotado no sale resultado nunca (`sortear()` no sortea a nadie), y esto
  // preguntaba cada 15 s PARA SIEMPRE —también con la pestaña oculta y de madrugada, con el vigía dormido—: un POST sin
  // caché, o sea el Worker y el objeto, cada vez. Ahora: sólo si hay alguien, sólo a la vista, cada vez más espaciado
  // (15 s, 30, 60, hasta 2 min) y hasta media hora después de la hora; quien vuelve a abrir el Pase lo ve igual
  useEffect(() => {
    if (!s || res || ahora < s.cuando || !s.personas) return undefined;
    let espera = 15000, t = null, vivo = true;
    const otra = () => {
      t = setTimeout(() => {
        if (!vivo || Date.now() - s.cuando > 30 * 60000) return;
        if (!document.hidden) traer();
        espera = Math.min(espera * 2, 120000);
        otra();
      }, espera);
    };
    otra();
    return () => { vivo = false; clearTimeout(t); };
  }, [!!s, !!res, ahora >= (s ? s.cuando : Infinity), !!(s && s.personas)]); // eslint-disable-line react-hooks/exhaustive-deps
  const nombre = (k) => (liga.T && liga.T[k] ? limpio(liga.T[k].n) : k);
  // 🎰 la rueda: pasan los que entraron, cada vez más lento, y se para en quien ganó. Una vez por sorteo y por navegador
  const girar = () => {
    if (!res) return;
    const ns = (S.nombres || []).length ? S.nombres : [res.k];
    const calma = typeof document !== 'undefined' && (document.documentElement.classList.contains('calma')
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
  // 🕐 la hora del sorteo en la zona de quien mira (18/11/2026): salía «(hora del este)» para todos, y es un instante,
  // no un horario que se repite. Si fmtFecha no está, la de liga.dia(), que también respeta Ajustes
  const cuandoS = fechaZ(s.cuando, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
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
          {rueda && rueda.fin ? <p className="ps-srt-gano"><span className="ps-tag2">GANÓ</span> <b>{nombre(res.k)}</b>{res.yo ? (res.rol === 1 ? ': ¡eres tú! Ya tienes el rol «Pase Premium» en DRA.' : ': ¡eres tú! El bot te pone el rol «Pase Premium» en DRA en un minuto.') : ' se lleva el rol «Pase Premium» de DRA.'}</p> : null}
          <ul className="ps-srt-d">
            {/* 🔢 el singular (18/11/2026): con uno solo decía «1 entraron, con 1 boletos» */}
            <li><b>{num(res.personas)} {res.personas === 1 ? 'entró' : 'entraron'}</b>, con {num(res.boletos)} {res.boletos === 1 ? 'boleto' : 'boletos'} en total.</li>
            {/* ✋ el ganador elegido a mano por la Liga (21/11/2026, `sorteoDueno()`): sin semilla que repetir */}
            {res.semilla === 'a-mano' ? <li><b>Cómo se eligió</b>: lo eligió la Liga.</li> : <>
            <li><b>Cómo se eligió</b>: la semilla es el SHA-256 del sorteo y de la lista de boletos; el ganador, la semilla dividida por los boletos (lo que sobra). Cualquiera con la lista repite la cuenta.</li>
            <li className="ps-semilla">Semilla: <code>{res.semilla.slice(0, 16)}…</code></li></>}
          </ul>
        </div>
      ) : (
        <div className="ps-srt-a">
          {/* 🕳️ y sin nadie anotado no sale resultado nunca (`sortear()` de avisos.js no sortea a nadie): pasada la hora quedaba
              en «Sorteando…» para siempre (18/11/2026) */}
          <p>{abierto ? <>Se sortea {cuandoS ? <>el <b>{cuandoS}</b></> : <b>{liga.dia(s.cuando)}</b>}, en vivo acá. Cierra en <b className="ps-cd">{reloj(s.cierra - ahora)}</b>.</>
            : ahora < s.cuando ? <>Ya cerró. Se sortea en <b className="ps-cd">{reloj(s.cuando - ahora)}</b>, en vivo acá.</>
              : !s.personas ? <>Nadie entró: este sorteo no se hizo.</> : <>Sorteando…</>}</p>
          {/* 🔢 «1 entró · 1 boletos» (18/11/2026): el primero puede entrar con un solo boleto */}
          <p className="ps-sub">{num(s.personas)} {s.personas === 1 ? 'entró' : 'entraron'} · {num(s.boletos)} {s.boletos === 1 ? 'boleto' : 'boletos'}. Entrar es gratis: <b>1 boleto</b>, y uno más por cada semana con las cinco semanales completas (hasta 3).</p>
          {S.mio ? <p className="ps-srt-ok">✓ Estás adentro con <b>{S.mio} {S.mio === 1 ? 'boleto' : 'boletos'}</b>.</p>
            : abierto ? (dc ? <button type="button" className="btn verde" disabled={ocup || !miembro} onClick={entrar}>{ocup ? '…' : miembro ? 'Entrar gratis' : 'Es de los miembros de DRA'}</button>
              : <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>) : null}
          {msg ? <p className="ps-mal" role="status">{msg}</p> : null}
        </div>
      )}
    </section>
  );
}

// 🖼️ TUS MARCOS (Dlx, 25/10/2026: «se quedan permanentemente en el inventario de uno… así la gente puede personalizar su
// tarjeta poco a poco»): los que ganaste, cuál lleva tu carta y si la de Servidor va con la camiseta o con la cadena
export function TusMarcos({ liga, dc }) {
  const [M, setM] = useState(null);
  const [ocup, setOcup] = useState(false);
  useEffect(() => { if (dc) pasePost('marcos', {}).then((d) => setM(d && d._ok ? d : null)); }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!M || !(M.tienes || []).length) return null;
  const yo = liga.yo;
  const elegir = async (marco, estilo) => {
    setOcup(true);
    const d = await pasePost('marco-elige', { marco, estilo });
    if (d && d._ok) { setM(d); await refrescarPases(); }
    setOcup(false);
  };
  const actual = M.elegido || '';
  return (
    <section className="ps-mk">
      <div className="ps-blk"><h3>Tus marcos<small>son tuyos para siempre</small></h3></div>
      <p className="ps-sub">El marco va alrededor de tus cartas en toda la página. Elige cuál llevar; sin elegir, va el mejor que tengas.</p>
      <div className="ps-mk-op" role="radiogroup" aria-label="El marco de tus cartas">
        {M.tienes.map(([id]) => (
          <button key={id} type="button" role="radio" aria-checked={actual === id} disabled={ocup} className={actual === id ? 'on' : ''}
            onClick={() => elegir(id, M.estilo)}><i className={'ps-mk-c ' + id.split(':')[1]} />{nombreMarco(id)}</button>
        ))}
        <button type="button" role="radio" aria-checked={!actual} disabled={ocup} className={!actual ? 'on' : ''} onClick={() => elegir('', M.estilo)}>El mejor</button>
        <button type="button" role="radio" aria-checked={actual === 'ninguno'} disabled={ocup} className={actual === 'ninguno' ? 'on' : ''} onClick={() => elegir('ninguno', M.estilo)}>Sin marco</button>
      </div>
      <div className="ps-mk-op" role="radiogroup" aria-label="El estilo de tu carta de Servidor">
        <span>Tu carta de Servidor:</span>
        {(M.estilos || ['camiseta', 'cadena']).map((e) => (
          <button key={e} type="button" role="radio" aria-checked={M.estilo === e} disabled={ocup} className={M.estilo === e ? 'on' : ''}
            onClick={() => elegir(actual, e)}>{e === 'cadena' ? 'La cadena' : 'La camiseta'}</button>
        ))}
      </div>
      {yo ? (
        <div className="ps-mk-ver">
          {['temporada', 'competitivo', 'servidor', 'pais'].filter((c) => liga.cartaUrl(yo.k, c)).map((c) => (
            <div key={c} className="ps-mk-c1"><Carta liga={liga} k={yo.k} cual={c} cls="ps-mk-img" abre={false} /></div>
          ))}
        </div>
      ) : null}
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
          {/* 👑 el dueño lo tiene «desde siempre» (`pasePremium()` le da [0, null]): la fecha 0 decía «Desde el 31 de
              diciembre» (18/11/2026). Y la fecha, en la zona de Ajustes */}
          <b>{P.premium.desde ? 'Desde el ' + (fechaZ(P.premium.desde, { day: 'numeric', month: 'long' }) || fechaET(P.premium.desde, { day: 'numeric', month: 'long' })) : 'Desde siempre'}</b>
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
          <li><b>1</b><div><strong>El rol «Pase Premium» de DRA</strong><span>Es lo que lo desbloquea en la T1. Lo tienes o no lo tienes: el Pase se entera solo, en la próxima vuelta del ciclo.</span></div></li>
          <li><b>2</b><div><strong>Se sortea acá</strong><span>Entrar es gratis y se sortea en vivo en esta página. Más abajo.</span></div></li>
          <li><b>3</b><div><strong>Se gana en eventos</strong><span>Algunos eventos de la Liga lo dan como premio.</span></div></li>
        </ol>
      </section>
      {/* 🖼️ los marcos se eligen en tu Inventario (Dlx, 26/10/2026: «debería estar en inventario»): acá, el atajo */}
      {dc ? <p className="ps-sub">🖼️ Tus marcos, tus TAGs y tu carta principal se ponen en <a href="#/inventario">tu Inventario</a>.</p> : null}
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

// ── 🆕 EL PASE COMO EL INICIO (15/11/2026). Dlx: «basarte en cada rincón de inicio… para que remakees el apartado de PASE
// RAPERO»; a la maqueta, «una combinación entre A y B… la pista no debería ocupar el espacio de arriba», y a la C con el
// escenario v2 y el sello Premium, «Sí, todo». Cada pieza viene de una del Inicio:
//   · la PORTADA es el escenario del Inicio: tu nivel, tu XP, tus chips y lo próximo como objeto
//   · el «IR A» pegado arriba (con la búsqueda de un premio) reemplaza las tres pestañas: todo está en una página
//   · la FILA DE CUATRO mini paneles: Hoy, La semana, tu crew y el sorteo
//   · la pista es la PISTA DOBLE (pase_doble.jsx; el escenario de la 5.42 se fue el 15/11), las Tareas tres PANELES de colores, y el Premium y el Salón
//     de a dos, el Salón como «Los que mandan»
const RUTA_MIDE = { fel: '#/publicaciones', cm: '#/publicaciones', promo: '#/publicaciones', voto: '#/publicaciones', vivo: '#/eventos',
  apuesta: '#/eventos', precio: '#/tienda', caza: '#/tienda', sigue: '#/ranking', crew: '#/crews' };
const ESCENA_PASE = '/escenas/dra.webp';

/** 🔢 Un número que sube de a poco hasta `n` (la XP de la portada). Con «menos movimiento», de una */
function useSube(n) {
  const [v, setV] = useState(n);
  const antes = useRef(0);
  useEffect(() => {
    let quieto = true;
    try {
      const r = document.getElementById('inicio-nuevo');
      quieto = matchMedia('(prefers-reduced-motion: reduce)').matches || !!(r && r.shadowRoot && r.shadowRoot.querySelector('.app.calma'));
    } catch (e) { quieto = true; }
    const de = antes.current;
    antes.current = n;
    if (quieto || !(n > de)) { setV(n); return undefined; }
    let raf = 0;
    const t0 = performance.now();
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / 900);
      setV(Math.round(de + (n - de) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return v;
}

/** ✨ Cada sección del cuerpo sube y aparece al llegar a ella (una vez). Sin IntersectionObserver, se ven de una */
function useEntran(ref) {
  useEffect(() => {
    const c = ref.current;
    if (!c || typeof IntersectionObserver === 'undefined') return undefined;
    c.classList.add('pc-anim');
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add('pc-vis'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    for (const x of c.children) if (!x.classList.contains('pc-vis')) io.observe(x);
    return () => io.disconnect();
  });
}

function irA(id) {
  try {
    const r = document.getElementById('inicio-nuevo').shadowRoot.getElementById(id);
    if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { /* nada */ }
}

/** Una Tarea en una fila: su ícono, la barra, la XP y, si se hace en otra página, «Ir» */
function Fila({ x, mide, tag }) {
  const ok = !!x.hecha;
  const lleva = Math.min(x.lleva || 0, x.meta || 1);
  const ruta = !ok && RUTA_MIDE[mide];
  return (
    <li className={'pc-t' + (ok ? ' ok' : '')}>
      <span className="pc-ti"><TareaIcono mide={mide} t={20} /></span>
      <span className="pc-tx"><b>{x.t}</b>{tag ? <em>{tag}</em> : null}
        <span className="pc-bar"><u style={{ width: (ok ? 100 : Math.round((100 * lleva) / (x.meta || 1))) + '%' }} /></span></span>
      <span className="pc-txp">{ok ? '✓' : '+' + num(x.xp)}</span>
      {ruta ? <a className="pc-ir" href={ruta}>Ir</a> : <span className="pc-ir no" aria-hidden="true">{ok ? 'Hecha' : lleva + '/' + x.meta}</span>}
    </li>
  );
}

function TareasC({ P, cfg, miembro, ahora }) {
  const mide = useMemo(() => {
    const m = {};
    for (const t of [].concat(cfg.diarias || [], cfg.semanales || [], cfg.temporada || [], cfg.bienvenida || [], cfg.especiales || [])) m[t[0]] = t[3];
    return m;
  }, [cfg]);
  const [todas, setTodas] = useState(false);
  const sin = (xs) => (xs || []).map(([id, t, d, , meta, xp]) => ({ id, t, d, meta, xp, lleva: 0, hecha: false }));
  const hoy = miembro ? (P.hoy && P.hoy.tareas) || [] : sin(cfg.diarias).slice(0, cfg.por_dia || 2);
  const semana = miembro ? (P.semana && P.semana.tareas) || [] : sin(cfg.semanales);
  const temporada = miembro ? P.temporada || [] : sin(cfg.temporada);
  const gracia = miembro && P.gracia ? P.gracia.tareas : [];
  const bien = miembro ? P.bienvenida || [] : [];
  const esp = (miembro ? P.especiales || [] : []).filter((x) => !x.ini || x.ini <= ahora);
  const finHoy = P && P.hoy ? P.hoy.fin : 0, finSem = P && P.semana ? P.semana.fin : 0;
  const hechas = (xs) => xs.filter((x) => x.hecha).length;
  const tem = todas ? temporada : temporada.slice(0, 6);
  const extra = [].concat(esp.map((x) => [x, 'Especial · ' + (x.fin > ahora ? corto(x.fin - ahora) : 'terminó')]),
    bien.filter((x) => !x.hecha).map((x) => [x, 'Para empezar']));
  return (
    <section className="pc-tareas" id="ps-tareas" aria-label="Tus Tareas">
      <div className="pc-h"><h2>Tus Tareas</h2><small>Se cumplen solas: el Pase se entera de lo que haces en la página, en el bot y en los eventos.</small></div>
      {extra.length ? (
        <ol className="pc-extra">{extra.map(([x, tag]) => <Fila key={'e' + x.id} x={x} mide={mide[x.id]} tag={tag} />)}</ol>
      ) : null}
      <div className="pc-cols">
        <section className="pc-col" style={{ '--c': '#29B298' }}>
          <h3>Hoy<small>{miembro ? hechas(hoy) + ' de ' + hoy.length : 'cada día, ' + (cfg.por_dia || 2)}{finHoy ? ' · cierra en ' + corto(finHoy - ahora) : ''}</small></h3>
          <ol>{hoy.map((x) => <Fila key={x.id} x={x} mide={mide[x.id]} />)}</ol>
        </section>
        <section className="pc-col" style={{ '--c': '#F0428F' }}>
          <h3>La semana<small>{miembro ? hechas(semana) + ' de ' + semana.length : semana.length + ' por semana'}{finSem ? ' · cierra en ' + corto(finSem - ahora) : ''}</small></h3>
          <ol>
            {gracia.map((x) => <Fila key={'g' + x.id} x={x} mide={mide[x.id]} tag="De la semana pasada" />)}
            {semana.map((x) => <Fila key={x.id} x={x} mide={mide[x.id]} />)}
          </ol>
        </section>
        <section className="pc-col" style={{ '--c': '#F5C542' }}>
          <h3>Temporada<small>{miembro ? hechas(temporada) + ' de ' + temporada.length : 'en cualquier orden'}</small></h3>
          <ol>{tem.map((x) => <Fila key={x.id} x={x} mide={mide[x.id]} />)}</ol>
          {!todas && temporada.length > 6 ? <button type="button" className="pc-mas" onClick={() => setTodas(true)}>Ver las {temporada.length}</button> : null}
        </section>
      </div>
      {miembro ? <Crew c={P.crew} ahora={ahora} /> : null}
    </section>
  );
}

/** La fila de cuatro, como en el Inicio: Hoy, La semana, tu crew y el sorteo */
function Cuatro({ P, ahora, tiene, onIr }) {
  const sig = (xs) => (xs || []).filter((x) => !x.hecha).sort((a, b) => (b.lleva || 0) / (b.meta || 1) - (a.lleva || 0) / (a.meta || 1))[0];
  const h = sig(P.hoy && P.hoy.tareas), s = sig(P.semana && P.semana.tareas);
  const cr = P.crew;
  const xs = [
    ['#29B298', 'titulo', h ? 'Hoy · cierra en ' + corto(P.hoy.fin - ahora) : 'Hoy', h ? h.t : 'Hiciste las de hoy', h ? 'La que te falta · +' + num(h.xp) + ' XP' : 'Mañana llegan otras', 'ps-tareas'],
    ['#F0428F', 'reaccion', 'La semana · ' + ((P.semana && P.semana.tareas) || []).filter((x) => x.hecha).length + ' de ' + ((P.semana && P.semana.tareas) || []).length,
      s ? s.t : 'Hiciste las cinco', s ? 'La que más te acerca · +' + num(s.xp) + ' XP' : 'El lunes llegan otras', 'ps-tareas'],
    cr ? ['#5CC8FF', 'insignia', 'Meta de tu crew', num(Math.min(cr.hechas, cr.meta)) + ' de ' + num(cr.meta) + ' Tareas', cr.cobrada ? 'Llegaron: +' + num(cr.xp) + ' XP' : 'Si llegan, +' + num(cr.xp) + ' XP cada uno', 'ps-tareas']
      : ['#5CC8FF', 'insignia', 'Tu crew', 'Súmate a una', 'Entre todos, una meta por semana', null, '#/crews'],
    tiene ? ['#F5C542', 'marco', 'Premium', 'Lo tienes', '+' + (P.boost || 20) + ' % de XP en cada Tarea', 'ps-premium']
      : ['#F5C542', 'caja', 'Sorteo · gratis', 'El Pase premium', 'Entra en un toque, abajo', 'ps-premium'],
  ];
  return (
    <div className="pc-4">
      {xs.map(([c, ob, et, b, sm, id, href]) => (
        // por su destino y no por la etiqueta: «Hoy · cierra en 3 h» cambia cada 30 s y rearmaba el cuadro (revisión del 16/11)
        <a key={(id || href || '') + c} className="pc-pn" style={{ '--c': c }} href={href || '#/pase'} onClick={(e) => { if (id) { e.preventDefault(); if (onIr) onIr(id); else irA(id); } }}>
          <Objeto tipo={ob} t={40} /><span><i>{et}</i><b>{b}</b><small>{sm}</small></span>
        </a>
      ))}
    </div>
  );
}

/** 🏛️ El Salón, como «Los que mandan»: los niveles más altos, y tú. Con el anillo dorado quien tiene el premium */
function SalonC({ liga, pub, nivel, temp, niveles }) {
  const n = (pub && pub.n) || {};
  // 🧑 cualquiera con perfil, no sólo las 200 filas de la tabla (18/11/2026): quien tenía nivel alto y estaba más allá
  // del corte (o no compite) se quedaba afuera del Salón. El nombre, de su clave (`nombreDe()`)
  // 👑 y con nivel (18/11/2026): `pases()` manda al dueño aunque no juegue, con nivel 0 (para su título y su marco).
  // Con la tabla quedaba afuera (es #228); con `existe()` entraba a «los niveles más altos» con un 0
  const todos = Object.entries(n).filter(([k, v]) => v && v[0] > 0 && liga.existe(k)).sort((a, b) => b[1][0] - a[1][0]);
  if (!todos.length) return null;
  const top = todos[0][1][0] || 1;
  const yoK = liga.yo && liga.yo.k;
  const mio = yoK ? todos.findIndex(([k]) => k === yoK) : -1;
  const xs = todos.slice(0, 5).map((x, i) => [x, i]);
  if (mio >= 5) xs.push([todos[mio], mio]);
  const completo = (pub && pub.salon && pub.salon[temp]) || [];
  return (
    <section className="pc-salon" id="ps-salon" aria-label="El Salón del Pase">
      {/* 🏛️ el Salón es el último nivel (`pase_hito WHERE nivel = niveles`): desde el 12/11 el 50, y decía «El 30» (18/11/2026) */}
      <div className="pc-h"><h2>El Salón del Pase</h2><small>{completo.length ? completo.length + (completo.length === 1 ? ' lo completó' : ' lo completaron') : 'El ' + niveles + ' te mete para siempre'}</small></div>
      <ol>{xs.map(([[k, v], i]) => (
        <li key={k} className={k === yoK ? 'yo' : ''}>
          <b className="pc-sp">{i + 1}</b>
          <a href={'#/r/' + encodeURIComponent(k)} className="pc-sn"><Cara liga={liga} k={k} nombre={liga.nombreDe(k)} cls={'cara ps-c40' + (v[3] ? ' pc-oro' : '')} />
            <span>{k === yoK ? 'Tú' : liga.nombreDe(k)}</span></a>
          <span className="pc-sb"><u style={{ width: Math.round((100 * v[0]) / top) + '%' }} /></span>
          <b className="pc-sl">{v[0]}</b>
        </li>
      ))}</ol>
      {nivel && mio < 0 ? <p className="ps-sub">Tú vas en el nivel {nivel}.</p> : null}
    </section>
  );
}

/** 💎 El Premium, de a dos con el Salón: lo que da, en objetos; con él, tus marcos */
function PremiumC({ P, prem, tiene, onTodo }) {
  const boost = (P && P.boost) || 20;
  const muestra = ['marco', 'color', 'reaccion', 'fondo'].map((t) => prem.find((p) => p[2] === t)).filter(Boolean);
  return (
    <section className={'pc-prem' + (tiene ? ' tiene' : '')} id="ps-premium" aria-label="El Premium">
      <i className="pe-esq a" /><i className="pe-esq b" />
      <span className="pc-tag">{tiene ? 'Tienes el Premium' : 'Premium'}</span>
      <h2>{tiene ? 'Tu fila de arriba' : 'La fila de arriba'}</h2>
      <div className="pc-pobj">{muestra.map((p) => <Objeto key={p[0]} p={p} t={56} gris={!tiene} />)}</div>
      <p>{tiene ? <>Tus Tareas dan <b>+{boost} % de XP</b> y cobras la fila de arriba nivel por nivel. Tus marcos se ponen en <a href="#/inventario">tu Inventario</a>.</>
        : <>Marcos de carta, color de nombre, reacciones, fondo y <b>+{boost} % de XP</b>. Al desbloquearlo cobras lo de los niveles que ya pasaste. En la T1 no se compra: se gana.</>}</p>
      {onTodo ? <button type="button" className="btn verde" onClick={onTodo}>{tiene ? 'Ver todo el Premium' : 'Cómo se consigue y el sorteo'}</button> : null}
    </section>
  );
}

// ── 🏁 6.87, EL PASE CON LA ESTRUCTURA DE LA LLAVE (Dlx, 19/11/2026: «sigue remakeando todo», y sobre la pista: «En pc no
// se puede scrollear… hay cosas q no se pueden ver… o hazlo en otra forma… x eso te dije q hagas remake»). Arriba, la
// escena: tu XP, la franja de cuatro números con su porqué, LO PRÓXIMO en la pieza blanca (lo gratis y lo premium del
// nivel que sigue) con la semana del Pase debajo, y al costado el drop del día. Abajo, el papel con cuatro pestañas:
// Premios (la pista, que en la compu ya no se desliza), Tareas, Premium y El Salón. El «Ir a» se fue: eran las pestañas
// 🎤 La gira (Dlx eligió la idea el 19/11): la pista es la gira, las Tareas el setlist del show y el Premium el backstage
// 🎤 la pista sube a la escena, debajo del afiche (Dlx, 19/11/2026: «Necesito que el track del pase este mas arriba»): las
// pestañas son lo de detrás del show
const PESTANAS = [['tareas', 'El setlist'], ['premium', 'Backstage'], ['salon', 'El Salón']];
const PESTANA_DE = { 'ps-premios': 'premios', 'ps-tareas': 'tareas', 'ps-premium': 'premium', 'ps-salon': 'salon' };
const tabDeHash = () => { const h = String(location.hash); return /premium/.test(h) ? 'premium' : /salon/.test(h) ? 'salon' : 'tareas'; };

/** 🏁 La pieza blanca: lo gratis y lo premium del nivel que sigue (o lo primero, o el Pase completo) */
function Proximo({ miembro, nivel, N, libres, prem, tiene, a, onPista }) {
  if (miembro && nivel >= N) {
    return (
      <article className="pa-prox">
        <span className="pa-k">Completaste el Pase</span>
        <h2>Los {N} niveles</h2>
        <p>Estás en el Salón del Pase para siempre. Lo que sigue sumando XP cobra Puntos de Tienda.</p>
      </article>
    );
  }
  const sigN = miembro ? Math.min(N, nivel + 1) : 1;
  const g = libres[sigN - 1];
  const pr = prem.find((x) => x[0] === sigN);
  // sin ser de DRA: lo primero y los dos especiales que vienen después; siendo de DRA, el próximo gran premio si no es éste
  const gran = miembro ? proximoEspecial(libres, sigN) : null;
  const extra = miembro ? (gran ? [gran] : []) : libres.filter((p) => p && p[2] && p[0] > 1).slice(0, 2);
  return (
    <article className="pa-prox">
      <span className="pa-k">{miembro ? 'Lo próximo · nivel ' + sigN : 'Lo que ganarías'}</span>
      <div className="pa-objs">
        {g ? <figure><Objeto p={g} t={96} an /><figcaption><b>{premioLargo(g)}</b><small>{miembro ? 'Gratis' : 'Nivel 1 · gratis'}</small></figcaption></figure> : null}
        {miembro && pr ? <figure className={tiene ? '' : 'lock'}><Objeto p={pr} t={78} gris={!tiene} /><figcaption><b>{premioLargo(pr, true)}</b><small>{tiene ? 'Premium' : 'Premium · con candado'}</small></figcaption></figure> : null}
        {extra.map((p) => <figure key={p[0]} className={miembro ? 'luego' : ''}><Objeto p={p} t={78} /><figcaption><b>{premioLargo(p)}</b><small>{miembro ? 'Después · nivel ' + p[0] : 'Nivel ' + p[0]}</small></figcaption></figure>)}
      </div>
      <p>{miembro && a ? <>Te faltan <b>{num(a.falta)} XP</b>. </> : null}
        <button type="button" className="pa-lnk" onClick={onPista}>Ver los {N} niveles</button></p>
    </article>
  );
}

// 🛠️ «EL PASE EN OTRO NIVEL» DE MODS (20/11/2026, la página Mods): tu Pase dibujado en el nivel `n` (y con o sin Premium),
// para ver los premios, la pista y el CIELO de cada nivel. Es una vista: cobrar sigue preguntándole al objeto, que sabe
// tu nivel de verdad
function conNivelDePrueba(P, n, prem, cfg) {
  const u = (cfg && cfg.umbrales) || [];
  const desde = Number(u[n]) || 0, hasta = Number(u[n + 1]) || 0;
  return Object.assign({}, P, { nivel: n, miembro: true, desde, hasta: hasta > desde ? hasta : null, xp: hasta > desde ? Math.round((desde + hasta) / 2) : desde,
    premium: prem ? Object.assign({}, P.premium || {}, { hasta: null }) : null });
}

export function Pase({ liga, dc }) {
  const P0 = usePase(!!dc, true);
  const pub = usePases();
  const M = useModsEstado();
  const nivelPrueba = dc && String(dc.id) === DUENO && M.pase ? Math.max(1, Math.min(50, Number(M.paseN) || 1)) : 0;
  const compu = useCompu();
  const ahora = useAhora(30000);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(tabDeHash);
  const [fecha, setFecha] = useState(0);
  const cuerpo = useRef(null);
  useEntran(cuerpo);
  const P1 = dc && P0 && P0.listo ? P0 : null;
  const P = P1 && nivelPrueba ? conNivelDePrueba(P1, nivelPrueba, !!M.paseP, pub && pub.cfg) : P1;
  const miembro = !!(P && P.miembro);
  const cfg = (pub && pub.cfg) || (P ? { premios: P.premios, niveles: P.niveles, temp: P.temp, premium: P.fila_premium } : {});
  const temp = (P && P.temp) || cfg.temp || '';
  const libres = cfg.premios || [];
  const prem = (P && P.fila_premium && P.fila_premium.length ? P.fila_premium : cfg.premium) || [];
  const nivel = miembro ? P.nivel : 0;
  const N = libres.length || 50;
  const tiene = !!(P && P.premium && P.premium.hasta == null);
  const fin = (liga.d.fase || {}).termina;
  // 📅 días de calendario en hora del este, como cierreDe() de ligas.jsx y cuentaT1() de lobby.jsx (18/11/2026): restaba
  // la hora a la medianoche UTC de `termina` (el 30/12 a las 7 PM ET), así que decía un día menos que el resto y «0 días»
  // desde el 30/12, y el Math.max lo dejaba en 0 pasado el cierre. El 31/12 dice «Termina hoy»; después, no se dibuja
  const hoyET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(ahora));
  const dias = fin ? Math.round((Date.parse(fin) - Date.parse(hoyET)) / DIA) : null;
  const cuantos = pub && pub.n ? Object.keys(pub.n).length : 0;
  const dra = (liga.svs && liga.svs.DRA) || {};
  const a = miembro ? avance(P) : null;
  const { doble } = miembro ? multAhora(P, ahora) : {};
  const prox = miembro ? doble || (P.doble || []).find((w) => w[0] > ahora && w[0] - ahora < 21 * DIA) : null;
  // 🔀 la pista está arriba; lo demás, a su pestaña y abajo, al papel (los enlaces viejos #/pase/tareas y #/pase/premium
  // abren la suya)
  const ir = (t) => {
    const k = PESTANA_DE[t] || t;
    if (k === 'premios') { irA('ps-premios'); return; }
    setTab(k); setTimeout(() => irA('ps-papel'), 40);
  };
  useEffect(() => {
    if (!/tareas|premium|salon/.test(String(location.hash))) return undefined;
    const t = setTimeout(() => irA('ps-papel'), 400);
    return () => clearTimeout(t);
  }, []);
  // lo de arriba: tu nivel o qué hacer para tenerlo
  let tuyo;
  if (!dc) {
    tuyo = (<><p className="hero-p">Sube de nivel con Tareas cortas, sin necesidad de jugar. El nivel 1 abre tu carta de Temporada.</p>
      <span className="pc-acc"><button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button></span></>);
  } else if (P0 === undefined) tuyo = <p className="hero-p">Buscando tu Pase…</p>;
  else if (P0 && P0.sinSesion) {
    tuyo = (<><p className="hero-p">Tu sesión venció: entra de nuevo con Discord y aparece tu nivel.</p>
      <span className="pc-acc"><button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button></span></>);
  } else if (!P0) tuyo = <p className="hero-p ps-mal">No pude leer tu Pase. Prueba de nuevo en un rato.</p>;
  else if (!P0.listo) tuyo = <p className="hero-p">El Pase arranca en un rato: en la próxima vuelta del ciclo.</p>;
  else if (!miembro) {
    tuyo = (<><p className="hero-p">Es de los miembros de Discord Rap Español: verifícate y tu Pase arranca en el nivel 1, con tu carta de Temporada.</p>
      <span className="pc-acc">{dra.invita ? <a className="btn verde" href={dra.invita} target="_blank" rel="noopener noreferrer">Unirme a DRA ↗</a> : null}
        <a className="btn borde" href="#/cuenta/verificar">Cómo verificarme</a></span></>);
  }
  const hoyH = miembro ? ((P.hoy && P.hoy.tareas) || []) : [];
  const semH = miembro ? ((P.semana && P.semana.tareas) || []) : [];
  const hechas = (xs) => xs.filter((x) => x.hecha).length;
  const xpVe = useSube(a ? a.lleva : 0);
  // 🐉 al costado, el drop del día: sin cuenta o sin ser de DRA, con candado; si tu Pase llegó sin `dia` (el Worker de
  // antes), lo próximo como hasta ahora
  const conDia = !dc || !!(P && (!miembro || P.dia));
  const sigN = Math.min(N, nivel + 1);
  const sigP = libres[sigN - 1];
  // 🏛️ ¿hay alguien en el Salón? sin nadie, la pestaña no se dibuja
  const enSalon = pub && pub.n ? Object.entries(pub.n).filter(([k, v]) => v && v[0] > 0 && liga.existe(k)).length : 0;
  const pestanas = PESTANAS.filter(([k]) => k !== 'salon' || enSalon);
  const tt = pestanas.some(([k]) => k === tab) ? tab : 'tareas';
  // la franja: cuatro números con su porqué
  const franja = [];
  if (miembro) {
    franja.push({ l: 'Tu nivel', v: String(nivel), em: 'de ' + N, c: tiene ? 'con el Premium: +' + (P.boost || 20) + ' % de XP' : 'la fila premium, con candado' });
    franja.push({ l: 'Hoy', v: hechas(hoyH) + ' de ' + hoyH.length, em: 'Tareas', c: P.hoy && P.hoy.fin ? 'cierra en ' + corto(P.hoy.fin - ahora) : 'cada día, dos nuevas' });
    franja.push({ l: 'La semana', v: hechas(semH) + ' de ' + semH.length, em: 'Tareas', c: P.semana && P.semana.fin ? 'cierra en ' + corto(P.semana.fin - ahora) : 'cada lunes, cinco nuevas' });
  } else {
    franja.push({ l: 'Niveles', v: String(N), c: 'cada uno con premio, gratis para los de DRA' });
    franja.push({ l: 'Ya tienen nivel', v: num(cuantos), c: 'en la ' + liga.temp });
    franja.push({ l: 'Premios especiales', v: String(libres.filter((p) => p && p[2]).length), c: 'títulos, insignias, drops y más' });
  }
  if (prox) franja.push({ l: 'XP ×' + prox[2], v: doble ? 'Ahora' : fechaET(prox[0], { day: 'numeric', month: 'short' }), c: doble ? 'hasta el ' + fechaET(prox[1], { day: 'numeric', month: 'long' }) : 'la semana de XP doble' });
  else if (dias != null && dias >= 0) franja.push({ l: 'Termina la ' + liga.temp, v: dias === 0 ? 'Hoy' : String(dias), em: dias === 0 ? '' : dias === 1 ? 'día' : 'días', c: 'lo de la pista se cobra hasta el último día' });
  const contar = (k) => (k === 'tareas' ? (miembro ? hechas(hoyH) + ' de ' + hoyH.length + ' hoy' : 'cómo se sube') : k === 'premium' ? (tiene ? 'lo tienes' : 'con candado') : String(enSalon));
  return (
    <>
      {nivelPrueba ? <p className="pa-mods" role="status">Mods: tu Pase en el nivel {nivelPrueba}{M.paseP ? ', con Premium' : ''}. Es una vista: lo que cobres sigue siendo lo de tu nivel de verdad.</p> : null}
      <div className="escena pa-esc" style={{ '--esc': 'url("' + ESCENA_PASE + '")', '--mo-c': '#F5C542', '--mo-o': 0.9, '--mo-c2': '#29B298' }}>
        <span className="pa-foto" aria-hidden="true" />
        <section className="pa-cab rka" aria-label="Tu Pase">
          <div className="pa-cabeza">
          <div className="pa-tx" data-tuto="ps-cab">
            <span className="tag">PASE DE RAPERO · {liga.temp}{miembro ? ' · NIVEL ' + nivel + ' DE ' + N : ''}</span>
            {a ? <h1 className="hero-ev">Te faltan {num(a.falta)} XP <span>para el nivel {nivel + 1}</span></h1>
              : <h1 className="hero-ev">{miembro && nivel >= N ? <>Completaste <span>el Pase</span></> : 'Pase de rapero'}</h1>}
            {a ? (
              <div className="pc-xpw">
                <div className="pc-xp"><span className="pc-xpb" role="img" aria-label={num(a.lleva) + ' de ' + num(a.de) + ' XP'}><u style={{ width: Math.round((100 * a.lleva) / a.de) + '%' }}><i className="pc-raya" /></u></span>
                  <b>{num(xpVe)} / {num(a.de)} XP</b></div>
              </div>
            ) : null}
            {miembro ? <span className="pc-acc"><button type="button" className="btn verde" onClick={() => ir('tareas')}>Ver mis Tareas</button>
              {!tiene ? <button type="button" className="btn borde" onClick={() => ir('premium')}>El Premium</button> : null}</span> : tuyo}
            {/* 🔎 el buscador con los botones, no en su propia fila: la pista queda más arriba */}
            <label className="pc-busca pa-busca">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></svg>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Busca un premio: drop, título, nivel 25…" aria-label="Buscar un premio o un nivel del Pase" enterKeyHint="search" />
            </label>
          </div>
          {/* 🗓️ el afiche de la gira: las cinco fechas, de la plaza al estadio */}
          <div className="pa-afiche"><span className="pa-afiche-k">Gira {liga.temp} · {N} niveles</span>
            <Fechas nivel={nivel} N={N} miembro={miembro} onIr={(i) => { setFecha(i); ir('premios'); }} /></div>
          </div>
          {/* 🎟️ la gira, enseguida: la fecha con sus diez niveles */}
          <div className="pa-gira">
            <PistaGira libres={libres} prem={prem} nivel={nivel} tiene={tiene} falta={a ? a.falta : 0} frac={a ? a.lleva / a.de : 0} q={q} miembro={miembro} fecha={fecha} setFecha={setFecha} />
          </div>
          <Franja items={franja} />
          <div className="rka-dos pa-dos">
            <div className="rka-izq">
              <Proximo miembro={miembro} nivel={nivel} N={N} libres={libres} prem={prem} tiene={tiene} a={a} onPista={() => ir('premios')} />
              {miembro ? <div className="rka-caja pa-sem"><h2 className="rka-h">Tu semana en el Pase<small>lo que más te acerca</small></h2><Cuatro P={P} ahora={ahora} tiene={tiene} onIr={ir} /></div> : null}
            </div>
            <div className="rka-rail">
              {conDia ? <DropDia P={P} miembro={miembro} dc={dc} invita={dra.invita} /> : (
                <div className="rka-caja pc-prox">
                  <span className="k">{miembro ? 'Lo próximo · nivel ' + sigN : 'Lo primero · nivel 1'}</span>
                  {sigP ? <Objeto p={miembro ? sigP : libres[0]} t={compu ? 120 : 92} an /> : null}
                  <b>{sigP ? premioLargo(miembro ? sigP : libres[0]) : ''}</b>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      <Sec id="ps-papel" titulo="Detrás del show" extra="rka-papel pa-papel">
        <div className="rka-pes pa-pes" role="tablist" aria-label="Qué ver del Pase" data-tuto="ps-tabs">
          {pestanas.map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={tt === k} className={tt === k ? 'on' : ''} onClick={() => setTab(k)}>{t}<small>{contar(k)}</small></button>
          ))}
        </div>
        <div className="pc-cuerpo pa-cuerpo" ref={cuerpo}>
          {tt === 'tareas' ? <>
            {!miembro && P ? <LoQueGanarias libres={libres} cuantos={cuantos} /> : null}
            {miembro ? <Avisitos P={P} ahora={ahora} /> : null}
            <div className="pa-setlist"><TareasC P={P} cfg={cfg} miembro={miembro} ahora={ahora} /></div>
            {miembro ? <Avisos P={P} /> : null}
          </> : null}
          {tt === 'premium' ? <>
            <div className="pa-backstage"><PremiumC P={P} prem={prem} tiene={tiene} /></div>
            <div className="pc-todo"><Premium liga={liga} dc={dc} P={P} prem={prem} nivel={nivel} miembro={miembro} /></div>
          </> : null}
          {tt === 'salon' ? <div className="pa-muro"><SalonC liga={liga} pub={pub} nivel={nivel} temp={temp} niveles={cfg.niveles || N} /></div> : null}
          <Exclusivos libres={libres} prem={prem} max={compu ? 8 : 6} />
        </div>
      </Sec>
      <PopPase P={P} onVer={() => ir('premios')} />
    </>
  );
}
