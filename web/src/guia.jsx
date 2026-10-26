// La Guía, rehecha (`#/guia`). Dlx, 02/10/2026: «reworkeemos GUÍA», y al plan —arranca con «cómo empezar» en tres pasos y
// sigue con un índice: las tarjetas, los puntos, los rangos, el Most Wanted, la semana, las palabras y las preguntas—:
// «4. A». Para todos desde la 2.02 (Dlx, 03/10/2026: «2. A»).
//
// ⚠️ LOS NÚMEROS SALEN DE DONDE SE CALCULAN, como en la de app.js: los requisitos de `comun/requisitos.py`, los rangos de
// `comun/rangos.py`, los puntos de `Config` y los pesos de `sheet/ovr.py` y `sheet/competitivo.py` (`_guia()` de
// bot/subir_web.py). Acá no se escribe ninguno. Lo que es texto —las palabras, las preguntas— es el de la Guía de
// app.js (index.html), ordenado por tema.
import { Suspense, lazy, useEffect, useState } from 'react';
import TAGS from './tags_catalogo.json';
import { num } from './liga.js';
import { Carta, ConMas, Medalla, PUESTO_MEDALLA } from './piezas.jsx';
import * as RQ from './requisitos.js';
import CSS_PAGINA from './css/guia.css?inline';
import { usarCss } from './css.js';

// 🎨 su CSS, con su pedazo (web/src/css/guia.css)
usarCss('guia', CSS_PAGINA);

const PrimerosPasos = lazy(() => import('./tutorial.jsx').then((m) => ({ default: m.PrimerosPasos })));

// ✍️ lo que pide cada tarjeta, dicho para alguien nuevo (Dlx, 07/10/2026: «sé más descriptivo»). El número sale del
// payload («10 eventos», de `comun/requisitos.py`); qué es y cómo se consigue, de `requisitos.js`
const pideLargo = (p) => {
  if (p === 'nada') return 'Sin requisito';
  if (/verificad/i.test(p)) return RQ.verificadoGuia;
  if (/pase/i.test(p)) return RQ.paseGuia;
  const m = /^(\d+)\s+(.+)$/.exec(p);
  return m ? RQ.queEs(m[2], Number(m[1])) : p;
};

const SECCIONES = [
  ['empezar', 'Cómo empezar'], ['tarjetas', 'Tarjetas'], ['tags', 'Los TAG'], ['puntos', 'Puntos'], ['rangos', 'Rangos'],
  ['mw', 'Most Wanted'], ['semana', 'La semana'], ['palabras', 'Palabras'], ['preguntas', 'Preguntas'],
];

