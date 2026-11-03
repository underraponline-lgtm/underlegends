// Las piezas del muro (bot/muro.py: lo que pasa en la Liga, contado solo, y los anuncios de todos los servidores) que
// usan otras páginas: cada publicación (`Pub`), con lo de verdad de cada cosa —la carta, la letra, el logo— y
// 👏 Felicitar en los logros, que le llega al teléfono a quien felicitan; las cartas nuevas de un día (`Cartas`), y
// `PLATAFORMA`. Las usan el perfil, la página de cada servidor y Publicaciones, que es publicaciones2.jsx desde el
// 02/11/2026 (Dlx: «Publica y haz todo»). La página de antes —la de la 1.99— vivía acá y se borró al publicar el remake.
//
// ⚠️ NO SOBRECARGAR (Dlx, 02/10: «la cosa no es sobrecargar las cosas»): las cartas nuevas de un mismo día van en UNA
// publicación —eran 46 de 80 renglones—, y Felicitar va sólo en los logros de verdad (campeón, rango, Most Wanted).
import { MESES, ksDe, limpio, num, siglaDe } from './liga.js';
import { Escudo, escudoDe } from './escudo.jsx';
import { Cara, Carta, Ico, accion, promoAbierta } from './piezas.jsx';
import { Miniatura, abrirVideo } from './video.jsx';

// 📣 las promociones de los servidores (bot/promos.py, 16/10/2026): su pestaña, y no van en «En la Liga»
// `dc` y `web` sólo los agrega Dlx a mano (bot/promos.py `a_mano()`, 20/10/2026)
export const PLATAFORMA = { yt: 'YouTube', sp: 'Spotify', sc: 'SoundCloud', ig: 'Instagram', tt: 'TikTok', dc: 'Discord', web: 'la página' };
// los logros: lo que se puede felicitar (una carta nueva le toca a todo el que juega una vez: no es un logro)
const LOGROS = { campeon: 1, rango: 1, caza: 1, sobrevivio: 1, pase: 1, sorteo: 1, ligahito: 1, mesaward: 1 };
// 🏆 las categorías de los MES AWARDS (bot/mes_awards.py)
const MES_CAT = { rapero: 'el Rapero del mes', revelacion: 'la Revelación del mes', batalla: 'la Batalla del mes', servidor: 'el Servidor del mes' };
// 🏆 las de «Ver las demás nominaciones», en una sola publicación por mes (`cat: 'otras'`, `lista: [[cat, nombre, ganador]]`)
const CARTA = { pais: 'de País', temporada: 'de Temporada', servidor: 'de Servidor', competitivo: 'Competitiva' };

// los perfiles de una publicación, siempre en lista: `ksDe()` de liga.js (en los premios `ks` es un objeto)

// 👏 los aplausos viven en aplausos.js (también los usan las historias): acá se re-exportan para perfil y servidor
// ⚠️ IMPORTARLO Y RE-EXPORTARLO: `export { x } from` no deja `x` definido acá, y este archivo lo usa (Publicaciones se rompió
// en producción el 18/10/2026 con «useAplausos is not defined»: lo encontró el recorrido, no la compilación)
import { useAplausos } from './aplausos.js';
export { useAplausos };

function Felicitar({ liga, it, A }) {
  const id = it.id;
  if (!id) return null;
  const n = Number(A.cu[id] || 0);
  const mio = !!A.mios[id];
  const yo = liga.yo;
  if (yo && ksDe(it).includes(yo.k)) return n ? <span className="pub-fel tuyo" title="Te felicitaron">👏 {num(n)}</span> : null;
  const err = A.err[id] && window.errorAplauso ? window.errorAplauso(A.err[id]) : '';
  return (
    <>
      <button type="button" className={'pub-fel' + (mio ? ' on' : '') + (A.va[id] ? ' va' : '')} aria-pressed={mio}
        disabled={mio || !!A.va[id]} onClick={() => { if (window.felicitar) window.felicitar(id); }}>
        <span aria-hidden="true">👏</span>{mio ? 'Felicitaste' : 'Felicitar'}{n ? <em>{num(n)}</em> : null}
      </button>
      {err ? <small className="pub-err" role="status">{err}</small> : null}
    </>
  );
}

