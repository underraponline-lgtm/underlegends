// 📰 LA EDICIÓN DEL DÍA (20/11/2026). Dlx eligió «la fusión» de la maqueta privada WevRC2GB4CTa9k4sWzCxHP (v6): *«me
// gusta, pásalo a la página real»*. Es Publicaciones contada como un diario deportivo, un día por edición:
//   · arriba el número de la edición, la fecha y los cuatro números de la semana (lo que eran los «Minis» del costado);
//   · el TITULAR: el campeón de la noche con la escena de su servidor, su cara y su podio; la cita en primera persona
//     (la regla de la 5.46: cada publicación la firma quien la protagoniza) y el hilo abierto con respuestas rápidas;
//   · al costado: los resultados, «Felicita hoy» (lo que nadie felicitó: reemplaza a «Lo más felicitado», que con 1 o 2
//     felicitaciones por publicación no decía nada), «Tu día acá» (las Tareas del Pase de esta página) y lo que viene;
//   · «Lo que pasó»: cada publicación con su PORTADA (Dlx: *«me gusta que haya fotos de portada por cada publicación…
//     como las publicaciones de cada perfil… y lo último en inicio»*), en columnas que se acomodan solas;
//   · las promos (las de la historia), las ligas (la jornada del día y su tabla), los chats, las breves y las ediciones
//     anteriores.
// ⚠️ Lo que se fue a propósito (20/11, AskUserQuestion): «¿Quién gana la final?» (sigue en el chat del bot en vivo) y las
// Encuestas (se votan en el Premio gratis del Inicio). Con un filtro, un servidor o una búsqueda, Publicaciones vuelve a la
// lista de siempre: la edición es la portada, no reemplaza al buscador.
// ⚠️ Las clases van con `ed-`: en la maqueta `.letra` (la pastilla del rango) y `.ch` (la cara chica) ya existían y
// rompieron dos portadas. Antes de nombrar una clase, buscarla en estilo.css, vivo.css y css/.
import { useEffect, useMemo, useState } from 'react';
import { ksDe, limpio, num, siglaDe, utc } from './liga.js';
import { escenaDe } from './arriba.jsx';
import { Cara, Carta, accion } from './piezas.jsx';
import { Hilo, delHilo } from './comentarios.jsx';
import { LuSocial } from './medio.jsx';
import { pedirLigas } from './ligas_datos.js';
import CSS_ED from './css/edicion.css?inline';
import { usarCss } from './css.js';

usarCss('edicion', CSS_ED);
const W = typeof window !== 'undefined' ? window : {};

// 🎨 el tono de cada tipo, el mismo de «Lo último» del Inicio: oro lo que se ganó, magenta el Most Wanted, verde las
// cartas, azul las ligas y los servidores, violeta el Pase. Las clases `ed-t-*` dan el fondo y el texto en Clara y Noche
const TONO = { campeon: 'oro', podio: 'oro', resnoche: 'oro', caza: 'mw', precio: 'mw', sobrevivio: 'mw', elegido: 'mw', tarjeta: 'carta',
  ligahito: 'liga', flyer: 'liga', pase: 'pase', mesaward: 'oro' };
const DE_SERVIDOR = new Set(['svlunes', 'svsemana', 'svmeta', 'svtop', 'svrecord', 'svnuevo', 'svtier', 'svchat']);
const tono = (it) => TONO[it.tipo] || (DE_SERVIDOR.has(it.tipo) ? 'liga' : 'carta');
const COPA = <svg className="ed-copa" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 3h12v3h3v3a4 4 0 0 1-4 4h-.6A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 7.6 13H7a4 4 0 0 1-4-4V6h3V3zm-1 5v1a2 2 0 0 0 1 1.7V8H5zm13 0v2.7A2 2 0 0 0 19 9V8h-1z" /></svg>;
const CARTA_N = { pais: 'País', servidor: 'Servidor', temporada: 'Temporada', competitivo: 'Competitiva' };
const RK = { temporada: 'Temporada', competitivo: 'Competitivo', elo: 'ELO' };
const quien1 = (it) => (it.quien || [])[0] || '';
// 📱 en el celular, un comentario por nota (la página entera medía 15.000 px con dos)
const chica = () => !!(W.matchMedia && W.matchMedia('(max-width: 899px)').matches);
const kDe = (liga, n) => { const f = n ? liga.fila(n) : null; return f ? f.k : ''; };
// lo de los servidores: el número grande de su portada
const GRAN_SV = (it) => ({ svtier: ['T' + it.a, 'tier'], svnuevo: ['NUEVO', 'en la Liga'], svmeta: [(it.meta || [])[0] + '/' + (it.meta || [])[1], 'la meta de la semana'],
  svlunes: ['×' + String(it.x || '').replace('.', ','), 'el multiplicador'], svsemana: [it.eventos, 'eventos'], svchat: [it.msgs, 'mensajes'],
  svtop: ['#1', 'del servidor'], svrecord: ['★', 'récord'] })[it.tipo] || null;

