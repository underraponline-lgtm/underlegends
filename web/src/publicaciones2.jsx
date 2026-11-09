// 📰 PUBLICACIONES, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes… tómate tu tiempo… haz research».
// Para todos desde el mismo día (Dlx: «Publica y haz todo»), en lugar de la de publicaciones.jsx. Es el mismo muro (bot/muro.py:
// lo que pasa en la Liga, contado solo, y los anuncios de todos los servidores) con lo que dejó el research de 21st
// (scratchpad/remake2/research_publicaciones_cambios.md):
// - DOS DENSIDADES: los logros (campeón, rango, Most Wanted, Pase, MES AWARDS…) grandes y con 👏 Felicitar; lo que es
//   aviso (los anuncios de eventos, las novedades de la Liga, lo de las ligas) en renglones. Antes todo pesaba igual.
// - EL DÍA COMO UN RIEL: la hora a la izquierda y un punto con el color de lo que es (verde lo que se ganó, magenta el
//   Most Wanted, negro los avisos). El día queda pegado arriba mientras se baja.
// - JUNTOS LOS DEL MISMO DÍA: las cartas nuevas (como antes), las subidas de rango y los anuncios de eventos —eran 19 y
//   17 de 84 renglones—: una publicación cada uno, con su lista adentro.
// - LOS FILTROS CON SU CANTIDAD, y LO NUEVO desde tu última visita marcado (como el changelog).
// - El costado con lo más felicitado en barras, como el Ranking.
// ⚠️ Lo que Dlx decidió de esta página sigue igual: las encuestas no son lo primero (después del primer día, y al final
// si ya votaste en todas); Felicitar sólo en los logros; las cartas del día juntas; Promos y «A quien sigo».
import { Fragment, useEffect, useMemo, useState } from 'react';
import { MESES, hora, ksDe, limpio, num, siglaDe, utc } from './liga.js';
import { CrewCirculo } from './arriba.jsx';
import { TierChip } from './crewpanel.jsx';
import { Cara, Carta, Ico, Vacio, accion, promoAbierta, useCampana } from './piezas.jsx';
import { Miniatura, abrirVideo } from './video.jsx';
import { Elegido, X2 } from './encuestas.jsx';
import { useAplausos } from './aplausos.js';
import { PLATAFORMA } from './publicaciones.jsx';
import CSS_PAGINA from './css/publicaciones2.css?inline';
import { usarCss } from './css.js';

usarCss('publicaciones2', CSS_PAGINA);

const ANUNCIOS = { anuncio: 1, liga: 1, flyer: 1 };
const LOGROS = { campeon: 1, rango: 1, caza: 1, sobrevivio: 1, pase: 1, sorteo: 1, ligahito: 1, mesaward: 1 };
const MES_CAT = { rapero: 'el Rapero del mes', revelacion: 'la Revelación del mes', batalla: 'la Batalla del mes', servidor: 'el Servidor del mes' };
const CARTA = { pais: 'de País', temporada: 'de Temporada', servidor: 'de Servidor', competitivo: 'Competitiva' };
// 🎨 de qué color es el punto del riel: lo que se ganó (verde), el Most Wanted y la plata (magenta), los avisos (negro)
const COLOR = { campeon: 'v', ligahito: 'v', mesaward: 'v', pase: 'v', sorteo: 'v', crewtier: 'v', tarjeta: 'v', rango: 'v',
  caza: 'm', sobrevivio: 'm', precio: 'm', elegido: 'm', premios: 'm' };
// los que van juntos si hay más de uno en el día
const JUNTOS = { tarjeta: 1, rango: 1, anuncio: 1, crewtier: 1 };
// 📦 lo que va en caja con su sombra: lo que es noticia (un campeón, el Most Wanted, un MES AWARD). Lo demás, en renglón
// (la revisión del remake: «si todo es una caja, nada se ve primero»)
const fuerte = (it) => it.tipo === 'campeon' || it.tipo === 'mesaward' || it.tipo === 'caza' || it.tipo === 'sobrevivio'
  || it.tipo === 'precio' || it.tipo === 'elegido' || it.tipo === 'resnoche' || (it.tipo === 'ligahito' && it.que === 'campeon');

// 🌙 un nombre del resumen de la noche, con link a su perfil si está en la temporada (las claves van en cada renglón,
// no en `ks`: ver `muro.noches()`)
function Nombre({ liga, x }) {
  const n = limpio(x && x.n);
  return x && x.k && liga.T[x.k] ? <a href={'#/r/' + encodeURIComponent(x.k)}>{n}</a> : <b>{n}</b>;
}
const y = (xs) => xs.reduce((acc, x, i) => (i ? acc.concat([i === xs.length - 1 ? ' y ' : ', ', x]) : [x]), []);
//: cuántos campeones se nombran en el resumen antes de «y N más»
const NOCHE_CAMPEONES = 4;

// 👏 el mismo Felicitar de siempre (las funciones son de social.js: `felicitar`, `errorAplauso`); `chico` para las listas
function Felicitar({ liga, it, A, chico }) {
  const id = it.id;
  if (!id) return null;
  const n = Number(A.cu[id] || 0);
  const mio = !!A.mios[id];
  const yo = liga.yo;
  if (yo && ksDe(it).includes(yo.k)) return n ? <span className="pb-fel tuyo" title="Te felicitaron">👏 {num(n)}</span> : null;
  const err = A.err[id] && window.errorAplauso ? window.errorAplauso(A.err[id]) : '';
  return (
    <>
      <button type="button" className={'pb-fel' + (chico ? ' chico' : '') + (mio ? ' on' : '') + (A.va[id] ? ' va' : '')} aria-pressed={mio}
        disabled={mio || !!A.va[id]} onClick={() => { if (window.felicitar) window.felicitar(id); }}
        aria-label={(mio ? 'Felicitaste' : 'Felicitar') + (n ? ' · ' + n : '')}>
        <span aria-hidden="true">👏</span>{chico ? null : (mio ? 'Felicitaste' : 'Felicitar')}{n ? <em>{num(n)}</em> : null}
      </button>
      {err ? <small className="pb-err" role="status">{err}</small> : null}
    </>
  );
}

