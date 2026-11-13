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
import { limpio, mult, num, siglaDe } from './liga.js';
import { Carta, Compartir, Ico, Sec, enlace } from './piezas.jsx';
import { LaLiga } from './medio.jsx';
import { REDES } from './servidor.jsx';
import { DLX, QueGana } from './sumar.jsx';
import { Miniatura, abrirVideo } from './video.jsx';
import CSS_VIEJO from './css/socios.css?inline';
import CSS_PAGINA from './css/socios2.css?inline';
import { usarCss } from './css.js';
import FondoVideo from './fondovideo.jsx';

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
function Cuenta({ s, chico }) {
  if (!s.cu) return null;
  return (
    <ul className={'sk-cu' + (chico ? ' chico' : '')} aria-label={'Qué cuenta de los eventos de ' + (s.nombre || s.sv)}>
      <li className={s.cu.t ? 'si' : 'no'}><Ico n={s.cu.t ? 'ok' : 'cerrar'} t={14} />{s.cu.t ? sumaTx(s.cu.min) : 'No suma a la Temporada'}</li>
      <li className={s.cu.c ? 'si' : 'no'}><Ico n={s.cu.c ? 'ok' : 'cerrar'} t={14} />{s.cu.c ? 'Cuenta para el Competitivo' : 'No cuenta para el Competitivo'}</li>
    </ul>
  );
}
function Tiers({ liga, svs }) {
  const min = (svs.find((s) => s.cu && s.cu.min) || { cu: {} }).cu.min;
  const QUE = {
    1: ['Suma a la Temporada y al Competitivo', 'Sus ligas cuentan como duelos', 'Su carta de Servidor'],
    2: [sumaTx(min), 'Su carta de Servidor', 'No cuenta para el Competitivo'],
    3: [sumaTx(min), 'No cuenta para el Competitivo'],
  };
  const por = [1, 2, 3].map((t) => [t, svs.filter((s) => s.tier === t)]).filter(([, l]) => l.length);
  if (!por.length) return null;
  return (
    <div className="sk-tiers">
      <ul>
        {por.map(([t, l]) => (
          <li key={t}>
            <TierChip s={{ tier: t }} />
            <ul className="sk-tier-q">{QUE[t].map((q) => <li key={q}>{q}</li>)}</ul>
            <p className="sk-tier-sv">{l.map((s) => (
              <button type="button" key={s.sv} style={{ '--c': s.color || '#29B298' }} onClick={() => irA(idDe(s.sv))} aria-label={'Ir a ' + (s.nombre || s.sv)}>
                <img alt="" src={liga.logo(s.sv)} />{siglaDe(s.sv)}</button>
            ))}</p>
          </li>
        ))}
      </ul>
      <p className="sk-tiers-p">Y todos, sea cual sea su tier: sus eventos en el calendario, la campana y Publicaciones, su página y sus ligas.</p>
    </div>
  );
}

