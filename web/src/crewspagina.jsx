// 👥 LA PÁGINA DE LAS CREWS (Dlx, 19/10/2026: «hacer una propia… que no sea sólo RANKING crews sino todo lo que conlleva
// crews… unirse a crews… ver nivel de actividad… si hay amigos de Discord… su tier… su nivel competitivo… qué requisitos
// hay… mirá cómo hacen los diferentes juegos para unirse a clubs, gremios, alianzas»).
//
// Lo que se tomó de los juegos (el research, `research_notes/Pagina de crews/`, fuera del repo):
//   · la ficha es casi igual en todos (Clash, Brawl Stars, FC, WoW): logo, nombre y sigla, `14/20`, el nivel (acá el
//     tier), cómo se entra y qué pide, con un VERBO en el botón. Lo que casi nadie muestra y acá sí: si está VIVA esta
//     semana («9 de 14 jugaron») y A QUIÉN CONOCÉS adentro (Backstrom, KDD 2006: entrar es más probable con amigos adentro)
//   · el orden por defecto es «Para vos», nunca el ranking (Supercell, WoW): las que te aceptan, vivas, con gente que
//     conocés; las llenas, cerradas o dormidas, abajo. Y «Te aceptan» prendido para quien busca crew (Clash of Clans)
//   · contra las crews muertas (Ducheneaut, CHI 2007: el 54% de los gremios desaparece en 5 meses): las que no jugaron
//     en 3 semanas bajan del orden por defecto, y las NUEVAS se ven con su urgencia —sumarse es rescatarlas—
//
// ⚠️ «AMIGOS DE DISCORD» NO SE PUEDE: Discord no le da a una app la lista de amigos de nadie. Lo más parecido que hay es
// la gente que SEGUÍS en la página, la de TU servidor y la de TU país, y eso es lo que se muestra.
// ⚠️ NINGÚN NÚMERO SE INVENTA ACÁ: el tier y la semana vienen de bot/crews_tiers.py (payload), la gente y lo que pide
// cada crew del objeto (crews.js), y la letra, el país y el último evento de cada uno, de la tabla de la temporada.
import { useMemo, useState } from 'react';
import { limpio, norm, num } from './liga.js';
import { Bandera, Cara, accion } from './piezas.jsx';
import { CrewCirculo } from './arriba.jsx';
import { accionCrew, errorCrew, useCrews } from './crews.js';
import { SemanaCrew, TierChip } from './crewpanel.jsx';
import CSS_PAGINA from './css/crews.css?inline';
import { usarCss } from './css.js';

// 🎨 su CSS, con su pedazo (web/src/css/crews.css)
usarCss('crews', CSS_PAGINA);

const DIA = 86400000;
const enlaceCrew = (id) => '#/crew/' + encodeURIComponent(id);
const ENTRA = { abierta: ['Abierta', 'Entra quien quiera'], pedido: ['Con pedido', 'El Líder acepta'], invitacion: ['Por invitación', 'Sólo si te invitan'] };
// qué tan viva está: por cuántos de la crew jugaron esta semana y cuándo jugó el último
const ACT = [['Dormida', 'Nadie jugó en las últimas 3 semanas'], ['Tranquila', 'Jugaron en las últimas 3 semanas'],
  ['Activa', 'Alguien jugó esta semana'], ['Muy activa', 'Jugaron 3 o más esta semana']];

/** El orden de las letras, de la peor a la mejor, del payload (`rangos`): acá no se escribe ninguna. */
const ordenLetras = (liga) => (liga.d.rangos || []).map((r) => r.r).reverse();

