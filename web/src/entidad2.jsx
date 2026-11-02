// 🏟️ SERVIDOR, PAÍS Y CREW, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes». Se ven con `?prev=remake`
// (App.jsx `REMAKE`); sin la marca siguen servidor.jsx y grupo.jsx. Las tres son la misma familia —una portada con el
// emblema, sus números, su gente y «los otros»— y desde acá salen del mismo esqueleto, con lo que dejó el research de 21st
// (scratchpad/remake2/research_entidades.md):
// - LA PORTADA: el emblema con la forma de cada una (el logo cuadrado del servidor, la bandera 3:2, el escudo redondo de
//   la crew) con la sombra dura de su color, y una tira de números donde el primero es el que la define.
// - UN ÍNDICE PEGADO ARRIBA con lo que tiene cada página y cuántos («Cartas 10 · Gente 51 · …»).
// - LA LISTA LARGA DEL PAÍS EN DOS COLUMNAS en la compu (51 filas eran 2.500 px con 700 vacíos en cada fila), y en el
//   celular 15 y «Ver los 51»; el puesto en el país grande, el de la Liga chico, sin la bandera repetida.
// - LA CREW: su semana y su tier al lado del plantel (la mitad derecha estaba vacía), el tier como una escalera, el
//   plantel con su rol, y los que todavía no jugaron juntos.
// - «LOS OTROS» EN CELDAS IGUALES, con un número cada uno.
// ⚠️ Todo sale del payload, como en servidor.jsx y grupo.jsx: `svs`, `paises`, `crews`, `crews_tiers`, la tabla, las
// llaves, los próximos, el muro, Se busca. Ningún color de servidor ni de tier se escribe acá.
import { useEffect, useState } from 'react';
import { limpio, mult, num, siglaDe, utc } from './liga.js';
import { Bandera, Cara, Compartir, Ico, Poster, Sec, aDiscord, accion, enlace, nombrePais, silueta } from './piezas.jsx';
import { McPersona } from './medio.jsx';
import { CrewCirculo } from './arriba.jsx';
import { crewViva, useCrews } from './crews.js';
import { CasaCrew, EntrarCrew, PanelCrew, RolCrew, SinVerificar, TierChip } from './crewpanel.jsx';
import { MesSv, Nota, PromosSv, REDES } from './servidor.jsx';
import CSS_PAGINA from './css/entidad2.css?inline';
import { usarCss } from './css.js';

usarCss('entidad2', CSS_PAGINA);

const clave = (c) => c.clave || c.crew;
const porLugar = (a, b) => (a.o || a.pos || 999) - (b.o || b.pos || 999);
// las cartas de arriba: de a filas enteras de cinco
const cartas = (gente) => gente.slice(0, gente.length >= 10 ? 10 : gente.length >= 5 ? 5 : gente.length);
const irA = (id) => {
  const el = document.getElementById('inicio-nuevo');
  const s = el && el.shadowRoot ? el.shadowRoot.getElementById('ent-' + id) : null;
  if (s) window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - 60, behavior: 'smooth' });
};

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
function Indice({ items }) {
  const [act, setAct] = useState(items.length ? items[0][0] : '');
  useEffect(() => {
    const host = document.getElementById('inicio-nuevo');
    const raiz = host && host.shadowRoot;
    if (!raiz || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) setAct(e.target.id.replace(/^ent-/, '')); });
    }, { rootMargin: '-30% 0px -65% 0px' });
    items.forEach(([id]) => { const s = raiz.getElementById('ent-' + id); if (s) io.observe(s); });
    return () => io.disconnect();
  }, [items.map((x) => x[0]).join('|')]);
  if (items.length < 2) return null;
  return (
    <nav className="ent-ix" aria-label="Qué hay en esta página">
      <ol>{items.map(([id, t, n]) => (
        <li key={id}><button type="button" className={act === id ? 'on' : ''} aria-current={act === id ? 'true' : undefined} onClick={() => irA(id)}>
          {t}{n != null ? <em>{num(n)}</em> : null}</button></li>
      ))}</ol>
    </nav>
  );
}

// ── «los otros»: celdas iguales con su emblema, su nombre y un número; la última lleva a la lista entera ──
function Otros({ items, href, et }) {
  return (
    <ul className="ent-otros">
      {items.map(([k, ir, img, n, d]) => (
        <li key={k}><a href={ir}>{img}<b>{n}</b>{d ? <small>{d}</small> : null}</a></li>
      ))}
      <li className="todos"><a href={href}><Ico n="flecha" t={20} /><b>{et}</b></a></li>
    </ul>
  );
}

