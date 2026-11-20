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
import { Algunos, Bandera, Cara, Compartir, Ico, Poster, Sec, aDiscord, accion, enlace, nombrePais, silueta, usePerfiles } from './piezas.jsx';
import { McPersona } from './medio.jsx';
import { CrewCirculo } from './arriba.jsx';
import { crewViva, useCrews } from './crews.js';
import { CasaCrew, EntrarCrew, PanelCrew, RolCrew, SinVerificar, TierChip } from './crewpanel.jsx';
import { MesSv, PromosSv, REDES } from './servidor.jsx';
import { Banda, SvCampeones, SvCuando, SvDuelo, SvEventos, SvFieles, SvForma, SvHistorias, SvMuro, SvNoche, SvOrganiza, SvProximo, SvComo, SvRecords, SvTabla, SvVistazo, SvVuelven, B2_FLEX, B3_FLEX, aLaDerecha, useBalanceSv, useSvDatos } from './servidor_bandas.jsx';
import { useSalon } from './mesawards.jsx';
import { useIndice } from './indice.js';
import CSS_PAGINA from './css/entidad2.css?inline';
import { usarCss } from './css.js';
import { Movidos, Pelea, PorServidor, peleaDe } from './ranking_a.jsx';

usarCss('entidad2', CSS_PAGINA);

