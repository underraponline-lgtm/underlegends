// Las piezas de la página de cada servidor (`#/sv/<SIGLA>`) que usan otras páginas: sus redes (`REDES`), una novedad
// (`Nota`), sus MES AWARDS (`MesSv`) y sus promos (`PromosSv`). La página es entidad2.jsx desde el 02/11/2026 (Dlx:
// «Publica y haz todo»), junto con la de cada país y cada crew. La de antes —la del 30/09/2026 (Dlx: «acuérdate cada
// servidor, crew y país tendrían su propio perfil»)— vivía acá y se borró al publicar el remake.
import { num, siglaDe } from './liga.js';
import { Sec, accion } from './piezas.jsx';
import { Vis } from './medio.jsx';
import { Pub, useAplausos } from './publicaciones.jsx';
import { Categoria, Nominado, reparto, useSalon } from './mesawards.jsx';

export const REDES = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', twitch: 'Twitch', x: 'X', twitter: 'X', kick: 'Kick' };

export function ir(d) {
  if (!d) return;
  if (d.carta) accion.carta(d.carta, d.cual);
  else if (d.perfil) accion.perfil(d.perfil);
  else if (d.llave) accion.llave(d.llave);
  else if (d.ruta) location.hash = d.ruta;
  else if (d.link) window.open(d.link, '_blank', 'noopener');
  // la caza del Most Wanted (`{ancla:'sebusca'}`): su ranking (revisión del 03/10/2026)
  else if (d.ancla) location.hash = d.ancla === 'sebusca' ? '#/ranking/mw' : '#/';
}

// 🧹 el dibujo de cada novedad sale de UN lugar (`Vis` de medio.jsx): esta copia no conocía el flyer ni el logo de UL, y
// el flyer de una liga salía roto («/logos/https://…», lo encontró el recorrido del 19/10/2026)
export function Nota({ liga, x }) {
  const vis = <Vis liga={liga} v={x[2]} />;
  return (
    <li><button type="button" className="sin-boton nota-b" onClick={() => ir(x[4])}>
      {vis}<div><span className="cat">{x[0]}</span><b>{x[1]}</b><small>{x[3].charAt(0).toUpperCase() + x[3].slice(1)}</small></div>
    </button></li>
  );
}

// 📣 LAS PROMOS DE ESTE SERVIDOR: lo que los raperos de la Lista compartieron en su canal de promoción (bot/promos.py),
// del muro. Las cuatro más nuevas; sin ninguna, no se dibuja
// 🏟️ LOS MES AWARDS DE ESTE SERVIDOR (Dlx, 18/10/2026: «hacer también los awards para servidor TIER 1», y a la pregunta,
// «cada Tier 1 con los suyos»: su rapero, su revelación, su batalla y su staff del mes, con lo que se jugó acá, votados
// por sus jugadores). Salen de `/api/salon` (`bot/mes_awards.py`) y se votan como los de la Liga (`enc`); quién puede
// votar lo decide el Worker. Sin nominados ni ganadores, no se dibuja: se ve desde el día 1 del mes siguiente
export function MesSv({ liga, sv, enc }) {
  const S = useSalon();
  if (!S || !S.cats_sv) return null;
  const ab = S.abierto && S.abierto.sv && S.abierto.sv[sv] ? S.abierto : null;
  const hist = (S.hist || []).filter((m) => m.sv && m.sv[sv]);
  if (!ab && !hist.length) return null;
  const s = ab ? ab.sv[sv] : null;
  const votando = !!(ab && ab.votando);
  const capM = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  return (
    <Sec id="sv-mes" titulo="MES AWARDS" enlace="El Salón de la fama" href="#/salon" extra="negra sf-mes">
      {ab ? <p className="ma-cab">{votando ? <>Vota lo mejor de <b>{ab.nombre}</b> en {siglaDe(sv)}: cierra {liga.dia(ab.cierra)}.</>
        : <>Los nominados de <b>{ab.nombre}</b> en {siglaDe(sv)}: la votación abre {liga.dia(ab.abre)}.</>}</p> : null}
      <p className="ma-como">Los nominados salen de lo que se jugó en {siglaDe(sv)} ese mes, y votan los que jugaron acá: una vez por categoría,
        y se puede cambiar hasta que cierra. El ganador se lleva su insignia{(S.premio_sv || {}).rapero ? ', ' + num(S.premio_sv.rapero) + ' Puntos de Tienda' : ''} y su lugar en esta página.</p>
      {s ? (
        // de a tres cuando son tres: en la compu, el Staff quedaba solo con un hueco al lado
        <div className={'ma-cats' + (S.cats_sv.filter(([c]) => (((s.cats || {})[c] || {}).nom || []).length).length === 3 ? ' ma-tres' : '')}>{S.cats_sv.map(([c, n, de]) => {
          const nom = ((s.cats || {})[c] || {}).nom || [];
          return nom.length ? <Categoria key={c} liga={liga} enc={enc} cat={c} nombre={n} de={de} nom={nom}
            encId={votando && nom.length >= 2 ? 'mes:' + ab.mes + ':' + sv + ':' + c : ''} /> : null;
        })}</div>
      ) : null}
      {hist.length ? (
        <div className="ma-hist">
          <h3 className="lgf-st">Los ganadores</h3>
          {hist.map((m) => (
            <div key={m.mes} className="ma-hm">
              <small>{capM(m.nombre)} {m.mes.slice(0, 4)}</small>
              <ul>{S.cats_sv.map(([c, n]) => {
                const x = (m.sv[sv].cats || {})[c] || {};
                const fila = (x.nom || []).find((y) => y.op === x.gana);
                return fila ? <li key={c}><Nominado liga={liga} cat={c} x={fila} /><em>{n}</em>{reparto(x)}</li> : null;
              })}</ul>
            </div>
          ))}
        </div>
      ) : null}
    </Sec>
  );
}

export function PromosSv({ liga, sv }) {
  const A = useAplausos();
  const xs = (liga.muro || []).filter((it) => it.tipo === 'promo' && it.sv === sv && it.o !== 'liga').slice(0, 4);
  if (!xs.length) return null;
  return (
    <Sec id="sv-promos" titulo={'Se promociona en ' + siglaDe(sv)} enlace="Todas las promos" href="#/publicaciones">
      <div className="pub-dia sv-promos">{xs.map((it) => <Pub key={it.id} liga={liga} it={it} A={A} />)}</div>
    </Sec>
  );
}