/** Todo lo que la página dice de cada crew, armado una vez. */
function armar(liga, todas, mia) {
  const T = liga.d.crews_tiers && liga.d.crews_tiers.nombres ? liga.d.crews_tiers : null;
  const pay = new Map((liga.d.crews || []).map((c) => [c.clave || c.crew, c]));
  const yo = liga.yo;
  const sigo = new Set(liga.sigue || []);
  const L = ordenLetras(liga);
  const max = (todas && todas.max) || 20;
  const miId = mia && mia.crew ? mia.crew.id : '';
  const invitado = new Set(((mia && mia.inv) || []).map((x) => x.crew));
  return ((todas && todas.crews) || []).map((c) => {
    const ks = (c.gente || []).map((g) => g[0]);
    const filas = ks.map((k) => liga.T[k]).filter(Boolean);
    const [tier, semPts, jugaron] = (T && T.crews && T.crews[c.id]) || [0, 0, 0];
    const ult = filas.map((f) => (f.ult && f.ult[0]) || '').filter(Boolean).sort().pop() || '';
    const dias = ult ? Math.max(0, Math.floor((liga.ahora - new Date(ult + 'T16:00:00Z')) / DIA)) : null;
    const act = jugaron >= 3 ? 3 : (jugaron >= 1 || (dias !== null && dias <= 7)) ? 2 : (dias !== null && dias <= 21) ? 1 : 0;
    // el nivel competitivo: la letra del medio de los que tienen letra (la tiene quien llegó a 10 eventos)
    const idx = filas.map((f) => L.indexOf(f.rg)).filter((i) => i >= 0).sort((a, b) => a - b);
    const letra = idx.length ? L[idx[Math.floor((idx.length - 1) / 2)]] : '';
    const mejor = idx.length ? L[idx[idx.length - 1]] : '';
    const ccs = [...new Set(filas.map((f) => f.cc).filter(Boolean))];
    const conozco = ks.filter((k) => sigo.has(k));
    const deMiSv = yo && yo.sv ? filas.filter((f) => f.sv === yo.sv && f.k !== yo.k).length : 0;
    const deMiPais = yo && yo.cc ? filas.filter((f) => f.cc === yo.cc && f.k !== yo.k).length : 0;
    const req = c.req || { rg: '', ev: 0 };
    // lo que te falta para lo que pide: con tu fila de la temporada (el objeto lo vuelve a mirar al pedir)
    const falta = [];
    if (req.rg && L.indexOf(yo ? yo.rg : '') < L.indexOf(req.rg)) falta.push('letra ' + req.rg);
    if (req.ev && ((yo && yo.ev) || 0) < req.ev) falta.push(req.ev + ' eventos');
    const llena = ks.length >= max;
    const puede = !llena && (c.entrada !== 'invitacion' || invitado.has(c.id)) && (!falta.length || invitado.has(c.id));
    // 🔢 «Recomendadas»: las que te aceptan, vivas, con gente que conocés; un empujón a las nuevas que buscan gente
    const reco = (puede ? 30 : 0) + act * 10 + Math.min(conozco.length, 3) * 12 + Math.min(deMiSv, 3) * 6 + Math.min(deMiPais, 3) * 4
      + (c.vence ? 8 : 0) + Math.min(jugaron, 5) * 2 + tier * 3 + (invitado.has(c.id) ? 100 : 0) - (act === 0 ? 40 : 0) - (llena ? 20 : 0);
    const p = pay.get(c.id) || {};
    // el logo: el que subió el Líder (R2) o, en las de la Liga, el del repo (`logos/crews/`, del payload)
    const logo = c.logo || p.logo || '';
    return { c, logo, ks, filas, tier, semPts, jugaron, dias, act, letra, mejor, ccs, conozco, deMiSv, deMiPais, req, falta, llena, puede,
      reco, mia: c.id === miId, invitado: invitado.has(c.id), pts: p.pts || 0, max };
  });
}

const FILTROS = [['', 'Todas'], ['lugar', 'Te aceptan'], ['abiertas', 'Abiertas'], ['activas', 'Activas'], ['conozco', 'Con gente que seguís'],
  ['servidor', 'De tu servidor'], ['pais', 'De tu país'], ['nuevas', 'Nuevas']];
const ORDENES = [['reco', 'Para vos'], ['activas', 'Más activas esta semana'], ['tier', 'Tier más alto'], ['gente', 'Más gente'],
  ['puntos', 'Más puntos en la temporada'], ['nuevas', 'Las más nuevas']];

