// 🤝 SOCIOS, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes»; para todos desde el mismo día («Publica
// y haz todo»), en lugar de socios.jsx. Lo mismo, ordenado con lo que dejó el research de 21st
// (scratchpad/remake2/research_tienda_salon_guia_socios.md):
// - EL MURO DE LOGOS EN LA PORTADA: cada servidor, con su color, lleva a su tarjeta.
// - LOS QUE YA JUGARON, EN TARJETA Y CON SU ORDEN («01, 02…», por puntos); LOS QUE TODAVÍA NO, en renglones cortos bajo
//   «Esperando su primer evento»: una tarjeta entera para decir «todavía nada» era la mitad de la lista.
// - LAS REDES COMO UN DIRECTORIO PAREJO (celdas iguales, ninguna sola en su fila), y los videos en una fila que se desliza
//   en el celular.
// - SUMAR TU SERVIDOR EN TRES PASOS, con lo que pide al lado del botón, y LO QUE HACE EL BOT Y LO QUE NUNCA HACE en dos
//   columnas: el miedo es el «bot de raid» (Dlx, 02/10/2026), y lo que ayuda es decirlo claro.
// ⚠️ LO QUE DICE TIENE QUE SER VERDAD HOY, como en socios.jsx: lo que gana cada servidor es `QUE_GANA` (sumar.jsx), lo
// que hace el bot es lo medido (lee anuncios y llaves, crea la invitación, y desde el 07/10/2026 publica el aviso de cada
// evento en el chat de los servidores que tienen prendido el bot en vivo). Lo que pide para sumarse: 300 miembros, se
// recomiendan 500 (Dlx, 18/10/2026), y escribirle a @itsdlx; lo demás se habla con él. Si algo cambia, se cambia acá.
//
// 🏁 6.77, CON LA ESTRUCTURA DE LA LLAVE (Dlx, 19/11/2026, «Haz todos» y, a la maqueta
// https://claude.ai/artifact/UZ1dJSxJT5vmZynCXfHm6Y, «A + la cartelera de B»): arriba, en la escena, la franja de
// cuatro números, LA GUERRA DE ESTA SEMANA (los pares, cada uno con su multiplicador contra el de la semana pasada, y
// quién ganó la anterior) y una columna con la tabla de servidores en barras —cada barra lleva a su cartel, como el muro
// de logos de antes— y «Unirme a los Tier 1». Abajo, en el papel, LA CARTELERA: un cartel por servidor con la carta de
// Servidor de su mejor (sin carta, su logo en su color), en pestañas por tier. Las piezas de la escena son las `rka-`
// del Ranking (ranking_a.jsx); lo de Socios, con `sk-`. Lo de más abajo (lo que publican, sumar tu servidor, la Liga en
// números) no cambió.
import { useState } from 'react';
import { limpio, mult, num, siglaDe } from './liga.js';
import { Algunos, Carta, Compartir, Ico, Sec, enlace } from './piezas.jsx';
import { LaLiga } from './medio.jsx';
import { REDES } from './servidor.jsx';
import { Miniatura, abrirVideo } from './video.jsx';
import CSS_VIEJO from './css/socios.css?inline';
import CSS_PAGINA from './css/socios2.css?inline';
import { usarCss } from './css.js';
import FondoVideo from './fondovideo.jsx';
import { UnirseTier1, tier1De } from './unirse.jsx';
import { Franja } from './ranking_a.jsx';

// las cajas de «lo que gana tu servidor», su ejemplo y las redes de Under Legends son las de siempre, con su CSS
usarCss('socios', CSS_VIEJO);
usarCss('socios2', CSS_PAGINA);

const idDe = (sv) => 'sk-' + siglaDe(sv).toLowerCase();
const irA = (id) => {
  const h = document.getElementById('inicio-nuevo');
  const s = h && h.shadowRoot ? h.shadowRoot.getElementById(id) : null;
  if (s) window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' });
};

