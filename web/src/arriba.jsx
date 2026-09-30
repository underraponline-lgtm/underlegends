// Lo de arriba del Inicio: la cabecera negra, las historias, el escenario (el carrusel de momentos), la Tira de
// «Esta semana» y la barra IR A. Traducido de docs/remake/reales.py (cabecera, historias, momentos, hero, semana, ir_a).
import { useEffect, useMemo, useRef, useState } from 'react';
import { MESES, limpio, mult, num, recorte, utc } from './liga.js';
import { Cara, Carta, Chevron, Ico, accion, nombrePais } from './piezas.jsx';

export const MENU = [
  ['Inicio', '#/'], ['Eventos', '#/eventos'], ['Ranking', '#/ranking'], ['Publicaciones', '#/publicaciones'],
  ['Tarjetas', '#/tarjetas'], ['Pase', '#/pase'], ['Tienda', '#/tienda'], ['Mundo', '#/mundo'], ['Guía', '#/guia'],
];

function Marca({ liga }) {
  return (
    <a className="marca" href="#/">
      <img alt="" src="/ul.png" />
      <span className="lockup"><b>DISCORD RAP</b> <b>EN ESPAÑOL</b><small className="lg">LIGA GLOBAL · {liga.temp}</small></span>
    </a>
  );
}

function Buscar({ liga }) {
  const [q, setQ] = useState('');
  const res = useMemo(() => {
    const t = q.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    if (!t) return [];
    return (liga.d.tabla || []).filter((f) => f.n.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(t)).slice(0, 6);
  }, [q, liga]);
  return (
    <div className="buscar-w">
      <label className="buscar">
        <Ico n="buscar" t={18} />
        <input type="search" placeholder="Buscar rapero" aria-label="Buscar rapero" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) accion.perfil(res[0].k); if (e.key === 'Escape') setQ(''); }} />
      </label>
      {res.length ? (
        <ul className="busca-res">
          {res.map((f) => <li key={f.k}><a href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cara" /><span>{limpio(f.n)}</span></a></li>)}
        </ul>
      ) : null}
    </div>
  );
}

export function Cabecera({ liga, onMenu }) {
  const yo = liga.yo;
  return (
    <header className="cab negra">
      <Marca liga={liga} />
      <nav className="menu" aria-label="Secciones">
        {MENU.map(([n, r]) => <a key={n} href={r} className={n === 'Inicio' ? 'on' : ''}>{n}</a>)}
      </nav>
      <div className="cab-der">
        <Buscar liga={liga} />
        <a className="btn-ico" href="#/avisos" aria-label="Avisos de eventos"><Ico n="campana" t={20} /></a>
        {yo ? (
          <button type="button" className="yo-chip" onClick={accion.cuenta}><Cara liga={liga} k={yo.k} nombre={yo.n} /><span>{limpio(yo.n)}</span></button>
        ) : (
          <button type="button" className="btn verde chico entrar" onClick={accion.cuenta}>Entrar</button>
        )}
        <button className="btn-ico hamb" type="button" aria-label="Menú" onClick={onMenu}><Ico n="menu" t={22} /></button>
      </div>
    </header>
  );
}