// ── una lista larga de gente: el puesto adentro, la cara, el nombre, el puesto en la Liga y sus números; en la compu en
// dos columnas que se leen de arriba abajo, y en el celular 15 y «Ver todos» ──
const TOPE_CEL = 15;
function Gente({ liga, gente, roles, pend, conFlag, pos }) {
  const [todos, setTodos] = useState(false);
  const n = gente.length;
  const corta = n > TOPE_CEL && !todos;
  return (
    <>
      <ol className={'ent-gente' + (n > 8 ? ' dos' : '') + (corta ? ' corta' : '')} style={{ '--filas': Math.ceil(n / 2) }}>
        {gente.map((f, i) => (
          <li key={f.k} className={i >= TOPE_CEL ? 'extra' : ''}>
            <button type="button" className="sin-boton ent-f" onClick={() => accion.perfil(f.k)} aria-label={'Ver el perfil de ' + limpio(f.n)}>
              <span className="ent-pos">{pos ? pos(f, i) : i + 1}</span>
              <Cara liga={liga} k={f.k} nombre={f.n} cls="ent-cara" lazy />
              <span className="ent-n"><b>{limpio(f.n)}{conFlag ? <Bandera cc={f.cc} cls="ent-flag" /> : null}</b>
                <small>{f.pos ? '#' + f.pos + ' de la Liga' : 'sin puesto en la Liga'}</small>
                {roles && roles[f.k] && roles[f.k] !== 'miembro' ? <RolCrew rol={roles[f.k]} /> : null}
                {pend ? <SinVerificar hasta={pend[f.k]} /> : null}</span>
              <span className="ent-d"><b>{f.ovr || '—'}</b><small>OVR</small></span>
              <span className="ent-d"><b>{num(f.pts || 0)}</b><small>PTS</small></span>
              <span className="ent-d ev"><b>{f.ev || 0}</b><small>EV</small></span>
            </button>
          </li>
        ))}
      </ol>
      {n > TOPE_CEL ? <button type="button" className="ent-mas" aria-expanded={!corta} onClick={() => setTodos(!todos)}>{corta ? 'Ver los ' + n : 'Ver menos'}</button> : null}
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
  const items = [gente.length ? ['cartas', 'Los que mandan', gente.length] : null, fechas.length ? ['eventos', 'Eventos', fechas.length] : null,
    notas.length ? ['ultimo', 'Lo último', notas.length] : null, ['mes', 'MES AWARDS', null],
    buscados.length ? ['buscados', 'Se busca', buscados.length] : null, ['otros', 'Los otros', otros.length]].filter(Boolean);
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
        numeros={[['ESTA SEMANA', x ? mult(x) : '×1', 'dest' + (x > 1 ? ' sube' : '')], ['RAPEROS', num(s.n || 0)], ['PUNTOS', num(s.pts || 0)], ['EVENTOS', num(s.ev || 0)]]}
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
      <div id="ent-mes"><MesSv liga={liga} sv={sv} enc={enc} /></div>
      <PromosSv liga={liga} sv={sv} />
      {buscados.length ? (
        <Sec id="ent-buscados" titulo={'Se busca en ' + siglaDe(sv)} enlace="Most Wanted" href="#/ranking/mw" extra="negra">
          <div className="mw-rail" style={{ '--cols': Math.ceil(buscados.length / Math.ceil(buscados.length / 6)) }}>{buscados.map((b) => <Poster key={b.k} liga={liga} b={b} />)}</div>
        </Sec>
      ) : null}
      <Sec id="ent-otros" titulo="Los otros servidores">
        <Otros href="#/socios" et="Todos los socios"
          // eslint-disable-next-line react/jsx-key
          items={otros.map((o) => [o.sv, '#/sv/' + siglaDe(o.sv), <img className="ent-o-img" alt="" src={liga.logo(o.sv)} style={{ boxShadow: '3px 3px 0 ' + (o.color || '#030304') }} />,
            siglaDe(o.sv), num(o.pts || 0) + ' pts'])} />
      </Sec>
    </>
  );
}