// ── 🖼️ la portada de cada publicación: una imagen que dice qué pasó ──
function Tapa({ liga, it, xs, grande = false }) {
  const t = it.tipo;
  const sv = liga.svDe(it);
  const es = sv ? escenaDe(sv) : '';
  const k = ksDe(it)[0];
  const n = quien1(it);
  const fondo = es ? <img className="ed-esc" alt="" src={es} loading="lazy" /> : null;
  const sello = sv ? <img className="ed-sello" alt="" src={liga.logo(sv)} loading="lazy" /> : null;
  const prota = <Cara liga={liga} k={k} nombre={n} cls="ed-prota" grande />;
  const cls = 'ed-tapa ed-t-' + tono(it) + (grande ? ' grande' : '');
  if (t === 'campeon' || t === 'ligahito') {
    const pod = (xs || []).filter((p) => p.tipo === 'podio' && p.ev && p.ev === it.ev);
    return (
      <div className={cls}>{fondo}<span className="ed-rot">{t === 'campeon' ? 'Campeón' : limpio(it.ln || 'Liga')}</span>{sello}{prota}{t === 'campeon' ? COPA : null}
        {pod.length ? <div className="ed-podio">{pod.map((p) => <span key={p.id || p.puesto}><Cara liga={liga} k={ksDe(p)[0]} nombre={quien1(p)} cls="ed-pc" />{p.puesto === 'Subcampeón' ? '2.º' : '3.º'}</span>)}</div> : null}
      </div>
    );
  }
  if (t === 'caza' || t === 'precio') {
    return (
      <div className={cls + ' ed-buscado'}><div className="ed-cartel"><Cara liga={liga} k={kDe(liga, it.a)} nombre={it.a} cls="ed-bc" grande />
        <strong>Se busca</strong><b>+{num(it.pts)}</b><small>{limpio(it.a || '')}{t === 'caza' ? ' · ' + limpio(it.cat || 'Most Wanted') : ' · precio por su cabeza'}</small></div></div>
    );
  }
  if (t === 'tarjeta' && k) return <div className={cls + ' ed-cartas'}><Carta liga={liga} k={k} cual={it.carta} cls="ed-carta" abre={false} /><span className="ed-nueva">Nueva</span></div>;
  if (t === 'rango') return <div className={cls + ' ed-tono'} style={{ '--tc': liga.colorRg(it.rg) }}>{prota}<span className="ed-gran">{it.rg}<small>{it.primero ? 'primer rango' : 'sube de rango'}</small></span></div>;
  if (t === 'pase') return <div className={cls + ' ed-tono'}>{prota}<span className="ed-gran">{it.nivel}<small>nivel del Pase</small></span></div>;
  if (t === 'top10') return <div className={cls}>{prota}<span className="ed-gran">#{it.pos}<small>top 10 · {RK[it.rk] || it.rk}</small></span></div>;
  if (t === 'racha') return <div className={cls}>{prota}<span className="ed-gran">{it.racha}<small>eventos seguidos</small></span></div>;
  if (t === 'podio') return <div className={cls}>{fondo}{sello}{prota}<span className="ed-gran">{it.puesto === 'Subcampeón' ? '2.º' : '3.º'}<small>{limpio(it.ev || '')}</small></span></div>;
  if ((t === 'flyer' || t === 'promo') && it.img) return <div className={cls + ' ed-flyer'}><img alt="" src={it.img} loading="lazy" /></div>;
  if (t === 'resnoche') {
    const cs = (it.campeones || []).slice(0, 3);
    const es0 = cs[0] && cs[0].sv ? escenaDe(cs[0].sv) : '';
    return (
      <div className={cls}>{es0 ? <img className="ed-esc" alt="" src={es0} loading="lazy" /> : null}<span className="ed-rot">La noche</span>
        <div className="ed-podio izq">{cs.map((c, i) => <span key={i}><Cara liga={liga} k={(c.quien[0] || [])[1] || ''} nombre={(c.quien[0] || [])[0] || ''} cls="ed-pc" />{siglaDe(c.sv)}</span>)}</div>
        <span className="ed-gran">{it.eventos}<small>eventos · {it.part} raperos</small></span></div>
    );
  }
  const g = GRAN_SV(it);
  return <div className={cls}>{fondo}{sv ? <img className="ed-prota logo" alt="" src={liga.logo(sv)} loading="lazy" /> : null}{g ? <span className="ed-gran">{g[0]}<small>{g[1]}</small></span> : null}</div>;
}
// la de un grupo: las caras con su letra, las cartas en abanico o los logos
function TapaGrupo({ liga, tipo, xs }) {
  if (tipo === 'tarjeta') {
    const cs = xs.filter((it) => ksDe(it)[0]).slice(0, 3);
    return <div className="ed-tapa ed-cartas">{cs.map((it) => <Carta key={it.id || ksDe(it)[0]} liga={liga} k={ksDe(it)[0]} cual={it.carta} cls="ed-carta" abre={false} />)}<span className="ed-nueva">{xs.length} nuevas</span></div>;
  }
  return (
    <div className="ed-tapa ed-letras">{xs.slice(0, 8).map((it, i) => (
      <span key={it.id || i}>{tipo === 'rango' ? <Cara liga={liga} k={ksDe(it)[0]} nombre={quien1(it)} cls="ed-lc" /> : <img className="ed-lc" alt="" src={liga.logo(liga.svDe(it))} loading="lazy" />}
        {tipo === 'rango' ? <i style={{ background: liga.colorRg(it.rg) }}>{it.rg}</i> : null}{tipo === 'rango' ? limpio(quien1(it)) : siglaDe(liga.svDe(it))}</span>
    ))}</div>
  );
}