// ── las historias: lo que se abre al tocar cada círculo de arriba ─────────────────────────────────────
// un título de video de 70 letras ocupaba seis renglones del escenario: pasado de 42, un cuerpo menos
const largo = (t) => 'hero-ev largo' + (String(t || '').length > 42 ? ' muy-largo' : '');
function Slide(tag, cuerpo, cuando, cta, ir) { return { tag, cuerpo, cuando, cta, ir }; }

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
    const q = (it.quien || []).map(limpio);
    const ks = it.ks || [];
    const c = liga.cuando(it.t);
    if (it.tipo === 'tarjeta' && g.length > 1) {
      const quienes = [];
      g.forEach((o) => { const x = limpio(o.quien[0]); if (!quienes.includes(x)) quienes.push(x); });
      const txt = quienes.length > 1 ? quienes.slice(0, -1).join(', ') + ' y ' + quienes[quienes.length - 1] : quienes[0];
      out.push(Slide('CARTAS NUEVAS', <><div className="st-minis">{g.slice(0, 4).map((o, i) => <Carta key={i} liga={liga} k={o.ks[0]} cual={o.carta} cls="st-mini-c" abre={false} />)}</div>
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
  });
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

export function gruposHistorias(liga) {
  const muro = liga.muroLimpio().filter((it) => ['campeon', 'anuncio', 'caza', 'tarjeta', 'rango'].includes(it.tipo));
  const grupos = [];
  liga.vivo().forEach((e) => {
    const m = liga.multSv(e.sv);
    grupos.push({
      id: 'vivo', tipo: 'vivo', nombre: 'En vivo · ' + e.sv, logo: liga.logo(e.sv), nom: limpio(e.nombre),
      slides: [Slide('EN VIVO AHORA · ' + e.sv, <><img className="st-logo grande" alt="" src={liga.logo(e.sv)} /><h3 className="st-h grande">{limpio(e.nombre)}</h3>
        <small className="st-s">Empezó a las {liga.dia(e.cuando).replace(/^hoy /, '')}{m ? ' · ' + mult(m) + ' esta semana' : ''}. La llave aparece acá apenas la carguen.</small></>,
      'ahora', 'Mirar en Discord', { link: e.link })],
    });
  });
  const mm = liga.d.mult || {};
  Object.values(liga.svs).sort((a, b) => b.n - a.n).forEach((s) => {
    const sv = s.sv;
    const slides = [];
    const m = (mm.sv || {})[sv];
    const lineas = [];
    const g = liga.dorado();
    if (g && g.sv === sv) lineas.push(<li key="d"><b>DORADO ×3</b>{limpio(g.n)}, {liga.dia(g.t)}</li>);
    const par = ((mm.guerra || {}).pares || []).find((p) => p.includes(sv));
    if (par) lineas.push(<li key="g"><b>GUERRA</b>contra {par[0] === sv ? par[1] : par[0]}: gana el que más puntos hace por persona</li>);
    const meta = (mm.metas || {})[sv];
    if (meta) {
      const va = (mm.meta_va || {})[sv] || 0;
      lineas.push(<li key="m"><b>META</b>{va} de {meta} personas{va >= meta ? ' · cumplida' : ''}</li>);
    }
    if (m || lineas.length) {
      slides.push(Slide('ESTA SEMANA · ' + sv, <><img className="st-logo" alt="" src={liga.logo(sv)} />
        {m ? <b className={'st-mult ' + (m > 1 ? 'sube' : 'baja')}>{mult(m)}</b> : null}<ul className="st-l">{lineas}</ul></>, 'lunes', 'Lunes de la Liga', { ancla: 'semana' }));
    }
    const propios = muro.filter((it) => liga.svDe(it) === sv);
    slidesDe(liga, propios).slice(0, 6).forEach((x) => slides.push(x));
    if (!propios.length) {
      slides.push(Slide(String(s.nombre || sv).toUpperCase(), <><img className="st-logo grande" alt="" src={liga.logo(sv)} /><h3 className="st-h">Todavía sin eventos en la {liga.temp}</h3>
        <small className="st-s">{String(s.tag || '').charAt(0) + String(s.tag || '').slice(1).toLowerCase()}</small></>, '', s.invita ? 'Entrar al servidor' : '', { link: s.invita }));
    }
    grupos.push({ id: 'sv-' + sv.toLowerCase(), tipo: 'sv', nombre: s.nombre, logo: liga.logo(sv), nom: sv, nuevo: propios.length > 0, slides });
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
    'esta temporada', 'Ver ' + nom, { ruta: '#/pais/' + pa.cc })];
    slidesDe(liga, propios).slice(0, 3).forEach((x) => slides.push(x));
    grupos.push({ id: 'pais-' + pa.cc, tipo: 'pais', nombre: nom, cc: pa.cc, nom, nuevo: propios.length > 0, slides });
  }
  const c = yo ? liga.crewDe(yo) : null;
  if (c) {
    const ks = new Set(c.gente.map((n) => liga.fila(n)).filter(Boolean).map((f) => f.k));
    ks.delete(yo.k);
    const slides = [Slide('TU CREW', <><CrewCirculo c={c} cls="st-crew" /><h3 className="st-h">{limpio(c.crew).toUpperCase()}</h3>
      <small className="st-s">{c.n} {c.n !== 1 ? 'raperos' : 'rapero'} · {num(c.pts)} pts · el mejor: {limpio(c.mejor)}</small>
      <ul className="st-gente">{c.gente.slice(0, 8).map((n, i) => { const f = liga.fila(n); return <li key={i}><Cara liga={liga} k={f ? f.k : ''} nombre={n} cls="st-mini" /><span>{limpio(n)}</span></li>; })}</ul></>,
    'esta temporada', 'Ver la crew', { ruta: '#/crew/' + encodeURIComponent(c.clave || c.crew) })];
    const propios = muro.filter((it) => (it.ks || []).some((k) => ks.has(k)));
    slidesDe(liga, propios).slice(0, 3).forEach((x) => slides.push(x));
    grupos.push({ id: 'crew-' + claveCrew(c.crew), tipo: 'crew', nombre: limpio(c.crew), crew: c, nom: limpio(c.crew), nuevo: propios.length > 0, slides });
  }
  const ETIQUETA = { tarjeta: 'carta nueva', campeon: 'campeón', caza: 'cazó' };
  const sig = liga.sigue.map((k) => {
    const f = liga.T[k];
    const propios = muro.filter((it) => (it.ks || []).includes(k));
    let slides = slidesDe(liga, propios).slice(0, 4);
    // alguien que seguís y no hizo nada nuevo igual tiene su círculo: su carta y cómo va
    if (!slides.length) {
      slides = [Slide('SEGUÍS A', <><Carta liga={liga} k={k} cual="temporada" cls="st-carta" abre={false} /><h3 className="st-h">{limpio(f.n)}</h3>
        <small className="st-s">{f.pos ? '#' + f.pos + ' · ' : ''}OVR {f.ovr || '—'} · {num(f.pts)} pts · {f.ev || 0} {f.ev === 1 ? 'evento' : 'eventos'}</small></>,
      'esta temporada', 'Ver su perfil', { perfil: k })];
    }
    const u = propios[0];
    const et = u ? (u.tipo === 'rango' ? 'rango ' + (u.rg || '') : ETIQUETA[u.tipo] || '') : (f.pos ? '#' + f.pos : '');
    return { id: 'p-' + k, tipo: 'gente', nombre: limpio(f.n), k, cc: f.cc, nom: limpio(f.n), et, nuevo: !!u, t: u ? String(u.t) : '', pos: f.pos || 1e9, slides };
  });
  // primero los que tienen algo nuevo, lo más reciente adelante; después por el ranking
  sig.sort((a, b) => (Number(b.nuevo) - Number(a.nuevo)) || b.t.localeCompare(a.t) || (a.pos - b.pos));
  sig.slice(0, 15).forEach((g) => grupos.push(g));
  return grupos.filter((g) => g.slides.length);
}