const clave = (c) => c.clave || c.crew;
const porLugar = (a, b) => (a.o || a.pos || 999) - (b.o || b.pos || 999);
// las cartas de arriba: de a filas enteras de cinco
const cartas = (gente) => gente.slice(0, gente.length >= 10 ? 10 : gente.length >= 5 ? 5 : gente.length);
const raperos = (n) => num(n) + (n === 1 ? ' rapero' : ' raperos');
// 🔑 la clave de un nombre, la de `comun/claves.py`: minúsculas, sin tildes, todo lo alfanumérico de cualquier alfabeto
const claveNombre = (s) => String(s || '').normalize('NFD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// ── la portada: el emblema, el nombre, sus acciones y la tira de números (exportada: la usa también el panel del socio,
// socio2.jsx, que es su servidor visto por su dueño) ──
// 🏠 `fondo`: el banner que subió el equipo de un socio (11/11/2026), detrás de todo y con el velo de los fondos de la gente
// 📸 `lado`: lo que va debajo de los números, en la misma columna (sus historias, 18/11/2026). Iban en una fila propia al
// principio de la primera banda y ocupaban 170 px de 1.260: al lado quedaba vacío (1.064×208 en una crew, 456×216 en un
// servidor, medido a 1333). Debajo de los números ya sobraba lugar, porque la columna del nombre es más alta
export function Portada({ emblema, forma, color, tag, nombre, sub, acciones, numeros, extra, estilo, fondo, lado }) {
  const nums = <dl className="ent-num">{numeros.map(([t, d, cls]) => <div key={t} className={cls || ''}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>;
  return (
    <div className={'escena ent-esc' + (fondo ? ' con-fondo' : '')}
      style={{ '--mo-c': color || '#E41373', '--mo-o': 0.9, ...(estilo || {}), ...(fondo ? { '--pf-fondo': 'url("' + fondo + '")' } : {}) }}>
      <section className="ent-cab">
        <div className={'ent-emb ' + forma} style={{ '--c': color || '#E41373' }}>{emblema}</div>
        <div className="ent-tx">
          {tag ? <span className="tag">{tag}</span> : null}
          <h1 className={'hero-ev largo' + (typeof nombre === 'string' && nombre.length > 12 ? ' muy-largo' : '')}>{nombre}</h1>
          {sub ? <div className="ent-sub">{sub}</div> : null}
          {acciones ? <div className="ent-acc">{acciones}</div> : null}
        </div>
        {lado ? <div className="ent-lado">{nums}{lado}</div> : nums}
      </section>
      {extra}
    </div>
  );
}

// ── el índice pegado arriba: qué tiene la página y cuántos; se marca el que se está leyendo ──
// items: [id de la sección en el DOM, nombre, cuántos]. Los chips de las que no se dibujaron no salen (exportado, como la
// portada)
export function Indice({ items }) {
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
export function Otros({ items, href, et }) {
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
// `extra(f)`: una línea más debajo del nombre (el aporte a la crew, en la página de una crew)
export function Gente({ liga, gente, roles, pend, conFlag, extra }) {
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
                {pend ? <SinVerificar hasta={pend[f.k]} /> : null}{extra ? extra(f) : null}</span>
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
  // 🏟️ las bandas (17/11/2026, servidor_bandas.jsx) salen de los eventos de la temporada y del puesto de cada uno
  // (`/api/perfiles`, el mismo que baja el perfil de cada rapero). Antes del `return` de «no está»: son hooks
  const P = usePerfiles();
  const D = useSvDatos(liga, sv, P);
  const raiz = useRef(null);
  const B = useBalanceSv(raiz, sv, !!D);
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
  // 🏟️ «Los que mandan», POR SU OVR DE ESTE SERVIDOR (17/11/2026, Dlx: «deberia ser de OVR de sv mayor a menor»): el
  // número de su carta de Servidor (`osv`, bot/subir_web.py), no el de la Temporada; a igual OVR, el puesto en la Liga
  const gente = liga.oficiales().filter((f) => f.sv === sv)
    .sort((a, b) => (b.osv || 0) - (a.osv || 0) || (a.pos || 999) - (b.pos || 999)).slice(0, 10);
  const buscados = ((liga.d.mw || {}).b || []).filter((b) => b.sv === sv);
  const g = liga.doradoVigente();
  const par = ((mm.guerra || {}).pares || []).find((p) => p.includes(sv));
  const meta = (mm.metas || {})[sv];
  const va = (mm.meta_va || {})[sv] || 0;
  const semana = [];
  if (g && g.sv === sv) semana.push(['DORADO ×3', limpio(g.n) + ' · ' + (utc(g.t) <= liga.ahora ? 'se juega ahora' : liga.dia(g.t))]);
  if (par) semana.push(['GUERRA', 'contra ' + siglaDe(par[0] === sv ? par[1] : par[0]) + ': gana el que más puntos hace por persona']);
  if (meta) semana.push(['META', va + ' de ' + meta + ' personas' + (va >= meta ? ' · cumplida' : ''), Math.min(100, Math.round((100 * va) / meta))]);
  const otros = Object.values(liga.svs).filter((o) => o.sv !== sv).sort((a, b) => (b.pts || 0) - (a.pts || 0));
  // 🎨 EN BANDAS, COMO EL PERFIL DEL RAPERO (17/11/2026, la maqueta privada Y7sWhTvSjVNCRCshPGMXYs: «Sí, pásala»): «Sus
  // eventos» y «Lo último» de antes viven ahora en Su próximo evento, Sus eventos y Su muro
  const items = [['ent-cartas', 'Los que mandan', gente.length], ['sv-muro', 'Muro', null], ['sv-eventos', 'Eventos', D ? D.evs.length : null],
    ['sv-mes', 'MES AWARDS', null], ['sv-promos', 'Promos', null], ['ent-buscados', 'Se busca', buscados.length], ['ent-otros', 'Los otros', otros.length]];
  // las piezas que el balance mueve de lado (`useBalanceSv`): «Sus noches» y «Su temporada»
  const b2 = D ? { 'sv9-duelo': <SvDuelo key="du" liga={liga} D={D} sv={sv} />, 'sv9-org': <SvOrganiza key="or" liga={liga} sv={sv} /> } : {};
  const b3 = D ? { 'sv9-camp': <SvCampeones key="ca" liga={liga} D={D} />, 'sv9-hm': <SvCuando key="hm" D={D} />, 'pf9-rec': <SvRecords key="re" D={D} /> } : {};
  const cartas = gente.length ? (
    <Sec id="ent-cartas" titulo={'Los que mandan en ' + siglaDe(sv)} enlace="Todos los raperos" href="#/ranking" extra="negra">
      <div className="rail mcs2">{gente.map((f) => <McPersona key={f.k} liga={liga} f={f} cual={liga.cartaDe(f.k, { sv }) || 'temporada'} />)}</div>
    </Sec>
  ) : null;
  return (
    <>
      <Portada forma="cuadrado" color={s.color} nombre={s.nombre || siglaDe(sv)} lado={<SvHistorias liga={liga} sv={sv} />}
        estilo={{ '--mo-logo': 'url("' + liga.logo(sv, true) + '")', ...silueta(sv, s.color) }}
        emblema={<img alt="" src={liga.logo(sv, true)} />}
        tag={s.tag ? String(s.tag).toUpperCase() : ''}
        fondo={/^https:\/\//.test(s.banner || '') ? s.banner : ''}
        sub={<>{siglaDe(sv)}{s.miembros ? ' · ' + num(s.miembros) + ' miembros en su Discord' : ''}
          {s.desc ? <p className="ent-desc">{s.desc}</p> : null}
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
      <div className="pf9-pag sv9-pag" ref={raiz}>
        {/* ⏳ «Cargando…» sólo mientras no llegó (18/11/2026): si /api/perfiles falla, `usePerfiles()` da `false` y la
            página cae en la rama sin bandas, que sale del lobby. Con `!P` el «Cargando…» tapaba para siempre «Los que
            mandan», su próximo evento, la tabla y el muro */}
        {P === null ? <div className="cargando">Cargando…</div> : D ? (
          <>
            <Banda color="negra">
              <div className="pf9-g pf9-g-forma">
                <SvForma liga={liga} D={D} />
                <div className="pf9-pila"><SvProximo liga={liga} sv={sv} /><SvComo liga={liga} sv={sv} D={D} /><SvVistazo D={D} sv={sv} /></div>
              </div>
            </Banda>
            {cartas}
            <Banda color="blanca" titulo="Sus noches" link="Calendario" ir="#/eventos">
              <div className="pf9-g pf9-g-2 sv9-b2">
                <div className="pf9-pila"><SvNoche liga={liga} D={D} sv={sv} />{B2_FLEX.filter((c) => !aLaDerecha(B.b2, B2_FLEX, c)).map((c) => b2[c])}</div>
                <div className="pf9-pila"><SvMuro liga={liga} sv={sv} n={B.mu} />{B2_FLEX.filter((c) => aLaDerecha(B.b2, B2_FLEX, c)).map((c) => b2[c])}</div>
              </div>
            </Banda>
            <Banda color="negra" titulo="Su temporada" link="Ranking" ir="#/ranking">
              <div className="pf9-g pf9-g-rail sv9-b3">
                <div className="pf9-pila pf9-t-main"><SvEventos liga={liga} D={D} n={B.ev} />{B3_FLEX.filter((c) => !aLaDerecha(B.b3, B3_FLEX, c)).map((c) => b3[c])}</div>
                <div className="pf9-pila pf9-t-lat"><SvTabla liga={liga} sv={sv} />{B3_FLEX.filter((c) => aLaDerecha(B.b3, B3_FLEX, c)).map((c) => b3[c])}</div>
              </div>
            </Banda>
            <Banda color="blanca" titulo="Su gente" link="Ranking" ir="#/ranking">
              <div className="pf9-g pf9-g-2 sv9-b4">
                <div className="pf9-pila"><SvVuelven D={D} sv={sv} /></div>
                <div className="pf9-pila"><SvFieles liga={liga} D={D} n={B.fi} /></div>
              </div>
            </Banda>
          </>
        ) : (
          // sin eventos en la temporada: lo que sí tiene (su próximo evento, sus historias, su muro) y sus cartas
          <>
            <Banda color="negra">
              <div className="pf9-g sv9-dos"><SvProximo liga={liga} sv={sv} /><SvTabla liga={liga} sv={sv} /></div>
              <SvComo liga={liga} sv={sv} D={null} />
              <SvMuro liga={liga} sv={sv} />
            </Banda>
            {cartas}
          </>
        )}
      </div>
      {/* sin envoltorio: entre dos secciones negras, uno de más cortaba `.sec.negra+.sec.negra` y dejaba una franja clara */}
      <MesSv liga={liga} sv={sv} enc={enc} />
      <PromosSv liga={liga} sv={sv} />
      {/* 🔑 18/11/2026: la key con el nombre de respaldo, como en abajo.jsx: un buscado sin clave (k:'', el nombre no está en
          `gente`) daba keys repetidas en cuanto dos caían en el mismo servidor */}
      {buscados.length ? (
        <Sec id="ent-buscados" titulo={'Se busca en ' + siglaDe(sv)} enlace="Most Wanted" href="#/ranking/mw" extra="negra">
          <div className="mw-rail" style={{ '--cols': Math.ceil(buscados.length / Math.ceil(buscados.length / 6)) }}>{buscados.map((b) => <Poster key={b.k || 'n:' + b.n} liga={liga} b={b} />)}</div>
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
          <li key={nm} className={i < n ? 'paso' : i === n ? 'aca' : i === sig ? 'ent-sig' : ''} style={{ '--c': T.colores[i] }} title={nm}>
            <i>{i === sig ? <u style={{ width: pct + '%' }} /> : null}</i>
          </li>
        ))}
      </ol>
      <div className="ent-esca-n">
        <span><b>{T.nombres[n]}</b>{vino ? <small>{vino}</small> : null}</span>
        {sube ? <span className="ent-sig" aria-label={pct + '% de lo que pide ' + T.nombres[sig]}><b>{T.nombres[sig]}</b><small>{num(pts)} de {num(sube)}</small></span>
          : <span className="ent-sig"><small>El tier más alto</small></span>}
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
  // 🙋 la fila de quien quedó más allá de los 200 del lobby viene en su perfil (`/api/perfiles`, `p[k].f`): con ella sale en
  // la lista con su puesto, su OVR y sus puntos, como los demás. Se pide acá para que llegue (y la página se vuelva a
  // dibujar); la lee `liga.persona()` (18/11/2026: el `filaDe` de acá hacía lo mismo, sin la clave y sin el perfil abierto)
  usePerfiles();
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
  // 🃏 la tabla trae a los primeros de la Liga. `c.gente` son todos los de la crew que jugaron, entren o no: quien jugó y
  // quedó más abajo no es «todavía no jugó» (revisión del 04/11/2026: salían ahí con 4 eventos, y hasta el mejor de la crew)
  const jugo = Object.fromEntries((c.gente || []).map((n) => [claveNombre(n), limpio(n)]));
  const gente = (viva ? viva.gente.map(([k]) => liga.persona(k) || { k, n: jugo[k] || k })
    : (c.gente || []).map((n) => liga.fila(n) || liga.persona(claveNombre(n)) || { k: claveNombre(n), n: limpio(n) })).sort(porLugar);
  // 🗒️ quien jugó va en la lista aunque esté más allá de los 200 (Dlx, 16/11/2026: «elimina esto de jugaron fuera de los
  // 200 primeros… listalos nomás como Krish»). Hasta acá iban aparte, en un recuadro con su cara y su nombre
  const jugaron = gente.filter((f) => f.pos || f.o || jugo[f.k]);
  const sinJugar = gente.filter((f) => !(f.pos || f.o) && !jugo[f.k]);
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
          {/* el nombre con `nombreDe()` (18/11/2026): con `liga.T` un Líder de más allá de los 200 salía con su clave */}
          {lider ? <span>Líder: <a className="te-link ent-toque" href={'#/r/' + encodeURIComponent(lider[0])}>{liga.nombreDe(lider[0])}</a></span> : null}</>}
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
            {[['Todavía no jugaron la temporada', sinJugar]].map(([t, xs]) => (xs.length ? (
              <div className="ent-sin" key={t}>
                <span className="ent-sin-t">{t} · {xs.length}</span>
                <ul>{xs.map((f) => (
                  <li key={f.k}><a href={'#/r/' + encodeURIComponent(f.k)} title={limpio(f.n)}>
                    <Cara liga={liga} k={f.k} nombre={f.n} cls="ent-sin-c" lazy /><small>{limpio(f.n)}</small>
                    {roles && roles[f.k] && roles[f.k] !== 'miembro' ? <RolCrew rol={roles[f.k]} /> : null}</a></li>
                ))}</ul>
              </div>
            ) : null))}
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
  // 🏁 «Todo …» en pestañas, como el papel del Ranking (19/11/2026, «Haz todos»): la tabla o por servidor
  const [pt, setPt] = useState('tabla');
  const ps = (liga.d.paises || []).filter((p) => p.n);
  const i = ps.findIndex((p) => String(p.cc).toLowerCase() === cc);
  const P = i >= 0 ? ps[i] : null;
  const gente = (liga.d.tabla || []).filter((f) => String(f.cc).toLowerCase() === cc).sort(porLugar);
  if (!P && !gente.length) return <NoEsta que="Ese país" href="#/ranking/paises" volver="Ver los países" />;
  const nom = nombrePais(cc);
  const pts = P ? P.pts : gente.reduce((a, f) => a + (f.pts || 0), 0);
  const n = P ? P.n : gente.length;
  // el número adentro del país (el de «Todo …»: salta a quien está fuera de concurso) y la pelea más cerrada de acá
  const nroP = {};
  gente.filter((f) => f.pos && !f.fc).forEach((f, j) => { nroP[f.k] = j + 1; });
  const numP = (_c, f) => nroP[f.k] || 0;
  const pelP = gente.length > 2 ? peleaDe({ cfg: { valor: [(f) => f.ovr || 0] }, base: gente, numero: numP }) : null;
  const tope = (liga.d.tabla || []).length;
  const crews = (liga.d.crews || []).filter((c) => (c.gente || []).some((x) => { const f = liga.fila(x); return f && String(f.cc).toLowerCase() === cc; }));
  const otros = ps.filter((p) => String(p.cc).toLowerCase() !== cc);
  const items = [['ent-cartas', 'Los que mandan', cartas(gente).length], ['ent-gente', 'Toda su gente', gente.length || n],
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
          {pelP ? (
            <div className="rka ent-pelea">
              <Pelea liga={liga} p={pelP} va={'#' + numP(0, pelP.a) + ' · ' + num(pelP.a.pts) + ' pts'} vb={'#' + numP(0, pelP.b) + ' · ' + num(pelP.b.pts) + ' pts'}
                pie={pelP.d ? <>Separados por <b>{pelP.d} de OVR</b>.</> : <>Los dos con <b>{pelP.a.ovr} de OVR</b>; los separan <b>{num(pelP.d2)} pts</b>.</>} />
              <Movidos liga={liga} base={gente} yoK={liga.yo ? liga.yo.k : ''} />
            </div>
          ) : null}
        </Sec>
      ) : null}
      {/* la tabla trae a los primeros de la Liga: el número de gente del país puede ser más grande que su lista */}
      <Sec id="ent-gente" extra="ent-papel" titulo={'Todo ' + nom} bajada={!gente.length ? null
        : gente.length >= n ? (n === 1 ? 'El único rapero de ' + nom + ' que jugó la temporada.' : 'El puesto dentro de ' + nom + ', de los ' + raperos(n) + ' que jugaron la temporada.')
          : (gente.length === 1 ? 'Quien' : 'Los ' + num(gente.length) + ' que') + ' entra' + (gente.length === 1 ? '' : 'n') + ' entre los ' + num(tope) + ' primeros de la Liga, de ' + raperos(n) + ' de ' + nom + ' que jugaron la temporada.'}>
        {gente.length > 3 ? (
          <div className="rka-pes" role="tablist" aria-label={'Qué ver de ' + nom}>
            {[['tabla', 'La tabla', gente.length], ['sv', 'Por servidor', 0]].map(([id, t, c]) => (
              <button key={id} type="button" role="tab" aria-selected={pt === id} className={pt === id ? 'on' : ''} onClick={() => setPt(id)}>{t}{c ? <small>{c}</small> : null}</button>
            ))}
          </div>
        ) : null}
        {gente.length && pt === 'sv' ? <PorServidor liga={liga} base={gente} numero={numP} cfg={{}} yoK={liga.yo ? liga.yo.k : ''} />
          : gente.length ? <Gente liga={liga} gente={gente} />
          : <p className="pronto-p">{n === 1 ? 'De ' + nom + ' jugó 1 rapero' : 'De ' + nom + ' jugaron ' + raperos(n)} esta temporada, y todavía nadie entra entre los {num(tope)} primeros de la Liga.</p>}
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