// ── ⭐ seguir a quien publica, desde la nota (la misma acción del perfil: `alternarSigo`) ──
function Seguir({ liga, k }) {
  const sigo = liga.sigueTodos || liga.sigue || [];
  const si = sigo.includes(k);
  const tocar = () => {
    const dc = W.DC;
    if (!dc) { accion.entrar(); return; }
    if (W.alternarSigo) W.alternarSigo(k);
  };
  return <button type="button" className={'ed-seguir' + (si ? ' on' : '')} onClick={tocar} aria-pressed={si}>{si ? '✓ Siguiendo' : '+ Seguir'}</button>;
}
// ── 🎤 ¿le quieres ganar?: el próximo evento de ese servidor, o la campana de ese servidor (te avisa al minuto) ──
function Reto({ liga, it }) {
  const sv = liga.svDe(it);
  if (!sv) return null;
  const q = it.tipo === 'caza' ? it.a : quien1(it);
  const sig = (liga.proximos() || []).find((p) => p.sv === sv && utc(p.cuando || p.t || 0).getTime() > liga.ahora);
  return (
    <div className="ed-reto"><Cara liga={liga} k={it.tipo === 'caza' ? kDe(liga, it.a) : ksDe(it)[0]} nombre={q} cls="ed-rc" />
      <span><b>¿Le quieres ganar a {limpio(q)}?</b><small>{sig ? 'El próximo de ' + siglaDe(sv) + ': ' + limpio(sig.nombre || '') : siglaDe(sv) + ' todavía no anunció el próximo: te avisamos al minuto'}</small></span>
      <a className="btn chico ed-reto-b" href={sig && sig.ins ? sig.ins : '#/avisos'} target={sig && sig.ins ? '_blank' : undefined} rel="noopener noreferrer">{sig && sig.ins ? 'Anotarme' : '🔔 Avisarme de ' + siglaDe(sv)}</a></div>
  );
}

// ── una nota de «Lo que pasó» ──
function Nota({ liga, it, xs, A, P, H, fuerte, reto }) {
  const c = H.contenido(liga, it, H.pub);
  if (!c) return null;
  const hilo = it.id ? delHilo(it, Date.now()) : [];
  const logro = !!H.LOGROS[it.tipo];
  const k = ksDe(it)[0];
  const srv = DE_SERVIDOR.has(it.tipo);
  return (
    <article className={'ed-nota ed-t-' + tono(it) + (fuerte ? ' fuerte' : '')} data-pub={it.id || undefined}>
      <Tapa liga={liga} it={it} xs={xs} />
      <div className="ed-cu">
        <span className="ed-lab">{c.cat}</span>
        <h4>{c.txt}</h4>
        {c.det ? <small className="ed-det">{c.det}</small> : null}
        <div className="ed-firma"><H.Autor liga={liga} it={it} pub={H.pub} />{k && !srv ? <Seguir liga={liga} k={k} /> : null}<time>{H.hace(liga, it.t)}</time></div>
        <div className="ed-acc">{logro ? <H.Felicitar liga={liga} it={it} A={A} /> : null}{c.acc}{it.id ? <LuSocial liga={liga} it={it} A={A} hilo={hilo} P={P} sinCm /> : null}</div>
        {reto ? <Reto liga={liga} it={it} /> : null}
        {it.id ? <Hilo liga={liga} it={it} ver={chica() ? 1 : 2} rapidas /> : null}
      </div>
    </article>
  );
}
function NotaGrupo({ liga, tipo, xs, H, A }) {
  const lab = tipo === 'rango' ? 'Rangos' : tipo === 'tarjeta' ? 'Cartas nuevas' : 'Servidores';
  const tit = tipo === 'rango' ? xs.length + ' raperos suben de rango' : tipo === 'tarjeta' ? xs.length + ' cartas nuevas' : xs.length + ' servidores';
  return (
    <article className={'ed-nota ed-t-' + (tipo === 'tarjeta' ? 'carta' : tipo === 'rango' ? 'carta' : 'liga')}>
      <TapaGrupo liga={liga} tipo={tipo} xs={xs} />
      <div className="ed-cu"><span className="ed-lab">{lab}</span><h4>{tit}</h4>
        <ul className="ed-lista">{xs.slice(0, 8).map((it, i) => {
          const c = H.contenido(liga, it, H.pub);
          return (
            <li key={it.id || i}>{tipo === 'sv' ? <img className="ed-lc" alt="" src={liga.logo(liga.svDe(it))} loading="lazy" /> : <Cara liga={liga} k={ksDe(it)[0]} nombre={quien1(it)} cls="ed-lc" />}
              <span>{c ? c.txt : ''}</span>{H.LOGROS[it.tipo] ? <H.Felicitar liga={liga} it={it} A={A} chico /> : null}</li>
          );
        })}</ul>
      </div>
    </article>
  );
}

