// 🎟️ EL PASE DE RAPERO (05/10/2026). Dlx: «sólo para DRA», «con TAREAS, no misiones», «como Brawl Stars»; a la
// propuesta —30 niveles, cinco Tareas por semana, premios de perfil—, «3. A»; y «si sigue con todo eso». Una Tarea
// cumplida es un nivel; cada nivel paga Puntos de Tienda y algunos dan una insignia, un título o un color para tu
// nombre. Las tarjetas no cambian.
//
// La cuenta la hace el servidor (bot/avisos.js; las reglas y los números, en bot/pase.py): acá sólo se muestra. Lo
// público (las Tareas y los premios, sin nadie adentro) viaja con `/avisos/pases`, así quien no entró también ve qué es.
import { num } from './liga.js';
import { accion } from './piezas.jsx';
import { premioTexto, proximoEspecial, usePase, usePases } from './pase.js';
// 🎟️ su CSS viene con este pedazo y no con el paquete de todos (ver pase.css)
import ESTILO from './pase.css?inline';

function Caja({ liga, dc, P, cfg }) {
  const dra = (liga.svs && liga.svs.DRA) || {};
  if (!dc) {
    return (
      <div className="pa-caja">
        <small>TU PASE</small>
        <p>Entrá con tu cuenta de Discord y mirá tu nivel y tus Tareas de la semana.</p>
        <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button>
      </div>
    );
  }
  if (P === undefined) return <div className="pa-caja"><small>TU PASE</small><p>Buscando el tuyo…</p></div>;
  if (P && P.sinSesion) {
    return (
      <div className="pa-caja">
        <small>TU PASE</small>
        <p>Tu sesión venció: entrá de nuevo con Discord y aparece tu nivel.</p>
        <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button>
      </div>
    );
  }
  if (!P) {
    return (
      <div className="pa-caja">
        <small>TU PASE</small>
        <p className="pa-mal">No pude leer tu Pase. Probá de nuevo en un rato.</p>
      </div>
    );
  }
  if (!P.listo) return <div className="pa-caja"><small>TU PASE</small><p>El Pase arranca en un rato: en la próxima vuelta del ciclo.</p></div>;
  if (!P.miembro) {
    return (
      <div className="pa-caja">
        <small>TU PASE</small>
        <p>El Pase es de los <b>miembros de Discord Rap Español</b>: entrá al servidor y verificate. Con el rol Miembro, tus Tareas empiezan a contar.</p>
        <div className="pa-acc">
          {dra.invita ? <a className="btn verde chico" href={dra.invita} target="_blank" rel="noopener noreferrer">Entrar a DRA ↗</a> : null}
          <a className="btn borde chico" href="#/cuenta/verificar">Cómo verificarme</a>
        </div>
      </div>
    );
  }
  const sig = proximoEspecial(cfg.premios, P.nivel);
  const hechas = P.semana ? P.semana.tareas.filter((t) => t.hecha).length : 0;
  return (
    <div className="pa-caja">
      <small>TU NIVEL</small>
      <b className="pa-n">{P.nivel}<span>de {P.niveles}</span></b>
      <span className="pa-barra" role="img" aria-label={'Nivel ' + P.nivel + ' de ' + P.niveles}>
        {Array.from({ length: P.niveles }, (_, i) => <i key={i} className={i < P.nivel ? 'si' : ''} />)}
      </span>
      <ul className="pa-datos">
        {P.semana ? <li><span>Esta semana</span><b>{hechas} de {P.semana.tareas.length} Tareas</b></li> : null}
        <li><span>Cobraste</span><b>{num(P.cobrado)} Puntos de Tienda</b></li>
        {P.titulo ? <li><span>Tu título</span><b>{P.titulo}</b></li> : null}
        {sig && P.nivel < P.niveles ? <li><span>En el nivel {sig[0]}</span><b>{premioTexto(sig)}</b></li> : null}
      </ul>
      {P.nivel >= P.niveles ? <p className="pa-ok">Completaste el Pase de la temporada: la insignia {(cfg.premios[P.niveles - 1] || [])[3]} es tuya para siempre.</p> : null}
    </div>
  );
}

