// 🏆 LOS MES AWARDS, LO QUE COMPARTEN LAS PÁGINAS (02/11/2026): el pedido de `/api/salon`, cada nominado, la categoría
// que se vota y el reparto del cierre. Vivían en salon.jsx y los importaban la página de cada servidor, la Tienda y el
// Salón nuevo; borrar salon.jsx al publicar el remake los habría dejado sin de dónde salir (la crítica de la tanda 2).
// Acá no cambia nada de cómo se ven ni de cómo se vota: es el mismo código, mudado.
//
// Lo arma el ciclo (`bot/mes_awards.py`) y se pide al abrir el Salón (`/api/salon`): no viaja en el lobby. Se vota con
// las mismas reglas que El Elegido y el ×2 (`accion.votar`, `enc` de App.jsx): un voto por cuenta y por categoría, se
// cambia hasta que cierra, y afuera se ve cuántos, nunca quién
import { useEffect, useState } from 'react';
import { limpio, num, siglaDe } from './liga.js';
import { Cara, accion } from './piezas.jsx';

const SAL = { d: null, pedido: 0, oyentes: new Set() };
function pedirSalon() {
  if (Date.now() - SAL.pedido < 120000) return;
  SAL.pedido = Date.now();
  fetch('/api/salon', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && d.cats) { SAL.d = d; SAL.oyentes.forEach((f) => f()); } })
    .catch(() => { /* sin esto, el Salón sigue sin los MES AWARDS */ });
}
export function useSalon() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    SAL.oyentes.add(f);
    pedirSalon();
    return () => { SAL.oyentes.delete(f); };
  }, []);
  return SAL.d;
}

// cada nominado: su cara (o la miniatura de la batalla, o el escudo del servidor), su nombre y su número del mes
export function Nominado({ liga, cat, x }) {
  // 🏆 las de «Ver las demás nominaciones» (bot/mes_otros.py) traen su línea hecha (`d`) y qué se ve: un video, una
  // imagen, el escudo del servidor, la bandera o la cara de `q`
  if (x.d !== undefined) {
    const fq = x.q ? liga.fila(x.q) : null;
    const vis = x.vid ? <img className="ma-vid" alt="" src={'https://i.ytimg.com/vi/' + x.vid + '/mqdefault.jpg'} loading="lazy" />
      : x.img ? <img className="ma-vid" alt="" src={x.img} loading="lazy" />
        : x.cc ? <img className="ma-cara ma-flag" alt="" src={'/banderas/g/' + x.cc + '.webp'} />
          : x.sv && !x.q ? <img className="ma-cara" alt="" src={liga.logo(x.sv)} />
            : <Cara liga={liga} k={fq ? fq.k : ''} nombre={x.q || x.n} cls="ma-cara" />;
    return <>{vis}<span className="ma-t"><b>{limpio(x.n)}</b><small>{x.d}</small></span></>;
  }
  const f = (cat === 'rapero' || cat === 'revelacion') ? liga.fila(x.op) : null;
  const vis = cat === 'batalla' ? <img className="ma-vid" alt="" src={'https://i.ytimg.com/vi/' + x.op + '/mqdefault.jpg'} loading="lazy" />
    : cat === 'servidor' ? <img className="ma-cara" alt="" src={liga.logo(x.op)} />
      : <Cara liga={liga} k={f ? f.k : ''} nombre={x.n} cls="ma-cara" />;
  const dato = cat === 'batalla' ? siglaDe(x.sv) + ' · ' + num(x.vistas) + ' vistas'
    : cat === 'servidor' ? num(x.gente) + ' raperos · ' + num(x.ev) + ' eventos'
      : num(x.pts) + ' pts' + (x.oro ? ' · ' + x.oro + (x.oro === 1 ? ' título' : ' títulos') : '') + ' · ' + x.ev + (x.ev === 1 ? ' evento' : ' eventos');
  return <>{vis}<span className="ma-t"><b>{cat === 'batalla' ? limpio(x.n) : f ? limpio(f.n) : limpio(x.n)}</b><small>{dato}</small></span></>;
}

export function Categoria({ liga, enc, cat, nombre, de, nom, encId, gana }) {
  const E = encId ? ((liga.d.enc || []).find((e) => e.id === encId) || null) : null;
  const cu = E && enc ? enc.cuenta(E.id) : {};
  const tot = Object.values(cu).reduce((s, n) => s + (Number(n) || 0), 0);
  const mio = E && enc ? enc.mio[E.id] : '';
  const est = (E && enc && enc.est[E.id]) || {};
  return (
    <article className="ma-cat">
      <header><b>{nombre}</b><small>Por {de}</small></header>
      <ol className="ma-noms">{nom.map((x, i) => {
        const n = Number(cu[x.op] || 0);
        const p = tot ? Math.round((100 * n) / tot) : 0;
        const cuerpo = <><span className="ma-i">{gana ? (x.op === gana ? '🏆' : '') : i + 1}</span><Nominado liga={liga} cat={cat} x={x} /></>;
        return (
          <li key={x.op} className={(gana && x.op === gana ? 'gana ' : '') + (mio === x.op ? 'mio' : '')}>
            {E ? (
              <button type="button" className={'ma-op' + (est.va === x.op ? ' va' : '')} onClick={() => accion.votar(E.id, x.op)}
                aria-pressed={mio === x.op} aria-label={'Votar a ' + limpio(x.n) + ' · ' + p + '% de los votos'}>
                <i className="ma-bar" style={{ width: p + '%' }} />{cuerpo}<em>{mio === x.op ? '✓ ' : ''}{p}%</em>
              </button>
            ) : <div className="ma-op">{cuerpo}</div>}
          </li>
        );
      })}</ol>
      {E && enc ? <p className="ma-pie" aria-live="polite">{enc.pie(E, (op) => limpio((nom.find((x) => x.op === op) || {}).n || op))}</p> : null}
    </article>
  );
}

// 📊 los porcentajes del cierre (Dlx, 18/10/2026: «me gusta lo de porcentajes»): el ganador y los que le siguen, como
// publican los FMS AWARDS. Sólo si se decidió por votos: si fue por los números, no hay reparto que mostrar
export function reparto(x) {
  const cu = x.cuenta || {};
  const tot = Object.values(cu).reduce((s, n) => s + (Number(n) || 0), 0);
  if (x.por !== 'votos' || !tot) return null;
  const nom = (op) => limpio(((x.nom || []).find((y) => y.op === op) || {}).n || op);
  const orden = Object.keys(cu).sort((a, b) => cu[b] - cu[a]).slice(0, 4);
  return (
    <small className="ma-pct">{orden.map((op, i) => (
      <span key={op}>{i ? ' · ' : ''}{op === x.gana ? <b>{nom(op)} {Math.round((100 * cu[op]) / tot)}%</b> : nom(op) + ' ' + Math.round((100 * cu[op]) / tot) + '%'}</span>
    ))}{' · ' + tot + (tot === 1 ? ' voto' : ' votos')}</small>
  );
}