// las palabras de la Liga, por tema (el texto de la Guía de siempre)
const MW_TIENDA = [
  ['Most Wanted', 'Los buscados de la semana{MW}, de lunes a lunes, cada uno con su recompensa. El primero que le gana a uno en un evento de la Liga lo caza y cobra; si nadie lo caza y jugó, sobrevive y se lleva la mitad. Lo cobrado suma a tus Puntos de la Temporada, nunca al Competitivo, y además el 10 % va a tus Puntos de Tienda.'],
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
  ['Semillero', 'Cada semana gana el servidor que más gente nueva trae (gente que juega por primera vez en su vida en la Liga), en proporción a su gente y con 3 como mínimo. Lleva ×1,5 la semana siguiente.'],
  ['Meta de comunidad', 'Cada lunes, cada servidor recibe una meta de gente distinta en sus eventos (un 10 % más que su promedio). Si la junta, todos los que jugaron ahí esa semana suman +10 %.'],
  ['Bonos', 'Tu segundo evento de la temporada vale ×1,5 si lo juegas dentro de los 7 días del primero. En una semana, jugar en 3 servidores da +1.500 y jugar 3 días distintos, +1.000. Nada de esto toca el Competitivo.'],
  ['Clásico', 'Cuando dos se cruzan en un duelo en su tercer evento (o más), es un Clásico: la llave lo marca con cómo venían, y el que gana suma +10 % en ese evento. Cuentan los eventos, no las batallas. Las rivalidades no se borran con la temporada.'],
  ['Misiones', 'Tres por semana, las mismas para todos, que se renuevan el lunes a las 11 AM (hora del este): se cumplen jugando y cada una suma puntos a tu Temporada; las tres juntas, un bono. Están en el Ranking.'],
  ['Divisiones (Ranking ELO)', 'De Sexta a Primera. Desde el 2 de noviembre tu división sale de tu ELO: tu nivel según a quién le ganas y con quién pierdes en las batallas 1v1. Se mira cada lunes, y llegar por primera vez a una división paga Puntos de Tienda. Antes era una tabla por semana con los puntos de Temporada, en grupos de 30.'],
  // ⚠️ decía «cada Tarea de la semana es un nivel», que es de antes de la XP (2.46): se corrigió con lo de «sé más
  // descriptivo» (Dlx, 07/10/2026)
  ['Pase de rapero', 'Para los miembros de Discord Rap Español: 30 niveles por temporada. Las Tareas (diarias, semanales y de toda la temporada) dan XP, y la XP te sube de nivel; cada nivel paga Puntos de Tienda. El primero (dos Tareas diarias o una semanal) da tu tarjeta de Temporada, y otros una insignia, un título o tu nombre en dorado. Están en la página del Pase.'],
  ['Premios de la semana', 'Al cerrar cada semana: la figura (más puntos), la revelación (la figura de los que debutaron), el cazador del Most Wanted y el servidor que más gente movió. La figura y la revelación dan insignia.'],
  ['Insignias', 'Lo que te ganaste, para siempre: debut, podio, campeón, racha, duelos, Most Wanted… Están en tu perfil, con las que te faltan.'],
  ['Con tiempo', 'Los eventos anunciados con 12 horas o más de anticipación llevan 📣 en «Lo que viene» y en el calendario.'],
];
const PALABRAS = [
  ['OVR', 'El número de tu temporada, de 40 a 99. Ordena el ranking y es el que lleva tu tarjeta de Temporada.'],
  ['Score', 'El número del Competitivo, de 0 a 100. Mide la calidad y no la cantidad: de él sale tu rango.'],
  ['Rango', 'La letra, de E a SSS. Es una sola por persona y es la misma en todas tus tarjetas.'],
  ['Racha', 'Eventos seguidos llegando arriba de la llave: la final si es de menos de 16, la semifinal de 16 a 31, cuartos de 32 a 63 y octavos de 64 o más. En Duelos, duelos ganados seguidos.'],
  ['Evento', 'Un torneo de cualquier servidor asociado a la Liga Global, con su llave. Cada uno en el que participas cuenta, ganes o pierdas: son los que pide la Competitiva.'],
  ['Duelo', 'Una batalla uno contra uno. Los triples, los de cuatro y los de equipos no cuentan: ahí no hay un solo rival.'],
  ['Cruce nacional', 'Cruzarte con alguien de tu mismo país en una llave: en un 1 contra 1 o en un triple (cada rival del triple es un cruce). Con alguien de otro país es internacional. La tarjeta de País pide de los dos; un triple no cuenta como duelo para el Ranking Duelos ni el Win%.'],
  ['Win%', 'Duelos ganados sobre duelos jugados.'],
  ['Podio', 'Terminar primero, segundo o tercero en un evento.'],
  ['Walk-in', 'Entrar a una llave ya empezada, salteando rondas. Cobra menos, porque se saltó camino.'],
  ['Revivido', 'Volver a la llave después de caer. Cobra su primer puesto entero y una parte del final.'],
  ['Llave', 'El cuadro de un evento, ronda por ronda. Se abre desde «Ver la llave».'],
  ['Temporada', 'La T1 es la primera. El Competitivo se mide dentro de cada temporada y vuelve a cero en la siguiente.'],
  ['Tu servidor', 'El que representas en la Liga: lo eliges en Mi cuenta, entrando con Discord, y sale en tu perfil y en el Ranking. Si no eliges, no se muestra ninguno. Al arrancar la temporada se cambia libre; después, una vez por temporada. Tu tarjeta de Servidor sigue siendo la de donde juegas.'],
  ['Crew', 'Tu equipo. Suma los puntos de su gente; para tener puesto necesita tres raperos en la temporada.'],
  ['Verificado', 'Tener el rol de Miembro en Discord Rap Español (DRA), con tu cuenta y tu país. Se hace una vez, en «Verificarme» (Mi cuenta): entras con Discord, eliges tu país y el bot te mete al servidor y te da el rol. Sin verificarte no hay tarjetas: verificarte desbloquea tu Servidor, y con el nivel 1 del Pase, tu Temporada.'],
  ['Bloqueada', 'La tarjeta que todavía no te ganaste: dice cuánto te falta.'],
  // ⭐ el nivel de cada uno, que no es el del Pase (14/10/2026)
  ['Nivel', 'El tuyo, no el del Pase: dice qué tan activo eres en la Liga y abre los temas de la página (en el nivel 2, 3 y 5). Sube jugando eventos (+10 cada uno), cada día que entras (+2) y con lo que haces: mirar una llave en vivo, seguir raperos, votar, felicitar, apostar, poner precios, reportar un error que se corrigió, activar la campana, mostrar tus redes, ponerle fondo a tu perfil o foto a una tarjeta y las Tareas del Pase. Cada cosa cuenta una vez y con tope: en Mi cuenta, «Cómo subir de nivel».'],
  ['Felicitar', 'En Publicaciones, un toque en un logro (un campeón, un rango, el Most Wanted), uno por persona. Se ve cuántos felicitaron, nunca quiénes, y a quien felicitan le llega un aviso.'],
];
const PREGUNTAS = [
  ['¿Cómo pido mi tarjeta?', <>En Discord, con <code>/card</code>. Son dos pasos: verifícate (entrando con Discord en <a href="#/cuenta">Mi cuenta</a>) y se desbloquea tu Servidor; cumplí tu primera Tarea del <a href="#/pase">Pase de rapero</a> y se desbloquea tu Temporada. La Competitiva y la de País piden además su requisito, y <code>/verificar</code> te dice qué te falta.</>],
  ['¿Cómo aparezco en el ranking?', <>Jugando un evento en un servidor de la Liga. Con una participación ya entras al ranking de Temporada.</>],
  ['¿Cada cuánto se actualiza?', <>Sola, cada media hora. De 3 a 11 de la mañana (hora del este de EE. UU.) corre dos veces.</>],
  ['¿Por qué mi Competitiva está bloqueada?', <>Pide participar en diez eventos de cualquier servidor asociado a la Liga Global, en la temporada, y estar verificado. Hasta entonces la tarjeta sale bloqueada, con cuántos te faltan; tu perfil también lo dice.</>],
  ['¿Cómo cambio mi foto?', <>Con <code>/foto</code> en Discord, una vez por temporada.</>],
  ['¿Cómo me entero de los eventos?', <>Activa los <a href="#/avisos">avisos</a> (o escribe <code>/notify</code> en Discord): te llegan al teléfono o a la compu cuando un servidor anuncia uno. También puedes sumar el calendario de la Liga a tu Google Calendar desde <a href="#/eventos">Eventos</a>.</>],
  ['¿Mi servidor se puede sumar a la Liga?', <>Sí: escribile a <b>@itsdlx</b> en Discord. Qué gana tu servidor y qué hace el bot, en <a href="#/socios">Socios</a>.</>],
  ['¿Cómo borro mis datos?', <>Escribe <code>/borrar-mis-datos</code> en Discord: te muestra qué se borra y, si confirmas, lo borra al instante. Todo sobre tus datos está en la <a href="privacidad.html">política de privacidad</a>.</>],
];
const NOMBRE_EV = { '16+': '16 o más', '8-15': '8 a 15', '4-7': '4 a 7' };
const PUESTOS = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos', 'Dieciseisavos'];
const MEDALLA = PUESTO_MEDALLA;

