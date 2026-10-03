// Las encuestas del Inicio: el ×2 de la semana que viene y El Elegido, juntas arriba de Misiones. Dlx, 30/09/2026:
// «¿qué tal si arriba de misiones ponemos encuestas?». Antes vivían en la Tira de «Esta semana» y abajo de Se busca,
// donde ocupaban lugar y se veían raras. Los votos los guarda y los cuenta app.js (`votar`, `ENC_*`): acá se muestran.
import { useState } from 'react';
import { limpio, norm, siglaDe } from './liga.js';
import { Cara, Pest, Sec, accion } from './piezas.jsx';
import { TuTemporada, TusEventos } from './medio.jsx';

const suma = (cu) => Object.values(cu).reduce((s, v) => s + (Number(v) || 0), 0);
const votos = (n) => n + (n === 1 ? ' voto' : ' votos');
const pct = (n, tot) => (tot ? Math.round(100 * n / tot) : 0) + '%';

// las dos, también en Publicaciones (votar ahí mismo: Dlx, 02/10/2026)
export function X2({ liga, enc, E }) {
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
              <img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b><span className="en-n">{mio === sv ? '✓ ' : ''}{n}</span>
            </button>
          );
        })}
      </div>
      <p className="en-e" aria-live="polite">{enc.pie(E, (v) => v)}</p>
    </article>
  );
}

export function Elegido({ liga, enc, E }) {
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
  let ver = t ? ops.filter((o) => norm(nombre(o)).includes(t)).slice(0, 6) : ops.slice(0, 4);
  // tu voto queda a la vista aunque no esté entre los cuatro más votados: si no, no sabías a quién habías votado
  if (!t && mio && E.op.includes(mio) && !ver.includes(mio)) ver = ver.concat([mio]);
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

// El lugar de las encuestas lleva también Tus eventos. Dlx, 30/09/2026: «creo que ahí debería ir tus eventos si
// es que las encuestas ya no están». Con encuestas abiertas, las dos cosas con flechas (primero las encuestas); sin
// ninguna, Tus eventos solo.
// Y si ya votaste en todas las abiertas, Tus eventos va primero y las encuestas quedan de segunda página (Dlx,
// 30/09: «que encuesta sea la segunda página de ese panel si ya votaste»). El orden se decide al abrir la página: si
// cambiara en el momento de votar, lo que la persona está mirando se le iría de abajo del dedo.
export function Encuestas({ liga, enc, dc }) {
  const x2 = liga.encuesta('x2');
  const el = liga.encuesta('elegido');
  const abiertas = [x2, el].filter(Boolean);
  const [votaste] = useState(() => abiertas.length > 0 && abiertas.every((E) => enc.mio[E.id]));
  const yo = liga.yo;
  const tuyos = <div className="pz-2"><TusEventos liga={liga} dc={dc} /><TuTemporada liga={liga} dc={dc} /></div>;
  const enlace = yo ? 'Tu perfil' : (dc ? 'Mi cuenta' : 'Entrar');
  const href = yo ? '#/r/' + encodeURIComponent(yo.k) : undefined;
  // «Entrar» entra con Discord; «Mi cuenta», a la cuenta (revisión del 03/10/2026)
  const onEnlace = yo ? undefined : (dc ? accion.cuenta : accion.entrar);
  if (!x2 && !el) return <Sec id="encuestas" titulo="Tus eventos" enlace={enlace} href={href} onEnlace={onEnlace}>{tuyos}</Sec>;
  const items = [
    { c: 'encuestas', et: 'Encuestas', t: 'Encuestas', cuerpo: (
      <div className={'en-g' + (x2 && el ? ' dos' : '')}>
        {x2 ? <X2 liga={liga} enc={enc} E={x2} /> : null}
        {el ? <Elegido liga={liga} enc={enc} E={el} /> : null}
      </div>
    ) },
    { c: 'tuseventos', et: 'Tus eventos', t: 'Tus eventos', cuerpo: tuyos },
  ];
  if (votaste) items.reverse();
  return <Pest id="encuestas" titulo={items[0].t} enlace={enlace} href={href} onEnlace={onEnlace} items={items} extra="panel" titulos />;
}
