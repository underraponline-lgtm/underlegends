// El perfil de cada servidor. Dlx, 30/09/2026: «acuérdate cada servidor, crew y país tendrían su propio perfil» y
// «me gustan todas» (la E). Vive en #/sv/<SIGLA> y lo dibuja el Inicio nuevo: app.js no conoce esa ruta y la deja
// en el Inicio, y el Inicio mira la dirección (ver App.jsx). Todo sale del payload: `svs` (el color acordado, el
// logo de hoy, la invitación, las redes), la tabla, las llaves, los próximos, el muro, Se busca y la semana.
import { limpio, mult, num, utc } from './liga.js';
import { Cara, Carta, Compartir, Poster, Sec, accion, enlace } from './piezas.jsx';
import { McPersona } from './medio.jsx';

const REDES = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', twitch: 'Twitch', x: 'X', twitter: 'X', kick: 'Kick' };

function ir(d) {
  if (!d) return;
  if (d.carta) accion.carta(d.carta);
  else if (d.perfil) accion.perfil(d.perfil);
  else if (d.llave) accion.llave(d.llave);
  else if (d.ruta) location.hash = d.ruta;
  else if (d.link) window.open(d.link, '_blank', 'noopener');
}

function Nota({ liga, x }) {
  const v = x[2];
  let vis;
  if (v[0] === 'carta') vis = <Carta liga={liga} k={v[1]} cual={v[2]} cls="n-vis n-carta" abre={false} />;
  else if (v[0] === 'rango') vis = <span className="n-vis rgv" style={{ background: liga.colorRg(v[1]) }}>{v[1]}</span>;
  else if (v[0] === 'cara') vis = <Cara liga={liga} k={v[1]} nombre={v[2]} cls="n-vis n-cara" />;
  else vis = <img className="n-vis" alt="" src={liga.logo(v[1])} />;
  return (
    <li><button type="button" className="sin-boton nota-b" onClick={() => ir(x[4])}>
      {vis}<div><span className="cat">{x[0]}</span><b>{x[1]}</b><small>{x[3].charAt(0).toUpperCase() + x[3].slice(1)}</small></div>
    </button></li>
  );
}

