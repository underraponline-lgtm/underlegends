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
import { Bandera, Cara, ConMas, Vacio, accion } from './piezas.jsx';
import { CrewCirculo } from './arriba.jsx';
import { escudoDe, tinta } from './escudo.jsx';
import { accionCrew, armarCrews as armar, errorCrew, useCrews } from './crews.js';
import { Anillo, CrearCrew, SemanaCrew, TierChip } from './crewpanel.jsx';
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

const FILTROS = [['', 'Todas'], ['lugar', 'Te aceptan'], ['abiertas', 'Abiertas'], ['activas', 'Activas'], ['conozco', 'Con gente que sigues'],
  ['servidor', 'De tu servidor'], ['pais', 'De tu país'], ['nuevas', 'Nuevas']];
const ORDENES = [['reco', 'Para ti'], ['activas', 'Más activas esta semana'], ['tier', 'Tier más alto'], ['gente', 'Más gente'],
  ['puntos', 'Más puntos en la temporada'], ['nuevas', 'Las más nuevas']];

export function CrewsPagina({ liga, dc, qs }) {
  const { todas, mia } = useCrews();
  const [filElegido, setFil] = useState(null);
  // 🧱 «Fundar una» abre el formulario acá mismo (Dlx, 19/10/2026: «la gente no sabe dónde crear crews»); `?armar=1`
  // lo trae abierto (el botón de Mi crew). ⚠️ No se llama `armar`: así se llama la función importada que arma la lista,
  // y pisarla tumbó la página entera («m is not a function»)
  const [abierto, setAbierto] = useState(() => /(?:^|&)armar=1/.test(qs || ''));
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
  const jugaronSem = xs.filter((x) => x.jugaron > 0).length;
  // ⭐ PARA TI (Dlx, 19/10/2026: «crews recomendadas para que te unas»): el MAZO del remake (29/10/2026). Las que te
  // aceptan, vivas, con gente de tu servidor, de tu país o que sigues primero (`reco` de crews.js). Sin crew todavía
  // —o sin cuenta—, para que se vea qué hay; con crew, no hace falta
  const buscando = !!(dc && mia && mia.de && !mia.crew);
  const sinCrew = !mias;
  const reco = sinCrew ? xs.filter((x) => !x.mia && x.ks.length >= 2 && (x.puede || !dc) && x.act > 0)
    .sort((a, b) => (b.reco - a.reco) || (b.pts - a.pts)).slice(0, 8) : [];
  // 🙋 «SER EL 2.º»: de las 29 crews, 16 tenían una sola persona y en 12 su fundador jugó esa semana. Gente activa, sola
  const solas = sinCrew ? xs.filter((x) => !x.mia && x.ks.length === 1 && x.act >= 2 && (x.puede || !dc)).sort((a, b) => b.reco - a.reco).slice(0, 10) : [];
  const fundar = () => { setAbierto(true); setTimeout(() => irA('crw-tu'), 30); };
  return (
    <>
      <div className="escena pub-esc crw-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.85 }}>
        <section className="pub-cab crw-cab">
          <span className="tag">CREWS · {liga.temp}</span>
          <h1 className="hero-ev largo">Crews</h1>
          <p className="hero-p">Funda la tuya o súmate a una. Cada lunes, como en el fútbol, cada crew sube, baja o se mantiene de tier por lo que jugó su gente.</p>
          {jugaronSem ? <p className="crw-vivo"><i aria-hidden="true" />{jugaronSem === 1 ? '1 crew ya jugó' : jugaronSem + ' crews ya jugaron'} esta semana · cierra el lunes a las 11 AM</p> : null}
          <div className="crw-cta">
            {!dc ? <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>
              : mias ? <a className="btn verde" href={enlaceCrew(mias.c.id)}>Ir a mi crew</a>
                : mia && !mia.de ? <a className="btn verde" href="#/cuenta/verificar">Verificarme para entrar</a>
                  : <>
                    <button type="button" className="btn verde" onClick={() => irA(reco.length ? 'crw-mazo' : 'crw-todas')}>⚡ Encontrar mi crew</button>
                    <button type="button" className="btn osc" onClick={fundar}>Fundar una · {num((mia && mia.precio) ?? 2500)}</button>
                  </>}
          </div>
          <ul className="crw-num">
            <li><b>{num(xs.length)}</b><span>crews</span></li>
            <li><b>{num(enCrews)}</b><span>raperos en crews</span></li>
            <li><b>{num(aceptan)}</b><span>{dc ? 'te aceptan' : 'aceptan gente'}</span></li>
          </ul>
        </section>
      </div>
      <div className="pub-t2 crw-t2">
        <main className="pub-feed crw-main">
          <TuCrew liga={liga} dc={dc} mia={mia} x={mias} T={T} armar={abierto} setArmar={setAbierto} />
          {reco.length ? (
            <section className="crw-sec" id="crw-mazo" aria-labelledby="crw-mazo-h">
              <h2 className="crw-h2" id="crw-mazo-h">Para ti</h2>
              <p className="crw-tu-s">{buscando ? 'Desliza. La que te guste: «Unirme» y estás adentro.' : 'Las crews más vivas de la semana.'}</p>
              <ul className="crw-mazo">{reco.map((x) => <li key={x.c.id}><CartaCrew liga={liga} x={x} T={T} dc={dc} mia={mia} /></li>)}</ul>
            </section>
          ) : null}
          {solas.length ? (
            <section className="crw-sec" aria-labelledby="crw-solas-h">
              <h2 className="crw-h2" id="crw-solas-h">Buscan su 2.º</h2>
              <p className="crw-tu-s">Fundaron su crew y juegan solos. Entra y la levantan juntos.</p>
              <ul className="crw-solas">{solas.map((x) => {
                const f = x.filas[0];
                return (
                  <li key={x.c.id} className="crw-sola">
                    <a href={enlaceCrew(x.c.id)} className="crw-sola-a"><CrewCirculo c={{ logo: x.logo, crew: x.c.nombre }} cls="crw-logo chico" />
                      <b>{limpio(x.c.nombre)}</b></a>
                    <small>{f ? limpio(f.n) + (x.jugaron ? ' jugó esta semana' : ' jugó hace poco') : 'Su fundador juega'}</small>
                    <Unirme x={x} dc={dc} mia={mia} texto="Ser el 2.º" />
                  </li>
                );
              })}</ul>
            </section>
          ) : null}
          <SemanaCrews xs={xs} T={T} />
          <h2 className="crw-h2 crw-todas-h" id="crw-todas">Todas las crews</h2>
          <div className="crw-busca">
            <input type="search" className="cw-busca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca una crew por nombre o sigla"
              aria-label="Buscar una crew" enterKeyHint="search" />
            <label className="crw-orden">Ordenar
              <select className="cw-sel" value={orden} onChange={(e) => setOrden(e.target.value)}>
                {ORDENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
          </div>
          <nav className="pub-fil crw-fil" aria-label="Qué crews ver">
            <ConMas max={4}>
              {filtros.map(([v, t]) => <button type="button" key={v || 'todas'} className={fil === v ? 'on' : ''} aria-pressed={fil === v} onClick={() => setFil(v)}>{t}</button>)}
            </ConMas>
          </nav>
          {!todas ? <p className="pub-tx">Cargando las crews…</p>
            : lista.length ? <ul className="crw-lista">{lista.map((x) => <li key={x.c.id}><Ficha liga={liga} x={x} T={T} dc={dc} mia={mia} /></li>)}</ul>
              : <Vacio titulo="Ninguna crew con eso" texto={nq ? 'No hay ninguna crew con «' + q.trim() + '» en el nombre o la sigla.' : 'Con ese filtro no queda ninguna.'}
                acciones={[['Ver todas', () => { setQ(''); setFil(''); }, 'borde2']].concat(buscando ? [['Fundar la mía', () => { setQ(''); setFil(''); fundar(); }]] : [])} />}
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

const irA = (id) => {
  const r = document.querySelector('#inicio-nuevo');
  const el = (r && r.shadowRoot ? r.shadowRoot.getElementById(id) : null) || document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
const pctDe = (x) => (x.ks.length ? Math.round((100 * x.jugaron) / x.ks.length) : 0);

/** 🃏 Una crew en el mazo: la carta grande, con su escudo, su lema, quién está y cuántos jugaron esta semana. */
function CartaCrew({ liga, x, T, dc, mia }) {
  const c = x.c;
  const e = escudoDe(x.logo, limpio(c.nombre));
  const col = e ? '#' + e.a : '#030304';
  const caras = x.filas.slice().sort((a, b) => (a.pos || 1e9) - (b.pos || 1e9)).slice(0, 5);
  const pct = pctDe(x);
  return (
    <article className="crw-carta">
      <a className="crw-banda" href={enlaceCrew(c.id)} style={{ background: col, color: tinta(col) }}>
        <i className="crw-losa" aria-hidden="true" />
        {c.sigla ? <span className="crw-sig">[{c.sigla}]</span> : null}
        <span className="crw-em"><CrewCirculo c={{ logo: x.logo, crew: c.nombre }} cls="crw-logo grande" /></span>
      </a>
      <div className="crw-cuerpo">
        <div className="crw-nom"><a href={enlaceCrew(c.id)}><b>{limpio(c.nombre)}</b></a><TierChip n={x.tier} T={T} chico /></div>
        {c.desc ? <p className="crw-lema">«{c.desc}»</p> : null}
        <div className="crw-gente">
          <span className="crw-caras">{caras.map((f) => <Cara key={f.k} liga={liga} k={f.k} nombre={f.n} cls="cara crw-cara" lazy />)}
            {x.ks.length > caras.length ? <i className="crw-mas">+{x.ks.length - caras.length}</i> : null}</span>
          <span className="crw-cuenta"><b>{x.ks.length}</b>/{x.max}</span>
          {x.ccs.length ? <span className="crw-flags">{x.ccs.slice(0, 4).map((cc) => <Bandera key={cc} cc={cc} cls="crw-flag" />)}</span> : null}
        </div>
        <div className="crw-semana-c">
          <Anillo pct={pct} tam={58} grosor={7}><b>{pct}%</b></Anillo>
          <span><b>{x.jugaron} de {x.ks.length}</b> {x.jugaron === 1 ? 'jugó' : 'jugaron'} esta semana{x.semPts ? ' · ' + num(x.semPts) + ' pts' : ''}.
            {x.deMiPais ? <><br />🤝 {x.deMiPais === 1 ? '1 de tu país' : x.deMiPais + ' de tu país'} adentro</> : null}</span>
        </div>
        <div className="crw-pie">
          <Unirme x={x} dc={dc} mia={mia} />
          <a className="btn borde2 chico" href={enlaceCrew(c.id)}>Ver</a>
        </div>
      </div>
    </article>
  );
}

/** 📊 LA SEMANA DE LAS CREWS: por qué parte de la crew jugó, no por el total — una de 3 le puede ganar a una de 11. */
function SemanaCrews({ xs, T }) {
  const ys = xs.filter((x) => x.ks.length >= 2 && x.jugaron > 0).sort((a, b) => (pctDe(b) - pctDe(a)) || (b.semPts - a.semPts)).slice(0, 8);
  if (ys.length < 2) return null;
  return (
    <section className="crw-sec" aria-labelledby="crw-sem-h">
      <h2 className="crw-h2" id="crw-sem-h">La semana de las crews</h2>
      <p className="crw-tu-s">Por la parte de la crew que ya jugó: una de 3 le puede ganar a una de 11.</p>
      <ol className="crw-tabla">{ys.map((x, i) => (
        <li key={x.c.id} className={x.mia ? 'yo' : ''}>
          <span className="crw-pos">{i + 1}</span>
          <CrewCirculo c={{ logo: x.logo, crew: x.c.nombre }} cls="crw-logo chico" />
          <a className="crw-t" href={enlaceCrew(x.c.id)}><b>{limpio(x.c.nombre)}{x.mia ? ' · la tuya' : ''}</b>
            <small>{x.jugaron} de {x.ks.length} jugaron{T ? ' · ' + T.nombres[x.tier] : ''}</small></a>
          <b className="crw-pct">{pctDe(x)}%</b>
        </li>
      ))}</ol>
    </section>
  );
}

/** Arriba de todo: tu crew (con su semana) o, sin crew, fundar una; y las invitaciones que tienes. */
function TuCrew({ liga, dc, mia, x, T, armar, setArmar }) {
  if (!dc || !mia) return null;
  const inv = mia.inv || [];
  if (x) {
    const pct = pctDe(x);
    return (
      <section className="crw-tu mia" id="crw-tu" aria-label="Tu crew">
        <a className="crw-tu-c" href={enlaceCrew(x.c.id)}>
          <CrewCirculo c={{ logo: x.logo, crew: x.c.nombre }} cls="crw-logo" />
          <span><small>TU CREW</small><b>{limpio(x.c.nombre)}</b>{x.c.sigla ? <em>[{x.c.sigla}]</em> : null}</span>
          <TierChip n={x.tier} T={T} chico />
        </a>
        <div className="crw-semana-c">
          <Anillo pct={pct} tam={58} grosor={7}><b>{pct}%</b></Anillo>
          <span><b>{x.jugaron} de {x.ks.length}</b> {x.jugaron === 1 ? 'jugó' : 'jugaron'} esta semana · {num(x.semPts)} puntos.
            {T && T.sube[x.tier] ? <><br />{x.semPts >= T.sube[x.tier] ? '✅ Si cierra así, el lunes sube a ' + T.nombres[x.tier + 1]
              : 'Para subir a ' + T.nombres[x.tier + 1] + ' le faltan ' + num(T.sube[x.tier] - x.semPts) + ' puntos'}
            {T.juegan[x.tier + 1] > 1 ? ' (y que jueguen ' + T.juegan[x.tier + 1] + ')' : ''}.</> : null}</span>
        </div>
        <SemanaCrew c={x.c} rol={mia.rol} />
        {inv.length ? <p className="crw-tu-s">📨 Te invitaron a {inv.map((i) => limpio(i.nombre)).join(', ')}: <a className="te-link" href="#/cuenta/crew">verlo en Mi crew</a></p> : null}
      </section>
    );
  }
  if (!mia.de) return null;
  if (!armar && !inv.length) return null;
  return (
    <section className={'crw-tu' + (armar ? ' armando' : '')} id="crw-tu" aria-label="Tu crew">
      {inv.length ? <p className="crw-tu-s">📨 Te invitaron a {inv.map((i) => <a key={i.crew} className="te-link" href={enlaceCrew(i.crew)}>{limpio(i.nombre)}</a>)
        .reduce((a, b) => [a, ', ', b])}: <a className="te-link" href="#/cuenta/crew">responder</a>.</p> : null}
      {armar ? (
        <>
          <CrearCrew mia={mia} />
          <button type="button" className="te-link crw-cerrar" onClick={() => setArmar(false)}>Cerrar, mejor me sumo a una</button>
        </>
      ) : null}
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
        <span className="crw-caras">{caras.map((f) => <Cara key={f.k} liga={liga} k={f.k} nombre={f.n} cls="cara crw-cara" lazy />)}
          {x.ks.length > caras.length ? <i className="crw-mas" title={x.ks.length + ' en la crew'}>+{x.ks.length - caras.length}</i> : null}</span>
        {x.ccs.length ? <span className="crw-flags">{x.ccs.slice(0, 4).map((cc) => <Bandera key={cc} cc={cc} cls="crw-flag" />)}</span> : null}
      </div>
      <p className="crw-semana">{x.jugaron ? <><b>{x.jugaron} de {x.ks.length}</b> {x.jugaron === 1 ? 'jugó' : 'jugaron'} esta semana · {num(x.semPts)} pts</>
        : x.dias !== null ? (x.dias === 0 ? 'Jugaron hoy' : 'Nadie jugó esta semana · el último, hace ' + x.dias + (x.dias === 1 ? ' día' : ' días'))
          : 'Nadie de la crew jugó todavía en la temporada'}</p>
      {conocidos.length || x.deMiSv || x.deMiPais ? (
        <p className="crw-conoce">{x.conozco.slice(0, 3).map((k) => <Cara key={k} liga={liga} k={k} nombre={(liga.T[k] || {}).n || k} cls="cara crw-cara chica" lazy />)}
          {[conocidos.length ? 'Sigues a ' + conocidos.slice(0, 2).join(' y ') + (conocidos.length > 2 ? ' y ' + (conocidos.length - 2) + ' más' : '') : '',
          x.deMiSv ? x.deMiSv + ' de tu servidor' : '', x.deMiPais ? x.deMiPais + ' de tu país' : ''].filter(Boolean).join(' · ')}</p>
      ) : null}
      {x.req.rg || x.req.ev ? (
        <p className={'crw-req' + (x.falta.length ? ' no' : ' si')}>Pide {[x.req.rg ? 'letra ' + x.req.rg + ' o más' : '', x.req.ev ? x.req.ev + ' eventos' : ''].filter(Boolean).join(' y ')}
          {dc && liga.yo ? (x.falta.length ? ' · te falta ' + x.falta.join(' y ') : ' · ✓ cumples') : ''}</p>
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
function Unirme({ x, dc, mia, texto }) {
  const [va, setVa] = useState(false);
  const [msg, setMsg] = useState('');
  const c = x.c;
  if (!dc || !mia || !mia.de) return null;
  const pedi = (mia.ped || []).some((p) => p.crew === c.id);
  const hacer = (cuerpo, ok) => {
    if (va) return;
    setVa(true); setMsg('');
    accionCrew(cuerpo).then((j) => { setVa(false); if (j && j.ok) setMsg(typeof ok === 'function' ? ok(j) : ok); else if (j) setMsg(errorCrew(j)); })
      .catch(() => { setVa(false); setMsg('No pude. Prueba de nuevo en un rato.'); });
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
  else if (x.falta.length) b = <small className="crw-ya">No llegas a lo que pide</small>;
  else {
    b = <button type="button" className="btn verde chico" disabled={va}
      onClick={() => hacer({ accion: 'pedir', crew: c.id }, c.entrada === 'abierta' ? '¡Entraste!' : 'Pedido enviado: te avisamos cuando te acepten.')}>
      {c.entrada === 'abierta' ? texto || 'Unirme' : 'Pedir entrar'}</button>;
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
        <li><b>Fundar una</b>: estar verificado y {num(precio)} Puntos de Tienda. El nombre, la sigla, el escudo (lo armas ahí mismo, o subes una imagen) y el lema. Hasta {(todas && todas.max) || 20} raperos.</li>
        <li><b>La primera semana</b>: una crew nueva tiene 7 días para sumar 2 personas, o se borra.</li>
        <li><b>Cómo se entra</b>: abierta (entra quien quiera), con pedido (acepta el Líder o un Colíder) o sólo por invitación. Algunas piden una letra o eventos mínimos.</li>
        <li><b>Los rangos</b>: Líder, Colíder, Veterano y Miembro. El Colíder casi todo, el Veterano invita.</li>
        <li><b>Cambiarse</b>: si te invitan estando en otra, puedes cambiarte; después esperas 7 días para moverte de nuevo.</li>
        {T ? <li><b>Los tiers</b>: de {T.nombres[0]} a {T.nombres[T.nombres.length - 1]}, cada lunes por lo que jugó la crew.</li> : null}
      </ul>
    </section>
  );
}
