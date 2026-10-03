// Socios: lo que era Mundo (`#/socios`, y `#/mundo` sigue abriéndolo). Dlx, 02/10/2026: «reworkeemos lo que es MUNDO,
// llámalo SOCIOS o patrocinadores», y al plan: «1. A» (Socios, con los patrocinadores adentro) · «2. A» (las crews y
// los países se van al Ranking, que ya tiene esas pestañas) · «3. A» (los patrocinadores no se muestran mientras no haya
// ninguno). 🔍 PREVIEW: sólo con `lg:prev-soc` (App.jsx).
//
// ⚠️ «SUMÁ TU SERVIDOR» ES PARA LA CONFIANZA, NO PARA LOS PERMISOS. Dlx, 02/10: a los servidores les cuesta sumar el bot
// porque *«algunos piensan que es bot para raidear»*. Lo que ayuda es la prueba social (los que ya están, con su gente)
// y decir qué hace y qué no. ⚠️ Lo que dice tiene que ser verdad: en los servidores socios el bot sólo lee los anuncios
// y las llaves, y creó la invitación de la Liga (medido el 02/10). Si eso cambia, se cambia acá.
import { limpio, mult, num } from './liga.js';
import { Carta, Compartir, enlace } from './piezas.jsx';

const REPO = 'https://github.com/underraponline-lgtm/underlegends';

