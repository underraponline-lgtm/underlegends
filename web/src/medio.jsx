// El medio del Inicio: Fechas, Lo último, Los que mandan y el panel de abajo. Traducido de docs/remake/reales.py
// (fechas, noticias, raperos, panel, tus_eventos, tu_temporada, numeros).
import { DIAS, hora, limpio, num, utc } from './liga.js';
import { Bandera, Cara, Carta, Ico, Pest, Rango, Sec, accion, nombrePais } from './piezas.jsx';

// ── Fechas ────────────────────────────────────────────────────────────────────────────────────────
export function Fechas({ liga }) {
  const t = [];
  liga.vivo().forEach((e) => t.push({ c: 'vivo', dia: 'HOY', hora: '● EN VIVO · empezó ' + liga.dia(e.cuando).replace(/^hoy /, ''), sv: e.sv, ev: limpio(e.nombre),
    det: e.modalidad || 'se mira en Discord', link: e.link }));
  liga.luego().forEach((e) => {
    const dor = liga.esDorado(e.nombre, e.sv);
    const det = [e.modalidad, e.cupos ? 'cupos ' + String(e.cupos).toLowerCase() : ''].filter(Boolean).join(' · ');
    t.push({ c: dor ? 'dorado' : '', dia: liga.dia(e.cuando).split(' ')[0].toUpperCase(), hora: hora(e.cuando) + ' · tu hora',
      sv: e.sv, ev: limpio(e.nombre), det, badge: dor ? 'DORADO ×3' : '', link: e.link });
  });
  liga.llaves().slice(0, 3).forEach((ll) => {
    const g = liga.campeon(ll);
    t.push({ c: 'hecho', dia: liga.cuando(liga.fechaLlave(ll)).toUpperCase(), hora: 'TERMINÓ · ' + ll.participantes + ' raperos', sv: ll.sv,
      ev: limpio(ll.nombre), det: (g.length > 1 ? 'Campeones: ' : 'Campeón: ') + g.join(' y '), llave: ll.n });
  });
  if (!t.length) return null;
  return (
    <Sec id="fechas" titulo="Fechas" enlace="Calendario" href="#/eventos">
      <div className="rail fechas2">
        {t.map((x, i) => {
          const cuerpo = <><div className="f-dia"><b>{x.dia}</b></div><img alt="" src={liga.logo(x.sv)} /><b className="f-ev">{x.ev}</b>
            <span className="f-hora">{x.hora}</span><small>{x.det}</small>{x.badge ? <span className="f-badge">{x.badge}</span> : null}</>;
          if (x.llave) return <button type="button" key={i} className={'fecha ' + x.c} onClick={() => accion.llave(x.llave)}>{cuerpo}</button>;
          if (x.link) return <a key={i} className={'fecha ' + x.c} href={x.link} target="_blank" rel="noopener noreferrer">{cuerpo}</a>;
          return <article key={i} className={'fecha ' + x.c}>{cuerpo}</article>;
        })}
      </div>
    </Sec>
  );
}

// ── Lo último ─────────────────────────────────────────────────────────────────────────────────────
function Vis({ liga, v, cls = 'n-vis' }) {
  if (v[0] === 'carta') return <Carta liga={liga} k={v[1]} cual={v[2]} cls={cls + ' n-carta'} abre={false} />;
  if (v[0] === 'rango') return <span className={cls + ' rgv'} style={{ background: liga.colorRg(v[1]) }}>{v[1]}</span>;
  if (v[0] === 'cara') return <Cara liga={liga} k={v[1]} nombre={v[2]} cls={cls + ' n-cara'} />;
  if (v[0] === 'sv') return <img className={cls} alt="" src={liga.logo(v[1])} />;
  return <img className={cls} alt="" src="/ul.png" />;
}
function irA(d, raiz) {
  if (!d) return;
  if (d.carta) accion.carta(d.carta);
  else if (d.perfil) accion.perfil(d.perfil);
  else if (d.llave) accion.llave(d.llave);
  else if (d.ruta) location.hash = d.ruta;
  else if (d.link) window.open(d.link, '_blank', 'noopener');
  else if (d.ancla && raiz && raiz.current) { const s = raiz.current.querySelector('#' + d.ancla); if (s) s.scrollIntoView({ behavior: 'smooth' }); }
}
export function Noticias({ liga, raiz }) {
  const items = liga.variados(6);
  if (!items.length) return null;
  const dest = items.find((x) => x[2][0] === 'carta') || items[0];
  const resto = items.filter((x) => x !== dest).slice(0, 4);
  return (
    <Sec id="noticias" titulo="Lo último" enlace="Publicaciones" href="#/publicaciones">
      <div className="notas-g">
        <button type="button" className="destacada" onClick={() => irA(dest[4], raiz)}>
          <div className="d-img"><Vis liga={liga} v={dest[2]} cls="d-vis" /><span className="sticker">NUEVA</span></div>
          <div className="d-txt"><span className="cat">{dest[0]}</span><h3>{dest[1]}</h3><small>{dest[3].charAt(0).toUpperCase() + dest[3].slice(1)}</small></div>
        </button>
        <ul className="notas">
          {resto.map((x, i) => (
            <li key={i}><button type="button" className="sin-boton nota-b" onClick={() => irA(x[4], raiz)}>
              <Vis liga={liga} v={x[2]} /><div><span className="cat">{x[0]}</span><b>{x[1]}</b><small>{x[3].charAt(0).toUpperCase() + x[3].slice(1)}</small></div>
            </button></li>
          ))}
        </ul>
      </div>
    </Sec>
  );
}

