// Las encuestas del Inicio: el ×2 de la semana que viene y El Elegido, juntas arriba de Misiones. Dlx, 30/09/2026:
// «¿qué tal si arriba de misiones ponemos encuestas?». Antes vivían en la Tira de «Esta semana» y abajo de Se busca,
// donde ocupaban lugar y se veían raras. Los votos los guarda y los cuenta app.js (`votar`, `ENC_*`): acá se muestran.
import { useState } from 'react';
import { limpio, norm } from './liga.js';
import { Cara, Sec, accion } from './piezas.jsx';

const suma = (cu) => Object.values(cu).reduce((s, v) => s + (Number(v) || 0), 0);
const votos = (n) => n + (n === 1 ? ' voto' : ' votos');
const pct = (n, tot) => (tot ? Math.round(100 * n / tot) : 0) + '%';

function X2({ liga, enc, E }) {
  const cu = enc.cuenta(E.id);
  const tot = suma(cu);
  const mio = enc.mio[E.id];
  const est = enc.est[E.id] || {};
  const x = String(E.x || 2).replace('.', ',');
  const min = E.min || 3;
  return (
    <article className="en">
      <div className="en-cab"><span>EL ×{x} DE LA SEMANA QUE VIENE</span><em>CIERRA {liga.dia(E.hasta).toUpperCase()}</em></div>
      <h3 className="en-p">¿Qué servidor se lleva el ×{x}?</h3>
      <p className="en-b">El más votado sale del sorteo del lunes con ×{x} como mínimo. {tot ? votos(tot) : 'Todavía sin votos'}{tot < min ? ' · hacen falta ' + min : ''}.</p>
      <div className="en-ops">
        {E.op.map((sv) => {
          const n = Number(cu[sv] || 0);
          return (
            <button type="button" key={sv} className={'en-op' + (mio === sv ? ' mia' : '') + (est.va === sv ? ' va' : '')} onClick={() => accion.votar(E.id, sv)}>
              <i className="en-bar" style={{ width: pct(n, tot) }} />
              <img alt="" src={liga.logo(sv)} /><b>{sv}</b><span className="en-n">{mio === sv ? '✓ ' : ''}{n}</span>
            </button>
          );
        })}
      </div>
      <p className="en-e" aria-live="polite">{enc.pie(E, (v) => v)}</p>
    </article>
  );
}

function Elegido({ liga, enc, E }) {
  const [q, setQ] = useState('');
  const cu = enc.cuenta(E.id);
  const tot = suma(cu);
  const mio = enc.mio[E.id];
  const est = enc.est[E.id] || {};
  const min = E.min || 3;
  const nombre = (op) => { const f = liga.fila(op); return f ? limpio(f.n) : limpio(op); };
  const idx = {};
  E.op.forEach((o, i) => { idx[o] = i; });
  const ops = E.op.slice().sort((a, b) => (cu[b] || 0) - (cu[a] || 0) || idx[a] - idx[b]);
  const t = norm(q).trim();
  const ver = t ? ops.filter((o) => norm(nombre(o)).includes(t)).slice(0, 6) : ops.slice(0, 4);
  const yoK = enc.yoDiscord;
  return (
    <article className="en">
      <div className="en-cab"><span>EL ELEGIDO · MOST WANTED</span><em>CIERRA {liga.dia(E.hasta).toUpperCase()}</em></div>
      <h3 className="en-p">¿A quién salimos a buscar?</h3>
      <p className="en-b">El más votado entra al Most Wanted como <b>El Elegido</b>. {tot ? votos(tot) : 'Todavía sin votos'}{tot < min ? ' · hacen falta ' + min : ''}.</p>
      <div className="en-ops">
        {ver.length ? ver.map((op) => {
          const f = liga.fila(op);
          const n = Number(cu[op] || 0);
          const esYo = !!(yoK && f && f.k === yoK);
          return (
            <button type="button" key={op} className={'en-op' + (mio === op ? ' mia' : '') + (est.va === op ? ' va' : '')} disabled={esYo}
              title={esYo ? 'Sos vos' : undefined} onClick={() => accion.votar(E.id, op)}>
              <i className="en-bar" style={{ width: pct(n, tot) }} />
              <Cara liga={liga} k={f ? f.k : ''} nombre={op} cls="en-cara" /><b>{nombre(op)}</b>
              <span className="en-n">{esYo ? 'sos vos' : (mio === op ? '✓ ' : '') + n}</span>
            </button>
          );
        }) : <p className="en-b">Nadie con ese nombre puede ser El Elegido.</p>}
      </div>
      <input type="search" className="en-busca" placeholder={'Buscá entre los ' + E.op.length} aria-label="Buscar a quién votar"
        value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="en-e" aria-live="polite">{enc.pie(E, nombre)}</p>
    </article>
  );
}

export function Encuestas({ liga, enc }) {
  const x2 = liga.encuesta('x2');
  const el = liga.encuesta('elegido');
  if (!x2 && !el) return null;
  return (
    <Sec id="encuestas" titulo="Encuestas">
      <div className={'en-g' + (x2 && el ? ' dos' : '')}>
        {x2 ? <X2 liga={liga} enc={enc} E={x2} /> : null}
        {el ? <Elegido liga={liga} enc={enc} E={el} /> : null}
      </div>
    </Sec>
  );
}
