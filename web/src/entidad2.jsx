// 🏟️ SERVIDOR, PAÍS Y CREW, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes»; para todos desde el mismo
// día («Publica y haz todo»), en lugar de servidor.jsx y grupo.jsx. Las tres son la misma familia —una portada con el
// emblema, sus números, su gente y «los otros»— y desde acá salen del mismo esqueleto, con lo que dejó el research de 21st
// (scratchpad/remake2/research_entidades.md):
// - LA PORTADA: el emblema con la forma de cada una (el logo cuadrado del servidor, la bandera 3:2, el escudo redondo de
//   la crew) con la sombra dura de su color, y una tira de números sin repetir lo que ya dice el cartel de arriba.
// - UN ÍNDICE PEGADO ARRIBA con lo que tiene cada página y cuántos (indice.js, el mismo de la Guía y el Salón): sólo las
//   secciones que se dibujaron.
// - LA LISTA LARGA DEL PAÍS EN DOS COLUMNAS en la compu (51 filas eran 2.500 px con 700 vacíos en cada fila), y en el
//   celular 15 y «Ver los 51»; el puesto en el país grande, el de la Liga chico, sin la bandera repetida. Quien está
//   fuera de concurso va sin número, como en el Ranking.
// - LA CREW: su semana y su tier al lado del plantel (la mitad derecha estaba vacía), el tier como una escalera, el
//   plantel por puesto con su rol al lado, y los que todavía no jugaron juntos. «Pedir entrar», arriba.
// - «LOS OTROS» EN CELDAS IGUALES, en filas parejas, con un número cada uno.
// ⚠️ Todo sale del payload, como en servidor.jsx y grupo.jsx: `svs`, `paises`, `crews`, `crews_tiers`, la tabla, las
// llaves, los próximos, el muro, Se busca. Ningún color de servidor ni de tier se escribe acá.
import { useRef, useState } from 'react';
import { limpio, mult, num, siglaDe, utc } from './liga.js';
import { Bandera, Cara, Compartir, Ico, Poster, Sec, aDiscord, accion, enlace, nombrePais, silueta } from './piezas.jsx';
import { McPersona } from './medio.jsx';
import { CrewCirculo } from './arriba.jsx';
import { crewViva, useCrews } from './crews.js';
import { CasaCrew, EntrarCrew, PanelCrew, RolCrew, SinVerificar, TierChip } from './crewpanel.jsx';
import { MesSv, Nota, PromosSv, REDES } from './servidor.jsx';
import { useSalon } from './mesawards.jsx';
import { useIndice } from './indice.js';
import CSS_PAGINA from './css/entidad2.css?inline';
import { usarCss } from './css.js';

usarCss('entidad2', CSS_PAGINA);

const clave = (c) => c.clave || c.crew;
const porLugar = (a, b) => (a.o || a.pos || 999) - (b.o || b.pos || 999);
// las cartas de arriba: de a filas enteras de cinco
const cartas = (gente) => gente.slice(0, gente.length >= 10 ? 10 : gente.length >= 5 ? 5 : gente.length);
const raperos = (n) => num(n) + (n === 1 ? ' rapero' : ' raperos');