// ── Los que mandan: las siete categorías del podio de la web de hoy, cinco en cada una ──────────────
function McPersona({ liga, f, dato, cual = 'temporada' }) {
  return (
    <article className="mc">
      <Carta liga={liga} k={f.k} cual={cual} cls="ci mc-ci" />
      <div className="mc-pie">
        <span className="mc-pais"><Bandera cc={f.cc} cls="" />{nombrePais(f.cc)}</span>
        <a href={'#/r/' + encodeURIComponent(f.k)}><b>{limpio(f.n)}</b></a>
        <small>{dato}</small>
      </div>
    </article>
  );
}
function McGrupo({ n, img, nombre, dato, href }) {
  return (
    <a className="mc grupo" href={href}>
      <div className="mc-tile"><span className="mc-n">#{n}</span>{img}</div>
      <div className="mc-pie"><b>{nombre}</b><small>{dato}</small></div>
    </a>
  );
}
export function LosQueMandan({ liga }) {
  const T = liga.oficiales();
  const cats = [];
  cats.push(['temporada', 'Temporada', T.slice(0, 5).map((f) => <McPersona key={f.k} liga={liga} f={f} dato={'#' + f.pos + ' · OVR ' + f.ovr + ' · ' + num(f.pts) + ' PTS'} />)]);
  const comp = T.filter((f) => f.rg).sort((a, b) => (b.sc || 0) - (a.sc || 0)).slice(0, 5);
  cats.push(['competitivo', 'Competitivo', comp.map((f) => <McPersona key={f.k} liga={liga} f={f} cual="competitivo" dato={'RANGO ' + f.rg + ' · SCORE ' + f.sc} />)]);
  const du = (liga.d.duelos || []).filter((d) => !d.fc && liga.T[d.k]).slice(0, 5);
  cats.push(['duelos', 'Duelos', du.map((d) => <McPersona key={d.k} liga={liga} f={liga.T[d.k]} dato={d.g + ' DE ' + d.t + ' DUELOS GANADOS'} />)]);
  const med = T.filter((f) => (f.oro || 0) + (f.seg || 0) + (f.ter || 0))
    .sort((a, b) => (b.oro || 0) - (a.oro || 0) || (b.seg || 0) - (a.seg || 0) || (b.ter || 0) - (a.ter || 0) || a.pos - b.pos).slice(0, 5);
  cats.push(['podios', 'Podios', med.map((f) => <McPersona key={f.k} liga={liga} f={f} dato={'1.º ×' + (f.oro || 0) + ' · 2.º ×' + (f.seg || 0) + ' · 3.º ×' + (f.ter || 0)} />)]);
  const con = T.filter((f) => (f.rch || []).length > 1 && f.rch[1]);
  const vivas = con.filter((f) => f.rch[0]);
  const ra = (vivas.length ? vivas : con).slice().sort((a, b) => (vivas.length ? b.rch[0] - a.rch[0] : b.rch[1] - a.rch[1]) || a.pos - b.pos).slice(0, 5);
  cats.push(['rachas', 'Rachas', ra.map((f) => <McPersona key={f.k} liga={liga} f={f} dato={(vivas.length ? f.rch[0] : f.rch[1]) + ' EVENTOS SEGUIDOS'} />)]);
  const pa = (liga.d.paises || []).filter((p) => p.n).slice(0, 5);
  cats.push(['paises', 'Países', pa.map((p, i) => <McGrupo key={p.cc} n={i + 1} href={'#/pais/' + p.cc} img={<Bandera cc={p.cc} cls="mc-bandera" />}
    nombre={nombrePais(p.cc)} dato={num(p.pts) + ' PTS · ' + p.n + ' RAPEROS'} />)]);
  const cr = (liga.d.crews || []).filter((c) => c.rk !== 0).slice(0, 5);
  cats.push(['crews', 'Crews', cr.map((c, i) => <McGrupo key={c.crew} n={i + 1} href={'#/crew/' + encodeURIComponent(c.clave || c.crew)}
    img={c.logo ? <img className="mc-logo" alt="" src={'/' + c.logo} /> : <span className="mc-ini">{limpio(c.crew).slice(0, 2).toUpperCase()}</span>}
    nombre={limpio(c.crew)} dato={num(c.pts) + ' PTS · ' + c.n + ' RAPEROS'} />)]);
  const items = cats.filter((c) => c[2].length).map(([c, et, h]) => ({ c, et, t: 'Los que mandan', cuerpo: <div className="rail mcs2">{h}</div> }));
  return <Pest id="raperos" titulo="Los que mandan" enlace="Todos los raperos" href="#/ranking" items={items} extra="negra" />;
}