// ═══ LA CREW ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// 🪜 el tier como una escalera: los siete, el de la crew lleno, y cuánto le falta para el siguiente esta semana
function Escalera({ T, id }) {
  if (!T || !T.crews || !T.nombres) return null;
  const [n, pts, jug] = T.crews[id] || [0, 0, 0];
  const sig = n + 1 < T.nombres.length ? n + 1 : null;
  const sube = sig !== null ? T.sube[n] : null;
  const juegan = sig !== null ? T.juegan[sig] : 0;
  const baja = T.baja[n];
  const pct = sube ? Math.min(100, Math.round((100 * pts) / sube)) : 100;
  return (
    <div className="ent-esca">
      <ol className="ent-esca-l" aria-label="Los tiers de las crews">
        {T.nombres.map((nm, i) => (
          <li key={nm} className={i < n ? 'paso' : i === n ? 'aca' : i === sig ? 'sig' : ''} style={{ '--c': T.colores[i] }} title={nm}>
            <i />{i === n || i === sig ? <b>{nm}</b> : null}
          </li>
        ))}
      </ol>
      <p className="ent-esca-t">Esta semana: <b>{num(pts)} puntos</b> · {jug === 1 ? 'jugó 1' : 'jugaron ' + jug} de la crew</p>
      {sube ? (
        <>
          <div className="ent-esca-b" role="img" aria-label={pct + '% de lo que pide ' + T.nombres[sig]}><i style={{ width: pct + '%', background: T.colores[sig] }} /></div>
          <p className="ent-nota">Para subir a <b>{T.nombres[sig]}</b>: {num(sube)} puntos en la semana{juegan > 1 ? ' y que jueguen ' + juegan + ' de la crew' : ''}.
            {baja ? <> Con menos de {num(baja)}, baja a {T.nombres[n - 1]}.</> : null} Cierra el lunes a las 11 AM (hora del este).</p>
        </>
      ) : <p className="ent-nota">El tier más alto.{baja ? <> Con menos de {num(baja)} puntos en la semana, baja a {T.nombres[n - 1]}.</> : null}</p>}
      <p className="ent-nota">{n >= T.tarjeta ? 'La crew tiene desbloqueada su tarjeta personalizable.' : 'En ' + T.nombres[T.tarjeta] + ' se desbloquea la tarjeta de la crew.'}</p>
    </div>
  );
}

