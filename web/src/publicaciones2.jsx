// 📰 PUBLICACIONES. La página de hoy es la del 15/11/2026 (más abajo, «EL MURO, CON LAS PIEZAS DEL INICIO»); lo que sigue es
// del primer remake (02/11/2026) y vale para lo que se quedó: qué dice cada publicación y qué se felicita.
// PUBLICACIONES, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes… tómate tu tiempo… haz research».
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
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { MESES, hora, ksDe, limpio, num, siglaDe, utc } from './liga.js';
import { CrewCirculo, escenaDe } from './arriba.jsx';
import { TierChip } from './crewpanel.jsx';
import { Cara, Carta, Ico, Vacio, accion, promoAbierta, useCampana } from './piezas.jsx';
import { Miniatura, abrirVideo } from './video.jsx';
import { Elegido, X2 } from './encuestas.jsx';
import { useAplausos } from './aplausos.js';
import { Hilo, delHilo, useComentarios } from './comentarios.jsx';
import { LuNube, LuSocial } from './medio.jsx';
import { usePase, usePases } from './pase.js';
import { SelloPremium, esPremium } from './sello.jsx';
import { PopCab } from './pop.jsx';
import { QuienGana } from './quiengana.jsx';
import { PLATAFORMA } from './publicaciones.jsx';
import CSS_PAGINA from './css/publicaciones2.css?inline';
import { usarCss } from './css.js';

usarCss('publicaciones2', CSS_PAGINA);

const ANUNCIOS = { anuncio: 1, liga: 1, flyer: 1 };
const LOGROS = { campeon: 1, rango: 1, caza: 1, sobrevivio: 1, pase: 1, sorteo: 1, ligahito: 1, mesaward: 1 };
const MES_CAT = { rapero: 'el Rapero del mes', revelacion: 'la Revelación del mes', batalla: 'la Batalla del mes', servidor: 'el Servidor del mes' };
// 🎨 de qué color es el punto del riel: lo que se ganó (verde), el Most Wanted y la plata (magenta), los avisos (negro)
const COLOR = { campeon: 'v', ligahito: 'v', mesaward: 'v', pase: 'v', sorteo: 'v', crewtier: 'v', tarjeta: 'v', rango: 'v',
  caza: 'm', sobrevivio: 'm', precio: 'm', elegido: 'm', premios: 'm' };
// 📦 lo que va en caja con su sombra: lo que es noticia (un campeón, el Most Wanted, un MES AWARD). Lo demás, en renglón
// (la revisión del remake: «si todo es una caja, nada se ve primero»)
const fuerte = (it) => it.tipo === 'campeon' || it.tipo === 'mesaward' || it.tipo === 'caza' || it.tipo === 'sobrevivio'
  || it.tipo === 'precio' || it.tipo === 'elegido' || it.tipo === 'resnoche' || (it.tipo === 'ligahito' && it.que === 'campeon');