// ── 🏟️ las ligas: la jornada de ese día como nota, y la banda con cada una (su flyer, su tabla, lo último) ──
const COMO = { directa: 'directa', replica: 'por réplica' };
function Batalla({ liga, b, ks }) {
  const pts = typeof b[4] === 'number' && typeof b[5] === 'number';
  return (
    <div className="ed-bat">
      <span className={b[2] === b[0] ? 'ed-gano' : ''}><Cara liga={liga} k={(ks || {})[b[0]] || ''} nombre={b[0]} cls="ed-bc2" />{limpio(b[0])}</span>
      <em>{pts ? String(b[4]).replace('.', ',') + ' · ' + String(b[5]).replace('.', ',') : 'vs'}</em>
      <span className={b[2] === b[1] ? 'ed-gano' : ''}>{limpio(b[1])}<Cara liga={liga} k={(ks || {})[b[1]] || ''} nombre={b[1]} cls="ed-bc2" /></span>
      <small>{limpio(b[2] || '')} {COMO[b[3]] || b[3] || ''}</small>
    </div>
  );
}
function PortadaLiga({ liga, L, fl }) {
  if (fl) return <div className="ed-tapa ed-flyer"><img alt="" src={fl} loading="lazy" /></div>;
  const es = escenaDe(L.sv);
  return <div className="ed-tapa ed-t-liga">{es ? <img className="ed-esc" alt="" src={es} loading="lazy" /> : null}<img className="ed-prota logo" alt="" src={liga.logo(L.sv)} loading="lazy" /><span className="ed-rot">{limpio(L.n)}</span></div>;
}
function useLigasEd(liga) {
  const [x, setX] = useState(null);
  const sello = liga.d && liga.d.sello;
  useEffect(() => {
    let vivo = true;
    pedirLigas(sello).then((r) => { if (vivo && r) setX(r); });
    return () => { vivo = false; };
  }, [sello]);
  return x;
}

// ── 💬 en los chats: los días fuertes del chat general de cada servidor (las publicaciones `svchat`) ──
function Barras({ hs }) {
  const xs = (hs || []).slice(0, 24);
  if (!xs.length) return null;
  const mx = Math.max(1, ...xs);
  const pico = xs.indexOf(mx);
  return (
    <>
      <svg className="ed-hs" viewBox="0 0 240 48" role="img" aria-label={'Mensajes por hora; el pico a las ' + pico + ' h'}>
        {xs.map((n, i) => <rect key={i} x={i * 10 + 1} y={44 - Math.round(n * 40 / mx)} width="8" height={Math.max(1, Math.round(n * 40 / mx))} className={i === pico ? 'pico' : ''} />)}
      </svg>
      <div className="ed-hs-eje"><span>0 h</span><span>Pico: {pico % 12 || 12} {pico < 12 ? 'AM' : 'PM'}</span><span>23 h</span></div>
    </>
  );
}