const ORDEN_ROL = { lider: 0, colider: 1, veterano: 2, miembro: 3 };
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
  const gente = (viva ? viva.gente.map(([k]) => liga.T[k] || { k, n: k }) : (c.gente || []).map((n) => liga.fila(n)).filter(Boolean))
    .sort((a, b) => (roles ? (ORDEN_ROL[roles[a.k]] ?? 9) - (ORDEN_ROL[roles[b.k]] ?? 9) : 0) || porLugar(a, b));
  const jugaron = gente.filter((f) => f.pos || f.o);
  const sinJugar = gente.filter((f) => !(f.pos || f.o));
  const ccs = [...new Set(gente.map((f) => f.cc).filter(Boolean))];
  const mejor = c.mejor ? liga.fila(c.mejor) : null;
  const lider = viva ? viva.gente.find((g) => g[1] === 'lider') : null;
  const T = liga.d.crews_tiers && liga.d.crews_tiers.nombres ? liga.d.crews_tiers : null;
  const tier = T ? ((T.crews || {})[viva ? viva.id : clave(c)] || [0])[0] : 0;
  const color = T ? T.colores[tier] : '#E41373';
  const otras = conPuesto.filter((x) => x !== c0);
  const items = [['crew', 'La crew', gente.length], jugaron.length ? ['cartas', 'Los que mandan', Math.min(10, jugaron.length)] : null,
    ['otros', 'Las otras', otras.length]].filter(Boolean);
  return (
    <>
      <Portada forma="redondo" color={color} nombre={nombre}
        emblema={<CrewCirculo c={c} cls="ent-crew" />}
        tag={(T ? T.nombres[tier].toUpperCase() + ' · ' : '') + (pos ? '#' + pos + ' DE LAS CREWS' : 'SIN PUESTO · HACEN FALTA TRES RAPEROS')}
        sub={<>{ccs.length ? <span className="ent-flags">{ccs.map((cc) => <Bandera key={cc} cc={cc} cls="ent-flag" />)}</span> : null}
          {lider ? <span>Líder: <a className="te-link" href={'#/r/' + encodeURIComponent(lider[0])}>{limpio((liga.T[lider[0]] || {}).n || lider[0])}</a></span> : null}</>}
        acciones={<Compartir cls="btn borde" url={enlace('#/crew/' + encodeURIComponent(clave(c)))} texto={nombre + ' en la Liga Global'} />}
        numeros={[['TIER', T ? <TierChip n={tier} T={T} /> : '—', 'dest'], ['RAPEROS', num(viva ? viva.gente.length : c.n || gente.length)], ['PUNTOS', num(c.pts || 0)],
          ['EL MEJOR', mejor ? <a className="te-link" href={'#/r/' + encodeURIComponent(mejor.k)}>{limpio(mejor.n)}</a> : limpio(c.mejor || '—')]]} />
      <Indice items={items} />
      <section className="sec ent-crew-s" id="ent-crew">
        <div className="sec-t"><h2>La crew</h2></div>
        <div className="ent-dos">
          <div className="ent-col">
            {viva ? <CasaCrew liga={liga} c={viva} T={T} /> : null}
            {viva ? <Escalera T={T} id={viva.id} /> : null}
            {viva ? <EntrarCrew c={viva} /> : null}
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
          <div className="rail mcs2">{cartas(jugaron.slice().sort(porLugar)).map((f) => <McPersona key={f.k} liga={liga} f={f} cual={liga.cartaDe(f.k) || 'temporada'} />)}</div>
        </Sec>
      ) : null}
      <Sec id="ent-otros" titulo="Las otras crews">
        <Otros href="#/crews" et="Todas las crews"
          // eslint-disable-next-line react/jsx-key
          items={otras.slice(0, 11).map((x) => [clave(x), '#/crew/' + encodeURIComponent(clave(x)), <CrewCirculo c={x} cls="ent-o-crew" />, limpio(x.crew), num(x.pts || 0) + ' pts'])} />
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
  const items = [gente.length ? ['cartas', 'Los que mandan', Math.min(10, gente.length)] : null, ['gente', 'Toda su gente', gente.length],
    crews.length ? ['crews', 'Sus crews', crews.length] : null, ['otros', 'Los otros', otros.length]].filter(Boolean);
  return (
    <>
      <Portada forma="bandera" color="#E41373" nombre={nom}
        emblema={<img alt={'La bandera de ' + nom} src={'/banderas/g/' + cc + '.webp'} />}
        tag={P ? '#' + (i + 1) + ' DE LOS PAÍSES' : ''}
        acciones={<Compartir cls="btn borde" url={enlace('#/pais/' + cc)} texto={nom + ' en la Liga Global'} />}
        numeros={[['PUESTO', P ? '#' + (i + 1) : '—', 'dest'], ['RAPEROS', num(n)], ['PUNTOS', num(pts || 0)],
          ['EL MEJOR', gente[0] ? <a className="te-link" href={'#/r/' + encodeURIComponent(gente[0].k)}>{limpio(gente[0].n)}</a> : '—']]} />
      <Indice items={items} />
      {gente.length ? (
        <Sec id="ent-cartas" titulo={'Los que mandan en ' + nom} extra="negra">
          <div className="rail mcs2">{cartas(gente).map((f) => <McPersona key={f.k} liga={liga} f={f} cual={liga.cartaDe(f.k, { pais: cc }) || 'temporada'} />)}</div>
        </Sec>
      ) : null}
      <Sec id="ent-gente" titulo={'Todo ' + nom} bajada={'El puesto dentro de ' + nom + ', de los ' + num(gente.length) + ' que jugaron la temporada.'}>
        <Gente liga={liga} gente={gente} />
      </Sec>
      {crews.length ? (
        <Sec id="ent-crews" titulo={'Sus crews'}>
          <Otros href="#/crews" et="Todas las crews"
            // eslint-disable-next-line react/jsx-key
            items={crews.map((c) => [clave(c), '#/crew/' + encodeURIComponent(clave(c)), <CrewCirculo c={c} cls="ent-o-crew" />, limpio(c.crew), num(c.pts || 0) + ' pts'])} />
        </Sec>
      ) : null}
      <Sec id="ent-otros" titulo="Los otros países">
        <Otros href="#/ranking/paises" et="El ranking de países"
          // eslint-disable-next-line react/jsx-key
          items={otros.map((p) => { const c2 = String(p.cc).toLowerCase(); return [c2, '#/pais/' + c2, <Bandera cc={c2} cls="ent-o-flag" />, nombrePais(c2), num(p.n) + ' raperos']; })} />
      </Sec>
    </>
  );
}
