// Lo de abajo del Inicio: Se busca, el Merchandising, el pie, la barra de abajo del celular, el menú ☰ y el visor de
// historias. Nació de docs/remake/reales.py y del prototipo (prototipo.js). El 30/09/2026 se fueron de acá la Tienda
// y los servidores (Dlx: «la TIENDA no debería estar ahí, debería estar merchandising» y «los servidores de la liga
// estando abajo es algo tonto porque ya están arriba»), y El Elegido se mudó a Encuestas.
import { useEffect, useMemo, useRef, useState } from 'react';
import { limpio, num } from './liga.js';
import { Cara, Chevron, Compartir, Ico, Poster, Sec, accion, enlace } from './piezas.jsx';
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

// ── el Merchandising: donde estaba la Tienda (Dlx, 30/09/2026). Todavía no salió nada, y se dice así ───────────
export function Merch() {
  return (
    <Sec id="merch" titulo="Merchandising">
      <div className="merch">
        <img className="merch-logo" alt="" src="/ul.png" />
        <div className="merch-tx">
          <span className="tag-pronto">PRÓXIMAMENTE</span>
          <h3>El merchandising de Under Legends</h3>
          <p>Todavía no salió nada. Cuando salga, lo ves acá primero.</p>
        </div>
      </div>
    </Sec>
  );
}

// ── el pie ────────────────────────────────────────────────────────────────────────────────────────
export function Pie({ liga }) {
  const c = liga.d.comunidad || {};
  return (
    <footer className="pie negra">
      <div className="pie-marca"><img alt="" src="/ul.png" /><span>UNDER LEGENDS<small>LIGA GLOBAL · {liga.tempLarga}</small></span></div>
      <p className="pie-c">{num(c.personas || 0)} personas en {c.servidores || 0} servidores · {num(c.verificados || 0)} verificados</p>
      <nav><a href="#/guia">Guía</a><a href="#/publicaciones">Publicaciones</a><a href="#/tienda">Tienda</a><a href="#/mundo">Mundo</a>
        <a href="#/cambios">Cambios</a><a href="/privacidad.html">Privacidad</a></nav>
      <small>Los datos se actualizan solos cada media hora.</small>
    </footer>
  );
}

// ── la barra de abajo del celular y el menú ☰ ─────────────────────────────────────────────────────
// la foto de la barra de abajo: si el link de Discord venció, el ícono y no la imagen rota
function TabAv({ liga, k }) {
  const [mal, setMal] = useState(null);
  const src = liga.avUrl(k);
  if (!src || mal === src) return <Ico n="yo" t={22} />;
  return <img className="tab-av" alt="" src={src} onError={() => setMal(src)} />;
}

export function Tabbar({ liga, dc }) {
  const yo = liga.yo;
  const tabs = [['Inicio', 'inicio', '#/'], ['Eventos', 'eventos', '#/eventos'], ['Ranking', 'ranking', '#/ranking'], ['Publicaciones', 'publicaciones', '#/publicaciones']];
  return (
    <nav className="tabbar" aria-label="Secciones">
      {tabs.map(([n, k, r]) => <a key={k} href={r} className={k === 'inicio' ? 'on' : ''}><Ico n={k} t={22} /><span>{n}</span></a>)}
      {yo ? <a href={'#/r/' + encodeURIComponent(yo.k)}><TabAv liga={liga} k={yo.k} /><span>Yo</span></a>
        : <button type="button" className="sin-boton tab-b" onClick={accion.cuenta}>{dc ? <CaraDc dc={dc} cls="tab-av" /> : <Ico n="yo" t={22} />}<span>Yo</span></button>}
    </nav>
  );
}

