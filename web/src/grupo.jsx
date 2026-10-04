// La página de cada crew y la de cada país, en la web nueva. Eran las dos últimas vistas de app.js (la tanda 3 del plan
// del 03/10/2026: llave → Tienda y Pase → crew y país → lo legal → sacar app.js); Dlx, 04/10/2026: «si falta reworkear
// algo, reworkealo». Mismo esquema que la de cada servidor (servidor.jsx): la cabecera con sus números, sus cartas, toda
// su gente y los otros. Todo sale del payload: `crews`, `paises` y la tabla. Viven en #/crew/<clave> y #/pais/<cc>.
import { limpio, num } from './liga.js';
import { Bandera, Cara, Compartir, Sec, accion, enlace, nombrePais } from './piezas.jsx';
import { McPersona } from './medio.jsx';
import { CrewCirculo } from './arriba.jsx';

const clave = (c) => c.clave || c.crew;
// el orden de la Temporada (`o` es el lugar, también para quien está fuera de concurso)
const porLugar = (a, b) => (a.o || a.pos || 999) - (b.o || b.pos || 999);
// las cartas de arriba: de a filas enteras de cinco (la compu muestra cinco por fila; siete dejaban un hueco al lado de
// las dos de abajo), y las que no entran están en la lista de toda la gente
const cartas = (gente) => gente.slice(0, gente.length >= 10 ? 10 : gente.length >= 5 ? 5 : gente.length);