const Lista = ({ xs }) => (
  <dl className="gu-glos">{xs.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
);

// 🏷️ LOS TAG DE LAS TARJETAS (Dlx, 19/10/2026, «me gusta todo», a «un catálogo de TAGs en la Guía… cuáles hay, qué
// pide cada uno y cuáles tenés vos»). El catálogo es `tags_catalogo.json`, la copia de `sheet/catalogo_tags.py` (CI la
// compara contra las cuatro cascadas de verdad); cuál tiene cada uno lo trae `/api/tags` al abrir la Guía, y de ahí
// sale también cuánta gente tiene cada uno: lo raro se ve raro
const CARTAS_TAG = [['temporada', 'Temporada'], ['competitivo', 'Competitiva'], ['servidor', 'Servidor'], ['pais', 'País']];
function TagsCatalogo({ liga }) {
  const [cual, setCual] = useState('temporada');
  const [de, setDe] = useState(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/tags', { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null))
      // sin respuesta, sin números: «0 lo tienen» diría algo que no se sabe
      .then((d) => { if (vivo) setDe((d && d.de) || null); }).catch(() => { if (vivo) setDe(null); });
    return () => { vivo = false; };
  }, []);
  const col = CARTAS_TAG.findIndex(([c]) => c === cual);
  const lista = (TAGS.cat || {})[cual] || [];
  const cuantos = lista.map(() => 0);
  Object.values(de || {}).forEach((v) => { const i = (v || [])[col]; if (i >= 0 && i < cuantos.length) cuantos[i] += 1; });
  const yo = liga.yo && de ? (de[liga.yo.k] || null) : null;
  const mios = yo ? CARTAS_TAG.map(([c, n], j) => [n, yo[j] >= 0 ? ((TAGS.cat[c] || [])[yo[j]] || [])[0] : '']).filter((x) => x[1]) : [];
  return (
    <>
      {mios.length ? (
        <div className="gu-tags-tuyos"><b>Los tuyos hoy</b>{mios.map(([n, t]) => <span key={n}><small>{n}</small>{t.replace('%d', '')}</span>)}</div>
      ) : null}
      <div className="gu-tabs" role="tablist" aria-label="Los TAG de cada tarjeta">
        {CARTAS_TAG.map(([c, n]) => (
          <button key={c} type="button" role="tab" aria-selected={c === cual} className={c === cual ? 'on' : ''} onClick={() => setCual(c)}>
            {n}<small>{((TAGS.cat || {})[c] || []).length}</small></button>
        ))}
      </div>
      <ul className="gu-tags">{lista.map(([t, nivel, pide], i) => {
        const tuyo = yo && yo[col] === i;
        return (
          <li key={t} className={tuyo ? 'tuyo' : ''}>
            {/* ⚠️ `gu-n1`… y no `t1`…: `.t3` de estilo.css es una grilla de tres columnas, y el TAG raro la heredaba */}
            <span className={'gu-tag gu-n' + String(nivel).slice(1)}>{t.replace(' x%d', ' ×N').replace('%d', 'N')}</span>
            <span className="gu-tag-p">{pide}<small>{(TAGS.niveles || {})[nivel] || ''}{de ? ' · ' + (cuantos[i] === 1 ? '1 lo tiene' : cuantos[i] + ' lo tienen') : ''}
              {tuyo ? ' · el tuyo' : ''}</small></span>
          </li>
        );
      })}</ul>
      <p className="gu-nota">Cada tarjeta muestra uno solo: el primero de la lista que cumples. El mismo hecho no sale en dos tarjetas tuyas.</p>
    </>
  );
}

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
        <ConMas max={5}>
          {SECCIONES.map(([id, t]) => <button type="button" key={id} onClick={() => ir(id)}>{t}</button>)}
        </ConMas>
      </nav>
      <div className="gu-cuerpo">
        {/* 🧭 los pasos se tildan solos (Dlx, 12/10/2026, el tutorial: «A pero que no sea necesariamente con jugar»):
            la misma lista que el Inicio le muestra a quien llegó hace poco. Ver tutorial.jsx */}
        <Seccion id="empezar" titulo="Cómo empezar" bajada="Cinco pasos, y ninguno pide jugar: se tildan solos a medida que los haces.">
          <Suspense fallback={null}><PrimerosPasos liga={liga} dc={dc} enGuia /></Suspense>
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
                      <ul>{(q.pide || []).map((p) => <li key={p}>{pideLargo(p)}</li>)}</ul>
                    </div>
                  </article>
                );
              })}
              <article className="gu-carta prox"><span className="gu-carta-c gu-sin" aria-hidden="true">T2</span>
                <div><h3>Histórica y Prime</h3><p>Todas tus temporadas juntas.</p><ul><li>Llegan con la Temporada 2</li></ul></div></article>
            </div>
          </Seccion>
        ) : null}
        <Seccion id="tags" titulo="Los TAG de las tarjetas" bajada="El cartelito de abajo de cada tarjeta. Hay de cuatro niveles —legendario, épico, raro y común— y cada uno pide algo.">
          <TagsCatalogo liga={liga} />
        </Seccion>
        {escs.length ? (
          <Seccion id="puntos" titulo="Cuántos puntos da cada puesto" bajada="Depende de cuánta gente juega la llave: ganar una de 16 vale más que ganar una de 6.">
            <div className="gu-tabla">
              <table>
                <thead><tr><th>Puesto</th>{escs.map((e) => <th key={e}>{NOMBRE_EV[e]}<small>raperos</small></th>)}</tr></thead>
                <tbody>{PUESTOS.filter((p) => escs.some((e) => vale(e, p) != null)).map((p) => (
                  <tr key={p}><td><Medalla p={MEDALLA[p]} />{p}{p === 'Semifinal' ? <small>cuando no se juega el tercer puesto</small> : null}</td>
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
        {/* 🎯 cuántos buscados, del payload (`most_wanted.CUANTOS`): decía «9 por semana» cuando ya eran 12 */}
        <Seccion id="mw" titulo="Most Wanted, encuestas y Tienda"><Lista xs={MW_TIENDA.map(([t, d]) => [t, d.replace('{MW}', G.mw ? ' (' + G.mw + ')' : '')])} /></Seccion>
        <Seccion id="semana" titulo="Lo de cada semana" bajada="Lo que cambia los puntos semana a semana, y lo que se gana."><Lista xs={SEMANA} /></Seccion>
        <Seccion id="palabras" titulo="Las palabras de la Liga"><Lista xs={PALABRAS} /></Seccion>
        <Seccion id="preguntas" titulo="Preguntas frecuentes">
          <div className="gu-faq">{PREGUNTAS.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        </Seccion>
      </div>
    </>
  );
}