// 🌙 un nombre del resumen de la noche, con link a su perfil si está en la temporada (las claves van en cada renglón,
// no en `ks`: ver `muro.noches()`)
// 💎 `pub` (lo público del Pase): con el premium, el sello al lado del nombre
function Nombre({ liga, x, pub }) {
  const n = limpio(x && x.n);
  if (!(x && x.k && liga.T[x.k])) return <b>{n}</b>;
  return <><a href={'#/r/' + encodeURIComponent(x.k)}>{n}</a>{esPremium(pub, x.k) ? <SelloPremium t={13} cls="sp-prem-in" /> : null}</>;
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

// los nombres de una publicación, con link a su perfil si está en la temporada (y el sello Premium de quien lo tenga)
function nombresDe(liga, it, pub) {
  const q = (it.quien || []).map(limpio);
  const ks = Array.isArray(it.ks) ? it.ks : [];
  return q.map((n, i) => (ks[i] && liga.T[ks[i]]
    ? <Fragment key={i}><a href={'#/r/' + encodeURIComponent(ks[i])}>{n}</a>{esPremium(pub, ks[i]) ? <SelloPremium t={13} cls="sp-prem-in" /> : null}</Fragment>
    : <b key={i}>{n}</b>))
    .reduce((acc, x, i) => (i ? acc.concat([i === q.length - 1 ? ' y ' : ', ', x]) : [x]), []);
}

// ── qué dice cada publicación: la categoría, lo que se ve, el texto, el detalle y adónde lleva (lo de publicaciones.jsx,
// con el dibujo nuevo). `media`: la imagen va arriba y grande (video, flyer) ──
function contenido(liga, it, pub) {
  const q = (it.quien || []).map(limpio);
  const ks = Array.isArray(it.ks) ? it.ks : [];
  const nombres = nombresDe(liga, it, pub);
  const f0 = ks[0] ? liga.T[ks[0]] : null;
  const cara = <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls={'cara pb-cara' + (esPremium(pub, ks[0]) ? ' sp-prem-aro' : '')} />;
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
      <Fragment key={i}>{y((e.quien || []).map(([n, k], j) => <Nombre key={j} liga={liga} x={{ n, k }} pub={pub} />))} ganó <b>{limpio(e.ev)}</b></Fragment>));
    const mas = (it.campeones || []).length - cs.length;
    c.txt = <>{it.eventos} {it.eventos === 1 ? 'evento' : 'eventos'} y {num(it.part)} {it.part === 1 ? 'participación' : 'participaciones'}.{' '}
      {cs.reduce((acc, x, i) => (i ? acc.concat(['; ', x]) : [x]), [])}{mas > 0 ? <>, y {mas} más</> : null}{cs.length ? '.' : ''}</>;
    const partes = [];
    if ((it.suman || []).length) partes.push(<Fragment key="s">Más puntos: {y(it.suman.map((x, i) => <Fragment key={i}><Nombre liga={liga} x={x} pub={pub} /> +{num(x.pts)}</Fragment>))}</Fragment>);
    if ((it.suben || []).length) partes.push(<Fragment key="u">Subieron: {y(it.suben.map((x, i) => <Fragment key={i}><Nombre liga={liga} x={x} pub={pub} /> #{x.de} → #{x.a}</Fragment>))}</Fragment>);
    if ((it.sorpresas || []).length) partes.push(<Fragment key="p">Sorpresa: {y(it.sorpresas.map((x, i) => <Fragment key={i}><Nombre liga={liga} x={x} pub={pub} />{x.que === 'debut' ? ' ganó en su primer evento' : ' ganó su primer título' + (x.desde ? ' (venía #' + x.desde + ')' : '')}</Fragment>))}</Fragment>);
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

// ── las crews que suben de tier el mismo lunes: una lista, con el tier como pastilla (su color de fondo y la letra que se lee) ──
function Tiers({ liga, xs, visto, A, P }) {
  const T = liga.d.crews_tiers && liga.d.crews_tiers.nombres ? liga.d.crews_tiers : null;
  if (xs.length === 1 || !T) return <>{xs.map((it) => <Fila key={it.t + it.crew} liga={liga} it={it} A={A} P={P} nuevo={!!visto && utc(it.t) > visto} />)}</>;
  return (
    <article className="pw-f c-v">
      <span className="pw-v"><img className="pw-logo" alt="" src="/ul.png" /></span>
      <div className="pw-tx">
        <span className="pw-cat">Crews que suben de tier · {xs.length}{visto && xs.some((it) => utc(it.t) > visto) ? <i className="pb-nuevo">NUEVO</i> : null}</span>
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

// ══ EL MURO, CON LAS PIEZAS DEL INICIO (15/11/2026, la A de la maqueta https://claude.ai/artifact/XV2NH3RQUnvKMNZH3V6CLK; Dlx:
// «Obviamente la A») ════════════════════════════════════════════════════════════════════════════════════════════════════
// Medido antes en vivo: 9.162 px de alto en la compu y 11.775 en el celular, casi todo por los comentarios abiertos debajo de
// cada publicación. Ahora cada pieza es una que el Inicio ya tiene:
// - ARRIBA, EL ESCENARIO: lo más fuerte de estos días (campeón, caza, la noche, MES AWARDS) con la escena de su servidor
//   (`escenaDe()`, las mismas de arriba.jsx), su carta, Felicitar y la tira para pasar a los otros (8 s, quieto con el mouse).
// - LOS CÍRCULOS DE LAS HISTORIAS son los servidores: tocar uno filtra; el aro verde, si trae algo desde tu última visita.
// - EL BUSCADOR Y LOS CHIPS DE LA CAMPANA, pegados arriba, con cuántas hay de cada cosa.
// - LAS FILAS DE LO ÚLTIMO: lo fuerte grande y con Felicitar; lo demás en renglón; los del mismo día, juntos (cartas en
//   abanico, rangos en fila, anuncios en lista). Las reacciones y la nube son las de Lo último (`LuSocial`, `LuNube`).
// - LOS COMENTARIOS YA NO VAN ABIERTOS: la nube con el último y «💬 N», que abre la hoja (`#/publicaciones/<id>`, el mismo
//   link de la campana y de Lo último).
// - EL DÍA MÁS NUEVO, ENTERO; los anteriores en una caja (sus campeones en miniatura y cuántas hubo de cada cosa) que se
//   abre. Con un filtro, la búsqueda o un servidor elegido, todo entero: ahí la lista ya es corta.
// - AL COSTADO, los minis del panel (tocar uno filtra), lo más felicitado, las encuestas en corto y la campana. En el
//   celular los minis se deslizan arriba y lo demás va después del primer día.
const GRUPOS = { tarjeta: 1, rango: 1, anuncio: 1, crewtier: 1 };
const TIPOS = {
  campeones: ['campeon', 'resnoche', 'ligahito'], rangos: ['rango'], cartas: ['tarjeta'], pase: ['pase', 'sorteo'],
  mw: ['caza', 'precio', 'sobrevivio', 'elegido', 'premios'], mes: ['mesaward'], crews: ['crewtier'], anuncios: ['anuncio', 'flyer', 'liga'], promos: ['promo'],
};
const FILTROS2 = [['', 'Todo'], ['campeones', 'Campeones'], ['rangos', 'Rangos'], ['cartas', 'Cartas'], ['pase', 'Pase'], ['mw', 'Most Wanted'],
  ['mes', 'MES AWARDS'], ['crews', 'Crews'], ['anuncios', 'Anuncios'], ['promos', 'Promos']];
const hace = (liga, t) => { const c = liga.cuando(t); return c ? c.charAt(0).toUpperCase() + c.slice(1) : ''; };
// el título en texto llano, para el escenario y los resúmenes
function plano(liga, it) {
  const q = (it.quien || []).map(limpio);
  const quien = q.length > 2 ? q.slice(0, -1).join(', ') + ' y ' + q[q.length - 1] : q.join(' y ');
  const varios = q.length > 1;
  if (it.tipo === 'campeon') return quien + (varios ? ' se quedan con ' : ' se queda con ') + limpio(it.ev);
  if (it.tipo === 'caza') return quien + (varios ? ' cazaron a ' : ' cazó a ') + limpio(it.a) + ' y ' + (varios ? 'cobran ' : 'cobra ') + num(it.pts);
  if (it.tipo === 'precio') return quien + (varios ? ' le ganaron a ' : ' le ganó a ') + limpio(it.a) + ' y ' + (varios ? 'cobran ' : 'cobra ') + num(it.pts);
  if (it.tipo === 'sobrevivio') return quien + ' sobrevivió al Most Wanted';
  if (it.tipo === 'elegido') return quien + ' es El Elegido';
  if (it.tipo === 'resnoche') return it.eventos + (it.eventos === 1 ? ' evento y ' : ' eventos y ') + num(it.part) + ' participaciones';
  if (it.tipo === 'ligahito') return it.que === 'campeon' ? quien + ' es el campeón de ' + limpio(it.ln) : quien + ' en ' + limpio(it.ln);
  if (it.tipo === 'mesaward') return it.n ? limpio(it.n) + ' · MES AWARDS' : (quien || 'Los ganadores') + ' · MES AWARDS';
  const x = liga.itemMuro(it);
  return x ? x[1] : quien;
}
// la carta de alguien, si tiene: la Competitiva primero (es la del rango), si no la de Temporada
function cartaDe(liga, k) {
  const f = k ? liga.T[k] : null;
  const c = (f && f.c) || [];
  return c.includes('competitivo') ? 'competitivo' : c.includes('temporada') ? 'temporada' : '';
}

// ── arriba: el escenario, con lo más fuerte de estos días ──
function Escenario({ liga, xs, A }) {
  const pub = usePases();
  const [i, setI] = useState(0);
  const [quieto, setQuieto] = useState(false);
  useEffect(() => {
    if (quieto || xs.length < 2) return undefined;
    let calma = false;
    try { calma = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { calma = false; }
    if (calma) return undefined;
    const t = setInterval(() => setI((v) => (v + 1) % xs.length), 8000);
    return () => clearInterval(t);
  }, [quieto, xs.length]);
  if (!xs.length) return null;
  const it = xs[Math.min(i, xs.length - 1)];
  const c = contenido(liga, it, pub);
  if (!c) return null;
  const k = ksDe(it)[0];
  const cual = cartaDe(liga, k);
  const sv = liga.svDe(it);
  const fondo = escenaDe(sv);
  const vis = cual ? <Carta liga={liga} k={k} cual={cual} cls="pw-esc-carta" abre={false} />
    : <img className="pw-esc-logo" alt="" src={sv ? liga.logo(sv, true) : '/ul.png'} />;
  const tono = COLOR[it.tipo] === 'm' ? 'm' : 'v';
  return (
    <section data-tuto="pb-cab" className={'pw-esc' + (fondo ? ' con-fondo' : '')} style={fondo ? { backgroundImage: 'url("' + fondo + '")' } : undefined}
      onMouseEnter={() => setQuieto(true)} onMouseLeave={() => setQuieto(false)} onFocus={() => setQuieto(true)} aria-label="Lo más fuerte de estos días">
      <div className="pw-esc-in">
        <div className="pw-esc-tx">
          <div className="pw-esc-k">
            <span className={'pw-chip ' + tono}>{sv ? <img alt="" src={liga.logo(sv)} /> : null}{c.cat}</span>
            <span className="pw-chip n">{hace(liga, it.t)}</span>
          </div>
          <h1 className="pw-grito">{plano(liga, it)}</h1>
          {c.det ? <p className="pw-esc-sub">{c.det}</p> : null}
          <div className="pw-esc-acc">{LOGROS[it.tipo] ? <Felicitar liga={liga} it={it} A={A} /> : null}{c.acc}
            {it.id ? <a className="pb-a" href={'#/publicaciones/' + it.id}>💬 Comentar</a> : null}</div>
        </div>
        <div className="pw-esc-vis">{vis}</div>
      </div>
      {xs.length > 1 ? (
        <div className="pw-tira" role="tablist" aria-label="Lo más fuerte">
          {xs.map((x, j) => {
            const kx = ksDe(x)[0];
            const svx = liga.svDe(x);
            const cx = contenido(liga, x, pub);
            return (
              <button type="button" role="tab" aria-selected={j === i} key={x.id || x.t + j} className={j === i ? 'on' : ''} onClick={() => { setI(j); setQuieto(true); }}>
                {kx && liga.T[kx] ? <Cara liga={liga} k={kx} nombre={liga.T[kx].n} cls="cara pw-tira-c" /> : <img className="pw-tira-c" alt="" src={svx ? liga.logo(svx) : '/ul.png'} />}
                <span><b>{plano(liga, x)}</b><small>{cx ? cx.cat : ''}</small></span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

// ── los círculos de las historias: cada servidor es un filtro ──
function Circulos({ liga, todos, sv, setSv, sigo, visto }) {
  const cnt = {};
  const nuevo = {};
  todos.forEach((it) => {
    const s = liga.svDe(it);
    if (!s) return;
    cnt[s] = (cnt[s] || 0) + 1;
    if (visto && utc(it.t) > visto) nuevo[s] = 1;
  });
  const svs = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  const sigoN = todos.filter((it) => ksDe(it).some((k) => sigo.includes(k))).length;
  return (
    <nav className="pw-circ" aria-label="Por servidor">
      <button type="button" className={sv ? '' : 'on'} aria-pressed={!sv} onClick={() => setSv('')}>
        <span className="pw-aro"><img alt="" src="/ul.png" /></span><small>Todo</small></button>
      {sigoN ? <button type="button" className={sv === 'sigo' ? 'on' : ''} aria-pressed={sv === 'sigo'} onClick={() => setSv(sv === 'sigo' ? '' : 'sigo')}>
        <span className="pw-aro ico" aria-hidden="true">★</span><small>A quien sigo</small></button> : null}
      {svs.map((s) => (
        <button type="button" key={s} className={sv === s ? 'on' : ''} aria-pressed={sv === s} onClick={() => setSv(sv === s ? '' : s)}
          aria-label={siglaDe(s) + ': ' + cnt[s] + ' publicaciones'}>
          <span className={'pw-aro' + (nuevo[s] ? ' nuevo' : '')}><img alt="" src={liga.logo(s)} /><em>{cnt[s]}</em></span><small>{siglaDe(s)}</small>
        </button>
      ))}
    </nav>
  );
}

// ── los del mismo día, juntos ──
function CartasG({ liga, xs, nuevo }) {
  const vistos = new Set();
  const us = xs.filter((it) => { const k = (it.ks || [])[0]; if (!k || vistos.has(k + it.carta)) return false; vistos.add(k + it.carta); return true; });
  if (!us.length) return null;
  const nombres = [...new Set(us.map((it) => limpio((it.quien || [])[0] || '')))];
  return (
    <article className={'pw-f c-v' + (nuevo ? ' nueva' : '')}>
      <span className="pw-v"><img className="pw-logo" alt="" src="/ul.png" /></span>
      <div className="pw-tx">
        <span className="pw-cat">{us.length === 1 ? 'Carta nueva' : 'Cartas nuevas · ' + us.length}</span>
        <p className="pw-t"><b>{nombres.slice(0, 3).join(', ')}</b>{nombres.length > 3 ? ' y ' + (nombres.length - 3) + ' más' : ''}{nombres.length > 1 ? ' ya tienen su carta' : ' ya tiene su carta'}</p>
        <div className="pw-abanico">
          {us.slice(0, 12).map((it) => {
            const k = (it.ks || [])[0];
            return <button type="button" key={k + it.carta} onClick={() => accion.carta(k, it.carta)} aria-label={'La carta de ' + limpio((it.quien || [])[0] || '')}>
              <Carta liga={liga} k={k} cual={it.carta} cls="pw-mcarta" abre={false} /></button>;
          })}
          {us.length > 12 ? <span className="pw-mas">+{us.length - 12}</span> : null}
        </div>
      </div>
      <span className="pw-der"><time>{hace(liga, xs[0].t)}</time></span>
    </article>
  );
}
function RangosG({ liga, xs, nuevo }) {
  const pub = usePases();
  return (
    <article className={'pw-f c-v' + (nuevo ? ' nueva' : '')}>
      <span className="pw-v"><img className="pw-logo" alt="" src="/ul.png" /></span>
      <div className="pw-tx">
        <span className="pw-cat">Suben de rango · {xs.length}</span>
        <div className="pw-rngs">
          {xs.map((it) => {
            const k = ksDe(it)[0] || '';
            const n0 = limpio((it.quien || [])[0] || '');
            return (
              <a key={it.id || it.t + n0} href={'#/publicaciones/' + (it.id || '')} data-pub={it.id || undefined} aria-label={n0 + ': rango ' + it.rg + '. Felicitar o comentar'}>
                <Cara liga={liga} k={k} nombre={n0} cls={'cara pw-rng-c' + (esPremium(pub, k) ? ' sp-prem-aro' : '')} />
                <i className="pw-letra" style={{ background: liga.colorRg(it.rg) }}>{it.rg}</i>
                <small>{n0}</small>
              </a>
            );
          })}
        </div>
        <small className="pw-det">Toca a uno para felicitarlo o dejarle un comentario.</small>
      </div>
      <span className="pw-der"><time>{hace(liga, xs[0].t)}</time></span>
    </article>
  );
}
function AnunciosG({ liga, xs, nuevo }) {
  return (
    <article className={'pw-f c-a' + (nuevo ? ' nueva' : '')}>
      <span className="pw-v"><img className="pw-logo" alt="" src="/ul.png" /></span>
      <div className="pw-tx">
        <span className="pw-cat">Eventos anunciados · {xs.length}</span>
        <ul className="pw-anl">
          {xs.map((it) => {
            const n = delHilo(it, Date.now()).length;
            return (
              <li key={it.id || it.t + it.ev} data-pub={it.id || undefined}>
                <img alt="" src={liga.logo(it.sv)} />
                <span><b>{limpio(it.ev)}</b><small>{[siglaDe(it.sv), hora(it.t), it.mod, it.pre ? 'premio: ' + it.pre : ''].filter(Boolean).join(' · ')}</small></span>
                {it.id ? <a className="pw-anl-cm" href={'#/publicaciones/' + it.id} aria-label={n ? n + ' comentarios' : 'Comentar'}>💬{n ? ' ' + n : ''}</a> : null}
                {it.link ? <a className="pb-a" href={it.link} target="_blank" rel="noopener noreferrer" aria-label={'Ver ' + limpio(it.ev) + ' en Discord'}>Discord ↗</a> : null}
              </li>
            );
          })}
        </ul>
        <div className="pw-acc"><a className="pb-a" href="#/eventos">El calendario</a></div>
      </div>
      <span className="pw-der"><time>{hace(liga, xs[0].t)}</time></span>
    </article>
  );
}

// ── una publicación: la fuerte grande (como la destacada de Lo último), lo demás en renglón ──
function Fila({ liga, it, A, P, nuevo }) {
  const pub = usePases();
  const c = contenido(liga, it, pub);
  if (!c) return null;
  const hilo = it.id ? delHilo(it, Date.now()) : [];
  const logro = !!LOGROS[it.tipo];
  const tono = 'c-' + (COLOR[it.tipo] || (ANUNCIOS[it.tipo] ? 'a' : 'n'));
  const social = it.id && it.tipo !== 'flyer' ? <><LuSocial liga={liga} it={it} A={A} hilo={hilo} P={P} /><LuNube liga={liga} it={it} hilo={hilo} /></> : null;
  if (fuerte(it)) {
    const k = ksDe(it)[0];
    const cual = cartaDe(liga, k);
    const sv = liga.svDe(it);
    return (
      <article className={'pw-f fuerte ' + tono + (nuevo ? ' nueva' : '')} data-pub={it.id || undefined}>
        <span className="pw-fu-v">
          {cual ? <Carta liga={liga} k={k} cual={cual} cls="pw-fu-carta" abre={false} /> : c.vis}
          {sv && !cual ? null : sv ? <img className="pw-fu-logo" alt="" src={liga.logo(sv)} /> : null}
        </span>
        <div className="pw-tx">
          <div className="pw-top"><span className="pw-cat">{c.cat}</span><time>{hace(liga, it.t)}</time></div>
          {/* 🌙 la noche: el título corto en grande y la lista de campeones debajo (en Anton, la lista entera era un bloque) */}
          <p className="pw-fu-t">{it.tipo === 'resnoche' ? plano(liga, it) : c.txt}</p>
          {it.tipo === 'resnoche' ? <p className="pw-t chico">{c.txt}</p> : null}
          {c.det ? <small className="pw-det">{c.det}</small> : null}
          {logro || c.acc ? <div className="pw-acc">{logro ? <Felicitar liga={liga} it={it} A={A} /> : null}{c.acc}</div> : null}
          {social}
        </div>
      </article>
    );
  }
  return (
    <article className={'pw-f ' + tono + (c.media ? ' media' : '') + (nuevo ? ' nueva' : '')} data-pub={it.id || undefined}>
      <span className="pw-v">{c.media ? <img className="pw-logo" alt="" src={it.sv ? liga.logo(it.sv) : '/ul.png'} /> : c.vis}</span>
      <div className="pw-tx">
        <span className="pw-cat">{c.cat}</span>
        <p className="pw-t">{c.txt}</p>
        {c.det ? <small className="pw-det">{c.det}</small> : null}
        {c.media ? <div className="pw-media">{c.vis}</div> : null}
        {c.acc || (logro && it.tipo !== 'rango') ? <div className="pw-acc">{logro ? <Felicitar liga={liga} it={it} A={A} /> : null}{c.acc}</div> : null}
        {social}
      </div>
      <span className="pw-der"><time>{hace(liga, it.t)}</time>
        {it.tipo === 'rango' ? <i className="pw-letra grande" style={{ background: liga.colorRg(it.rg) }} aria-label={'Rango ' + it.rg}>{it.rg}</i> : null}
        {it.tipo === 'pase' && it.nivel ? <i className="pw-nivel" aria-label={'Nivel ' + it.nivel}>{it.nivel}</i> : null}</span>
    </article>
  );
}

// ── un día de antes, cerrado: sus campeones y cazas en miniatura y cuántas hubo de cada cosa ──
const NOMBRE_T = { campeon: ['campeón', 'campeones'], rango: ['rango', 'rangos'], tarjeta: ['carta', 'cartas'], pase: ['del Pase', 'del Pase'],
  anuncio: ['anuncio', 'anuncios'], caza: ['caza', 'cazas'], precio: ['precio', 'precios'], promo: ['promo', 'promos'], flyer: ['de ligas', 'de ligas'],
  ligahito: ['de ligas', 'de ligas'], mesaward: ['MES AWARDS', 'MES AWARDS'], crewtier: ['crew', 'crews'], resnoche: ['resumen', 'resúmenes'] };
function ResumenDia({ liga, xs, abrir }) {
  const top = xs.filter((it) => it.tipo === 'campeon' || it.tipo === 'caza' || it.tipo === 'precio' || (it.tipo === 'ligahito' && it.que === 'campeon')).slice(0, 10);
  const c = {};
  xs.forEach((it) => { c[it.tipo] = (c[it.tipo] || 0) + 1; });
  return (
    <div className="pw-res">
      {top.length ? (
        <div className="pw-res-c">
          {top.map((it) => {
            const k = ksDe(it)[0];
            const cual = cartaDe(liga, k);
            const n0 = limpio((it.quien || [])[0] || '');
            return (
              <a key={it.id || it.t} href={'#/publicaciones/' + (it.id || '')}>
                {cual ? <Carta liga={liga} k={k} cual={cual} cls="pw-res-carta" abre={false} /> : <Cara liga={liga} k={k || ''} nombre={n0} cls="cara pw-res-cara" />}
                <small>{n0}</small><small className="g">{it.tipo === 'campeon' ? siglaDe(it.sv) : it.tipo === 'ligahito' ? 'liga' : 'Most Wanted'}</small>
              </a>
            );
          })}
        </div>
      ) : null}
      <div className="pw-res-n">{Object.entries(c).map(([t, n]) => <span key={t}><b>{n}</b>{(NOMBRE_T[t] || [t, t])[n === 1 ? 0 : 1]}</span>)}</div>
      <button type="button" className="btn borde2 chico" onClick={abrir}>Ver el día</button>
    </div>
  );
}

// ── los minis del panel: lo de esta semana; tocar uno filtra ──
function Minis({ liga, todos, setFil, desliza }) {
  const sem = todos.filter((it) => utc(it.t) >= liga.desdeLunes());
  const n = (ts) => sem.filter((it) => ts.includes(it.tipo)).length;
  const xs = [['campeones', 'Campeones', n(['campeon']), 'v'], ['rangos', 'Suben de rango', n(['rango']), 'o'], ['cartas', 'Cartas nuevas', n(['tarjeta']), 'p'],
    ['anuncios', 'Eventos anunciados', n(['anuncio']), 'a']];
  return (
    <div className={'pw-minis' + (desliza ? ' desl' : '')}>
      {xs.map(([f, t, v, c]) => (
        <button type="button" key={f} className={'pw-mini ' + c} onClick={() => setFil(f)}><span>{t}</span><b>{num(v)}</b><small>esta semana</small></button>
      ))}
    </div>
  );
}

// ── las encuestas, cortas, al costado (abiertas, la grilla del ×2 ocupaba media pantalla) ──
function EncCortas({ liga, enc }) {
  const x2 = liga.encuesta('x2');
  const el = liga.encuesta('elegido');
  if ((!x2 && !el) || !enc) return null;
  return (
    <section data-tuto="pb-encs" className="pb-bloque pw-encs" aria-label="Encuestas">
      <h2 className="pb-st">Encuestas<small>vota antes de que cierren</small></h2>
      {x2 ? <X2 liga={liga} enc={enc} E={x2} corta /> : null}
      {el ? <Elegido liga={liga} enc={enc} E={el} corta /> : null}
    </section>
  );
}

// ── la hoja de una publicación: lo suyo arriba y el hilo entero (`Hilo` se abre solo con `__pubFoco`) ──
function Hoja({ liga, it, A, P }) {
  const pub = usePases();
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
  }, [it && it.id]);
  if (!it) return null;
  const c = contenido(liga, it, pub);
  if (!c) return null;
  const cerrar = () => { if (ref.current && ref.current.open) ref.current.close(); };
  const hilo = delHilo(it, Date.now());
  return (
    <dialog ref={ref} className="pn-pop pw-hoja" aria-label={c.cat} onClose={() => { location.hash = '#/publicaciones'; }}
      onClick={(e) => { if (e.target === ref.current) cerrar(); }}>
      <PopCab ico="globo" t={c.cat} sub={hace(liga, it.t)} cerrar={cerrar} />
      <div className="pw-hoja-in">
        <div className="pw-hoja-p">
          {c.media ? null : <span className="pw-v">{c.vis}</span>}
          <div className="pw-tx"><p className="pw-t">{c.txt}</p>{c.det ? <small className="pw-det">{c.det}</small> : null}
            {c.media ? <div className="pw-media">{c.vis}</div> : null}
            <div className="pw-acc">{LOGROS[it.tipo] ? <Felicitar liga={liga} it={it} A={A} /> : null}{c.acc}</div>
            {it.id ? <LuSocial liga={liga} it={it} A={A} hilo={hilo} P={P} /> : null}</div>
        </div>
        <Hilo liga={liga} it={it} />
      </div>
    </dialog>
  );
}

export function Publicaciones({ liga, enc, foco = '' }) {
  const A = useAplausos();
  useComentarios();
  const P = usePase(typeof window !== 'undefined' && !!window.DC);
  // 🎯 LA PUBLICACIÓN EXACTA (`#/publicaciones/<id>`): la de la campana, la de «💬» y la de Lo último. Abre la hoja, y su hilo
  // se abre solo (`Hilo` lee `W.__pubFoco`)
  const idFoco = /^[0-9a-f]{12}$/.test(foco) ? foco : '';
  if (typeof window !== 'undefined') window.__pubFoco = idFoco;
  const [fil, setFil0] = useState('');
  const [sv, setSv0] = useState('');
  const [q, setQ] = useState('');
  const [dias, setDias] = useState(4);
  const [abiertos, setAbiertos] = useState({});
  const sigo = liga.sigue || [];
  const todos = liga.muroLimpio();
  const visto = useVisto(todos);
  const barra = useRef(null);
  const subir = () => { const b = barra.current; if (b && b.getBoundingClientRect().top < 0) b.scrollIntoView({ block: 'start' }); };
  const setFil = (f) => { setFil0(f); setDias(4); subir(); };
  const setSv = (s) => { setSv0(s); setDias(4); };
  const qn = limpio(q).toLowerCase();
  const pasaSv = (it) => (!sv ? true : sv === 'sigo' ? ksDe(it).some((k) => sigo.includes(k)) : liga.svDe(it) === sv);
  const pasaQ = (it) => {
    if (!qn) return true;
    const txt = [...(it.quien || []), it.ev, it.tit, it.ln, it.a, it.n, siglaDe(liga.svDe(it))].filter(Boolean).map((x) => limpio(x).toLowerCase()).join(' ');
    return txt.includes(qn);
  };
  const base = useMemo(() => todos.filter((it) => pasaSv(it) && pasaQ(it)), [todos, sv, qn, sigo]); // eslint-disable-line react-hooks/exhaustive-deps
  const cuenta = useMemo(() => Object.fromEntries(FILTROS2.map(([f]) => [f, f ? base.filter((it) => TIPOS[f].includes(it.tipo)).length : base.length])), [base]);
  const pubs = useMemo(() => (fil ? base.filter((it) => TIPOS[fil].includes(it.tipo)) : base), [base, fil]);
  const enteros = !!(fil || sv || qn);
  // por día; en cada día los que van juntos en el lugar del primero
  const porDia = useMemo(() => {
    const out = [];
    pubs.forEach((it) => {
      const k = liga.diaClave(it.t);
      let d = out[out.length - 1];
      if (!d || d.k !== k) { d = { k, todos: [], xs: [], g: {} }; out.push(d); }
      d.todos.push(it);
      if (GRUPOS[it.tipo] && pubs.filter((o) => o.tipo === it.tipo && liga.diaClave(o.t) === k).length > 1) {
        if (!d.g[it.tipo]) { d.g[it.tipo] = { tipo: 'g-' + it.tipo, t: it.t, xs: [] }; d.xs.push(d.g[it.tipo]); }
        d.g[it.tipo].xs.push(it);
      } else d.xs.push(it);
    });
    return out;
  }, [pubs, liga]);
  // lo de arriba: lo más fuerte de los últimos tres días, hasta cuatro
  const destacadas = useMemo(() => {
    const desde = liga.ahora - 3 * 86400000;
    return todos.filter((it) => fuerte(it) && utc(it.t) >= desde).slice(0, 4);
  }, [todos, liga]);
  const foco0 = idFoco ? todos.find((it) => it.id === idFoco) : null;
  const hoyK = liga.diaClave(liga.ahora);
  const titulo = (k) => {
    if (k === hoyK) return 'Hoy';
    const f = liga.fechaLarga(k + 'T16:00:00Z');
    return f.charAt(0).toUpperCase() + f.slice(1);
  };
  const fecha = (k) => { const [, m, d] = k.split('-').map(Number); return d + ' de ' + (MESES[m - 1] || ''); };
  const nuevas = visto ? todos.filter((it) => utc(it.t) > visto).length : 0;
  const masFel = <MasFelicitado liga={liga} pubs={todos.filter((it) => utc(it.t) >= liga.desdeLunes())} A={A} />;
  const fila = (it, nuevo) => (it.tipo === 'g-tarjeta' ? <CartasG liga={liga} xs={it.xs} nuevo={nuevo} />
    : it.tipo === 'g-rango' ? <RangosG liga={liga} xs={it.xs} nuevo={nuevo} />
      : it.tipo === 'g-anuncio' ? <AnunciosG liga={liga} xs={it.xs} nuevo={nuevo} />
        : it.tipo === 'g-crewtier' ? <Tiers liga={liga} xs={it.xs} visto={visto} A={A} P={P} />
          : <Fila liga={liga} it={it} A={A} P={P} nuevo={nuevo} />);
  let raya = false;
  return (
    <div className="pw">
      <Escenario liga={liga} xs={destacadas} A={A} />
      <Circulos liga={liga} todos={todos} sv={sv} setSv={setSv} sigo={sigo} visto={visto} />
      <div data-tuto="pb-fil" className="pw-barra" ref={barra}>
        <label className="pw-busca"><Ico n="buscar" t={16} />
          <input id="pw-busca" type="search" value={q} onChange={(e) => { setQ(e.target.value); setDias(4); }} placeholder="Busca un rapero, un servidor o un evento"
            aria-label="Buscar en las publicaciones" />
          {q ? <button type="button" className="pw-busca-x" aria-label="Borrar la búsqueda" onClick={() => setQ('')}>×</button> : null}</label>
        <div className="pw-chips" role="group" aria-label="Qué ver">
          {FILTROS2.filter(([f]) => !f || cuenta[f] || fil === f).map(([f, t]) => (
            <button type="button" key={f || 'todo'} className={fil === f ? 'on' : ''} aria-pressed={fil === f} onClick={() => setFil(f)}>{t}<em>{num(cuenta[f] || 0)}</em></button>
          ))}
        </div>
      </div>
      <div className="pw-cuerpo">
        <div className="pw-solo-cel"><Minis liga={liga} todos={todos} setFil={setFil} desliza /></div>
        <main className="pw-muro">
          {/* 🗳️ la final de cada evento en vivo, para votar quién gana: arriba de todo mientras se juega */}
          {fil !== 'anuncios' && fil !== 'promos' ? <QuienGana liga={liga} /> : null}
          {porDia.length ? porDia.slice(0, dias).map((d, n) => {
            const t = titulo(d.k);
            // 📖 abiertos hasta juntar 8: de madrugada «Hoy» tiene una sola (el resumen de la noche) y con sólo el primer día
            // abierto la página quedaba vacía
            const previas = porDia.slice(0, n).reduce((s, o) => s + o.todos.length, 0);
            const abierto = n === 0 || previas < 8 || enteros || abiertos[d.k];
            return (
              <Fragment key={d.k}>
                <section className="pw-dia" aria-label={t}>
                  <h2 className="pw-dia-t"><b>{t}</b><small>{t === 'Hoy' || t === 'Ayer' ? fecha(d.k) + ' · ' : ''}{d.todos.length === 1 ? '1 publicación' : d.todos.length + ' publicaciones'}</small>
                    {n === 0 && nuevas ? <span className="pw-nuevas-n">{nuevas === 1 ? '1 nueva' : nuevas + ' nuevas'}</span> : null}</h2>
                  {abierto ? d.xs.map((it, i) => {
                    const xs = it.xs || [it];
                    const nuevo = !!visto && xs.some((x) => utc(x.t) > visto);
                    const antes = !raya && visto && nuevas && !nuevo && (n > 0 || i > 0);
                    if (antes) raya = true;
                    return (
                      <Fragment key={(it.id || it.tipo + it.t) + i}>
                        {antes ? <p className="pw-raya">Lo de arriba salió desde tu última visita</p> : null}
                        {fila(it, nuevo)}
                      </Fragment>
                    );
                  }) : <ResumenDia liga={liga} xs={d.todos} abrir={() => setAbiertos((a) => ({ ...a, [d.k]: 1 }))} />}
                </section>
                {n === 0 ? <div className="pw-solo-cel">{masFel}</div> : null}
              </Fragment>
            );
          }) : (
            sv === 'sigo'
              ? <Vacio titulo="Nada todavía de la gente que sigues" texto="Cuando ganen, suban de rango o saquen carta, aparece acá."
                acciones={[['Ver el ranking y seguir a alguien', '#/ranking'], ['Ver todo', () => setSv(''), 'borde2']]} />
              : !liga.muroListo ? <MuroCargando />
                : qn || fil || sv ? <Vacio titulo="Nada con eso" texto="Prueba con otro nombre, otro servidor u otro filtro."
                  acciones={[['Ver todo', () => { setQ(''); setFil0(''); setSv0(''); }]]} />
                  : <Vacio titulo="Todavía no pasó nada" texto="Cuando se juegue el primer evento, aparece acá solo." acciones={[['Ver los eventos', '#/eventos']]} />
          )}
          {porDia.length > dias ? <button type="button" className="btn borde2 chico pw-mas" onClick={() => setDias(dias + 4)}>Ver los días de antes</button> : null}
          <div className="pw-solo-cel pw-pila"><EncCortas liga={liga} enc={enc} /><Sigo liga={liga} sigo={sigo} onVer={() => setSv('sigo')} /><Avisame /></div>
        </main>
        <aside className="pw-rail">
          <Minis liga={liga} todos={todos} setFil={setFil} />
          {masFel}
          {fil === 'promos' ? (
            <section className="pb-bloque">
              <h2 className="pb-st">Las promos</h2>
              <p className="pb-tx">Lo que comparten los raperos en el canal de promoción de su servidor, y los videos de nuestros participantes que
                promociona la Liga. Cada promo está una semana (la tuya la puedes alargar en la <a href="#/tienda">Tienda</a>). Ábrelas con tu
                cuenta de Discord: cada una te da <b>50 Puntos de Tienda</b> (hasta 3 por día) y suma a tu Pase.</p>
            </section>
          ) : null}
          <EncCortas liga={liga} enc={enc} />
          <Sigo liga={liga} sigo={sigo} onVer={() => setSv('sigo')} />
          <Avisame />
        </aside>
      </div>
      {foco0 ? <Hoja liga={liga} it={foco0} A={A} P={P} /> : null}
    </div>
  );
}