// ── el costado del titular ──
function Resultados({ liga, evs }) {
  if (!evs.length) return null;
  return (
    <section className="ed-caja"><h3 className="ed-st">Los resultados</h3>
      {evs.map((it) => {
        const sv = liga.svDe(it);
        const es = sv ? escenaDe(sv) : '';
        return (
          <div key={it.id} className="ed-res">{es ? <img className="ed-mini" alt="" src={es} loading="lazy" /> : <img className="ed-mini" alt="" src={liga.logo(sv)} loading="lazy" />}
            <span><b>{limpio(it.ev || siglaDe(sv))}</b><small>{(liga.svs[sv] && liga.svs[sv].nombre) || siglaDe(sv)}{it.part ? ' · ' + it.part + ' raperos' : ''}</small></span>
            <span className="ed-gana"><Cara liga={liga} k={ksDe(it)[0]} nombre={quien1(it)} cls="ed-rc" />{limpio(quien1(it))}</span></div>
        );
      })}
    </section>
  );
}
function FelicitaHoy({ liga, xs, A, H }) {
  const orden = { campeon: 0, caza: 1, precio: 2, rango: 3, pase: 4, ligahito: 5, top10: 6, racha: 7, podio: 8 };
  const fh = xs.filter((it) => H.LOGROS[it.tipo] && it.id && !Number((A.cu || {})[it.id] || 0) && (it.quien || []).length)
    .sort((a, b) => (orden[a.tipo] ?? 9) - (orden[b.tipo] ?? 9)).slice(0, 3);
  if (!fh.length) return null;
  return (
    <section className="ed-caja ed-fh"><h3 className="ed-st">Felicita hoy</h3>
      {fh.map((it) => {
        const c = H.contenido(liga, it, H.pub);
        return <div key={it.id} className="ed-res"><Cara liga={liga} k={ksDe(it)[0]} nombre={quien1(it)} cls="ed-rc" /><span><b>{limpio(quien1(it))}</b><small>{c ? c.txt : ''}</small></span><H.Felicitar liga={liga} it={it} A={A} chico /></div>;
      })}
      <p className="ed-nota-p">Nadie los felicitó todavía. Cada felicitación suma a tu Pase.</p>
    </section>
  );
}
// 🎯 las Tareas del Pase que se hacen acá: felicitar, comentar, mirar una llave en vivo
function TuDia({ P }) {
  const ts = P && P.listo ? [...((P.hoy || {}).tareas || []), ...((P.semana || {}).tareas || []), ...(P.temporada || [])]
    .filter((t) => /felicit|coment|en vivo|publicaci/i.test(t.t || '')).slice(0, 3) : [];
  return (
    <section className="ed-caja ed-tudia"><h3 className="ed-st" data-tuto="pb-dia">Tu día acá</h3>
      {ts.length ? ts.map((t) => (
        <div key={t.id} className={'ed-td' + (t.hecha ? ' hecha' : '')}><span><b>{t.t}</b><small>+{num(t.xp)} XP del Pase</small></span>
          <span className="ed-td-n">{Math.min(t.lleva, t.meta)}/{t.meta}</span><span className="ed-td-b"><i style={{ width: Math.round(Math.min(1, t.lleva / Math.max(1, t.meta)) * 100) + '%' }} /></span></div>
      )) : (
        <><p className="ed-nota-p">Felicitar, comentar y mirar una llave en vivo suman XP a tu Pase de rapero.</p>
          {!W.DC ? <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button> : <a className="btn borde2 chico" href="#/pase">Ver mi Pase</a>}</>
      )}
    </section>
  );
}
function LoQueViene({ liga }) {
  const ps = (liga.proximos() || []).filter((p) => utc(p.cuando || p.t || 0).getTime() > liga.ahora).slice(0, 4);
  if (!ps.length) return null;
  return (
    <section className="ed-caja"><h3 className="ed-st">Lo que viene</h3>
      {ps.map((p, i) => {
        const es = escenaDe(p.sv);
        return (
          <div key={i} className="ed-res">{es ? <img className="ed-mini" alt="" src={es} loading="lazy" /> : <img className="ed-mini" alt="" src={liga.logo(p.sv)} loading="lazy" />}
            <span><b>{limpio(p.nombre || '')}</b><small>{siglaDe(p.sv)} · {liga.cuando(p.cuando || p.t)}</small></span><a className="ed-txt" href="#/avisos">Avísame</a></div>
        );
      })}
    </section>
  );
}