// ── el panel de abajo: Misiones + el Pase · Tus eventos + Tu temporada · La Liga en números ──────────
// Las Misiones y el Pase todavía no existen: van como «Próximamente», sin números de ejemplo (Dlx, «3. sí»).
function Misiones() {
  return (
    <section className="mis">
      <div className="mis-cab"><span>MISIONES DE LA SEMANA · SUMAN A TU TEMPORADA</span><em>PRÓXIMAMENTE</em></div>
      <p className="pronto-p">Cada semana, misiones que cualquiera puede cumplir jugando —jugar dos eventos, llegar a una final, ganar duelos,
        probar otro servidor— y que suman puntos a tu Temporada. Están en camino.</p>
    </section>
  );
}
function Pase({ liga }) {
  return (
    <section className="tu pase">
      <div className="tu-t">PASE DE TEMPORADA · {liga.temp}<span className="tag-pronto">PRÓXIMAMENTE</span></div>
      <p className="pronto-p">Niveles y recompensas que se ganan con tareas. Es para los miembros de Discord Rap Español.</p>
      <a className="btn negro" href="#/pase">Qué es el Pase</a>
    </section>
  );
}
function TusEventos({ liga }) {
  const f = liga.yo;
  const yo = f ? limpio(f.n).toLowerCase() : '';
  return (
    <section className="te">
      <div className="mis-cab"><span>LOS ÚLTIMOS EVENTOS{f ? ' · Y CÓMO TE FUE' : ''}</span><em><a href="#/eventos">TODOS <Ico n="flecha" t={14} /></a></em></div>
      <ol className="te-l">
        {liga.llaves().slice(0, 5).map((ll) => {
          const res = f ? (ll.tabla || []).find((x) => limpio(x[0]).toLowerCase() === yo) : null;
          const gana = liga.campeon(ll);
          return (
            <li key={ll.n}><button type="button" className="sin-boton te-b" onClick={() => accion.llave(ll.n)}>
              <img alt="" src={liga.logo(ll.sv)} />
              <div><b>{limpio(ll.nombre)}</b><small>{ll.sv} · {liga.cuando(liga.fechaLlave(ll))} · {ll.participantes} raperos · {gana.length > 1 ? 'campeones' : 'campeón'}: {gana.join(' y ')}</small></div>
              {f ? (res ? <span className={'te-vos' + (res[1] === 'Campeón' ? ' campeon' : '')}>{String(res[1]).toUpperCase()}<small>+{num(res[2])}</small></span>
                : <span className="te-vos no">—<small>no jugaste</small></span>) : null}
            </button></li>
          );
        })}
      </ol>
    </section>
  );
}
export function TuTemporada({ liga }) {
  const f = liga.yo;
  if (!f) {
    return (
      <section className="tu">
        <div className="tu-t">TU TEMPORADA</div>
        <p className="pronto-p">Entrá con Discord y acá vas a ver tu puesto, tu OVR, cuánto te falta para tu letra y si te buscan.</p>
        <button type="button" className="btn negro" onClick={accion.cuenta}>Entrar con Discord</button>
      </section>
    );
  }
  const ev = f.ev || 0;
  const falta = Math.max(0, 10 - ev);
  const bus = liga.buscado(f.k);
  const mw = liga.d.mw || {};
  return (
    <section className="tu" id="tu">
      <div className="tu-t">TU TEMPORADA · {limpio(f.n).toUpperCase()}</div>
      <div className="tu-fila">
        <div className="tu-pos"><b>{f.pos ? '#' + f.pos : '—'}</b><small>OVR {f.ovr} · {num(f.pts)} pts · {ev} eventos</small></div>
        {f.rg ? <Rango liga={liga} rg={f.rg} /> : <span className="rg sinletra">?</span>}
      </div>
      <div className="tu-prog">
        <div className="barra10">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < ev ? 'si' : ''} />)}</div>
        <small>{falta ? 'Todavía sin letra: ' + ev + ' de 10 eventos. Te faltan ' + falta + ' para tu rango.' : 'Ya tenés letra.'}</small>
      </div>
      {bus ? <div className="te-buscan"><b>HOY TE BUSCAN</b><span>{num(bus.v)} pts por tu cabeza · {bus.cn} · hasta {liga.dia(mw.fin)}</span></div> : null}
      <a className="btn negro" href={'#/r/' + encodeURIComponent(f.k)}>Ver mi perfil</a>
    </section>
  );
}
function Numeros({ liga }) {
  const c = liga.d.comunidad || {};
  const a = liga.d.actividad || {};
  const grandes = [['PERSONAS', c.personas, 'en ' + (c.servidores || 0) + ' servidores'], ['EN LA LISTA', c.lista, 'compitieron o se anotaron'],
    ['CON SU DISCORD', c.con_id, 'el bot sabe quiénes son'], ['VERIFICADAS', c.verificados, 'con las cuatro tarjetas']].filter((x) => x[1]);
  const dias = a.dias || [];
  const tope = Math.max(1, ...dias.map(([, x]) => Object.values(x).reduce((s, v) => s + v, 0)));
  return (
    <div className="num-g">
      <div>
        {grandes.length ? <div className="num-4">{grandes.map(([t, v, d]) => <div key={t}><span>{t}</span><b>{num(v)}</b><small>{d}</small></div>)}</div> : null}
        {dias.length ? (
          <section className="act">
            <div className="mis-cab"><span>LO QUE SE JUGÓ · DOS SEMANAS</span><em>{a.ev || 0} EVENTOS ESTA SEMANA</em></div>
            <div className="act-g">
              {dias.map(([d, x]) => {
                const dd = utc(d + 'T12:00:00Z');
                return (
                  <i key={d}><span className="act-b">{Object.entries(x).sort().map(([sv, n]) => (
                    <u key={sv} style={{ height: (100 * n / tope).toFixed(1) + '%', background: (liga.svs[sv] || {}).color || '#A5A5A0' }} title={sv + ' ' + n} />
                  ))}</span><em>{DIAS[dd.getUTCDay()].slice(0, 1).toUpperCase()}</em></i>
                );
              })}
            </div>
            <p className="act-n"><b>{num(a.part || 0)}</b> participaciones · <b>{num(a.gente || 0)}</b> raperos distintos en 7 días</p>
          </section>
        ) : null}
      </div>
      {(liga.d.records || []).length ? (
        <section className="rec">
          <div className="mis-cab"><span>LOS RÉCORDS DE LA {liga.temp}</span></div>
          <ol>{(liga.d.records || []).slice(0, 6).map((r) => (
            <li key={r.id}><span>{r.que}</span><a href={r.k ? '#/r/' + encodeURIComponent(r.k) : undefined}><b>{limpio(r.n)}</b></a><em>{typeof r.v === 'number' ? num(r.v) : r.v}</em></li>
          ))}</ol>
        </section>
      ) : null}
    </div>
  );
}
export function Panel({ liga }) {
  const items = [
    { c: 'misiones', et: 'Misiones', t: 'Misiones', cuerpo: <div className="pz-2"><Misiones /><Pase liga={liga} /></div> },
    { c: 'eventos', et: 'Tus eventos', t: liga.yo ? 'Tus eventos' : 'Los últimos eventos', cuerpo: <div className="pz-2"><TusEventos liga={liga} /><TuTemporada liga={liga} /></div> },
    { c: 'liga', et: 'La Liga', t: 'La Liga en números', cuerpo: <Numeros liga={liga} /> },
  ];
  const yo = liga.yo;
  return <Pest id="panel" titulo="Misiones" enlace={yo ? 'Tu perfil' : 'Entrar'} href={yo ? '#/r/' + encodeURIComponent(yo.k) : undefined}
    onEnlace={yo ? undefined : accion.cuenta} items={items} extra="panel" titulos />;
}
