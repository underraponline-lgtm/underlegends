// Lo de abajo del Inicio: Se busca, el Merchandising, el pie, la barra de abajo del celular, el menú ☰ y el visor de
// historias. Nació de docs/remake/reales.py y del prototipo (prototipo.js). El 30/09/2026 se fueron de acá la Tienda
// y los servidores (Dlx: «la TIENDA no debería estar ahí, debería estar merchandising» y «los servidores de la liga
// estando abajo es algo tonto porque ya están arriba»), y El Elegido se mudó a Encuestas.
import { useEffect, useMemo, useRef, useState } from 'react';
import { limpio, nuevaQue, num } from './liga.js';
import { Cara, Chevron, Compartir, Ico, Poster, Sec, accion, enlace, subirSiEsta } from './piezas.jsx';
import { Buscar, CaraDc, CaraH, MENU } from './arriba.jsx';


// ── Se busca ──────────────────────────────────────────────────────────────────────────────────────


export function SeBusca({ liga }) {
  const mw = liga.d.mw || {};
  const tira = useRef(null);
  if (!(mw.b || []).length) return null;
  const diario = mw.tipo === 'dia';
  const correr = (d) => { if (tira.current) tira.current.scrollBy({ left: d * tira.current.clientWidth * 0.8, behavior: 'smooth' }); };
  return (
    <Sec id="sebusca" titulo="Se busca" enlace="Most Wanted" href="#/ranking/mw" extra="negra">
      <div className="mw-cab"><span>{mw.b.length} buscados {diario ? 'hoy' : 'esta semana'} · vencen {liga.dia(mw.fin)}</span>
        <span className="mw-fl"><button type="button" className="mw-b" aria-label="Anteriores" onClick={() => correr(-1)}>←</button>
          <button type="button" className="mw-b" aria-label="Siguientes" onClick={() => correr(1)}>→</button></span></div>
      <div className="mw-rail" ref={tira}>
        {mw.b.map((b) => <Poster key={b.k} liga={liga} b={b} />)}
        {(mw.ant || []).length ? <div className="mw-div"><span>{diario ? 'AYER' : 'LA SEMANA PASADA'}</span></div> : null}
        {(mw.ant || []).map((b) => <Poster key={'a' + b.k} liga={liga} b={b} />)}
        {(mw.caz || []).length ? (
          <article className="poster cazadores"><span className="p-t">CAZADORES</span>
            <ol>{mw.caz.slice(0, 5).map((c) => <li key={c.k}><Cara liga={liga} k={c.k} nombre={c.n} cls="mono-c" /><b>{limpio(c.n)}</b><em>{num(c.pts)}</em></li>)}</ol>
            <small>lo cobrado en la temporada</small></article>
        ) : null}
      </div>
      <p className="p-nota">Quien le gane, cobra en su Temporada y el 10 % en Puntos de Tienda.</p>
    </Sec>
  );
}

// ── el Merchandising: donde estaba la Tienda (Dlx, 30/09/2026), y con EJEMPLOS desde el 04/10/2026 (Dlx: «en
// mercancía creá ejemplos de lo que sería nuestra mercancía… con nosotros y nuestros socios… no venderemos nada
// todavía, pero sería un ejemplo»). Todo dice que es un ejemplo y que no está a la venta: no hay precio ni botón.
// Los dibujos son planos, en SVG, como pide el remake (sin degradés ni sombras); el logo de cada socio sale del lobby.
const oscuro = (hex) => {
  const h = String(hex || '#000').replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};

