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
import { MESES, hora, horaET, ksDe, limpio, mult, nombreEv, num, siglaDe, utc } from './liga.js';
import { CrewCirculo, escenaDe } from './arriba.jsx';
import { TierChip } from './crewpanel.jsx';
import { Alguien, Algunos, Cara, Carta, Ico, Vacio, accion, promoAbierta, useCampana } from './piezas.jsx';
import { Miniatura, abrirVideo } from './video.jsx';
import { useAplausos } from './aplausos.js';
import { Hilo, delHilo, useComentarios } from './comentarios.jsx';
import { barraDe } from './sugeridos.jsx';
import { LuNube, LuSocial } from './medio.jsx';
import { usePase, usePases } from './pase.js';
import { SelloPremium, esPremium } from './sello.jsx';
import { PopCab } from './pop.jsx';
import { useCalma } from './anima.js';
import { EdCab, Edicion, useDias } from './edicion.jsx';
import { PLATAFORMA } from './publicaciones.jsx';
import CSS_PAGINA from './css/publicaciones2.css?inline';
import { usarCss } from './css.js';
import { OcultarMods } from './mods_ocultar.jsx';

usarCss('publicaciones2', CSS_PAGINA);

const ANUNCIOS = { anuncio: 1, liga: 1, flyer: 1 };
const LOGROS = { campeon: 1, rango: 1, caza: 1, sobrevivio: 1, pase: 1, sorteo: 1, ligahito: 1, mesaward: 1,
  // 🔄 lo que publica sola la gente (bot/muro_solos.py, 15/11/2026): lo mismo que `APLAUDIBLES` de bot/avisos.js
  podio: 1, top10: 1, subio: 1, racha: 1, svtop: 1 };
const MES_CAT = { rapero: 'el Rapero del mes', revelacion: 'la Revelación del mes', batalla: 'la Batalla del mes', servidor: 'el Servidor del mes' };
// 🎨 de qué color es el punto del riel: lo que se ganó (verde), el Most Wanted y la plata (magenta), los avisos (negro)
const COLOR = { campeon: 'v', ligahito: 'v', mesaward: 'v', pase: 'v', sorteo: 'v', crewtier: 'v', tarjeta: 'v', rango: 'v',
  caza: 'm', sobrevivio: 'm', precio: 'm', elegido: 'm', premios: 'm',
  podio: 'v', top10: 'v', subio: 'v', racha: 'v', crewunion: 'v', crewnueva: 'v', svtop: 'v', svmeta: 'v', svrecord: 'v' };
// 📦 lo que va en caja con su sombra: lo que es noticia (un campeón, el Most Wanted, un MES AWARD). Lo demás, en renglón
// (la revisión del remake: «si todo es una caja, nada se ve primero»)
const fuerte = (it) => it.tipo === 'campeon' || it.tipo === 'mesaward' || it.tipo === 'caza' || it.tipo === 'sobrevivio'
  || it.tipo === 'precio' || it.tipo === 'elegido' || it.tipo === 'resnoche' || (it.tipo === 'ligahito' && it.que === 'campeon');

// 🌙 un nombre del resumen de la noche, con link a su perfil si está en la temporada (las claves van en cada renglón,
// no en `ks`: ver `muro.noches()`)
// 💎 `pub` (lo público del Pase): con el premium, el sello al lado del nombre
// 🪪 con su cara y su nombre oficial (17/11/2026, Dlx: «hazlo más bonito con su foto y su cuenta»); sin nadie detrás, el
// nombre como vino, en negrita
function Nombre({ liga, x, pub }) {
  const f = x ? liga.quien(x.n, x.k) : null;
  if (!f) return <b>{limpio(x && x.n)}</b>;
  return <><Alguien liga={liga} nombre={x.n} k={f.k} />{esPremium(pub, f.k) ? <SelloPremium t={13} cls="sp-prem-in" /> : null}</>;
}
// 🪪 QUIÉNES SON, CON SU NOMBRE OFICIAL Y SU CLAVE aunque el muro no la traiga (17/11/2026): el muro escribe el nombre de la
// llave, y sin clave no había cara ni perfil. `[{n, k}]`, en el orden de `quien`
function genteDe(liga, it) {
  const ks = Array.isArray(it.ks) ? it.ks : [];
  return (it.quien || []).map((x, i) => {
    const f = liga.quien(x, ks[i]);
    return { n: f ? limpio(f.n) : limpio(x), k: ks[i] || (f && f.k) || '' };
  });
}
const y = (xs) => xs.reduce((acc, x, i) => (i ? acc.concat([i === xs.length - 1 ? ' y ' : ', ', x]) : [x]), []);
//: cuántos campeones se nombran en el resumen antes de «y N más»
const NOCHE_CAMPEONES = 4;

// 👏 el mismo Felicitar de siempre (las funciones son de social.js: `felicitar`, `errorAplauso`); `chico` para las listas
// (19/11/2026) exportado: las destacadas del perfil v10 felicitan con el mismo botón
export function Felicitar({ liga, it, A, chico }) {
  const id = it.id;
  if (!id) return null;
  // 📣 LA BARRA DE SU SERVIDOR TAMBIÉN FELICITA (21/11/2026, los fans de la Liga): suma 1 y se ve como Liga, al lado
  // (la del servidor de la publicación; si no tiene, la del servidor de la persona: una tarjeta, el Pase, un rango)
  const k0 = ksDe(it)[0], svB = it.sv || (k0 && (liga.quienK(k0) || {}).sv) || '';
  const barra = svB && liga.svs && liga.svs[svB] ? barraDe(liga, svB) : '';
  const n = Number(A.cu[id] || 0) + (barra ? 1 : 0);
  const mio = !!A.mios[id];
  const yo = liga.yo;
  const lg = barra ? <i className="pb-fel-l" title={barra + ' felicitó'}>{chico ? 'Liga' : 'con ' + barra}</i> : null;
  if (yo && ksDe(it).includes(yo.k)) return n ? <span className="pb-fel tuyo" title={'Te felicitaron' + (barra ? ', con ' + barra : '')}>👏 {num(n)}{lg}</span> : null;
  const err = A.err[id] && window.errorAplauso ? window.errorAplauso(A.err[id]) : '';
  return (
    <>
      <button type="button" className={'pb-fel' + (chico ? ' chico' : '') + (mio ? ' on' : '') + (A.va[id] ? ' va' : '')} aria-pressed={mio}
        disabled={mio || !!A.va[id]} onClick={() => { if (window.felicitar) window.felicitar(id); }}
        aria-label={(mio ? 'Felicitaste' : 'Felicitar') + (n ? ' · ' + n : '') + (barra ? ', con ' + barra : '')}>
        <span aria-hidden="true">👏</span>{chico ? null : (mio ? 'Felicitaste' : 'Felicitar')}{n ? <em>{num(n)}</em> : null}{lg}
      </button>
      {err ? <small className="pb-err" role="status">{err}</small> : null}
    </>
  );
}

// los nombres de una publicación, con link a su perfil si está en la temporada (y el sello Premium de quien lo tenga)
function nombresDe(liga, it, pub) {
  return y(genteDe(liga, it).map((x, i) => <Nombre key={i} liga={liga} x={x} pub={pub} />));
}