// ── 🏅 SU TIER Y QUÉ LE CUENTA (Dlx, 13/11/2026: «en socios especificar qué TIER son cada socio y ver qué significa eso,
// para ver si cuentan puntos para el ranking de temporada y qué sv dan puntos para el ranking competitivo»). El tier y
// `cu` (t: suma a la Temporada, c: cuenta para el Competitivo, min: los participantes que pide si suma sólo a la
// Temporada) vienen del payload, de `datos/niveles.json`: lo mismo que leen el lector de llaves y el Score. Sin dato no
// hay pieza. Lo de cada tier es el PRESET de bot/tiers.py; lo de cada servidor —que Dlx puede cambiar en el Dashboard—
// va en su tarjeta ──
const TierChip = ({ s }) => (s.tier ? <em className={'sk-tier t' + s.tier}>TIER {s.tier}</em> : null);
const sumaTx = (min) => 'Suma a la Temporada' + (min ? ' (eventos de ' + min + ' o más)' : '');
const lista = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1] : xs[0] || '');
// los números del cartel, cortos: en 170 px de ancho «19.194.812» no entra, y «932,8 mil» tampoco (medido: se cortaba
// en «932,8 m»). Con «k» y «M» pegados entran los catorce
const corto = (n) => {
  const x = Number(n) || 0;
  if (x >= 1e6) return (x / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '') + 'M';
  if (x >= 1e5) return Math.round(x / 1e3) + 'k';
  if (x >= 1e4) return (x / 1e3).toFixed(1).replace('.', ',').replace(/,0$/, '') + 'k';
  return num(x);
};
// el multiplicador de la semana pasada: la entrada del historial que terminó cuando empezó ésta (`mult.hist`, de
// bot/multiplicadores.py: [inicio, fin, {sv: ×}]). Sin historial no hay contra qué comparar
function antDe(mm) {
  const h = (mm.hist || []).filter((x) => x && x[1] === mm.ini);
  return h.length ? h[h.length - 1][2] || {} : null;
}
// ×2 y, al lado, contra la semana pasada
function Mx({ x, ant, sv }) {
  const v = x || 1;
  if (!ant) return <span className="sk-mx">{mult(v)}</span>;
  const a = ant[sv];
  const cl = a == null ? 'eq' : v > a ? 'up' : v < a ? 'dn' : 'eq';
  return <span className={'sk-mx ' + cl}>{mult(v)}<small>{a == null ? 'nuevo' : v > a ? '▲ desde ' + mult(a) : v < a ? '▼ desde ' + mult(a) : 'igual'}</small></span>;
}
// 🥈 el Tier 2, todo lo del 1 menos «Unirme a los Tier 1» (Dlx, 19/11/2026; `PRESET` de bot/tiers.py), y las ligas del
// Tier 3 también son duelos desde el mismo día («que sus ligas sí cuenten si son tier 3»)
const QUE_TIER = (min) => ({
  1: ['Suma a la Temporada y al Competitivo', 'Sus ligas cuentan como duelos', 'Su carta de Servidor', 'Sale en «Unirme a los Tier 1»'],
  2: ['Suma a la Temporada y al Competitivo', 'Sus ligas cuentan como duelos', 'Su carta de Servidor'],
  3: [sumaTx(min), 'Sus ligas cuentan como duelos', 'No cuenta para el Competitivo'],
});

