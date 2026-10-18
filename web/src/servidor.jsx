// El perfil de cada servidor. Dlx, 30/09/2026: «acuérdate cada servidor, crew y país tendrían su propio perfil» y
// «me gustan todas» (la E). Vive en #/sv/<SIGLA> y lo dibuja el Inicio nuevo: app.js no conoce esa ruta y la deja
// en el Inicio, y el Inicio mira la dirección (ver App.jsx). Todo sale del payload: `svs` (el color acordado, el
// logo de hoy, la invitación, las redes), la tabla, las llaves, los próximos, el muro, Se busca y la semana.
import { limpio, mult, num, siglaDe, utc } from './liga.js';
import { Cara, Carta, Compartir, Poster, Sec, aDiscord, accion, enlace, silueta } from './piezas.jsx';
import { McPersona } from './medio.jsx';
import { Pub, useAplausos } from './publicaciones.jsx';
import { Categoria, Nominado, reparto, useSalon } from './salon.jsx';

export const REDES = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', twitch: 'Twitch', x: 'X', twitter: 'X', kick: 'Kick' };

function ir(d) {
  if (!d) return;
  if (d.carta) accion.carta(d.carta, d.cual);
  else if (d.perfil) accion.perfil(d.perfil);
  else if (d.llave) accion.llave(d.llave);
  else if (d.ruta) location.hash = d.ruta;
  else if (d.link) window.open(d.link, '_blank', 'noopener');
  // la caza del Most Wanted (`{ancla:'sebusca'}`): su ranking (revisión del 03/10/2026)
  else if (d.ancla) location.hash = d.ancla === 'sebusca' ? '#/ranking/mw' : '#/';
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
  const notas = liga.muroLimpio().filter((it) => it.tipo !== 'anuncio' && liga.svDe(it) === sv)
    .map((it) => liga.itemMuro(it)).filter(Boolean).slice(0, 6);
  const buscados = ((liga.d.mw || {}).b || []).filter((b) => b.sv === sv);
  const g = liga.doradoVigente();
  const par = ((mm.guerra || {}).pares || []).find((p) => p.includes(sv));
  const meta = (mm.metas || {})[sv];
  const va = (mm.meta_va || {})[sv] || 0;
  const semana = [];
  if (g && g.sv === sv) semana.push(['DORADO ×3', limpio(g.n) + ' · ' + (utc(g.t) <= liga.ahora ? 'se juega ahora' : liga.dia(g.t))]);
  if (par) semana.push(['GUERRA', 'contra ' + siglaDe(par[0] === sv ? par[1] : par[0]) + ': gana el que más puntos hace por persona']);
  if (meta) semana.push(['META', va + ' de ' + meta + ' personas' + (va >= meta ? ' · cumplida' : '')]);
  const fechas = [];
  // al Discord con la invitación, no con el link al mensaje (Dlx, 03/10/2026: «2. A»): ver `aDiscord()`
  vivo.forEach((e) => fechas.push({ c: 'vivo', dia: 'HOY', hora: '● EN VIVO', ev: limpio(e.nombre), det: e.modalidad || '', link: (aDiscord(liga, e, true) || {}).url }));
  prox.forEach((e) => fechas.push({ c: liga.esDorado(e.nombre, e.sv) ? 'dorado' : '', dia: liga.dia(e.cuando).split(' ')[0].toUpperCase(),
    hora: liga.dia(e.cuando), ev: limpio(e.nombre), det: e.modalidad || '', link: (aDiscord(liga, e, false) || {}).url }));
  llaves.forEach((ll) => {
    const c = liga.campeon(ll);
    fechas.push({ c: 'hecho', dia: liga.cuando(liga.fechaLlave(ll)).toUpperCase(), hora: 'TERMINÓ · ' + ll.participantes + ' raperos',
      ev: limpio(ll.nombre), det: (c.length > 1 ? 'Campeones: ' : 'Campeón: ') + c.join(' y '), llave: ll.n });
  });
  // cinco llenan la fila de la computadora; el sexto quedaba solo abajo
  fechas.splice(5);
  return (
    <>
      <div className="escena sv-cab" style={{ '--mo-c': s.color || '#29B298', '--mo-o': 0.9, '--mo-logo': 'url("' + liga.logo(sv, true) + '")', ...silueta(sv, s.color) }}>
        <section className="svp" id="sv-perfil">
          <img className="svp-logo" alt="" src={liga.logo(sv, true)} />
          <div className="svp-tx">
            {s.tag ? <span className="tag">{String(s.tag).toUpperCase()}</span> : null}
            <h1 className="hero-ev largo">{s.nombre || siglaDe(sv)}</h1>
            <p className="hero-p">{siglaDe(sv)}{s.miembros ? ' · ' + num(s.miembros) + ' miembros en su Discord' : ''}</p>
            <div className="hero-acc">
              {s.invita ? <a className="btn verde" href={s.invita} target="_blank" rel="noopener noreferrer">Entrar al servidor ↗</a> : null}
              <Compartir cls="btn borde" url={enlace('#/sv/' + siglaDe(sv))} texto={(s.nombre || siglaDe(sv)) + ' en la Liga Global'} />
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
        <Sec id="sv-gente" titulo={'Los que mandan en ' + siglaDe(sv)} enlace="Todos los raperos" href="#/ranking" extra="negra">
          {/* 🃏 la carta según dónde (18/10/2026): acá, la de Servidor de este servidor si la tiene */}
          <div className="rail mcs2">{gente.map((f) => <McPersona key={f.k} liga={liga} f={f} cual={liga.cartaDe(f.k, { sv }) || 'temporada'} />)}</div>
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
        <Sec id="sv-ultimo" titulo={'Lo último de ' + siglaDe(sv)} enlace="Publicaciones" href="#/publicaciones">
          <ul className="notas">{notas.map((n, i) => <Nota key={i} liga={liga} x={n} />)}</ul>
        </Sec>
      ) : null}
      {/* 🏟️ sus MES AWARDS (Dlx, 18/10/2026: «cada Tier 1 con los suyos») */}
      <MesSv liga={liga} sv={sv} enc={enc} />
      {/* 📣 lo que se promociona en su canal (Dlx, 16/10/2026: «no en Socios sino en la de cada servidor») */}
      <PromosSv liga={liga} sv={sv} />
      {buscados.length ? (
        <Sec id="sv-buscados" titulo={'Se busca en ' + siglaDe(sv)} enlace="Most Wanted" href="#/ranking/mw" extra="negra">
          <div className="mw-rail">{buscados.map((b) => <Poster key={b.k} liga={liga} b={b} />)}</div>
        </Sec>
      ) : null}
      <Sec id="sv-mas" titulo="Los otros servidores">
        <nav className="svp-otros">
          {Object.values(liga.svs).filter((o) => o.sv !== sv).sort((a, b) => (b.pts || 0) - (a.pts || 0)).map((o) => (
            <a key={o.sv} href={'#/sv/' + siglaDe(o.sv)} style={{ '--c': o.color }}><img alt="" src={liga.logo(o.sv)} /><b>{siglaDe(o.sv)}</b></a>
          ))}
        </nav>
      </Sec>
    </>
  );
}

