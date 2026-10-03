// Socios: lo que era Mundo (`#/socios`, y `#/mundo` sigue abriéndolo). Dlx, 02/10/2026: «reworkeemos lo que es MUNDO,
// llámalo SOCIOS o patrocinadores», y al plan: «1. A» (Socios, con los patrocinadores adentro) · «2. A» (las crews y
// los países se van al Ranking, que ya tiene esas pestañas) · «3. A» (los patrocinadores no se muestran mientras no haya
// ninguno). Para todos desde la 2.02 (Dlx, 03/10/2026: «1. A»).
//
// ⚠️ «SUMÁ TU SERVIDOR» ES PARA LA CONFIANZA, NO PARA LOS PERMISOS. Dlx, 02/10: a los servidores les cuesta sumar el bot
// porque *«algunos piensan que es bot para raidear»*. Lo que ayuda es la prueba social (los que ya están, con su gente)
// y decir qué hace y qué no. ⚠️ Lo que dice tiene que ser verdad: en los servidores socios el bot sólo lee los anuncios
// y las llaves, y creó la invitación de la Liga (medido el 02/10). Si eso cambia, se cambia acá.
//
// 🔑 Y SE SUMA HABLÁNDOLE A DLX. Dlx, 03/10/2026: «quitá esa línea [la del código en GitHub] y decí que si querés que
// tu servidor sea parte escribas a @itsdlx en Discord, y explicá más features que hacemos». Cada una de `QUE_GANA` es
// algo que ya anda: si alguna se apaga, se saca de acá.
import { limpio, mult, num } from './liga.js';
import { Carta, Compartir, Ico, enlace } from './piezas.jsx';
import { REDES } from './servidor.jsx';

// el perfil de Dlx en Discord (itsdlx): abre su perfil para escribirle
const DLX = 'https://discord.com/users/739338101603696681';
const QUE_GANA = [
  ['ranking', 'La tabla de toda la Liga', 'Cada evento suyo cuenta para los mismos rankings que los demás servidores: Temporada, Competitivo, Duelos, Podios y Rachas.'],
  ['tarjetas', 'La carta de Servidor', 'Su gente tiene su carta con el escudo y el color del servidor desde su primer evento.'],
  ['eventos', 'La llave, en vivo', 'El cuadro se arma solo mientras se juega, y a quien tiene la campana le avisa cuando le toca pelear.'],
  ['campana', 'Avisos al minuto', 'Cuando anuncia un evento le llega al celular a quien activó la campana, y queda en el calendario de la Liga.'],
  ['aviso', 'Most Wanted', 'Buscados con recompensa: el primero que le gana a uno en un evento de la Liga lo caza y cobra.'],
  ['novedades', 'Multiplicador cada lunes', 'Cada semana sale con su multiplicador, de ×0,5 a ×5, y la gente vota qué servidor se lleva un ×2.'],
  ['socios', 'Guerra de servidores', 'Cada semana se enfrenta con otro: gana el que más puntos hace por persona y la semana siguiente lleva ×1,5.'],
  // Dlx, 03/10/2026: «mencioná que compartimos las redes sociales, o sea los posts, en nuestras redes y la Liga Global también»
  ['compartir', 'Sus posts, en nuestras redes', 'Compartimos sus posts en las redes de Under Legends y en la Liga Global, y sus anuncios y campeones salen en Publicaciones y en las historias.'],
  ['perfil', 'Su página en la Liga', 'Con su gente, sus eventos, su semana y sus redes, y su invitación para que la gente llegue a su servidor.'],
];