/** Toda la gente, en una lista: el puesto en la Liga, la cara, el nombre con su bandera y sus números. */
function Lista({ liga, gente }) {
  return (
    <ol className="gp-l">
      {gente.map((f) => (
        <li key={f.k}>
          <button type="button" className="sin-boton gp-f" onClick={() => accion.perfil(f.k)} aria-label={'Ver el perfil de ' + limpio(f.n)}>
            <span className="gp-pos">{f.pos ? '#' + f.pos : '—'}</span>
            <Cara liga={liga} k={f.k} nombre={f.n} cls="gp-cara" lazy />
            <span className="gp-n"><b>{limpio(f.n)}</b><Bandera cc={f.cc} cls="gp-flag" /></span>
            <span className="gp-d"><b>{f.ovr || '—'}</b><small>OVR</small></span>
            <span className="gp-d"><b>{num(f.pts || 0)}</b><small>PTS</small></span>
            <span className="gp-d gp-ev"><b>{f.ev || 0}</b><small>EV</small></span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** La cabecera de las dos: la imagen, el puesto, el nombre, lo de abajo del nombre y cuatro números. */
function Cabeza({ img, tag, nombre, sub, numeros, url, color }) {
  return (
    <div className="escena sv-cab gp-cab" style={{ '--mo-c': color || '#E41373', '--mo-o': 0.85 }}>
      <section className="svp">
        {img}
        <div className="svp-tx">
          {tag ? <span className="tag">{tag}</span> : null}
          <h1 className="hero-ev largo">{nombre}</h1>
          {sub ? <div className="gp-sub">{sub}</div> : null}
          <div className="hero-acc"><Compartir cls="btn borde" url={enlace(url)} texto={nombre + ' en la Liga Global'} /></div>
        </div>
        <dl className="svp-num">{numeros.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
      </section>
    </div>
  );
}

function NoEsta({ que, href, volver }) {
  return (
    <Sec id="gp-no" titulo={que}>
      <p className="pronto-p">No tiene gente en la temporada. <a className="te-link" href={href}>{volver}</a></p>
    </Sec>
  );
}

// ── la de una crew ────────────────────────────────────────────────────────────────────────────────
export function PaginaCrew({ liga, id }) {
  const cs = liga.d.crews || [];
  const c = cs.find((x) => clave(x) === id) || cs.find((x) => limpio(x.crew).toLowerCase() === limpio(id).toLowerCase());
  if (!c) return <NoEsta que="Esa crew" href="#/ranking/crews" volver="Ver las crews" />;
  const conPuesto = cs.filter((x) => x.rk !== 0);
  const pos = conPuesto.indexOf(c) + 1;
  const gente = (c.gente || []).map((n) => liga.fila(n)).filter(Boolean).sort(porLugar);
  const ccs = [...new Set(gente.map((f) => f.cc).filter(Boolean))];
  const mejor = c.mejor ? liga.fila(c.mejor) : null;
  return (
    <>
      <Cabeza img={<CrewCirculo c={c} cls="svp-logo gp-crew" />} nombre={limpio(c.crew)} url={'#/crew/' + encodeURIComponent(clave(c))}
        tag={pos ? '#' + pos + ' DE LAS CREWS' : 'SIN PUESTO · HACEN FALTA TRES RAPEROS'}
        sub={ccs.length ? <span className="gp-flags">{ccs.map((cc) => <Bandera key={cc} cc={cc} cls="gp-flag" />)}</span> : null}
        numeros={[['RAPEROS', num(c.n || gente.length)], ['PUNTOS', num(c.pts || 0)],
          ['POR RAPERO', c.n ? num(Math.round((c.pts || 0) / c.n)) : '—'],
          ['EL MEJOR', mejor ? <a className="te-link" href={'#/r/' + encodeURIComponent(mejor.k)}>{limpio(mejor.n)}</a> : limpio(c.mejor || '—')]]} />
      {gente.length ? (
        <Sec id="gp-cartas" titulo={'Los que mandan en ' + limpio(c.crew)} extra="negra">
          <div className="rail mcs2">{cartas(gente).map((f) => <McPersona key={f.k} liga={liga} f={f} />)}</div>
        </Sec>
      ) : null}
      <Sec id="gp-gente" titulo="Toda la crew">
        {gente.length ? <Lista liga={liga} gente={gente} /> : <p className="pronto-p">Todavía nadie de la crew jugó la temporada.</p>}
      </Sec>
      <Sec id="gp-otras" titulo="Las otras crews" enlace="El ranking de crews" href="#/ranking/crews">
        <nav className="svp-otros gp-otros">
          {conPuesto.filter((x) => x !== c).slice(0, 18).map((x) => (
            <a key={clave(x)} href={'#/crew/' + encodeURIComponent(clave(x))}><CrewCirculo c={x} cls="gp-mini" /><b>{limpio(x.crew)}</b></a>
          ))}
        </nav>
      </Sec>
    </>
  );
}

// ── la de un país ─────────────────────────────────────────────────────────────────────────────────
export function PaginaPais({ liga, cc: cc0 }) {
  const cc = String(cc0 || '').toLowerCase();
  const ps = (liga.d.paises || []).filter((p) => p.n);
  const i = ps.findIndex((p) => String(p.cc).toLowerCase() === cc);
  const P = i >= 0 ? ps[i] : null;
  const gente = (liga.d.tabla || []).filter((f) => String(f.cc).toLowerCase() === cc).sort(porLugar);
  if (!P && !gente.length) return <NoEsta que="Ese país" href="#/ranking/paises" volver="Ver los países" />;
  const nom = nombrePais(cc);
  const pts = P ? P.pts : gente.reduce((a, f) => a + (f.pts || 0), 0);
  // ⚠️ los raperos del país, de `paises` como el puntaje: la tabla viaja cortada en 200 y contar sus filas daba menos
  // gente y más «por rapero» que el Ranking de países (revisión del 04/10/2026)
  const n = P ? P.n : gente.length;
  const crews = (liga.d.crews || []).filter((c) => (c.gente || []).some((x) => { const f = liga.fila(x); return f && String(f.cc).toLowerCase() === cc; }));
  return (
    <>
      <Cabeza img={<span className="svp-logo gp-pais"><img alt="" src={'/banderas/g/' + cc + '.webp'} /></span>} nombre={nom} url={'#/pais/' + cc}
        tag={P ? '#' + (i + 1) + ' DE LOS PAÍSES' : ''}
        sub={crews.length ? <span className="gp-chips">{crews.map((c) => <a key={clave(c)} className="gp-chip" href={'#/crew/' + encodeURIComponent(clave(c))}>{limpio(c.crew)}</a>)}</span> : null}
        numeros={[['RAPEROS', num(n)], ['PUNTOS', num(pts || 0)], ['POR RAPERO', n ? num(Math.round((pts || 0) / n)) : '—'],
          ['EL MEJOR', gente[0] ? <a className="te-link" href={'#/r/' + encodeURIComponent(gente[0].k)}>{limpio(gente[0].n)}</a> : '—']]} />
      {gente.length ? (
        <Sec id="gp-cartas" titulo={'Los que mandan en ' + nom} extra="negra">
          <div className="rail mcs2">{cartas(gente).map((f) => <McPersona key={f.k} liga={liga} f={f} />)}</div>
        </Sec>
      ) : null}
      <Sec id="gp-gente" titulo={'Todo ' + nom}>
        <Lista liga={liga} gente={gente} />
      </Sec>
      <Sec id="gp-otros" titulo="Los otros países" enlace="El ranking de países" href="#/ranking/paises">
        <nav className="svp-otros gp-otros">
          {ps.filter((p) => String(p.cc).toLowerCase() !== cc).slice(0, 18).map((p) => (
            <a key={p.cc} href={'#/pais/' + String(p.cc).toLowerCase()}><Bandera cc={String(p.cc).toLowerCase()} cls="gp-mini bandera" /><b>{nombrePais(String(p.cc).toLowerCase())}</b></a>
          ))}
        </nav>
      </Sec>
    </>
  );
}