// 📣 LAS PROMOS DE ESTE SERVIDOR: lo que los raperos de la Lista compartieron en su canal de promoción (bot/promos.py),
// del muro. Las cuatro más nuevas; sin ninguna, no se dibuja
// 🏟️ LOS MES AWARDS DE ESTE SERVIDOR (Dlx, 18/10/2026: «hacer también los awards para servidor TIER 1», y a la pregunta,
// «cada Tier 1 con los suyos»: su rapero, su revelación, su batalla y su staff del mes, con lo que se jugó acá, votados
// por sus jugadores). Salen de `/api/salon` (`bot/mes_awards.py`) y se votan como los de la Liga (`enc`); quién puede
// votar lo decide el Worker. Sin nominados ni ganadores, no se dibuja: se ve desde el día 1 del mes siguiente
function MesSv({ liga, sv, enc }) {
  const S = useSalon();
  if (!S || !S.cats_sv) return null;
  const ab = S.abierto && S.abierto.sv && S.abierto.sv[sv] ? S.abierto : null;
  const hist = (S.hist || []).filter((m) => m.sv && m.sv[sv]);
  if (!ab && !hist.length) return null;
  const s = ab ? ab.sv[sv] : null;
  const votando = !!(ab && ab.votando);
  const capM = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  return (
    <Sec id="sv-mes" titulo="MES AWARDS" enlace="El Salón de la fama" href="#/salon" extra="negra sf-mes">
      {ab ? <p className="ma-cab">{votando ? <>Votá lo mejor de <b>{ab.nombre}</b> en {siglaDe(sv)}: cierra {liga.dia(ab.cierra)}.</>
        : <>Los nominados de <b>{ab.nombre}</b> en {siglaDe(sv)}: la votación abre {liga.dia(ab.abre)}.</>}</p> : null}
      <p className="ma-como">Los nominados salen de lo que se jugó en {siglaDe(sv)} ese mes, y votan los que jugaron acá: una vez por categoría,
        y se puede cambiar hasta que cierra. El ganador se lleva su insignia y su lugar en esta página.</p>
      {s ? (
        // de a tres cuando son tres: en la compu, el Staff quedaba solo con un hueco al lado
        <div className={'ma-cats' + (S.cats_sv.filter(([c]) => (((s.cats || {})[c] || {}).nom || []).length).length === 3 ? ' ma-tres' : '')}>{S.cats_sv.map(([c, n, de]) => {
          const nom = ((s.cats || {})[c] || {}).nom || [];
          return nom.length ? <Categoria key={c} liga={liga} enc={enc} cat={c} nombre={n} de={de} nom={nom}
            encId={votando && nom.length >= 2 ? 'mes:' + ab.mes + ':' + sv + ':' + c : ''} /> : null;
        })}</div>
      ) : null}
      {hist.length ? (
        <div className="ma-hist">
          <h3 className="lgf-st">Los ganadores</h3>
          {hist.map((m) => (
            <div key={m.mes} className="ma-hm">
              <small>{capM(m.nombre)} {m.mes.slice(0, 4)}</small>
              <ul>{S.cats_sv.map(([c, n]) => {
                const x = (m.sv[sv].cats || {})[c] || {};
                const fila = (x.nom || []).find((y) => y.op === x.gana);
                return fila ? <li key={c}><Nominado liga={liga} cat={c} x={fila} /><em>{n}</em>{reparto(x)}</li> : null;
              })}</ul>
            </div>
          ))}
        </div>
      ) : null}
    </Sec>
  );
}

function PromosSv({ liga, sv }) {
  const A = useAplausos();
  const xs = (liga.muro || []).filter((it) => it.tipo === 'promo' && it.sv === sv && it.o !== 'liga').slice(0, 4);
  if (!xs.length) return null;
  return (
    <Sec id="sv-promos" titulo={'Se promociona en ' + siglaDe(sv)} enlace="Todas las promos" href="#/publicaciones">
      <div className="pub-dia sv-promos">{xs.map((it) => <Pub key={it.id} liga={liga} it={it} A={A} />)}</div>
    </Sec>
  );
}