function Prenda({ tipo, color, logo, texto }) {
  const borde = oscuro(color) ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.28)';
  const tinta = oscuro(color) ? '#FFFFFF' : '#141414';
  if (tipo === 'gorra') {
    return (
      <svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <path d="M48 124 Q48 62 100 58 Q152 62 152 124 Z" fill={color} stroke={borde} strokeWidth="2" />
        <path d="M44 124 L156 124 Q182 127 188 138 L62 138 Q46 136 44 124 Z" fill={color} stroke={borde} strokeWidth="2" />
        <circle cx="100" cy="60" r="4" fill={borde} />
        <image href={logo} x="78" y="76" width="44" height="44" preserveAspectRatio="xMidYMid meet" />
      </svg>
    );
  }
  if (tipo === 'buzo') {
    return (
      <svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <path d="M66 40 L84 26 Q100 22 116 26 L134 40 L170 64 L162 152 L146 152 L142 94 L142 184 L58 184 L58 94 L54 152 L38 152 L30 64 Z"
          fill={color} stroke={borde} strokeWidth="2" strokeLinejoin="round" />
        <path d="M84 26 Q100 4 116 26 Q100 42 84 26 Z" fill={color} stroke={borde} strokeWidth="2" />
        <path d="M74 146 L126 146 L132 172 L68 172 Z" fill="none" stroke={borde} strokeWidth="2" />
        <image href={logo} x="80" y="66" width="40" height="40" preserveAspectRatio="xMidYMid meet" />
        {texto ? <text x="100" y="126" textAnchor="middle" fill={tinta} style={{ font: '900 11px Archivo, sans-serif', letterSpacing: '.08em' }}>{texto}</text> : null}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 200" role="img" aria-hidden="true">
      <path d="M70 28 L88 20 Q100 32 112 20 L130 28 L168 52 L152 82 L138 74 L138 184 L62 184 L62 74 L48 82 L32 52 Z"
        fill={color} stroke={borde} strokeWidth="2" strokeLinejoin="round" />
      <path d="M88 20 Q100 32 112 20" fill="none" stroke={borde} strokeWidth="2" />
      <image href={logo} x="76" y="58" width="48" height="48" preserveAspectRatio="xMidYMid meet" />
      {texto ? <text x="100" y="128" textAnchor="middle" fill={tinta} style={{ font: '900 10px Archivo, sans-serif', letterSpacing: '.08em' }}>{texto}</text> : null}
    </svg>
  );
}

function Stickers({ logos }) {
  const pos = [[62, 62], [138, 62], [100, 100], [62, 138], [138, 138]];
  return (
    <svg viewBox="0 0 200 200" role="img" aria-hidden="true">
      <defs>{pos.map(([x, y], i) => <clipPath key={i} id={'mq-st-' + i}><circle cx={x} cy={y} r="26" /></clipPath>)}</defs>
      <rect x="22" y="22" width="156" height="156" rx="4" fill="#F6F6F6" stroke="rgba(0,0,0,.28)" strokeWidth="2" />
      {pos.map(([x, y], i) => (logos[i] ? (
        <g key={i}>
          <circle cx={x} cy={y} r="29" fill="#FFFFFF" stroke="rgba(0,0,0,.18)" strokeWidth="1.5" />
          <image href={logos[i]} x={x - 26} y={y - 26} width="52" height="52" clipPath={'url(#mq-st-' + i + ')'} preserveAspectRatio="xMidYMid slice" />
        </g>
      ) : null))}
    </svg>
  );
}

export function Merch({ liga }) {
  // los socios: los servidores de la Liga que vienen en el lobby, con su color y su logo
  const svs = liga ? Object.values(liga.svs || {}).filter((s) => s.color && s.sv) : [];
  const socios = svs.filter((s) => s.logo).slice(0, 4);
  const items = [
    ['remera', 'Remera Under Legends', 'Negra, con el logo al pecho', <Prenda tipo="remera" color="#141414" logo="/ul.png" />],
    ['buzo', 'Buzo Liga Global', 'Magenta, con el logo y «LIGA GLOBAL»', <Prenda tipo="buzo" color="#E41373" logo="/ul.png" texto="LIGA GLOBAL" />],
    ['gorra', 'Gorra UL', 'Blanca, con el logo bordado', <Prenda tipo="gorra" color="#F2F2F2" logo="/ul.png" />],
    ...socios.map((s) => ['sv-' + s.sv, 'Remera ' + (s.sigla || s.sv), s.nombre + ', socio de la Liga',
      <Prenda tipo="remera" color={s.color} logo={liga.logo(s.sv)} texto={String(s.sigla || s.sv).toUpperCase()} />]),
    ...(svs.length ? [['stickers', 'Stickers de la Liga', 'Los logos de los socios',
      <Stickers logos={['/ul.png', ...svs.filter((s) => s.logo).map((s) => liga.logo(s.sv))]} />]] : []),
  ];
  return (
    <Sec id="merch" titulo="Merchandising">
      {/* el texto en UN span: la nota es flex, y cada pedazo suelto quedaba como un ítem con su hueco («nada : cuando») */}
      <p className="mq-nota"><span className="tag-pronto">EJEMPLOS</span><span>Así podría ser la ropa de Under Legends y de sus socios. <b>Todavía no se vende nada</b>: cuando salga, la ves acá primero.</span></p>
      <div className="mq-rail">
        {items.map(([k, n, d, dibujo]) => (
          <article className="mq" key={k}>
            <div className="mq-img">{dibujo}</div>
            <b>{n}</b>
            <small>{d}</small>
            <span className="mq-ej">EJEMPLO · NO ESTÁ A LA VENTA</span>
          </article>
        ))}
      </div>
    </Sec>
  );
}

