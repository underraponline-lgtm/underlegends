// La Guía, rehecha (`#/guia`). Dlx, 02/10/2026: «reworkeemos GUÍA», y al plan —arranca con «cómo empezar» en tres pasos y
// sigue con un índice: las tarjetas, los puntos, los rangos, el Most Wanted, la semana, las palabras y las preguntas—:
// «4. A». Para todos desde la 2.02 (Dlx, 03/10/2026: «2. A»).
//
// ⚠️ LOS NÚMEROS SALEN DE DONDE SE CALCULAN, como en la de app.js: los requisitos de `comun/requisitos.py`, los rangos de
// `comun/rangos.py`, los puntos de `Config` y los pesos de `sheet/ovr.py` y `sheet/competitivo.py` (`_guia()` de
// bot/subir_web.py). Acá no se escribe ninguno. Lo que es texto —las palabras, las preguntas— es el de la Guía de
// app.js (index.html), ordenado por tema.
import { num } from './liga.js';
import { Carta, accion } from './piezas.jsx';

const SECCIONES = [
  ['empezar', 'Cómo empezar'], ['tarjetas', 'Tarjetas'], ['puntos', 'Puntos'], ['rangos', 'Rangos'],
  ['mw', 'Most Wanted'], ['semana', 'La semana'], ['palabras', 'Palabras'], ['preguntas', 'Preguntas'],
];