// ── 🗣️ QUIÉN FIRMA CADA PUBLICACIÓN (Dlx, 15/11/2026: «me gustaría que también los sv publiquen cosas de forma automática… y
// los usuarios también sus cosas», y a la voz, «1. B»): lo de la gente lo firma quien lo protagoniza y va en primera
// persona; lo de un servidor, el servidor («Arrancamos la semana…»); lo de todos, la Liga. Los datos no cambian: el
// muro sigue contando hechos (bot/muro.py) y la voz la pone esta página. ⚠️ Lleva la marca «automática» con lo que es:
// nadie la escribió, y cada uno puede apagar las suyas en Tu cuenta (bot/muro_solos.py `apagados()`) ──
const DEL_SV = { svlunes: 1, svsemana: 1, svmeta: 1, svtop: 1, svrecord: 1, svnuevo: 1, svtier: 1, anuncio: 1, flyer: 1, svchat: 1 };
const DE_LA_LIGA = { premios: 1, resnoche: 1, liga: 1, crewtier: 1 };
function autorDe(it, liga) {
  const cat = String(it.cat || '');
  if (DEL_SV[it.tipo] || (it.tipo === 'mesaward' && (cat.startsWith('sv:') || cat === 'servidor'))) return it.sv ? { sv: it.sv } : null;
  if (DE_LA_LIGA[it.tipo] || (it.tipo === 'promo' && (it.o === 'liga' || it.o === 'mano')) || (it.tipo === 'mesaward' && (cat === 'otras' || cat === 'batalla'))) return null;
  const g = genteDe(liga, it)[0];
  return g && g.n ? { k: ksDe(it)[0] || g.k, n: g.n } : null;
}
const AUTO = 'La Liga la publica sola con lo que pasó. Si es tuya, puedes apagar las tuyas en Tu cuenta.';
function Autor({ liga, it, pub, cara = true }) {
  const a = autorDe(it, liga);
  if (!a) return <span className="pw-autor">{cara ? <img className="pw-au-c" alt="" src="/ul.png" /> : null}<b>Liga Global</b></span>;
  if (a.sv) {
    return (
      <a className="pw-autor" href={'#/sv/' + encodeURIComponent(siglaDe(a.sv))}>
        {cara ? <img className="pw-au-c" alt="" src={liga.logo(a.sv)} /> : null}<b>{siglaDe(a.sv)}</b><small title={AUTO}>automática</small>
      </a>
    );
  }
  const prem = esPremium(pub, a.k);
  const cuerpo = <>{cara ? <Cara liga={liga} k={a.k} nombre={a.n} cls={'cara pw-au-c' + (prem ? ' sp-prem-aro' : '')} /> : null}<b>{a.n}</b>
    {prem ? <SelloPremium t={12} cls="sp-prem-in" /> : null}<small title={AUTO}>automática</small></>;
  // 18/11/2026: con liga.T[a.k] el autor de fuera de las 200 filas salía sin link, y también tiene perfil
  return a.k && liga.existe(a.k) ? <a className="pw-autor" href={'#/r/' + encodeURIComponent(a.k)}>{cuerpo}</a> : <span className="pw-autor">{cuerpo}</span>;
}
// los demás de una publicación de varios (la firma el primero): « con Bea», « con Bea y Cris»
function conOtros(liga, it, pub) {
  const g = genteDe(liga, it);
  if (g.length < 2) return null;
  return <> con {y(g.slice(1).map((x, i) => <Nombre key={i} liga={liga} x={x} pub={pub} />))}</>;
}
const xN = (x) => '×' + String(x).replace('.', ',');
const NOMBRE_CARTA = { temporada: 'de Temporada', competitivo: 'Competitiva', servidor: 'de Servidor', pais: 'de País' };