// la cara de alguien en un círculo: su foto o, si no tiene, la inicial sobre su bandera (una inicial sobre negro,
// fila tras fila, era lo que se veía «sin avatar»)
export function CaraH({ liga, k, nombre, cc, cls = 'h-c' }) {
  const [mal, setMal] = useState(false);
  const src = k ? liga.avUrl(k) : null;
  if (src && !mal) return <span className={cls}><img alt="" src={src} onError={() => setMal(true)} /></span>;
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
    const visto = vistos.has(g.id) ? ' visto' : '';
    const abrir = () => onAbrir(i);
    if (g.tipo === 'vivo') {
      partes.push(<button type="button" key={g.id} className={'h en-vivo' + visto} onClick={abrir}><span className="h-w"><span className="h-c"><img alt="" src={g.logo} /></span>
        <span className="h-badge">EN VIVO</span></span><small>{g.nom}</small></button>);
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
const lados = (b) => (b[0] || []).slice(0, 2).map((z) => limpio(typeof z === 'string' ? z : z.join(' & ')));
const ganador = (b) => limpio(typeof b[1] === 'string' ? b[1] : (b[1] || []).join(' & '));

function CuadroRondas({ ll }) {
  const rondas = (ll.rondas || []).filter((r) => !['Filtros', 'Tercer puesto'].includes(r.r));
  return (
    <>
      <div className="llave-cab"><span>CUADRO</span><span className="apag">POR RONDAS</span></div>
      <div className="llave-wrap"><div className="llave" style={{ gridTemplateColumns: 'repeat(' + rondas.length + ',150px)' }}>
        {rondas.map((r, ri) => (
          <div className="ronda" key={ri}><h4>{r.r}</h4>
            {(r.b || []).map((b, bi) => { const g = ganador(b); return <div className="m hecho" key={bi}>{lados(b).map((x, xi) => <span key={xi} className={x === g ? 'g' : 'x'}>{x}</span>)}</div>; })}
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
};
function useMedida() {
  const q = (m) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(m).matches : false);
  const leer = () => (q('(max-width: 599.98px)') ? 'movil' : (q('(max-width: 1099.98px)') ? 'medio' : 'pc'));
  const [m, setM] = useState(leer);
  useEffect(() => {
    const f = () => setM(leer());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return MEDIDAS[m];
}

export function CuadroMini({ liga, ll }) {
  const M = useMedida();
  const todas = (ll.rondas || []).filter((r) => !['Filtros', 'Tercer puesto', 'Clasificatorias', 'Preliminares'].includes(r.r));
  const rondas = todas.slice(-M.rondas);
  const regular = rondas.length && rondas.every((r, i) => i === rondas.length - 1 || rondas[i + 1].b.length * 2 === r.b.length);
  if (!regular) return <CuadroRondas ll={ll} />;
  const { W, G, CAMP } = M;
  const R = 31; const HB = 52; const TOP = 28;
  const n0 = rondas[0].b.length;
  const campeon = ganador(rondas[rondas.length - 1].b[0]);
  const pend = [];
  rondas.forEach((r, ci) => r.b.forEach((b, j) => { if (!ganador(b)) pend.push(ci + ':' + j); }));
  const cajas = []; const lineas = []; const etiquetas = [];
  const alto = 2 * n0 * R + TOP;
  rondas.forEach((r, ci) => {
    const x = ci * (W + G);
    etiquetas.push(<b key={'e' + ci} className="cm-r" style={{ left: x, width: W }}>{String(r.r).toUpperCase()}</b>);
    r.b.forEach((b, j) => {
      const y = TOP + R * (2 ** ci) * (2 * j + 1);
      const g = ganador(b);
      const est = pend[0] === ci + ':' + j ? 'ahora' : (pend[1] === ci + ':' + j ? 'sigue' : '');
      cajas.push(
        <div key={ci + '-' + j} className={'cm-m ' + est} style={{ left: x, top: y - HB / 2, width: W }}>
          {lados(b).map((n, i) => {
            const f = liga.fila(n);
            const cls = (g ? (n === g ? 'g' : 'x') : '') + (g && n === campeon ? ' camino' : '');
            return <span key={i} className={cls}><Cara liga={liga} k={f ? f.k : ''} nombre={n} cls="cm-av" /><em>{n}</em></span>;
          })}
          {est ? <i>{est === 'ahora' ? 'AHORA' : 'SIGUE'}</i> : null}
        </div>,
      );
      const x1 = x + W; const x2 = x + W + G / 2;
      let yp; let x3;
      if (ci < rondas.length - 1) { yp = TOP + R * (2 ** (ci + 1)) * (2 * Math.floor(j / 2) + 1); x3 = x + W + G; } else { yp = y; x3 = x + W + G; }
      lineas.push(<path key={ci + '-' + j} className={g && g === campeon ? 'camino' : ''} d={'M' + x1 + ' ' + y + 'H' + x2 + 'V' + yp + 'H' + x3} />);
    });
  });
  const xc = rondas.length * (W + G);
  const yc = TOP + n0 * R;
  const f = liga.fila(campeon);
  const ancho = xc + CAMP;
  // la cara del campeón, a la altura de la línea de la final; abajo, el sello y el nombre
  const altoCamp = 124;
  const top = Math.max(0, yc - 32);
  const total = Math.max(alto + 8, top + altoCamp);
  return (
    <div className="cm" style={{ width: ancho, height: total }}>
      <svg className="cm-l" width={ancho} height={total} aria-hidden="true">{lineas}</svg>
      {etiquetas}{cajas}
      <div className="cm-camp" style={{ left: xc, top, width: CAMP }}>
        {campeon ? <Cara liga={liga} k={f ? f.k : ''} nombre={campeon} cls="cm-cara" /> : <span className="cm-cara ini">?</span>}
        <small>{campeon ? 'CAMPEÓN' : 'EN JUEGO'}</small>{campeon ? <b>{campeon}</b> : null}
      </div>
    </div>
  );
}

// ── el escenario: un carrusel de momentos. Siempre hay algo: la llave de anoche no falta nunca ─────
function gcal(e) {
  const t = utc(e.cuando);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const fin = new Date(t.getTime() + 2 * 3600000);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(limpio(e.nombre) + ' · ' + e.sv) +
    '&dates=' + f(t) + '/' + f(fin) + '&details=' + encodeURIComponent(e.link || 'https://underlegends.pages.dev/#/eventos');
}

function llaveEnVivo(e, vivoL) {
  if (!vivoL || !window.llaveDeEvento) return null;
  try { return window.llaveDeEvento(e, Object.values(vivoL)); } catch (err) { return null; }
}

function momentos(liga, vivoL) {
  const out = [];
  liga.vivo().slice(0, 1).forEach((e) => {
    const m = liga.multSv(e.sv);
    const L = llaveEnVivo(e, vivoL);
    const n = limpio(e.nombre);
    out.push({
      tipo: 'vivo', et: 'En vivo',
      txt: <><div className="hero-t"><img className="hv-logo" alt="" src={liga.logo(e.sv)} /><span className="tag">EN VIVO AHORA</span>
        <span className="hero-meta">{e.sv} · EMPEZÓ {liga.dia(e.cuando).replace(/^hoy /, '')}{m ? ' · ' + mult(m) + ' ESTA SEMANA' : ''}</span></div>
        <h1 className={'hero-ev' + (n.length > 16 ? ' largo' : '')}>{n}</h1>
        <p className="hero-p">{L ? 'La llave, cruce por cruce, mientras se juega.' : 'La llave aparece acá apenas la carguen, cruce por cruce. Mientras, se mira en Discord.'}</p>
        <div className="hero-acc">
          {L ? <button type="button" className="btn verde" onClick={() => accion.llave('v:' + L.id)}>Ver la llave</button> : null}
          {e.link ? <a className={'btn ' + (L ? 'borde' : 'verde')} href={e.link} target="_blank" rel="noopener noreferrer">Mirar en Discord ↗</a> : null}
          <a className="btn borde" href="#/avisos"><Ico n="campana" t={18} />Quiero aviso</a>
        </div></>,
      vis: L ? <div className="cm-wrap"><CuadroMini liga={liga} ll={L} /></div> : <div className="mo-logo vivo"><img alt="" src={liga.logo(e.sv)} /></div>,
    });
  });
  liga.luego().filter((x) => (utc(x.cuando) - liga.ahora) / 1000 < 36 * 3600).slice(0, 1).forEach((e) => {
    const dor = liga.esDorado(e.nombre, e.sv);
    const det = [e.sv, e.modalidad, e.cupos ? 'cupos ' + String(e.cupos).toLowerCase() : '', e.org ? 'organiza ' + e.org : ''].filter(Boolean).join(' · ');
    const n = limpio(e.nombre);
    out.push({
      tipo: 'prox', et: 'Próximo',
      txt: <><div className="hero-t"><img className="hv-logo" alt="" src={liga.logo(e.sv)} /><span className="tag tg-prox">PRÓXIMO · {liga.dia(e.cuando).toUpperCase()}</span></div>
        <h1 className={'hero-ev' + (n.length > 16 ? ' largo' : '')}>{n}</h1>
        <p className="hero-p">{det}{e.premios ? '. Premio: ' + recorte(e.premios, 70) : ''}</p>
        <div className="mo-cuenta"><small>EMPIEZA EN</small><b>{liga.falta(e.cuando)}</b></div>
        <div className="hero-acc"><a className="btn verde" href="#/avisos"><Ico n="campana" t={18} />Quiero aviso</a>
          <a className="btn borde" href={gcal(e)} target="_blank" rel="noopener noreferrer">+ Calendario</a></div></>,
      vis: <div className="mo-logo"><img alt="" src={liga.logo(e.sv)} />{dor ? <span className="mo-sello">DORADO ×3</span> : null}</div>,
    });
  });
  const ll = liga.llaves()[0];
  if (ll) {
    const gana = liga.campeon(ll);
    const cu = liga.cuando(liga.fechaLlave(ll));
    out.push({
      tipo: 'llave', et: cu.charAt(0).toUpperCase() + cu.slice(1),
      txt: <><div className="hero-t"><span className="tag tg-llave">{cu.toUpperCase()} · LA LLAVE</span></div><h1 className={largo(limpio(ll.nombre))}>{limpio(ll.nombre)}</h1>
        <p className="hero-p">{ll.sv} · {ll.participantes} raperos. {gana.length > 1 ? 'Campeones:' : 'Campeón:'} {gana.join(' y ')}.</p>
        <div className="hero-acc"><button type="button" className="btn verde" onClick={() => accion.llave(ll.n)}>Ver la llave entera</button></div></>,
      vis: <div className="cm-wrap"><CuadroMini liga={liga} ll={ll} /></div>,
    });
  }
  const video = (liga.d.feed || []).find((x) => x.tipo === 'youtube');
  if (video) {
    const d = utc(video.t);
    out.push({
      tipo: 'video', et: 'Video',
      txt: <><div className="hero-t"><span className="tag tg-video">ÚLTIMO VIDEO · {limpio(video.canal || '').toUpperCase()}</span></div><h1 className={largo(limpio(video.tit))}>{limpio(video.tit)}</h1>
        <p className="hero-p">Subido el {d.getDate()} de {MESES[d.getMonth()]}.</p>
        <div className="hero-acc"><a className="btn verde" href={video.link} target="_blank" rel="noopener noreferrer">Mirar en YouTube ↗</a></div></>,
      vis: <a className="mo-video" href={video.link} target="_blank" rel="noopener noreferrer" aria-label="Mirar en YouTube">
        <img alt="" src={'https://i.ytimg.com/vi/' + video.vid + '/mqdefault.jpg'} /><span className="mo-play">▶</span></a>,
    });
  }
  const nov = (liga.d.novedades || [])[0];
  if (nov) {
    out.push({
      tipo: 'liga', et: 'La Liga',
      txt: <><div className="hero-t"><span className="tag tg-liga">LA LIGA · {liga.cuando(nov.t).toUpperCase()}</span></div><h1 className={largo(limpio(nov.tit))}>{limpio(nov.tit)}</h1>
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
        tipo: 'seguis', et: 'Seguís',
        txt: <><div className="hero-t"><span className="tag tg-seguis">DE LOS QUE SEGUÍS · {x[3].toUpperCase()}</span></div><h1 className={largo(x[1])}>{x[1]}</h1>
          <p className="hero-p">{x[0].charAt(0) + x[0].slice(1).toLowerCase()}.</p>
          <div className="hero-acc"><a className="btn verde" href={'#/r/' + encodeURIComponent(k)}>Ver su perfil</a></div></>,
        vis: <div className="mo-cara"><Cara liga={liga} k={k} nombre={liga.T[k].n} cls="st-cara" /></div>,
      });
      break;
    }
  }
  return out;
}

export function Hero({ liga, vivoL }) {
  const mo = momentos(liga, vivoL);
  const [i, setI] = useState(0);
  const quieto = useRef(false);
  const x0 = useRef(null);
  const n = mo.length;
  const ver = (k) => setI(((k % n) + n) % n);
  useEffect(() => {
    if (n < 2 || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return undefined;
    const t = setInterval(() => { if (!quieto.current && document.visibilityState === 'visible') setI((v) => (v + 1) % n); }, 7000);
    return () => clearInterval(t);
  }, [n]);
  if (!n) return null;
  const j = Math.min(i, n - 1);
  return (
    <section className="hero carrusel" id="envivo" aria-roledescription="carrusel" aria-label="Lo de ahora"
      onPointerEnter={() => { quieto.current = true; }} onPointerLeave={() => { quieto.current = false; }}
      onPointerDown={(e) => { x0.current = e.clientX; quieto.current = true; }}
      onPointerUp={(e) => {
        if (x0.current !== null && Math.abs(e.clientX - x0.current) > 40 && !e.target.closest('.cm-wrap')) ver(j + (e.clientX < x0.current ? 1 : -1));
        x0.current = null; quieto.current = false;
      }}>
      <div className="hero-in">
        {mo.map((m, k) => (
          <article key={m.tipo} className={'mo mo-' + m.tipo + (k === j ? ' on' : '')} aria-hidden={k !== j}>
            <div className="mo-txt">{m.txt}</div><div className="mo-vis">{m.vis}</div>
          </article>
        ))}
      </div>
      {n > 1 ? <>
        <button type="button" className="mo-fl izq" aria-label="Momento anterior" onClick={() => ver(j - 1)}><Chevron /></button>
        <button type="button" className="mo-fl der" aria-label="Momento siguiente" onClick={() => ver(j + 1)}><Chevron /></button>
      </> : null}
      <nav className="mo-tabs" aria-label="Momentos">
        {mo.map((m, k) => <button type="button" key={m.tipo} className={(k === j ? 'on' : '') + (m.tipo === 'vivo' ? ' vivo' : '')} onClick={() => ver(k)}>{m.et}</button>)}
      </nav>
    </section>
  );
}

// ── Esta semana: la Tira (Dlx, 29/09 ~7 PM: «me gusta 3»). La votación del ×2 se mudó a Encuestas (30/09) ──
export function Tira({ liga }) {
  const m = liga.d.mult || {};
  const xs = m.sv || {};
  const svs = Object.keys(xs).sort((a, b) => (xs[b] - xs[a]) || (a < b ? -1 : 1));
  if (!svs.length) return null;
  const g = liga.dorado();
  const nov = (liga.d.novedades || []).find((x) => /lunes de la liga/i.test(x.tit || ''));
  return (
    <section className="tira-s" id="semana" aria-label="Esta semana">
      <div className="ts-cab"><b className="ts-t">ESTA SEMANA</b>
        {nov && nov.link ? <a className="ts-a" href={nov.link} target="_blank" rel="noopener noreferrer">Lunes de la Liga <Ico n="flecha" t={14} /></a> : null}
      </div>
      <ul className="ts-l">
        {svs.map((sv) => {
          const x = xs[sv];
          return <li key={sv} className={x > 1 ? 'sube' : (x < 1 ? 'baja' : '')}><span className="ts-id"><img alt="" src={liga.logo(sv)} /><b>{sv}</b></span><span className="ts-x">{mult(x)}</span></li>;
        })}
      </ul>
      {g ? <p className="ts-dor"><b>DORADO ×3</b><span>{limpio(g.n)} · {g.sv} · {utc(g.t) < liga.ahora ? 'se jugó ' + liga.cuando(g.t) : liga.dia(g.t)}</span></p> : null}
    </section>
  );
}

// ── IR A: una barra negra pegada arriba que aparece cuando pasaste el escenario ─────────────────────
const SECCIONES = [['envivo', 'Ahora'], ['semana', 'Esta semana'], ['fechas', 'Fechas'], ['noticias', 'Lo último'],
  ['raperos', 'Los que mandan'], ['encuestas', 'Encuestas'], ['panel', 'Misiones'], ['sebusca', 'Se busca'], ['merch', 'Merchandising']];

export function IrA({ raiz }) {
  const barra = useRef(null);
  const [ver, setVer] = useState(false);
  const [act, setAct] = useState('envivo');
  const fijo = useRef(0);
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
  }, [raiz]);
  const ir = (id) => {
    const s = raiz.current && raiz.current.querySelector('#' + id);
    if (s) { fijo.current = Date.now() + 900; s.scrollIntoView({ behavior: 'smooth', block: 'start' }); setAct(id); }
  };
  const hay = SECCIONES.filter(([id]) => !raiz.current || raiz.current.querySelector('#' + id));
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