// ── ⚔️ LA GUERRA DE ESTA SEMANA: los pares (`mult.guerra.pares`), cada lado con su multiplicador, y quién ganó la pasada
// con sus puntos por rapero (`mult.ant.guerra`: `gana` y `ppp`). Cada lado lleva a su cartel ──
function Guerra({ liga, mm, ant, ir }) {
  const pares = ((mm.guerra || {}).pares || []).filter((p) => p && liga.svs[p[0]] && liga.svs[p[1]]);
  if (!pares.length) return null;
  const G = (mm.ant || {}).guerra || {};
  const gana = (G.gana || []).filter((sv) => liga.svs[sv]);
  const d = mm.fin ? liga.dia(mm.fin) : '';
  const lado = (sv, der) => {
    const s = liga.svs[sv];
    const img = <img alt="" src={liga.logo(sv)} />;
    return (
      <button type="button" className={'sk-gl' + (der ? ' d' : '')} onClick={() => ir(sv)} aria-label={'Ir a ' + (s.nombre || sv)}>
        {der ? null : img}<span><b>{siglaDe(sv)}</b><Mx x={(mm.sv || {})[sv]} ant={ant} sv={sv} /></span>{der ? img : null}
      </button>
    );
  };
  return (
    <div className="rka-caja sk-guerra">
      <h2 className="rka-h">La guerra de esta semana<small>{pares.length} {pares.length === 1 ? 'par' : 'pares'}{d ? ' · cierra ' + (/^(hoy|mañana)/.test(d) ? d : 'el ' + d) : ''}</small></h2>
      <p className="sk-g-baj">Gana el que más puntos hace por rapero en sus eventos, y la semana siguiente lleva ×1,5.</p>
      <div className="sk-g">
        {pares.map(([a, b]) => <div className="sk-gp" key={a + b}>{lado(a)}<span className="sk-vs" aria-hidden="true">VS</span>{lado(b, true)}</div>)}
      </div>
      {gana.length ? (
        <>
          <p className="rka-pie sk-g-pie">La semana pasada {gana.length === 1 ? 'ganó' : 'ganaron'} <b>{gana.length}</b>, con sus puntos por rapero:</p>
          <div className="sk-g-gan">
            {gana.map((sv) => <span key={sv}><img alt="" src={liga.logo(sv)} />{siglaDe(sv)}<small>{num((G.ppp || {})[sv])}</small></span>)}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── 📊 la tabla de servidores, en barras por puntos de la temporada: cada barra lleva a su cartel (hacía eso el muro) ──
function TablaSv({ liga, activos, ir }) {
  if (!activos.length) return null;
  const max = Math.max(1, ...activos.map((s) => s.pts || 0));
  return (
    <div className="rka-caja">
      <h2 className="rka-h">La tabla de servidores<small>por puntos de la {liga.temp}</small></h2>
      <ol className="sk-barras">
        {activos.map((s, i) => (
          <li key={s.sv}>
            <button type="button" className="sk-bar" style={{ '--c': s.color || '#29B298' }} onClick={() => ir(s.sv)} aria-label={(i + 1) + '.º, ' + (s.nombre || s.sv) + ': ' + num(s.pts) + ' puntos'}>
              <span className="p">{i + 1}</span><img alt="" src={liga.logo(s.sv)} />
              <span className="tr"><i style={{ width: Math.max(3, Math.round(100 * (s.pts || 0) / max)) + '%' }} /><b>{siglaDe(s.sv)}</b></span>
              <span className="n">{num(s.pts)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── 🎟️ UN CARTEL POR SERVIDOR (la cartelera de la B): la carta de Servidor de su mejor —lo que gana un servidor al
// sumarse, CLAUDE.md— y, sin carta todavía, su logo en su color. Debajo, sus números cortos, qué cuenta de sus eventos,
// el próximo o el último y su invitación ──
function Cartel({ liga, s, x }) {
  const mejor = liga.oficiales().find((f) => f.sv === s.sv);
  const conCarta = mejor && (mejor.c || []).includes('servidor');
  const prox = liga.luego().filter((e) => e.sv === s.sv)[0];
  // 🔑 la última por FECHA, no por número (18/11/2026): las de los registros en vivo llevan 9 cifras y quedaban siempre
  // primeras. Y con `nombreLlave()`, que no deja a la vista el «(sin titulo)» con que se guardan algunas
  const ll = prox ? null : liga.llavesPorFecha().find((l) => l.sv === s.sv);
  const camp = ll ? liga.campeon(ll) : [];
  const href = '#/sv/' + siglaDe(s.sv);
  const nombre = s.nombre || s.sv;
  const activo = !!(s.n || s.pts);
  return (
    <li className="sk-ct" id={idDe(s.sv)} style={{ '--c': s.color || '#29B298' }}>
      <a className="sk-af" href={href} aria-label={'La página de ' + nombre}>
        {conCarta ? <span className="sk-ct-cw"><Carta liga={liga} k={mejor.k} cual="servidor" cls="sk-ct-carta" abre={false} /></span>
          : <img className="sk-ct-lg" alt="" src={liga.logo(s.sv, true)} />}
        <span className="sk-ct-t"><TierChip s={s} /></span>
        <span className="sk-ct-x">{mult(x || 1)}</span>
      </a>
      <a className="sk-ct-n" href={href}>{nombre}</a>
      <small className="sk-ct-s">{siglaDe(s.sv)}{s.tag ? ' · ' + String(s.tag).toUpperCase() : ''}{mejor ? ' · su mejor, ' + limpio(mejor.n) : activo ? '' : ' · esperando su primer evento'}</small>
      <dl className="sk-ct-num">
        <div><dt>Raperos</dt><dd>{corto(s.n)}</dd></div>
        <div><dt>Puntos</dt><dd>{corto(s.pts)}</dd></div>
        <div><dt>Discord</dt><dd>{s.miembros ? corto(s.miembros) : '—'}</dd></div>
      </dl>
      {s.cu ? (
        <p className="sk-ct-cu" aria-label={'Qué cuenta de sus eventos: ' + (s.cu.t ? sumaTx(s.cu.min) : 'No suma a la Temporada') + '; ' + (s.cu.c ? 'cuenta para el Competitivo' : 'no cuenta para el Competitivo')}>
          <span className={s.cu.t ? 'si' : 'no'}>Temporada{s.cu.t && s.cu.min ? ' · ' + s.cu.min + '+' : ''}</span>
          <span className={s.cu.c ? 'si' : 'no'}>Competitivo</span>
        </p>
      ) : null}
      {/* ⏰ un sin_hora dice cuándo se anunció, no una hora de arranque que no tiene (revisión del 18/11/2026) */}
      {prox ? <p className="sk-ct-ev"><b>El próximo</b>{limpio(prox.nombre)} · {prox.sin_hora ? 'anunciado ' + liga.cuando(prox.cuando) : liga.dia(liga.cuandoDe(prox))}</p>
        : ll ? <p className="sk-ct-ev"><b>El último</b>{liga.nombreLlave(ll)}{camp.length ? <> · ganó <Algunos liga={liga} nombres={camp} /></> : ''}</p> : null}
      {s.invita ? <a className="sk-ct-ent" href={s.invita} target="_blank" rel="noopener noreferrer">Entrar a su Discord ↗</a> : null}
    </li>
  );
}

// cuántas columnas en la compu: de 5 a 7, la que deja menos lugares vacíos en la última fila (con 14, dos de 7)
function colsDe(n) {
  let mejor = 7; let hueco = 99;
  for (let c = 7; c >= 5; c -= 1) { const h = Math.ceil(n / c) * c - n; if (h < hueco) { hueco = h; mejor = c; } }
  return mejor;
}

// ── la cartelera, en pestañas: Todos, uno por tier y los que esperan su primer evento. Arriba, qué cuenta cada tier ──
function Cartelera({ liga, svs, esperan, tab, setTab }) {
  const mm = (liga.d.mult || {}).sv || {};
  const tiers = [1, 2, 3].filter((t) => svs.some((s) => s.tier === t));
  const tabs = [['todos', 'Todos', svs.length], ...tiers.map((t) => ['t' + t, 'Tier ' + t, svs.filter((s) => s.tier === t).length])];
  if (esperan.length) tabs.push(['esp', 'Esperando', esperan.length]);
  const t = tabs.some((x) => x[0] === tab) ? tab : 'todos';
  const xs = t === 'todos' ? svs : t === 'esp' ? esperan : svs.filter((s) => 't' + s.tier === t);
  // 🧩 (revisión 21/11/2026) en «Todos», los que esperan su primer evento van aparte, en carteles chicos y a lo ancho: con
  // los 16 en seis columnas quedaban 6, 6 y 4, y un hueco de dos carteles (~470×600) al final
  const aparte = t === 'todos' && xs.length - esperan.length >= 5 ? xs.filter((s) => esperan.includes(s)) : [];
  const ys = aparte.length ? xs.filter((s) => !aparte.includes(s)) : xs;
  const min = (svs.find((s) => s.cu && s.cu.min) || { cu: {} }).cu.min;
  const QUE = QUE_TIER(min);
  const leg = t === 'todos' || t === 'esp' ? tiers : tiers.filter((n) => 't' + n === t);
  return (
    <>
      {tabs.length > 1 ? (
        <div className="rka-pes" role="tablist" aria-label="Qué servidores ver">
          {tabs.map(([id, tx, n]) => (
            <button key={id} type="button" role="tab" aria-selected={t === id} className={t === id ? 'on' : ''} onClick={() => setTab(id)}>{tx}<small>{n}</small></button>
          ))}
        </div>
      ) : null}
      {/* 🏅 qué cuenta cada tier (Dlx, 13/11/2026: «especificar qué TIER son cada socio y ver qué significa eso»). Lo de
          cada servidor —que Dlx puede cambiar en el Dashboard— va en su cartel */}
      {leg.length ? (
        <dl className="sk-tleg">
          {leg.map((n) => <div key={n}><dt><TierChip s={{ tier: n }} /></dt><dd>{QUE[n].join(' · ')}</dd></div>)}
        </dl>
      ) : null}
      <ul className="sk-cart" style={{ '--cols': colsDe(ys.length) }}>
        {ys.map((s) => <Cartel key={s.sv} liga={liga} s={s} x={mm[s.sv]} />)}
      </ul>
      {aparte.length ? (
        <>
          <h3 className="sk-st sk-esp-t">Esperando su primer evento</h3>
          <ul className="sk-cart chicos">{aparte.map((s) => <Cartel key={s.sv} liga={liga} s={s} x={mm[s.sv]} />)}</ul>
        </>
      ) : null}
      <p className="sk-tleg-p">Y todos, sea cual sea su tier: sus eventos en el calendario, la campana y Publicaciones, su página y sus ligas.</p>
    </>
  );
}

// ── 📺 lo que publican: el video más nuevo de cada socio con YouTube (`feed`, `_feed()` de bot/subir_web.py) y las redes
// de cada uno, en un directorio parejo. Instagram y TikTok no tienen un feed abierto: de esos van los links ──
function Publican({ liga, svs }) {
  const uno = new Map();
  (liga.d.feed || []).filter((x) => x.tipo === 'youtube' && x.vid).forEach((x) => { if (!uno.has(x.sv)) uno.set(x.sv, x); });
  const vids = [...uno.values()].slice(0, 6);
  const conRedes = svs.filter((s) => (s.redes || []).length);
  if (!vids.length && !conRedes.length) return null;
  const n = conRedes.length;
  return (
    <Sec id="sk-publican" titulo="Lo que publican"
      bajada={'Promocionamos sus eventos y también lo que suben a sus redes: lo compartimos en las de Under Legends y acá.' + (vids.length ? ' Toca un video para verlo.' : '')}>
      {vids.length ? (
        <ul className="pf-vid sk-vid" style={{ '--n': vids.length }}>
          {vids.map((v) => (
            <li key={v.vid}>
              {/* 🧹 el título por limpio(), como en el Inicio (18/11/2026): venía crudo de YouTube, con emojis, banderas y
                  dibujos de caja («• 🚇 ╎FREESTYLE LEAGUE N°3 ╎ 🚇 •»), acá y en el visor */}
              <button type="button" className="pf-vid-b" onClick={() => abrirVideo({ vid: v.vid, tit: limpio(v.tit), link: v.link })}>
                <span className="pf-vid-m"><Miniatura vid={v.vid} cls="pf-vid-img" /><i aria-hidden="true">▶</i></span>
                <b>{limpio(v.tit)}</b>
                <small>{siglaDe(v.sv)} · {liga.cuando(v.t)}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {n ? (
        <>
          <h3 className="sk-st">Sus redes</h3>
          {/* en filas parejas: la cuenta de columnas sale del largo, como «los otros» de las páginas de cada servidor */}
          <ul className="sk-redes" style={{ '--cols': Math.ceil(n / Math.ceil(n / 4)), '--span': Math.ceil(n / Math.ceil(n / 4)) * Math.ceil(n / 4) - n + 1 }}>
            {conRedes.map((s) => (
              <li key={s.sv} style={{ '--c': s.color || '#29B298' }}>
                <a className="sk-redes-sv" href={'#/sv/' + siglaDe(s.sv)} aria-label={'Perfil de ' + (s.nombre || s.sv)}><img alt="" src={liga.logo(s.sv)} /><b>{siglaDe(s.sv)}</b></a>
                <nav aria-label={'Las redes de ' + (s.nombre || s.sv)}>
                  {s.redes.map(([r, u]) => <a key={r} href={u} target="_blank" rel="noopener noreferrer">{REDES[r] || r} ↗</a>)}
                </nav>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Sec>
  );
}

export function Socios({ liga }) {
  const svs = Object.values(liga.svs).sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const enDiscord = svs.reduce((t, s) => t + (s.miembros || 0), 0);
  // ⚠️ la gente del pool (`gente`), no las filas de la tabla, que viajan hasta 200 (revisión del 03/10/2026)
  const raperos = liga.d.gente || (liga.d.tabla || []).length;
  // 🔑 los patrocinadores, cuando haya: sin dato no hay pieza (Dlx: «3. A»)
  const pat = Array.isArray(liga.d.patrocinadores) ? liga.d.patrocinadores : [];
  // «0 de 0» no es un número: quien todavía no jugó la temporada no muestra ceros, lo dice en palabras
  const activos = svs.filter((s) => s.n || s.pts);
  const esperan = svs.filter((s) => !(s.n || s.pts));
  const M = liga.d.mult || {};
  const mm = M.sv || {};
  const ant = antDe(M);
  const [tab, setTab] = useState('todos');
  // a un cartel: con «Todos» puesto, que el que se busca esté en la lista; y recién después de dibujarla, bajar
  const ir = (sv) => {
    setTab('todos');
    requestAnimationFrame(() => requestAnimationFrame(() => irA(idDe(sv))));
  };
  // la franja: cuatro números con su porqué (las piezas de la llave, como el Ranking)
  const porTier = [1, 2, 3].map((t) => [t, svs.filter((s) => s.tier === t).length]).filter(([, n]) => n);
  const maxM = Math.max(1, ...svs.map((s) => mm[s.sv] || 1));
  const conMax = svs.filter((s) => (mm[s.sv] || 1) === maxM).map((s) => siglaDe(s.sv));
  const franja = [
    { l: 'Servidores', v: svs.length, c: porTier.length ? lista(porTier.map(([t, n]) => n + ' en Tier ' + t)) : 'cada uno con sus eventos' },
    // «sumados»: la misma persona en dos servidores cuenta dos veces (la Liga en números, abajo, cuenta personas)
    { l: 'En sus Discord', v: num(enDiscord), em: 'miembros', c: 'sumados: la misma persona cuenta en cada uno' },
    { l: 'Jugaron la ' + liga.temp, v: num(raperos), em: 'raperos', c: 'de todos los servidores' },
    maxM > 1 ? { l: 'El multiplicador más alto', v: mult(maxM), em: conMax.length > 2 ? conMax.length + ' servidores' : lista(conMax), c: 'esta semana, sobre los puntos de sus eventos' } : null,
  ].filter(Boolean);
  const guerra = <Guerra liga={liga} mm={M} ant={ant} ir={ir} />;
  const hayGuerra = ((M.guerra || {}).pares || []).some((p) => p && liga.svs[p[0]] && liga.svs[p[1]]);
  const tabla = <TablaSv liga={liga} activos={activos} ir={ir} />;
  // 🤝 unirte a los Tier 1 con un toque, eligiendo a cuáles (13/11/2026, ver unirse.jsx): sin la cañería, ni la caja
  const t1 = tier1De(liga);
  const unirme = t1.length && typeof window !== 'undefined' && typeof window.unirmeTier1 === 'function' ? (
    <div className="rka-caja sk-unir">
      <h2 className="rka-h">Unirme a los Tier 1<small>{t1.length} {t1.length === 1 ? 'servidor' : 'servidores'}</small></h2>
      <p className="sk-unir-l">{t1.map((s) => <img key={s.sv} alt={siglaDe(s.sv)} title={s.nombre || s.sv} src={liga.logo(s.sv)} />)}</p>
      <p className="sk-unir-p">Entras a los que elijas con un toque, con tu cuenta de Discord.</p>
      <UnirseTier1 liga={liga} />
    </div>
  ) : null;
  return (
    <>
      {/* 🎬 «así se ve la Liga» (Dlx, 12/11/2026: «sí, las dos»): el montaje de los nuestros batallando detrás de la franja.
          Es lo que contesta el miedo de los dueños al «bot de raid»: gente real, todas las semanas */}
      <div className="escena sk-esc con-video" style={{ '--mo-c': '#29B298', '--mo-o': 0.85, '--mo-c2': '#E41373' }}>
        <FondoVideo liga={liga} />
        <section className="sk-cab rka">
          <div className="sk-cabeza">
            <div className="sk-cab-tx">
              <span className="tag">SOCIOS · {liga.temp}</span>
              <h1 className="hero-ev largo">Socios</h1>
              <p className="hero-p">Los servidores que hacen la Liga: cada uno organiza sus eventos, y todos suman para la misma tabla. Esto pasa todas las semanas en sus servidores.</p>
            </div>
            <div className="sk-acc-h">
              <a className="btn verde" href="#/socios/sumar">Suma tu servidor</a>
              <Compartir cls="btn borde" url={enlace('#/socios')} texto="Los servidores de la Liga Global" />
            </div>
          </div>
          <Franja items={franja} />
          {/* sin guerra esta semana, la tabla pasa a la izquierda y la columna queda para unirse */}
          <div className={'rka-dos' + (hayGuerra || unirme ? '' : ' sk-solo')}>
            <div className="rka-izq">{hayGuerra ? guerra : tabla}</div>
            {hayGuerra || unirme ? <div className="rka-rail">{hayGuerra ? tabla : null}{unirme}</div> : null}
          </div>
        </section>
      </div>
      <Sec id="sk-servidores" titulo="Los servidores" extra="rka-papel sk-papel"
        bajada={'Un cartel por servidor, con la carta de Servidor de su mejor rapero; sin carta todavía, su logo. En orden por los puntos que hizo su gente en la ' + liga.temp + '.'}>
        <Cartelera liga={liga} svs={svs} esperan={esperan} tab={tab} setTab={setTab} />
      </Sec>
      <Publican liga={liga} svs={svs} />
      {pat.length ? (
        <Sec id="sk-pat" titulo="Patrocinadores">
          <ul className="sk-pat">{pat.map((p, i) => <li key={i}><a href={p.link} target="_blank" rel="noopener noreferrer"><img alt={p.nombre} src={p.logo} /></a></li>)}</ul>
        </Sec>
      ) : null}
      {/* 🏟️ «SUMA TU SERVIDOR» ES SU PROPIA PÁGINA desde el 19/11/2026 (`#/socios/sumar`, sumar2.jsx). Dlx: «que estén dentro
          de la página de socio en vez de extender todo eso, si alguien está interesado en meterlo, que haya un botón ahí».
          Acá queda la tira que lleva hasta allá, con los escudos de los que ya están */}
      <Sec id="sk-sumar" titulo="Suma tu servidor" extra="negra sk-sumar">
        <a className="sk-sumar-tira" href="#/socios/sumar">
          <span className="sk-sumar-tx">
            <b>¿Tienes un servidor de freestyle?</b>
            <span>Debuta en el Tier 3 y asciende jugando: tus eventos suman a la misma tabla que los de estos servidores.</span>
            <span className="sk-sumar-l" aria-hidden="true">{svs.map((s) => <img key={s.sv} alt="" src={liga.logo(s.sv)} />)}</span>
          </span>
          <span className="btn verde">Suma tu servidor →</span>
        </a>
        {(liga.d.redes || []).length ? (
          <nav className="soc-ul" aria-label="Las redes de Under Legends">
            <span>LAS REDES DE UNDER LEGENDS</span>
            {liga.d.redes.map(([r, u]) => <a key={r} href={u} target="_blank" rel="noopener noreferrer">{REDES[r] || r} ↗</a>)}
          </nav>
        ) : null}
      </Sec>
      {/* 📊 la Liga en números, que vivía en el Inicio hasta el 13/10/2026: es de todos los socios juntos */}
      <LaLiga liga={liga} />
    </>
  );
}

// 🤖 LO QUE HACE EL BOT Y LO QUE NUNCA HACE, en un solo lugar: lo usan Socios y el kit privado de cada servidor
// (`kit.jsx`, 17/11/2026). Si algo de eso cambia, se cambia acá
export function QueHaceElBot() {
  return (
    <div className="sk-bot">
      <div className="sk-bot-c si">
        <h3><Ico n="ok" t={18} /> Lo que hace el bot</h3>
        <ul>
          <li><b>Lee los anuncios y las llaves</b>, para cargar cada evento solo; y mientras se juega uno, mira quién está en la llamada.</li>
          <li><b>Crea la invitación de la Liga</b>, para que la gente llegue a tu servidor y a tus inscripciones.</li>
          <li><b>Pone las marcas de la Liga en el apodo</b> de tu gente: su #N y la sigla de su crew. Lo apaga un admin para todo el servidor con /settings, y cada uno elige su estilo con /apodo.</li>
          <li><b>Si lo prendes con /settings</b>, cuenta tu evento en tu chat mientras se juega (la llave, cada ronda, la final y el campeón) y avisa los cambios de rango en el canal que elijas. Nombra a los raperos sin hacer sonar a nadie.</li>
          <li><b>Si lo prendes con /antiraid</b> (sólo el dueño): un escudo de AutoMod contra el spam, las menciones masivas y los links de otros servidores, una alarma si entra mucha gente de golpe, la vigilancia del staff y un botón de pánico. Avisa con botones y decide tu staff.</li>
        </ul>
      </div>
      <div className="sk-bot-c no">
        <h3><Ico n="cerrar" t={18} /> Lo que nunca hace</h3>
        <ul>
          <li><b>No expulsa ni banea</b> a nadie.</li>
          <li><b>No edita ni borra los mensajes</b> de tu gente.</li>
          {/* 🔒 21/11/2026, Dlx: «corregir el texto». Decía «a nadie de tu servidor», y la Liga sí le escribe al dueño cuando
              hay algo de su panel (el DM del 04/11 y el del 21/11). A la gente del servidor, nunca: `herramientas/sin_dm.py` */}
          <li><b>No le manda mensajes privados</b> a tu gente. A ti, el dueño, sólo te escribe la Liga cuando hay algo de tu panel.</li>
        </ul>
      </div>
    </div>
  );
}