// ── un servidor que ya jugó la temporada: su número, su gente, su mejor con la carta de Servidor y lo que sigue ──
function Socio({ liga, s, n }) {
  const mm = liga.d.mult || {};
  const x = (mm.sv || {})[s.sv];
  const prox = liga.luego().filter((e) => e.sv === s.sv)[0];
  const ll = liga.llaves().filter((l) => l.sv === s.sv)[0];
  const camp = ll ? liga.campeon(ll) : [];
  // su mejor de la temporada, con la carta de Servidor: es lo que gana un servidor al sumarse (CLAUDE.md)
  const mejor = liga.oficiales().find((f) => f.sv === s.sv);
  return (
    <article className="sk-soc" id={idDe(s.sv)} style={{ '--c': s.color || '#29B298' }}>
      <span className="sk-n" aria-hidden="true">{String(n).padStart(2, '0')}</span>
      <header className="sk-soc-cab">
        <img className="sk-logo" alt="" src={liga.logo(s.sv, true)} />
        <div><h3><span className="sk-oculto">{n}.º por puntos: </span>{s.nombre || s.sv}</h3><small>{siglaDe(s.sv)}{s.tag ? ' · ' + String(s.tag).toUpperCase() : ''}<TierChip s={s} /></small></div>
      </header>
      <dl className="sk-num">
        <div><dt>RAPEROS</dt><dd>{num(s.n || 0)}</dd></div>
        <div><dt>PUNTOS</dt><dd>{num(s.pts || 0)}</dd></div>
        <div><dt>EN SU DISCORD</dt><dd>{s.miembros ? num(s.miembros) : '—'}</dd></div>
        <div><dt>ESTA SEMANA</dt><dd className={x > 1 ? 'sube' : ''}>{x ? mult(x) : '×1'}</dd></div>
      </dl>
      <Cuenta s={s} />
      <div className="sk-medio">
        {mejor && (mejor.c || []).includes('servidor') ? (
          <a className="sk-carta" href={'#/r/' + encodeURIComponent(mejor.k)} aria-label={'El mejor de ' + siglaDe(s.sv) + ': ' + limpio(mejor.n)}>
            <Carta liga={liga} k={mejor.k} cual="servidor" cls="sk-carta-c" abre={false} />
          </a>
        ) : null}
        <ul className="sk-datos">
          {mejor ? <li><b>SU MEJOR</b>{limpio(mejor.n)} · #{mejor.pos} de la Liga</li> : null}
          {prox ? <li><b>EL PRÓXIMO</b>{limpio(prox.nombre)} · {liga.dia(liga.cuandoDe(prox))}</li>
            : ll ? <li><b>EL ÚLTIMO</b>{limpio(ll.nombre)}{camp.length ? ' · ganó ' + camp.join(' y ') : ''}</li> : null}
        </ul>
      </div>
      <div className="sk-acc">
        <a className="btn negro chico" href={'#/sv/' + siglaDe(s.sv)}>Ver su página</a>
        {s.invita ? <a className="btn borde2 chico" href={s.invita} target="_blank" rel="noopener noreferrer">Entrar ↗</a> : null}
      </div>
    </article>
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
              <button type="button" className="pf-vid-b" onClick={() => abrirVideo({ vid: v.vid, tit: v.tit, link: v.link })}>
                <span className="pf-vid-m"><Miniatura vid={v.vid} cls="pf-vid-img" /><i aria-hidden="true">▶</i></span>
                <b>{v.tit}</b>
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
  const mm = (liga.d.mult || {}).sv || {};
  return (
    <>
      {/* 🎬 «así se ve la Liga» (Dlx, 12/11/2026: «sí, las dos»): el montaje de los nuestros batallando detrás de la franja.
          Es lo que contesta el miedo de los dueños al «bot de raid»: gente real, todas las semanas */}
      <div className="escena sk-esc con-video" style={{ '--mo-c': '#29B298', '--mo-o': 0.85, '--mo-c2': '#E41373' }}>
        <FondoVideo liga={liga} />
        <section className="sk-cab">
          <div className="sk-cab-tx">
            <span className="tag">SOCIOS · {liga.temp}</span>
            <h1 className="hero-ev largo">Socios</h1>
            <p className="hero-p">Los servidores que hacen la Liga: cada uno organiza sus eventos, y todos suman para la misma tabla. Esto pasa todas las semanas en sus servidores.</p>
            <dl className="sk-tot">
              <div><dt>SERVIDORES</dt><dd>{svs.length}</dd></div>
              {/* «sumados»: la misma persona en dos servidores cuenta dos veces (la Liga en números, abajo, cuenta personas) */}
              <div><dt>MIEMBROS SUMADOS</dt><dd>{num(enDiscord)}</dd></div>
              <div><dt>JUGARON LA {liga.temp}</dt><dd>{num(raperos)}</dd></div>
            </dl>
            <div className="sk-acc-h">
              <button type="button" className="btn verde" onClick={() => irA('sk-sumar')}>Suma tu servidor</button>
              <Compartir cls="btn borde" url={enlace('#/socios')} texto="Los servidores de la Liga Global" />
            </div>
          </div>
          {/* 🧱 el muro: cada logo lleva a su tarjeta, en el orden de la lista */}
          <nav className="sk-muro" aria-label="Ir a un servidor">
            <ol>{svs.map((s) => (
              <li key={s.sv}><button type="button" style={{ '--c': s.color || '#29B298' }} onClick={() => irA(idDe(s.sv))} aria-label={'Ir a ' + (s.nombre || s.sv)}>
                <img alt="" src={liga.logo(s.sv)} /><b>{siglaDe(s.sv)}</b></button></li>
            ))}</ol>
          </nav>
        </section>
      </div>
      <Sec id="sk-servidores" titulo="Los servidores" bajada={'En orden por los puntos que hizo su gente en la ' + liga.temp + '.' + (svs.some((s) => s.tier) ? ' Cada uno tiene su tier, que dice qué cuenta de sus eventos.' : '')}>
        <Tiers liga={liga} svs={svs} />
        <div className="sk-lista">
          {activos.map((s, i) => <Socio key={s.sv} liga={liga} s={s} n={i + 1} />)}
          {/* con un número impar, el lugar que sobra en la compu invita al que falta (sin huecos grandes) */}
          {activos.length % 2 ? (
            <article className="sk-soc sk-mas">
              <span className="sk-mas-c" aria-hidden="true">+</span>
              <h3>Tu servidor, acá</h3>
              <p>Sus eventos suman a la misma tabla que estos {svs.length}, y su gente tiene su carta.</p>
              <button type="button" className="btn verde chico" onClick={() => irA('sk-sumar')}>Cómo se suma</button>
            </article>
          ) : null}
        </div>
        {esperan.length ? (
          <div className="sk-espera">
            <h3 className="sk-st">Esperando su primer evento de la {liga.temp}</h3>
            <p className="sk-espera-p">Cuando organicen el primero, salen arriba con su mejor rapero y su último campeón.</p>
            <ul>{esperan.map((s) => {
              const x = mm[s.sv];
              return (
                <li key={s.sv} id={idDe(s.sv)} style={{ '--c': s.color || '#29B298' }}>
                  <img className="sk-logo chico" alt="" src={liga.logo(s.sv, true)} />
                  <span className="sk-esp-t"><b>{s.nombre || s.sv}</b><small>{siglaDe(s.sv)}{s.tag ? ' · ' + String(s.tag).toUpperCase() : ''}<TierChip s={s} /></small><Cuenta s={s} chico /></span>
                  <span className="sk-esp-d"><b>{s.miembros ? num(s.miembros) : '—'}</b><small>en su Discord</small></span>
                  <span className="sk-esp-d"><b className={x > 1 ? 'sube' : ''}>{x ? mult(x) : '×1'}</b><small>esta semana</small></span>
                  <span className="sk-esp-acc">
                    <a className="btn negro chico" href={'#/sv/' + siglaDe(s.sv)}>Ver su página</a>
                    {s.invita ? <a className="btn borde2 chico" href={s.invita} target="_blank" rel="noopener noreferrer">Entrar ↗</a> : null}
                  </span>
                </li>
              );
            })}</ul>
          </div>
        ) : null}
      </Sec>
      <Publican liga={liga} svs={svs} />
      {pat.length ? (
        <Sec id="sk-pat" titulo="Patrocinadores">
          <ul className="sk-pat">{pat.map((p, i) => <li key={i}><a href={p.link} target="_blank" rel="noopener noreferrer"><img alt={p.nombre} src={p.logo} /></a></li>)}</ul>
        </Sec>
      ) : null}
      <Sec id="sk-sumar" titulo="Suma tu servidor" extra="negra sk-sumar">
        <p className="sk-sumar-p">Los de arriba ya están: {svs.map((s) => siglaDe(s.sv)).join(', ')}. Así se suma el tuyo, y esto es lo que la Liga hace por cada uno.</p>
        <ol className="sk-pasos">
          <li><b className="sk-paso-n">01</b><div><h3>Tu Discord, con 300 miembros o más</h3><p>Es el mínimo; se recomiendan 500.</p></div></li>
          <li className="cta"><b className="sk-paso-n">02</b><div><h3>Escríbele a <span className="soc-at">@itsdlx</span> en Discord</h3><p>Lo demás se habla con él.</p>
            {/* el usuario de Discord va como es, en minúsculas: el botón pone todo en mayúsculas */}
            <a className="btn verde" href={DLX} target="_blank" rel="noopener noreferrer"><span>Escribirle a <span className="soc-at">@itsdlx</span> ↗</span></a></div></li>
          <li><b className="sk-paso-n">03</b><div><h3>Entra el bot, y tus eventos suman</h3><p>Lee tus anuncios y tus llaves y arma cada evento solo: desde el próximo, todo cuenta para la Liga.</p></div></li>
        </ol>
        <h3 className="sk-st">Lo que gana tu servidor</h3>
        {/* 🔍 cada caja se toca y muestra su ejemplo (Dlx, 03/10/2026) */}
        <QueGana ejemplos />
        {/* ⚠️ TODO LO DE ACÁ ESTÁ MEDIDO EN EL CÓDIGO (la crítica de la tanda 2 encontró que faltaba el anti-raid): la llamada,
            sólo con un evento en vivo (`bot/en_llamada.py`); el `#N` del apodo, prendido por defecto (`ajustes()` y la
            ayuda de `/settings` y `/numeral` en `bot/worker.js`); el bot en vivo nombra con @ sin hacer sonar a nadie
            (2.82, `allowed_mentions` vacío); el anti-raid es del dueño, avisa con botones y ni en AUTOMÁTICO expulsa ni
            banea (`bot/antiraid.js`). Si algo de eso cambia, se cambia acá */}
        <div className="sk-bot">
          <div className="sk-bot-c si">
            <h3><Ico n="ok" t={18} /> Lo que hace el bot</h3>
            <ul>
              <li><b>Lee los anuncios y las llaves</b>, para cargar cada evento solo; y mientras se juega uno, mira quién está en la llamada.</li>
              <li><b>Crea la invitación de la Liga</b>, para que la gente llegue a tu servidor y a tus inscripciones.</li>
              <li><b>Pone el puesto de la Liga en el apodo</b> de tu gente (#N). Lo apaga un admin para todo el servidor con /settings, y cada uno lo decide con /numeral.</li>
              <li><b>Si lo prendes con /settings</b>, cuenta tu evento en tu chat mientras se juega (la llave, cada ronda, la final y el campeón) y avisa los cambios de rango en el canal que elijas. Nombra a los raperos sin hacer sonar a nadie.</li>
              <li><b>Si lo prendes con /antiraid</b> (sólo el dueño): un escudo de AutoMod contra el spam, las menciones masivas y los links de otros servidores, una alarma si entra mucha gente de golpe, la vigilancia del staff y un botón de pánico. Avisa con botones y decide tu staff.</li>
            </ul>
          </div>
          <div className="sk-bot-c no">
            <h3><Ico n="cerrar" t={18} /> Lo que nunca hace</h3>
            <ul>
              <li><b>No expulsa ni banea</b> a nadie.</li>
              <li><b>No edita ni borra los mensajes</b> de tu gente.</li>
              <li><b>No le manda mensajes privados</b> a nadie de tu servidor.</li>
            </ul>
          </div>
        </div>
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