// las palabras de la Liga, por tema (el texto de la Guía de siempre)
const MW_TIENDA = [
  ['Most Wanted', 'Los buscados: 3 por día (desde la Temporada 1, 9 por semana), cada uno con su recompensa. El primero que le gana a uno en un evento de la Liga lo caza y cobra; si nadie lo caza y jugó, sobrevive y se lleva la mitad. Lo cobrado suma a tus Puntos de la Temporada, nunca al Competitivo, y además el 10 % va a tus Puntos de Tienda.'],
  ['El Elegido', 'Uno de los buscados lo elige la gente: mientras corre un Most Wanted se vota quién es buscado en el siguiente, y el más votado entra como «El Elegido». Vota cualquiera que entre con Discord; nadie se vota a sí mismo, y hacen falta 3 votos.'],
  ['El ×2 votado', 'Durante la semana se vota qué servidor se lleva el ×2 la siguiente: el más votado sale del sorteo del lunes con ×2 como mínimo. Se puede votar a cualquiera, también al tuyo. Hacen falta 3 votos.'],
  ['Puntos de Tienda', 'Una moneda aparte de los puntos del ranking: todos arrancan con los mismos y se ven en la Tienda, entrando con Discord. Se ganan cazando (todo el precio por cabeza, y el 10 % del Most Wanted) y hoy sirven para el precio por cabeza.'],
  ['Precio por cabeza', 'Cualquiera pone Puntos de Tienda sobre un rapero de la temporada. El primero que le gana en un evento de la Liga se los lleva: esos Puntos de Tienda y lo mismo en su Temporada. Si nadie lo caza en la semana, vuelven a quien los puso. Nadie ve quién puso un precio.'],
];
const SEMANA = [
  ['Multiplicador', 'Cada lunes a las 11 AM (hora del este) se sortea uno por servidor: esa semana, los puntos de Temporada de sus eventos valen ×0,5 a ×5. El Competitivo y el Most Wanted no cambian.'],
  ['Evento dorado', 'Cada semana, el primer evento de un servidor desde un día sorteado vale ×3 encima de su multiplicador. Se sabe desde el lunes.'],
  ['Guerra de servidores', 'Cada semana los servidores se enfrentan de a dos: gana el que más puntos hace por persona en sus eventos, y la semana siguiente lleva ×1,5.'],
  ['Copa de la Liga', 'Cada evento de 8 o más le suma a su organizador (el «Organiza:» del anuncio) la gente que juntó. El primero de la semana organiza la Copa de la siguiente: su próximo evento vale ×2.'],
  ['Semillero', 'Cada semana gana el servidor que más gente nueva trae —gente que juega por primera vez en su vida en la Liga—, en proporción a su gente y con 3 como mínimo. Lleva ×1,5 la semana siguiente.'],
  ['Meta de comunidad', 'Cada lunes, cada servidor recibe una meta de gente distinta en sus eventos (un 10 % más que su promedio). Si la junta, todos los que jugaron ahí esa semana suman +10 %.'],
  ['Bonos', 'Tu segundo evento de la temporada vale ×1,5 si lo jugás dentro de los 7 días del primero. En una semana, jugar en 3 servidores da +1.500 y jugar 3 días distintos, +1.000. Nada de esto toca el Competitivo.'],
  ['Clásico', 'Cuando dos se cruzan en un duelo en su tercer evento (o más), es un Clásico: la llave lo marca con cómo venían, y el que gana suma +10 % en ese evento. Cuentan los eventos, no las batallas. Las rivalidades no se borran con la temporada.'],
  ['Misiones', 'Tres por semana, las mismas para todos, que se renuevan el lunes a las 11 AM (hora del este): se cumplen jugando y cada una suma puntos a tu Temporada; las tres juntas, un bono. Están en el Ranking.'],
  ['Divisiones', 'Una tabla por semana con los puntos de Temporada de esa semana, en grupos de 30, de Sexta a Primera: los primeros de cada grupo suben de división y ganan Puntos de Tienda, y los últimos bajan.'],
  ['Pase de rapero', 'Para los miembros de Discord Rap Español: 30 niveles por temporada. Cada Tarea de la semana que cumplís es un nivel —entrar 3 días seguidos, jugar un evento en DRA, completar tus misiones, felicitar a 3 personas y mirar una llave en vivo— y cada nivel paga Puntos de Tienda; algunos dan una insignia, un título o tu nombre en dorado.'],
  ['Premios de la semana', 'Al cerrar cada semana: la figura (más puntos), la revelación (la figura de los que debutaron), el cazador del Most Wanted y el servidor que más gente movió. La figura y la revelación dan insignia.'],
  ['Insignias', 'Lo que te ganaste, para siempre: debut, podio, campeón, racha, duelos, Most Wanted… Están en tu perfil, con las que te faltan.'],
  ['Con tiempo', 'Los eventos anunciados con 12 horas o más de anticipación llevan 📣 en «Lo que viene» y en el calendario.'],
];
const PALABRAS = [
  ['OVR', 'El número de tu temporada, de 40 a 99. Ordena el ranking y es el que lleva tu tarjeta de Temporada.'],
  ['Score', 'El número del Competitivo, de 0 a 100. Mide la calidad y no la cantidad: de él sale tu rango.'],
  ['Rango', 'La letra, de E a SSS. Es una sola por persona y es la misma en todas tus tarjetas.'],
  ['Racha', 'Eventos seguidos llegando arriba de la llave: la final si es de menos de 16, la semifinal de 16 a 31, cuartos de 32 a 63 y octavos de 64 o más. En Duelos, duelos ganados seguidos.'],
  ['Duelo', 'Una batalla uno contra uno. Los triples, los de cuatro y los de equipos no cuentan: ahí no hay un solo rival.'],
  ['Win%', 'Duelos ganados sobre duelos jugados.'],
  ['Podio', 'Terminar primero, segundo o tercero en un evento.'],
  ['Walk-in', 'Entrar a una llave ya empezada, salteando rondas. Cobra menos, porque se saltó camino.'],
  ['Revivido', 'Volver a la llave después de caer. Cobra su primer puesto entero y una parte del final.'],
  ['Llave', 'El cuadro de un evento, ronda por ronda. Se abre desde «Ver la llave».'],
  ['Temporada', 'La T1 es la primera. El Competitivo se mide dentro de cada temporada y vuelve a cero en la siguiente.'],
  ['Tu servidor', 'El que representás en la Liga: lo elegís en Mi cuenta, entrando con Discord, y sale en tu perfil. Al arrancar la temporada se cambia libre; después, una vez por temporada. Tu tarjeta de Servidor sigue siendo la de donde jugás.'],
  ['Crew', 'Tu equipo. Suma los puntos de su gente; para tener puesto necesita tres raperos en la temporada.'],
  ['Verificado', 'Tener el rol de Miembro en Discord Rap Español, con tu cuenta y tu país. Es lo que habilita la Competitiva y la de País; la Temporada y la Servidor salen al jugar estando en la Lista.'],
  ['Bloqueada', 'La tarjeta que todavía no te ganaste: dice cuánto te falta.'],
  ['Felicitar', 'En Publicaciones, un toque en un logro —un campeón, un rango, el Most Wanted—, uno por persona. Se ve cuántos felicitaron, nunca quiénes, y a quien felicitan le llega un aviso.'],
];
const PREGUNTAS = [
  ['¿Cómo pido mi tarjeta?', <>En Discord, con <code>/card</code>. La Temporada y la Servidor salen solas cuando jugás estando en la Lista; para la Competitiva y la de País hace falta verificarte, y <code>/verificar</code> te dice qué te falta.</>],
  ['¿Cómo aparezco en el ranking?', <>Jugando un evento en un servidor de la Liga. Con una participación ya entrás al ranking de Temporada.</>],
  ['¿Cada cuánto se actualiza?', <>Sola, cada media hora. De 3 a 11 de la mañana (hora del este de EE. UU.) corre dos veces.</>],
  ['¿Por qué mi Competitiva está bloqueada?', <>El Competitivo pide diez eventos en la temporada. Hasta entonces la tarjeta sale bloqueada, con cuántos te faltan.</>],
  ['¿Cómo cambio mi foto?', <>Con <code>/foto</code> en Discord, una vez por temporada.</>],
  ['¿Cómo me entero de los eventos?', <>Activá los <a href="#/avisos">avisos</a> (o escribí <code>/notify</code> en Discord): te llegan al teléfono o a la compu cuando un servidor anuncia uno. También podés sumar el calendario de la Liga a tu Google Calendar desde <a href="#/eventos">Eventos</a>.</>],
  ['¿Mi servidor se puede sumar a la Liga?', <>Sí: escribile a <b>@itsdlx</b> en Discord. Qué gana tu servidor y qué hace el bot, en <a href="#/socios">Socios</a>.</>],
  ['¿Cómo borro mis datos?', <>Escribí <code>/borrar-mis-datos</code> en Discord: te muestra qué se borra y, si confirmás, lo borra al instante. Todo sobre tus datos está en la <a href="privacidad.html">política de privacidad</a>.</>],
];
const NOMBRE_EV = { '16+': '16 o más', '8-15': '8 a 15', '4-7': '4 a 7' };
const PUESTOS = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos', 'Dieciseisavos'];
const MEDALLA = { 'Campeón': '🥇', 'Subcampeón': '🥈', 'Tercero': '🥉' };