// los nombres de una publicación, con link a su perfil si está en la temporada
function nombresDe(liga, it) {
  const q = (it.quien || []).map(limpio);
  const ks = Array.isArray(it.ks) ? it.ks : [];
  return q.map((n, i) => (ks[i] && liga.T[ks[i]] ? <a key={i} href={'#/r/' + encodeURIComponent(ks[i])}>{n}</a> : <b key={i}>{n}</b>))
    .reduce((acc, x, i) => (i ? acc.concat([i === q.length - 1 ? ' y ' : ', ', x]) : [x]), []);
}

// ── qué dice cada publicación: la categoría, lo que se ve, el texto, el detalle y adónde lleva (lo de publicaciones.jsx,
// con el dibujo nuevo). `media`: la imagen va arriba y grande (video, flyer) ──
function contenido(liga, it) {
  const q = (it.quien || []).map(limpio);
  const ks = Array.isArray(it.ks) ? it.ks : [];
  const nombres = nombresDe(liga, it);
  const f0 = ks[0] ? liga.T[ks[0]] : null;
  const cara = <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls="cara pb-cara" />;
  const c = { cat: '', vis: null, txt: null, det: '', acc: null, media: false };
  if (it.tipo === 'campeon') {
    c.cat = 'Campeón · ' + siglaDe(it.sv);
    c.vis = f0 && (f0.c || []).includes('temporada') ? <Carta liga={liga} k={f0.k} cual="temporada" cls="pb-carta" abre={false} /> : cara;
    c.txt = <>{nombres}{q.length > 1 ? ' se quedan con ' : ' se queda con '}<b>{limpio(it.ev)}</b></>;
    c.det = it.part ? it.part + ' raperos' : '';
    c.acc = it.ll ? <button type="button" className="pb-a" onClick={() => accion.llave(it.ll)}>Ver la llave</button> : null;
  } else if (it.tipo === 'rango') {
    c.cat = it.primero ? 'Primera letra' : 'Sube de rango';
    c.vis = <span className="pb-rg" style={{ background: liga.colorRg(it.rg) }}>{it.rg}</span>;
    c.txt = <>{nombres}{it.primero ? ' consigue su primera letra: ' : ' pasa a rango '}<b>{it.rg}</b></>;
    c.acc = ks[0] ? <a className="pb-a" href={'#/r/' + encodeURIComponent(ks[0])}>Ver su perfil</a> : null;
  } else if (it.tipo === 'caza') {
    c.cat = 'Most Wanted · Caza';
    c.vis = cara;
    c.txt = <>{nombres}{q.length > 1 ? ' cazaron a ' : ' cazó a '}<b>{limpio(it.a)}</b> ({it.cat}) y {q.length > 1 ? 'cobran' : 'cobra'} <b>{num(it.pts)}</b></>;
    c.det = it.ev ? limpio(it.ev) : '';
  } else if (it.tipo === 'sobrevivio') {
    c.cat = 'Most Wanted · Sobrevivió';
    c.vis = cara;
    c.txt = <>{nombres} sobrevivió al Most Wanted ({it.cat}) y se lleva <b>{num(it.pts)}</b></>;
  } else if (it.tipo === 'crewtier') {
    const col = (liga.d.crews_tiers && (liga.d.crews_tiers.colores || [])[it.tier]) || '#E41373';
    c.cat = 'Crews · Sube de tier';
    // su escudo como en todos los círculos de crew (sin logo, el de su nombre: el remake del 29/10); el logo de hoy de la
    // crew si el muro no lo trae
    const viva = (liga.d.crews || []).find((x) => (x.clave || x.crew) === it.crew);
    c.vis = <span className="pb-crew" style={{ boxShadow: '0 0 0 3px ' + col }}><CrewCirculo c={{ crew: it.nombre, logo: it.logo || (viva && viva.logo) || '' }} cls="pb-crew-c" /></span>;
    c.txt = <><b>{limpio(it.nombre)}</b> sube a <b style={{ color: col }}>{it.tn}</b>{it.tarjeta ? ' y desbloquea su tarjeta de crew' : ''}</>;
    c.det = it.pts ? num(it.pts) + ' puntos en la semana' : '';
    c.acc = <a className="pb-a" href={'#/crew/' + encodeURIComponent(it.crew)}>Ver la crew</a>;
  } else if (it.tipo === 'pase') {
    c.cat = it.completo ? 'Pase de rapero · Completo' : 'Pase de rapero';
    c.vis = cara;
    c.txt = it.completo ? <>{nombres} completó el <b>Pase de rapero</b> y entra al Salón del Pase</>
      : <>{nombres} llegó al nivel <b>{it.nivel}</b> del Pase de rapero{it.premio ? <>: <b>«{it.premio}»</b></> : null}</>;
    c.acc = <a className="pb-a" href="#/pase">Ver el Pase</a>;
  } else if (it.tipo === 'sorteo') {
    c.cat = 'Sorteo del Pase premium';
    c.vis = cara;
    c.txt = <>{nombres} ganó el sorteo y se lleva el rol <b>«Pase Premium»</b> de DRA</>;
    c.det = num(it.personas) + ' entraron gratis · ' + num(it.boletos) + ' boletos · semilla ' + String(it.semilla || '').slice(0, 12) + '…';
    c.acc = <a className="pb-a" href="#/pase">Ver el Pase</a>;
  } else if (it.tipo === 'precio') {
    c.cat = 'Precio por su cabeza';
    c.vis = cara;
    c.txt = <>{nombres}{q.length > 1 ? ' le ganaron a ' : ' le ganó a '}<b>{limpio(it.a)}</b> y {q.length > 1 ? 'cobran' : 'cobra'} el precio por su cabeza: <b>{num(it.pts)}</b></>;
    c.det = it.ev ? limpio(it.ev) : '';
  } else if (it.tipo === 'premios') {
    c.cat = 'Premios de la semana';
    c.vis = <img className="pb-logo" alt="" src="/ul.png" />;
    const p = [it.figura ? 'figura: ' + limpio(it.figura[0]) : '', it.revelacion ? 'revelación: ' + limpio(it.revelacion[0]) : '',
      it.cazador ? 'cazador: ' + limpio(it.cazador[0]) : '', it.servidor ? 'servidor: ' + siglaDe(it.servidor[0]) : ''].filter(Boolean);
    c.txt = <b>{p.join(' · ')}</b>;
  } else if (it.tipo === 'elegido') {
    c.cat = 'El Elegido';
    c.vis = cara;
    c.txt = <>La gente eligió a {nombres} como El Elegido del Most Wanted</>;
    c.det = it.de ? it.votos + ' de ' + it.de + ' votos' : '';
  } else if (it.tipo === 'mesaward') {
    const mes = MESES[Number(String(it.mes || '').slice(5, 7)) - 1] || '';
    const deSv = String(it.cat || '').startsWith('sv:');
    c.cat = 'MES AWARDS · ' + (deSv ? siglaDe(it.sv) + ' · ' : '') + mes;
    if (it.cat === 'batalla' && it.vid) {
      c.media = true;
      c.vis = (
        <button type="button" className="pb-vid" onClick={() => abrirVideo({ vid: it.vid, tit: limpio(it.n || ''), link: 'https://www.youtube.com/watch?v=' + it.vid })}
          aria-label={'Mirar ' + limpio(it.n || 'la batalla')}><Miniatura vid={it.vid} cls="pb-vid-img" /><span className="pb-play" aria-hidden="true">▶</span></button>
      );
    } else {
      c.vis = deSv || it.cat === 'servidor' ? <img className="pb-logo" alt="" src={liga.logo(it.sv)} />
        : it.cat === 'otras' ? <span className="pb-logo pb-copa" aria-hidden="true"><Ico n="copa" t={28} /></span> : cara;
    }
    const lista = (it.lista || []).map((y, i) => <span key={y[0]}>{i ? ' · ' : ''}{y[1]}: <b>{limpio(y[2])}</b>{y[3] ? ' (' + y[3] + '%)' : ''}</span>);
    c.txt = deSv ? <>Los ganadores de <b>{mes}</b> en {siglaDe(it.sv)}: {lista}</>
      : it.cat === 'otras' ? <>Los demás ganadores de <b>{mes}</b>: {lista}</>
      : it.cat === 'batalla' ? <><b>{limpio(it.n)}</b> es la Batalla del mes de {mes}</>
      : it.cat === 'servidor' ? <><b>{limpio(it.n)}</b> es el Servidor del mes de {mes}</>
        : <>{nombres} es {MES_CAT[it.cat] || 'ganador'} de <b>{mes}</b></>;
    c.det = it.cat === 'otras' || deSv ? '' : it.por === 'votos'
      ? (it.pct ? it.pct + '% de los votos · ' : '') + num(it.votos) + (it.votos === 1 ? ' voto' : ' votos') + (it.total ? ' de ' + num(it.total) : '')
      : 'por los números del mes';
    c.acc = deSv ? <a className="pb-a" href={'#/sv/' + encodeURIComponent(it.sv)}>{siglaDe(it.sv)}</a> : <a className="pb-a" href="#/salon">El Salón de la fama</a>;
  } else if (it.tipo === 'promo') {
    const plat = PLATAFORMA[it.plat] || 'su link';
    const deLiga = it.o === 'liga' || it.o === 'mano';
    c.cat = deLiga ? 'La Liga promociona' : 'Promo · ' + siglaDe(it.sv);
    if (it.vid || it.img) {
      c.media = true;
      c.vis = it.vid ? (
        <button type="button" className="pb-vid" onClick={() => { promoAbierta(it.id); abrirVideo({ vid: it.vid, tit: limpio(it.tit || ''), link: it.url }); }}
          aria-label={'Mirar ' + (it.tit ? limpio(it.tit) : 'el video')}><Miniatura vid={it.vid} cls="pb-vid-img" /><span className="pb-play" aria-hidden="true">▶</span>
          <span className="pb-plat">{plat}</span></button>
      ) : <a className="pb-vid" href={it.url} target="_blank" rel="noopener noreferrer" aria-label={'Abrir en ' + plat} onClick={() => promoAbierta(it.id)}>
        <img className="pb-vid-img" alt="" src={it.img} loading="lazy" /><span className="pb-plat">{plat}</span></a>;
    } else c.vis = cara;
    const sitio = String(it.url || '').replace(/^https:\/\/(www\.)?/, '').split('/')[0];
    c.txt = deLiga && !(it.quien || []).filter(Boolean).length ? <b>{limpio(it.tit || sitio)}</b>
      : deLiga ? <>{nombres} en <b>{limpio(it.tit || plat)}</b></>
      : it.tit ? <>{nombres} comparte <b>{limpio(it.tit)}</b></> : <>{nombres} comparte algo en <b>{plat}</b></>;
    c.det = it.de && it.de !== it.tit ? it.de : '';
    c.acc = <a className="pb-a" href={it.url} target="_blank" rel="noopener noreferrer" onClick={() => promoAbierta(it.id)}>{it.plat === 'sp' || it.plat === 'sc' ? 'Escuchar' : 'Ver'} en {plat} ↗</a>;
  } else if (it.tipo === 'ligahito') {
    const ir = '#/ligas/' + encodeURIComponent(it.liga || '');
    c.cat = (it.que === 'campeon' ? 'Campeón de liga' : it.que === 'invicto' ? 'Liga · Invicto' : 'Liga · La punta') + ' · ' + siglaDe(it.sv);
    c.vis = cara;
    c.txt = it.que === 'campeon' ? <>{nombres} es el campeón de <b>{limpio(it.ln)}</b></>
      : it.que === 'invicto' ? <>{nombres} lleva <b>{it.pg || 5} ganadas sin perder</b> en {limpio(it.ln)}</>
        : <>{nombres} tomó la punta de <b>{limpio(it.ln)}</b>{it.pts ? <> con {it.pts} puntos</> : null}</>;
    c.det = it.que === 'campeon' && (it.podio || []).length > 1 ? 'Podio: ' + it.podio.map(limpio).join(' · ') : '';
    c.acc = <a className="pb-a" href={ir}>Ver la liga</a>;
  } else if (it.tipo === 'flyer') {
    const ir = '#/ligas/' + encodeURIComponent(it.liga || '');
    c.cat = 'Liga · ' + siglaDe(it.sv);
    c.vis = <a className="pb-flyer" href={ir} aria-label={'Ver ' + limpio(it.ln)}>
      <img alt={'El flyer de ' + limpio(it.ln) + (it.tit ? ': ' + limpio(it.tit) : '')} src={it.img} loading="lazy"
        width={it.w || undefined} height={it.h || undefined} /></a>;
    c.txt = <><b>{limpio(it.ln)}</b>{it.tit ? <> publicó su flyer: {limpio(it.tit)}</> : ' publicó su flyer'}</>;
    c.acc = <><a className="pb-a" href={ir}>Ver la liga</a>
      {it.link ? <a className="pb-a" href={it.link} target="_blank" rel="noopener noreferrer">Ver en Discord ↗</a> : null}</>;
  } else if (it.tipo === 'liga') {
    c.cat = 'La Liga';
    c.vis = <img className="pb-logo" alt="" src="/ul.png" />;
    c.txt = <b>{limpio(it.tit)}</b>;
    // 🕐 la hora de Discord (`<t:…>`), si el texto la trae cruda (el ciclo ya la escribe desde el 02/11/2026: esto es
    // para lo guardado antes)
    const tx = String(it.tx || '').replace(/<t:(\d{9,11})(?::[tTdDfFR])?>/g, (m, s) => liga.dia(new Date(Number(s) * 1000).toISOString()));
    c.det = tx ? limpio(tx).slice(0, 220) + (tx.length > 220 ? '…' : '') : '';
    c.acc = it.link ? <a className="pb-a" href={it.link} target="_blank" rel="noopener noreferrer">Ver en Discord ↗</a> : null;
  } else if (it.tipo === 'resnoche') {
    // 🌙 el resumen de la noche (Dlx, 07/10 y 09/11/2026): los campeones, los que más sumaron, quién subió y las sorpresas
    const [, m, d] = String(it.dia || '').split('-');
    c.cat = 'Resumen de la noche' + (d ? ' · ' + d + '/' + m : '');
    c.vis = <img className="pb-logo" alt="" src="/ul.png" />;
    const cs = (it.campeones || []).slice(0, NOCHE_CAMPEONES).map((e, i) => (
      <Fragment key={i}>{y((e.quien || []).map(([n, k], j) => <Nombre key={j} liga={liga} x={{ n, k }} />))} ganó <b>{limpio(e.ev)}</b></Fragment>));
    const mas = (it.campeones || []).length - cs.length;
    c.txt = <>{it.eventos} {it.eventos === 1 ? 'evento' : 'eventos'} y {num(it.part)} {it.part === 1 ? 'participación' : 'participaciones'}.{' '}
      {cs.reduce((acc, x, i) => (i ? acc.concat(['; ', x]) : [x]), [])}{mas > 0 ? <>, y {mas} más</> : null}{cs.length ? '.' : ''}</>;
    const partes = [];
    if ((it.suman || []).length) partes.push(<Fragment key="s">Más puntos: {y(it.suman.map((x, i) => <Fragment key={i}><Nombre liga={liga} x={x} /> +{num(x.pts)}</Fragment>))}</Fragment>);
    if ((it.suben || []).length) partes.push(<Fragment key="u">Subieron: {y(it.suben.map((x, i) => <Fragment key={i}><Nombre liga={liga} x={x} /> #{x.de} → #{x.a}</Fragment>))}</Fragment>);
    if ((it.sorpresas || []).length) partes.push(<Fragment key="p">Sorpresa: {y(it.sorpresas.map((x, i) => <Fragment key={i}><Nombre liga={liga} x={x} />{x.que === 'debut' ? ' ganó en su primer evento' : ' ganó su primer título' + (x.desde ? ' (venía #' + x.desde + ')' : '')}</Fragment>))}</Fragment>);
    c.det = partes.length ? partes.reduce((acc, x, i) => (i ? acc.concat([' · ', x]) : [x]), []) : '';
    c.acc = <a className="pb-a" href="#/eventos">Ver los eventos</a>;
  } else if (it.tipo === 'anuncio') {
    c.cat = 'Evento · ' + siglaDe(it.sv);
    c.vis = <img className="pb-logo" alt="" src={liga.logo(it.sv)} />;
    c.txt = <b>{limpio(it.ev)}</b>;
    c.det = [it.mod, it.org ? 'organiza ' + it.org : '', it.pre ? 'premio: ' + it.pre : ''].filter(Boolean).join(' · ');
    c.acc = it.link ? <a className="pb-a" href={it.link} target="_blank" rel="noopener noreferrer">Ver en Discord ↗</a> : null;
  } else return null;
  return c;
}

// ── una publicación suelta ──
function Post({ liga, it, A, nuevo }) {
  const c = contenido(liga, it);
  if (!c) return null;
  const logro = !!LOGROS[it.tipo];
  return (
    <article className={'pb-post ' + it.tipo + (c.media ? ' media' : fuerte(it) ? ' caja' : ' renglon')}>
      {c.vis ? <div className="pb-v">{c.vis}</div> : null}
      <div className="pb-c">
        <span className="pb-cat">{c.cat}{nuevo ? <i className="pb-nuevo">NUEVO</i> : null}</span>
        <p className="pb-t">{c.txt}</p>
        {c.det ? <small className="pb-d">{c.det}</small> : null}
        {logro || c.acc ? <div className="pb-acc">{logro ? <Felicitar liga={liga} it={it} A={A} /> : null}{c.acc}</div> : null}
      </div>
    </article>
  );
}

// ── las crews que suben de tier el mismo lunes: una lista, con el tier como pastilla (su color de fondo y la letra que se lee) ──
function Tiers({ liga, xs, visto }) {
  const T = liga.d.crews_tiers && liga.d.crews_tiers.nombres ? liga.d.crews_tiers : null;
  if (xs.length === 1 || !T) return <>{xs.map((it) => <Post key={it.t + it.crew} liga={liga} it={it} A={null} nuevo={visto && utc(it.t) > visto} />)}</>;
  return (
    <article className="pb-post grupo tiers">
      <div className="pb-c">
        <span className="pb-cat">Crews que suben de tier · {xs.length}{visto && xs.some((it) => utc(it.t) > visto) ? <i className="pb-nuevo">NUEVO</i> : null}</span>
        <ul className="pb-filas">
          {xs.map((it) => {
            const viva = (liga.d.crews || []).find((x) => (x.clave || x.crew) === it.crew);
            return (
              <li key={it.crew + it.t}>
                <CrewCirculo c={{ crew: it.nombre, logo: it.logo || (viva && viva.logo) || '' }} cls="pb-crew-c chico" />
                <span className="pb-fn"><a href={'#/crew/' + encodeURIComponent(it.crew)}>{limpio(it.nombre)}</a>
                  <small>{it.pts ? num(it.pts) + ' puntos en la semana' : 'sube de tier'}{it.tarjeta ? ' · desbloquea su tarjeta' : ''}</small></span>
                <TierChip n={it.tier} T={T} />
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

// ⏳ mientras llega el muro. Si no llega (la página vuelve a pedirlo cada 5 minutos), lo dice en vez de quedarse cargando
function MuroCargando() {
  const [tarde, setTarde] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTarde(true), 10000);
    return () => clearTimeout(t);
  }, []);
  return <p className="pronto-p" role="status">{tarde ? 'No pude traer las publicaciones. Prueba de nuevo en un rato.' : 'Buscando las publicaciones…'}</p>;
}

// ── las cartas nuevas del día: una tira de cartas que se abren en abanico (sólo CSS) ──
function Cartas({ liga, xs, nuevo }) {
  const vistos = new Set();
  const us = xs.filter((it) => { const k = (it.ks || [])[0]; if (!k || vistos.has(k)) return false; vistos.add(k); return true; });
  const n = us.length;
  if (!n) return null;
  const nombres = us.slice(0, 3).map((it) => limpio((it.quien || [])[0] || ''));
  const k0 = us[0].ks[0];
  return (
    <article className={'pb-post grupo cartas' + (n === 1 ? ' una' : '')}>
      <div className="pb-c">
        <span className="pb-cat">{n === 1 ? 'Carta nueva' : 'Cartas nuevas · ' + n}{nuevo ? <i className="pb-nuevo">NUEVO</i> : null}</span>
        <p className="pb-t">{n === 1 ? <><b>{nombres[0]}</b> ya tiene su carta {CARTA[us[0].carta] || ''}</>
          : <><b>{nombres.join(', ')}</b>{n > 3 ? ' y ' + (n - 3) + ' más' : ''} ya tienen su carta</>}</p>
        <div className="pb-mano" style={{ '--n': Math.min(n, 10) }}>
          {us.slice(0, 10).map((it, i) => {
            const k = (it.ks || [])[0];
            return <button type="button" key={k + it.carta} className="pb-mini" style={{ '--i': i }} onClick={() => accion.carta(k, it.carta)} aria-label={'La carta de ' + limpio((it.quien || [])[0] || '')}>
              <Carta liga={liga} k={k} cual={it.carta} cls="pb-mini-c" abre={false} /></button>;
          })}
          {n > 10 ? <span className="pb-mas">+{n - 10}</span> : null}
        </div>
        {n === 1 ? <div className="pb-acc"><button type="button" className="pb-a" onClick={() => accion.carta(k0, us[0].carta)}>Ver la carta</button>
          {liga.T[k0] ? <a className="pb-a" href={'#/r/' + encodeURIComponent(k0)}>Ver su perfil</a> : null}</div> : null}
      </div>
    </article>
  );
}

// ── las subidas de rango del día, juntas: cada una con su letra y su 👏 ──
function Rangos({ liga, xs, A, visto }) {
  if (xs.length === 1) return <Post liga={liga} it={xs[0]} A={A} nuevo={visto && utc(xs[0].t) > visto} />;
  return (
    <article className="pb-post grupo rangos">
      <div className="pb-c">
        <span className="pb-cat">Suben de rango · {xs.length}{visto && xs.some((it) => utc(it.t) > visto) ? <i className="pb-nuevo">NUEVO</i> : null}</span>
        <ul className="pb-filas">
          {xs.map((it) => {
            const ks = ksDe(it);
            const n0 = limpio((it.quien || [])[0] || '');
            return (
              <li key={it.id || it.t + n0}>
                <Cara liga={liga} k={ks[0] || ''} nombre={n0} cls="cara pb-fcara" />
                <span className="pb-fn">{ks[0] && liga.T[ks[0]] ? <a href={'#/r/' + encodeURIComponent(ks[0])}>{n0}</a> : <b>{n0}</b>}
                  <small>{it.primero ? 'su primera letra' : 'pasa a rango'}</small></span>
                <span className="pb-rg chico" style={{ background: liga.colorRg(it.rg) }}>{it.rg}</span>
                <Felicitar liga={liga} it={it} A={A} chico />
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

// ── los anuncios de eventos del día, en una agenda: logo, nombre, cómo es y su link ──
function Anuncios({ liga, xs, visto }) {
  if (xs.length === 1) return <Post liga={liga} it={xs[0]} A={null} nuevo={visto && utc(xs[0].t) > visto} />;
  return (
    <article className="pb-post grupo anuncios">
      <div className="pb-c">
        <span className="pb-cat">Eventos anunciados · {xs.length}{visto && xs.some((it) => utc(it.t) > visto) ? <i className="pb-nuevo">NUEVO</i> : null}</span>
        <ul className="pb-filas ag">
          {xs.map((it) => (
            <li key={it.id || it.t + it.ev}>
              <img className="pb-flogo" alt="" src={liga.logo(it.sv)} />
              <span className="pb-fn"><b>{limpio(it.ev)}</b>
                <small>{[hora(it.t), siglaDe(it.sv), it.mod, it.pre ? 'premio: ' + it.pre : ''].filter(Boolean).join(' · ')}</small></span>
              {it.link ? <a className="pb-a" href={it.link} target="_blank" rel="noopener noreferrer" aria-label={'Ver ' + limpio(it.ev) + ' en Discord'}>Discord ↗</a> : null}
            </li>
          ))}
        </ul>
        <div className="pb-acc"><a className="pb-a" href="#/eventos">El calendario</a></div>
      </div>
    </article>
  );
}

// ── lo más felicitado de la semana: barras contra el primero, como el Ranking ──
function MasFelicitado({ liga, pubs, A }) {
  const cu = (it) => Number((it.id && A.cu[it.id]) || 0);
  const top = pubs.filter((it) => LOGROS[it.tipo] && cu(it) > 0).sort((a, b) => cu(b) - cu(a)).slice(0, 5);
  if (!top.length) return null;
  const max = cu(top[0]);
  return (
    <section className="pb-bloque"><h2 className="pb-st">Lo más felicitado<small>esta semana</small></h2>
    <ol className="pb-top">
      {top.map((it) => {
        const k = ksDe(it)[0];
        const quien = (it.quien || []).map(limpio).join(' y ');
        const que = it.tipo === 'campeon' ? limpio(it.ev) : it.tipo === 'rango' ? 'rango ' + it.rg
          : it.tipo === 'pase' || it.tipo === 'sorteo' ? 'Pase de rapero' : it.tipo === 'ligahito' ? limpio(it.ln)
            : it.tipo === 'mesaward' ? 'MES AWARDS' : 'Most Wanted';
        return (
          <li key={it.id}><Cara liga={liga} k={k || ''} nombre={quien} cls="cara pb-top-cara" />
            <span className="pb-top-n"><b>{quien}</b><small>{que}</small>
              <i className="pb-top-b" style={{ width: Math.max(8, Math.round((cu(it) / max) * 100)) + '%' }} /></span>
            <em>👏 {num(cu(it))}</em></li>
        );
      })}
    </ol>
    </section>
  );
}

function Encuestas({ liga, enc }) {
  const x2 = liga.encuesta('x2');
  const el = liga.encuesta('elegido');
  const [cual, setCual] = useState('x2');
  if ((!x2 && !el) || !enc) return null;
  const ver = x2 && el ? cual : (x2 ? 'x2' : 'el');
  return (
    <section className="pb-encs" aria-label="Encuestas">
      <h2 className="pb-st">Encuestas<small>vota antes de que cierren</small></h2>
      {x2 && el ? (
        <div className="pb-enc-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={ver === 'x2'} className={ver === 'x2' ? 'on' : ''} onClick={() => setCual('x2')}>El ×{String(x2.x || 2).replace('.', ',')}</button>
          <button type="button" role="tab" aria-selected={ver === 'el'} className={ver === 'el' ? 'on' : ''} onClick={() => setCual('el')}>El Elegido</button>
        </div>
      ) : null}
      <div className={'pb-enc' + (x2 && el ? ' dos' : '')}>
        {x2 ? <div className={'pb-enc-i x2' + (ver === 'x2' ? ' on' : '')}><X2 liga={liga} enc={enc} E={x2} /></div> : null}
        {el ? <div className={'pb-enc-i' + (ver === 'el' ? ' on' : '')}><Elegido liga={liga} enc={enc} E={el} /></div> : null}
      </div>
    </section>
  );
}

// 🔔 que te llegue cuando te felicitan: se va solo cuando está todo
function Avisame() {
  const e = useCampana();
  const C = window.Campana;
  if (!e || !C || (e.activa && e.yo && e.yo.id)) return null;
  const puede = e.soporta && !e.negado;
  return (
    <section className="pb-bloque">
      <h2 className="pb-st">Que te llegue</h2>
      <p className="pb-tx">Cuando te felicitan, cuando alguien te sigue, cuando la Liga publica algo de quien sigues y cuando te toca pelear: un aviso en este dispositivo. Nunca por DM.</p>
      {!puede ? <a className="pb-a" href="#/avisos">Cómo activarlos</a>
        : !e.activa ? <button type="button" className="btn verde chico pb-avb" onClick={() => C.activar()}><Ico n="campana" t={16} />Activar avisos</button>
          : <button type="button" className="btn borde2 chico pb-avb" onClick={() => C.vincular()}>Vincular con mi Discord</button>}
      {e.msg ? <p className="evp-msg" role="status">{e.msg}</p> : null}
    </section>
  );
}

function Sigo({ liga, sigo, onVer }) {
  const xs = sigo.filter((k) => liga.T[k]);
  if (!xs.length) return null;
  return (
    <section className="pb-bloque">
      <h2 className="pb-st">A quién sigues<small>{xs.length}</small></h2>
      <div className="pb-sigo">
        <ul>{xs.slice(0, 9).map((k) => <li key={k}><a href={'#/r/' + encodeURIComponent(k)} title={limpio(liga.T[k].n)}><Cara liga={liga} k={k} nombre={liga.T[k].n} cls="cara pb-sigo-c" /></a></li>)}
          {xs.length > 9 ? <li className="pb-sigo-mas">+{xs.length - 9}</li> : null}</ul>
        <button type="button" className="pb-a" onClick={onVer}>Ver sólo lo suyo</button>
      </div>
    </section>
  );
}

// 🆕 lo nuevo desde tu última visita: la hora de la publicación más nueva que viste, en este navegador. La primera vez no
// se marca nada (todo sería «nuevo»). Se anota a los 3 s de abrir: si entraste y saliste, sigue siendo nuevo
function useVisto(muro) {
  const [antes] = useState(() => { try { return Number(localStorage.getItem('lg:pub-visto')) || 0; } catch (e) { return 0; } });
  useEffect(() => {
    const max = (muro || []).reduce((m, it) => { const t = utc(it.t); return isNaN(t) ? m : Math.max(m, t); }, 0);
    if (!max) return undefined;
    const id = setTimeout(() => { try { localStorage.setItem('lg:pub-visto', String(max)); } catch (e) { /* sin almacenamiento */ } }, 3000);
    return () => clearTimeout(id);
  }, [muro]);
  return antes;
}

const FILTROS = [['', 'Todo'], ['liga', 'En la Liga'], ['anuncios', 'Anuncios'], ['promos', 'Promos'], ['sigo', '★ A quien sigo']];

export function Publicaciones({ liga, enc }) {
  const A = useAplausos();
  const [fil, setFil] = useState('');
  const [ver, setVer] = useState(40);
  const [votaste] = useState(() => {
    const ab = [liga.encuesta('x2'), liga.encuesta('elegido')].filter(Boolean);
    return ab.length > 0 && ab.every((E) => !!(enc && enc.mio && enc.mio[E.id]));
  });
  const sigo = liga.sigue || [];
  const todos = liga.muro || [];
  const visto = useVisto(todos);
  const pasa = (it, f) => {
    if (f === 'sigo') return ksDe(it).some((k) => sigo.includes(k));
    if (f === 'liga') return !ANUNCIOS[it.tipo] && it.tipo !== 'promo';
    if (f === 'anuncios') return !!ANUNCIOS[it.tipo];
    if (f === 'promos') return it.tipo === 'promo';
    return true;
  };
  const cuenta = useMemo(() => Object.fromEntries(FILTROS.map(([f]) => [f, todos.filter((it) => pasa(it, f)).length])), [todos, sigo]);
  const pubs = useMemo(() => todos.filter((it) => pasa(it, fil)), [todos, fil, sigo]);
  const nuevas = visto ? todos.filter((it) => utc(it.t) > visto).length : 0;
  // por día; en cada día lo que va junto (cartas, rangos, anuncios) en el lugar del primero
  // ✂️ el corte llega hasta el final del último día: cortado a la mitad, el día decía «4 publicaciones» de 24 y sus
  // cartas quedaban partidas (la revisión del remake)
  const fin = useMemo(() => {
    let f = Math.min(ver, pubs.length);
    if (f > 0 && f < pubs.length) { const kU = liga.diaClave(pubs[f - 1].t); while (f < pubs.length && liga.diaClave(pubs[f].t) === kU) f += 1; }
    return f;
  }, [pubs, ver, liga]);
  const dias = useMemo(() => {
    const out = [];
    pubs.slice(0, fin).forEach((it) => {
      const k = liga.diaClave(it.t);
      let d = out[out.length - 1];
      if (!d || d.k !== k) { d = { k, xs: [], g: {}, n: 0 }; out.push(d); }
      d.n += 1;
      if (JUNTOS[it.tipo]) {
        if (!d.g[it.tipo]) { d.g[it.tipo] = { tipo: 'g-' + it.tipo, t: it.t, xs: [] }; d.xs.push(d.g[it.tipo]); }
        d.g[it.tipo].xs.push(it);
      } else d.xs.push(it);
    });
    return out;
  }, [pubs, fin, liga]);
  const hoyK = liga.diaClave(liga.ahora);
  const tituloDia = (k) => {
    if (k === hoyK) return ['Hoy', liga.fechaLarga(k + 'T16:00:00Z') === 'hoy' ? '' : ''];
    const f = liga.fechaLarga(k + 'T16:00:00Z');
    return [f.charAt(0).toUpperCase() + f.slice(1), ''];
  };
  const fechaDe = (k) => {
    const [a, m, d] = k.split('-').map(Number);
    return d + ' de ' + (MESES[m - 1] || '') + (a !== new Date(liga.ahora).getFullYear() ? ' de ' + a : '');
  };
  // 📊 hoy en la Liga (o, si hoy todavía no pasó nada, los últimos siete días): lo que dice la portada
  const deHoy = todos.filter((it) => liga.diaClave(it.t) === hoyK);
  // ⚠️ desde el lunes de la Liga, no siete días para atrás: el martes decía 14 campeones «esta semana» y eran 5
  const estaSemana = todos.filter((it) => utc(it.t) >= liga.desdeLunes());
  const base = deHoy.length ? deHoy : estaSemana;
  const cu = (f) => base.filter(f).length;
  const resumen = [[cu((it) => it.tipo === 'campeon' || (it.tipo === 'ligahito' && it.que === 'campeon')), 'campeón', 'campeones'],
    [cu((it) => it.tipo === 'rango'), 'sube de rango', 'suben de rango'], [cu((it) => it.tipo === 'tarjeta'), 'carta nueva', 'cartas nuevas'],
    [cu((it) => it.tipo === 'anuncio'), 'evento anunciado', 'eventos anunciados']].filter(([n]) => n > 0).map(([n, uno, varios]) => [n, n === 1 ? uno : varios]);
  const semana = estaSemana;
  const encs = fil !== 'anuncios' ? <Encuestas liga={liga} enc={enc} /> : null;
  const masFel = <MasFelicitado liga={liga} pubs={semana} A={A} />;
  const elegir = (f) => { setFil(f); setVer(40); };
  return (
    <>
      <div className="escena pb-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.85 }}>
        <section className="pb-cab">
          <div className="pb-cab-tx">
            <span className="tag">PUBLICACIONES · {liga.temp}</span>
            <h1 className="hero-ev largo">Publicaciones</h1>
            <p className="hero-p">Lo que pasa en la Liga, contado solo, y los anuncios de todos los servidores. Felicita a quien gana: le llega al teléfono.</p>
          </div>
          {resumen.length ? (
            <div className="pb-hoy">
              <small>{deHoy.length ? 'HOY EN LA LIGA' : 'ESTA SEMANA'}</small>
              <dl>{resumen.map(([n, t]) => <div key={t}><dt>{t}</dt><dd>{num(n)}</dd></div>)}</dl>
            </div>
          ) : null}
        </section>
      </div>
      <nav className="pb-fil" aria-label="Qué ver">
        <div className="pb-fil-in">
          {FILTROS.filter(([f]) => !f || cuenta[f] || fil === f).map(([f, t]) => (
            <button type="button" key={f || 'todo'} className={fil === f ? 'on' : ''} aria-pressed={fil === f} onClick={() => elegir(f)}>{t}<em>{num(cuenta[f] || 0)}</em></button>
          ))}
        </div>
      </nav>
      <div className="pb-t2">
        <main className="pb-feed">
          {dias.length ? dias.map((d, n) => {
            const [t] = tituloDia(d.k);
            return (
              <Fragment key={d.k}>
                <section className="pb-dia" aria-label={t}>
                  <h2 className="pb-dh"><b>{t}</b><small>{/^(Hoy|Ayer)$/.test(t) ? fechaDe(d.k) + ' · ' : ''}{d.n === 1 ? '1 publicación' : d.n + ' publicaciones'}</small>
                    {n === 0 && nuevas ? <span className="pb-nuevas"><i aria-hidden="true" />{nuevas === 1 ? '1 nueva' : nuevas + ' nuevas'}</span> : null}</h2>
                  <ol className="pb-riel">
                    {d.xs.map((it, i) => {
                      const tipo = it.tipo.replace(/^g-/, '');
                      const nuevo = !!visto && (it.xs || [it]).some((x) => utc(x.t) > visto);
                      const cuerpo = it.tipo === 'g-tarjeta' ? <Cartas liga={liga} xs={it.xs} nuevo={nuevo} />
                        : it.tipo === 'g-rango' ? <Rangos liga={liga} xs={it.xs} A={A} visto={visto} />
                          : it.tipo === 'g-anuncio' ? <Anuncios liga={liga} xs={it.xs} visto={visto} />
                            : it.tipo === 'g-crewtier' ? <Tiers liga={liga} xs={it.xs} visto={visto} />
                              : <Post liga={liga} it={it} A={A} nuevo={nuevo} />;
                      // los que van juntos, con la hora del más nuevo y la del más viejo
                      const xs = it.xs || [it];
                      const h1 = hora(xs[0].t);
                      const h2 = xs.length > 1 ? hora(xs[xs.length - 1].t) : '';
                      return (
                        <li key={(it.id || it.tipo + it.t) + i} className={'pb-i c-' + (COLOR[tipo] || 'n') + (nuevo ? ' nuevo' : '') + (fuerte(it) ? ' f' : '')}>
                          <span className="pb-hora">{h1}{h2 && h2 !== h1 ? <small>{h2}</small> : null}</span>
                          {cuerpo}
                        </li>
                      );
                    })}
                  </ol>
                </section>
                {n === 0 ? <div className="pb-solo-cel">{masFel}</div> : null}
                {n === 0 && !votaste ? encs : null}
              </Fragment>
            );
          }) : (
            <>
              {fil === 'sigo'
                ? <Vacio titulo="Nada todavía de la gente que sigues" texto="Cuando ganen, suban de rango o saquen carta, aparece acá."
                  acciones={[['Ver el ranking y seguir a alguien', '#/ranking'], ['Ver todo', () => elegir(''), 'borde2']]} />
                : !liga.muroListo ? <MuroCargando />
                  : <Vacio titulo="Todavía no pasó nada" texto="Cuando se juegue el primer evento, aparece acá solo."
                    acciones={[['Ver los eventos', '#/eventos']]} />}
              {!votaste ? encs : null}
            </>
          )}
          {pubs.length > fin ? <button type="button" className="btn borde2 chico pb-mas-b" onClick={() => setVer(fin + 40)}>Ver más · quedan {num(pubs.length - fin)}</button> : null}
          {votaste ? encs : null}
        </main>
        <aside className="pb-der">
          <div className="pb-der-in">
            <div className="pb-solo-compu">{masFel}</div>
            {fil === 'promos' ? (
              <section className="pb-bloque pb-promo-paga">
                <h2 className="pb-st">Las promos</h2>
                <p className="pb-tx">Lo que comparten los raperos en el canal de promoción de su servidor, y los videos de nuestros participantes que
                  promociona la Liga. Cada promo está una semana (la tuya la puedes alargar en la <a href="#/tienda">Tienda</a>). Ábrelas con tu
                  cuenta de Discord: cada una te da <b>50 Puntos de Tienda</b> (hasta 3 por día) y suma a tu Pase.</p>
              </section>
            ) : null}
            <Sigo liga={liga} sigo={sigo} onVer={() => elegir('sigo')} />
            <Avisame />
          </div>
        </aside>
      </div>
    </>
  );
}