export function CrewsPagina({ liga, dc }) {
  const { todas, mia } = useCrews();
  const [filElegido, setFil] = useState(null);
  const [orden, setOrden] = useState('reco');
  const [q, setQ] = useState('');
  const T = liga.d.crews_tiers && liga.d.crews_tiers.nombres ? liga.d.crews_tiers : null;
  const xs = useMemo(() => armar(liga, todas, mia), [liga, todas, mia]);
  const yo = liga.yo;
  // «Te aceptan» prendido para quien busca crew (como «sólo clanes a los que puedo entrar» de Clash of Clans)
  const fil = filElegido !== null ? filElegido : dc && mia && mia.de && !mia.crew ? 'lugar' : '';
  const nq = norm(q).trim();
  const lista = xs.filter((x) => !x.mia)
    .filter((x) => !nq || norm(x.c.nombre).includes(nq) || norm(x.c.sigla || '').includes(nq))
    .filter((x) => (fil === 'lugar' ? x.puede : fil === 'abiertas' ? x.c.entrada === 'abierta' && !x.llena : fil === 'activas' ? x.act >= 2
      : fil === 'conozco' ? x.conozco.length > 0 : fil === 'servidor' ? x.deMiSv > 0 : fil === 'pais' ? x.deMiPais > 0
        : fil === 'nuevas' ? !!x.c.vence : true))
    .sort((a, b) => (orden === 'activas' ? (b.jugaron - a.jugaron) || (b.semPts - a.semPts)
      : orden === 'tier' ? (b.tier - a.tier) || (b.semPts - a.semPts)
        : orden === 'gente' ? b.ks.length - a.ks.length
          : orden === 'puntos' ? b.pts - a.pts
            : orden === 'nuevas' ? (b.c.creada || 0) - (a.c.creada || 0)
              : b.reco - a.reco) || (b.pts - a.pts));
  const mias = xs.find((x) => x.mia);
  const filtros = FILTROS.filter(([v]) => (v === 'servidor' ? yo && yo.sv : v === 'pais' ? yo && yo.cc : v === 'conozco' ? (liga.sigue || []).length : true));
  const enCrews = xs.reduce((a, x) => a + x.ks.length, 0);
  const aceptan = xs.filter((x) => !x.mia && x.puede).length;
  const activas = xs.filter((x) => x.act >= 2).length;
  return (
    <>
      <div className="escena pub-esc crw-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.85 }}>
        <section className="pub-cab crw-cab">
          <span className="tag">CREWS · {liga.temp}</span>
          <h1 className="hero-ev largo">Crews</h1>
          <p className="hero-p">Armá la tuya o sumate a una. Cada lunes, como en el fútbol, cada crew sube, baja o se mantiene de tier por lo que jugó su gente.</p>
          <ul className="crw-num">
            <li><b>{num(xs.length)}</b><span>crews</span></li>
            <li><b>{num(enCrews)}</b><span>raperos en crews</span></li>
            <li><b>{num(activas)}</b><span>activas esta semana</span></li>
            <li><b>{num(aceptan)}</b><span>{dc ? 'te aceptan' : 'aceptan gente'}</span></li>
          </ul>
        </section>
      </div>
      <div className="pub-t2 crw-t2">
        <main className="pub-feed crw-main">
          <TuCrew liga={liga} dc={dc} mia={mia} x={mias} T={T} />
          <div className="crw-busca">
            <input type="search" className="cw-busca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscá una crew por nombre o sigla"
              aria-label="Buscar una crew" enterKeyHint="search" />
            <label className="crw-orden">Ordenar
              <select className="cw-sel" value={orden} onChange={(e) => setOrden(e.target.value)}>
                {ORDENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
          </div>
          <nav className="pub-fil crw-fil" aria-label="Qué crews ver">
            {filtros.map(([v, t]) => <button type="button" key={v || 'todas'} className={fil === v ? 'on' : ''} aria-pressed={fil === v} onClick={() => setFil(v)}>{t}</button>)}
          </nav>
          {!todas ? <p className="pub-tx">Cargando las crews…</p>
            : lista.length ? <ul className="crw-lista">{lista.map((x) => <li key={x.c.id}><Ficha liga={liga} x={x} T={T} dc={dc} mia={mia} /></li>)}</ul>
              : <p className="pub-tx">Ninguna crew con eso. Probá con otro filtro{dc ? ', o armá la tuya' : ''}.</p>}
          <p className="crw-rk"><a className="te-link" href="#/ranking/crews">Ver el ranking de crews de la temporada</a></p>
        </main>
        <aside className="pub-der crw-der">
          <div className="pub-der-in">
            <Tiers T={T} xs={xs} />
            <ComoFunciona todas={todas} T={T} />
          </div>
        </aside>
      </div>
    </>
  );
}

/** Arriba de todo: tu crew (con su semana) o, sin crew, armar una; y las invitaciones que tenés. */
function TuCrew({ liga, dc, mia, x, T }) {
  if (!dc) {
    return (
      <section className="crw-tu" aria-label="Tu crew">
        <p className="crw-tu-t">Entrá con Discord para armar tu crew o sumarte a una.</p>
        <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>
      </section>
    );
  }
  if (!mia) return <section className="crw-tu"><p className="crw-tu-t">Mirando tu crew…</p></section>;
  const inv = mia.inv || [];
  if (x) {
    return (
      <section className="crw-tu mia" aria-label="Tu crew">
        <a className="crw-tu-c" href={enlaceCrew(x.c.id)}>
          <CrewCirculo c={{ logo: x.logo, crew: x.c.nombre }} cls="crw-logo" />
          <span><small>TU CREW</small><b>{limpio(x.c.nombre)}</b>{x.c.sigla ? <em>[{x.c.sigla}]</em> : null}</span>
          <TierChip n={x.tier} T={T} chico />
        </a>
        <p className="crw-tu-s">Esta semana: <b>{num(x.semPts)} puntos</b> · {x.jugaron === 1 ? 'jugó 1' : 'jugaron ' + x.jugaron} de {x.ks.length}</p>
        {T && T.sube[x.tier] ? <p className="crw-tu-s">{x.semPts >= T.sube[x.tier] ? '✅ Si cierra así, el lunes sube a ' + T.nombres[x.tier + 1]
          : 'Para subir a ' + T.nombres[x.tier + 1] + ' el lunes le faltan ' + num(T.sube[x.tier] - x.semPts) + ' puntos'}
          {T.juegan[x.tier + 1] > 1 ? ' (y que jueguen ' + T.juegan[x.tier + 1] + ')' : ''}.</p> : null}
        <SemanaCrew c={x.c} rol={mia.rol} />
        {inv.length ? <p className="crw-tu-s">📨 Te invitaron a {inv.map((i) => limpio(i.nombre)).join(', ')}: <a className="te-link" href="#/cuenta/crew">verlo en Mi crew</a></p> : null}
      </section>
    );
  }
  return (
    <section className="crw-tu" aria-label="Tu crew">
      <p className="crw-tu-t">Todavía no tenés crew.</p>
      {inv.length ? <p className="crw-tu-s">📨 Te invitaron a {inv.map((i) => <a key={i.crew} className="te-link" href={enlaceCrew(i.crew)}>{limpio(i.nombre)}</a>)
        .reduce((a, b) => [a, ', ', b])}.</p> : null}
      <div className="cw-fila">
        <a className="btn verde" href="#/cuenta/crew">Armar la mía · {num(mia.precio ?? 2500)}</a>
        <span className="cw-nota">o sumate a una de abajo</span>
      </div>
    </section>
  );
}

/** Una crew en la lista: lo que hace falta para elegir, de un vistazo. */
function Ficha({ liga, x, T, dc, mia }) {
  const c = x.c;
  const [e, d] = ENTRA[c.entrada] || ENTRA.pedido;
  const L = liga.d.rangos || [];
  const color = (r) => (L.find((y) => y.r === r) || {}).color || 'var(--gris)';
  const faltan = c.vence ? Math.max(0, 3 - x.ks.length) : 0;
  const caras = x.filas.slice().sort((a, b) => (a.pos || 1e9) - (b.pos || 1e9)).slice(0, 5);
  const conocidos = x.conozco.map((k) => limpio((liga.T[k] || {}).n || k));
  return (
    <article className={'crw-ficha' + (x.invitado ? ' inv' : '')}>
      <a className="crw-top" href={enlaceCrew(c.id)}>
        <CrewCirculo c={{ logo: x.logo, crew: c.nombre }} cls="crw-logo" />
        <span className="crw-n"><b>{limpio(c.nombre)}</b>{c.sigla ? <em>[{c.sigla}]</em> : null}</span>
        <TierChip n={x.tier} T={T} chico />
      </a>
      {c.desc ? <p className="crw-d">{c.desc}</p> : null}
      <ul className="crw-datos">
        <li title="Gente en la crew"><span><b>{x.ks.length}</b>/{x.max}</span></li>
        <li className={'crw-e ' + c.entrada} title={d}>{e}</li>
        <li className={'crw-act a' + x.act} title={ACT[x.act][1]}><i aria-hidden="true" />{ACT[x.act][0]}</li>
        {x.letra ? <li title={'La letra del medio de los que tienen letra' + (x.mejor ? '; la mejor, ' + x.mejor : '')}>Nivel <b className="crw-rg" style={{ background: color(x.letra) }}>{x.letra}</b></li>
          : <li title="Nadie de la crew llegó todavía a 10 eventos">Sin letras</li>}
      </ul>
      <div className="crw-gente">
        <span className="crw-caras">{caras.map((f) => <Cara key={f.k} liga={liga} k={f.k} nombre={f.n} cls="cara crw-cara" lazy />)}</span>
        {x.ccs.length ? <span className="crw-flags">{x.ccs.slice(0, 4).map((cc) => <Bandera key={cc} cc={cc} cls="crw-flag" />)}</span> : null}
      </div>
      <p className="crw-semana">{x.jugaron ? <><b>{x.jugaron} de {x.ks.length}</b> {x.jugaron === 1 ? 'jugó' : 'jugaron'} esta semana · {num(x.semPts)} pts</>
        : x.dias !== null ? (x.dias === 0 ? 'Jugaron hoy' : 'Nadie jugó esta semana · el último, hace ' + x.dias + (x.dias === 1 ? ' día' : ' días'))
          : 'Nadie de la crew jugó todavía en la temporada'}</p>
      {conocidos.length || x.deMiSv || x.deMiPais ? (
        <p className="crw-conoce">{x.conozco.slice(0, 3).map((k) => <Cara key={k} liga={liga} k={k} nombre={(liga.T[k] || {}).n || k} cls="cara crw-cara chica" lazy />)}
          {[conocidos.length ? 'Seguís a ' + conocidos.slice(0, 2).join(' y ') + (conocidos.length > 2 ? ' y ' + (conocidos.length - 2) + ' más' : '') : '',
          x.deMiSv ? x.deMiSv + ' de tu servidor' : '', x.deMiPais ? x.deMiPais + ' de tu país' : ''].filter(Boolean).join(' · ')}</p>
      ) : null}
      {x.req.rg || x.req.ev ? (
        <p className={'crw-req' + (x.falta.length ? ' no' : ' si')}>Pide {[x.req.rg ? 'letra ' + x.req.rg + ' o más' : '', x.req.ev ? x.req.ev + ' eventos' : ''].filter(Boolean).join(' y ')}
          {dc && liga.yo ? (x.falta.length ? ' · te falta ' + x.falta.join(' y ') : ' · ✓ cumplís') : ''}</p>
      ) : null}
      {faltan ? <p className="crw-nueva">NUEVA · busca {faltan === 1 ? '1 persona más' : faltan + ' personas más'}
        {c.vence > liga.ahora ? ' · ' + (Math.ceil((c.vence - liga.ahora) / DIA) <= 1 ? 'último día' : 'quedan ' + Math.ceil((c.vence - liga.ahora) / DIA) + ' días') : ''}</p> : null}
      <div className="crw-pie">
        <Unirme x={x} dc={dc} mia={mia} />
        <a className="btn borde2 chico" href={enlaceCrew(c.id)}>Ver la crew</a>
      </div>
    </article>
  );
}

/** El botón de cada ficha: unirse, pedir, aceptar la invitación… o por qué no. El objeto vuelve a mirar todo. */
function Unirme({ x, dc, mia }) {
  const [va, setVa] = useState(false);
  const [msg, setMsg] = useState('');
  const c = x.c;
  if (!dc || !mia || !mia.de) return null;
  const pedi = (mia.ped || []).some((p) => p.crew === c.id);
  const hacer = (cuerpo, ok) => {
    if (va) return;
    setVa(true); setMsg('');
    accionCrew(cuerpo).then((j) => { setVa(false); if (j && j.ok) setMsg(typeof ok === 'function' ? ok(j) : ok); else if (j) setMsg(errorCrew(j)); })
      .catch(() => { setVa(false); setMsg('No pude. Probá de nuevo en un rato.'); });
  };
  let b;
  if (x.invitado) {
    b = <button type="button" className="btn verde chico" disabled={va || (mia.crew && mia.rol === 'lider')}
      onClick={() => hacer({ accion: 'responder', crew: c.id, si: true }, (j) => '¡Entraste!' + (j.dejo ? ' Dejaste ' + limpio(j.dejo) + '.' : ''))}>
      {mia.crew ? 'Aceptar y cambiarme' : 'Aceptar la invitación'}</button>;
  } else if (mia.crew) b = null;
  else if (pedi) b = <small className="crw-ya">Pediste entrar</small>;
  else if (mia.espera_ms > 0) {
    const f = new Date(Date.now() + mia.espera_ms).toLocaleDateString('es', { day: 'numeric', month: 'numeric' });
    b = <small className="crw-ya">Podés entrar desde el {f}</small>;
  }
  else if (x.llena) b = <small className="crw-ya">Llena</small>;
  else if (c.entrada === 'invitacion') b = <small className="crw-ya">Sólo por invitación</small>;
  else if (x.falta.length) b = <small className="crw-ya">No llegás a lo que pide</small>;
  else {
    b = <button type="button" className="btn verde chico" disabled={va}
      onClick={() => hacer({ accion: 'pedir', crew: c.id }, c.entrada === 'abierta' ? '¡Entraste!' : 'Pedido enviado: te avisamos cuando te acepten.')}>
      {c.entrada === 'abierta' ? 'Unirme' : 'Pedir entrar'}</button>;
  }
  return <>{b}{msg ? <small role="status" className="cw-msg crw-msg">{msg}</small> : null}</>;
}

/** La escalera de tiers: cuántas crews hay en cada uno y qué hace falta, como las ligas de clanes de los juegos. */
function Tiers({ T, xs }) {
  if (!T) return null;
  const cuenta = T.nombres.map((_, i) => xs.filter((x) => x.tier === i).length);
  return (
    <section className="pub-bloque crw-bloque" aria-labelledby="crw-tiers">
      <h2 className="evp-h2" id="crw-tiers">Los tiers</h2>
      <ol className="crw-escalera">{T.nombres.map((n, i) => i).reverse().map((i) => (
        <li key={i}>
          <TierChip n={i} T={T} chico />
          <span>{T.sube[i] ? 'Sube con ' + num(T.sube[i]) + (T.juegan[i + 1] > 1 ? ' · ' + T.juegan[i + 1] + ' que jueguen' : '') : 'El más alto'}</span>
          <b>{cuenta[i]}</b>
        </li>
      ))}</ol>
      <p className="cw-nota">Cada lunes a las 11 AM (hora del este), por los puntos que sumó la gente de la crew en la semana. Un tier por semana, para arriba o para abajo. En {T.nombres[T.tarjeta]} se desbloquea la tarjeta de la crew.</p>
    </section>
  );
}

function ComoFunciona({ todas, T }) {
  const precio = (todas && todas.precio) ?? 2500;
  return (
    <section className="pub-bloque crw-bloque" aria-labelledby="crw-como">
      <h2 className="evp-h2" id="crw-como">Cómo funcionan</h2>
      <ul className="crw-como">
        <li><b>Armar una</b>: estar verificado, {num(precio)} Puntos de Tienda, nombre, sigla, logo y descripción. Hasta {(todas && todas.max) || 20} raperos.</li>
        <li><b>La primera semana</b>: una crew nueva tiene 7 días para sumar 2 personas, o se borra.</li>
        <li><b>Cómo se entra</b>: abierta (entra quien quiera), con pedido (acepta el Líder o un Colíder) o sólo por invitación. Algunas piden una letra o eventos mínimos.</li>
        <li><b>Los rangos</b>: Líder, Colíder, Veterano y Miembro. El Colíder casi todo, el Veterano invita.</li>
        <li><b>Cambiarse</b>: si te invitan estando en otra, podés cambiarte; después esperás 7 días para moverte de nuevo.</li>
        {T ? <li><b>Los tiers</b>: de {T.nombres[0]} a {T.nombres[T.nombres.length - 1]}, cada lunes por lo que jugó la crew.</li> : null}
      </ul>
    </section>
  );
}