// ══════════ LA EDICIÓN ══════════
const PRIO = { campeon: 0, caza: 1, precio: 2, resnoche: 3, pase: 4, rango: 5, tarjeta: 6 };
const GRUPO = (it) => (it.tipo === 'rango' || it.tipo === 'tarjeta' ? it.tipo : DE_SERVIDOR.has(it.tipo) && it.tipo !== 'svchat' ? 'sv' : '');
const BREVE = { podio: 1, top10: 1, racha: 1, svnuevo: 1, svmeta: 1 };
function titularDe(xs) {
  const c = xs.filter((it) => it.tipo === 'campeon').sort((a, b) => (b.part || 0) - (a.part || 0))[0];
  return c || xs.slice().sort((a, b) => (PRIO[a.tipo] ?? 9) - (PRIO[b.tipo] ?? 9))[0];
}
// un día por edición, del más nuevo al más viejo (los días sin publicaciones no tienen edición). ⏰ El día de la edición
// arranca a las 6 AM y no a medianoche: los eventos se juegan de noche y terminan pasadas las 12, y a las 2 AM «hoy» tenía
// dos publicaciones y la noche entera quedaba en «ayer» (medido el 20/11/2026 con el build local)
const CORTE = 6 * 3600000;
const fechaEd = (k, corta) => { const f = new Date(k + 'T12:00:00Z'); return corta ? f.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).replace(',', '') : f.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(',', ''); };
export function useDias(liga, todos) {
  return useMemo(() => {
    const out = [];
    todos.forEach((it) => {
      const k = liga.diaClave(new Date(utc(it.t).getTime() - CORTE).toISOString());
      let d = out[out.length - 1];
      if (!d || d.k !== k) { d = { k, xs: [] }; out.push(d); }
      d.xs.push(it);
    });
    return out;
  }, [todos, liga]);
}
// 📰 la cabecera de la edición: el número, la fecha y los cuatro números de la semana. Va aparte del resto porque los
// círculos y el buscador quedan entre las dos, siempre en el mismo lugar (si cambiaran de lugar al escribir la primera
// letra —la edición pasa a la lista—, el buscador perdería el foco)
export function EdCab({ liga, todos, D, H }) {
  if (!D) return null;
  const xs = D.xs;
  const nro = liga.d && liga.d.fase && liga.d.fase.arranca ? Math.round((Date.parse(D.k + 'T12:00:00Z') - Date.parse(liga.d.fase.arranca + 'T12:00:00Z')) / 86400000) + 1 : 0;
  const fechaL = fechaEd(D.k);
  const desde = liga.desdeLunes();
  const sem = todos.filter((it) => utc(it.t).getTime() >= desde);
  const cu = (f) => sem.filter(f).length;
  return (
    <header className="escena ed-mast">
      <div className="ed-mast-top"><span>{nro > 0 ? <>N.º <b>{nro}</b> · </> : null}Temporada {String(liga.temp || '').replace(/^T/i, '')}</span><b>{fechaL.charAt(0).toUpperCase() + fechaL.slice(1)}</b><span className="ed-solo-pc">{xs.length} publicaciones · {xs.filter((it) => it.tipo === 'campeon').length} eventos</span></div>
      <div className="ed-mast-mid">
        <h1 className="ed-nombre"><span data-tuto="pb-cab">Publicaciones</span><small>La edición del {fechaL}</small></h1>
        <div className="ed-franja">
          <div><b>{cu((it) => it.tipo === 'campeon')}</b><span>Campeones</span></div>
          <div><b>{cu((it) => it.tipo === 'rango')}</b><span>Suben de rango</span></div>
          <div><b>{cu((it) => it.tipo === 'tarjeta')}</b><span>Cartas nuevas</span></div>
          <div><b>{cu((it) => H.LOGROS[it.tipo] && it.tipo !== 'campeon' && it.tipo !== 'rango')}</b><span>Logros · la semana</span></div>
        </div>
      </div>
    </header>
  );
}
export function Edicion({ liga, todos, dias, di, setDi, A, P, H }) {
  const LG = useLigasEd(liga);
  const [todas, setTodas] = useState(false);
  if (!dias.length) return null;
  const D = dias[Math.min(di, dias.length - 1)];
  const xs = D.xs;
  const h = titularDe(xs);
  const ch = H.contenido(liga, h, H.pub);
  const evs = xs.filter((it) => it.tipo === 'campeon');
  const podio = xs.filter((it) => it.tipo === 'podio' && it.ev && it.ev === h.ev);
  // las notas: lo fuerte primero, la jornada de liga, lo demás y los grupos; lo chico a las breves; los chats aparte
  const resto = xs.filter((it) => it !== h && !(it.tipo === 'podio' && it.ev === h.ev) && it.tipo !== 'promo' && it.tipo !== 'svchat');
  const grupos = {};
  const notas = [];
  const breves = [];
  resto.forEach((it) => {
    const g = GRUPO(it);
    if (g && resto.filter((o) => GRUPO(o) === g).length > 1) { (grupos[g] = grupos[g] || []).push(it); return; }
    if (BREVE[it.tipo]) breves.push(it); else notas.push(it);
  });
  const ord = (it) => ({ campeon: 0, caza: 1, precio: 2, sobrevivio: 2, elegido: 2, mesaward: 3, ligahito: 3, resnoche: 4, pase: 5, flyer: 6 })[it.tipo] ?? 7;
  notas.sort((a, b) => ord(a) - ord(b));
  const ligasLobby = (LG && LG.lobby && LG.lobby.ligas) || [];
  const ligasFull = (LG && LG.ligas) || {};
  const jornadas = ligasLobby.map((L) => [L, ((ligasFull[L.id] || {}).fechas || []).find((f) => f.d === D.k)]).filter(([, f]) => f && (f.b || []).length);
  const promos = todos.filter((it) => it.tipo === 'promo').slice(0, 6);
  const chats = xs.filter((it) => it.tipo === 'svchat').concat(di === 0 ? (dias[1] || { xs: [] }).xs.filter((it) => it.tipo === 'svchat') : []).slice(0, 6);
  const tick = xs.slice(0, 12).map((it) => { const c = H.contenido(liga, it, H.pub); return c ? (DE_SERVIDOR.has(it.tipo) ? siglaDe(liga.svDe(it)) : limpio(quien1(it))) + ': ' + (typeof c.txt === 'string' ? c.txt : c.cat) : ''; }).filter(Boolean);
  const hiloH = h && h.id ? delHilo(h, Date.now()) : [];
  // 🧩 las piezas de «Lo que pasó», en orden: lo fuerte, la jornada de liga, lo demás y los grupos. «¿Le quieres ganar?» va
  // una vez por servidor (el titular primero): salía «Avisarme de CYH» en cada nota de CYH
  const conReto = new Set(h && h.tipo === 'campeon' ? [liga.svDe(h)] : []);
  const reto = (it) => { if (it.tipo !== 'campeon' && it.tipo !== 'caza') return false; const sv = liga.svDe(it); if (!sv || conReto.has(sv)) return false; conReto.add(sv); return true; };
  const piezas = [
    ...notas.filter((it) => ord(it) < 3).map((it) => <Nota key={it.id || it.t + it.tipo} liga={liga} it={it} xs={xs} A={A} P={P} H={H} fuerte reto={reto(it)} />),
    ...jornadas.map(([L, f]) => (
      <article key={L.id} className="ed-nota ed-t-liga"><PortadaLiga liga={liga} L={L} fl={(((ligasFull[L.id] || {}).flyer) || {}).u} />
        <div className="ed-cu"><span className="ed-lab">Liga · {siglaDe(L.sv)}</span><h4>Jornada de {limpio(L.n)}: {f.b.length} batallas</h4>
          <div className="ed-bats">{f.b.map((b, i) => <Batalla key={i} liga={liga} b={b} ks={L.ks} />)}</div>
          <div className="ed-acc"><a className="btn borde2 chico" href={'#/ligas/' + encodeURIComponent(L.id)}>Ver la liga</a></div></div></article>
    )),
    ...notas.filter((it) => ord(it) >= 3).map((it) => <Nota key={it.id || it.t + it.tipo} liga={liga} it={it} xs={xs} A={A} P={P} H={H} reto={reto(it)} />),
    ...Object.entries(grupos).map(([g, ys]) => <NotaGrupo key={g} liga={liga} tipo={g} xs={ys} H={H} A={A} />),
  ];
  // 📱 en el celular, las primeras 6 y un botón (la página medía 14.400 px); en la compu, todas en sus columnas
  const limite = chica() && !todas ? 6 : piezas.length;

  return (
    <div className="ed">
      {tick.length ? (
        <div className="ed-ticker" aria-label="Última hora"><b>Última hora</b><div className="ed-pista"><span className="ed-ti">{tick.map((t, i) => <span key={i}>{t}</span>)}</span><span className="ed-ti" aria-hidden="true">{tick.map((t, i) => <span key={i}>{t}</span>)}</span></div></div>
      ) : null}
      <div className="ed-portada">
        {h && ch ? (
          <article className={'ed-prin ed-t-' + tono(h)} data-pub={h.id || undefined}>
            <Tapa liga={liga} it={h} xs={xs} grande />
            <p className="ed-kicker">{ch.cat}{h.part ? ' · ' + h.part + ' raperos' : ''}</p>
            <h2 className="ed-tit">«{ch.txt}»</h2>
            <p className="ed-bajada"><b>{limpio(quien1(h) || '')}</b>{quien1(h) ? ', ' + H.hace(liga, h.t).toLowerCase() + '. ' : ''}{podio.map((p) => limpio(quien1(p)) + (p.puesto === 'Subcampeón' ? ' salió segundo' : ' salió tercero')).join(' y ')}{podio.length ? '.' : ''}</p>
            <div className="ed-acc">{H.LOGROS[h.tipo] ? <H.Felicitar liga={liga} it={h} A={A} /> : null}{ch.acc}{h.id ? <LuSocial liga={liga} it={h} A={A} hilo={hiloH} P={P} sinCm /> : null}</div>
            {h.tipo === 'campeon' ? <Reto liga={liga} it={h} /> : null}
            {h.id ? <Hilo liga={liga} it={h} ver={4} rapidas /> : null}
          </article>
        ) : null}
        <aside className="ed-col"><Resultados liga={liga} evs={evs} /><FelicitaHoy liga={liga} xs={xs} A={A} H={H} /><TuDia P={P} /><LoQueViene liga={liga} /></aside>
      </div>
      {piezas.length ? (
        <section className="ed-sec"><h3 className="ed-st">Lo que pasó</h3>
          <div className="ed-grid">
            {piezas.slice(0, limite)}
          </div>
          {piezas.length > limite ? <button type="button" className="btn borde2 ed-mas" onClick={() => setTodas(true)}>Ver las {piezas.length} notas de esta edición</button> : null}
        </section>
      ) : null}
      {promos.length ? (
        <section className="ed-sec"><h3 className="ed-st">Las promos · las de la historia</h3>
          <p className="ed-sec-d">Lo que comparten los raperos en el canal de promoción de su servidor y lo que promociona la Liga. Cada una que abres te da <b>50 Puntos de Tienda</b> (hasta 3 por día) y suma a tu Pase.</p>
          <div className="ed-vgrid">{promos.map((it) => { const c = H.contenido(liga, it, H.pub); return c ? <article key={it.id} className="ed-v"><div className="ed-v-img">{c.vis}</div><div className="ed-cu"><span className="ed-lab">{c.cat}</span><h4>{c.txt}</h4><div className="ed-firma"><H.Autor liga={liga} it={it} pub={H.pub} /><time>{H.hace(liga, it.t)}</time></div></div></article> : null; })}</div>
        </section>
      ) : null}
      {ligasLobby.length ? (
        <section className="ed-sec"><h3 className="ed-st">Las ligas · {ligasLobby.length} en juego</h3>
          <div className="ed-lgrid">{ligasLobby.slice().sort((a, b) => String(b.ult_t || '').localeCompare(String(a.ult_t || ''))).slice(0, 6).map((L) => {
            const fin = (L.tabla || []).length ? Math.max(...L.tabla.map((r) => r[3])) : 0;
            return (
              <article key={L.id} className="ed-lg"><PortadaLiga liga={liga} L={L} fl={(((ligasFull[L.id] || {}).flyer) || {}).u} />
                <div className="ed-cu"><span className="ed-lab">{(liga.svs[L.sv] && liga.svs[L.sv].nombre) || siglaDe(L.sv)} · {L.bat || 0} batallas</span><h4>{limpio(L.n)}</h4>
                  <ol className="ed-tabla">{(L.tabla || []).slice(0, 5).map((r, i) => (
                    <li key={r[0]} className={i === 0 ? 'lider' : ''}><span className="pos">{i + 1}</span><Cara liga={liga} k={(L.ks || {})[r[0]] || ''} nombre={r[0]} cls="ed-bc2" /><b>{limpio(r[0])}</b><span className="pj">{r[1]} PJ</span>
                      <span className="ed-bp"><i style={{ width: (fin ? Math.round(r[3] * 100 / fin) : 0) + '%' }} /></span><span className="pts">{r[3]}</span></li>
                  ))}</ol>
                  {(L.ult || []).length ? <><p className="ed-mini-t">Lo último</p><div className="ed-bats">{L.ult.slice(0, 2).map((b, i) => <Batalla key={i} liga={liga} b={b} ks={L.ks} />)}</div></> : null}
                  <div className="ed-acc"><a className="btn borde2 chico" href={'#/ligas/' + encodeURIComponent(L.id)}>Ver la liga</a></div></div></article>
            );
          })}</div>
        </section>
      ) : null}
      {chats.length ? (
        <section className="ed-sec"><h3 className="ed-st">En los chats</h3>
          <div className="ed-chgrid">{chats.map((it) => {
            const sv = liga.svDe(it);
            return (
              <article key={it.id || sv} className="ed-chat"><div className="ed-ch-cab"><img className="ed-rc" alt="" src={liga.logo(sv)} loading="lazy" /><b>{(liga.svs[sv] && liga.svs[sv].nombre) || siglaDe(sv)}</b><small>{num(it.msgs)} mensajes · {it.gente} personas</small></div>
                <Barras hs={it.hs} />
                {(it.hablan || []).length ? <div className="ed-ch-f"><span className="et">Habló más</span><Cara liga={liga} k={it.hablan[0]} nombre={it.hablan[0]} cls="ed-rc" /><b>{limpio((liga.T[it.hablan[0]] || {}).n || it.hablan[0])}</b></div> : null}
              </article>
            );
          })}</div>
        </section>
      ) : null}
      {breves.length ? (
        <section className="ed-sec"><h3 className="ed-st">Breves</h3>
          <ul className="ed-breves">{breves.map((it) => { const c = H.contenido(liga, it, H.pub); return c ? <li key={it.id || it.t + it.tipo} className={'ed-t-' + tono(it)}>{DE_SERVIDOR.has(it.tipo) ? <img className="ed-rc" alt="" src={liga.logo(liga.svDe(it))} loading="lazy" /> : <Cara liga={liga} k={ksDe(it)[0]} nombre={quien1(it)} cls="ed-rc" />}<div><p>{c.txt}</p><div className="ed-firma"><time>{H.hace(liga, it.t)}</time>{H.LOGROS[it.tipo] ? <H.Felicitar liga={liga} it={it} A={A} chico /> : null}</div></div></li> : null; })}</ul>
        </section>
      ) : null}
      {dias.length > 1 ? (
        <section className="escena ed-ant"><h3 className="ed-st">Las ediciones anteriores</h3>
          <div className="ed-eds">{dias.slice(0, 5).map((E, i) => {
            const T = titularDe(E.xs);
            const ct = T ? H.contenido(liga, T, H.pub) : null;
            const sv = T ? liga.svDe(T) : '';
            const es = sv ? escenaDe(sv) : '';
            const f = fechaEd(E.k, true);
            return (
              <button key={E.k} type="button" className="ed-ed" aria-current={i === di} onClick={() => { setDi(i); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <span className="ed-ed-img">{es ? <img alt="" src={es} loading="lazy" /> : null}{T ? <Cara liga={liga} k={ksDe(T)[0]} nombre={quien1(T)} cls="ed-rc" /> : null}</span>
                <span className="ed-ed-cab"><span>{f}</span><span>{E.xs.length}</span></span>
                <strong>{ct ? (typeof ct.txt === 'string' ? ct.txt : ct.cat) : ''}</strong>
              </button>
            );
          })}</div>
        </section>
      ) : null}
      <div className="ed-recibe"><H.Avisame /></div>
    </div>
  );
}