// ── una publicación: lo que se ve, qué dice y qué se puede hacer ──────────────────────────────────────────────────
export function Pub({ liga, it, A }) {
  const q = (it.quien || []).map(limpio);
  const ks = Array.isArray(it.ks) ? it.ks : [];
  const nombres = q.map((n, i) => (ks[i] && liga.T[ks[i]] ? <a key={i} href={'#/r/' + encodeURIComponent(ks[i])}>{n}</a> : <b key={i}>{n}</b>))
    .reduce((acc, x, i) => (i ? acc.concat([i === q.length - 1 ? ' y ' : ', ', x]) : [x]), []);
  let cat = '';
  let vis = null;
  let txt = null;
  let det = '';
  let acc = null;
  const f0 = ks[0] ? liga.T[ks[0]] : null;
  if (it.tipo === 'campeon') {
    cat = 'CAMPEÓN · ' + siglaDe(it.sv);
    vis = f0 && (f0.c || []).includes('temporada') ? <Carta liga={liga} k={f0.k} cual="temporada" cls="pub-carta" abre={false} />
      : <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls="cara pub-cara" />;
    txt = <>{nombres}{q.length > 1 ? ' se quedan con ' : ' se queda con '}<b>{limpio(it.ev)}</b></>;
    det = it.part ? it.part + ' raperos' : '';
    acc = it.ll ? <button type="button" className="pub-a" onClick={() => accion.llave(it.ll)}>Ver la llave</button> : null;
  } else if (it.tipo === 'rango') {
    cat = it.primero ? 'PRIMERA LETRA' : 'SUBE DE RANGO';
    vis = <span className="pub-rg" style={{ background: liga.colorRg(it.rg) }}>{it.rg}</span>;
    txt = <>{nombres}{it.primero ? ' consigue su primera letra: ' : ' pasa a rango '}<b>{it.rg}</b></>;
    acc = ks[0] ? <a className="pub-a" href={'#/r/' + encodeURIComponent(ks[0])}>Ver su perfil</a> : null;
  } else if (it.tipo === 'caza') {
    cat = 'MOST WANTED · CAZA';
    vis = <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls="cara pub-cara" />;
    // ⚠️ en equipo son varios: «JJ, Snow, Verc y yinn cazó» (14/10/2026)
    txt = <>{nombres}{q.length > 1 ? ' cazaron a ' : ' cazó a '}<b>{limpio(it.a)}</b> ({it.cat}) y {q.length > 1 ? 'cobran' : 'cobra'} <b>{num(it.pts)}</b></>;
    det = it.ev ? limpio(it.ev) : '';
  } else if (it.tipo === 'sobrevivio') {
    cat = 'MOST WANTED · SOBREVIVIÓ';
    vis = <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls="cara pub-cara" />;
    txt = <>{nombres} sobrevivió al Most Wanted ({it.cat}) y se lleva <b>{num(it.pts)}</b></>;
  } else if (it.tipo === 'crewtier') {
    // 🏆 una crew que sube de tier al cerrar la semana (bot/muro.py `crews_suben()`, 19/10/2026)
    const col = (liga.d.crews_tiers && (liga.d.crews_tiers.colores || [])[it.tier]) || '#E41373';
    cat = 'CREWS · SUBE DE TIER';
    vis = /^esc:/.test(it.logo || '') ? <span className="pub-logo con-esc"><Escudo e={escudoDe(it.logo, it.nombre)} /></span>
      : it.logo ? <img className="pub-logo" alt="" src={it.logo} /> : <span className="pub-rg" style={{ background: col }}>{String(it.tn || '').slice(0, 2)}</span>;
    txt = <><b>{limpio(it.nombre)}</b> sube a <b style={{ color: col }}>{it.tn}</b>{it.tarjeta ? ' y desbloquea su tarjeta de crew' : ''}</>;
    det = it.pts ? num(it.pts) + ' puntos en la semana' : '';
    acc = <a className="pub-a" href={'#/crew/' + encodeURIComponent(it.crew)}>Ver la crew</a>;
  } else if (it.tipo === 'pase') {
    // 🎟️ llegar a un nivel del Pase que se publica, o completarlo (Dlx, 06/10/2026: «5. c»)
    cat = it.completo ? 'PASE DE RAPERO · COMPLETO' : 'PASE DE RAPERO';
    vis = <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls="cara pub-cara" />;
    txt = it.completo ? <>{nombres} completó el <b>Pase de rapero</b> y entra al Salón del Pase</>
      : <>{nombres} llegó al nivel <b>{it.nivel}</b> del Pase de rapero{it.premio ? <>: <b>«{it.premio}»</b></> : null}</>;
    acc = <a className="pub-a" href="#/pase">Ver el Pase</a>;
  } else if (it.tipo === 'sorteo') {
    // 🎟️ el sorteo del Pase premium (Dlx, 25/10/2026: «dale pero en publicaciones»): quién ganó, que entrar era gratis y
    // cómo se eligió, con la semilla para repetir la cuenta (`sortear()` de bot/avisos.js; `sorteos()` de bot/muro.py)
    cat = 'SORTEO DEL PASE PREMIUM';
    vis = <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls="cara pub-cara" />;
    txt = <>{nombres} ganó el sorteo y se lleva el rol <b>«Pase Premium»</b> de DRA</>;
    det = num(it.personas) + ' entraron gratis · ' + num(it.boletos) + ' boletos · semilla ' + String(it.semilla || '').slice(0, 12) + '…';
    acc = <a className="pub-a" href="#/pase">Ver el Pase</a>;
  } else if (it.tipo === 'precio') {
    cat = 'PRECIO POR SU CABEZA';
    vis = <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls="cara pub-cara" />;
    txt = <>{nombres}{q.length > 1 ? ' le ganaron a ' : ' le ganó a '}<b>{limpio(it.a)}</b> y cobra el precio por su cabeza: <b>{num(it.pts)}</b></>;
    det = it.ev ? limpio(it.ev) : '';
  } else if (it.tipo === 'premios') {
    cat = 'PREMIOS DE LA SEMANA';
    vis = <img className="pub-logo" alt="" src="/ul.png" />;
    const p = [it.figura ? 'figura: ' + limpio(it.figura[0]) : '', it.revelacion ? 'revelación: ' + limpio(it.revelacion[0]) : '',
      it.cazador ? 'cazador: ' + limpio(it.cazador[0]) : '', it.servidor ? 'servidor: ' + siglaDe(it.servidor[0]) : ''].filter(Boolean);
    txt = <b>{p.join(' · ')}</b>;
  } else if (it.tipo === 'elegido') {
    cat = 'EL ELEGIDO';
    vis = <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls="cara pub-cara" />;
    txt = <>La gente eligió a {nombres} como El Elegido del Most Wanted</>;
    det = it.de ? it.votos + ' de ' + it.de + ' votos' : '';
  } else if (it.tipo === 'mesaward') {
    // 🏆 un ganador de los MES AWARDS (bot/mes_awards.py, 16/10/2026)
    const mes = MESES[Number(String(it.mes || '').slice(5, 7)) - 1] || '';
    cat = 'MES AWARDS · ' + mes.toUpperCase();
    // 🏟️ los de cada servidor (18/10/2026): una publicación por servidor, con su escudo y sus ganadores
    const deSv = String(it.cat || '').startsWith('sv:');
    if (deSv) cat = 'MES AWARDS · ' + siglaDe(it.sv) + ' · ' + mes.toUpperCase();
    vis = deSv ? <img className="pub-logo" alt="" src={liga.logo(it.sv)} />
      : it.cat === 'otras' ? <span className="pub-logo pub-mes" aria-hidden="true"><Ico n="copa" t={30} /></span>
      : it.cat === 'batalla' && it.vid ? (
      <button type="button" className="pub-promo-v" onClick={() => abrirVideo({ vid: it.vid, tit: limpio(it.n || ''), link: 'https://www.youtube.com/watch?v=' + it.vid })}
        aria-label={'Mirar ' + limpio(it.n || 'la batalla')}><Miniatura vid={it.vid} cls="pub-promo-img" /><span aria-hidden="true">▶</span></button>
    ) : it.cat === 'servidor' ? <img className="pub-logo" alt="" src={liga.logo(it.sv)} /> : <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls="cara pub-cara" />;
    txt = deSv ? <>Los ganadores de <b>{mes}</b> en {siglaDe(it.sv)}:{' '}
      {(it.lista || []).map((y, i) => <span key={y[0]}>{i ? ' · ' : ''}{y[1]}: <b>{limpio(y[2])}</b>{y[3] ? ' (' + y[3] + '%)' : ''}</span>)}</>
      : it.cat === 'otras' ? <>Los demás ganadores de <b>{mes}</b>:{' '}
      {(it.lista || []).map((y, i) => <span key={y[0]}>{i ? ' · ' : ''}{y[1]}: <b>{limpio(y[2])}</b>{y[3] ? ' (' + y[3] + '%)' : ''}</span>)}</>
      : it.cat === 'batalla' ? <><b>{limpio(it.n)}</b> es la Batalla del mes de {mes}</>
      : it.cat === 'servidor' ? <><b>{limpio(it.n)}</b> es el Servidor del mes de {mes}</>
        : <>{nombres} es {MES_CAT[it.cat] || 'ganador'} de <b>{mes}</b></>;
    // 📊 con su porcentaje (Dlx, 18/10/2026: «me gusta lo de porcentajes»)
    det = it.cat === 'otras' || deSv ? '' : it.por === 'votos'
      ? (it.pct ? it.pct + '% de los votos · ' : '') + num(it.votos) + (it.votos === 1 ? ' voto' : ' votos') + (it.total ? ' de ' + num(it.total) : '')
      : 'por los números del mes';
    acc = deSv ? <a className="pub-a" href={'#/sv/' + encodeURIComponent(it.sv)}>{siglaDe(it.sv)}</a> : <a className="pub-a" href="#/salon">El Salón de la fama</a>;
  } else if (it.tipo === 'promo') {
    // 📣 lo que un rapero compartió en el canal de promoción de su servidor (bot/promos.py, 16/10/2026): el video se mira
    // acá; lo demás abre en su plataforma. El título es el de la plataforma, no el texto del mensaje
    const plat = PLATAFORMA[it.plat] || 'su link';
    // 📣 la Liga también promociona: los videos de nuestros participantes (`o: 'liga'`, bot/promos.py `de_la_liga()`)
    const deLiga = it.o === 'liga' || it.o === 'mano';
    cat = deLiga ? 'LA LIGA PROMOCIONA' : 'PROMO · ' + siglaDe(it.sv);
    vis = it.vid ? (
      <button type="button" className="pub-promo-v" onClick={() => { promoAbierta(it.id); abrirVideo({ vid: it.vid, tit: limpio(it.tit || ''), link: it.url }); }}
        aria-label={'Mirar ' + (it.tit ? limpio(it.tit) : 'el video')}><Miniatura vid={it.vid} cls="pub-promo-img" /><span aria-hidden="true">▶</span></button>
    ) : it.img ? <a className="pub-promo-v" href={it.url} target="_blank" rel="noopener noreferrer" aria-label={'Abrir en ' + plat} onClick={() => promoAbierta(it.id)}><img className="pub-promo-img" alt="" src={it.img} loading="lazy" /></a>
      : <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls="cara pub-cara" />;
    // ✋ una de Dlx sin «de quién» (un servidor de Discord, una página): el título o, sin él, el sitio
    const sitio = String(it.url || '').replace(/^https:\/\/(www\.)?/, '').split('/')[0];
    txt = deLiga && !(it.quien || []).filter(Boolean).length ? <b>{limpio(it.tit || sitio)}</b>
      : deLiga ? <>{nombres} en <b>{limpio(it.tit || plat)}</b></>
      : it.tit ? <>{nombres} comparte <b>{limpio(it.tit)}</b></> : <>{nombres} comparte algo en <b>{plat}</b></>;
    det = plat + (it.de && it.de !== it.tit ? ' · ' + it.de : '');
    acc = <a className="pub-a" href={it.url} target="_blank" rel="noopener noreferrer" onClick={() => promoAbierta(it.id)}>{it.plat === 'sp' || it.plat === 'sc' ? 'Escuchar' : 'Ver'} en {plat} ↗</a>;
  } else if (it.tipo === 'ligahito') {
    // 🏟️ lo que pasa en las ligas de los servidores (bot/ligas.py `hitos()`, 16/10/2026): invicto, la punta y el campeón
    const ir = '#/ligas/' + encodeURIComponent(it.liga || '');
    cat = (it.que === 'campeon' ? 'CAMPEÓN DE LIGA' : it.que === 'invicto' ? 'LIGA · INVICTO' : 'LIGA · LA PUNTA') + ' · ' + siglaDe(it.sv);
    vis = <Cara liga={liga} k={ks[0] || ''} nombre={q[0] || '?'} cls="cara pub-cara" />;
    txt = it.que === 'campeon' ? <>{nombres} es el campeón de <b>{limpio(it.ln)}</b></>
      : it.que === 'invicto' ? <>{nombres} lleva <b>{it.pg || 5} ganadas sin perder</b> en {limpio(it.ln)}</>
        : <>{nombres} tomó la punta de <b>{limpio(it.ln)}</b>{it.pts ? <> con {it.pts} puntos</> : null}</>;
    det = it.que === 'campeon' && (it.podio || []).length > 1 ? 'Podio: ' + it.podio.map(limpio).join(' · ') : '';
    acc = <a className="pub-a" href={ir}>Ver la liga</a>;
  } else if (it.tipo === 'anuncio') {
    cat = 'EVENTO · ' + siglaDe(it.sv);
    vis = <img className="pub-logo" alt="" src={liga.logo(it.sv)} />;
    txt = <b>{limpio(it.ev)}</b>;
    det = [it.mod, it.org ? 'organiza ' + it.org : '', it.pre ? 'premio: ' + it.pre : ''].filter(Boolean).join(' · ');
    acc = <>{it.link ? <a className="pub-a" href={it.link} target="_blank" rel="noopener noreferrer">Ver en Discord ↗</a> : null}
      <a className="pub-a" href="#/eventos">Eventos</a></>;
  } else if (it.tipo === 'flyer') {
    // 🖼️ EL FLYER DE UNA LIGA (Dlx, 14/10/2026: «Flyers en Publicaciones e Historias»): el afiche que publicó su
    // servidor, re-alojado (bot/ligas.py `subir_flyer()`), y a su liga en Ligas. Grande: la imagen ES la publicación
    const ir = '#/ligas/' + encodeURIComponent(it.liga || '');
    cat = 'LIGA · ' + siglaDe(it.sv);
    vis = <a className="pub-flyer" href={ir} aria-label={'Ver ' + limpio(it.ln)}>
      <img alt={'El flyer de ' + limpio(it.ln) + (it.tit ? ': ' + limpio(it.tit) : '')} src={it.img} loading="lazy"
        width={it.w || undefined} height={it.h || undefined} /></a>;
    txt = <><b>{limpio(it.ln)}</b>{it.tit ? <> publicó su flyer: {limpio(it.tit)}</> : ' publicó su flyer'}</>;
    acc = <><a className="pub-a" href={ir}>Ver la liga</a>
      {it.link ? <a className="pub-a" href={it.link} target="_blank" rel="noopener noreferrer">Ver en Discord ↗</a> : null}</>;
  } else if (it.tipo === 'liga') {
    cat = 'LA LIGA';
    vis = <img className="pub-logo" alt="" src="/ul.png" />;
    txt = <b>{limpio(it.tit)}</b>;
    det = it.tx ? limpio(it.tx).slice(0, 160) + (it.tx.length > 160 ? '…' : '') : '';
    acc = it.link ? <a className="pub-a" href={it.link} target="_blank" rel="noopener noreferrer">Ver en Discord ↗</a> : null;
  } else {
    return null;
  }
  return (
    <article className={'pub ' + it.tipo}>
      <div className="pub-v">{vis}</div>
      <div className="pub-c">
        <span className="pub-cat">{cat}<small>{liga.cuando(it.t)}</small></span>
        <p className="pub-t">{txt}</p>
        {det ? <small className="pub-d">{det}</small> : null}
        {LOGROS[it.tipo] || acc ? <div className="pub-acc">{LOGROS[it.tipo] ? <Felicitar liga={liga} it={it} A={A} /> : null}{acc}</div> : null}
      </div>
    </article>
  );
}

