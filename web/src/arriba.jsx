// Lo de arriba del Inicio: la cabecera negra, las historias, el escenario (el carrusel de momentos), la Tira de
// «Esta semana» y la barra IR A. Traducido de docs/remake/reales.py (cabecera, historias, momentos, hero, semana, ir_a).
import { useEffect, useMemo, useRef, useState } from 'react';
import { MESES, limpio, mult, norm, num, recorte, resultado, utc } from './liga.js';
import { Cara, Carta, Chevron, Compartir, Ico, Poster, accion, enlace, nombrePais, useCampana } from './piezas.jsx';
import { Miniatura, abrirVideo } from './video.jsx';

export const MENU = [
  ['Inicio', '#/'], ['Eventos', '#/eventos'], ['Ranking', '#/ranking'], ['Publicaciones', '#/publicaciones'],
  ['Tarjetas', '#/tarjetas'], ['Pase', '#/pase'], ['Tienda', '#/tienda'], ['Socios', '#/socios'], ['Guía', '#/guia'],
];
// «Socios» es lo que era «Mundo» (Dlx, 03/10/2026: «1. A»); `#/mundo` sigue abriéndolo (App.jsx)

function Marca({ liga }) {
  return (
    <a className="marca" href="#/">
      <img alt="" src="/ul.png" />
      <span className="lockup"><b>DISCORD RAP</b> <b>EN ESPAÑOL</b><small className="lg">LIGA GLOBAL · {liga.temp}</small></span>
    </a>
  );
}

// ── el buscador: raperos, y también servidores, países y crews (Dlx, 01/10/2026: «sí», la E). Primero lo que es
// exactamente lo buscado, después lo que empieza así y al final lo que lo contiene; a igual coincidencia, raperos
// primero. Vive arriba en la computadora y en el menú ☰ en el celular, donde arriba no entra
const TIPOS = { rapero: 0, servidor: 1, pais: 2, crew: 3 };
const ETIQUETA_TIPO = { rapero: 'rapero', servidor: 'servidor', pais: 'país', crew: 'crew' };
export function Buscar({ liga, onIr }) {
  const [q, setQ] = useState('');
  const res = useMemo(() => {
    const t = norm(q).trim();
    if (!t) return [];
    const nota = (...xs) => Math.min(...xs.map((x) => { const n = norm(x).trim(); return n === t ? 0 : (n.startsWith(t) ? 1 : (n.includes(t) ? 2 : 9)); }));
    const todo = [];
    (liga.d.tabla || []).forEach((f) => todo.push({ tipo: 'rapero', id: 'r' + f.k, n: limpio(f.n), href: '#/r/' + encodeURIComponent(f.k), k: f.k, x: nota(f.n) }));
    Object.values(liga.svs).forEach((s) => todo.push({ tipo: 'servidor', id: 's' + s.sv, n: limpio(s.nombre || s.sv), sub: s.sv, href: '#/sv/' + s.sv, logo: liga.logo(s.sv), x: nota(s.sv, s.nombre || '') }));
    (liga.d.paises || []).filter((p) => p.n).forEach((p) => todo.push({ tipo: 'pais', id: 'p' + p.cc, n: nombrePais(p.cc), href: '#/pais/' + p.cc, cc: p.cc, x: nota(nombrePais(p.cc)) }));
    (liga.d.crews || []).forEach((c) => todo.push({ tipo: 'crew', id: 'c' + (c.clave || c.crew), n: limpio(c.crew), href: '#/crew/' + encodeURIComponent(c.clave || c.crew), crew: c, x: nota(c.crew) }));
    return todo.filter((r) => r.x < 9).sort((a, b) => (a.x - b.x) || (TIPOS[a.tipo] - TIPOS[b.tipo]) || a.n.localeCompare(b.n)).slice(0, 8);
  }, [q, liga]);
  const ir = () => { setQ(''); if (onIr) onIr(); };
  const icono = (r) => {
    if (r.tipo === 'rapero') return <Cara liga={liga} k={r.k} nombre={r.n} cls="cara" />;
    if (r.tipo === 'servidor') return <span className="cara"><img alt="" src={r.logo} /></span>;
    if (r.tipo === 'pais') return <span className="cara"><img alt="" src={'/banderas/g/' + r.cc + '.webp'} /></span>;
    return <CrewCirculo c={r.crew} cls="cara" />;
  };
  return (
    <div className="buscar-w">
      <label className="buscar">
        <Ico n="buscar" t={18} />
        <input type="search" placeholder="Buscar en la Liga" aria-label="Buscar raperos, servidores, países y crews" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) { location.hash = res[0].href; ir(); } if (e.key === 'Escape') setQ(''); }} />
      </label>
      {res.length ? (
        <ul className="busca-res">
          {res.map((r) => <li key={r.id}><a href={r.href} onClick={ir}>{icono(r)}<span>{r.n}</span><small className="br-t">{ETIQUETA_TIPO[r.tipo]}{r.sub && r.sub !== r.n ? ' · ' + r.sub : ''}</small></a></li>)}
        </ul>
      ) : null}
    </div>
  );
}

// la cara de la cuenta de Discord con la que entraste (`lg:dc`), aunque no seas rapero: Dlx, 30/09/2026, «arriba
// debería estar el círculo de mi cuenta conectada con Discord». El `av` es `id/hash`, como el de la tabla.
export function CaraDc({ dc, cls = 'cara' }) {
  const [mal, setMal] = useState(null);
  if (dc && dc.av && mal !== dc.av) {
    return <span className={cls}><img alt="" src={'https://cdn.discordapp.com/avatars/' + dc.av + '.webp?size=128'} onError={() => setMal(dc.av)} /></span>;
  }
  return <span className={cls + ' ini'}>{(limpio(dc && dc.n).slice(0, 1) || '?').toUpperCase()}</span>;
}

export function Cabecera({ liga, dc, onMenu, pagina = '' }) {
  const yo = liga.yo;
  const cara = yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} /> : (dc ? <CaraDc dc={dc} /> : null);
  const nombre = yo ? limpio(yo.n) : (dc ? limpio(dc.n) : '');
  return (
    <header className="cab negra">
      <Marca liga={liga} />
      <nav className="menu" aria-label="Secciones">
        {MENU.map(([n, r]) => <a key={n} href={r} className={(n === 'Inicio' ? !pagina : pagina && r === '#/' + pagina) ? 'on' : ''}>{n}</a>)}
      </nav>
      <div className="cab-der">
        <Buscar liga={liga} />
        <Campanita liga={liga} />
        {/* Ajustes, con su engranaje (Dlx, 01/10/2026: «al costado de la campanita y la cuenta»). Y en el celular, en
            el lugar de tu cuenta, que vuelve abajo como «Yo» (Dlx, 02/10/2026: «el engranaje en vez de la cuenta. En
            el celular. En la PC que esté arriba, por supuesto») */}
        <a className="btn-ico ajustes-b" href="#/ajustes" aria-label="Ajustes"><Ico n="engranaje" t={20} /></a>
        {cara ? (
          <a className="yo-chip" href="#/cuenta" aria-label="Mi cuenta">{cara}<span>{nombre}</span></a>
        ) : (
          <button type="button" className="btn verde chico entrar" onClick={accion.entrar}>Entrar</button>
        )}
        <button className="btn-ico hamb" type="button" aria-label="Menú" onClick={onMenu}><Ico n="menu" t={22} /></button>
      </div>
    </header>
  );
}

