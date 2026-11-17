// Las piezas de la página de cada servidor (`#/sv/<SIGLA>`) que usan otras páginas: sus redes (`REDES`), una novedad
// (`Nota`), sus MES AWARDS (`MesSv`) y sus promos (`PromosSv`). La página es entidad2.jsx desde el 02/11/2026 (Dlx:
// «Publica y haz todo»), junto con la de cada país y cada crew. La de antes —la del 30/09/2026 (Dlx: «acuérdate cada
// servidor, crew y país tendrían su propio perfil»)— vivía acá y se borró al publicar el remake.
import { num, siglaDe } from './liga.js';
import { Sec, accion } from './piezas.jsx';
import { Vis } from './medio.jsx';
import { Pub, useAplausos } from './publicaciones.jsx';
import { Nominado, reparto, useSalon } from './mesawards.jsx';
import { CatsSv, Franja, QUIEN_VOTA, mayus } from './mesvoto.jsx';

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
// 🗳️ DESDE EL 17/11/2026 SE VOTA CON LA MISMA TARJETA Y LA MISMA FRANJA QUE EN EL SALÓN (mesvoto.jsx, el remake «D»):
// hasta acá esta página usaba la `Categoria` vieja de mesawards.jsx y votar se veía distinto en cada lado. Y el resto del
// mes la sección está, con cuándo salen los nominados (antes no se dibujaba hasta el día 1)
export function MesSv({ liga, sv, enc }) {
  const S = useSalon();
  if (!S || !S.cats_sv) return null;
  const ab = S.abierto && S.abierto.sv && S.abierto.sv[sv] ? S.abierto : null;
  const hist = (S.hist || []).filter((m) => m.sv && m.sv[sv] && S.cats_sv.some(([c]) => ((((m.sv[sv].cats || {})[c] || {}).nom) || []).length));
  // el mes que corre, sólo en los que tienen MES AWARDS: los Tier 1 (o uno que ya tuvo)
  const espera = !ab && S.vivo && ((liga.svs[sv] || {}).tier === 1 || hist.length) ? S.vivo : null;
  if (!ab && !hist.length && !espera) return null;
  const sigla = siglaDe(sv);
  const premio = (S.premio_sv || {}).rapero ? ', ' + num(S.premio_sv.rapero) + ' Puntos de Tienda' : '';
  // el último mes cerrado, con las tarjetas; mientras se vota, en una línea por categoría como los de antes (dos filas de
  // cartas con las mismas caras, una para votar y otra de ganadores, eran 900 px más en la compu)
  const [ult, ...antes] = ab ? [null, ...hist] : hist;
  return (
    <Sec id="sv-mes" titulo="MES AWARDS" enlace="El Salón de la fama" href="#/salon" extra="negra sf-mes">
      {ab ? <Franja liga={liga} enc={enc} S={S} sv={sv} modo={ab.votando ? 'vota' : 'nominados'} />
        : espera ? <Franja liga={liga} enc={enc} S={S} sv={sv} modo="espera" propio /> : null}
      <p className="ma-como">Los nominados salen de lo que se jugó en {sigla} cada mes. {QUIEN_VOTA(sigla, ab ? ab.nombre : '')} Una vez por
        categoría, y se puede cambiar hasta que cierra. El ganador se lleva su insignia{premio} y su lugar en esta página.</p>
      {ab ? <CatsSv liga={liga} enc={enc} S={S} sv={sv} m={ab} votando={ab.votando} /> : null}
      {hist.length ? (
        <div className="ma-hist">
          <h3 className="lgf-st">{ult ? 'Los ganadores de ' + ult.nombre : 'Los ganadores'}</h3>
          {ult ? <CatsSv liga={liga} enc={enc} S={S} sv={sv} m={ult} cerrado /> : null}
          {/* los meses de antes, en una línea por categoría */}
          {antes.map((m) => (
            <div key={m.mes} className="ma-hm">
              <small>{mayus(m.nombre)} {m.mes.slice(0, 4)}</small>
              <ul>{S.cats_sv.map(([c, n]) => {
                const x = (m.sv[sv].cats || {})[c] || {};
                const fila = (x.nom || []).find((y) => y.op === x.gana);
                return fila ? <li key={c}><Nominado liga={liga} cat={c} x={fila} /><em>{n}</em>{reparto(x, liga)}</li> : null;
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