// ── la portada: el emblema, el nombre, sus acciones y la tira de números ──
function Portada({ emblema, forma, color, tag, nombre, sub, acciones, numeros, extra, estilo }) {
  return (
    <div className="escena ent-esc" style={{ '--mo-c': color || '#E41373', '--mo-o': 0.9, ...(estilo || {}) }}>
      <section className="ent-cab">
        <div className={'ent-emb ' + forma} style={{ '--c': color || '#E41373' }}>{emblema}</div>
        <div className="ent-tx">
          {tag ? <span className="tag">{tag}</span> : null}
          <h1 className="hero-ev largo">{nombre}</h1>
          {sub ? <div className="ent-sub">{sub}</div> : null}
          {acciones ? <div className="ent-acc">{acciones}</div> : null}
        </div>
        <dl className="ent-num">{numeros.map(([t, d, cls]) => <div key={t} className={cls || ''}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
      </section>
      {extra}
    </div>
  );
}

// ── el índice pegado arriba: qué tiene la página y cuántos; se marca el que se está leyendo ──
// items: [id de la sección en el DOM, nombre, cuántos]. Los chips de las que no se dibujaron no salen
function Indice({ items }) {
  const { act, ir, tira, hay } = useIndice(items.map((x) => x[0]));
  const xs = items.filter(([id]) => hay.includes(id));
  if (xs.length < 2) return null;
  return (
    <nav className="ent-ix" aria-label="Qué hay en esta página">
      <ol ref={tira}>{xs.map(([id, t, n]) => (
        <li key={id}><button type="button" className={act === id ? 'on' : ''} aria-current={act === id ? 'true' : undefined} onClick={() => ir(id)}>
          {t}{n != null ? <em>{num(n)}</em> : null}</button></li>
      ))}</ol>
    </nav>
  );
}

// ── «los otros»: celdas iguales con su emblema, su nombre y un número; la última lleva a la lista entera. En filas
// parejas: con seis columnas fijas, veinte celdas eran 6/6/6/2 (la cuenta es la de las Ligas) ──
function Otros({ items, href, et }) {
  const n = items.length + 1;
  return (
    <ul className={'ent-otros' + (n <= 3 ? ' pocos' : '')} style={{ '--cols': Math.ceil(n / Math.ceil(n / 6)) }}>
      {items.map(([k, ir, img, nom, d]) => (
        <li key={k}><a href={ir}>{img}<b>{nom}</b>{d ? <small>{d}</small> : null}</a></li>
      ))}
      <li className="todos"><a href={href}><Ico n="flecha" t={20} /><b>{et}</b></a></li>
    </ul>
  );
}

// ── una lista larga de gente: el puesto adentro, la cara, el nombre, el puesto en la Liga y sus números; en la compu en
// dos columnas que se leen de arriba abajo (con la cabecera de cada columna una vez, no en cada fila), y en el celular
// 15 y «Ver todos». El número es de los miembros: quien está fuera de concurso va con «—», como en el Ranking ──
const TOPE_CEL = 15;
function Gente({ liga, gente, roles, pend, conFlag }) {
  const [todos, setTodos] = useState(false);
  const lista = useRef(null);
  const n = gente.length;
  const corta = n > TOPE_CEL && !todos;
  const dos = n > 8;
  let k = 0;
  const nros = gente.map((f) => (f.pos && !f.fc ? ++k : null));
  // al cerrar, de vuelta al principio de la lista: si no, quedabas 1.300 px más abajo, en «Los otros»
  const alternar = () => {
    if (todos && lista.current) {
      const y = lista.current.getBoundingClientRect().top + window.scrollY - 70;
      if (y < window.scrollY) window.scrollTo({ top: y, behavior: 'smooth' });
    }
    setTodos(!todos);
  };
  return (
    <>
      <div className={'ent-gh' + (dos ? ' dos' : '')} aria-hidden="true">
        {(dos ? [0, 1] : [0]).map((i) => <div key={i}><span>#</span><span /><span>Rapero</span><span>OVR</span><span>PTS</span><span>EV</span></div>)}
      </div>
      <ol ref={lista} className={'ent-gente' + (dos ? ' dos' : '') + (corta ? ' corta' : '')} style={{ '--filas': Math.ceil(n / 2) }}>
        {gente.map((f, i) => (
          <li key={f.k} className={i >= TOPE_CEL ? 'extra' : ''}>
            <button type="button" className="sin-boton ent-f" onClick={() => accion.perfil(f.k)} aria-label={'Ver el perfil de ' + limpio(f.n)}>
              <span className={'ent-pos' + (nros[i] ? '' : ' fc')}>{nros[i] || '—'}</span>
              <Cara liga={liga} k={f.k} nombre={f.n} cls="ent-cara" lazy />
              <span className="ent-n"><b>{limpio(f.n)}{conFlag ? <Bandera cc={f.cc} cls="ent-flag" /> : null}</b>
                <small>{f.fc ? 'fuera de concurso' : f.pos ? '#' + f.pos + ' de la Liga' : 'sin puesto en la Liga'}</small>
                {roles && roles[f.k] && roles[f.k] !== 'miembro' ? <RolCrew rol={roles[f.k]} /> : null}
                {pend ? <SinVerificar hasta={pend[f.k]} /> : null}</span>
              <span className="ent-d"><b>{f.ovr || '—'}</b><small>OVR</small></span>
              <span className="ent-d"><b>{num(f.pts || 0)}</b><small>PTS</small></span>
              <span className="ent-d ev"><b>{f.ev || 0}</b><small>EV</small></span>
            </button>
          </li>
        ))}
      </ol>
      {n > TOPE_CEL ? <button type="button" className="ent-mas" aria-expanded={!corta} onClick={alternar}>{corta ? 'Ver los ' + n : 'Ver menos'}</button> : null}
    </>
  );
}

function NoEsta({ que, href, volver }) {
  return (
    <Sec id="ent-no" titulo={que}>
      <p className="pronto-p">No tiene gente en la temporada. <a className="te-link" href={href}>{volver}</a></p>
    </Sec>
  );
}

// ═══ EL SERVIDOR ═══════════════════════════════════════════════════════════════════════════════════════════════════
export function PerfilSv({ liga, sv, enc }) {
  // los MES AWARDS del servidor llegan por su cuenta: pedirlos acá también (va a la misma memoria) hace que la página se
  // vuelva a dibujar cuando llegan, y el índice se entera de que la sección apareció
  useSalon();
  const s = liga.svs[sv];
  if (!s) {
    return (
      <Sec id="sv-no" titulo="Servidor">
        <p className="pronto-p">No hay ningún servidor con esa sigla en la Liga. <a className="te-link" href="#/socios">Ver los servidores</a></p>
      </Sec>
    );
  }
  const mm = liga.d.mult || {};
  const x = (mm.sv || {})[sv];
  const gente = liga.oficiales().filter((f) => f.sv === sv).slice(0, 10);
  const vivo = liga.vivo().filter((e) => e.sv === sv);
  const prox = liga.luego().filter((e) => e.sv === sv).slice(0, 6);
  const llaves = liga.llaves().filter((ll) => ll.sv === sv).slice(0, 6);
  const notas = liga.muroLimpio().filter((it) => it.tipo !== 'anuncio' && liga.svDe(it) === sv).map((it) => liga.itemMuro(it)).filter(Boolean).slice(0, 8);
  const buscados = ((liga.d.mw || {}).b || []).filter((b) => b.sv === sv);
  const g = liga.doradoVigente();
  const par = ((mm.guerra || {}).pares || []).find((p) => p.includes(sv));
  const meta = (mm.metas || {})[sv];
  const va = (mm.meta_va || {})[sv] || 0;
  const semana = [];
  if (g && g.sv === sv) semana.push(['DORADO ×3', limpio(g.n) + ' · ' + (utc(g.t) <= liga.ahora ? 'se juega ahora' : liga.dia(g.t))]);
  if (par) semana.push(['GUERRA', 'contra ' + siglaDe(par[0] === sv ? par[1] : par[0]) + ': gana el que más puntos hace por persona']);
  if (meta) semana.push(['META', va + ' de ' + meta + ' personas' + (va >= meta ? ' · cumplida' : ''), Math.min(100, Math.round((100 * va) / meta))]);
  const fechas = [];
  vivo.forEach((e) => fechas.push({ c: 'vivo', dia: 'HOY', hora: '● EN VIVO', ev: limpio(e.nombre), det: e.modalidad || '', link: (aDiscord(liga, e, true) || {}).url }));
  prox.forEach((e) => fechas.push({ c: liga.esDorado(e.nombre, e.sv) ? 'dorado' : '', dia: liga.dia(e.cuando).split(' ')[0].toUpperCase(),
    hora: liga.dia(e.cuando), ev: limpio(e.nombre), det: e.modalidad || '', link: (aDiscord(liga, e, false) || {}).url }));
  llaves.forEach((ll) => {
    const c = liga.campeon(ll);
    fechas.push({ c: 'hecho', dia: liga.cuando(liga.fechaLlave(ll)).toUpperCase(), hora: 'TERMINÓ · ' + ll.participantes + ' raperos',
      ev: limpio(ll.nombre), det: (c.length > 1 ? 'Campeones: ' : 'Campeón: ') + c.join(' y '), llave: ll.n });
  });
  fechas.splice(5);
  const otros = Object.values(liga.svs).filter((o) => o.sv !== sv).sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const items = [['ent-cartas', 'Los que mandan', gente.length], ['ent-eventos', 'Eventos', fechas.length], ['ent-ultimo', 'Lo último', notas.length],
    ['sv-mes', 'MES AWARDS', null], ['sv-promos', 'Promos', null], ['ent-buscados', 'Se busca', buscados.length], ['ent-otros', 'Los otros', otros.length]];
  return (
    <>
      <Portada forma="cuadrado" color={s.color} nombre={s.nombre || siglaDe(sv)}
        estilo={{ '--mo-logo': 'url("' + liga.logo(sv, true) + '")', ...silueta(sv, s.color) }}
        emblema={<img alt="" src={liga.logo(sv, true)} />}
        tag={s.tag ? String(s.tag).toUpperCase() : ''}
        sub={<>{siglaDe(sv)}{s.miembros ? ' · ' + num(s.miembros) + ' miembros en su Discord' : ''}
          {(s.redes || []).length ? <nav className="ent-redes" aria-label="Sus redes">{s.redes.map(([r, u]) => <a key={r} href={u} target="_blank" rel="noopener noreferrer">{REDES[r] || r} ↗</a>)}</nav> : null}</>}
        acciones={<>{s.invita ? <a className="btn verde" href={s.invita} target="_blank" rel="noopener noreferrer">Entrar al servidor ↗</a> : null}
          <Compartir cls="btn borde" url={enlace('#/sv/' + siglaDe(sv))} texto={(s.nombre || siglaDe(sv)) + ' en la Liga Global'} /></>}
        // la celda de la semana se resalta sólo si suma: un «×0,75» o un «×1» resaltados al lado de tres ceros decían lo contrario
        numeros={[['ESTA SEMANA', x ? mult(x) : '×1', x > 1 ? 'dest sube' : ''], ['RAPEROS', num(s.n || 0)], ['PUNTOS', num(s.pts || 0)], ['EVENTOS', num(s.ev || 0)]]}
        extra={semana.length ? (
          <ul className="ent-semana">
            {semana.map(([t, d, pct]) => (
              <li key={t} className={t.startsWith('DORADO') ? 'dor' : ''}><b>{t}</b><span>{d}</span>
                {pct != null ? <i className="ent-meta" aria-hidden="true"><i style={{ width: pct + '%' }} /></i> : null}</li>
            ))}
          </ul>
        ) : null} />
      <Indice items={items} />
      {gente.length ? (
        <Sec id="ent-cartas" titulo={'Los que mandan en ' + siglaDe(sv)} enlace="Todos los raperos" href="#/ranking" extra="negra">
          <div className="rail mcs2">{gente.map((f) => <McPersona key={f.k} liga={liga} f={f} cual={liga.cartaDe(f.k, { sv }) || 'temporada'} />)}</div>
        </Sec>
      ) : null}
      {fechas.length ? (
        <Sec id="ent-eventos" titulo="Sus eventos" enlace="Calendario" href="#/eventos">
          <div className="rail fechas2">
            {fechas.map((f, i) => {
              const cuerpo = <><div className="f-dia"><b>{f.dia}</b></div><img alt="" src={liga.logo(sv)} /><b className="f-ev">{f.ev}</b>
                <span className="f-hora">{f.hora}</span><small>{f.det}</small></>;
              if (f.llave) return <button type="button" key={i} className={'fecha ' + f.c} onClick={() => accion.llave(f.llave)}>{cuerpo}</button>;
              if (f.link) return <a key={i} className={'fecha ' + f.c} href={f.link} target="_blank" rel="noopener noreferrer">{cuerpo}</a>;
              return <article key={i} className={'fecha ' + f.c}>{cuerpo}</article>;
            })}
          </div>
        </Sec>
      ) : null}
      {notas.length ? (
        <Sec id="ent-ultimo" titulo={'Lo último de ' + siglaDe(sv)} enlace="Publicaciones" href="#/publicaciones">
          <ul className="notas ent-notas">{notas.map((n, i) => <Nota key={i} liga={liga} x={n} />)}</ul>
        </Sec>
      ) : null}
      {/* sin envoltorio: entre dos secciones negras, uno de más cortaba `.sec.negra+.sec.negra` y dejaba una franja clara */}
      <MesSv liga={liga} sv={sv} enc={enc} />
      <PromosSv liga={liga} sv={sv} />
      {buscados.length ? (
        <Sec id="ent-buscados" titulo={'Se busca en ' + siglaDe(sv)} enlace="Most Wanted" href="#/ranking/mw" extra="negra">
          <div className="mw-rail" style={{ '--cols': Math.ceil(buscados.length / Math.ceil(buscados.length / 6)) }}>{buscados.map((b) => <Poster key={b.k} liga={liga} b={b} />)}</div>
        </Sec>
      ) : null}
      <Sec id="ent-otros" titulo="Los otros servidores">
        <Otros href="#/socios" et="Todos los socios"
          // los puntos si tiene; si no, su gente: «0 pts» debajo de un socio se leía mal
          // eslint-disable-next-line react/jsx-key
          items={otros.map((o) => [o.sv, '#/sv/' + siglaDe(o.sv), <img className="ent-o-img" alt="" src={liga.logo(o.sv)} style={{ boxShadow: '3px 3px 0 ' + (o.color || '#030304') }} />,
            siglaDe(o.sv), o.pts ? num(o.pts) + ' pts' : o.miembros ? num(o.miembros) + ' miembros' : ''])} />
      </Sec>
    </>
  );
}

// ═══ LA CREW ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// 🪜 el tier como una escalera: los siete, los pasados llenos, el siguiente llenándose con lo de esta semana, y abajo un
// solo renglón: dónde está y cuánto le falta (en el celular, los nombres sueltos debajo de cada escalón se pisaban)
function Escalera({ T, id }) {
  if (!T || !T.crews || !T.nombres) return null;
  const [n, pts, , antes] = T.crews[id] || [0, 0, 0, null];
  const sig = n + 1 < T.nombres.length ? n + 1 : null;
  const sube = sig !== null ? T.sube[n] : null;
  const juegan = sig !== null ? T.juegan[sig] : 0;
  const baja = T.baja[n];
  const pct = sube ? Math.min(100, Math.round((100 * pts) / sube)) : 100;
  const vino = antes === null || antes === undefined || antes === n ? '' : antes < n ? 'Subió la semana pasada' : 'Bajó la semana pasada';
  return (
    <div className="ent-esca">
      <ol className="ent-esca-l" aria-label="Los tiers de las crews">
        {T.nombres.map((nm, i) => (
          <li key={nm} className={i < n ? 'paso' : i === n ? 'aca' : i === sig ? 'sig' : ''} style={{ '--c': T.colores[i] }} title={nm}>
            <i>{i === sig ? <u style={{ width: pct + '%' }} /> : null}</i>
          </li>
        ))}
      </ol>
      <div className="ent-esca-n">
        <span><b>{T.nombres[n]}</b>{vino ? <small>{vino}</small> : null}</span>
        {sube ? <span className="sig" aria-label={pct + '% de lo que pide ' + T.nombres[sig]}><b>{T.nombres[sig]}</b><small>{num(pts)} de {num(sube)}</small></span>
          : <span className="sig"><small>El tier más alto</small></span>}
      </div>
      {sube ? <p className="ent-nota">Para subir: {num(sube)} puntos en la semana{juegan > 1 ? ' y que jueguen ' + juegan + ' de la crew' : ''}.
        {baja ? <> Con menos de {num(baja)}, baja a {T.nombres[n - 1]}.</> : null}</p>
        : baja ? <p className="ent-nota">Con menos de {num(baja)} puntos en la semana, baja a {T.nombres[n - 1]}.</p> : null}
      <p className="ent-nota">{n >= T.tarjeta ? 'La crew tiene desbloqueada su tarjeta personalizable.' : 'En ' + T.nombres[T.tarjeta] + ' se desbloquea la tarjeta de la crew.'}</p>
    </div>
  );
}

export function PaginaCrew({ liga, id }) {
  useCrews();
  const cs = liga.d.crews || [];
  const viva = crewViva(id);
  const c0 = cs.find((x) => clave(x) === id) || cs.find((x) => limpio(x.crew).toLowerCase() === limpio(id).toLowerCase())
    || (viva ? cs.find((x) => clave(x) === viva.id) : null);
  if (!c0 && !viva) return <NoEsta que="Esa crew" href="#/crews" volver="Ver las crews" />;
  const c = Object.assign({}, c0 || { crew: viva.nombre, clave: viva.id, n: 0, pts: 0, gente: [] }, viva && viva.logo ? { logo: viva.logo } : {});
  const nombre = limpio((viva && viva.nombre) || c.crew);
  const conPuesto = cs.filter((x) => x.rk !== 0);
  const pos = c0 ? conPuesto.indexOf(c0) + 1 : 0;
  const roles = viva ? Object.fromEntries(viva.gente.map(([k, r]) => [k, r])) : null;
  const pend = viva ? Object.fromEntries(viva.gente.filter((g) => g[3]).map((g) => [g[0], g[3]])) : null;
  // ⚠️ por puesto y no por rol: el número grande de la lista es el puesto adentro de la crew, y ordenada por rol el «1»
  // era el Líder (#88 de la Liga) y el «2», el mejor de la crew. El rol va en su chip
  const gente = (viva ? viva.gente.map(([k]) => liga.T[k] || { k, n: k }) : (c.gente || []).map((n) => liga.fila(n)).filter(Boolean)).sort(porLugar);
  const jugaron = gente.filter((f) => f.pos || f.o);
  const sinJugar = gente.filter((f) => !(f.pos || f.o));
  const ccs = [...new Set(gente.map((f) => f.cc).filter(Boolean))];
  const mejor = c.mejor ? liga.fila(c.mejor) : null;
  const lider = viva ? viva.gente.find((g) => g[1] === 'lider') : null;
  const T = liga.d.crews_tiers && liga.d.crews_tiers.nombres ? liga.d.crews_tiers : null;
  const tier = T ? ((T.crews || {})[viva ? viva.id : clave(c)] || [0])[0] : 0;
  const color = T ? T.colores[tier] : '#E41373';
  const otras = conPuesto.filter((x) => x !== c0);
  const nGente = viva ? viva.gente.length : c.n || gente.length;
  const items = [['ent-crew', 'La crew', gente.length], ['ent-cartas', 'Los que mandan', cartas(jugaron).length], ['ent-otros', 'Las otras', otras.length]];
  return (
    <>
      <Portada forma="redondo" color={color} nombre={nombre}
        emblema={<CrewCirculo c={c} cls="ent-crew" />}
        // el tier va en la tira, no también en el cartel
        tag={pos ? '#' + pos + ' DE LAS CREWS' : 'SIN PUESTO · HACEN FALTA TRES RAPEROS'}
        sub={<>{ccs.length ? <span className="ent-flags">{ccs.map((cc) => <Bandera key={cc} cc={cc} cls="ent-flag" />)}</span> : null}
          {lider ? <span>Líder: <a className="te-link ent-toque" href={'#/r/' + encodeURIComponent(lider[0])}>{limpio((liga.T[lider[0]] || {}).n || lider[0])}</a></span> : null}</>}
        // «Pedir entrar» arriba, donde el servidor tiene «Entrar al servidor»: abajo quedaba a 1.150 px en el celular
        acciones={<>{viva ? <EntrarCrew c={viva} /> : null}
          <Compartir cls="btn borde" url={enlace('#/crew/' + encodeURIComponent(clave(c)))} texto={nombre + ' en la Liga Global'} /></>}
        numeros={[['TIER', T ? <TierChip n={tier} T={T} /> : '—', 'dest'], ['PUNTOS', num(c.pts || 0)],
          ['POR RAPERO', nGente ? num(Math.round((c.pts || 0) / nGente)) : '—'],
          ['EL MEJOR', mejor ? <a className="te-link ent-toque" href={'#/r/' + encodeURIComponent(mejor.k)}>{limpio(mejor.n)}</a> : limpio(c.mejor || '—')]]} />
      <Indice items={items} />
      <section className="sec ent-crew-s" id="ent-crew">
        <div className="sec-t"><h2>La crew</h2></div>
        <div className="ent-dos">
          <div className="ent-col">
            <h3 className="ent-h">Esta semana</h3>
            {viva ? <CasaCrew liga={liga} c={viva} T={T} /> : null}
            {viva ? <Escalera T={T} id={viva.id} /> : null}
            {viva ? <PanelCrew liga={liga} c={viva} /> : null}
          </div>
          <div className="ent-col">
            <h3 className="ent-h">Su gente<small>{gente.length}</small></h3>
            {jugaron.length ? <Gente liga={liga} gente={jugaron} roles={roles} pend={pend} conFlag /> : null}
            {sinJugar.length ? (
              <div className="ent-sin">
                <span className="ent-sin-t">Todavía no jugaron la temporada · {sinJugar.length}</span>
                <ul>{sinJugar.map((f) => (
                  <li key={f.k}><a href={'#/r/' + encodeURIComponent(f.k)} title={limpio(f.n)}>
                    <Cara liga={liga} k={f.k} nombre={f.n} cls="ent-sin-c" lazy /><small>{limpio(f.n)}</small>
                    {roles && roles[f.k] && roles[f.k] !== 'miembro' ? <RolCrew rol={roles[f.k]} /> : null}</a></li>
                ))}</ul>
              </div>
            ) : null}
            {!gente.length ? <p className="pronto-p">Todavía nadie de la crew jugó la temporada.</p> : null}
          </div>
        </div>
      </section>
      {jugaron.length ? (
        <Sec id="ent-cartas" titulo={'Los que mandan en ' + nombre} extra="negra">
          <div className="rail mcs2">{cartas(jugaron).map((f) => <McPersona key={f.k} liga={liga} f={f} cual={liga.cartaDe(f.k) || 'temporada'} />)}</div>
        </Sec>
      ) : null}
      <Sec id="ent-otros" titulo="Las otras crews">
        <Otros href="#/crews" et="Todas las crews"
          // eslint-disable-next-line react/jsx-key
          items={otras.slice(0, 11).map((x) => [clave(x), '#/crew/' + encodeURIComponent(clave(x)), <CrewCirculo c={x} cls="ent-o-crew" />, limpio(x.crew),
            x.pts ? num(x.pts) + ' pts' : ''])} />
      </Sec>
    </>
  );
}

// ═══ EL PAÍS ═══════════════════════════════════════════════════════════════════════════════════════════════════════
export function PaginaPais({ liga, cc: cc0 }) {
  const cc = String(cc0 || '').toLowerCase();
  const ps = (liga.d.paises || []).filter((p) => p.n);
  const i = ps.findIndex((p) => String(p.cc).toLowerCase() === cc);
  const P = i >= 0 ? ps[i] : null;
  const gente = (liga.d.tabla || []).filter((f) => String(f.cc).toLowerCase() === cc).sort(porLugar);
  if (!P && !gente.length) return <NoEsta que="Ese país" href="#/ranking/paises" volver="Ver los países" />;
  const nom = nombrePais(cc);
  const pts = P ? P.pts : gente.reduce((a, f) => a + (f.pts || 0), 0);
  const n = P ? P.n : gente.length;
  const crews = (liga.d.crews || []).filter((c) => (c.gente || []).some((x) => { const f = liga.fila(x); return f && String(f.cc).toLowerCase() === cc; }));
  const otros = ps.filter((p) => String(p.cc).toLowerCase() !== cc);
  const items = [['ent-cartas', 'Los que mandan', cartas(gente).length], ['ent-gente', 'Toda su gente', gente.length],
    ['ent-crews', 'Sus crews', crews.length], ['ent-otros', 'Los otros', otros.length]];
  return (
    <>
      {/* el puesto va en la tira y no también en el cartel; la gente, en «Toda su gente» y en el índice */}
      <Portada forma="bandera" color="#E41373" nombre={nom}
        emblema={<img alt={'La bandera de ' + nom} src={'/banderas/g/' + cc + '.webp'} />}
        acciones={<Compartir cls="btn borde" url={enlace('#/pais/' + cc)} texto={nom + ' en la Liga Global'} />}
        numeros={[['PUESTO', P ? '#' + (i + 1) + ' de ' + ps.length : '—', 'dest'], ['PUNTOS', num(pts || 0)],
          ['POR RAPERO', n ? num(Math.round((pts || 0) / n)) : '—'],
          ['EL MEJOR', gente[0] ? <a className="te-link ent-toque" href={'#/r/' + encodeURIComponent(gente[0].k)}>{limpio(gente[0].n)}</a> : '—']]} />
      <Indice items={items} />
      {gente.length ? (
        <Sec id="ent-cartas" titulo={'Los que mandan en ' + nom} extra="negra">
          <div className="rail mcs2">{cartas(gente).map((f) => <McPersona key={f.k} liga={liga} f={f} cual={liga.cartaDe(f.k, { pais: cc }) || 'temporada'} />)}</div>
        </Sec>
      ) : null}
      <Sec id="ent-gente" titulo={'Todo ' + nom} bajada={'El puesto dentro de ' + nom + ', de los ' + raperos(gente.length) + ' que jugaron la temporada.'}>
        <Gente liga={liga} gente={gente} />
      </Sec>
      {crews.length ? (
        <Sec id="ent-crews" titulo={'Sus crews'}>
          <Otros href="#/crews" et="Todas las crews"
            // eslint-disable-next-line react/jsx-key
            items={crews.map((c) => [clave(c), '#/crew/' + encodeURIComponent(clave(c)), <CrewCirculo c={c} cls="ent-o-crew" />, limpio(c.crew), c.pts ? num(c.pts) + ' pts' : ''])} />
        </Sec>
      ) : null}
      <Sec id="ent-otros" titulo="Los otros países">
        <Otros href="#/ranking/paises" et="El ranking de países"
          // eslint-disable-next-line react/jsx-key
          items={otros.map((p) => { const c2 = String(p.cc).toLowerCase(); return [c2, '#/pais/' + c2, <Bandera cc={c2} cls="ent-o-flag" />, nombrePais(c2), raperos(p.n)]; })} />
      </Sec>
    </>
  );
}