// ── 🔔 la campana: el panel de notificaciones ───────────────────────────────────────────────────────
// Dlx, 02/10/2026: «que en esa campanita, aparte de activar tus notificaciones, sea como un panel de notificaciones
// recientes, quizás algo como Instagram», y a «¿también los eventos del día?», «A». Arriba lo de hoy en la Liga (para
// todos); después lo tuyo, «Nuevas» y «Antes» (la bandeja de app.js: `BANDEJA`, `pedirBandeja()`); abajo, la campana
// del teléfono. Para todos desde la 2.02 (Dlx, 03/10/2026: «3. a»); `#/avisos` sigue abriendo la campana de Eventos
function useBandeja() {
  const leer = () => Object.assign({ items: [], nuevas: 0, listo: false }, window.BANDEJA || {});
  const [b, setB] = useState(leer);
  useEffect(() => {
    const f = () => setB(leer());
    const pedir = () => { if (window.pedirBandeja && document.visibilityState === 'visible') window.pedirBandeja(false); };
    window.addEventListener('lg:bandeja', f);
    window.addEventListener('lg:cuenta', pedir);
    pedir();
    // lo nuevo, cada tres minutos con la pestaña a la vista
    const t = setInterval(pedir, 180000);
    return () => { window.removeEventListener('lg:bandeja', f); window.removeEventListener('lg:cuenta', pedir); clearInterval(t); };
  }, []);
  return b;
}
const ICONO_AVISO = { seguidor: '⭐', aplauso: '👏', seguido: '★', personal: '🔔' };
// la dirección de un aviso (`https://underlegends.pages.dev/freestyle-rap/r/x`, `/cuenta/siguiendo`) como ruta `#/…`
const rutaDe = (u) => {
  const p = String(u || '').replace(/^https:\/\/underlegends\.pages\.dev/, '').replace(/^\/freestyle-rap(?=\/|$)/, '').replace(/^#/, '');
  return '#' + (p || '/');
};

function Campanita({ liga }) {
  const B = useBandeja();
  const [abierta, setAbierta] = useState(false);
  const caja = useRef(null);
  useEffect(() => {
    if (!abierta) return undefined;
    // afuera del panel lo cierra (adentro del shadow root el evento llega con su camino entero)
    const fuera = (e) => { if (caja.current && !e.composedPath().includes(caja.current)) setAbierta(false); };
    const esc = (e) => { if (e.key === 'Escape') setAbierta(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierta]);
  const abrir = () => {
    const v = !abierta;
    setAbierta(v);
    // al abrirlo, lo nuevo queda visto (el panel todavía muestra cuáles eran)
    if (v && window.pedirBandeja) window.pedirBandeja(true);
  };
  return (
    <div className="nt" ref={caja}>
      <button type="button" className={'btn-ico nt-b' + (abierta ? ' on' : '')} aria-expanded={abierta}
        aria-label={'Notificaciones' + (B.nuevas ? ', ' + B.nuevas + (B.nuevas === 1 ? ' nueva' : ' nuevas') : '')} onClick={abrir}>
        <Ico n="campana" t={20} />{B.nuevas ? <span className="nt-n">{B.nuevas > 9 ? '9+' : B.nuevas}</span> : null}
      </button>
      {abierta ? <PanelAvisos liga={liga} B={B} onCerrar={() => setAbierta(false)} /> : null}
    </div>
  );
}

function PanelAvisos({ liga, B, onCerrar }) {
  const e = useCampana();
  const C = window.Campana;
  const hoy = liga.diaClave(liga.ahora);
  // 📅 lo de hoy en la Liga, para todos: lo que se está jugando y lo que viene hoy
  const vivos = liga.vivo();
  const hoyEv = vivos.concat(liga.luego().filter((x) => liga.diaClave(x.cuando) === hoy && !vivos.includes(x))).slice(0, 4);
  const items = B.items || [];
  const nuevas = items.filter((x) => !x.visto);
  const antes = items.filter((x) => x.visto);
  const ir = (ruta) => { onCerrar(); location.hash = ruta; };
  const fila = (x) => {
    const f = x.cara ? liga.T[x.cara] : null;
    // el emoji del principio del aviso va en el círculo cuando no hay cara: no se repite al lado
    const emoji = /^(\p{Extended_Pictographic}️?)\s*/u.exec(String(x.titulo || ''));
    const tit = !f && emoji ? x.titulo.slice(emoji[0].length) : x.titulo;
    return (
      <li key={x.clave}>
        <button type="button" className={'nt-i' + (x.visto ? '' : ' nueva')} onClick={() => ir(rutaDe(x.url))}>
          {f ? <Cara liga={liga} k={f.k} nombre={f.n} cls="nt-c" />
            : <span className="nt-c nt-ico" aria-hidden="true">{emoji ? emoji[1] : ICONO_AVISO[x.tipo] || '🔔'}</span>}
          <span className="nt-t"><b>{tit}</b>{x.cuerpo ? <small>{x.cuerpo}</small> : null}</span>
          <em>{liga.cuando(new Date(x.t))}</em>
        </button>
      </li>
    );
  };
  // la campana del teléfono, al pie: lo que falta para que también llegue ahí
  let pie = null;
  if (e && C) {
    if (e.activa && e.yo && e.yo.id) pie = <p className="nt-ok">✅ También te llega al teléfono. <a href="#/avisos" onClick={onCerrar}>Ajustes de avisos</a></p>;
    else if (!e.soporta || e.negado) pie = <a className="pub-a" href="#/avisos" onClick={onCerrar}>Cómo hacer que te llegue al teléfono</a>;
    else if (!e.activa) pie = <><p className="nt-tx">Que también te llegue al teléfono, al momento:</p><button type="button" className="btn verde chico" onClick={() => C.activar()}><Ico n="campana" t={16} />Activar avisos</button></>;
    else pie = <><p className="nt-tx">Este teléfono recibe los eventos. Para que te lleguen también los tuyos:</p><button type="button" className="btn borde2 chico" onClick={() => C.vincular()}>Vincular con mi Discord</button></>;
  }
  return (
    <div className="nt-p" role="dialog" aria-label="Notificaciones">
      <div className="nt-h"><b>Notificaciones</b><button type="button" className="nt-x" aria-label="Cerrar" onClick={onCerrar}><Ico n="cerrar" t={20} /></button></div>
      {hoyEv.length ? (
        <>
          <p className="nt-s">Hoy en la Liga</p>
          <ul>{hoyEv.map((x, i) => (
            <li key={'ev' + i}><button type="button" className="nt-i" onClick={() => ir('#/eventos')}>
              <img className="nt-c" alt="" src={liga.logo(x.sv)} />
              <span className="nt-t"><b>{limpio(x.nombre)}</b><small>{vivos.includes(x) ? 'se está jugando ahora' : liga.dia(x.cuando).replace(/^hoy /, 'hoy a las ')} · {x.sv}</small></span>
              <em>{vivos.includes(x) ? 'EN VIVO' : ''}</em>
            </button></li>
          ))}</ul>
        </>
      ) : null}
      {B.sinCuenta ? (
        <div className="nt-vacio">
          <p className="nt-tx">Entrá con Discord y acá te llega lo tuyo: quién te sigue, quién te felicita, tus rangos y tus cartas, y cuando gana alguien que seguís.</p>
          <button type="button" className="btn verde chico" onClick={() => { onCerrar(); accion.entrar(); }}>Entrar con Discord</button>
        </div>
      ) : !B.listo ? <p className="nt-tx nt-vacio">Cargando…</p> : items.length ? (
        <>
          {nuevas.length ? <><p className="nt-s">Nuevas</p><ul>{nuevas.map(fila)}</ul></> : null}
          {antes.length ? <><p className="nt-s">Antes</p><ul>{antes.map(fila)}</ul></> : null}
        </>
      ) : <p className="nt-tx nt-vacio">Todavía no te llegó nada. Cuando alguien te siga, te felicite o subas de rango, aparece acá.</p>}
      {pie ? <div className="nt-pie">{pie}</div> : null}
    </div>
  );
}

// ── las historias: lo que se abre al tocar cada círculo de arriba ─────────────────────────────────────
// un título de video de 70 letras ocupaba seis renglones del escenario: pasado de 42, un cuerpo menos
const largo = (t) => 'hero-ev largo' + (String(t || '').length > 42 ? ' muy-largo' : '');
// «RAP EXHIBITION 2 8» (el «/» se pierde en el dato) partía el 8 solo en el tercer renglón: los números van juntos
const juntos = (t) => String(t || '').replace(/(\d) (\d)/g, '$1' + String.fromCharCode(160) + '$2');
// 🔴 EL TÍTULO DEL ESCENARIO NO PARTE PALABRAS (Dlx, 02/10/2026, con una captura: «GENERACION / ES UN DESTINO»).
// `.mo-txt h1` tiene `overflow-wrap:anywhere`, así que una palabra más ancha que la columna se partía donde caía. Ahora
// el tamaño lo manda la palabra más larga: `--pal` son sus letras, y `.ev-pal` (vivo.css) achica la letra hasta que
// entra. Partir queda sólo para una palabra imposible, por debajo de los 20 px
const texto = (x) => (typeof x === 'string' || typeof x === 'number' ? String(x)
  : Array.isArray(x) ? x.map(texto).join('') : (x && x.props ? texto(x.props.children) : ''));
function Tit({ c, children }) {
  const pal = Math.max(1, ...texto(children).split(/\s+/).map((w) => [...w].length));
  return <h1 className={c}><span className="ev-pal" style={{ '--pal': pal }}>{children}</span></h1>;
}
// `id`: lo que se marca como visto, historia por historia (ver `Visor`); `t`: la hora de lo que cuenta, para el orden
function Slide(tag, cuerpo, cuando, cta, ir, id, t) { return { tag, cuerpo, cuando, cta, ir, id, t: t || '' }; }

function slidesDe(liga, items) {
  const grupos = [];
  items.forEach((it) => {
    const g = grupos[grupos.length - 1];
    if (g && it.tipo === 'tarjeta' && g[0].tipo === 'tarjeta' && g[0].t === it.t) g.push(it);
    else grupos.push([it]);
  });
  const out = [];
  grupos.forEach((g) => {
    const it = g[0];
    // cada historia lleva la hora de lo que cuenta: el visor abre en la primera que no viste (ver `Visor`)
    const n0 = out.length;
    const q = (it.quien || []).map(limpio);
    const ks = it.ks || [];
    const c = liga.cuando(it.t);
    if (it.tipo === 'tarjeta' && g.length > 1) {
      const quienes = [];
      g.forEach((o) => { const x = limpio((o.quien || [])[0]); if (x && !quienes.includes(x)) quienes.push(x); });
      const txt = quienes.length > 1 ? quienes.slice(0, -1).join(', ') + ' y ' + quienes[quienes.length - 1] : quienes[0];
      out.push(Slide('CARTAS NUEVAS', <><div className="st-minis">{g.slice(0, 4).map((o, i) => <Carta key={i} liga={liga} k={(o.ks || [])[0]} cual={o.carta} cls="st-mini-c" abre={false} />)}</div>
        <h3 className="st-h">{txt} ya tienen sus cartas</h3></>, c, 'Ver sus perfiles', { perfil: ks[0] }));
    } else if (it.tipo === 'tarjeta') {
      const nombre = { pais: 'de País', temporada: 'de Temporada', servidor: 'de Servidor', competitivo: 'Competitiva' }[it.carta];
      out.push(Slide('CARTA NUEVA', <><Carta liga={liga} k={ks[0]} cual={it.carta} cls="st-carta" abre={false} /><h3 className="st-h">{q[0]} ya tiene su carta {nombre}</h3></>,
        c, 'Ver su carta', { carta: ks[0] }));
    } else if (it.tipo === 'rango') {
      const f = ks.length ? liga.T[ks[0]] : null;
      const vis = f && (f.c || []).includes('competitivo') ? <Carta liga={liga} k={ks[0]} cual="competitivo" cls="st-carta" abre={false} />
        : <span className="st-rg" style={{ background: liga.colorRg(it.rg) }}>{it.rg}</span>;
      out.push(Slide('RANGO', <>{vis}<h3 className="st-h">{it.primero ? q[0] + ' consigue su primera letra: ' + it.rg : q[0] + ' pasa a rango ' + it.rg}</h3></>,
        c, 'Ver su perfil', { perfil: ks[0] }));
    } else if (it.tipo === 'campeon') {
      const ll = (liga.d.llaves || {})[String(it.ll)] || {};
      const k = ks[0] || '';
      const f = liga.T[k];
      const vis = f && (f.c || []).includes('temporada') ? <Carta liga={liga} k={k} cual="temporada" cls="st-carta" abre={false} /> : <Cara liga={liga} k={k} nombre={q[0]} cls="st-cara" />;
      out.push(Slide('CAMPEÓN · ' + it.sv, <><h3 className="st-h">{limpio(it.ev)}</h3>{vis}<b className="st-nom">{q.join(' y ')}</b>
        <small className="st-s">{it.part || 0} raperos</small>
        <ol className="st-podio">{(ll.tabla || []).slice(0, 3).map((z, i) => <li key={i}><b>{i + 1}</b>{limpio(z[0])}</li>)}</ol></>, c, 'Ver la llave', { llave: it.ll }));
    } else if (it.tipo === 'caza') {
      const a = liga.fila(it.a);
      out.push(Slide('SE BUSCA · CAZADO', <><div className="st-caza"><Cara liga={liga} k={a ? a.k : ''} nombre={it.a} cls="st-cara" /><span className="sello">CAZADO</span></div>
        <h3 className="st-h">{q[0]} cazó a {it.a}</h3><small className="st-s">{it.cat} · cobra {num(it.pts)}</small></>, c, 'Ver Se busca', { ancla: 'sebusca' }));
    } else if (it.tipo === 'anuncio') {
      const e = (liga.d.proximos || []).find((x) => limpio(x.nombre) === limpio(it.ev));
      let cu = '';
      if (e) {
        cu = liga.vivo().includes(e) ? 'en vivo desde las ' + liga.dia(e.cuando).replace(/^hoy /, '') : liga.dia(e.cuando);
        if (e.modalidad) cu += ' · ' + e.modalidad;
      }
      out.push(Slide('ANUNCIÓ · ' + it.sv, <><img className="st-logo" alt="" src={liga.logo(it.sv)} /><h3 className="st-h">{limpio(it.ev)}</h3>
        {liga.esDorado(it.ev, it.sv) ? <span className="st-dor">EVENTO DORADO ×3</span> : null}<small className="st-s">{cu || c}</small></>,
        c, 'Quiero aviso', { ruta: '#/avisos' }));
    }
    // la identidad de la historia es la de su publicación (`id` del muro, ver bot/muro.py); las cartas juntas, la de todas
    const id = 'm:' + g.map((o) => o.id || o.tipo + (o.t || '') + (o.quien || []).join(',')).join('+');
    for (let i = n0; i < out.length; i++) { out[i].t = String(it.t || ''); out[i].id = id; }
  });
  return out;
}

// lo más nuevo primero (Dlx, 02/10/2026: «no me muestra lo más reciente PRIMERO»); lo que no tiene hora, al final
const masNuevo = (a, b) => String(b.t || '').localeCompare(String(a.t || ''));

// las caras de una lista de filas de la tabla, con lo que dice debajo de cada una
const Gente = ({ liga, fs, txt }) => (
  <ul className="st-gente">{fs.map((f) => <li key={f.k}><Cara liga={liga} k={f.k} nombre={f.n} cls="st-mini" /><span>{txt(f)}</span></li>)}</ul>
);

/** Las historias del círculo «La Liga», en este orden. Ver `gruposHistorias`. */
function historiasLiga(liga, mm) {
  const out = [];
  const T = liga.d.tabla || [];
  const hoy = liga.diaClave(liga.ahora);
  const semana = String(mm.ini || '');
  // 📅 lo que se juega hoy y todavía no empezó
  const hoyEv = liga.luego().filter((e) => liga.diaClave(e.cuando) === hoy);
  if (hoyEv.length) {
    out.push(Slide('HOY SE JUEGA', <><h3 className="st-h">{hoyEv.length === 1 ? 'Un evento hoy' : hoyEv.length + ' eventos hoy'}</h3>
      <ul className="st-l">{hoyEv.slice(0, 5).map((e, i) => <li key={i}><b>{liga.dia(e.cuando).replace(/^hoy /, '')} · {e.sv}</b>{limpio(e.nombre)}</li>)}</ul></>,
    'hoy', 'Ver Eventos', { ruta: '#/eventos' }, 'hoy:' + hoy + ':' + hoyEv.length));
  }
  // 🎯 los buscados del Most Wanted que siguen sueltos
  const mw = liga.d.mw || {};
  const sueltos = (mw.b || []).filter((b) => b.e === 'suelto');
  if (sueltos.length) {
    out.push(Slide('SE BUSCA · MOST WANTED', <><h3 className="st-h">{sueltos.length === 1 ? 'Un buscado suelto' : sueltos.length + ' buscados sueltos'}</h3>
      <ul className="st-gente">{sueltos.slice(0, 6).map((b) => <li key={b.k || b.n}><Cara liga={liga} k={b.k || ''} nombre={b.n} cls="st-mini" /><span>{limpio(b.n)} · {num(b.v)}</span></li>)}</ul>
      <small className="st-s">Ganale a uno en un evento y cobrás su precio.</small></>,
    'hasta ' + liga.dia(mw.fin), 'Ver Se busca', { ancla: 'sebusca' }, 'mw:' + mw.id + ':' + sueltos.length));
  }
  // ▲ los que más subieron en el Ranking desde el lunes
  const suben = T.filter((f) => (f.mv || 0) > 0).sort((a, b) => b.mv - a.mv).slice(0, 3);
  if (suben.length) {
    out.push(Slide('ESTA SEMANA · SUBIERON', <><h3 className="st-h">{limpio(suben[0].n)} subió {suben[0].mv} {suben[0].mv === 1 ? 'puesto' : 'puestos'}</h3>
      <Gente liga={liga} fs={suben} txt={(f) => '▲' + f.mv + ' · #' + f.pos} /><small className="st-s">desde el lunes, en el Ranking de la Temporada</small></>,
    'esta semana', 'Ver el Ranking', { ruta: '#/ranking' }, 'subio:' + hoy + ':' + suben[0].k));
  }
  // 🆕 los que jugaron su primer evento esta semana
  const nuevos = T.filter((f) => f.nu);
  if (nuevos.length) {
    out.push(Slide('ESTA SEMANA · DEBUTARON', <><h3 className="st-h">{nuevos.length === 1 ? 'Un debut' : nuevos.length + ' debutaron'}</h3>
      <Gente liga={liga} fs={nuevos.slice(0, 8)} txt={(f) => limpio(f.n)} />
      <small className="st-s">jugaron su primer evento en la Liga{nuevos.length > 8 ? ' · y ' + (nuevos.length - 8) + ' más' : ''}</small></>,
    'esta semana', 'Ver el Ranking', { ruta: '#/ranking' }, 'debut:' + semana + ':' + nuevos.length));
  }
  // 🔥 la racha más larga de las que siguen vivas
  const r = (liga.d.rachas || []).filter((x) => x.r >= 2)[0];
  if (r) {
    out.push(Slide('🔥 EN RACHA', <><Cara liga={liga} k={r.k} nombre={r.n} cls="st-cara" /><h3 className="st-h">{limpio(r.n)} lleva {r.r} seguidos</h3>
      <small className="st-s">eventos seguidos llegando arriba de la llave</small></>,
    'ahora', 'Ver las rachas', { ruta: '#/ranking/rachas' }, 'racha:' + r.k + ':' + r.r));
  }
  // ⚔️ el cruce que más se repitió en la temporada
  let cl = null;
  Object.entries(liga.d.rivales || {}).forEach(([par, c]) => {
    const [a, b] = par.split('|');
    const n = (c[a] || 0) + (c[b] || 0);
    if (n >= 2 && (!cl || n > cl.n || (n === cl.n && Math.abs(c[a] - c[b]) < Math.abs(cl.ga - cl.gb)))) cl = { a, b, ga: c[a] || 0, gb: c[b] || 0, n };
  });
  const fa = cl ? liga.T[cl.a] : null;
  const fb = cl ? liga.T[cl.b] : null;
  if (fa && fb) {
    out.push(Slide('EL CLÁSICO', <><ul className="st-gente st-vs"><li><Cara liga={liga} k={fa.k} nombre={fa.n} cls="st-cara" /><span>{limpio(fa.n)}</span></li>
      <li className="st-vs-n">{cl.ga}–{cl.gb}</li><li><Cara liga={liga} k={fb.k} nombre={fb.n} cls="st-cara" /><span>{limpio(fb.n)}</span></li></ul>
      <small className="st-s">se cruzaron {cl.n} veces en la temporada</small></>,
    'esta temporada', 'Ver a ' + limpio(fa.n), { perfil: fa.k }, 'clasico:' + cl.a + '|' + cl.b + ':' + cl.n));
  }
  // 🥇 los premios de la semana que cerró (del muro)
  const pr = (liga.muro || []).find((it) => it.tipo === 'premios' && liga.ahora - utc(it.t) < 7 * 86400000);
  if (pr) {
    const fila = (rol, et) => (pr[rol] ? <li key={rol}><b>{et}</b>{limpio(String(pr[rol][0]))}{rol !== 'servidor' && pr[rol][1] ? ' · ' + num(pr[rol][1]) : ''}</li> : null);
    out.push(Slide('PREMIOS DE LA SEMANA', <><h3 className="st-h">Los premios de la semana</h3>
      <ul className="st-l">{fila('figura', 'FIGURA')}{fila('revelacion', 'REVELACIÓN')}{fila('cazador', 'CAZADOR')}{fila('servidor', 'SERVIDOR')}</ul></>,
    liga.cuando(pr.t), 'Ver Publicaciones', { ruta: '#/publicaciones' }, 'm:' + (pr.id || 'premios' + pr.t)));
  }
  return out;
}

function claveCrew(n) {
  return limpio(n).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function CrewCirculo({ c, cls = 'h-c' }) {
  if (c.logo) return <span className={cls}><img alt="" src={'/' + c.logo} /></span>;
  const p = limpio(c.crew).split(' ');
  const mono = p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2);
  return <span className={cls + ' mono'}>{mono.toUpperCase()}</span>;
}

const firma = (items, resto = '') => items.reduce((m, it) => (String(it.t) > m ? String(it.t) : m), '') || resto;

export function gruposHistorias(liga) {
  const muro = liga.muroLimpio().filter((it) => ['campeon', 'anuncio', 'caza', 'tarjeta', 'rango'].includes(it.tipo));
  const grupos = [];
  liga.vivo().forEach((e) => {
    const m = liga.multSv(e.sv);
    grupos.push({
      id: 'vivo-' + e.sv + '-' + limpio(e.nombre).toLowerCase(), tipo: 'vivo', nombre: 'En vivo · ' + e.sv, logo: liga.logo(e.sv), nom: limpio(e.nombre), firma: 'vivo:' + e.nombre + e.cuando,
      slides: [Slide('EN VIVO AHORA · ' + e.sv, <><img className="st-logo grande" alt="" src={liga.logo(e.sv, true)} /><h3 className="st-h grande">{limpio(e.nombre)}</h3>
        <small className="st-s">Empezó a las {liga.dia(e.cuando).replace(/^hoy /, '')}{m ? ' · ' + mult(m) + ' esta semana' : ''}. La llave aparece acá apenas la carguen.</small></>,
      'ahora', 'Mirar en Discord', { link: e.link }, 'vivo:' + e.sv + ':' + limpio(e.nombre) + ':' + e.cuando)],
    });
  });
  const mm = liga.d.mult || {};
  // 🔑 «LA LIGA»: lo de toda la Liga en un círculo propio, el primero después de lo en vivo. Dlx, 02/10/2026, a «más
  // variedad en las historias»: «sí» (y a los rumores del chat general, «C»: nada). Todo sale de lo que el payload ya
  // trae; cada historia se ve una vez (por día, por semana o hasta que cambie lo que cuenta) y sin dato no hay historia
  const ligaS = historiasLiga(liga, mm);
  if (ligaS.length) {
    grupos.push({ id: 'liga', tipo: 'liga', nombre: 'La Liga', nom: 'La Liga', nuevo: true, firma: 'liga', slides: ligaS });
  }
  Object.values(liga.svs).sort((a, b) => b.n - a.n).forEach((s) => {
    const sv = s.sv;
    const slides = [];
    const m = (mm.sv || {})[sv];
    const lineas = [];
    const g = liga.doradoVigente();
    if (g && g.sv === sv) lineas.push(<li key="d"><b>DORADO ×3</b>{limpio(g.n)}, {utc(g.t) <= liga.ahora ? 'se juega ahora' : liga.dia(g.t)}</li>);
    const par = ((mm.guerra || {}).pares || []).find((p) => p.includes(sv));
    if (par) lineas.push(<li key="g"><b>GUERRA</b>contra {par[0] === sv ? par[1] : par[0]}: gana el que más puntos hace por persona</li>);
    const meta = (mm.metas || {})[sv];
    if (meta) {
      const va = (mm.meta_va || {})[sv] || 0;
      lineas.push(<li key="m"><b>META</b>{va} de {meta} personas{va >= meta ? ' · cumplida' : ''}</li>);
    }
    if (m || lineas.length) {
      // la de la semana es una historia más: se ve una vez por semana, con la hora del lunes en que empezó
      slides.push(Slide('ESTA SEMANA · ' + sv, <><img className="st-logo" alt="" src={liga.logo(sv)} />
        {m ? <b className={'st-mult ' + (m > 1 ? 'sube' : 'baja')}>{mult(m)}</b> : null}<ul className="st-l">{lineas}</ul></>, 'lunes', 'Lunes de la Liga', { ancla: 'semana' },
      'sem:' + sv + ':' + (mm.ini || ''), String(mm.ini || '')));
    }
    const propios = muro.filter((it) => liga.svDe(it) === sv);
    // 🔴 LO MÁS NUEVO PRIMERO, y lo visto se saltea historia por historia (ver `Visor`). Dlx, 02/10/2026: «aún sigo
    // viendo las historias que ya he visto… no skipea las que ya vi y no me muestra lo más reciente PRIMERO»
    slidesDe(liga, propios).slice(0, 6).forEach((x) => slides.push(x));
    if (!propios.length) {
      slides.push(Slide(String(s.nombre || sv).toUpperCase(), <><img className="st-logo grande" alt="" src={liga.logo(sv, true)} /><h3 className="st-h">Todavía sin eventos en la {liga.temp}</h3>
        <small className="st-s">{String(s.tag || '').charAt(0) + String(s.tag || '').slice(1).toLowerCase()}</small></>, '', s.invita ? 'Entrar al servidor' : '', { link: s.invita },
      'vacio:' + sv));
    }
    slides.sort(masNuevo);
    grupos.push({ id: 'sv-' + sv.toLowerCase(), tipo: 'sv', nombre: s.nombre, logo: liga.logo(sv), nom: sv, nuevo: propios.length > 0, firma: firma(propios, 'sem:' + (mm.ini || '')), slides });
  });
  // ── después, lo tuyo: tu país, tu crew y la gente que seguís. Dlx, 30/09/2026: «no hay necesidad de seguir a
  // todos… que ahí arriba aparezca simplemente tu país, tu crew si estás en una y las personas que tú sigues». Antes
  // iban las seis crews más grandes y cualquiera con una carta nueva, muchos sin foto.
  const yo = liga.yo;
  const pa = yo ? liga.paisDe(yo.cc) : null;
  if (pa) {
    const ks = new Set(pa.gente.map((f) => f.k));
    ks.delete(yo.k);
    const propios = muro.filter((it) => (it.ks || []).some((k) => ks.has(k)));
    const nom = nombrePais(pa.cc);
    const top = pa.gente.slice(0, 6);
    const slides = [Slide('TU PAÍS', <><span className="st-bandera"><img alt="" src={'/banderas/g/' + pa.cc + '.webp'} /></span><h3 className="st-h">{nom}</h3>
      <small className="st-s">{pa.pos ? '#' + pa.pos + ' de la Liga · ' : ''}{pa.n} {pa.n === 1 ? 'rapero' : 'raperos'}{pa.pts ? ' · ' + num(pa.pts) + ' pts' : ''}</small>
      {top.length ? <ul className="st-gente">{top.map((f) => <li key={f.k}><Cara liga={liga} k={f.k} nombre={f.n} cls="st-mini" /><span>#{f.pos} {limpio(f.n)}</span></li>)}</ul> : null}</>,
    'esta temporada', 'Ver ' + nom, { ruta: '#/pais/' + pa.cc }, 'pais:' + pa.cc + ':' + (mm.ini || ''), String(mm.ini || ''))];
    slidesDe(liga, propios).slice(0, 3).forEach((x) => slides.push(x));
    slides.sort(masNuevo);
    grupos.push({ id: 'pais-' + pa.cc, tipo: 'pais', nombre: nom, cc: pa.cc, nom, nuevo: propios.length > 0, firma: firma(propios, 'pais'), slides });
  }
  const c = yo ? liga.crewDe(yo) : null;
  if (c) {
    const ks = new Set(c.gente.map((n) => liga.fila(n)).filter(Boolean).map((f) => f.k));
    ks.delete(yo.k);
    const slides = [Slide('TU CREW', <><CrewCirculo c={c} cls="st-crew" /><h3 className="st-h">{limpio(c.crew).toUpperCase()}</h3>
      <small className="st-s">{c.n} {c.n !== 1 ? 'raperos' : 'rapero'} · {num(c.pts)} pts · el mejor: {limpio(c.mejor)}</small>
      <ul className="st-gente">{c.gente.slice(0, 8).map((n, i) => { const f = liga.fila(n); return <li key={i}><Cara liga={liga} k={f ? f.k : ''} nombre={n} cls="st-mini" /><span>{limpio(n)}</span></li>; })}</ul></>,
    'esta temporada', 'Ver la crew', { ruta: '#/crew/' + encodeURIComponent(c.clave || c.crew) }, 'crew:' + claveCrew(c.crew) + ':' + (mm.ini || ''),
    String(mm.ini || ''))];
    const propios = muro.filter((it) => (it.ks || []).some((k) => ks.has(k)));
    slidesDe(liga, propios).slice(0, 3).forEach((x) => slides.push(x));
    slides.sort(masNuevo);
    grupos.push({ id: 'crew-' + claveCrew(c.crew), tipo: 'crew', nombre: limpio(c.crew), crew: c, nom: limpio(c.crew), nuevo: propios.length > 0, firma: firma(propios, 'crew'), slides });
  }
  const ETIQUETA = { tarjeta: 'carta nueva', campeon: 'campeón', caza: 'cazó' };
  const sig = liga.sigue.map((k) => {
    const f = liga.T[k];
    const propios = muro.filter((it) => (it.ks || []).includes(k));
    let slides = slidesDe(liga, propios).slice(0, 4);
    // alguien que seguís y no hizo nada nuevo igual tiene su círculo: su carta y cómo va (una vez por semana)
    if (!slides.length) {
      slides = [Slide('SEGUÍS A', <><Carta liga={liga} k={k} cual="temporada" cls="st-carta" abre={false} /><h3 className="st-h">{limpio(f.n)}</h3>
        <small className="st-s">{f.pos ? '#' + f.pos + ' · ' : ''}OVR {f.ovr || '—'} · {num(f.pts)} pts · {f.ev || 0} {f.ev === 1 ? 'evento' : 'eventos'}</small></>,
      'esta temporada', 'Ver su perfil', { perfil: k }, 'seg:' + k + ':' + (mm.ini || ''), String(mm.ini || ''))];
    }
    const u = propios[0];
    const et = u ? (u.tipo === 'rango' ? 'rango ' + (u.rg || '') : ETIQUETA[u.tipo] || '') : (f.pos ? '#' + f.pos : '');
    return { id: 'p-' + k, tipo: 'gente', nombre: limpio(f.n), k, cc: f.cc, nom: limpio(f.n), et, nuevo: !!u, t: u ? String(u.t) : '', pos: f.pos || 1e9, firma: firma(propios, 'perfil'), slides };
  });
  // primero los que tienen algo nuevo, lo más reciente adelante; después por el ranking
  sig.sort((a, b) => (Number(b.nuevo) - Number(a.nuevo)) || b.t.localeCompare(a.t) || (a.pos - b.pos));
  sig.slice(0, 15).forEach((g) => grupos.push(g));
  return grupos.filter((g) => g.slides.length);
}

// la cara de alguien en un círculo: su foto o, si no tiene, la inicial sobre su bandera (una inicial sobre negro,
// fila tras fila, era lo que se veía «sin avatar»)
export function CaraH({ liga, k, nombre, cc, cls = 'h-c' }) {
  const [mal, setMal] = useState(null);
  // la de la tabla; si no está (corta en 200), la que viene aparte por nombre (`avNombre()`)
  const src = (k && liga.avUrl(k)) || (liga.avNombre ? liga.avNombre(nombre) : null);
  if (src && mal !== src) return <span className={cls}><img alt="" src={src} onError={() => setMal(src)} /></span>;
  const ini = (limpio(nombre).slice(0, 1) || '?').toUpperCase();
  return (
    <span className={cls + ' ini' + (cc ? ' con-bandera' : '')} style={cc ? { backgroundImage: 'url(/banderas/g/' + cc + '.webp)' } : undefined}>
      <b>{ini}</b>
    </span>
  );
}

export function Historias({ liga, grupos, vistos, onAbrir }) {
  const partes = [];
  let antes = null;
  grupos.forEach((g, i) => {
    if (antes && g.tipo !== antes) partes.push(<span key={'s' + i} className="h-sep" aria-hidden="true" />);
    antes = g.tipo;
    // gris cuando ya viste TODAS sus historias (se cuenta historia por historia: ver `Visor`)
    const visto = g.slides.every((s) => vistos[s.id]) ? ' visto' : '';
    const abrir = () => onAbrir(i);
    if (g.tipo === 'vivo') {
      partes.push(<button type="button" key={g.id} className={'h en-vivo' + visto} onClick={abrir}><span className="h-w"><span className="h-c"><img alt="" src={g.logo} /></span>
        <span className="h-badge">EN VIVO</span></span><small>{g.nom}</small></button>);
    } else if (g.tipo === 'liga') {
      partes.push(<button type="button" key={g.id} className={'h liga nuevo' + visto} onClick={abrir}><span className="h-c"><img alt="" src="/ul.png" /></span><small>La Liga</small></button>);
    } else if (g.tipo === 'sv') {
      partes.push(<button type="button" key={g.id} className={'h sv' + (g.nuevo ? ' nuevo' : '') + visto} onClick={abrir}><span className="h-c"><img alt="" src={g.logo} /></span><small>{g.nom}</small></button>);
    } else if (g.tipo === 'pais') {
      partes.push(<button type="button" key={g.id} className={'h pais' + (g.nuevo ? ' nuevo' : '') + visto} onClick={abrir}>
        <span className="h-c bandera"><img alt="" src={'/banderas/g/' + g.cc + '.webp'} /></span><small>{g.nom}</small><em>tu país</em></button>);
    } else if (g.tipo === 'crew') {
      partes.push(<button type="button" key={g.id} className={'h crew' + (g.nuevo ? ' nuevo' : '') + visto} onClick={abrir}><CrewCirculo c={g.crew} /><small>{g.nom}</small><em>tu crew</em></button>);
    } else {
      partes.push(<button type="button" key={g.id} className={'h gente' + (g.nuevo ? ' nuevo' : '') + visto} onClick={abrir}>
        <CaraH liga={liga} k={g.k} nombre={g.nom} cc={g.cc} /><small>{g.nom}</small><em>{g.et}</em></button>);
    }
  });
  // sin nadie a quien seguir, el lugar de esa gente invita a empezar: se sigue desde el perfil de cada uno
  if (!liga.sigue.length && (liga.d.tabla || []).length) {
    if (partes.length) partes.push(<span key="s-sumar" className="h-sep" aria-hidden="true" />);
    partes.push(<a key="sumar" className="h sumar" href="#/ranking"><span className="h-c mas" aria-hidden="true">+</span><small>Seguí a alguien</small><em>desde su perfil</em></a>);
  }
  if (!partes.length) return null;
  return <nav className="historias" aria-label="Historias: en vivo, servidores, tu país, tu crew y a quién seguís">{partes}</nav>;
}

// ── el cuadro de cruces: cuartos, semis, final y el campeón, con líneas ─────────────────────────────
// 🔴 TODOS LOS LADOS, NO DOS. Dlx, 01/10/2026, «check the llaves», con la del Desgracias en Tokyo: los Octavos eran
// TRIANGULARES (CRK vs O.E.P vs ELSOLAR) y esto se quedaba con los dos primeros, así que ELSOLAR y ZIGNOS —que
// ganaron y pasaron a Cuartos— no aparecían, y esos cruces quedaban sin ganador. «Ver la llave» ya los dibujaba
const lados = (b) => (b[0] || []).map((z) => limpio(typeof z === 'string' ? z : z.join(' & ')));
const ganador = (b) => limpio(typeof b[1] === 'string' ? b[1] : (b[1] || []).join(' & '));

// 🔑 `previa`: la llave en vivo que todavía sólo tiene la fase previa —el CYPHER de POESÍA CRUDA (URBF, 01/10/2026),
// grupos de tres y los cuartos vacíos—. Sin esto no se veía nada: los filtros no van en el cuadro.
const PREVIAS = ['Filtros', 'Clasificatorias', 'Preliminares'];
function CuadroRondas({ ll, previa }) {
  const rondas = (ll.rondas || []).filter((r) => r.r !== 'Tercer puesto' && (previa || r.r !== 'Filtros'));
  return (
    <>
      <div className="llave-cab"><span>CUADRO</span><span className="apag">POR RONDAS</span></div>
      <div className="llave-wrap"><div className="llave" style={{ gridTemplateColumns: 'repeat(' + rondas.length + ',150px)' }}>
        {rondas.map((r, ri) => (
          <div className="ronda" key={ri}><h4>{r.r}</h4>
            {/* sin ganador todavía nadie va apagado: tachado se lee como que perdió */}
            {/* un cruce de un solo lado espera a su rival (`⌞Geoka⌝ 🆚 ⌞⌝`): «por definir» en su lugar */}
            {(r.b || []).map((b, bi) => { const g = ganador(b); const ls = lados(b); return <div className={'m' + (g ? ' hecho' : '')} key={bi}>{ls.map((x, xi) => <span key={xi} className={g ? (x === g ? 'g' : 'x') : undefined}>{x}</span>)}{ls.length === 1 && !g ? <span className="m-espera">por definir</span> : null}</div>; })}
          </div>
        ))}
      </div></div>
    </>
  );
}

// ── el cuadro chico del escenario. Dlx, 30/09/2026: «estas llaves hay que hacerlas más bonitas». Va con la cara de
// cada uno, el ganador de cada cruce en blanco, el camino del campeón en verde y el perdedor apagado (sin tachar:
// tachado se leía como un error). En el celular y en pantallas medianas, semis y final: con los cuartos, el campeón
// quedaba afuera de la pantalla. La llave entera está a un botón.
const MEDIDAS = {
  movil: { rondas: 2, W: 104, G: 12, CAMP: 88 },
  medio: { rondas: 2, W: 116, G: 16, CAMP: 96 },
  pc: { rondas: 3, W: 106, G: 14, CAMP: 96 },
  // en una pantalla ancha, cuatro rondas: con Octavos entra la llave entera de 16 (Dlx, 01/10: «mostrar todas las
  // llaves»). Desde 1280: debajo, cuatro rondas no entran al lado del texto
  ancho: { rondas: 4, W: 116, G: 14, CAMP: 96 },
};
function useMedida() {
  const q = (m) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(m).matches : false);
  const leer = () => (q('(max-width: 599.98px)') ? 'movil' : (q('(max-width: 1099.98px)') ? 'medio'
    : (q('(max-width: 1279.98px)') ? 'pc' : 'ancho')));
  const [m, setM] = useState(leer);
  useEffect(() => {
    const f = () => setM(leer());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return MEDIDAS[m];
}

// ── la llave completa: las rondas que faltan y los cruces que todavía no se jugaron, vacíos ──────────────────────
// Dlx, 01/10/2026, con la llave en vivo de «Desgracias en Tokyo»: «para mostrar todas las llaves». Con los Cuartos a
// medio jugar (2 de 4) la llave no daba «regular» y caía al cuadro por rondas: sin caras, sin líneas y sin Semis ni
// Final. Se completa desde la primera ronda —cada una con la mitad de cruces que la anterior, hasta la Final— y cada
// cruce jugado va en SU lugar, el de los ganadores que lo forman, no en el orden en que llegó.
// ⚠️ Sólo si la primera ronda es potencia de 2 y ninguna trae más cruces de los que caben: si no, no se inventa la forma.
const NOMBRE_RONDA = { 1: 'Final', 2: 'Semis', 4: 'Cuartos', 8: 'Octavos', 16: '16avos' };
// hasta dónde puede crecer de alto la llave del escenario (los Octavos de 16 en 1 contra 1 miden 524)
const ALTO_LLAVE = 540;
// 🔴 CUÁNTOS CRUCES TIENE UNA RONDA LO DICE SU NOMBRE, NO CUÁNTOS YA SE CARGARON. POESÍA CRUDA (URBF, 01/10/2026) cargó
// el primer cruce de Cuartos y el escenario lo dibujó como una Final: un cruce y el «?» del campeón al lado.
const CRUCES = { 'Dieciseisavos': 16, '16avos': 16, 'Octavos': 8, 'Cuartos': 4, 'Semifinales': 2, 'Semis': 2, 'Final': 1 };
export function completar(todas) {
  const n0 = todas.length ? Math.max(todas[0].b.length, CRUCES[todas[0].r] || 0) : 0;
  if (!n0 || (n0 & (n0 - 1))) return todas;
  const out = [{ r: todas[0].r, b: todas[0].b.concat(new Array(n0 - todas[0].b.length).fill([[], ''])) }];
  for (let n = n0 / 2, i = 1; n >= 1; n /= 2, i += 1) {
    const r = todas[i];
    if (r && r.b.length > n) return todas;
    const previa = out[i - 1].b;
    const lugar = new Array(n).fill(null);
    (r ? r.b : []).forEach((b) => {
      const ls = lados(b);
      let k = previa.findIndex((p) => { const g = ganador(p); return !!g && ls.includes(g); });
      k = k >= 0 ? Math.floor(k / 2) : -1;
      if (k < 0 || lugar[k]) k = lugar.indexOf(null);
      if (k >= 0) lugar[k] = b;
    });
    out.push({ r: (r && r.r) || NOMBRE_RONDA[n] || 'Ronda ' + (i + 1), b: lugar.map((b) => b || [[], '']) });
  }
  return todas.length > out.length ? todas : out;
}

// 🔴 UNA LLAVE NO SIEMPRE SE ARMA COMO UN ÁRBOL. Dlx, 01/10/2026: «a veces se hacen batallas de otras llaves antes que la
// anterior». Dos Generaciones Vol 2 (FFA) armó sus Cuartos con los ganadores a medida que llegaban —el del grupo 2 contra
// el del 6, y del grupo 2 pasaron dos— y el árbol unía cada cruce con los grupos de al lado, que no eran los suyos. Si un
// cruce no está en el lugar de los grupos de donde salen sus lados, el árbol mentiría: el mismo cuadro, con cada cruce
// en el orden en que lo escribieron (`enRondas()`) y sin líneas
export function esArbol(todas) {
  for (let i = 1; i < todas.length; i += 1) {
    const previa = todas[i - 1].b;
    for (let j = 0; j < todas[i].b.length; j += 1) {
      const ks = lados(todas[i].b[j]).map((x) => previa.findIndex((p) => !!ganador(p) && ganador(p) === x));
      if (ks.some((k) => k >= 0 && Math.floor(k / 2) !== j)) return false;
    }
  }
  return true;
}
// …y por lo mismo, «AHORA» sólo si se juega en orden: con un cruce de más adelante ya decidido antes que uno de más
// atrás, no se sabe cuál se está jugando, y no se adivina
export function enOrden(todas) {
  let pendiente = false;
  for (const r of todas) {
    for (const b of r.b) {
      if (ganador(b)) { if (pendiente) return false; } else if (lados(b).length >= 2) pendiente = true;
    }
  }
  return true;
}

// la llave completa SIN reacomodar: cada ronda con sus cruces en el orden en que vienen y los lugares que faltan, vacíos,
// al final. Es la de una llave que no se arma como árbol (`esArbol()`): reacomodarla por los ganadores le inventaba la forma.
// ⚠️ Antes iba al cuadro por rondas, y se perdían las caras, los colores y el tope de alto (Dlx, 01/10: «se desactualizó»)
export function enRondas(todas) {
  const n0 = todas.length ? Math.max(todas[0].b.length, CRUCES[todas[0].r] || 0) : 0;
  if (!n0 || (n0 & (n0 - 1))) return todas;
  const out = [];
  for (let n = n0, i = 0; n >= 1; n /= 2, i += 1) {
    const r = todas[i];
    const bs = r ? r.b : [];
    if (bs.length > n) return todas;
    out.push({ r: (r && r.r) || NOMBRE_RONDA[n] || 'Ronda ' + (i + 1), b: bs.concat(new Array(n - bs.length).fill([[], ''])) });
  }
  return todas.length > out.length ? todas : out;
}

// `lugar` (opcional): el ancho que tiene, medido. Con él la llave LO LLENA —las casillas se estiran hasta 220 y entran
// hasta cuatro rondas— en vez de quedarse con la medida de la pantalla: en Eventos, en la compu, la llave abierta usaba
// la mitad de la tarjeta y la otra mitad quedaba en blanco (Dlx, 02/10/2026: «too much white»). Sin `lugar`, como siempre
function medidaPara(lugar) {
  const G = 14;
  const CAMP = 96;
  return { rondas: Math.max(2, Math.min(4, Math.floor((lugar - CAMP + G) / (104 + G)))), G, CAMP, lugar };
}
export function CuadroMini({ liga, ll, lugar }) {
  const M0 = useMedida();
  const M = lugar ? medidaPara(lugar) : M0;
  const base = (ll.rondas || []).filter((r) => !['Tercer puesto', ...PREVIAS].includes(r.r));
  let todas = completar(base);
  if (!todas.length && (ll.rondas || []).some((r) => PREVIAS.includes(r.r))) return <CuadroRondas ll={ll} previa />;
  const arbol = esArbol(todas);
  if (!arbol) todas = enRondas(base);
  // quién pasó de cada cruce: el ganador, o —si pasan varios, como en un grupo de tres donde siguen dos— los que aparecen
  // en la ronda de al lado
  const enLaSiguiente = (i) => new Set((todas[i + 1] ? todas[i + 1].b : []).flatMap((b) => lados(b)));
  // 🔑 QUÉ RONDAS SE VEN: con la llave completa, las últimas de una llave en vivo son lugares vacíos —en el celular
  // eran Semis y Final sin nadie—. Se ven desde la que SE ESTÁ JUGANDO, sin pasarse del final; terminada, las últimas.
  // Y la primera que se ve no puede tener más de 8 cruces: más alto no entra en el escenario
  // el alto de cada casilla sale de cuántos lados tiene (un triangular son tres), y con más de dos las filas son más
  // bajas: un triangular no puede estirar el escenario (Dlx, 01/10/2026: «tampoco hagas que se expanda demasiado en
  // altura innecesariamente, porque se ve algo raro»). El alto de cada lugar sale del cruce más alto de su ronda
  const TOP = 28;
  const nLados = (b) => Math.max(2, lados(b).length);
  const masLados = (r) => Math.max(...r.b.map(nLados));
  const filaDe = (r) => (masLados(r) >= 4 ? 19 : (masLados(r) === 3 ? 20 : 26));
  const mitad = (r) => Math.max(31, (filaDe(r) * masLados(r) + 8) / 2);
  const altoDesde = (i) => 2 * todas[i].b.length * mitad(todas[i]) + TOP;
  const decidida = (r) => r.b.every((b) => !!ganador(b));
  const enJuego = todas.findIndex((r) => r.b.some((b) => !ganador(b) && lados(b).length >= 2));
  let desde = Math.max(0, todas.length - M.rondas);
  if (enJuego >= 0) desde = Math.min(enJuego, desde);
  while (desde < todas.length - 1 && todas[desde].b.length > 8) desde += 1;
  // y si así no entra de alto, la primera ronda que ya terminó queda para «Ver la llave»: lo que se mira en vivo es
  // lo que se está jugando (los Octavos triangulares terminados llevaban la llave a 814 px)
  while (desde < todas.length - 1 && altoDesde(desde) > ALTO_LLAVE && decidida(todas[desde])) desde += 1;
  const rondas = todas.slice(desde, desde + M.rondas);
  const conFinal = desde + rondas.length === todas.length;
  const regular = rondas.length && rondas.every((r, i) => i === rondas.length - 1 || rondas[i + 1].b.length * 2 === r.b.length);
  if (!regular) return <CuadroRondas ll={ll} />;
  const { G } = M;
  // el campeón sólo si se ve la Final: si no, el «campeón» sería el ganador de otra ronda
  const CAMP = conFinal ? M.CAMP : 0;
  const W = M.lugar ? Math.max(104, Math.min(220, Math.floor((M.lugar - CAMP - rondas.length * G) / rondas.length))) : M.W;
  const R = mitad(rondas[0]);
  const n0 = rondas[0].b.length;
  const campeon = conFinal ? ganador(rondas[rondas.length - 1].b[0]) : '';
  // 🔴 UNA LLAVE QUE YA TERMINÓ NO TIENE NADA «POR JUGARSE» (Dlx, 02/10/2026, con una captura de la Dos Generaciones
  // Vol 2): un lugar vacío es «—», y una batalla sin ganador —la que espera respuesta— dice «SIN GANADOR», no «AHORA»
  const cerrada = !ll.vivo || !!ll.terminada;
  // «AHORA» y «SIGUE» sólo en cruces con los dos lados: un lugar vacío todavía no se juega
  const pend = [];
  if (!cerrada && enOrden(todas)) rondas.forEach((r, ci) => r.b.forEach((b, j) => { if (!ganador(b) && lados(b).length >= 2) pend.push(ci + ':' + j); }));
  const cajas = []; const lineas = []; const etiquetas = [];
  const alto = 2 * n0 * R + TOP;
  rondas.forEach((r, ci) => {
    const x = ci * (W + G);
    etiquetas.push(<b key={'e' + ci} className="cm-r" style={{ left: x, width: W }}>{String(r.r).toUpperCase()}</b>);
    const F = filaDe(r);
    const pasan = enLaSiguiente(desde + ci);
    r.b.forEach((b, j) => {
      const y = TOP + R * (2 ** ci) * (2 * j + 1);
      const g = ganador(b);
      // un lado solo: pasa directo si ya ganó, y si no, falta definir el otro
      const ls = lados(b);
      const est = pend[0] === ci + ':' + j ? 'ahora' : (pend[1] === ci + ':' + j ? 'sigue'
        : (cerrada && !g && ls.length >= 2 ? 'singan' : ''));
      const filas = ls.length >= 2 ? ls : [ls[0] || null, null];
      const falta = !ls.length ? (cerrada ? '—' : 'por jugarse') : (g ? 'pasa directo' : 'por definir');
      cajas.push(
        <div key={ci + '-' + j} className={'cm-m ' + est + (ls.length ? '' : ' vacio')}
          style={{ left: x, top: y - F * filas.length / 2, width: W, height: F * filas.length, gridTemplateRows: 'repeat(' + filas.length + ',1fr)' }}>
          {filas.map((n, i) => {
            if (!n) return <span key={i} className="vac"><em>{falta}</em></span>;
            const f = liga.fila(n);
            const cls = (g ? (n === g ? 'g' : 'x') : (pasan.has(n) ? 'g' : '')) + (g && n === campeon ? ' camino' : '');
            return <span key={i} className={cls}><Cara liga={liga} k={f ? f.k : ''} nombre={n} cls="cm-av" /><em>{n}</em></span>;
          })}
          {est ? <i>{est === 'ahora' ? 'AHORA' : est === 'sigue' ? 'SIGUE' : 'SIN GANADOR'}</i> : null}
        </div>,
      );
      const x1 = x + W; const x2 = x + W + G / 2;
      let yp; let x3;
      if (ci < rondas.length - 1) { yp = TOP + R * (2 ** (ci + 1)) * (2 * Math.floor(j / 2) + 1); x3 = x + W + G; } else { yp = y; x3 = x + W + G; }
      // sin árbol, sin líneas: unirían cada cruce con grupos que no son los suyos
      if (arbol) lineas.push(<path key={ci + '-' + j} className={g && g === campeon ? 'camino' : ''} d={'M' + x1 + ' ' + y + 'H' + x2 + 'V' + yp + 'H' + x3} />);
    });
  });
  const xc = rondas.length * (W + G);
  const yc = TOP + n0 * R;
  const f = liga.fila(campeon);
  const ancho = xc + CAMP;
  // la cara del campeón, a la altura de la línea de la final; abajo, el sello y el nombre
  const altoCamp = 124;
  const top = Math.max(0, yc - 32);
  const total = conFinal ? Math.max(alto + 8, top + altoCamp) : alto + 8;
  return (
    <div className="cm" style={{ width: ancho, height: total }}>
      <svg className="cm-l" width={ancho} height={total} aria-hidden="true">{lineas}</svg>
      {etiquetas}{cajas}
      {conFinal ? (
        <div className="cm-camp" style={{ left: xc, top, width: CAMP }}>
          {campeon ? <Cara liga={liga} k={f ? f.k : ''} nombre={campeon} cls="cm-cara" /> : <span className="cm-cara ini">?</span>}
          <small>{campeon ? 'CAMPEÓN' : 'EN JUEGO'}</small>{campeon ? <b>{campeon}</b> : null}
        </div>
      ) : null}
    </div>
  );
}

// ── el escenario: un carrusel de momentos. Siempre hay algo: la llave de anoche no falta nunca ─────
export function gcal(e) {
  const t = utc(e.cuando);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const fin = new Date(t.getTime() + 2 * 3600000);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(limpio(e.nombre) + ' · ' + e.sv) +
    '&dates=' + f(t) + '/' + f(fin) + '&details=' + encodeURIComponent(e.link || 'https://underlegends.pages.dev/freestyle-rap/eventos');
}

export function llaveEnVivo(e, vivoL) {
  if (!vivoL || !window.llaveDeEvento) return null;
  try { return window.llaveDeEvento(e, Object.values(vivoL)); } catch (err) { return null; }
}

// ── lo tuyo, primero (Dlx, 30/09/2026: «me gustan todas», la B): si hoy te buscan y tu último evento, si fue en los
// últimos dos días. «Jugás esta noche» espera a que el payload traiga las inscripciones
function momentosTuyos(liga) {
  const yo = liga.yo;
  if (!yo) return [];
  const out = [];
  const b = liga.buscado(yo.k);
  const mw = liga.d.mw || {};
  if (b) {
    out.push({
      tipo: 'tebuscan', et: 'Te buscan', sv: yo.sv,
      txt: <><div className="hero-t"><span className="tag">HOY TE BUSCAN</span></div>
        <Tit c="hero-ev largo">{num(b.v)} PTS POR TU CABEZA</Tit>
        <p className="hero-p">{b.cn}{b.m ? ' · ' + b.m : ''}. Quien te gane, cobra. Vence {liga.dia(mw.fin)}.</p>
        <div className="hero-acc"><button type="button" className="btn verde" onClick={() => accion.ir('sebusca')}>Ver Se busca</button>
          <Compartir cls="btn borde" url={enlace('#/r/' + encodeURIComponent(yo.k))} texto={'Hoy me buscan en la Liga Global: ' + num(b.v) + ' pts por mi cabeza'} /></div></>,
      vis: <div className="mo-poster"><Poster liga={liga} b={b} /></div>,
    });
  }
  const ult = liga.semanaDe(yo.k)[0];
  if (ult && (liga.ahora - utc(liga.fechaLlave(ult[0]))) / 3600000 < 48) {
    const [ll, res, pts] = ult;
    const carta = liga.cartaUrl(yo.k, 'temporada');
    out.push({
      tipo: 'tuevento', et: 'Tu evento', sv: ll.sv,
      txt: <><div className="hero-t"><span className="tag tg-seguis">TU ÚLTIMO EVENTO · {liga.cuando(liga.fechaLlave(ll)).toUpperCase()}</span></div>
        <Tit c="hero-ev">{resultado(res)}</Tit>
        <p className="hero-p">{limpio(ll.nombre)} · {ll.sv} · {ll.participantes} raperos · +{num(pts)} pts para tu Temporada.</p>
        <div className="hero-acc"><button type="button" className="btn verde" onClick={() => accion.llave(ll.n)}>Ver la llave</button>
          {carta ? <Compartir cls="btn borde" url={carta} texto="Mi carta de la Liga Global" etiqueta="Compartir mi carta" /> : null}</div></>,
      vis: <div className="mo-carta-w"><Carta liga={liga} k={yo.k} cual="temporada" cls="mo-carta" /></div>,
    });
  }
  // ── tu próximo evento (Dlx, 01/10/2026: «me gusta tu idea», la B): a quien todavía no tiene letra, el próximo de SU
  // servidor en las próximas 36 h —o, si no hay, el que sigue en la Liga— con cuánto le falta para su letra. Lo ve sólo
  // esa persona, en la página: nada de DMs. De los 188 que jugaron la T1, 106 jugaron uno solo (29/09), y quien ya
  // jugó uno es el más fácil de traer de vuelta
  if (!yo.rg) {
    const cerca = liga.luego().filter((x) => (utc(x.cuando) - liga.ahora) / 1000 < 36 * 3600);
    const e = cerca.find((x) => x.sv === yo.sv) || cerca[0];
    if (e) {
      const ev = yo.ev || 0;
      const falta = Math.max(0, 10 - ev);
      const m = liga.multSv(e.sv);
      const n = limpio(e.nombre);
      const cuantos = ev === 0 ? 'Tu primer evento en la ' + liga.temp : (ev === 1 ? 'Jugaste 1 evento en la ' + liga.temp : 'Llevás ' + ev + ' eventos en la ' + liga.temp);
      out.push({
        tipo: 'tuprox', et: 'Tu próximo', sv: e.sv, ev: e,
        txt: <><div className="hero-t"><img className="hv-logo" alt="" src={liga.logo(e.sv)} /><span className="tag tg-seguis">TU PRÓXIMO EVENTO · {liga.dia(e.cuando).toUpperCase()}</span></div>
          <Tit c={'hero-ev' + (n.length > 16 ? ' largo' : '')}>{n}</Tit>
          <p className="hero-p">{cuantos}{falta ? (falta === 1 ? ': te falta 1 para tu letra' : ': te faltan ' + falta + ' para tu letra') : ''}{m > 1 ? '. ' + e.sv + ' va ' + mult(m) + ' esta semana' : ''}.</p>
          <div className="mo-cuenta"><small>EMPIEZA EN</small><b>{liga.falta(e.cuando)}</b></div>
          <div className="hero-acc"><a className="btn verde" href="#/avisos"><Ico n="campana" t={18} />Quiero aviso</a>
            <a className="btn borde" href={gcal(e)} target="_blank" rel="noopener noreferrer">+ Calendario</a></div></>,
        vis: <div className="mo-logo"><img alt="" src={liga.logo(e.sv, true)} />{liga.esDorado(e.nombre, e.sv) ? <span className="mo-sello">DORADO ×3</span> : null}</div>,
      });
    }
  }
  return out;
}

function momentos(liga, vivoL) {
  const out = momentosTuyos(liga);
  // 🔴 TODOS LOS QUE SE ESTÁN JUGANDO, NO SÓLO EL PRIMERO (hasta tres). El 01/10/2026 a las 8 PM se jugaban a la vez
  // POESÍA CRUDA (URBF) y la VOL 21 2v2 (FFA), y el escenario mostraba uno: Dlx creyó que el de URBF había desaparecido
  const vivos = liga.vivo().slice(0, 3);
  vivos.forEach((e, iv) => {
    const m = liga.multSv(e.sv);
    const L = llaveEnVivo(e, vivoL);
    const n = limpio(e.nombre);
    out.push({
      tipo: 'vivo', clave: iv ? 'vivo-' + e.sv + '-' + iv : 'vivo', et: vivos.length > 1 ? 'En vivo · ' + e.sv : 'En vivo', sv: e.sv,
      txt: <><div className="hero-t"><img className="hv-logo" alt="" src={liga.logo(e.sv)} /><span className="tag">EN VIVO AHORA</span>
        <span className="hero-meta">{e.sv} · EMPEZÓ {liga.dia(e.cuando).replace(/^hoy /, '')}{m ? ' · ' + mult(m) + ' ESTA SEMANA' : ''}</span></div>
        <Tit c={'hero-ev' + (n.length > 16 ? ' largo' : '')}>{n}</Tit>
        <p className="hero-p">{L ? 'La llave, cruce por cruce, mientras se juega.' : 'La llave aparece acá apenas la carguen, cruce por cruce. Mientras, se mira en Discord.'}</p>
        <div className="hero-acc">
          {L ? <button type="button" className="btn verde" onClick={() => accion.llave('v:' + L.id)}>Ver la llave</button> : null}
          {e.link ? <a className={'btn ' + (L ? 'borde' : 'verde')} href={e.link} target="_blank" rel="noopener noreferrer">Mirar en Discord ↗</a> : null}
          <a className="btn borde" href="#/avisos"><Ico n="campana" t={18} />Quiero aviso</a>
        </div></>,
      vis: L ? <div className="cm-wrap"><CuadroMini liga={liga} ll={L} /></div> : <div className="mo-logo vivo"><img alt="" src={liga.logo(e.sv, true)} /></div>,
    });
  });
  // el próximo de la Liga, si no es el mismo que ya va como «tu próximo»
  const tuyo = out.find((m) => m.tipo === 'tuprox');
  liga.luego().filter((x) => (utc(x.cuando) - liga.ahora) / 1000 < 36 * 3600 && !(tuyo && tuyo.ev === x)).slice(0, 1).forEach((e) => {
    const dor = liga.esDorado(e.nombre, e.sv);
    const det = [e.sv, e.modalidad, e.cupos ? 'cupos ' + String(e.cupos).toLowerCase() : '', e.org ? 'organiza ' + e.org : ''].filter(Boolean).join(' · ');
    const n = limpio(e.nombre);
    out.push({
      tipo: 'prox', et: 'Próximo', sv: e.sv,
      txt: <><div className="hero-t"><img className="hv-logo" alt="" src={liga.logo(e.sv)} /><span className="tag tg-prox">PRÓXIMO · {liga.dia(e.cuando).toUpperCase()}</span></div>
        <Tit c={'hero-ev' + (n.length > 16 ? ' largo' : '')}>{n}</Tit>
        <p className="hero-p">{det}{e.premios ? '. Premio: ' + recorte(e.premios, 70) : ''}</p>
        <div className="mo-cuenta"><small>EMPIEZA EN</small><b>{liga.falta(e.cuando)}</b></div>
        <div className="hero-acc"><a className="btn verde" href="#/avisos"><Ico n="campana" t={18} />Quiero aviso</a>
          <a className="btn borde" href={gcal(e)} target="_blank" rel="noopener noreferrer">+ Calendario</a></div></>,
      vis: <div className="mo-logo"><img alt="" src={liga.logo(e.sv, true)} />{dor ? <span className="mo-sello">DORADO ×3</span> : null}</div>,
    });
  });
  const ll = liga.llaves()[0];
  if (ll) {
    const gana = liga.campeon(ll);
    const cu = liga.cuando(liga.fechaLlave(ll));
    out.push({
      tipo: 'llave', et: cu.charAt(0).toUpperCase() + cu.slice(1), sv: ll.sv,
      txt: <><div className="hero-t"><span className="tag tg-llave">{cu.toUpperCase()} · LA LLAVE</span></div><Tit c={largo(limpio(ll.nombre))}>{juntos(limpio(ll.nombre))}</Tit>
        <p className="hero-p">{ll.sv} · {ll.participantes} raperos. {gana.length > 1 ? 'Campeones:' : 'Campeón:'} {gana.join(' y ')}.</p>
        <div className="hero-acc"><button type="button" className="btn verde" onClick={() => accion.llave(ll.n)}>Ver la llave entera</button>
          <Compartir cls="btn borde" url={enlace('#/llave/' + ll.n)} texto={'La llave de ' + limpio(ll.nombre) + ' en la Liga Global'} /></div></>,
      vis: <div className="cm-wrap"><CuadroMini liga={liga} ll={ll} /></div>,
    });
  }
  const video = (liga.d.feed || []).find((x) => x.tipo === 'youtube');
  if (video) {
    const d = utc(video.t);
    out.push({
      tipo: 'video', et: 'Video', color: '#E41373',
      txt: <><div className="hero-t"><span className="tag tg-video">ÚLTIMO VIDEO · {limpio(video.canal || '').toUpperCase()}</span></div><Tit c={largo(limpio(video.tit))}>{limpio(video.tit)}</Tit>
        <p className="hero-p">Subido el {d.getDate()} de {MESES[d.getMonth()]}.</p>
        <div className="hero-acc">{video.vid ? <button type="button" className="btn verde" onClick={() => abrirVideo({ vid: video.vid, tit: limpio(video.tit), link: video.link })}>▶ Mirar acá</button> : null}
          <a className={'btn ' + (video.vid ? 'borde' : 'verde')} href={video.link} target="_blank" rel="noopener noreferrer">En YouTube ↗</a></div></>,
      // 🔑 se mira acá, en la ventana de `video.jsx`; la miniatura es la grande (era la de 320×180, estirada)
      vis: video.vid ? (
        <button type="button" className="mo-yt" onClick={() => abrirVideo({ vid: video.vid, tit: limpio(video.tit), link: video.link })} aria-label="Mirar el video acá">
          <Miniatura vid={video.vid} /><span className="mo-play">▶</span></button>
      ) : null,
    });
  }
  const nov = (liga.d.novedades || [])[0];
  if (nov) {
    out.push({
      tipo: 'liga', et: 'La Liga', color: '#29B298',
      txt: <><div className="hero-t"><span className="tag tg-liga">LA LIGA · {liga.cuando(nov.t).toUpperCase()}</span></div><Tit c={largo(limpio(nov.tit))}>{limpio(nov.tit)}</Tit>
        <p className="hero-p">{recorte(nov.tx || '', 180)}</p>
        {nov.link ? <div className="hero-acc"><a className="btn verde" href={nov.link} target="_blank" rel="noopener noreferrer">Leer en Discord ↗</a></div> : null}</>,
      vis: <div className="mo-logo ul"><img alt="" src="/ul.png" /></div>,
    });
  }
  if (liga.sigue.length) {
    const sig = new Set(liga.sigue);
    for (const it of liga.muroLimpio()) {
      const ks = (it.ks || []).filter((k) => sig.has(k));
      if (!ks.length || !['campeon', 'caza', 'rango', 'tarjeta'].includes(it.tipo) || (ll && it.ll === ll.n)) continue;
      const x = liga.itemMuro(it);
      if (!x) continue;
      const k = ks.sort()[0];
      out.push({
        tipo: 'seguis', et: 'Seguís', sv: liga.T[k].sv,
        txt: <><div className="hero-t"><span className="tag tg-seguis">DE LOS QUE SEGUÍS · {x[3].toUpperCase()}</span></div><Tit c={largo(x[1])}>{x[1]}</Tit>
          <p className="hero-p">{x[0].charAt(0) + x[0].slice(1).toLowerCase()}.</p>
          <div className="hero-acc"><a className="btn verde" href={'#/r/' + encodeURIComponent(k)}>Ver su perfil</a></div></>,
        vis: <div className="mo-cara"><Cara liga={liga} k={k} nombre={liga.T[k].n} cls="st-cara" /></div>,
      });
      break;
    }
  }
  return out;
}

// ── el fondo de cada momento. Dlx, 30/09/2026: «que haya diferentes fondos para ese apartado» y «usa los colores de
// los servidores que habíamos acordado y los logos actuales». El color es el acordado (`svs.color`, de
// datos/colores_sv_marca.json) oscurecido para que el texto blanco se lea; el logo, el de hoy (`liga.logo()`).
// ⚠️ EL FONDO SIGUE NEGRO: la primera versión teñía todo el escenario con el color oscurecido, y el naranja de Snake
// Rap oscurecido es MARRÓN (Dlx: «¿por qué el fondo es marrón o naranja?»). El color va en el círculo grande y el
// logo abajo, casi opaco: a media transparencia sobre negro el naranja volvía a dar marrón
function fondoDe(liga, m) {
  const s = m && m.sv ? liga.svs[m.sv] : null;
  const col = (s && s.color) || (m && m.color) || '#29B298';
  const logo = m && m.sv ? liga.logo(m.sv, true) : '/ul.png';
  const x = /^#?([0-9a-f]{6})$/i.exec(col);
  const n = x ? parseInt(x[1], 16) : 0;
  const luz = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return { '--mo-c': col, '--mo-o': luz < 0.2 ? 1 : 0.82, '--mo-logo': 'url("' + logo + '")' };
}

// El escenario y «Esta semana» son un solo panel (Dlx, 30/09: «hazla como si estuviese dentro de ese panel»): la
// Tira entra como `children`, sin la línea que la separaba, y los círculos del fondo ya no se cortan entre los dos.
// Pasa solo al momento siguiente cada 15 segundos (Dlx: «después de 15 segundos»), contados desde el último cambio,
// también el que hace la persona. Ya no se frena con el mouse encima: en la compu parecía que no andaba.
export function Hero({ liga, vivoL, children }) {
  const mo = momentos(liga, vivoL);
  // ⚠️ el momento que se mira se sigue por su TIPO, no por su lugar: si empieza un evento en vivo, el suyo entra
  // adelante y corría a todos un lugar, y lo que estabas leyendo cambiaba solo (revisión del 01/10/2026)
  const [tipo, setTipo] = useState(null);
  const quieto = useRef(false);
  const x0 = useRef(null);
  const ultimo = useRef(Date.now());
  const lista = useRef(mo);
  lista.current = mo;
  const actual = useRef(tipo);
  actual.current = tipo;
  const n = mo.length;
  // cada momento se sigue por su clave: dos en vivo a la vez son dos momentos (`clave`), con el mismo `tipo`
  const idDe = (m) => m.clave || m.tipo;
  const j = Math.max(0, mo.findIndex((m) => idDe(m) === tipo));
  const ver = (k) => { ultimo.current = Date.now(); setTipo(idDe(mo[((k % n) + n) % n])); };
  // mientras se mira un video (`video.jsx`), el escenario no pasa solo
  const video = useRef(false);
  useEffect(() => {
    const f = (e) => { video.current = !!e.detail; ultimo.current = Date.now(); };
    window.addEventListener('lg:video-abierto', f);
    return () => window.removeEventListener('lg:video-abierto', f);
  }, []);
  useEffect(() => {
    if (n < 2 || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return undefined;
    const t = setInterval(() => {
      if (quieto.current || video.current || document.visibilityState !== 'visible' || Date.now() - ultimo.current < 15000) return;
      // «Menos animaciones» (Ajustes): no pasa solo
      if (document.documentElement.classList.contains('calma')) return;
      ultimo.current = Date.now();
      const l = lista.current;
      if (!l.length) return;
      const a = Math.max(0, l.findIndex((m) => (m.clave || m.tipo) === actual.current));
      setTipo(l[(a + 1) % l.length].clave || l[(a + 1) % l.length].tipo);
    }, 1000);
    return () => clearInterval(t);
  }, [n]);
  if (!n) return children ? <div className="escena" style={fondoDe(liga, null)}>{children}</div> : null;
  return (
    <div className="escena" style={fondoDe(liga, mo[j])}>
      <section className="hero carrusel" id="envivo" aria-roledescription="carrusel" aria-label="Lo de ahora"
        onPointerDown={(e) => { x0.current = e.clientX; quieto.current = true; }}
        onPointerLeave={() => { x0.current = null; quieto.current = false; }}
        onPointerUp={(e) => {
          if (x0.current !== null && Math.abs(e.clientX - x0.current) > 40 && !e.target.closest('.cm-wrap')) ver(j + (e.clientX < x0.current ? 1 : -1));
          x0.current = null; quieto.current = false;
        }}>
        <div className="hero-in">
          {mo.map((m, k) => (
            <article key={idDe(m)} className={'mo mo-' + m.tipo + (k === j ? ' on' : '')} aria-hidden={k !== j}>
              <div className="mo-txt">{m.txt}</div><div className="mo-vis">{m.vis}</div>
            </article>
          ))}
        </div>
        {n > 1 ? <>
          <button type="button" className="mo-fl izq" aria-label="Momento anterior" onClick={() => ver(j - 1)}><Chevron /></button>
          <button type="button" className="mo-fl der" aria-label="Momento siguiente" onClick={() => ver(j + 1)}><Chevron /></button>
        </> : null}
        <nav className="mo-tabs" aria-label="Momentos">
          {mo.map((m, k) => <button type="button" key={idDe(m)} className={(k === j ? 'on' : '') + (m.tipo === 'vivo' ? ' vivo' : '')} onClick={() => ver(k)}>{m.et}</button>)}
        </nav>
      </section>
      {children}
    </div>
  );
}

// ── instalar la página como app (Dlx, 01/10/2026: «ok…», la C). En Android, cuando Chrome dice que se puede
// (`beforeinstallprompt`, que se guarda en index.html antes de que monte esto); en el iPhone no hay botón posible y va
// cómo se hace a mano —y ahí instalarla es lo que habilita los avisos—. Sólo en pantallas táctiles, una vez: con la ✕
// no vuelve (`lg:instalar`)
export function Instalar() {
  const [ev, setEv] = useState(() => window.__instalar || null);
  const [no, setNo] = useState(() => { try { return localStorage.getItem('lg:instalar') === 'no'; } catch (e) { return false; } });
  useEffect(() => {
    const f = () => setEv(window.__instalar || null);
    window.addEventListener('lg:instalar', f);
    return () => window.removeEventListener('lg:instalar', f);
  }, []);
  const mm = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  const app = mm('(display-mode: standalone)') || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (no || app || !mm('(pointer: coarse)') || (!ev && !ios)) return null;
  const cerrar = () => { setNo(true); try { localStorage.setItem('lg:instalar', 'no'); } catch (e) { /* igual */ } };
  const instalar = async () => {
    const e = ev;
    window.__instalar = null;
    setEv(null);
    try { e.prompt(); const r = await e.userChoice; if (r && r.outcome === 'accepted') cerrar(); } catch (err) { /* el navegador no quiso */ }
  };
  return (
    <aside className="instalar" aria-label="Instalar la página como app">
      <img alt="" src="/ul-192.png" />
      <span className="inst-tx"><b>La Liga en tu celular</b>
        <small>{ev ? 'Instalala como app: queda en tu pantalla y se abre de un toque.' : 'En el iPhone se instala desde Safari, y así también te llegan los avisos.'}</small></span>
      {ev ? <button type="button" className="btn verde chico" onClick={instalar}>Instalar</button>
        // los pasos, con un dibujo por paso, viven en Ajustes (Dlx, 01/10/2026: «sé más específico»)
        : <a className="btn verde chico" href="#/ajustes/instalar">Ver cómo</a>}
      <button type="button" className="btn-ico inst-x" aria-label="No mostrar más" onClick={cerrar}><Ico n="cerrar" t={18} /></button>
    </aside>
  );
}

// ── Esta semana: la Tira (Dlx, 29/09 ~7 PM: «me gusta 3»). La votación del ×2 se mudó a Encuestas (30/09) ──
export function Tira({ liga }) {
  const m = liga.d.mult || {};
  const xs = m.sv || {};
  const svs = Object.keys(xs).sort((a, b) => (xs[b] - xs[a]) || (a < b ? -1 : 1));
  if (!svs.length) return null;
  const g = liga.doradoVigente();
  const nov = (liga.d.novedades || []).find((x) => /lunes de la liga/i.test(x.tit || ''));
  return (
    <section className="tira-s" id="semana" aria-label="Esta semana">
      <div className="ts-cab"><b className="ts-t">ESTA SEMANA</b>
        {nov && nov.link ? <a className="ts-a" href={nov.link} target="_blank" rel="noopener noreferrer">Lunes de la Liga <Ico n="flecha" t={14} /></a> : null}
      </div>
      <ul className="ts-l">
        {svs.map((sv) => {
          const x = xs[sv];
          return <li key={sv} className={x > 1 ? 'sube' : (x < 1 ? 'baja' : '')}><a className="ts-sv" href={'#/sv/' + sv} aria-label={'Perfil de ' + sv}><span className="ts-id"><img alt="" src={liga.logo(sv)} /><b>{sv}</b></span><span className="ts-x">{mult(x)}</span></a></li>;
        })}
      </ul>
      {g ? <p className="ts-dor"><b>DORADO ×3</b><span>{limpio(g.n)} · {g.sv} · {utc(g.t) <= liga.ahora ? 'se juega ahora' : liga.dia(g.t)}</span></p> : null}
    </section>
  );
}

// ── IR A: una barra negra pegada arriba que aparece cuando pasaste el escenario ─────────────────────
const SECCIONES = [['envivo', 'Ahora'], ['semana', 'Esta semana'], ['fechas', 'Fechas'], ['noticias', 'Lo último'],
  ['raperos', 'Los que mandan'], ['panel', 'Misiones'], ['encuestas', 'Encuestas'], ['sebusca', 'Se busca'], ['merch', 'Merchandising'],
  ['numeros', 'La Liga']];

export function IrA({ raiz }) {
  const barra = useRef(null);
  const [ver, setVer] = useState(false);
  const [act, setAct] = useState('envivo');
  const fijo = useRef(0);
  // qué secciones hay se mira en la página, después de dibujarla: una que se apaga por no tener datos no va. La de
  // las encuestas se llama como su título («Encuestas» o «Tus eventos», si no hay ninguna abierta)
  const [hay, setHay] = useState(SECCIONES);
  useEffect(() => {
    const r = raiz.current;
    if (!r) return;
    const nuevo = SECCIONES.filter(([id]) => r.querySelector('#' + id)).map(([id, n]) => {
      const h = id === 'encuestas' ? r.querySelector('#encuestas > .sec-t h2') : null;
      return [id, h ? h.textContent : n];
    });
    if (JSON.stringify(nuevo) !== JSON.stringify(hay)) setHay(nuevo);
  });
  useEffect(() => {
    const mostrar = () => { if (barra.current) setVer(barra.current.getBoundingClientRect().top <= 1); };
    window.addEventListener('scroll', mostrar, { passive: true });
    mostrar();
    let io = null;
    if ('IntersectionObserver' in window && raiz.current) {
      io = new IntersectionObserver((es) => {
        if (Date.now() < fijo.current) return;
        es.forEach((e) => { if (e.isIntersecting) setAct(e.target.id); });
      }, { rootMargin: '-60px 0px -70% 0px' });
      SECCIONES.forEach(([id]) => { const s = raiz.current.querySelector('#' + id); if (s) io.observe(s); });
    }
    return () => { window.removeEventListener('scroll', mostrar); if (io) io.disconnect(); };
    // 🔴 con [raiz] solo, una sección que aparece después de montar —Lo último llega con el muro— no se miraba
    // nunca, y IR A no la marcaba al pasar (revisión del 30/09/2026)
  }, [raiz, hay.map((h) => h[0]).join()]);
  const ir = (id) => {
    const s = raiz.current && raiz.current.querySelector('#' + id);
    if (s) { fijo.current = Date.now() + 900; s.scrollIntoView({ behavior: 'smooth', block: 'start' }); setAct(id); }
    // sin momentos no hay escenario al que volver: «volver arriba» igual vuelve
    else if (id === 'envivo') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <nav className={'ir-a' + (ver ? ' ver' : '')} aria-label="Ir a" ref={barra}>
      <div className="ir-in">
        <span className="ir-t">IR A</span>
        <span className="ir-l">{hay.map(([id, n]) => <a key={id} href={'#' + id} className={act === id ? 'activo' : ''} onClick={(e) => { e.preventDefault(); ir(id); }}>{n}</a>)}</span>
        <select className="ir-s" aria-label="Ir a" value={act} onChange={(e) => ir(e.target.value)}>
          {hay.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <a className="ir-arr" href="#envivo" aria-label="Volver arriba" onClick={(e) => { e.preventDefault(); ir('envivo'); }}><Ico n="flecha" t={16} /></a>
      </div>
    </nav>
  );
}