export function Menu({ liga, abierto, onCerrar, tema, onTema }) {
  useEffect(() => {
    if (!abierto) return undefined;
    const k = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="x-menu" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="x-caja" role="dialog" aria-modal="true" aria-label="Menú">
        <div className="x-caja-cab"><b>MENÚ</b><button className="btn-ico x-cerrar" type="button" aria-label="Cerrar el menú" onClick={onCerrar}><Ico n="cerrar" t={22} /></button></div>
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
            <button type="button" className="btn negro chico" onClick={() => { onCerrar(); accion.ajustes(); }}>Abrir</button></div>
          <div className="x-fila"><span>Mi cuenta<small>Entrar con Discord, tu foto, tus redes y tus avisos.</small></span>
            <button type="button" className="btn negro chico" onClick={() => { onCerrar(); accion.cuenta(); }}>Abrir</button></div>
        </div>
      </div>
    </div>
  );
}

// ── el visor de historias, como las de Instagram ──────────────────────────────────────────────────
export function Visor({ liga, grupos, abierto, onCerrar, onVisto, raiz }) {
  // 🔴 el grupo abierto se sigue por su ID, no por su lugar en la fila: los datos se rehacen cada minuto y, si
  // empezaba un evento en vivo con el visor abierto, su círculo entraba primero y corría a todos un lugar (saltabas a
  // otra historia a mitad). Y el reloj de cada historia volvía a cero en cada refresco (revisión del 01/10/2026)
  const [gid, setGid] = useState(() => (grupos[abierto] || {}).id);
  const [si, setSi] = useState(0);
  const [avance, setAvance] = useState(0);
  const pausa = useRef(false);
  const cerrarB = useRef(null);
  const DUR = 5000;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setGid((grupos[abierto] || {}).id); setSi(0); setAvance(0); }, [abierto]);
  const gi = grupos.findIndex((x) => x.id === gid);
  const g = gi >= 0 ? grupos[gi] : null;
  const hay = !!g;
  const firmaG = g ? g.firma : '';
  useEffect(() => { if (hay) onVisto(gid, firmaG); }, [gid, firmaG, hay, onVisto]);
  // si su grupo desaparece (el evento en vivo terminó), el visor se cierra en vez de quedar abierto y vacío
  useEffect(() => { if (!hay) onCerrar(); }, [hay, onCerrar]);
  // el foco entra al visor: con el teclado, Escape y las flechas ya andaban, pero el Tab seguía en la página de atrás
  useEffect(() => { if (cerrarB.current) cerrarB.current.focus({ preventScroll: true }); }, []);
  const a = (i) => { setGid(grupos[i].id); setSi(0); setAvance(0); };
  const siguiente = () => {
    if (!g) return;
    if (si < g.slides.length - 1) { setSi(si + 1); setAvance(0); } else if (gi < grupos.length - 1) a(gi + 1); else onCerrar();
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
    if (d.carta) accion.carta(d.carta);
    else if (d.perfil) accion.perfil(d.perfil);
    else if (d.llave) accion.llave(d.llave);
    else if (d.ruta) location.hash = d.ruta;
    else if (d.link) window.open(d.link, '_blank', 'noopener');
    else if (d.ancla && raiz.current) { const s = raiz.current.querySelector('#' + d.ancla); if (s) s.scrollIntoView({ behavior: 'smooth' }); }
  }, [onCerrar, raiz]);
  if (!g) return null;
  const s = g.slides[Math.min(si, g.slides.length - 1)];
  // lo que se comparte de una historia: la carta (la imagen), la llave o el perfil al que lleva
  const d = s.ir || {};
  const compartir = d.carta ? liga.cartaUrl(d.carta, 'temporada') || enlace('#/r/' + encodeURIComponent(d.carta))
    : d.llave ? enlace('#/llave/' + d.llave) : d.perfil ? enlace('#/r/' + encodeURIComponent(d.perfil)) : null;
  const perfil = g.tipo === 'gente' ? '#/r/' + encodeURIComponent(g.k)
    : g.tipo === 'pais' ? '#/pais/' + g.cc
      : g.tipo === 'crew' ? '#/crew/' + encodeURIComponent(g.crew.clave || g.crew.crew)
        : g.tipo === 'sv' ? '#/sv/' + encodeURIComponent(g.nom) : '#/eventos';
  const circulo = g.tipo === 'gente' ? <CaraH liga={liga} k={g.k} nombre={g.nom} cc={g.cc} />
    : g.tipo === 'pais' ? <span className="h-c bandera"><img alt="" src={'/banderas/g/' + g.cc + '.webp'} /></span>
      : g.tipo === 'crew' ? (g.crew.logo ? <span className="h-c"><img alt="" src={'/' + g.crew.logo} /></span> : <span className="h-c mono">{g.nom.slice(0, 2).toUpperCase()}</span>)
        : <span className="h-c"><img alt="" src={g.logo} /></span>;
  return (
    <div className="hv-ov" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="hv-box" role="dialog" aria-modal="true" aria-label="Historias"
        onPointerDown={() => { pausa.current = true; }} onPointerUp={() => { pausa.current = false; }} onPointerLeave={() => { pausa.current = false; }}>
        <div className="hv-bars">{g.slides.map((_, i) => <i key={i} className={i < si ? 'hecho' : ''}><b style={{ width: (i === si ? Math.min(100, avance / DUR * 100) : 0) + '%' }} /></i>)}</div>
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
