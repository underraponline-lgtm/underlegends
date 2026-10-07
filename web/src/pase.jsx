// 🎟️ EL PASE DE RAPERO (05/10/2026; con XP desde el 06/10). Dlx: «sólo para DRA», «con TAREAS, no misiones», «como
// Brawl Stars»; al borrador del 06/10, «1, sí». Las Tareas dan XP y la XP sube de nivel: dos por día, cinco por semana
// y ocho de temporada. Cada nivel paga Puntos de Tienda y algunos dan
// una insignia, un título o tu nombre en dorado; después del 30 sigue la cola, y quien lo completa entra al Salón del
// Pase. Las tarjetas no cambian.
//
// La cuenta la hace el servidor (bot/avisos.js; las reglas y los números, en bot/pase.py): acá sólo se muestra. Lo
// público (las Tareas, los premios y el Salón, sin nadie adentro) viaja con `/avisos/pases`, así quien no entró también
// ve qué es.
import { limpio, num } from './liga.js';
import { Cara, accion } from './piezas.jsx';
import { avance, premioTexto, proximoEspecial, usePase, usePases } from './pase.js';
// 🎟️ su CSS viene con este pedazo y no con el paquete de todos (ver pase.css)
import ESTILO from './pase.css?inline';
// 🎟️ la pista dibujada, arriba en lo negro (Dlx, 07/10/2026: «ponlo arriba de todo en la parte del fondo negro»)
import { PistaGrafica } from './pase_pista.jsx';