export function PerfilSv({ liga, sv }) {
  const s = liga.svs[sv];
  if (!s) {
    return (
      <Sec id="sv-no" titulo="Servidor">
        <p className="pronto-p">No hay ningún servidor con esa sigla en la Liga. <a className="te-link" href="#/mundo">Ver los servidores</a></p>
      </Sec>
    );
  }
  const mm = liga.d.mult || {};
  const x = (mm.sv || {})[sv];
  const gente = liga.oficiales().filter((f) => f.sv === sv).slice(0, 10);
  const vivo = liga.vivo().filter((e) => e.sv === sv);
  const prox = liga.luego().filter((e) => e.sv === sv).slice(0, 6);
  const llaves = liga.llaves().filter((ll) => ll.sv === sv).slice(0, 6);
  const notas = liga.muroLimpio().filter((it) => it.tipo !== 'anuncio' && liga.svDe(it) === sv)
    .map((it) => liga.itemMuro(it)).filter(Boolean).slice(0, 6);
  const buscados = ((liga.d.mw || {}).b || []).filter((b) => b.sv === sv);
  const g = liga.doradoVigente();
  const par = ((mm.guerra || {}).pares || []).find((p) => p.includes(sv));
  const meta = (mm.metas || {})[sv];
  const va = (mm.meta_va || {})[sv] || 0;
  const semana = [];
  if (g && g.sv === sv) semana.push(['DORADO ×3', limpio(g.n) + ' · ' + (utc(g.t) <= liga.ahora ? 'se juega ahora' : liga.dia(g.t))]);
  if (par) semana.push(['GUERRA', 'contra ' + (par[0] === sv ? par[1] : par[0]) + ': gana el que más puntos hace por persona']);
  if (meta) semana.push(['META', va + ' de ' + meta + ' personas' + (va >= meta ? ' · cumplida' : '')]);
  const fechas = [];
  vivo.forEach((e) => fechas.push({ c: 'vivo', dia: 'HOY', hora: '● EN VIVO', ev: limpio(e.nombre), det: e.modalidad || '', link: e.link }));
  prox.forEach((e) => fechas.push({ c: liga.esDorado(e.nombre, e.sv) ? 'dorado' : '', dia: liga.dia(e.cuando).split(' ')[0].toUpperCase(),
    hora: liga.dia(e.cuando), ev: limpio(e.nombre), det: e.modalidad || '', link: e.link }));
  llaves.forEach((ll) => {
    const c = liga.campeon(ll);
    fechas.push({ c: 'hecho', dia: liga.cuando(liga.fechaLlave(ll)).toUpperCase(), hora: 'TERMINÓ · ' + ll.participantes + ' raperos',
      ev: limpio(ll.nombre), det: (c.length > 1 ? 'Campeones: ' : 'Campeón: ') + c.join(' y '), llave: ll.n });
  });
  // cinco llenan la fila de la computadora; el sexto quedaba solo abajo
  fechas.splice(5);
  return (
    <>
      <div className="escena sv-cab" style={{ '--mo-c': s.color || '#29B298', '--mo-o': 0.9, '--mo-logo': 'url("' + liga.logo(sv, true) + '")' }}>
        <section className="svp" id="sv-perfil">
          <img className="svp-logo" alt="" src={liga.logo(sv, true)} />
          <div className="svp-tx">
            {s.tag ? <span className="tag">{String(s.tag).toUpperCase()}</span> : null}
            <h1 className="hero-ev largo">{s.nombre || sv}</h1>
            <p className="hero-p">{sv}{s.miembros ? ' · ' + num(s.miembros) + ' miembros en su Discord' : ''}</p>
            <div className="hero-acc">
              {s.invita ? <a className="btn verde" href={s.invita} target="_blank" rel="noopener noreferrer">Entrar al servidor ↗</a> : null}
              <Compartir cls="btn borde" url={enlace('#/sv/' + sv)} texto={(s.nombre || sv) + ' en la Liga Global'} />
            </div>
            {(s.redes || []).length ? (
              <nav className="svp-redes" aria-label="Sus redes">
                {s.redes.map(([r, u]) => <a key={r} href={u} target="_blank" rel="noopener noreferrer">{REDES[r] || r} ↗</a>)}
              </nav>
            ) : null}
          </div>
          <dl className="svp-num">
            <div><dt>RAPEROS</dt><dd>{num(s.n || 0)}</dd></div>
            <div><dt>PUNTOS</dt><dd>{num(s.pts || 0)}</dd></div>
            <div><dt>EVENTOS</dt><dd>{num(s.ev || 0)}</dd></div>
            <div><dt>ESTA SEMANA</dt><dd className={x > 1 ? 'sube' : ''}>{x ? mult(x) : '×1'}</dd></div>
          </dl>
        </section>
        {semana.length ? (
          <ul className="svp-semana">
            {semana.map(([t, d]) => <li key={t} className={t.startsWith('DORADO') ? 'dor' : ''}><b>{t}</b><span>{d}</span></li>)}
          </ul>
        ) : null}
      </div>
      {gente.length ? (
        <Sec id="sv-gente" titulo={'Los que mandan en ' + sv} enlace="Todos los raperos" href="#/ranking" extra="negra">
          <div className="rail mcs2">{gente.map((f) => <McPersona key={f.k} liga={liga} f={f} />)}</div>
        </Sec>
      ) : null}
      {fechas.length ? (
        <Sec id="sv-eventos" titulo="Sus eventos" enlace="Calendario" href="#/eventos">
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
        <Sec id="sv-ultimo" titulo={'Lo último de ' + sv} enlace="Publicaciones" href="#/publicaciones">
          <ul className="notas">{notas.map((n, i) => <Nota key={i} liga={liga} x={n} />)}</ul>
        </Sec>
      ) : null}
      {buscados.length ? (
        <Sec id="sv-buscados" titulo={'Se busca en ' + sv} enlace="Most Wanted" href="#/ranking/mw" extra="negra">
          <div className="mw-rail">{buscados.map((b) => <Poster key={b.k} liga={liga} b={b} />)}</div>
        </Sec>
      ) : null}
      <Sec id="sv-mas" titulo="Los otros servidores">
        <nav className="svp-otros">
          {Object.values(liga.svs).filter((o) => o.sv !== sv).sort((a, b) => (b.pts || 0) - (a.pts || 0)).map((o) => (
            <a key={o.sv} href={'#/sv/' + o.sv} style={{ '--c': o.color }}><img alt="" src={liga.logo(o.sv)} /><b>{o.sv}</b></a>
          ))}
        </nav>
      </Sec>
    </>
  );
}