function Tareas({ liga, P, cfg }) {
  const sem = P && P.semana;
  // sin tu Pase (no entraste), las Tareas de la propuesta tal como las manda el ciclo, sin progreso
  const lista = sem ? sem.tareas : (cfg.tareas || []).map(([id, t, d]) => ({ id, t, d, lleva: 0, meta: 0, hecha: false }));
  if (!lista.length) return null;
  const miembro = P && P.miembro;
  return (
    <section className="mis pa-tareas">
      <div className="mis-cab"><span>CADA TAREA ES UN NIVEL</span>
        {sem ? <em>SE RENUEVAN {liga.dia(sem.fin).toUpperCase()}</em> : null}</div>
      <ol>
        {lista.map((x) => (
          <li key={x.id} className={x.hecha ? 'hecha' : ''}>
            <span className="mis-ok" aria-hidden="true">{x.hecha ? '✓' : ''}</span>
            <div className="mis-txt">
              <b>{x.t}</b>
              {x.d ? <small className="pa-d">{x.d}</small> : null}
              {miembro && x.meta > 1 ? <><span className="mb"><i style={{ width: Math.round(100 * x.lleva / x.meta) + '%' }} /></span>
                <small>{x.lleva} de {x.meta}</small></> : null}
            </div>
            <span className="mis-pts">{x.hecha ? '✓' : '+1'}<small>{x.hecha ? 'CUMPLIDA' : 'NIVEL'}</small></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Pista({ P, cfg }) {
  const ps = cfg.premios || [];
  if (!ps.length) return null;
  const miembro = !!(P && P.miembro);
  const n = (miembro && P.nivel) || 0;
  return (
    <ol className="pa-pista" aria-label="Los niveles del Pase y lo que da cada uno">
      {ps.map((p) => (
        <li key={p[0]} className={[p[0] <= n ? 'pa-ya' : '', p[2] ? 'pa-esp' : '', miembro && p[0] === n + 1 ? 'pa-prox' : ''].join(' ').trim() || undefined}>
          <b>{p[0]}</b>
          {p[2] ? <small className="pa-que">{p[2] === 'color' ? 'Nombre dorado' : p[2] === 'tarjeta' ? 'Tu ' + p[3] : p[3]}</small> : null}
          <small>+{num(p[1])}</small>
        </li>
      ))}
    </ol>
  );
}

export function Pase({ liga, dc }) {
  const P = usePase(!!dc, true);
  const pub = usePases();
  // lo público del Pase: las Tareas y los premios. Con tu Pase, los suyos (son los mismos)
  const cfg = (P && P.listo ? { premios: P.premios, niveles: P.niveles, temp: P.temp } : null) || (pub && pub.cfg) || {};
  const temp = (P && P.temp) || cfg.temp || '';
  const prueba = temp === 'prueba';
  const ult = (cfg.premios || [])[(cfg.niveles || 30) - 1];
  return (
    <>
      <style>{ESTILO}</style>
      <div className="escena pa-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.9, '--mo-c2': '#F5C542' }}>
        <section className="rk-cab ti-cab pa-hero">
          <div className="rk-tx">
            <span className="tag">PASE DE RAPERO · {liga.temp}{prueba ? ' · SEMANA DE PRUEBA' : ''}</span>
            <h1 className="hero-ev">Pase de rapero</h1>
            <p className="hero-p">{cfg.niveles || 30} niveles por temporada, para los miembros de Discord Rap Español. Cada Tarea que cumplís es un nivel, y cada nivel paga Puntos de Tienda; el primero te da tu tarjeta de Temporada, y otros una insignia, un título o tu nombre en dorado.</p>
            <p className="rk-meta">{prueba ? 'Esta semana es de prueba: el lunes 12 de octubre arranca la T1 y el Pase vuelve a cero.'
              : 'Con la temporada nueva, el Pase vuelve a cero.'}{ult && ult[2] === 'insignia' ? ' La insignia del último nivel queda para siempre.' : ''}</p>
          </div>
          <Caja liga={liga} dc={dc} P={dc ? P : null} cfg={cfg} />
        </section>
      </div>
      <section className="sec pa-sec">
        <div className="pa-dos">
          <div>
            <div className="sec-t"><h2>Esta semana</h2></div>
            <Tareas liga={liga} P={dc ? P : null} cfg={(pub && pub.cfg) || cfg} />
            <p className="ti-nota pa-nota">Se cumplen solas: el Pase se entera de lo que hacés en la página, en el bot y en los eventos.</p>
          </div>
          <div>
            <div className="sec-t"><h2>Los niveles</h2>{P && P.miembro ? <span className="ti-hasta">vas en el {P.nivel}</span> : null}</div>
            <Pista P={dc ? P : null} cfg={cfg} />
          </div>
        </div>
      </section>
    </>
  );
}