// ── las cartas nuevas de un día, juntas: una fila de cartas en vez de un renglón por carta ─────────────────────────
export function Cartas({ liga, xs }) {
  const vistos = new Set();
  const us = xs.filter((it) => { const k = (it.ks || [])[0]; if (!k || vistos.has(k)) return false; vistos.add(k); return true; });
  const n = us.length;
  const nombres = us.slice(0, 3).map((it) => limpio((it.quien || [])[0] || '')).join(', ');
  if (!n) return null;
  // una sola: como cualquier publicación, la carta al costado (en una fila de cartas quedaba sola y el resto vacío)
  if (n === 1) {
    const k = us[0].ks[0];
    return (
      <article className="pub tarjeta">
        <div className="pub-v"><button type="button" className="pub-mini" onClick={() => accion.carta(k)} aria-label={'La carta de ' + nombres}>
          <Carta liga={liga} k={k} cual={us[0].carta} cls="pub-carta" abre={false} /></button></div>
        <div className="pub-c">
          <span className="pub-cat">CARTA NUEVA<small>{liga.cuando(us[0].t)}</small></span>
          <p className="pub-t"><b>{nombres}</b> ya tiene su carta {CARTA[us[0].carta] || ''}</p>
          <div className="pub-acc"><button type="button" className="pub-a" onClick={() => accion.carta(k)}>Ver la carta</button>
            {liga.T[k] ? <a className="pub-a" href={'#/r/' + encodeURIComponent(k)}>Ver su perfil</a> : null}</div>
        </div>
      </article>
    );
  }
  return (
    <article className="pub cartas">
      <div className="pub-c">
        <span className="pub-cat">CARTAS NUEVAS<small>{liga.cuando(xs[0].t)}</small></span>
        <p className="pub-t"><b>{nombres}</b>{n > 3 ? ' y ' + (n - 3) + ' más' : ''} ya tienen su carta</p>
        <div className="pub-cartas">
          {us.slice(0, 12).map((it) => {
            const k = (it.ks || [])[0];
            return <button type="button" key={k + it.carta} className="pub-mini" onClick={() => accion.carta(k)} aria-label={'La carta de ' + limpio((it.quien || [])[0] || '')}>
              <Carta liga={liga} k={k} cual={it.carta} cls="pub-mini-c" abre={false} /></button>;
          })}
          {n > 12 ? <span className="pub-mas">+{n - 12}</span> : null}
        </div>
      </div>
    </article>
  );
}
