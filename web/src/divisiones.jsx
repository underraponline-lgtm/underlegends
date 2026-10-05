// 🏟️ LAS DIVISIONES DE LA SEMANA (Dlx, 29/09/2026: «como otro tipo de eventos semanales»; 04/10/2026: «1. A 2. C,
// subir a una división mejor y más competitiva»). La cuenta la hace el ciclo (`bot/divisiones.py`) y viaja en el
// lobby (`div`): acá sólo se muestra. Una tabla por grupo de 30; los de arriba suben y los de abajo bajan.
//
// ⚠️ LA ZONA ES LA MISMA CUENTA QUE `divisiones.zona()`: cinco, o un tercio si el grupo es chico. Si se cambia allá,
// se cambia acá.
import { useEffect, useState } from 'react';
import { MESES, limpio, num } from './liga.js';
import { Cara } from './piezas.jsx';

const zonaDe = (n, z) => Math.min(z, Math.floor(n / 3));

function fechaCorta(iso) {
  const d = new Date(String(iso || '') + 'T12:00:00');
  return isNaN(d) ? '' : d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3);
}

// La semana recién empezada, sin nadie que haya jugado todavía: en qué división estás y cómo cerró la anterior.
// ⚠️ Antes las divisiones desaparecían de la página cada lunes hasta el primer evento (ver `divisiones.para_web()`).
function SemanaNueva({ liga, D, esYo }) {
  const nombres = D.n || [];
  const yo = liga.yo;
  const mio = yo ? Object.keys(D.v || {}).find(esYo) : null;
  const ult = D.u;
  const ultYo = ult && yo ? (ult.sube.some(esYo) ? 'subiste' : ult.baja.some(esYo) ? 'bajaste' : '') : '';
  return (
    <div className="dvp">
      <p className="dvp-cab"><b>Semana nueva</b> · todavía nadie jugó · cierra {liga.dia(D.fin)}</p>
      <p className="dvp-yo">{mio != null ? 'Estás en ' + nombres[D.v[mio]] + ' División: jugá un evento y entrás en la tabla de esta semana.'
        : 'Jugás un evento y entrás en Sexta; los primeros de cada grupo suben.'}</p>
      {ult ? <p className="dvp-yo">{ultYo ? (ultYo === 'subiste' ? '⬆️ La semana pasada subiste de división. ' : '⬇️ La semana pasada bajaste de división. ') : ''}
        La semana del {fechaCorta(ult.sem)} subieron {ult.sube.length} y bajaron {ult.baja.length}.</p> : null}
      {/* los que subieron la semana pasada, con su cara: la previa no queda en tres renglones (sin huecos grandes) */}
      {ult && ult.sube.length ? (
        <ul className="dvp-sub" aria-label="Subieron la semana pasada">
          {ult.sube.slice(0, 8).map((raw) => {
            const f = liga.fila(raw);
            return (
              <li key={raw}>
                {f ? <Cara liga={liga} k={f.k} nombre={f.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>}
                {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <span className="dv-n">{limpio(raw)}</span>}
                <i className="dv-z">SUBIÓ</i>
              </li>
            );
          })}
          {ult.sube.length > 8 ? <li className="dvp-mas">y {ult.sube.length - 8} más</li> : null}
        </ul>
      ) : null}
      <a className="evp-lnk dvp-lnk" href="#/ranking/divisiones">Ver las divisiones</a>
    </div>
  );
}

// 🏟️ LA PREVIA DEL INICIO (Dlx, 05/10/2026: «que divisiones tenga su espacio en INICIO también como una previa…
// el primer panel donde está tu temporada y encuestas»). Tu grupo de esta semana —o, si no jugaste, el de la división
// más alta con gente—: los de la zona de subida, y vos si estás más abajo. La tabla entera está en el Ranking.
export function DivisionPrevia({ liga }) {
  const D = liga.d.div;
  if (!D) return null;
  const yo = liga.yo;
  const nombres = D.n || [];
  const divs = D.d || [];
  const esYo = (raw) => !!yo && liga.esDe(raw, yo.k);
  let di = -1, gi = -1;
  divs.forEach((gs, i) => (gs || []).forEach((g, j) => { if (di < 0 && g.some((f) => esYo(f[0]))) { di = i; gi = j; } }));
  const mia = di >= 0;
  if (!mia) { di = divs.findIndex((gs) => (gs || []).length); gi = 0; }
  if (di < 0) return <SemanaNueva liga={liga} D={D} esYo={esYo} />;
  const g = (divs[di] || [])[gi] || [];
  const z = zonaDe(g.length, D.z);
  const ultima = nombres.length - 1;
  const pos = mia ? g.findIndex((f) => esYo(f[0])) : -1;
  const filas = g.slice(0, Math.max(z, 3)).map((f, i) => [f, i]);
  if (pos >= filas.length) filas.push([g[pos], pos]);
  const estado = !mia ? (yo ? 'Esta semana todavía no jugaste: con un evento entrás en tu división.'
    : 'Jugás un evento y entrás en Sexta.')
    : pos < z && di > 0 ? '⬆️ Vas ' + (pos + 1) + 'º: estás en zona de subida.'
      : pos >= g.length - z && di < ultima ? '⬇️ Vas ' + (pos + 1) + 'º: estás en zona de descenso.'
        : 'Vas ' + (pos + 1) + 'º de ' + g.length + '.';
  return (
    <div className="dvp">
      <p className="dvp-cab"><b>{nombres[di]} División</b>{(divs[di] || []).length > 1 ? ' · grupo ' + (gi + 1) : ''} · {g.length} jugando · cierra {liga.dia(D.fin)}</p>
      <p className="dvp-yo">{estado} Los {z} primeros de cada grupo suben y ganan <b>{num(D.p)} Puntos de Tienda</b>.</p>
      <ol className="dv-tabla dvp-tabla">
        {filas.map(([f, i]) => {
          const p = liga.fila(f[0]);
          const sube = di > 0 && i < z;
          return (
            <li key={f[0]} className={(sube ? 'sube' : '') + (esYo(f[0]) ? ' yo' : '') + (i === z && filas.length > z ? ' corte' : '')}>
              <span className="dv-i">{i + 1}</span>
              {p ? <Cara liga={liga} k={p.k} nombre={p.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(f[0]).slice(0, 1).toUpperCase()}</span>}
              {p ? <a className="dv-n" href={'#/r/' + encodeURIComponent(p.k)}>{limpio(f[0])}</a> : <span className="dv-n">{limpio(f[0])}</span>}
              {sube ? <i className="dv-z">SUBE</i> : <span />}
              <b className="dv-p">{num(f[1])}</b>
            </li>
          );
        })}
      </ol>
      <a className="evp-lnk dvp-lnk" href="#/ranking/divisiones">Ver todas las divisiones</a>
    </div>
  );
}

export function Divisiones({ liga }) {
  const D = liga.d.div;
  const yo = liga.yo;
  const nombres = (D && D.n) || [];
  const divs = (D && D.d) || [];
  const esYo = (raw) => !!yo && liga.esDe(raw, yo.k);
  const mia = divs.findIndex((gs) => (gs || []).some((g) => g.some((f) => esYo(f[0]))));
  const conGente = divs.findIndex((gs) => (gs || []).length);
  const [sel, setSel] = useState(mia >= 0 ? mia : Math.max(0, conGente));
  useEffect(() => { if (mia >= 0) setSel(mia); }, [mia]);
  if (!D) return null;
  const ult = D.u;
  const ultYo = ult && yo ? (ult.sube.some(esYo) ? 'sube' : ult.baja.some(esYo) ? 'baja' : '') : '';
  const gs = divs[sel] || [];
  const ultima = nombres.length - 1;
  return (
    <div className="dv">
      <p className="dv-cab">Semana del {fechaCorta(D.sem)} · cierra {liga.dia(D.fin)}.
        {' '}Los {D.z} primeros de cada grupo suben y ganan <b>{num(D.p)} Puntos de Tienda</b>; los {D.z} últimos bajan.
        {' '}En un grupo chico, un tercio.</p>
      {ult ? <p className="dv-ult">{ultYo === 'sube' ? '⬆️ La semana pasada subiste de división. ' : ultYo === 'baja' ? '⬇️ La semana pasada bajaste de división. ' : ''}
        La semana del {fechaCorta(ult.sem)} subieron {ult.sube.length} y bajaron {ult.baja.length}.</p> : null}
      {!divs.some((x) => (x || []).length) ? <p className="dv-cab"><b>Semana nueva:</b> todavía nadie jugó. Las tablas arrancan con el primer evento de la semana.</p> : null}
      <div className="rk-chips dv-divs" role="group" aria-label="División">
        {nombres.map((n, i) => ((divs[i] || []).length ? (
          <button type="button" key={n} className={i === sel ? 'on' : ''} aria-pressed={i === sel} onClick={() => setSel(i)}>
            {n}{i === mia ? ' · la tuya' : ''}</button>
        ) : null))}
      </div>
      {gs.map((g, gi) => {
        const z = zonaDe(g.length, D.z);
        return (
          <section className="dv-g" key={gi} aria-label={nombres[sel] + ' División' + (gs.length > 1 ? ', grupo ' + (gi + 1) : '')}>
            <h3 className="dv-gt">{nombres[sel]} División{gs.length > 1 ? ' · grupo ' + (gi + 1) : ''}<small>{g.length} jugando</small></h3>
            <ol className="dv-tabla">
              {g.map(([raw, pts, ev], i) => {
                const f = liga.fila(raw);
                const sube = sel > 0 && i < z;
                const baja = sel < ultima && i >= g.length - z;
                const cls = (sube ? 'sube' : baja ? 'baja' : '') + (esYo(raw) ? ' yo' : '');
                return (
                  <li key={raw} className={cls}>
                    <span className="dv-i">{i + 1}</span>
                    {f ? <Cara liga={liga} k={f.k} nombre={f.n} cls="cara dv-cara" /> : <span className="cara dv-cara ini">{limpio(raw).slice(0, 1).toUpperCase()}</span>}
                    {f ? <a className="dv-n" href={'#/r/' + encodeURIComponent(f.k)}>{limpio(raw)}</a> : <span className="dv-n">{limpio(raw)}</span>}
                    {/* ⚠️ sin etiqueta va un hueco y no `null`: cada fila es su propia grilla de seis columnas, y sin él
                        los puntos y los eventos de esa fila quedaban corridos (revisión del 05/10/2026) */}
                    {sube ? <i className="dv-z">SUBE</i> : baja ? <i className="dv-z">BAJA</i> : <span />}
                    <span className="dv-ev">{ev} {ev === 1 ? 'evento' : 'eventos'}</span>
                    <b className="dv-p">{num(pts)}</b>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