function Socio({ liga, s }) {
  const mm = liga.d.mult || {};
  const x = (mm.sv || {})[s.sv];
  const prox = liga.luego().filter((e) => e.sv === s.sv)[0];
  const ll = liga.llaves().filter((l) => l.sv === s.sv)[0];
  const camp = ll ? liga.campeon(ll) : [];
  // su mejor de la temporada, con la carta de Servidor: es lo que gana un servidor al sumarse (CLAUDE.md)
  const mejor = liga.oficiales().find((f) => f.sv === s.sv);
  const jugo = !!(s.n || s.pts);
  return (
    <article className="soc" style={{ '--c': s.color || '#29B298' }}>
      <header className="soc-cab">
        <img className="soc-logo" alt="" src={liga.logo(s.sv, true)} />
        <div>
          <h2>{s.nombre || s.sv}</h2>
          <small>{s.sv}{s.tag ? ' · ' + String(s.tag).toUpperCase() : ''}</small>
        </div>
      </header>
      {/* «0 de 0» no es un número: quien todavía no jugó la temporada no muestra ceros, lo dice en palabras */}
      <dl className={'soc-num' + (jugo ? '' : ' dos')}>
        {jugo ? <>
          <div><dt>RAPEROS</dt><dd>{num(s.n || 0)}</dd></div>
          <div><dt>PUNTOS</dt><dd>{num(s.pts || 0)}</dd></div>
        </> : null}
        <div><dt>EN SU DISCORD</dt><dd>{s.miembros ? num(s.miembros) : '—'}</dd></div>
        <div><dt>ESTA SEMANA</dt><dd className={x > 1 ? 'sube' : ''}>{x ? mult(x) : '×1'}</dd></div>
      </dl>
      {!jugo ? (
        <p className="soc-espera"><b>TODAVÍA SIN EVENTOS EN LA {liga.temp}</b>Cuando organice el primero, acá aparece su mejor rapero y su último campeón.</p>
      ) : null}
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
      {(s.redes || []).length ? (
        <nav className="soc-redes" aria-label={'Las redes de ' + (s.nombre || s.sv)}>
          {s.redes.map(([r, u]) => <a key={r} href={u} target="_blank" rel="noopener noreferrer">{REDES[r] || r} ↗</a>)}
        </nav>
      ) : null}
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
  // 🔑 los patrocinadores, cuando haya: sin dato no hay pieza (Dlx: «3. A»)
  const pat = Array.isArray(liga.d.patrocinadores) ? liga.d.patrocinadores : [];
  // baja hasta «Sumá tu servidor» (adentro del shadow root del Inicio nuevo)
  const sumar = () => {
    const h = document.getElementById('inicio-nuevo');
    const s = h && h.shadowRoot ? h.shadowRoot.querySelector('.soc-sumar') : null;
    if (s) window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - 10, behavior: 'smooth' });
  };
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
        {/* con un número impar de servidores, el lugar que sobra en la compu invita al que falta (sin huecos grandes) */}
        {svs.length % 2 ? (
          <article className="soc soc-mas">
            <span className="soc-mas-c" aria-hidden="true">+</span>
            <h2>Tu servidor, acá</h2>
            <p>Sus eventos suman a la misma tabla que estos {svs.length}, y su gente tiene su carta.</p>
            <a className="btn verde chico" href="#/socios" onClick={(e) => { e.preventDefault(); sumar(); }}>Cómo se suma</a>
          </article>
        ) : null}
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
          <p className="hero-p">Los servidores de arriba ya están: {svs.map((s) => s.sv).join(', ')}. Esto es lo que la Liga hace por cada uno.</p>
        </div>
        <ul className="soc-feats">
          {QUE_GANA.map(([ic, t, tx]) => <li key={t}><Ico n={ic} t={24} /><b>{t}</b><span>{tx}</span></li>)}
        </ul>
        {(liga.d.redes || []).length ? (
          <nav className="soc-ul" aria-label="Las redes de Under Legends">
            <span>LAS REDES DE UNDER LEGENDS</span>
            {liga.d.redes.map(([r, u]) => <a key={r} href={u} target="_blank" rel="noopener noreferrer">{REDES[r] || r} ↗</a>)}
          </nav>
        ) : null}
        <div className="soc-dos">
          <div className="soc-bloque">
            <h3>Qué hace el bot en tu servidor</h3>
            <ul>
              <li><b>Lee los anuncios y las llaves</b>, para cargar cada evento solo.</li>
              <li><b>Crea una invitación de la Liga</b>, para que la gente llegue a tu servidor.</li>
              <li><b>No toca los mensajes de nadie</b> y no le manda mensajes privados a nadie de tu servidor.</li>
            </ul>
          </div>
          <div className="soc-bloque soc-cta">
            <h3>¿Querés que tu servidor sea parte?</h3>
            <p>Escribile a <b>@itsdlx</b> en Discord.</p>
            {/* el usuario de Discord va como es, en minúsculas: el botón pone todo en mayúsculas */}
            <a className="btn verde" href={DLX} target="_blank" rel="noopener noreferrer"><span>Escribirle a <span className="soc-at">@itsdlx</span> ↗</span></a>
          </div>
        </div>
      </section>
    </>
  );
}