const Lista = ({ xs }) => (
  <dl className="gu-glos">{xs.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
);

function Seccion({ id, titulo, bajada, children }) {
  return (
    <section className="gu-sec" id={'gu-' + id} aria-labelledby={'gu-t-' + id}>
      <h2 className="pub-dh" id={'gu-t-' + id}>{titulo}</h2>
      {bajada ? <p className="gu-baj">{bajada}</p> : null}
      {children}
    </section>
  );
}

export function Guia({ liga, dc }) {
  const G = liga.d.guia || {};
  const P = G.puntos || {};
  const reqs = liga.d.requisitos || [];
  const rangos = liga.d.rangos || [];
  const yo = liga.yo;
  // el ejemplo de cada tarjeta: la del mejor que la tiene (son cartas de verdad, no dibujos)
  const ejemplo = (id) => liga.oficiales().find((f) => (f.c || []).includes(id));
  const escs = ['16+', '8-15', '4-7'].filter((e) => ((P.tablas || {})[e] || []).length);
  const vale = (e, p) => { const r = (P.tablas[e] || []).find((x) => x[0] === p); return r ? r[1] : null; };
  const conRango = (liga.d.tabla || []).filter((f) => f.rg).length;
  const ir = (id) => {
    const el = document.getElementById('inicio-nuevo');
    const s = el && el.shadowRoot ? el.shadowRoot.getElementById('gu-' + id) : null;
    if (s) window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
  };
  const maxOvr = Math.max(1, ...(G.ovr || []).map((x) => x[1]));
  const maxSc = Math.max(1, ...(G.score || []).map((x) => x[3]));
  return (
    <>
      <div className="escena gu-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.85 }}>
        <section className="gu-hero">
          <span className="tag">GUÍA · {liga.temp}</span>
          <h1 className="hero-ev largo">Cómo funciona</h1>
          <p className="hero-p">Cómo empezar, qué pide cada tarjeta, cuántos puntos da cada puesto, de dónde sale tu rango y qué significa cada palabra.</p>
        </section>
      </div>
      <nav className="pub-fil gu-fil" aria-label="Secciones de la Guía">
        {SECCIONES.map(([id, t]) => <button type="button" key={id} onClick={() => ir(id)}>{t}</button>)}
      </nav>
      <div className="gu-cuerpo">
        <Seccion id="empezar" titulo="Cómo empezar" bajada="Tres pasos, y el resto sale solo.">
          <ol className="gu-pasos">
            <li>
              <b>1</b><h3>Entrá con Discord</h3>
              <p>Con tu cuenta de Discord: tu foto, tus avisos, votar, seguir y felicitar.</p>
              {dc ? <span className="gu-ok">✓ Ya entraste</span> : <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button>}
            </li>
            <li>
              <b>2</b><h3>Jugá un evento</h3>
              <p>En cualquier servidor de la Liga. Con una participación ya estás en el ranking de la Temporada.</p>
              <a className="btn borde2 chico" href="#/eventos">Ver los eventos</a>
            </li>
            <li>
              <b>3</b><h3>Tu tarjeta</h3>
              <p>La de Temporada y la de Servidor salen solas al jugar. En Discord la pedís con <code>/card</code>.</p>
              <a className="btn borde2 chico" href={yo ? '#/r/' + encodeURIComponent(yo.k) : '#/tarjetas'}>{yo ? 'Ver mi perfil' : 'Ver las tarjetas'}</a>
            </li>
          </ol>
        </Seccion>
        {reqs.length ? (
          <Seccion id="tarjetas" titulo="Tus tarjetas" bajada="Cada una pide algo distinto, porque cada una mide algo distinto. Mientras no llegues, sale la bloqueada con cuánto falta.">
            <div className="gu-cartas">
              {reqs.map((q) => {
                const f = ejemplo(q.id);
                return (
                  <article key={q.id} className="gu-carta">
                    {f ? <Carta liga={liga} k={f.k} cual={q.id} cls="gu-carta-c" abre={false} /> : <span className="gu-carta-c gu-sin" aria-hidden="true">?</span>}
                    <div>
                      <h3>{q.titulo}</h3>
                      <p>{q.mide}</p>
                      <ul>{(q.pide || []).map((p) => <li key={p}>{p === 'nada' ? 'Sin requisito' : p}</li>)}</ul>
                    </div>
                  </article>
                );
              })}
              <article className="gu-carta prox"><span className="gu-carta-c gu-sin" aria-hidden="true">T2</span>
                <div><h3>Histórica y Prime</h3><p>Todas tus temporadas juntas.</p><ul><li>Llegan con la Temporada 2</li></ul></div></article>
            </div>
          </Seccion>
        ) : null}
        {escs.length ? (
          <Seccion id="puntos" titulo="Cuántos puntos da cada puesto" bajada="Depende de cuánta gente juega la llave: ganar una de 16 vale más que ganar una de 6.">
            <div className="gu-tabla">
              <table>
                <thead><tr><th>Puesto</th>{escs.map((e) => <th key={e}>{NOMBRE_EV[e]}<small>raperos</small></th>)}</tr></thead>
                <tbody>{PUESTOS.filter((p) => escs.some((e) => vale(e, p) != null)).map((p) => (
                  <tr key={p}><td>{MEDALLA[p] ? MEDALLA[p] + ' ' : ''}{p}{p === 'Semifinal' ? <small>cuando no se juega el tercer puesto</small> : null}</td>
                    {escs.map((e) => <td key={e}>{vale(e, p) == null ? '—' : num(vale(e, p))}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
            <ul className="gu-notas">
              <li><b>Por equipos</b>: los puntos del puesto se reparten entre los integrantes.</li>
              {(P.walkin || []).length ? <li><b>Walk-in</b>: quien entra salteando rondas cobra {P.walkin.map((w, i) => w[1] + ' % con ' + w[0] + (i === P.walkin.length - 1 ? ' o más' : '') + (w[0] === 1 ? ' ronda' : ' rondas')).join(', ')}.</li> : null}
              {P.revivido != null ? <li><b>Revivido</b>: su primer puesto entero y el {P.revivido} % del puesto final.</li> : null}
            </ul>
          </Seccion>
        ) : null}
        {rangos.length ? (
          <Seccion id="rangos" titulo="Los ocho rangos" bajada={conRango ? 'El rango sale del Score competitivo y es uno solo por persona: da igual en todas tus tarjetas.'
            : 'El rango sale del Score competitivo, y para tenerlo hacen falta 10 eventos en la temporada. Todavía no llegó nadie: acá van los umbrales.'}>
            <div className="gu-rangos">{rangos.map((r) => (
              <div key={r.r} className="gu-rg" style={{ '--c': r.color }}><b>{r.r}</b><small>{r.mat}</small><em>{r.min ? r.min + '+' : 'resto'}</em></div>
            ))}</div>
            <div className="gu-dos">
              {(G.ovr || []).length ? (
                <div className="gu-pesos"><h3>El OVR <small>de 40 a 99 · ordena la temporada</small></h3>
                  {G.ovr.map((x) => <div key={x[0]} className="gu-p"><span>{x[0]}</span><i><u style={{ width: Math.round(100 * x[1] / maxOvr) + '%' }} /></i><b>{x[1]} %</b></div>)}
                  <p className="gu-nota">Cada parte se compara con la mejor de la temporada.</p></div>
              ) : null}
              {(G.score || []).length ? (
                <div className="gu-pesos"><h3>El Score <small>de 0 a 100 · da el rango</small></h3>
                  {G.score.map((x) => <div key={x[1]} className="gu-p"><span>{x[0]} {x[1]}<small>{x[2]}</small></span><i><u style={{ width: Math.round(100 * x[3] / maxSc) + '%' }} /></i><b>{x[3]} %</b></div>)}
                  {(G.conf || []).length ? <p className="gu-nota">Y se multiplica por la <b>confianza</b>, que premia jugar más: {G.conf.map((c, i) => c[1] + ' % ' + (i === G.conf.length - 1 ? 'desde ' : 'con ') + c[0] + (c[0] === 1 ? ' evento' : ' eventos')).join(', ')}.</p> : null}
                </div>
              ) : null}
            </div>
          </Seccion>
        ) : null}
        <Seccion id="mw" titulo="Most Wanted, encuestas y Tienda"><Lista xs={MW_TIENDA} /></Seccion>
        <Seccion id="semana" titulo="Lo de cada semana" bajada="Lo que cambia los puntos semana a semana, y lo que se gana."><Lista xs={SEMANA} /></Seccion>
        <Seccion id="palabras" titulo="Las palabras de la Liga"><Lista xs={PALABRAS} /></Seccion>
        <Seccion id="preguntas" titulo="Preguntas frecuentes">
          <div className="gu-faq">{PREGUNTAS.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        </Seccion>
      </div>
    </>
  );
}