function Socio({ liga, s }) {
  const mm = liga.d.mult || {};
  const x = (mm.sv || {})[s.sv];
  const prox = liga.luego().filter((e) => e.sv === s.sv)[0];
  const ll = liga.llaves().filter((l) => l.sv === s.sv)[0];
  const camp = ll ? liga.campeon(ll) : [];
  // su mejor de la temporada, con la carta de Servidor: es lo que gana un servidor al sumarse (CLAUDE.md)
  const mejor = liga.oficiales().find((f) => f.sv === s.sv);
  return (
    <article className="soc" style={{ '--c': s.color || '#29B298' }}>
      <header className="soc-cab">
        <img className="soc-logo" alt="" src={liga.logo(s.sv, true)} />
        <div>
          <h2>{s.nombre || s.sv}</h2>
          <small>{s.sv}{s.tag ? ' · ' + String(s.tag).toUpperCase() : ''}</small>
        </div>
      </header>
      <dl className="soc-num">
        <div><dt>RAPEROS</dt><dd>{num(s.n || 0)}</dd></div>
        <div><dt>PUNTOS</dt><dd>{num(s.pts || 0)}</dd></div>
        <div><dt>EN SU DISCORD</dt><dd>{s.miembros ? num(s.miembros) : '—'}</dd></div>
        <div><dt>ESTA SEMANA</dt><dd className={x > 1 ? 'sube' : ''}>{x ? mult(x) : '×1'}</dd></div>
      </dl>
      <div className="soc-medio">
        {mejor && (mejor.c || []).includes('servidor') ? (
          <a className="soc-carta" href={'#/r/' + encodeURIComponent(mejor.k)} aria-label={'El mejor de ' + s.sv + ': ' + limpio(mejor.n)}>
            <Carta liga={liga} k={mejor.k} cual="servidor" cls="soc-carta-c" abre={false} />
          </a>
        ) : null}
        <ul className="soc-datos">
          {mejor ? <li><b>SU MEJOR</b>{limpio(mejor.n)} · #{mejor.pos} de la Liga</li> : null}
          {prox ? <li><b>EL PRÓXIMO</b>{limpio(prox.nombre)} · {liga.dia(prox.cuando)}</li>
            : ll ? <li><b>EL ÚLTIMO</b>{limpio(ll.nombre)}{camp.length ? ' · ganó ' + camp.join(' y ') : ''}</li> : null}
        </ul>
      </div>
      <div className="soc-acc">
        <a className="btn negro chico" href={'#/sv/' + s.sv}>Ver su página</a>
        {s.invita ? <a className="btn borde2 chico" href={s.invita} target="_blank" rel="noopener noreferrer">Entrar ↗</a> : null}
      </div>
    </article>
  );
}

export function Socios({ liga }) {
  const svs = Object.values(liga.svs).sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const enDiscord = svs.reduce((t, s) => t + (s.miembros || 0), 0);
  const raperos = (liga.d.tabla || []).length;
  const dra = liga.svs.DRA;
  // 🔑 los patrocinadores, cuando haya: sin dato no hay pieza (Dlx: «3. A»)
  const pat = Array.isArray(liga.d.patrocinadores) ? liga.d.patrocinadores : [];
  return (
    <>
      <div className="escena soc-esc" style={{ '--mo-c': '#29B298', '--mo-o': 0.85 }}>
        <section className="soc-hero">
          <span className="tag">SOCIOS · {liga.temp}</span>
          <h1 className="hero-ev largo">Socios</h1>
          <p className="hero-p">Los servidores que hacen la Liga: cada uno organiza sus eventos, y todos suman para la misma tabla.</p>
          <dl className="soc-tot">
            <div><dt>SERVIDORES</dt><dd>{svs.length}</dd></div>
            <div><dt>EN SUS DISCORD</dt><dd>{num(enDiscord)}</dd></div>
            <div><dt>JUGARON LA {liga.temp}</dt><dd>{num(raperos)}</dd></div>
          </dl>
          <Compartir cls="btn borde" url={enlace('#/socios')} texto="Los servidores de la Liga Global" />
        </section>
      </div>
      <section className="soc-lista" aria-label="Los servidores de la Liga">
        {svs.map((s) => <Socio key={s.sv} liga={liga} s={s} />)}
      </section>
      {pat.length ? (
        <section className="soc-pat" aria-label="Patrocinadores">
          <h2 className="evp-h2">Patrocinadores</h2>
          <ul>{pat.map((p, i) => <li key={i}><a href={p.link} target="_blank" rel="noopener noreferrer"><img alt={p.nombre} src={p.logo} /></a></li>)}</ul>
        </section>
      ) : null}
      <section className="soc-sumar" aria-label="Sumá tu servidor">
        <div className="soc-sumar-tit">
          <span className="tag">PARA SERVIDORES</span>
          <h2 className="hero-ev">Sumá tu servidor</h2>
          <p className="hero-p">Los servidores de arriba ya están: {svs.map((s) => s.sv).join(', ')}.</p>
        </div>
        <div className="soc-dos">
          <div className="soc-bloque">
            <h3>Qué gana tu servidor</h3>
            <ul>
              <li><b>Sus eventos suman a la tabla de toda la Liga</b>, con su llave en la página y su campeón en las historias.</li>
              <li><b>Su gente tiene su carta de Servidor</b>, con el escudo y el color del servidor.</li>
              <li><b>Su página</b>, el multiplicador de cada lunes y la guerra de servidores.</li>
              <li><b>Sus eventos avisan al minuto</b> a quien active la campana.</li>
            </ul>
          </div>
          <div className="soc-bloque">
            <h3>Qué hace el bot en tu servidor</h3>
            <ul>
              <li><b>Lee los anuncios y las llaves</b>, para cargar cada evento solo.</li>
              <li><b>Crea una invitación de la Liga</b>, para que la gente llegue a tu servidor.</li>
              <li><b>No toca los mensajes de nadie</b> y no le manda mensajes privados a nadie de tu servidor.</li>
              <li><b>Todo su código está a la vista</b>: <a href={REPO} target="_blank" rel="noopener noreferrer">en GitHub ↗</a></li>
            </ul>
          </div>
        </div>
        <div className="soc-como">
          <p className="hero-p">Las postulaciones de servidores se anuncian en Discord Rap Español, en el canal de la Liga Global.</p>
          {dra && dra.invita ? <a className="btn verde" href={dra.invita} target="_blank" rel="noopener noreferrer">Entrar a Discord Rap Español ↗</a> : null}
        </div>
      </section>
    </>
  );
}
