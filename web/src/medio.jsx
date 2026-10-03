// El medio del Inicio: Fechas, Lo último, Los que mandan y el panel de abajo. Traducido de docs/remake/reales.py
// (fechas, noticias, raperos, panel, tus_eventos, tu_temporada, numeros).
import { DIAS, hora, limpio, num, resultado, utc } from './liga.js';
import { Bandera, Cara, Carta, Compartir, Ico, Pest, Rango, Sec, aDiscord, accion, enlace, nombrePais } from './piezas.jsx';

// ── Fechas ────────────────────────────────────────────────────────────────────────────────────────
export function Fechas({ liga }) {
  const t = [];
  liga.vivo().forEach((e) => t.push({ c: 'vivo', dia: 'HOY', hora: '● EN VIVO · empezó ' + liga.dia(e.cuando).replace(/^hoy /, ''), sv: e.sv, ev: limpio(e.nombre),
    det: e.modalidad || 'se mira en Discord', link: (aDiscord(liga, e, true) || {}).url }));
  liga.luego().forEach((e) => {
    const dor = liga.esDorado(e.nombre, e.sv);
    const det = [e.modalidad, e.cupos ? 'cupos ' + String(e.cupos).toLowerCase() : ''].filter(Boolean).join(' · ');
    t.push({ c: dor ? 'dorado' : '', dia: liga.dia(e.cuando).split(' ')[0].toUpperCase(), hora: hora(e.cuando) + ' · tu hora',
      sv: e.sv, ev: limpio(e.nombre), det, badge: dor ? 'DORADO ×3' : '', link: (aDiscord(liga, e, false) || {}).url });
  });
  // 🔴 lo que se canceló (el vigía vio que el anuncio se borró, ver `liga.cancelados()`): dice «CANCELADO» hasta seis
  // horas después de la hora en que era, en vez de desaparecer como si nada (Dlx, 01/10/2026: «B»)
  liga.cancelados().forEach((c) => {
    const ini = c.ini ? new Date(c.ini) : null;
    if (ini && (liga.ahora - ini) > 6 * 3600000) return;
    t.push({ c: 'cancelado', dia: ini ? liga.dia(ini).split(' ')[0].toUpperCase() : 'HOY', hora: 'CANCELADO',
      sv: c.sv, ev: limpio(c.n), det: ini ? 'era a las ' + hora(ini) : 'el servidor lo canceló' });
  });
  // lo que pasó, hasta completar la fila de cinco de la compu (de diez si lo que viene ya pasa de cinco): con tres
  // fijas, sin nada anunciado quedaban dos lugares vacíos al lado (Dlx, 02/10/2026: «un espacio tan grande vacío»)
  const fila = t.length > 4 ? 10 : 5;
  // y por FECHA, del más nuevo al más viejo: el número de la llave es el orden en que se cargó, y con cinco «ayer» salía
  // después de «el miércoles»
  const porFecha = liga.llaves().slice().sort((a, b) => utc(liga.fechaLlave(b)) - utc(liga.fechaLlave(a)));
  porFecha.slice(0, Math.max(t.length > 4 ? 0 : 1, fila - t.length)).forEach((ll) => {
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
  if (v[0] === 'enc') return <span className={cls + ' n-enc'}>{v[1]}</span>;
  return <img className={cls} alt="" src="/ul.png" />;
}
// una encuesta abierta, como novedad: lleva a Encuestas (Dlx, 30/09: «¿por qué no lo ponemos en la sección de lo
// último?», del ×2)
function notaEncuesta(liga) {
  const x2 = liga.encuesta('x2');
  const el = liga.encuesta('elegido');
  const E = x2 || el;
  if (!E) return null;
  const x = String(E.x || 2).replace('.', ',');
  const tit = x2 ? '¿Qué servidor se lleva el ×' + x + ' la semana que viene? Votá' : '¿A quién salimos a buscar? Votá a El Elegido';
  return ['ENCUESTA', tit, ['enc', x2 ? '×' + x : '?'], 'cierra ' + liga.dia(E.hasta), { ancla: 'encuestas' }];
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
  const enc = notaEncuesta(liga);
  const resto = (enc ? [enc] : []).concat(items.filter((x) => x !== dest)).slice(0, 4);
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
// la tarjeta ya dice quién es, de dónde, su puesto y sus números: abajo va sólo lo que la tarjeta NO dice (los duelos
// ganados, los podios, la racha). Dlx, 01/10/2026: «las cosas de abajo son innecesarias porque la tarjeta ya tiene esa
// info». El perfil sigue a un toque: la tarjeta abre su visor, que tiene «Ver su perfil»
export function McPersona({ liga, f, dato, cual = 'temporada' }) {
  // ⏳ mientras la carta se redibuja, su número puede no coincidir con el orden de acá: se dice
  const vieja = liga.cartaVieja(f.k, cual);
  return (
    <article className="mc">
      <Carta liga={liga} k={f.k} cual={cual} cls="ci mc-ci" />
      {dato || vieja ? <div className="mc-pie"><small>{dato}{dato && vieja ? ' · ' : ''}{vieja ? '⏳ SE ESTÁ REDIBUJANDO' : ''}</small></div> : null}
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
// ── tu puesto, debajo del top 5 (Dlx, 30/09/2026: «me gustan todas», la A): dónde estás y a cuánto del de arriba.
// Sólo si no estás en el top 5 —ahí ya te ves—; sin haber entrado, la invitación a entrar.
function Puesto({ cara, quien, pos, txt, href }) {
  return (
    <div className="mc-yo">
      {cara}
      <span className="mc-yo-q"><small>{quien}</small><b>{pos}</b></span>
      <span className="mc-yo-t">{txt}</span>
      {href ? <a className="mc-yo-a" href={href}>Ver el ranking <Ico n="flecha" t={14} /></a> : null}
    </div>
  );
}
function puestoDe(liga, lista, esMio, valor, unidad, dec = 0, posDe = null) {
  const i = lista.findIndex(esMio);
  if (i < 5) return null;
  const d = valor(lista[i - 1]) - valor(lista[i]);
  const dist = dec ? d.toFixed(dec).replace('.', ',') : num(d);
  // el puesto: el oficial si la lista lo trae (la Temporada tiene empates), si no el lugar en la lista
  const pos = posDe ? posDe(lista[i]) : i + 1;
  const arriba = posDe ? posDe(lista[i - 1]) : i;
  return { i, pos, txt: d > 0 ? 'a ' + dist + ' ' + unidad + ' del #' + arriba : 'empatado con el #' + arriba };
}

export function LosQueMandan({ liga, dc }) {
  const T = liga.oficiales();
  const yo = liga.yo;
  const cara = yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls="mc-yo-c" /> : null;
  const quien = yo ? limpio(yo.n).toUpperCase() : '';
  const fila = (x, href) => (x ? <Puesto cara={cara} quien={quien} pos={'#' + x.pos} txt={x.txt} href={href} /> : null);
  const cats = [];
  cats.push(['temporada', 'Temporada', T.slice(0, 5).map((f) => <McPersona key={f.k} liga={liga} f={f} />),
    yo ? fila(puestoDe(liga, T, (f) => f.k === yo.k, (f) => f.pts || 0, 'pts', 0, (f) => f.pos), '#/ranking/temporada') : null]);
  const compT = T.filter((f) => f.rg).sort((a, b) => (b.sc || 0) - (a.sc || 0));
  let yoComp = null;
  if (yo && !yo.rg) {
    const falta = Math.max(0, 10 - (yo.ev || 0));
    yoComp = <Puesto cara={cara} quien={quien} pos="—" txt={falta ? 'Te faltan ' + falta + (falta === 1 ? ' evento' : ' eventos') + ' para tu letra' : 'Tu letra llega con la próxima corrida'} href="#/ranking/competitivo" />;
  } else if (yo) {
    yoComp = fila(puestoDe(liga, compT, (f) => f.k === yo.k, (f) => f.sc || 0, 'de Score', 1), '#/ranking/competitivo');
  }
  cats.push(['competitivo', 'Competitivo', compT.slice(0, 5).map((f) => <McPersona key={f.k} liga={liga} f={f} cual="competitivo" />), yoComp]);
  const duT = (liga.d.duelos || []).filter((d) => !d.fc && liga.T[d.k]);
  cats.push(['duelos', 'Duelos', duT.slice(0, 5).map((d) => <McPersona key={d.k} liga={liga} f={liga.T[d.k]} dato={d.g + ' DE ' + d.t + ' DUELOS GANADOS'} />),
    yo ? fila(puestoDe(liga, duT, (d) => d.k === yo.k, (d) => d.g || 0, 'duelos ganados'), '#/ranking/duelos') : null]);
  const medT = T.filter((f) => (f.oro || 0) + (f.seg || 0) + (f.ter || 0))
    .sort((a, b) => (b.oro || 0) - (a.oro || 0) || (b.seg || 0) - (a.seg || 0) || (b.ter || 0) - (a.ter || 0) || a.pos - b.pos);
  const iMed = yo ? medT.findIndex((f) => f.k === yo.k) : -1;
  cats.push(['podios', 'Podios', medT.slice(0, 5).map((f) => <McPersona key={f.k} liga={liga} f={f} dato={'1.º ×' + (f.oro || 0) + ' · 2.º ×' + (f.seg || 0) + ' · 3.º ×' + (f.ter || 0)} />),
    iMed >= 5 ? <Puesto cara={cara} quien={quien} pos={'#' + (iMed + 1)} txt={'1.º ×' + (yo.oro || 0) + ' · 2.º ×' + (yo.seg || 0) + ' · 3.º ×' + (yo.ter || 0)} href="#/ranking/podios" /> : null]);
  const con = T.filter((f) => (f.rch || []).length > 1 && f.rch[1]);
  const vivas = con.filter((f) => f.rch[0]);
  const raT = (vivas.length ? vivas : con).slice().sort((a, b) => (vivas.length ? b.rch[0] - a.rch[0] : b.rch[1] - a.rch[1]) || a.pos - b.pos);
  const racha = (f) => (vivas.length ? f.rch[0] : f.rch[1]);
  cats.push(['rachas', 'Rachas', raT.slice(0, 5).map((f) => <McPersona key={f.k} liga={liga} f={f} dato={racha(f) + ' EVENTOS SEGUIDOS'} />),
    yo ? fila(puestoDe(liga, raT, (f) => f.k === yo.k, racha, 'eventos seguidos'), '#/ranking/rachas') : null]);
  const paT = (liga.d.paises || []).filter((p) => p.n);
  const miPais = yo && yo.cc ? puestoDe(liga, paT, (p) => p.cc === yo.cc, (p) => p.pts || 0, 'pts') : null;
  cats.push(['paises', 'Países', paT.slice(0, 5).map((p, i) => <McGrupo key={p.cc} n={i + 1} href={'#/pais/' + p.cc} img={<Bandera cc={p.cc} cls="mc-bandera" />}
    nombre={nombrePais(p.cc)} dato={num(p.pts) + ' PTS · ' + p.n + ' RAPEROS'} />),
  miPais ? <Puesto cara={<Bandera cc={yo.cc} cls="mc-yo-flag" />} quien={'TU PAÍS · ' + nombrePais(yo.cc).toUpperCase()} pos={'#' + miPais.pos} txt={miPais.txt} href="#/ranking/paises" /> : null]);
  const crT = (liga.d.crews || []).filter((c) => c.rk !== 0);
  const miCrew = yo ? liga.crewDe(yo) : null;
  const xCrew = miCrew ? puestoDe(liga, crT, (c) => c.crew === miCrew.crew, (c) => c.pts || 0, 'pts') : null;
  cats.push(['crews', 'Crews', crT.slice(0, 5).map((c, i) => <McGrupo key={c.crew} n={i + 1} href={'#/crew/' + encodeURIComponent(c.clave || c.crew)}
    img={c.logo ? <img className="mc-logo" alt="" src={'/' + c.logo} /> : <span className="mc-ini">{limpio(c.crew).slice(0, 2).toUpperCase()}</span>}
    nombre={limpio(c.crew)} dato={num(c.pts) + ' PTS · ' + c.n + ' RAPEROS'} />),
  xCrew ? <Puesto cara={null} quien={'TU CREW · ' + limpio(miCrew.crew).toUpperCase()} pos={'#' + xCrew.pos} txt={xCrew.txt} href="#/ranking/crews" /> : null]);
  // sin haber entrado (ni con Discord ni eligiendo quién sos), la invitación a verse
  const invita = !yo && !dc ? (
    <div className="mc-yo invita"><span className="mc-yo-t">¿Y vos? Entrá con Discord y ves tu puesto en cada categoría.</span>
      <button type="button" className="btn verde chico" onClick={accion.cuenta}>Entrar</button></div>
  ) : null;
  const items = cats.filter((c) => c[2].length).map(([c, et, h, yoFila]) => ({ c, et, t: 'Los que mandan', cuerpo: <><div className="rail mcs2">{h}</div>{yoFila || invita}</> }));
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
// Dlx, 30/09/2026: «tus últimos eventos son raros porque dice que son los últimos eventos». Decía «Tus eventos» en
// la pestaña y mostraba los de la Liga, que ya están en Fechas. Ahora son los tuyos, o cómo verlos.
export function TusEventos({ liga, dc }) {
  const f = liga.yo;
  if (!f && dc) {
    return (
      <section className="te">
        <div className="mis-cab"><span>CÓMO TE FUE</span></div>
        <p className="pronto-p">Tu cuenta de Discord todavía no tiene eventos en la {liga.temp}. Con el primero que juegues, acá aparecen tu puesto y los puntos que sumaste.</p>
        <div className="te-acc"><a className="btn negro" href="#/eventos">Ver los próximos eventos</a></div>
      </section>
    );
  }
  if (!f) {
    return (
      <section className="te">
        <div className="mis-cab"><span>CÓMO TE FUE</span></div>
        <p className="pronto-p">Entrá con Discord y acá aparecen los eventos que jugaste esta temporada, con tu puesto y los puntos que sumaste.</p>
        <div className="te-acc"><button type="button" className="btn negro" onClick={accion.cuenta}>Entrar con Discord</button></div>
      </section>
    );
  }
  const mios = liga.semanaDe(f.k).slice(0, 5);
  return (
    <section className="te">
      <div className="mis-cab"><span>CÓMO TE FUE · {liga.temp}</span><em>{f.ev || 0} {f.ev === 1 ? 'EVENTO' : 'EVENTOS'}</em></div>
      {mios.length ? (
        <ol className="te-l">
          {mios.map(([ll, res, pts]) => (
            <li key={ll.n}><button type="button" className="sin-boton te-b" onClick={() => accion.llave(ll.n)}>
              <img alt="" src={liga.logo(ll.sv)} />
              <div><b>{limpio(ll.nombre)}</b><small>{ll.sv} · {liga.cuando(liga.fechaLlave(ll))} · {ll.participantes} raperos</small></div>
              <span className={'te-vos' + (res === 'Campeón' ? ' campeon' : '')}>{resultado(res, true)}<small>+{num(pts)} pts</small></span>
            </button></li>
          ))}
        </ol>
      ) : (
        <p className="pronto-p">Todavía no jugaste en esta temporada. Los próximos eventos están en el <a className="te-link" href="#/eventos">calendario</a>.</p>
      )}
    </section>
  );
}
export function TuTemporada({ liga, dc }) {
  const f = liga.yo;
  if (!f && dc) {
    return (
      <section className="tu">
        <div className="tu-t">TU TEMPORADA</div>
        <p className="pronto-p">Todavía no jugaste en la {liga.temp}. Con tu primer evento aparecen tu puesto, tu OVR y tu carta.</p>
        <button type="button" className="btn negro" onClick={accion.cuenta}>Mi cuenta</button>
      </section>
    );
  }
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
        <div className="tu-pos"><b>{f.pos ? '#' + f.pos : '—'}</b><small>OVR {f.ovr || '—'} · {num(f.pts)} pts · {ev} eventos</small></div>
        {f.rg ? <Rango liga={liga} rg={f.rg} /> : <span className="rg sinletra">?</span>}
      </div>
      <div className="tu-prog">
        <div className="barra10">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < ev ? 'si' : ''} />)}</div>
        <small>{falta ? 'Todavía sin letra: ' + ev + ' de 10 eventos. Te faltan ' + falta + ' para tu rango.' : 'Ya tenés letra.'}</small>
      </div>
      {bus ? <div className="te-buscan"><b>HOY TE BUSCAN</b><span>{num(bus.v)} pts por tu cabeza · {bus.cn} · hasta {liga.dia(mw.fin)}</span></div> : null}
      <div className="tu-acc"><a className="btn negro" href={'#/r/' + encodeURIComponent(f.k)}>Ver mi perfil</a>
        <Compartir cls="btn borde2" url={liga.cartaUrl(f.k, 'temporada') || enlace('#/r/' + encodeURIComponent(f.k))} texto="Mi carta de la Liga Global" etiqueta="Compartir mi carta" /></div>
    </section>
  );
}
// ¿hubo al menos una participación en las dos semanas de «Lo que se jugó»?
const jugoAlgo = (a) => (a.dias || []).some(([, x]) => Object.values(x || {}).some((n) => n > 0));
function Numeros({ liga }) {
  const c = liga.d.comunidad || {};
  const a = liga.d.actividad || {};
  const grandes = [['PERSONAS', c.personas, 'en ' + (c.servidores || 0) + ' servidores'], ['EN LA LISTA', c.lista, 'compitieron o se anotaron'],
    ['CON SU DISCORD', c.con_id, 'el bot sabe quiénes son'], ['VERIFICADAS', c.verificados, 'con las cuatro tarjetas']].filter((x) => x[1]);
  // sin un solo evento en las dos semanas no se dibuja: una tira de ceros el día del arranque dice «no pasa nada»,
  // y lo que pasa es que la temporada recién empieza (medido con la página en cero, 02/10/2026)
  const dias = jugoAlgo(a) ? a.dias : [];
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
// Misiones, solas: Dlx, 30/09/2026, «dejar abajo solo las misiones». Tus eventos subió al lugar de las encuestas y
// La Liga en números bajó, debajo del Merchandising.
export function Panel({ liga }) {
  return (
    <Sec id="panel" titulo="Misiones">
      <div className="pz-2"><Misiones /><Pase liga={liga} /></div>
    </Sec>
  );
}

// La Liga en números, sola, debajo del Merchandising (Dlx, 30/09/2026). Sin datos, no se dibuja
export function LaLiga({ liga }) {
  const c = liga.d.comunidad || {};
  const a = liga.d.actividad || {};
  const hay = c.personas || c.lista || c.con_id || c.verificados || jugoAlgo(a) || (liga.d.records || []).length;
  if (!hay) return null;
  return <Sec id="numeros" titulo="La Liga en números" enlace="Socios" href="#/socios"><Numeros liga={liga} /></Sec>;
}