// ── qué dice cada publicación: la categoría, lo que se ve, el texto, el detalle y adónde lleva (lo de publicaciones.jsx,
// con el dibujo nuevo). `media`: la imagen va arriba y grande (video, flyer) ──
function contenido(liga, it, pub) {
  const g = genteDe(liga, it);
  const q = g.map((x) => x.n);
  const ks0 = Array.isArray(it.ks) ? it.ks : [];
  const ks = Array.from({ length: Math.max(ks0.length, g.length) }, (_, i) => ks0[i] || (g[i] && g[i].k) || '');
  const nombres = nombresDe(liga, it, pub);
  const f0 = ks[0] ? liga.T[ks[0]] : null;
  const cara = <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls={'cara pb-cara' + (esPremium(pub, ks[0]) ? ' sp-prem-aro' : '')} />;
  const logoSv = <img className="pb-logo" alt="" src={liga.logo(it.sv)} />;
  const otros = conOtros(liga, it, pub);
  const c = { cat: '', vis: null, txt: null, det: '', acc: null, media: false };
  if (it.tipo === 'campeon') {
    c.cat = 'Campeón · ' + siglaDe(it.sv);
    c.vis = f0 && (f0.c || []).includes('temporada') ? <Carta liga={liga} k={f0.k} cual="temporada" cls="pb-carta" abre={false} /> : cara;
    // 🥇 el primer título de la temporada de quien firma (`primero`, bot/muro_solos.py)
    const primero = (it.primero || []).map((x) => liga.aka(x)).includes(q[0]);
    // 🏷️ `nombreEv()` y no `limpio()` (18/11/2026): la llave sin nombre llegaba cruda, «Gané (sin titulo)» (las #654 y #659
    // de LKR). Lo mismo en todo lo que nombra el evento en esta página
    c.txt = <>{primero ? '¡Mi primer título! ' : ''}Gané <b>{nombreEv(it.ev, it.ll)}</b>{otros}</>;
    c.det = it.part ? it.part + ' raperos' : '';
    c.acc = it.ll ? <button type="button" className="pb-a" onClick={() => accion.llave(it.ll)}>Ver la llave</button> : null;
  } else if (it.tipo === 'tarjeta') {
    // 🃏 una sola en su día (con dos o más van juntas en el abanico, `CartasG`): hasta el 15/11/2026 no tenía texto acá y
    // no se dibujaba
    c.cat = 'Carta nueva';
    c.vis = ks[0] ? <Carta liga={liga} k={ks[0]} cual={it.carta} cls="pw-mcarta" abre={false} /> : cara;
    c.txt = <>Saqué mi carta <b>{NOMBRE_CARTA[it.carta] || ''}</b></>;
    c.acc = ks[0] ? <button type="button" className="pb-a" onClick={() => accion.carta(ks[0], it.carta)}>Ver la carta</button> : null;
  } else if (it.tipo === 'rango') {
    c.cat = it.primero ? 'Primera letra' : 'Sube de rango';
    c.vis = <span className="pb-rg" style={{ background: liga.colorRg(it.rg) }}>{it.rg}</span>;
    c.txt = <>{it.primero ? 'Conseguí mi primera letra: ' : 'Subí a rango '}<b>{it.rg}</b></>;
    c.acc = ks[0] ? <a className="pb-a" href={'#/r/' + encodeURIComponent(ks[0])}>Ver su perfil</a> : null;
  } else if (it.tipo === 'caza') {
    c.cat = 'Most Wanted · Caza';
    c.vis = cara;
    c.txt = <>Cacé a <b><Alguien liga={liga} nombre={it.a} /></b> ({it.cat}){otros} y {q.length > 1 ? 'cobramos' : 'cobro'} <b>{num(it.pts)}</b></>;
    c.det = it.ev ? nombreEv(it.ev, it.ll) : '';
  } else if (it.tipo === 'sobrevivio') {
    c.cat = 'Most Wanted · Sobrevivió';
    c.vis = cara;
    c.txt = <>Sobreviví al Most Wanted ({it.cat}) y me llevo <b>{num(it.pts)}</b></>;
  } else if (it.tipo === 'crewtier') {
    const col = (liga.d.crews_tiers && (liga.d.crews_tiers.colores || [])[it.tier]) || '#E41373';
    c.cat = 'Crews · Sube de tier';
    // su escudo como en todos los círculos de crew (sin logo, el de su nombre: el remake del 29/10); el logo de hoy de la
    // crew si el muro no lo trae
    const viva = (liga.d.crews || []).find((x) => (x.clave || x.crew) === it.crew);
    c.vis = <span className="pb-crew" style={{ boxShadow: '0 0 0 3px ' + col }}><CrewCirculo c={{ crew: it.nombre, logo: it.logo || (viva && viva.logo) || '' }} cls="pb-crew-c" /></span>;
    c.txt = <><b>{limpio(it.nombre)}</b> sube a <b style={{ color: col }}>{it.tn}</b>{it.tarjeta ? ' y se gana su tarjeta de crew, que llega pronto' : ''}</>;
    c.det = it.pts ? num(it.pts) + ' puntos en la semana' : '';
    c.acc = <a className="pb-a" href={'#/crew/' + encodeURIComponent(it.crew)}>Ver la crew</a>;
  } else if (it.tipo === 'pase') {
    c.cat = it.completo ? 'Pase de rapero · Completo' : 'Pase de rapero';
    c.vis = cara;
    c.txt = it.completo ? <>Completé el <b>Pase de rapero</b> y entro al Salón del Pase</>
      : <>Llegué al nivel <b>{it.nivel}</b> del Pase de rapero{it.premio ? <>: <b>«{it.premio}»</b></> : null}</>;
    c.acc = <a className="pb-a" href="#/pase">Ver el Pase</a>;
  } else if (it.tipo === 'sorteo') {
    c.cat = 'Sorteo del Pase premium';
    c.vis = cara;
    c.txt = <>Gané el sorteo y me llevo el rol <b>«Pase Premium»</b> de DRA</>;
    c.det = num(it.personas) + ' entraron gratis · ' + num(it.boletos) + ' boletos · ' + (it.semilla === 'a-mano' ? 'lo eligió la Liga' : 'semilla ' + String(it.semilla || '').slice(0, 12) + '…');
    c.acc = <a className="pb-a" href="#/pase">Ver el Pase</a>;
  } else if (it.tipo === 'precio') {
    c.cat = 'Precio por su cabeza';
    c.vis = cara;
    c.txt = <>Le gané a <b><Alguien liga={liga} nombre={it.a} /></b>{otros} y {q.length > 1 ? 'cobramos' : 'cobro'} el precio por su cabeza: <b>{num(it.pts)}</b></>;
    c.det = it.ev ? nombreEv(it.ev, it.ll) : '';
  } else if (it.tipo === 'premios') {
    c.cat = 'Premios de la semana';
    c.vis = <img className="pb-logo" alt="" src="/ul.png" />;
    // 🪪 cada uno con su cara y su perfil (`ks` es `{figura, revelacion, cazador}`, ver bot/muro.py)
    const kp = it.ks && !Array.isArray(it.ks) && typeof it.ks === 'object' ? it.ks : {};
    const p = [['figura', 'figura'], ['revelacion', 'revelación'], ['cazador', 'cazador']].filter(([r]) => it[r])
      .map(([r, et]) => <Fragment key={r}>{et}: <Alguien liga={liga} nombre={it[r][0]} k={kp[r]} /></Fragment>)
      .concat(it.servidor ? ['servidor: ' + siglaDe(it.servidor[0])] : []);
    c.txt = <b>{p.reduce((acc, x, i) => (i ? acc.concat([' · ', x]) : [x]), [])}</b>;
  } else if (it.tipo === 'elegido') {
    c.cat = 'El Elegido';
    c.vis = cara;
    c.txt = <>La gente me eligió como El Elegido del Most Wanted</>;
    c.det = it.de ? it.votos + ' de ' + it.de + ' votos' : '';
  } else if (it.tipo === 'mesaward') {
    // 🏆 LA GALA DE LA TEMPORADA (17/11/2026): `gala` y `mes` = la temporada ('t1'). Se dice «la T1» donde va el mes
    const gala = !!it.gala;
    const mes = gala ? 'la ' + String(it.mes || '').toUpperCase() : MESES[Number(String(it.mes || '').slice(5, 7)) - 1] || '';
    const deSv = String(it.cat || '').startsWith('sv:');
    c.cat = (gala ? 'GALA · ' + String(it.mes || '').toUpperCase() : 'MES AWARDS · ' + (deSv ? siglaDe(it.sv) + ' · ' : '') + mes);
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
    const catN = (k) => (gala ? String(MES_CAT[k] || 'ganador').replace(' del mes', ' de la temporada') : MES_CAT[k] || 'ganador');
    c.txt = deSv ? <>Nuestros ganadores de <b>{mes}</b>: {lista}</>
      : it.cat === 'otras' ? <>Los demás ganadores de {gala ? 'la gala de ' : ''}<b>{mes}</b>: {lista}</>
      : it.cat === 'batalla' ? <><b>{limpio(it.n)}</b> es {catN('batalla')} {gala ? 'en' : 'de'} {mes}</>
      : it.cat === 'servidor' ? <>Somos {catN('servidor')} {gala ? 'en' : 'de'} <b>{mes}</b></>
        : <>Soy {catN(it.cat)} {gala ? 'en' : 'de'} <b>{mes}</b></>;
    c.det = it.cat === 'otras' || deSv ? '' : it.por === 'votos'
      ? (it.pct ? it.pct + '% de los votos · ' : '') + num(it.votos) + (it.votos === 1 ? ' voto' : ' votos') + (it.total ? ' de ' + num(it.total) : '')
      : gala ? 'por los números de la temporada' : 'por los números del mes';
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
      : it.tit ? <>Comparto <b>{limpio(it.tit)}</b></> : <>Comparto algo en <b>{plat}</b></>;
    c.det = it.de && it.de !== it.tit ? it.de : '';
    c.acc = <a className="pb-a" href={it.url} target="_blank" rel="noopener noreferrer" onClick={() => promoAbierta(it.id)}>{it.plat === 'sp' || it.plat === 'sc' ? 'Escuchar' : 'Ver'} en {plat} ↗</a>;
  } else if (it.tipo === 'ligahito') {
    const ir = '#/ligas/' + encodeURIComponent(it.liga || '');
    c.cat = (it.que === 'campeon' ? 'Campeón de liga' : it.que === 'invicto' ? 'Liga · Invicto' : 'Liga · La punta') + ' · ' + siglaDe(it.sv);
    c.vis = cara;
    c.txt = it.que === 'campeon' ? <>Soy el campeón de <b>{limpio(it.ln)}</b></>
      : it.que === 'invicto' ? <>Llevo <b>{it.pg || 5} ganadas sin perder</b> en {limpio(it.ln)}</>
        : <>Tomé la punta de <b>{limpio(it.ln)}</b>{it.pts ? <> con {it.pts} puntos</> : null}</>;
    c.det = it.que === 'campeon' && (it.podio || []).length > 1
      ? <>Podio: {it.podio.map((x, i) => <Fragment key={i}>{i ? ' · ' : ''}<Alguien liga={liga} nombre={x} /></Fragment>)}</> : '';
    c.acc = <a className="pb-a" href={ir}>Ver la liga</a>;
  } else if (it.tipo === 'flyer') {
    const ir = '#/ligas/' + encodeURIComponent(it.liga || '');
    c.cat = 'Liga · ' + siglaDe(it.sv);
    c.vis = <a className="pb-flyer" href={ir} aria-label={'Ver ' + limpio(it.ln)}>
      <img alt={'El flyer de ' + limpio(it.ln) + (it.tit ? ': ' + limpio(it.tit) : '')} src={it.img} loading="lazy"
        width={it.w || undefined} height={it.h || undefined} /></a>;
    c.txt = <>Publicamos el flyer de <b>{limpio(it.ln)}</b>{it.tit ? <>: {limpio(it.tit)}</> : null}</>;
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
      <Fragment key={i}>{y((e.quien || []).map(([n, k], j) => <Nombre key={j} liga={liga} x={{ n, k }} pub={pub} />))} ganó <b>{nombreEv(e.ev, e.ll)}</b></Fragment>));
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
    c.vis = logoSv;
    c.txt = <>Anunciamos <b>{limpio(it.ev)}</b></>;
    c.det = [it.mod, it.org ? 'organiza ' + it.org : '', it.pre ? 'premio: ' + it.pre : ''].filter(Boolean).join(' · ');
    c.acc = it.link ? <a className="pb-a" href={it.link} target="_blank" rel="noopener noreferrer">Ver en Discord ↗</a> : null;
  // ── 🔄 lo que publican solos la gente y los servidores (bot/muro_solos.py, 15/11/2026) ──
  } else if (it.tipo === 'podio') {
    c.cat = 'Primer podio · ' + siglaDe(it.sv);
    c.vis = cara;
    c.txt = <>Mi primer podio: salí <b>{String(it.puesto || '').toLowerCase()}</b> en <b>{nombreEv(it.ev, it.ll)}</b></>;
    c.acc = it.ll ? <button type="button" className="pb-a" onClick={() => accion.llave(it.ll)}>Ver la llave</button> : null;
  } else if (it.tipo === 'top10') {
    const rk = it.rk === 'competitivo' ? 'Competitivo' : 'Temporada';
    c.cat = 'Top 10 · Ranking ' + rk;
    c.vis = cara;
    c.txt = <>Entré al top 10 del Ranking {rk}: estoy <b>#{it.pos}</b></>;
    c.acc = <a className="pb-a" href={'#/ranking/' + (it.rk === 'competitivo' ? 'competitivo' : 'temporada')}>Ver el ranking</a>;
  } else if (it.tipo === 'subio') {
    c.cat = 'Sube en el Ranking';
    c.vis = cara;
    // 18/11/2026: «en la semana» y no «esta semana»: muro_solos.py mide la semana ANTERIOR y el ítem queda ~8 días (como liga.js y avisos.js)
    c.txt = <>Subí <b>{(it.de || 0) - (it.a || 0)} puestos</b> en la semana: del #{it.de} al <b>#{it.a}</b></>;
    c.acc = <a className="pb-a" href="#/ranking/temporada">Ver el ranking</a>;
  } else if (it.tipo === 'racha') {
    c.cat = 'Racha';
    c.vis = cara;
    c.txt = <>Llevo <b>{it.racha} eventos seguidos</b> 🔥</>;
  } else if (it.tipo === 'crewunion' || it.tipo === 'crewnueva') {
    c.cat = 'Crews' + (it.sigla ? ' · ' + it.sigla : '');
    c.vis = cara;
    c.txt = it.tipo === 'crewnueva' ? <>Creé la crew <b>{limpio(it.nombre)}</b></> : <>Me uní a la crew <b>{limpio(it.nombre)}</b></>;
    c.acc = it.crew ? <a className="pb-a" href={'#/crew/' + encodeURIComponent(it.crew)}>Ver la crew</a> : null;
  } else if (it.tipo === 'svtop') {
    c.cat = 'Nuevo #1 · ' + siglaDe(it.sv);
    c.vis = cara;
    c.txt = <>Tenemos nuevo #1: {nombres}</>;
    c.det = it.pts ? num(it.pts) + ' puntos en la temporada' : '';
    c.acc = <a className="pb-a" href={'#/sv/' + encodeURIComponent(siglaDe(it.sv))}>Ver {siglaDe(it.sv)}</a>;
  } else if (it.tipo === 'svmeta') {
    c.cat = 'Meta de la semana · ' + siglaDe(it.sv);
    c.vis = logoSv;
    c.txt = <>¡Cumplimos la meta de la semana! <b>{(it.meta || [])[0]} de {(it.meta || [])[1]}</b> raperos</>;
  } else if (it.tipo === 'svrecord') {
    c.cat = 'Récord · ' + siglaDe(it.sv);
    c.vis = logoSv;
    c.txt = <>Récord de la temporada: <b>{it.part} raperos</b> en <b>{nombreEv(it.ev, it.ll)}</b></>;
    c.det = it.antes ? 'El anterior era de ' + it.antes : '';
    c.acc = it.ll ? <button type="button" className="pb-a" onClick={() => accion.llave(it.ll)}>Ver la llave</button> : null;
  } else if (it.tipo === 'svchat') {
    // 💬 el día fuerte del chat general (bot/chats.py, 17/11/2026), en la voz del servidor. ⚠️ Una polémica, sin nombres
    const ct = liga.chatTexto(it, true);
    if (!ct) return null;
    c.cat = liga.chatEtq(it).toLowerCase().replace(/\p{L}/u, (m) => m.toUpperCase()) + ' · ' + siglaDe(it.sv);
    c.vis = logoSv;
    // 🗨️ tanda 4: con la frase que la armó y quien la escribió
    const cita = ct.cita ? <span className="pw-cita">«{ct.cita.txt}»{ct.cita.n ? <i> — {ct.cita.n}</i> : null}</span> : null;
    c.txt = <>{ct.ks.length || it.que === 'raid' ? <b>{ct.tit}</b> : <>{ct.tit}: <b>{num(it.msgs)} mensajes</b> en un día</>}{cita}</>;
    // 🕘 el pico en tu zona y tu formato (18/11/2026), como en la historia (arriba.jsx): `horaET(it.h)` escribía la hora del
    // este sin decirlo («11 PM» para quien en Argentina lo vivió a la 1 AM). `t` es h:30 ET (bot/chats.py): media hora
    // antes es el comienzo de la hora del pico
    const pico = it.t ? hora(new Date(utc(it.t).getTime() - 30 * 60000)) : horaET(it.h);
    c.det = ct.ks.length || it.que === 'raid' ? [ct.sub, ct.ev ? 'la noche de ' + ct.ev : ''].filter(Boolean).join(' · ')
      : [it.x >= 2 ? mult(it.x) + ' un día normal' : '', num(it.gente) + ' personas', 'el pico, a las ' + pico, ct.ev ? 'la noche de ' + ct.ev : ''].filter(Boolean).join(' · ');
    c.acc = <a className="pb-a" href={'#/sv/' + encodeURIComponent(siglaDe(it.sv))}>Ver {siglaDe(it.sv)}</a>;
  } else if (it.tipo === 'svnuevo') {
    c.cat = 'Socio nuevo';
    c.vis = logoSv;
    c.txt = <>Entramos a la <b>Liga Global</b></>;
    c.det = it.tier ? 'Tier ' + it.tier : '';
    c.acc = <a className="pb-a" href={'#/sv/' + encodeURIComponent(siglaDe(it.sv))}>Ver {siglaDe(it.sv)}</a>;
  } else if (it.tipo === 'svtier') {
    c.cat = 'Socios · Tier';
    c.vis = logoSv;
    c.txt = <>Pasamos a <b>Tier {it.a}</b></>;
    c.det = it.de ? 'Antes, Tier ' + it.de : '';
  } else if (it.tipo === 'svlunes') {
    c.cat = 'La semana · ' + siglaDe(it.sv);
    c.vis = logoSv;
    c.txt = it.x > 1 ? <>Arrancamos la semana con <b>{xN(it.x)}</b></> : <>Arrancamos la semana</>;
    c.det = lunesDet(it);
  } else if (it.tipo === 'svsemana') {
    c.cat = 'Cierre de la semana · ' + siglaDe(it.sv);
    c.vis = logoSv;
    c.txt = <>Cerramos la semana: <b>{it.eventos}</b> {it.eventos === 1 ? 'evento' : 'eventos'} y <b>{num(it.part)}</b> participaciones</>;
    c.det = semanaDet(it, liga);
  } else return null;
  return c;
}
// lo que dice el lunes de un servidor, y su cierre, en una línea (también en el grupo del día)
function lunesDet(it) {
  return [it.meta ? 'Meta: ' + it.meta + ' raperos' : '', it.contra ? 'Guerra contra ' + siglaDe(it.contra) : '',
    it.dorado ? 'Evento dorado: ' + limpio(it.dorado) : ''].filter(Boolean).join(' · ');
}
function semanaDet(it, liga) {
  // 🪪 con su nombre oficial (17/11/2026)
  // 🏷️ (y la llave sin nombre, «un evento»: `camps` no trae su número; el 16/11 LKR y DDF decían «en (sin titulo)»)
  const cs = (it.camps || []).map(([ev, q]) => (q || []).map((x) => liga.aka(x)).join(' y ') + ' en ' + nombreEv(ev));
  return [cs.length ? 'Campeones: ' + cs.join('; ') : '', it.meta && it.meta[0] >= it.meta[1] ? '✓ Cumplimos la meta (' + it.meta[0] + ' de ' + it.meta[1] + ')' : '',
    it.guerra ? 'Ganamos la guerra contra ' + siglaDe(it.contra) : ''].filter(Boolean).join(' · ');
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

// 🔔 que te llegue cuando te felicitan: se va solo cuando está todo
function Avisame() {
  const e = useCampana();
  const C = window.Campana;
  // 🔕 `{ no: 1 }` es quien tocó «Desvincular» a propósito (campana.js, 18/11/2026): no se le vuelve a pedir
  if (!e || !C || (e.activa && e.yo && (e.yo.id || e.yo.no))) return null;
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

// 👥 TAMBIÉN LOS DE FUERA DE LAS 200 FILAS (18/11/2026): se filtraba por `liga.T`, así que a quien sigues más allá del
// corte no salía ni contaba. Con `existe()` y `nombreDe()`, que los encuentran (`sigo` es `sigueTodos`, ver abajo)
function Sigo({ liga, sigo, onVer }) {
  const xs = sigo.filter((k) => liga.existe(k));
  if (!xs.length) return null;
  return (
    <section className="pb-bloque">
      <h2 className="pb-st">A quién sigues<small>{xs.length}</small></h2>
      <div className="pb-sigo">
        <ul>{xs.slice(0, 9).map((k) => <li key={k}><a href={'#/r/' + encodeURIComponent(k)} title={liga.nombreDe(k)}><Cara liga={liga} k={k} nombre={liga.nombreDe(k)} cls="cara pb-sigo-c" /></a></li>)}
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
const GRUPOS = { tarjeta: 1, rango: 1, crewtier: 1, svlunes: 1, svsemana: 1, podio: 1, top10: 1, subio: 1, racha: 1 };
export const TIPOS = {
  campeones: ['campeon', 'resnoche', 'ligahito', 'podio'], rangos: ['rango'], cartas: ['tarjeta'], pase: ['pase', 'sorteo'],
  mw: ['caza', 'precio', 'sobrevivio', 'elegido', 'premios'], mes: ['mesaward'], crews: ['crewtier', 'crewunion', 'crewnueva'], anuncios: ['flyer', 'liga'], promos: ['promo'],
  // 🔄 bot/muro_solos.py (15/11/2026)
  logros: ['podio', 'top10', 'subio', 'racha'], servidores: ['svlunes', 'svsemana', 'svmeta', 'svtop', 'svrecord', 'svnuevo', 'svtier', 'svchat'],
};
export const FILTROS2 = [['', 'Todo'], ['campeones', 'Campeones'], ['rangos', 'Rangos'], ['logros', 'Logros'], ['cartas', 'Cartas'], ['pase', 'Pase'],
  ['mw', 'Most Wanted'], ['servidores', 'Servidores'], ['mes', 'MES AWARDS'], ['crews', 'Crews'], ['anuncios', 'Anuncios'], ['promos', 'Promos']];
const hace = (liga, t) => { const c = liga.cuando(t); return c ? c.charAt(0).toUpperCase() + c.slice(1) : ''; };
// el título en texto llano, para el escenario y los resúmenes
function plano(liga, it) {
  const q = genteDe(liga, it).map((x) => x.n);
  const quien = q.length > 2 ? q.slice(0, -1).join(', ') + ' y ' + q[q.length - 1] : q.join(' y ');
  const varios = q.length > 1;
  // 🏷️ la llave sin nombre, con `nombreEv()` (18/11/2026): el escenario gritaba «GANÉ (SIN TITULO)»
  if (it.tipo === 'campeon') return 'Gané ' + nombreEv(it.ev, it.ll) + (varios ? ' con ' + q.slice(1).join(' y ') : '');
  if (it.tipo === 'caza') return 'Cacé a ' + liga.aka(it.a) + ' y ' + (varios ? 'cobramos ' : 'cobro ') + num(it.pts);
  if (it.tipo === 'precio') return 'Le gané a ' + liga.aka(it.a) + ' y ' + (varios ? 'cobramos ' : 'cobro ') + num(it.pts);
  if (it.tipo === 'sobrevivio') return 'Sobreviví al Most Wanted';
  if (it.tipo === 'elegido') return 'Soy El Elegido';
  if (it.tipo === 'podio') return 'Mi primer podio: ' + nombreEv(it.ev, it.ll);
  if (it.tipo === 'svtop') return 'Tenemos nuevo #1: ' + quien;
  if (it.tipo === 'svrecord') return 'Récord: ' + it.part + ' raperos en ' + nombreEv(it.ev, it.ll);
  if (it.tipo === 'svmeta') return '¡Cumplimos la meta de la semana!';
  if (it.tipo === 'svchat') { const ct = liga.chatTexto(it, true); return ct ? ct.tit : ''; }
  if (it.tipo === 'resnoche') return it.eventos + (it.eventos === 1 ? ' evento y ' : ' eventos y ') + num(it.part) + ' participaciones';
  if (it.tipo === 'ligahito') return it.que === 'campeon' ? 'Soy el campeón de ' + limpio(it.ln) : limpio(it.ln);
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
  // 🧘 también con «Menos animaciones» de Tu cuenta, no sólo con la del sistema (revisión del 16/11)
  const calmaLg = useCalma();
  useEffect(() => {
    if (quieto || calmaLg || xs.length < 2) return undefined;
    let calma = false;
    try { calma = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { calma = false; }
    if (calma) return undefined;
    const t = setInterval(() => setI((v) => (v + 1) % xs.length), 8000);
    return () => clearInterval(t);
  }, [quieto, calmaLg, xs.length]);
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
  // 18/11/2026: sin clase para el magenta (ya es el fondo de .pw-chip): `.m` es la batalla de la llave chica (estilo.css), global en el shadow root, y le ponía su borde de 2 px
  const tono = COLOR[it.tipo] === 'm' ? '' : 'v';
  return (
    <section className={'pw-esc' + (fondo ? ' con-fondo' : '')} style={fondo ? { backgroundImage: 'url("' + fondo + '")' } : undefined}
      onMouseEnter={() => setQuieto(true)} onMouseLeave={() => setQuieto(false)} onFocus={() => setQuieto(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setQuieto(false); }} aria-label="Lo más fuerte de estos días">
      <div className="pw-esc-in">
        <div className="pw-esc-tx" data-tuto="pb-cab">
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
  const nombres = [...new Set(us.map((it) => liga.aka((it.quien || [])[0] || '', (it.ks || [])[0])))];
  return (
    <article className={'pw-f c-v' + (nuevo ? ' nueva' : '')}>
      <span className="pw-v"><img className="pw-logo" alt="" src="/ul.png" /></span>
      <div className="pw-tx">
        <span className="pw-cat">{us.length === 1 ? 'Carta nueva' : 'Cartas nuevas · ' + us.length}</span>
        <p className="pw-t"><b>{nombres.slice(0, 3).join(', ')}</b>{nombres.length > 3 ? ' y ' + (nombres.length - 3) + ' más' : ''}{nombres.length > 1 ? ' ya tienen su carta' : ' ya tiene su carta'}</p>
        <div className="pw-abanico">
          {us.slice(0, 12).map((it) => {
            const k = (it.ks || [])[0];
            return <button type="button" key={k + it.carta} onClick={() => accion.carta(k, it.carta)} aria-label={'La carta de ' + liga.aka((it.quien || [])[0] || '', k)}>
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
            const k = ksDe(it)[0] || (liga.quien((it.quien || [])[0]) || {}).k || '';
            const n0 = liga.aka((it.quien || [])[0] || '', k);
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
// ── 🔄 los logros del mismo día y del mismo tipo (primer podio, top 10, subidas, rachas), juntos como las subidas de rango:
// una noche deja varios y cada uno en su fila grande llenaba el muro. Tocar a uno abre su publicación para felicitarlo ──
const LOGRO_G = {
  podio: ['Primeros podios', (it) => (it.puesto === 'Subcampeón' ? '2.º' : '3.º'), (it) => nombreEv(it.ev, it.ll)],
  top10: ['Entran al top 10', (it) => '#' + it.pos, (it) => (it.rk === 'competitivo' ? 'Competitivo' : 'Temporada')],
  subio: ['Suben en el Ranking', (it) => '+' + ((it.de || 0) - (it.a || 0)), (it) => '#' + it.de + ' → #' + it.a],
  racha: ['Rachas', (it) => String(it.racha), () => 'seguidos'],
};
function LogrosG({ liga, xs, nuevo }) {
  const pub = usePases();
  const [tit, chip, sub] = LOGRO_G[xs[0].tipo];
  return (
    <article className={'pw-f c-v' + (nuevo ? ' nueva' : '')}>
      <span className="pw-v"><img className="pw-logo" alt="" src="/ul.png" /></span>
      <div className="pw-tx">
        <div className="pw-firma"><span className="pw-autor"><b>{xs.length} raperos</b><small title={AUTO}>automática</small></span>
          <span className="pw-cat">{tit}</span></div>
        <div className="pw-rngs">
          {xs.map((it) => {
            const k = ksDe(it)[0] || (liga.quien((it.quien || [])[0]) || {}).k || '';
            const n0 = liga.aka((it.quien || [])[0] || '', k);
            return (
              <a key={it.id || it.t + n0} href={'#/publicaciones/' + (it.id || '')} data-pub={it.id || undefined} aria-label={n0 + ': ' + tit.toLowerCase() + '. Felicitar o comentar'}>
                <Cara liga={liga} k={k} nombre={n0} cls={'cara pw-rng-c' + (esPremium(pub, k) ? ' sp-prem-aro' : '')} />
                <i className="pw-letra pw-lg">{xs[0].tipo === 'racha' ? '🔥' + chip(it) : chip(it)}</i>
                <small>{n0}</small><small className="g">{sub(it)}</small>
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

// ── 🏟️ los servidores que arrancan (o cierran) la semana el mismo día: una lista, cada uno con su línea y su 💬 ──
// ⚠️ Los primeros `SV_TOPE` y «Ver los N»: el 16/11/2026, con los 14 del lunes y los 11 del cierre el mismo día, los dos
// grupos medían 1.373 y 1.810 px en el celular (más de tres pantallas)
const SV_TOPE = 4;
function ServidoresG({ liga, xs, nuevo }) {
  const [todos, setTodos] = useState(false);
  const lunes = xs[0].tipo === 'svlunes';
  const orden0 = [...xs].sort((a, b) => (lunes ? (b.x || 0) - (a.x || 0) : (b.eventos || 0) - (a.eventos || 0)));
  const orden = todos ? orden0 : orden0.slice(0, SV_TOPE);
  return (
    <article className={'pw-f c-a' + (nuevo ? ' nueva' : '')}>
      <span className="pw-v"><img className="pw-logo" alt="" src="/ul.png" /></span>
      <div className="pw-tx">
        <div className="pw-firma"><span className="pw-autor"><b>{xs.length} servidores</b><small title={AUTO}>automática</small></span>
          <span className="pw-cat">{lunes ? 'Arrancan la semana' : 'Cierran la semana'}</span></div>
        <ul className="pw-anl pw-svl">
          {orden.map((it) => {
            const n = delHilo(it, Date.now()).length;
            const det = lunes ? lunesDet(it) : semanaDet(it, liga);
            return (
              <li key={it.id || it.sv} data-pub={it.id || undefined}>
                <img alt="" src={liga.logo(it.sv)} />
                <span><b>{siglaDe(it.sv)} · {lunes ? (it.x > 1 ? 'Arrancamos con ' + xN(it.x) : 'Arrancamos la semana')
                  : it.eventos + (it.eventos === 1 ? ' evento y ' : ' eventos y ') + num(it.part) + ' participaciones'}</b>
                  {det ? <small>{det}</small> : null}</span>
                {it.id ? <a className="pw-anl-cm" href={'#/publicaciones/' + it.id} aria-label={n ? n + ' comentarios' : 'Comentar'}>💬{n ? ' ' + n : ''}</a> : <i />}
                <a className="pb-a" href={'#/sv/' + encodeURIComponent(siglaDe(it.sv))} aria-label={'Ver ' + siglaDe(it.sv)}>Ver ↗</a>
              </li>
            );
          })}
        </ul>
        {orden0.length > SV_TOPE ? (
          <button type="button" className="pw-svl-mas" aria-expanded={todos} onClick={() => setTodos(!todos)}>
            {todos ? 'Ver menos' : 'Ver los ' + orden0.length + ' servidores'}</button>
        ) : null}
      </div>
      <span className="pw-der"><time>{hace(liga, xs[0].t)}</time></span>
    </article>
  );
}

// ── una publicación: la fuerte grande (como la destacada de Lo último), lo demás en renglón ──
export function Fila({ liga, it, A, P, nuevo }) {
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
          <div className="pw-top"><Autor liga={liga} it={it} pub={pub} /><time>{hace(liga, it.t)}</time></div>
          <span className="pw-cat">{c.cat}</span>
          {/* 🌙 la noche: el título corto en grande y la lista de campeones debajo (en Anton, la lista entera era un bloque) */}
          <p className="pw-fu-t">{it.tipo === 'resnoche' ? plano(liga, it) : c.txt}</p>
          {it.tipo === 'resnoche' ? <p className="pw-t chico">{c.txt}</p> : null}
          {c.det ? <small className="pw-det">{c.det}</small> : null}
          {logro || c.acc ? <div className="pw-acc">{logro ? <Felicitar liga={liga} it={it} A={A} /> : null}{c.acc}</div> : null}
          {social}
          <OcultarMods it={it} fijo={liga.muroFijo} />
        </div>
      </article>
    );
  }
  return (
    <article className={'pw-f ' + tono + (c.media ? ' media' : '') + (nuevo ? ' nueva' : '')} data-pub={it.id || undefined}>
      <span className="pw-v">{c.media ? <img className="pw-logo" alt="" src={it.sv ? liga.logo(it.sv) : '/ul.png'} /> : c.vis}</span>
      <div className="pw-tx">
        {/* 🗣️ quién la firma (sin su cara: el dibujo de la izquierda ya es suyo) y de qué es */}
        <div className="pw-firma"><Autor liga={liga} it={it} pub={pub} cara={false} /><span className="pw-cat">{c.cat}</span></div>
        <p className="pw-t">{c.txt}</p>
        {c.det ? <small className="pw-det">{c.det}</small> : null}
        {c.media ? <div className="pw-media">{c.vis}</div> : null}
        {c.acc || (logro && it.tipo !== 'rango') ? <div className="pw-acc">{logro ? <Felicitar liga={liga} it={it} A={A} /> : null}{c.acc}</div> : null}
        {social}
        <OcultarMods it={it} fijo={liga.muroFijo} />
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
  ligahito: ['de ligas', 'de ligas'], mesaward: ['MES AWARDS', 'MES AWARDS'], crewtier: ['crew', 'crews'], resnoche: ['resumen', 'resúmenes'],
  podio: ['primer podio', 'primeros podios'], top10: ['top 10', 'top 10'], subio: ['subida', 'subidas'], racha: ['racha', 'rachas'],
  crewunion: ['de crews', 'de crews'], crewnueva: ['crew nueva', 'crews nuevas'], svlunes: ['de servidores', 'de servidores'],
  svsemana: ['cierre', 'cierres'], svmeta: ['meta', 'metas'], svtop: ['#1 nuevo', '#1 nuevos'], svrecord: ['récord', 'récords'],
  svnuevo: ['socio nuevo', 'socios nuevos'], svtier: ['tier', 'tiers'], svchat: ['del chat', 'del chat'],
  // ⚠️ faltaban (18/11/2026) y salía la clave interna: el lunes 16/11 cerrado decía «1 LIGA · 1 ELEGIDO»
  liga: ['de la Liga', 'de la Liga'], elegido: ['El Elegido', 'El Elegido'], premios: ['premios de la semana', 'premios de la semana'],
  sobrevivio: ['sobrevivió', 'sobrevivieron'], sorteo: ['sorteo', 'sorteos'] };
function ResumenDia({ liga, xs, abrir }) {
  const top = xs.filter((it) => it.tipo === 'campeon' || it.tipo === 'caza' || it.tipo === 'precio' || (it.tipo === 'ligahito' && it.que === 'campeon')).slice(0, 10);
  const c = {};
  xs.forEach((it) => { c[it.tipo] = (c[it.tipo] || 0) + 1; });
  return (
    <div className="pw-res">
      {top.length ? (
        <div className="pw-res-c">
          {top.map((it) => {
            const k = ksDe(it)[0] || (liga.quien((it.quien || [])[0]) || {}).k || '';
            const cual = cartaDe(liga, k);
            const n0 = liga.aka((it.quien || [])[0] || '', k);
            return (
              <a key={it.id || it.t} href={'#/publicaciones/' + (it.id || '')}>
                {cual ? <Carta liga={liga} k={k} cual={cual} cls="pw-res-carta" abre={false} /> : <Cara liga={liga} k={k || ''} nombre={n0} cls="cara pw-res-cara" />}
                <small>{n0}</small><small className="g">{it.tipo === 'campeon' ? siglaDe(it.sv) : it.tipo === 'ligahito' ? 'liga' : 'Most Wanted'}</small>
              </a>
            );
          })}
        </div>
      ) : null}
      {/* un tipo nuevo sin nombre en NOMBRE_T no se cuenta acá, en vez de salir con su clave */}
      <div className="pw-res-n">{Object.entries(c).filter(([t]) => NOMBRE_T[t]).map(([t, n]) => <span key={t}><b>{n}</b>{NOMBRE_T[t][n === 1 ? 0 : 1]}</span>)}</div>
      <button type="button" className="btn borde2 chico" onClick={abrir}>Ver el día</button>
    </div>
  );
}

// ── los minis del panel: lo de esta semana; tocar uno filtra ──
function Minis({ liga, todos, setFil, desliza }) {
  const sem = todos.filter((it) => utc(it.t) >= liga.desdeLunes());
  const n = (ts) => sem.filter((it) => ts.includes(it.tipo)).length;
  const xs = [['campeones', 'Campeones', n(['campeon']), 'v'], ['rangos', 'Suben de rango', n(['rango']), 'o'], ['cartas', 'Cartas nuevas', n(['tarjeta']), 'p'],
    ['logros', 'Logros', n(TIPOS.logros), 'a']];
  return (
    <div className={'pw-minis' + (desliza ? ' desl' : '')}>
      {xs.map(([f, t, v, c]) => (
        <button type="button" key={f} className={'pw-mini ' + c} onClick={() => setFil(f)}><span>{t}</span><b>{num(v)}</b><small>esta semana</small></button>
      ))}
    </div>
  );
}

// ── la hoja de una publicación: lo suyo arriba y el hilo entero (`Hilo` se abre solo con `__pubFoco`) ──
// `onCerrar`: abierta desde afuera de esta página (`HojaComentarios`, abajo), cerrar no toca la dirección
function Hoja({ liga, it, A, P, onCerrar }) {
  const pub = usePases();
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
  }, [it && it.id]);
  // 🎬 EL VIDEO Y LA CARTA, DELANTE (18/11/2026): la hoja es un <dialog> modal (la capa de arriba, todo lo demás inerte), y la
  // ventana del video y el visor de la carta son capas comunes de App.jsx: el ▶ de una promo arrancaba el video con sonido
  // DETRÁS de la hoja, sin verse y sin poder cerrarlo. Al abrirse uno de los dos, la hoja se cierra y vuelve a la lista
  useEffect(() => {
    const f = (e) => { const d = ref.current; if (e && e.detail && d && d.open) d.close(); };
    window.addEventListener('lg:video', f);
    window.addEventListener('lg:carta', f);
    return () => { window.removeEventListener('lg:video', f); window.removeEventListener('lg:carta', f); };
  }, []);
  if (!it) return null;
  const c = contenido(liga, it, pub);
  if (!c) return null;
  const cerrar = () => { if (ref.current && ref.current.open) ref.current.close(); };
  const hilo = delHilo(it, Date.now());
  // ↩️ CERRAR NO SUMA UN PASO (18/11/2026): `location.hash = …` empujaba otra entrada y el historial quedaba [lista, hoja,
  // lista], así que «Atrás» volvía a abrir la hoja recién cerrada. La lista ocupa el lugar de la hoja (con `urlLG()`: con
  // <base href="/">, un '#/x' suelto deja la dirección en /#/x) y `lg:dir` hace que la app vuelva a leer la ruta
  const alCerrar = () => {
    try {
      history.replaceState(history.state, '', window.urlLG ? window.urlLG('#/publicaciones') : '/freestyle-rap/publicaciones');
      window.dispatchEvent(new Event('lg:dir'));
    } catch (e) { location.hash = '#/publicaciones'; }
  };
  return (
    <dialog ref={ref} className="pn-pop pw-hoja" aria-label={c.cat} onClose={onCerrar || alCerrar}
      onClick={(e) => { if (e.target === ref.current) cerrar(); }}>
      <PopCab ico="globo" t={c.cat} sub={hace(liga, it.t)} cerrar={cerrar} />
      <div className="pw-hoja-in">
        <div className="pw-hoja-p">
          {c.media ? null : <span className="pw-v">{c.vis}</span>}
          <div className="pw-tx"><Autor liga={liga} it={it} pub={pub} cara={false} /><p className="pw-t">{c.txt}</p>{c.det ? <small className="pw-det">{c.det}</small> : null}
            {c.media ? <div className="pw-media">{c.vis}</div> : null}
            <div className="pw-acc">{LOGROS[it.tipo] ? <Felicitar liga={liga} it={it} A={A} /> : null}{c.acc}</div>
            {/* abierta desde afuera, sin el globito: el hilo ya está abierto justo debajo */}
            {it.id ? <LuSocial liga={liga} it={it} A={A} hilo={hilo} P={P} sinCm={!!onCerrar} /> : null}</div>
        </div>
        <Hilo liga={liga} it={it} />
      </div>
    </dialog>
  );
}

/**
 * 💬 LA MISMA HOJA, ENCIMA DEL INICIO (21/11/2026). Dlx: «cada vez q le doy a comentar una publicación en inicio o q puedo
 * hacerlo desde ahí q no me lleve directamente a publicaciones». Tocar «Comentar», el globito o la nube de un comentario
 * en el Inicio abría esta página. Ahora abre esta hoja —la publicación arriba, el hilo entero ya abierto y la caja para
 * escribir— sin cambiar de página: la pide `abrirComentarios()` (comentarios.jsx) y la monta App.jsx. Este pedazo, con su
 * CSS, baja recién al primer toque. «Atrás» en el celular la cierra, como el visor de historias; ir a otra página desde
 * adentro (un perfil, la carta) también
 */
export function HojaComentarios({ liga, it, onCerrar }) {
  const A = useAplausos();
  useComentarios();
  const P = usePase(typeof window !== 'undefined' && !!window.DC);
  const pub = usePases();
  // el hilo se abre solo con `__pubFoco` (ver `Hilo`): se pone antes de dibujarlo
  if (typeof window !== 'undefined') window.__pubFoco = it.id;
  const cerrarR = useRef(onCerrar);
  cerrarR.current = onCerrar;
  const ok = !!contenido(liga, it, pub);
  useEffect(() => {
    let paso = false;
    try { history.pushState(Object.assign({}, history.state || {}, { lgCm: 1 }), ''); paso = true; } catch (e) { /* sin historial */ }
    const pop = () => { if (paso) { paso = false; cerrarR.current(); } };
    const dir = () => cerrarR.current();
    window.addEventListener('popstate', pop);
    window.addEventListener('lg:dir', dir);
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('lg:dir', dir);
      if (window.__pubFoco === it.id) window.__pubFoco = '';
      // cerrada con la X, Escape o tocando afuera: el paso que se sumó al abrir se saca (si se fue a otra página, no)
      if (paso && history.state && history.state.lgCm) { try { history.back(); } catch (e) { /* queda un paso de más */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // una que esta hoja no sabe dibujar: a su lugar en Publicaciones, como antes
  useEffect(() => {
    if (ok) return;
    cerrarR.current();
    location.hash = '#/publicaciones/' + encodeURIComponent(it.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);
  if (!ok) return null;
  // 🎨 adentro de un `.pw`, como en su página: ahí viven sus colores (va en negro) y tres reglas suyas. Afuera, el nombre del
  // autor salía casi negro sobre el fondo oscuro y «Felicitar» en blanco (medido: rgb(3,3,4) contra rgb(246,246,246) en
  // Publicaciones). `display: contents`: hereda sin dibujar una caja (la hoja va en la capa de arriba igual)
  return <div className="pw" style={{ display: 'contents' }}><Hoja liga={liga} it={it} A={A} P={P} onCerrar={() => cerrarR.current()} /></div>;
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
  // 👥 la lista entera de a quién sigues (18/11/2026): `liga.sigue` está filtrada por las 200 filas, y «A quién sigues»,
  // el círculo «A quien sigo» y su filtro dejaban afuera a los de más allá del corte
  const sigo = liga.sigueTodos || liga.sigue || [];
  // 📅 SIN LOS EVENTOS ANUNCIADOS (Dlx, 16/11/2026: «que en publicaciones haya todo lo demás menos anuncios de eventos…
  // por eso está la página de eventos»). El muro los sigue trayendo: los usa el Inicio (`arriba.jsx`). Quedan las
  // novedades de la Liga y los flyers de las ligas, en el chip «Anuncios»
  const todos = useMemo(() => liga.muroLimpio().filter((it) => it.tipo !== 'anuncio'), [liga]);
  const visto = useVisto(todos);
  // ⬆️ al filtrar desde abajo, la lista vuelve al principio. 🔴 Se mide una marca justo antes de la barra, no la barra
  // (18/11/2026): la barra es `sticky; top:0`, pegada arriba su top es 0 y nunca negativo, así que no subía nunca y el
  // primer resultado quedaba por encima de la pantalla
  const marca = useRef(null);
  const subir = () => { const m = marca.current; if (m && m.getBoundingClientRect().top < 0) m.scrollIntoView({ block: 'start' }); };
  const setFil = (f) => { setFil0(f); setDias(4); subir(); };
  const setSv = (s) => { setSv0(s); setDias(4); };
  const qn = limpio(q).toLowerCase();
  const pasaSv = (it) => (!sv ? true : sv === 'sigo' ? ksDe(it).some((k) => sigo.includes(k)) : liga.svDe(it) === sv);
  const pasaQ = (it) => {
    if (!qn) return true;
    // (y por su nombre oficial: «Velatz» encuentra lo que la llave escribió «velatzzzz»)
    const txt = [...(it.quien || []), ...genteDe(liga, it).map((x) => x.n), it.ev, it.tit, it.ln, it.a, it.a ? liga.aka(it.a) : '', it.n, siglaDe(liga.svDe(it))]
      .filter(Boolean).map((x) => limpio(x).toLowerCase()).join(' ');
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
  // ⚠️ el que se abre por su link se busca en TODO el muro: los avisos de comentario y los links compartidos de un evento
  // anunciado (de antes del 16/11) llevan acá, y fuera de la lista no abrían nada (revisión del 16/11)
  const foco0 = idFoco ? liga.muroLimpio().find((it) => it.id === idFoco) : null;
  const hoyK = liga.diaClave(liga.ahora);
  const titulo = (k) => {
    if (k === hoyK) return 'Hoy';
    const f = liga.fechaLarga(k + 'T16:00:00Z');
    return f.charAt(0).toUpperCase() + f.slice(1);
  };
  const fecha = (k) => { const [, m, d] = k.split('-').map(Number); return d + ' de ' + (MESES[m - 1] || ''); };
  // 🆕 sobre lo que se dibuja (`pubs`), no sobre todo el muro (18/11/2026): con un chip, un servidor o una búsqueda sin nada
  // nuevo, el primer día (de hace semanas) decía «3 nuevas» y la raya «Lo de arriba salió desde tu última visita» caía
  // debajo de una publicación vieja
  const nuevas = visto ? pubs.filter((it) => utc(it.t) > visto).length : 0;
  // 📰 LA EDICIÓN DEL DÍA (20/11/2026, edicion.jsx): sin filtro, ni servidor, ni búsqueda, Publicaciones es la edición;
  // con cualquiera de los tres, la lista de siempre. Lo que se fue (AskUserQuestion, 20/11): «¿Quién gana la final?» (sigue
  // en el chat del bot en vivo), las Encuestas (en el Premio gratis del Inicio) y «Lo más felicitado» («Felicita hoy»)
  const pub = usePases();
  const eds = useDias(liga, todos);
  const [di, setDi] = useState(0);
  const lista = enteros || !eds.length;
  const H = { contenido, LOGROS, Felicitar, Autor, hace, Avisame, pub };
  const fila = (it, nuevo) => (it.tipo === 'g-tarjeta' ? <CartasG liga={liga} xs={it.xs} nuevo={nuevo} />
    : it.tipo === 'g-rango' ? <RangosG liga={liga} xs={it.xs} nuevo={nuevo} />
        : it.tipo === 'g-crewtier' ? <Tiers liga={liga} xs={it.xs} visto={visto} A={A} P={P} />
          : it.tipo === 'g-svlunes' || it.tipo === 'g-svsemana' ? <ServidoresG liga={liga} xs={it.xs} nuevo={nuevo} />
            : LOGRO_G[String(it.tipo).slice(2)] && it.tipo.startsWith('g-') ? <LogrosG liga={liga} xs={it.xs} nuevo={nuevo} />
          : <Fila liga={liga} it={it} A={A} P={P} nuevo={nuevo} />);
  let raya = false;
  return (
    <div className="pw">
      {lista ? <Escenario liga={liga} xs={destacadas} A={A} /> : <EdCab liga={liga} todos={todos} D={eds[Math.min(di, eds.length - 1)]} H={H} />}
      <Circulos liga={liga} todos={todos} sv={sv} setSv={setSv} sigo={sigo} visto={visto} />
      <div ref={marca} aria-hidden="true" />
      <div data-tuto="pb-fil" className="pw-barra">
        <label className="pw-busca"><Ico n="buscar" t={16} />
          <input id="pw-busca" type="search" value={q} onChange={(e) => { setQ(e.target.value); setDias(4); }} placeholder="Busca un rapero, servidor o evento"
            aria-label="Buscar en las publicaciones" />
          {q ? <button type="button" className="pw-busca-x" aria-label="Borrar la búsqueda" onClick={() => setQ('')}>×</button> : null}</label>
        <div className="pw-chips" role="group" aria-label="Qué ver">
          {FILTROS2.filter(([f]) => !f || cuenta[f] || fil === f).map(([f, t]) => (
            <button type="button" key={f || 'todo'} className={fil === f ? 'on' : ''} aria-pressed={fil === f} onClick={() => setFil(f)}>{t}<em>{num(cuenta[f] || 0)}</em></button>
          ))}
        </div>
      </div>
      {lista ? (
      <div className="pw-cuerpo">
        <div className="pw-solo-cel"><Minis liga={liga} todos={todos} setFil={setFil} desliza /></div>
        <main className="pw-muro">
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
          <div className="pw-solo-cel pw-pila"><Sigo liga={liga} sigo={sigo} onVer={() => setSv('sigo')} /><Avisame /></div>
        </main>
        <aside className="pw-rail">
          <Minis liga={liga} todos={todos} setFil={setFil} />
          {fil === 'promos' ? (
            <section className="pb-bloque">
              <h2 className="pb-st">Las promos</h2>
              <p className="pb-tx">Lo que comparten los raperos en el canal de promoción de su servidor, y los videos de nuestros participantes que
                promociona la Liga. Cada promo está una semana (la tuya la puedes alargar en la <a href="#/tienda">Tienda</a>). Ábrelas con tu
                cuenta de Discord: cada una te da <b>50 Puntos de Tienda</b> (hasta 3 por día) y suma a tu Pase.</p>
            </section>
          ) : null}
          <Sigo liga={liga} sigo={sigo} onVer={() => setSv('sigo')} />
          <Avisame />
        </aside>
      </div>
      ) : <Edicion liga={liga} todos={todos} dias={eds} di={di} setDi={setDi} A={A} P={P} H={H} />}
      {foco0 ? <Hoja liga={liga} it={foco0} A={A} P={P} /> : null}
    </div>
  );
}