function Caja({ liga, dc, P, cfg }) {
  const dra = (liga.svs && liga.svs.DRA) || {};
  if (!dc) {
    return (
      <div className="pa-caja">
        <small>TU PASE</small>
        <p>Entrá con tu cuenta de Discord y mirá tu nivel, tu XP y tus Tareas.</p>
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
  const a = avance(P);
  const cuenta = (b) => (b ? b.tareas.filter((t) => t.hecha).length + ' de ' + b.tareas.length : '');
  const completo = P.nivel >= P.niveles;
  return (
    <div className="pa-caja">
      <small>TU NIVEL</small>
      <b className="pa-n">{P.nivel}<span>de {P.niveles}</span></b>
      <span className="pa-barra" role="img" aria-label={'Nivel ' + P.nivel + ' de ' + P.niveles}>
        {Array.from({ length: P.niveles }, (_, i) => <i key={i} className={i < P.nivel ? 'si' : ''} />)}
      </span>
      {a ? (
        <div className="pa-xp">
          <span className="mb"><i style={{ width: Math.round((100 * a.lleva) / a.de) + '%' }} /></span>
          <small>{num(a.lleva)} de {num(a.de)} XP · te faltan <b>{num(a.falta)}</b> para el nivel {P.nivel + 1}</small>
        </div>
      ) : null}
      <ul className="pa-datos">
        <li><span>Tu XP</span><b>{num(P.xp)}</b></li>
        {P.hoy ? <li><span>Hoy</span><b>{cuenta(P.hoy)} Tareas</b></li> : null}
        {P.semana ? <li><span>Esta semana</span><b>{cuenta(P.semana)} Tareas</b></li> : null}
        <li><span>Cobraste</span><b>{num(P.cobrado)} Puntos de Tienda</b></li>
        {P.titulo ? <li><span>Tu título</span><b>{P.titulo}</b></li> : null}
        {sig && !completo ? <li><span>En el nivel {sig[0]}</span><b>{premioTexto(sig)}</b></li> : null}
      </ul>
      {completo ? (
        <p className="pa-ok">Completaste el Pase{P.salon ? <>: entraste <b>{P.salon}.º</b> al Salón del Pase</> : null}. La insignia {(cfg.premios[P.niveles - 1] || [])[3]} es tuya para siempre.
          {P.cada ? <> Y sigue la cola: <b>+{P.cola}</b> · cada {num(P.cada[0])} XP, {num(P.cada[1])} Puntos de Tienda.</> : null}</p>
      ) : null}
    </div>
  );
}

// una lista de Tareas: las de hoy, las de la semana o las de la temporada. Sin tu Pase (no entraste), las del ciclo tal
// cual, sin progreso
function Tareas({ titulo, nota, lista, miembro }) {
  if (!lista || !lista.length) return null;
  return (
    <section className="mis pa-tareas">
      <div className="mis-cab"><span>{titulo}</span>{nota ? <em>{nota}</em> : null}</div>
      <ol>
        {lista.map((x) => (
          <li key={x.id} className={x.hecha ? 'hecha' : ''}>
            <span className="mis-ok" aria-hidden="true">{x.hecha ? '✓' : ''}</span>
            <div className="mis-txt">
              <b>{x.t}</b>
              {x.d ? <small className="pa-d">{x.d}</small> : null}
              {miembro && x.meta > 1 && !x.hecha ? <><span className="mb"><i style={{ width: Math.round((100 * x.lleva) / x.meta) + '%' }} /></span>
                <small>{num(x.lleva)} de {num(x.meta)}</small></> : null}
            </div>
            <span className="mis-pts">{x.hecha ? '✓' : '+' + num(x.xp)}<small>{x.hecha ? 'CUMPLIDA' : 'XP'}</small></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// 🏛️ EL SALÓN DEL PASE (Dlx, 06/10/2026: «4. B»): los que lo completaron, en el orden en que llegaron. Por clave de
// perfil; quien no está en la tabla no sale, pero su puesto se respeta. Sin nadie todavía, no se dibuja
function Salon({ liga, lista, temp }) {
  if (!lista || !lista.length) return null;
  return (
    <section className="sec pa-sec">
      <div className="sec-t"><h2>Salón del Pase</h2><span className="ti-hasta">{temp ? temp.toUpperCase() + ' · ' : ''}{lista.length} {lista.length === 1 ? 'lo completó' : 'lo completaron'}</span></div>
      <ol className="pa-salon">
        {lista.map(([k, t], i) => {
          const f = liga.T && liga.T[k];
          if (!f) return null;
          return (
            <li key={k}>
              <span className="pa-sp">{i + 1}.º</span>
              <Cara liga={liga} k={k} nombre={f.n} cls="cara pa-sc" />
              <a href={'#/r/' + encodeURIComponent(k)}>{limpio(f.n)}</a>
              <small>{liga.cuando(new Date(t).toISOString())}</small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function Pase({ liga, dc }) {
  const P = usePase(!!dc, true);
  const pub = usePases();
  // lo público del Pase: las Tareas, los premios y los umbrales. Con tu Pase, los premios son los mismos
  const cfg = (pub && pub.cfg) || (P && P.listo ? { premios: P.premios, niveles: P.niveles, temp: P.temp } : {});
  const temp = (P && P.temp) || cfg.temp || '';
  const prueba = temp === 'prueba';
  const ult = (cfg.premios || [])[(cfg.niveles || 30) - 1];
  const tuyo = dc && P && P.listo ? P : null;
  const miembro = !!(tuyo && tuyo.miembro);
  // sin tu Pase, las Tareas de la lista pública: las diarias de hoy no se saben (se turnan), así que van todas
  const sin = (xs) => (xs || []).map(([id, t, d, , meta, xp]) => ({ id, t, d, meta, xp, lleva: 0, hecha: false }));
  const hoy = tuyo ? tuyo.hoy && tuyo.hoy.tareas : sin(cfg.diarias);
  const semana = tuyo ? tuyo.semana && tuyo.semana.tareas : sin(cfg.semanales);
  const temporada = tuyo ? tuyo.temporada : sin(cfg.temporada);
  return (
    <>
      <style>{ESTILO}</style>
      <div className="escena pa-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.9, '--mo-c2': '#F5C542' }}>
        <section className="rk-cab ti-cab pa-hero">
          <div className="rk-tx">
            <span className="tag">PASE DE RAPERO · {liga.temp}{prueba ? ' · SEMANA DE PRUEBA' : ''}</span>
            <h1 className="hero-ev">Pase de rapero</h1>
            <p className="hero-p">{cfg.niveles || 30} niveles por temporada, para los miembros de Discord Rap Español. Las Tareas dan XP y la XP sube de nivel: cada día hay {(cfg.por_dia || 2)}, cada semana {(cfg.semanales || []).length || 5} y la temporada trae {(cfg.temporada || []).length || 8} más. Cada nivel paga Puntos de Tienda; el primero te da tu tarjeta de Temporada, y otros una insignia, un título o tu nombre en dorado. Quien llega al {cfg.niveles || 30} entra al Salón del Pase.</p>
            <p className="rk-meta">{prueba ? 'Esta semana es de prueba: el lunes 12 de octubre arranca la T1 y el Pase vuelve a cero.'
              : 'Con la temporada nueva, el Pase vuelve a cero.'}{ult && ult[2] === 'insignia' ? ' La insignia del último nivel queda para siempre.' : ''}</p>
          </div>
          <Caja liga={liga} dc={dc} P={dc ? P : null} cfg={cfg} />
        </section>
        {/* 🎟️ los niveles, en lo negro y debajo del título: es lo que el Pase da, y abajo se perdía después de las Tareas */}
        <div className="pa-niveles">
          <PistaGrafica P={dc ? P : null} cfg={cfg} />
        </div>
      </div>
      {/* las Tareas a dos columnas —hoy y la semana | la temporada, que son parecidas de largo— */}
      <section className="sec pa-sec">
        <div className="sec-t"><h2>Tus Tareas</h2></div>
        <div className="pa-dos">
          <div className="pa-col">
            <Tareas titulo={tuyo ? 'HOY' : 'CADA DÍA, ' + (cfg.por_dia || 2) + ' DE ÉSTAS'} lista={hoy} miembro={miembro}
              nota={tuyo && tuyo.hoy ? 'SE RENUEVAN ' + liga.dia(tuyo.hoy.fin).toUpperCase() : ''} />
            <Tareas titulo="ESTA SEMANA" lista={semana} miembro={miembro}
              nota={tuyo && tuyo.semana ? 'SE RENUEVAN ' + liga.dia(tuyo.semana.fin).toUpperCase() : ''} />
          </div>
          <div className="pa-col">
            <Tareas titulo="DE LA TEMPORADA" lista={temporada} miembro={miembro} nota="EN CUALQUIER ORDEN" />
          </div>
        </div>
        <p className="ti-nota pa-nota">Se cumplen solas: el Pase se entera de lo que hacés en la página, en el bot y en los eventos. Las Tareas no son las Misiones: ésas son para todos y suman a la Temporada.</p>
      </section>
      <Salon liga={liga} lista={pub && pub.salon && pub.salon[temp]} temp={temp} />
    </>
  );
}