// ── el pie ────────────────────────────────────────────────────────────────────────────────────────
// sin «10.143 personas en 5 servidores · 346 verificados»: es lo mismo que La Liga en números, justo arriba (Dlx,
// 01/10/2026: «hay info que se repite»)
export function Pie({ liga }) {
  return (
    <footer className="pie negra">
      <div className="pie-marca"><img alt="" src="/ul.png" /><span>UNDER LEGENDS<small>LIGA GLOBAL · {liga.tempLarga}</small></span></div>
      <nav><a href="#/guia">Guía</a><a href="#/publicaciones">Publicaciones</a><a href="#/tienda">Tienda</a><a href="#/socios">Socios</a>
        <a href="#/cambios">Cambios</a><a href="/privacidad.html">Privacidad</a><a href="/terminos.html">Términos</a></nav>
      {/* 🗓️ desde cuándo existe (Dlx, 07/10/2026: «cuándo fue creado el proyecto… el mes, el día y el año»): el primer
          commit del proyecto, «Estado inicial: generadores andando en Windows», 29/07/2026 a las 2:04 AM ET */}
      <small>Los datos se actualizan solos cada media hora.<br />Creado el 29 de julio de 2026.</small>
    </footer>
  );
}

// ── la barra de abajo del celular y el menú ☰ ─────────────────────────────────────────────────────
export function Tabbar({ liga, dc, pagina = '' }) {
  // 🔑 UNA TIRA QUE SE DESLIZA, con todas las secciones como en la compu. Dlx, 28/09/2026: «en el PC será normal pero
  // en celular haz que se deslice para ver más opciones», y el 02/10, al ver cinco fijas: «pensé que habíamos acordado
  // que lo de abajo sería en una tira como está en el ordenador». Las mismas de `MENU` (la cabecera de la compu): una
  // sección nueva entra en las dos. Y tu cuenta, «Yo», fija a la derecha y fuera de la tira (02/10: «el engranaje en
  // vez de la cuenta»), como el «Tú» de Discord
  const yo = liga && liga.yo;
  const cara = yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls="tb-cara" /> : (dc ? <CaraDc dc={dc} cls="tb-cara" /> : null);
  return (
    <nav className="tabbar" aria-label="Secciones">
      <div className="tb-tira">
        {MENU.map(([n, r]) => {
          const k = r.replace(/^#\/?/, '') || 'inicio';
          // la de la página que se ve: el Inicio sin ruta, y las que dibuja el Inicio nuevo por su nombre (el Ranking)
          return <a key={k} href={r} onClick={subirSiEsta(r)} className={(k === 'inicio' ? !pagina : pagina === k) ? 'on' : ''}><Ico n={k} t={22} /><span>{n}</span></a>;
        })}
      </div>
      <a href="#/cuenta" className={'tb-yo' + (pagina === 'cuenta' ? ' on' : '')} aria-label="Mi cuenta">{cara || <Ico n="yo" t={22} />}<span>Yo</span></a>
    </nav>
  );
}

export function Menu({ liga, abierto, onCerrar, tema, onTema }) {
  // ⚠️ el foco entra al abrirlo y vuelve al ☰ al cerrarlo: con el teclado se quedaba atrás, en la página tapada
  // (revisión del 03/10/2026). Aparte del efecto del Escape: `onCerrar` cambia en cada vuelta de App
  const cerrarB = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const t = setTimeout(() => { if (cerrarB.current) cerrarB.current.focus(); }, 0);
    return () => {
      clearTimeout(t);
      const h = document.getElementById('inicio-nuevo');
      const b = h && h.shadowRoot ? h.shadowRoot.querySelector('.hamb') : null;
      if (b) b.focus();
    };
  }, [abierto]);
  useEffect(() => {
    if (!abierto) return undefined;
    const k = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  // el changelog, con su «NUEVO» si hay una versión que no viste (lo que app.js ya cargó para el punto del menú)
  const C = window.CAMBIOS;
  const ult = Array.isArray(C) && C[0] ? C[0].version : '';
  const nuevo = !!ult && nuevaQue(ult, window.CAMBIOS_VISTO);
  const cambios = (
    <div className="x-fila"><span>Changelog<small>Lo nuevo de la página{ult ? ', hasta la v' + ult : ''}.</small></span>
      <a className="btn negro chico" href="#/cambios" onClick={onCerrar}>{nuevo ? <em className="x-nuevo">NUEVO</em> : null}Ver</a></div>
  );
  return (
    <div className="x-menu" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="x-caja" role="dialog" aria-modal="true" aria-label="Menú">
        <div className="x-caja-cab"><b>MENÚ</b><button className="btn-ico x-cerrar" type="button" aria-label="Cerrar el menú" onClick={onCerrar} ref={cerrarB}><Ico n="cerrar" t={22} /></button></div>
        {/* en el celular el buscador no entra arriba: vive acá */}
        {liga ? <div className="x-busca"><Buscar liga={liga} onIr={onCerrar} /></div> : null}
        <nav className="x-lista" aria-label="Secciones">{MENU.slice(1).map(([n, r]) => <a key={n} href={r} onClick={onCerrar}>{n}<Ico n="flecha" t={20} /></a>)}</nav>
        <div className="x-aj">
          <span className="x-aj-t">AJUSTES</span>
          <div className="x-fila"><span>Tema</span>
            <div className="x-seg" role="group" aria-label="Tema">
              <button type="button" aria-pressed={tema === 'clara'} onClick={() => onTema('clara')}>Clara</button>
              <button type="button" aria-pressed={tema === 'noche'} onClick={() => onTema('noche')}>Noche</button>
            </div></div>
          <div className="x-fila"><span>Hora, zona y más<small>El formato de la hora, tu zona y menos animaciones.</small></span>
            <a className="btn negro chico" href="#/ajustes/hora" onClick={onCerrar}>Abrir</a></div>
          {cambios}
          <div className="x-fila"><span>Mi cuenta<small>Entrar con Discord, tu foto, tus redes y tus avisos.</small></span>
            <button type="button" className="btn negro chico" onClick={() => { onCerrar(); accion.cuenta(); }}>Abrir</button></div>
        </div>
      </div>
    </div>
  );
}

// ── el visor de historias, como las de Instagram ──────────────────────────────────────────────────
export function Visor({ liga, grupos, abierto, onCerrar, onVisto, vistos = {}, raiz }) {
  // 🔴 el grupo abierto se sigue por su ID, no por su lugar en la fila: los datos se rehacen cada minuto y, si
  // empezaba un evento en vivo con el visor abierto, su círculo entraba primero y corría a todos un lugar (saltabas a
  // otra historia a mitad). Y el reloj de cada historia volvía a cero en cada refresco (revisión del 01/10/2026)
  // 🔴 LO VISTO SE CUENTA HISTORIA POR HISTORIA, Y SE SALTEA. Dlx, 02/10/2026: «aún sigo viendo las historias que ya
  // he visto… no skipea las que ya vi y no me muestra lo más reciente PRIMERO». Antes se guardaba UNA marca por
  // círculo (la hora de lo último visto): con algo nuevo, el círculo entero volvía a verde y abría donde caía. Ahora
  // cada historia tiene su `id` (ver `gruposHistorias`) y al abrir se arranca en la primera que no viste; si ya viste
  // todas, desde la primera. Al terminar, el siguiente círculo con algo sin ver.
  // 🔁 Y DESDE EL 04/10/2026, COMO INSTAGRAM (Dlx: «el orden… está invertido, fijate cómo lo hace Instagram»): el
  // círculo trae TODAS sus historias, de la más vieja a la más nueva, con las barritas de las ya vistas llenas, y abre
  // en la primera que no viste. Lo visto no se vuelve a pasar solo, pero se puede volver con «anterior»
  const pend = (g) => g.slides.filter((s) => !vistos[s.id]).map((s) => s.id);
  const lista = (g) => (g ? g.slides.map((s) => s.id) : []);
  const inicio = (g) => { if (!g) return 0; const k = g.slides.findIndex((s) => !vistos[s.id]); return k < 0 ? 0 : k; };
  // la lista de cada círculo se fija al abrirlo: marcar como vista la que estás mirando no la saca de abajo del dedo
  const [abre, setAbre] = useState(() => ({ gid: (grupos[abierto] || {}).id, ids: lista(grupos[abierto]) }));
  const [si, setSi] = useState(() => inicio(grupos[abierto]));
  const [avance, setAvance] = useState(0);
  const pausa = useRef(false);
  const cerrarB = useRef(null);
  const DUR = 5000;
  const a = (i) => { setAbre({ gid: grupos[i].id, ids: lista(grupos[i]) }); setSi(inicio(grupos[i])); setAvance(0); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (grupos[abierto]) a(abierto); }, [abierto]);
  const gid = abre.gid;
  const gi = grupos.findIndex((x) => x.id === gid);
  const g = gi >= 0 ? grupos[gi] : null;
  // las historias de la lista que siguen existiendo (los datos se rehacen cada minuto: una pudo irse)
  const ids = g ? abre.ids.filter((id) => g.slides.some((s) => s.id === id)) : [];
  const hay = !!g && ids.length > 0;
  const idAct = ids[Math.min(si, ids.length - 1)];
  // vista apenas se muestra
  useEffect(() => { if (idAct) onVisto(idAct); }, [idAct, onVisto]);
  // si su grupo desaparece (el evento en vivo terminó), el visor se cierra en vez de quedar abierto y vacío
  useEffect(() => { if (!hay) onCerrar(); }, [hay, onCerrar]);
  // el foco entra al visor: con el teclado, Escape y las flechas ya andaban, pero el Tab seguía en la página de atrás
  useEffect(() => { if (cerrarB.current) cerrarB.current.focus({ preventScroll: true }); }, []);
  const siguiente = () => {
    if (!g) return;
    if (si < ids.length - 1) { setSi(si + 1); setAvance(0); return; }
    // el próximo círculo con algo sin ver; si no queda ninguno, se cierra
    const j = grupos.findIndex((x, k) => k > gi && pend(x).length);
    if (j >= 0) a(j); else onCerrar();
  };
  const anterior = () => {
    if (!g) return;
    if (si > 0) { setSi(si - 1); setAvance(0); } else if (gi > 0) a(gi - 1);
  };
  // el reloj de cada historia: un solo requestAnimationFrame por historia, y la que sigue la pide la última versión
  // de `siguiente` (un ref), no la de cuando arrancó el reloj
  const sig = useRef(siguiente);
  const ant = useRef(anterior);
  sig.current = siguiente;
  ant.current = anterior;
  useEffect(() => {
    if (!g) return undefined;
    let raf = 0; let antes = performance.now(); let acum = 0;
    const tick = (t) => {
      if (!pausa.current) acum += t - antes;
      antes = t;
      setAvance(acum);
      if (acum >= DUR) { sig.current(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gid, si, hay]);
  useEffect(() => {
    if (!hay) return undefined;
    const k = (e) => { if (e.key === 'Escape') onCerrar(); if (e.key === 'ArrowRight') sig.current(); if (e.key === 'ArrowLeft') ant.current(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [hay, onCerrar]);
  const ir = useMemo(() => (d) => {
    if (!d) return;
    onCerrar();
    if (d.carta) accion.carta(d.carta, d.cual);
    else if (d.perfil) accion.perfil(d.perfil);
    else if (d.llave) accion.llave(d.llave);
    else if (d.ruta) location.hash = d.ruta;
    else if (d.link) window.open(d.link, '_blank', 'noopener');
    else if (d.ancla && raiz.current) { const s = raiz.current.querySelector('#' + d.ancla); if (s) s.scrollIntoView({ behavior: 'smooth' }); }
  }, [onCerrar, raiz]);
  if (!hay) return null;
  const s = g.slides.find((x) => x.id === idAct) || g.slides[0];
  // lo que se comparte de una historia: la carta (la imagen), la llave o el perfil al que lleva
  const d = s.ir || {};
  const compartir = d.carta ? liga.cartaUrl(d.carta, d.cual || 'temporada') || enlace('#/r/' + encodeURIComponent(d.carta))
    : d.llave ? enlace('#/llave/' + d.llave) : d.perfil ? enlace('#/r/' + encodeURIComponent(d.perfil)) : null;
  const perfil = g.tipo === 'gente' ? '#/r/' + encodeURIComponent(g.k)
    : g.tipo === 'pais' ? '#/pais/' + g.cc
      : g.tipo === 'crew' ? '#/crew/' + encodeURIComponent(g.crew.clave || g.crew.crew)
        : g.tipo === 'sv' ? '#/sv/' + encodeURIComponent(g.nom) : g.tipo === 'liga' ? '#/ranking' : '#/eventos';
  const circulo = g.tipo === 'gente' ? <CaraH liga={liga} k={g.k} nombre={g.nom} cc={g.cc} />
    : g.tipo === 'liga' ? <span className="h-c"><img alt="" src="/ul.png" /></span>
    : g.tipo === 'pais' ? <span className="h-c bandera"><img alt="" src={'/banderas/g/' + g.cc + '.webp'} /></span>
      : g.tipo === 'crew' ? (g.crew.logo ? <span className="h-c"><img alt="" src={'/' + g.crew.logo} /></span> : <span className="h-c mono">{g.nom.slice(0, 2).toUpperCase()}</span>)
        : <span className="h-c"><img alt="" src={g.logo} /></span>;
  return (
    <div className="hv-ov" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="hv-box" role="dialog" aria-modal="true" aria-label="Historias"
        onPointerDown={() => { pausa.current = true; }} onPointerUp={() => { pausa.current = false; }} onPointerLeave={() => { pausa.current = false; }}>
        <div className="hv-bars">{ids.map((id, i) => <i key={id} className={i < si ? 'hecho' : ''}><b style={{ width: (i === si ? Math.min(100, avance / DUR * 100) : 0) + '%' }} /></i>)}</div>
        <div className="hv-cab">
          <a className="hv-quien" href={perfil} onClick={onCerrar} aria-label={'Ir al perfil de ' + g.nombre}>{circulo}<span><b>{g.nombre}</b><small>{s.cuando || ''}</small></span></a>
          {compartir ? <Compartir cls="hv-comp" url={compartir} texto={'En la Liga Global: ' + g.nombre} etiqueta="" /> : null}
          <button type="button" className="hv-x" aria-label="Cerrar las historias" onClick={onCerrar} ref={cerrarB}><Ico n="cerrar" t={22} /></button></div>
        <div className="hv-cuerpo"><div className="st"><span className="st-tag">{s.tag}</span>{s.cuerpo}</div></div>
        {s.cta && s.ir && Object.values(s.ir).some(Boolean) ? <button type="button" className="btn verde hv-cta" onClick={() => ir(s.ir)}>{s.cta}</button> : null}
        <button type="button" className="hv-zona izq" aria-label="Anterior" onClick={anterior} />
        <button type="button" className="hv-zona der" aria-label="Siguiente" onClick={siguiente} />
      </div>
      <button type="button" className="hv-fl izq" aria-label="Historia anterior" onClick={anterior}><Chevron /></button>
      <button type="button" className="hv-fl der" aria-label="Historia siguiente" onClick={siguiente}><Chevron /></button>
    </div>
  );
}
