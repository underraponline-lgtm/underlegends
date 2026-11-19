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
import { Bandera, Cara, ConMas, Vacio, accion, usePerfiles } from './piezas.jsx';
import { CrewCirculo } from './arriba.jsx';
import { escudoDe, tinta } from './escudo.jsx';
import { accionCrew, armarCrews as armar, cierreCrews, errorCrew, faltaCierre, pedirCrews, pedirMia, useCrews } from './crews.js';
import { Anillo, CrearCrew, EntrarDeNuevo, TierChip, consejosCrew } from './crewpanel.jsx';
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

// 🧩 EL REMAKE DE LAS CREWS (16/11/2026, la mezcla D de la maqueta privada BEZkuXnUvV98jPMy6NN7KA). Dlx: «una mezcla, me
// gusta más el club para las crews… pero hay cosas que me gustan de ambas», y a la v3: «Fundar una crew que aparezca más
// arriba». La lista junta el buscador del CLUB (la vista previa al costado, como las ligas de FC Mobile, y el verbo en el
// botón: Unirme / Pedir entrar, como las alianzas de Whiteout Survival) con la SEMANA de la LIGA (la tabla de cada tier
// con la raya de bajar y la cuenta atrás, como las ligas de Duolingo; la semana pasada al lado, como los clubs de Strava).
export function CrewsPagina({ liga, dc, qs }) {
  // ⚠️ `todasNo` y `miaFallo` (18/11/2026): con un fallo pasajero la cabecera se quedaba sin ningún botón (ni Fundar ni
  // Entrar) y la lista en «Cargando las crews…» para siempre
  const { todas, todasNo, mia, miaNo, miaFallo } = useCrews();
  const [filElegido, setFil] = useState(null);
  // 🧱 «Fundar una» abre el formulario acá mismo (Dlx, 19/10/2026: «la gente no sabe dónde crear crews»); `?armar=1`
  // lo trae abierto (el botón de Mi crew). ⚠️ No se llama `armar`: así se llama la función importada que arma la lista,
  // y pisarla tumbó la página entera («m is not a function»)
  const [abierto, setAbierto] = useState(() => /(?:^|&)armar=1/.test(qs || ''));
  const [orden, setOrden] = useState('reco');
  const [q, setQ] = useState('');
  const [selId, setSel] = useState(null);
  const [como, setComo] = useState(false);
  const T = liga.d.crews_tiers && liga.d.crews_tiers.nombres ? liga.d.crews_tiers : null;
  // 🧑 la fila entera de quien está más allá de los 200 (18/11/2026): `armar` la toma de /api/perfiles, pero en una carga
  // en frío de Crews nadie lo bajaba ni rearmaba la lista al llegar —faltaban banderas, «De tu servidor/país» y salía
  // «Dormida»—. Con `P`, la lista (y TuCrew con sus consejos) se rearma sola
  const P = usePerfiles();
  const xs = useMemo(() => armar(liga, todas, mia, P), [liga, todas, mia, P]);
  const yo = liga.yo;
  // «Te aceptan» prendido para quien busca crew (como «sólo clanes a los que puedo entrar» de Clash of Clans)
  const fil = filElegido !== null ? filElegido : dc && mia && mia.de && !mia.crew ? 'lugar' : '';
  const nq = norm(q).trim();
  const lista = xs.filter((x) => !x.mia)
    .filter((x) => !nq || norm(x.c.nombre).includes(nq) || norm(x.c.sigla || '').includes(nq))
    .filter((x) => (fil === 'lugar' ? x.puede : fil === 'abiertas' ? x.c.entrada === 'abierta' && !x.llena : fil === 'activas' ? x.act >= 2
      : fil === 'conozco' ? x.conozco.length > 0 : fil === 'servidor' ? x.deMiSv > 0 : fil === 'pais' ? x.deMiPais > 0
        : fil === 'nuevas' ? x.nueva : true))
    .sort((a, b) => (orden === 'activas' ? (b.jugaron - a.jugaron) || (b.semPts - a.semPts)
      : orden === 'tier' ? (b.tier - a.tier) || (b.semPts - a.semPts)
        : orden === 'gente' ? b.ks.length - a.ks.length
          : orden === 'puntos' ? b.pts - a.pts
            : orden === 'nuevas' ? (b.c.creada || 0) - (a.c.creada || 0)
              : b.reco - a.reco) || (b.pts - a.pts));
  const mias = xs.find((x) => x.mia);
  // ⭐ `sigueTodos` (18/11/2026): `conozco` (crews.js) ya cuenta a quien sigues fuera de las 200 filas, y con `sigue` el
  // filtro no salía a quien sólo sigue a gente de más abajo
  const filtros = FILTROS.filter(([v]) => (v === 'servidor' ? yo && yo.sv : v === 'pais' ? yo && yo.cc : v === 'conozco' ? (liga.sigueTodos || liga.sigue || []).length : true));
  const enCrews = xs.reduce((a, x) => a + x.ks.length, 0);
  const jugaronSem = xs.filter((x) => x.jugaron > 0).length;
  // ⭐ PARA TI: el MAZO del remake (29/10/2026), sin crew todavía —o sin cuenta—, para que se vea qué hay
  const buscando = !!(dc && mia && mia.de && !mia.crew);
  const sinCrew = !mias;
  const reco = sinCrew ? xs.filter((x) => !x.mia && x.ks.length >= 2 && (x.puede || !dc) && x.act > 0)
    .sort((a, b) => (b.reco - a.reco) || (b.pts - a.pts)).slice(0, 8) : [];
  // 🙋 «SER EL 2.º»: de las 29 crews, 16 tenían una sola persona y en 12 su fundador jugó esa semana. Gente activa, sola
  const solas = sinCrew ? xs.filter((x) => !x.mia && x.ks.length === 1 && x.act >= 2 && (x.puede || !dc)).sort((a, b) => b.reco - a.reco).slice(0, 10) : [];
  const fundar = () => { setAbierto(true); setTimeout(() => irA('crw-tu'), 30); };
  // 👆 la vista previa: la que tocaste, o la primera de la lista
  const sel = lista.find((x) => x.c.id === selId) || lista[0] || null;
  const cierre = cierreCrews(liga);
  const puedeFundar = dc && mia && mia.de && !mia.crew;
  return (
    <>
      <div data-tuto="crw-cab" className="escena pub-esc crw-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.85 }}>
        <section className="pub-cab crw-cab crw-cab2">
          <div className="crw-cab-tx">
            <span className="tag">CREWS · {liga.temp}</span>
            <h1 className="hero-ev largo">Crews</h1>
            <p className="hero-p">{num(xs.length)} crews · {num(enCrews)} raperos · los tiers suben y bajan cada lunes{jugaronSem ? ' · ' + (jugaronSem === 1 ? '1 ya jugó' : jugaronSem + ' ya jugaron') + ' esta semana' : ''}</p>
            {/* ⬆️ «Fundar una crew» arriba de todo (Dlx, 16/11/2026: «que aparezca más arriba») */}
            <div className="crw-cta">
              {!dc || (!mia && miaNo) ? <button type="button" className="btn verde" onClick={accion.entrar}>{dc ? 'Entrar de nuevo con Discord' : 'Entrar con Discord'}</button>
                : !mia && miaFallo ? <button type="button" className="btn verde" onClick={() => pedirMia(true)}>No pude traer tu crew · Probar de nuevo</button>
                : mia && !mia.de ? <a className="btn verde" href="#/cuenta/verificar">Verificarme para fundar o entrar</a>
                  : puedeFundar ? <button type="button" className="btn verde" onClick={fundar}>Fundar una crew · {num((mia && mia.precio) ?? 2500)} Puntos</button> : null}
              {buscando && reco.length ? <button type="button" className="btn osc" onClick={() => irA('crw-mazo')}>⚡ Encontrar mi crew</button> : null}
              <a className="btn osc" href="#/ranking/crews">Ranking de crews</a>
            </div>
          </div>
          {/* 🕐 «(hora del este)» (18/11/2026): la hora no pasa por la zona de Ajustes, y sin decirlo se leía como la tuya */}
          {cierre ? <div className="crw-cierre"><span>Cierra el lunes · 11 AM (hora del este)</span><b>{faltaCierre(cierre, liga.ahora)}</b></div> : null}
        </section>
      </div>
      <div className="crw-main2">
        <TuCrew liga={liga} dc={dc} mia={mia} miaNo={miaNo} x={mias} xs={xs} T={T} armar={abierto} setArmar={setAbierto} />
        {reco.length ? (
          <section className="crw-sec" id="crw-mazo" aria-labelledby="crw-mazo-h">
            <div className="crw-tit"><h2 id="crw-mazo-h">Para ti</h2><small>{buscando ? 'Desliza. La que te guste: «Unirme» y estás adentro.' : 'Las crews más vivas de la semana.'}</small></div>
            <ul className="crw-mazo">{reco.map((x) => <li key={x.c.id}><CartaCrew liga={liga} x={x} T={T} dc={dc} mia={mia} /></li>)}</ul>
          </section>
        ) : null}
        <section className="crw-sec" aria-labelledby="crw-todas">
          <div className="crw-tit"><h2 data-tuto="crw-todas" id="crw-todas">Buscar una crew</h2><small>{num(lista.length)} {lista.length === 1 ? 'crew' : 'crews'} · tocas una y la ves al costado</small></div>
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
            <ConMas max={5}>
              {filtros.map(([v, t]) => <button type="button" key={v || 'todas'} className={fil === v ? 'on' : ''} aria-pressed={fil === v} onClick={() => setFil(v)}>{t}</button>)}
            </ConMas>
          </nav>
          {!todas ? <p className="pub-tx">{todasNo ? <>No pude traer las crews. <button type="button" className="te-link" onClick={() => pedirCrews(true)}>Probar de nuevo</button></> : 'Cargando las crews…'}</p>
            : lista.length ? (
              <div className="crw-busqueda">
                <ul className="crw-filas">{lista.map((x) => (
                  <li key={x.c.id} className={sel && sel.c.id === x.c.id ? 'on' : ''}>
                    <FilaCrew liga={liga} x={x} T={T} dc={dc} mia={mia} onVer={() => setSel(x.c.id)} />
                    {/* 📱 en el celular, la vista previa se abre debajo de la que tocaste */}
                    {sel && sel.c.id === x.c.id && selId ? <div className="crw-prev-cel"><Ficha liga={liga} x={x} T={T} dc={dc} mia={mia} /></div> : null}
                  </li>
                ))}</ul>
                {sel ? <aside className="crw-prev" aria-label={'Vista previa de ' + limpio(sel.c.nombre)}><Ficha liga={liga} x={sel} T={T} dc={dc} mia={mia} /></aside> : null}
              </div>
            )
              : <Vacio titulo="Ninguna crew con eso" texto={nq ? 'No hay ninguna crew con «' + q.trim() + '» en el nombre o la sigla.' : 'Con ese filtro no queda ninguna.'}
                acciones={[['Ver todas', () => { setQ(''); setFil(''); }, 'borde2']].concat(buscando ? [['Fundar la mía', () => { setQ(''); setFil(''); fundar(); }]] : [])} />}
        </section>
        <div className="crw-dos">
          <TablaSemana liga={liga} xs={xs} T={T} onComo={() => setComo(!como)} como={como} />
          <div className="crw-col">
            <SemanaPasada xs={xs} T={T} />
            {solas.length ? (
              <section className="crw-caja" aria-labelledby="crw-solas-h">
                <div className="crw-tit"><h2 id="crw-solas-h">Buscan su 2.º</h2><small>fundaron su crew y juegan solos</small></div>
                <ul className="crw-solas">{solas.map((x) => {
                  const f = x.filas[0];
                  return (
                    <li key={x.c.id} className="crw-sola">
                      <a href={enlaceCrew(x.c.id)} className="crw-sola-a"><CrewCirculo c={{ logo: x.logo, crew: x.c.nombre }} cls="crw-logo chico" />
                        <b>{limpio(x.c.nombre)}</b></a>
                      <small>{f ? limpio(f.n) + (x.jugaron ? ' jugó esta semana' : ' jugó hace poco') + (f.pos ? ' · #' + f.pos + ' de la Liga' : '') : 'Su fundador juega'}</small>
                      <Unirme x={x} dc={dc} mia={mia} texto="Ser el 2.º" />
                    </li>
                  );
                })}</ul>
              </section>
            ) : null}
          </div>
        </div>
        {como ? <div className="crw-dos crw-como-dos"><Tiers T={T} xs={xs} /><ComoFunciona todas={todas} T={T} /></div> : null}
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
          <span><b>{x.jugaron} de {x.ks.length}</b> {x.jugaron === 1 ? 'jugó' : 'jugaron'} esta semana.
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

/** Una fila del buscador: su escudo, el nombre con la sigla y cómo se entra, el tier, la gente, la semana y el botón. */
function FilaCrew({ liga, x, T, dc, mia, onVer }) {
  const c = x.c;
  const [e] = ENTRA[c.entrada] || ENTRA.pedido;
  return (
    <div className={'crw-fila' + (x.invitado ? ' inv' : '')}>
      <button type="button" className="sin-boton crw-fila-a" onClick={onVer} aria-label={'Ver ' + limpio(c.nombre) + ' al costado'}>
        <CrewCirculo c={{ logo: x.logo, crew: c.nombre }} cls="crw-logo" />
        <span className="crw-n"><b>{limpio(c.nombre)}</b><small>{c.sigla ? '[' + c.sigla + '] · ' : ''}{e}{x.nueva && x.ks.length < 5 ? ' · nueva' : ''}</small></span>
      </button>
      <TierChip n={x.tier} T={T} chico />
      <span className="crw-fila-d"><b>{x.ks.length}</b>/{x.max}<small>gente</small></span>
      <span className="crw-fila-d"><b>{x.jugaron}</b><small>{x.jugaron === 1 ? 'jugó' : 'jugaron'}</small></span>
      <span className="crw-fila-b"><Unirme x={x} dc={dc} mia={mia} /></span>
    </div>
  );
}

/**
 * 📊 LA TABLA DE LA SEMANA, por tier (la Liga de la mezcla D, como las ligas de Duolingo): cada crew con su barra hasta lo
 * que pide subir, la raya magenta de bajar, «baja si cierra así» / «sube», y la tuya pintada de blanco.
 */
function TablaSemana({ liga, xs, T, onComo, como }) {
  if (!T) return null;
  const porTier = new Map();
  xs.filter((x) => x.ks.length).forEach((x) => { if (!porTier.has(x.tier)) porTier.set(x.tier, []); porTier.get(x.tier).push(x); });
  const tiers = [...porTier.keys()].sort((a, b) => b - a);
  if (!tiers.length) return null;
  return (
    <section className="crw-sec" aria-labelledby="crw-sem-h">
      <div className="crw-tit"><h2 id="crw-sem-h">La tabla de la semana</h2><small>{xs.some((x) => x.mia) ? 'tu crew pintada · ' : ''}la raya magenta es la de bajar</small></div>
      {tiers.map((i) => {
        const ys = porTier.get(i).sort((a, b) => b.semPts - a.semPts);
        const tope = T.sube[i] || Math.max(1, ...ys.map((x) => x.semPts));
        const baja = T.baja[i];
        return (
          <div key={i} className="crw-tz">
            <div className="crw-tz-h"><TierChip n={i} T={T} chico /><small>{T.sube[i] ? 'suben con ' + num(T.sube[i]) + (T.juegan[i + 1] > 1 ? ' y ' + T.juegan[i + 1] + ' que jueguen' : '') : 'el tier más alto'}{baja ? ' · bajan con menos de ' + num(baja) : ''}</small></div>
            <ol>{ys.map((x, k) => {
              const sube = T.sube[i] && x.semPts >= T.sube[i] && x.jugaron >= (T.juegan[i + 1] || 0);
              const cae = baja && x.semPts < baja;
              return (
                <li key={x.c.id} className={x.mia ? 'yo' : ''}>
                  <span className="crw-pos">{k + 1}</span>
                  <CrewCirculo c={{ logo: x.logo, crew: x.c.nombre }} cls="crw-logo chico" />
                  <a className="crw-t" href={enlaceCrew(x.c.id)}><b>{limpio(x.c.nombre)}{x.mia ? ' · tu crew' : ''}</b>
                    <small>{x.jugaron} de {x.ks.length} jugaron{cae ? <> · <span className="crw-cae">baja si cierra así</span></> : sube ? <> · <span className="crw-sube">sube</span></> : null}</small>
                    <i className="crw-barra" aria-hidden="true"><u style={{ width: Math.min(100, Math.round((100 * x.semPts) / tope)) + '%' }} />
                      {baja ? <em style={{ left: Math.min(100, (100 * baja) / tope) + '%' }} /> : null}</i></a>
                  <b className="crw-pts">{num(x.semPts)}</b>
                </li>
              );
            })}</ol>
          </div>
        );
      })}
      <button type="button" className="te-link crw-como-b" aria-expanded={!!como} onClick={onComo}>{como ? 'Cerrar cómo funcionan' : 'Cómo funcionan los tiers ›'}</button>
    </section>
  );
}

/** 🏅 LA SEMANA PASADA (como los clubs de Strava): las tres que más sumaron, del cierre del lunes (`crews_tiers`). */
function SemanaPasada({ xs, T }) {
  if (!T || !T.ult) return null;
  const ys = xs.map((x) => ({ x, p: ((T.crews || {})[x.c.id] || [])[4] || 0 })).filter((y) => y.p > 0).sort((a, b) => b.p - a.p).slice(0, 3);
  if (ys.length < 2) return null;
  const orden = ys.length === 3 ? [ys[1], ys[0], ys[2]] : [ys[1], ys[0]];
  return (
    <section className="crw-caja" aria-labelledby="crw-pas-h">
      <div className="crw-tit"><h2 id="crw-pas-h">La semana pasada</h2><small>las que más sumaron hasta el lunes</small></div>
      <ol className="crw-podio">{orden.map((y) => {
        const i = ys.indexOf(y);
        return (
          <li key={y.x.c.id} className={'p' + (i + 1)}>
            <a href={enlaceCrew(y.x.c.id)}><CrewCirculo c={{ logo: y.x.logo, crew: y.x.c.nombre }} cls="crw-logo" /><b>{limpio(y.x.c.nombre)}</b>
              <small>{i + 1}.º · {num(y.p)}</small></a>
          </li>
        );
      })}</ol>
    </section>
  );
}

/** Arriba de todo: tu crew en la franja blanca (con lo que le falta para subir), o el formulario para fundar una. */
function TuCrew({ liga, dc, mia, miaNo, x, xs, T, armar, setArmar }) {
  if (dc && !mia && miaNo && armar) return <section className="crw-tu armando" id="crw-tu" aria-label="Tu crew"><EntrarDeNuevo /></section>;
  if (!dc || !mia) return null;
  const inv = mia.inv || [];
  if (x) {
    const manda = mia.rol === 'lider' || mia.rol === 'colider';
    const enTier = xs.filter((y) => y.tier === x.tier && y.ks.length).sort((a, b) => b.semPts - a.semPts);
    const sig = T && T.sube[x.tier] ? T.nombres[x.tier + 1] : '';
    const falta = T && T.sube[x.tier] ? Math.max(0, T.sube[x.tier] - x.semPts) : 0;
    // 👥 y cuántos tienen que jugar (18/11/2026): el cierre pide `jugaron >= JUEGAN[tier + 1]` (crews_tiers.py) y esto
    // miraba sólo los puntos. A una crew de uno le decía «si cierra así, sube a Oro» y el lunes no subía.
    // «falta 1 que juegue», no «faltan 1 que jueguen» (18/11/2026): es justo el caso de la crew de uno, como en crew2.jsx
    const jj = T && T.sube[x.tier] ? ((T.juegan || [])[x.tier + 1] || 0) : 0;
    const subeTxt = falta ? ' sube a ' + sig + ' con ' + num(falta) + ' puntos más' + (jj > 1 ? ' y que jueguen ' + jj : '')
      : x.jugaron >= jj ? ': si cierra así, sube a ' + sig
        : ': ya tiene los puntos, ' + (jj - x.jugaron === 1 ? 'falta 1 que juegue' : 'faltan ' + (jj - x.jugaron) + ' que jueguen') + ' para subir a ' + sig;
    const tp = manda ? consejosCrew(liga, x.c, mia, T, null)[0] : null;
    return (
      <section className="crw-tu crw-franja" id="crw-tu" aria-label="Tu crew">
        <CrewCirculo c={{ logo: x.logo, crew: x.c.nombre }} cls="crw-logo" />
        <div className="crw-franja-t">
          <small>TU CREW{T ? ' · #' + (enTier.indexOf(x) + 1) + ' de la semana en ' + T.nombres[x.tier] : ''}</small>
          <b>{limpio(x.c.nombre)}{sig ? subeTxt : ''}</b>
          <span>{x.jugaron} de {x.ks.length} {x.jugaron === 1 ? 'jugó' : 'jugaron'} esta semana{tp ? ' · ' + tp.ico + ' ' + tp.t : ''}
            {inv.length ? ' · 📨 te invitaron a ' + inv.map((i) => limpio(i.nombre)).join(', ') : ''}</span>
        </div>
        <span className="crw-franja-b">
          <a className="btn negro" href={enlaceCrew(x.c.id)}>Ir a mi crew</a>
          <a className="btn borde-n" href={enlaceCrew(x.c.id) + '/ajustes'}>Ajustes</a>
        </span>
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
  const caras = x.filas.slice().sort((a, b) => (a.pos || 1e9) - (b.pos || 1e9)).slice(0, 5);
  // 🪪 `nombreDe()` y no `liga.T[k]` (18/11/2026): quien sigues y quedó fuera de las 200 filas salía con su clave
  const conocidos = x.conozco.map((k) => liga.nombreDe(k));
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
        <p className="crw-conoce">{x.conozco.slice(0, 3).map((k) => <Cara key={k} liga={liga} k={k} nombre={liga.nombreDe(k)} cls="cara crw-cara chica" lazy />)}
          {[conocidos.length ? 'Sigues a ' + conocidos.slice(0, 2).join(' y ') + (conocidos.length > 2 ? ' y ' + (conocidos.length - 2) + ' más' : '') : '',
          x.deMiSv ? x.deMiSv + ' de tu servidor' : '', x.deMiPais ? x.deMiPais + ' de tu país' : ''].filter(Boolean).join(' · ')}</p>
      ) : null}
      {x.req.rg || x.req.ev ? (
        <p className={'crw-req' + (x.falta.length ? ' no' : ' si')}>Pide {[x.req.rg ? 'letra ' + x.req.rg + ' o más' : '', x.req.ev ? x.req.ev + ' eventos' : ''].filter(Boolean).join(' y ')}
          {dc && liga.yo ? (x.falta.length ? ' · te falta ' + x.falta.join(' y ') : ' · ✓ cumples') : ''}</p>
      ) : null}
      {x.nueva && x.ks.length < 5 ? <p className="crw-nueva">NUEVA · busca gente</p> : null}
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
    // 🕐 por fmtFecha() y con «tú» (18/11/2026): `toLocaleDateString` iba en la zona del dispositivo e ignoraba la de
    // Ajustes —cerca de la medianoche, un día corrido del resto de la página—, y decía «Podés»
    const d = new Date(Date.now() + mia.espera_ms);
    const f = window.fmtFecha ? window.fmtFecha(d.toISOString(), { day: 'numeric', month: 'numeric' }) : d.toLocaleDateString('es', { day: 'numeric', month: 'numeric' });
    b = <small className="crw-ya">Puedes entrar desde el {f}</small>;
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
    <section data-tuto="crw-tiers" className="pub-bloque crw-bloque" aria-labelledby="crw-tiers">
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
        <li><b>Cómo se entra</b>: abierta (entra quien quiera), con pedido (acepta el Líder o un Colíder) o sólo por invitación. Algunas piden una letra o eventos mínimos.</li>
        <li><b>Los rangos</b>: Líder, Colíder, Veterano y Miembro. El Colíder casi todo, el Veterano invita.</li>
        <li><b>Cambiarse</b>: si te invitan estando en otra, puedes cambiarte; después esperas 7 días para moverte de nuevo.</li>
        {T ? <li><b>Los tiers</b>: de {T.nombres[0]} a {T.nombres[T.nombres.length - 1]}, cada lunes por lo que jugó la crew.</li> : null}
      </ul>
    </section>
  );
}
