// 🗳️ «¿QUIÉN GANA LA FINAL?» EN PUBLICACIONES (Dlx, 12/11/2026: «sí a las dos, hazlas»)
//
// Cuando una llave en vivo tiene su final armada, el objeto abre un voto (`qgFinales()` de bot/avisos.js): el mismo que el
// botón del chat cuando el bot está en el chat de ese servidor, así que los votos de los dos lados son los mismos. Se
// cierra cuando la llave dice quién ganó (o a la media hora sin resultado), y entonces dice si el público acertó. Un voto
// por persona, que se puede cambiar mientras esté abierto. Lo que votaste queda en este navegador (`lg:qg`): el objeto
// nunca dice quién votó qué
import { useEffect, useState } from 'react';
import { limpio, num, siglaDe } from './liga.js';
import { Cara } from './piezas.jsx';

const W = typeof window !== 'undefined' ? window : {};
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
//: lo cerrado se sigue viendo un rato, con el resultado
const CERRADA_VE = 6 * 3600000;

function Lado({ liga, n, p, on, gano, abierta, onVotar }) {
  const f = liga.fila(n);
  const nombre = limpio((f && f.n) || n);
  return (
    <button type="button" className={'qg-lado' + (on ? ' qg-si' : '') + (gano ? ' qg-gano' : '')} disabled={!abierta} onClick={onVotar}
      aria-pressed={abierta ? on : undefined} aria-label={abierta ? 'Votar por ' + nombre : nombre}>
      <Cara liga={liga} k={f ? f.k : ''} nombre={nombre} cls="cara qg-c" />
      <b>{nombre}</b>
      <small>{f && f.pos ? '#' + f.pos + ' · ' : ''}{p} %</small>
      {gano ? <em>Ganó</em> : on ? <em>Tu voto</em> : null}
    </button>
  );
}

export function QuienGana({ liga }) {
  const [D, setD] = useState(null);
  const [mios, setMios] = useState(() => leer('lg:qg') || {});
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let vivo = true;
    const traer = () => fetch('/api/avisos/qg-finales').then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo && j && Array.isArray(j.f)) setD(j); }).catch(() => {});
    traer();
    const id = setInterval(traer, 60000);
    return () => { vivo = false; clearInterval(id); };
  }, []);
  const ahora = Date.now();
  const fs = ((D && D.f) || []).filter((q) => q.abierta || ahora - q.abre < CERRADA_VE).slice(0, 3);
  if (!fs.length) return null;
  const votar = async (q, lado) => {
    if (!q.abierta || !W.conCuenta || mios[q.id] === lado) return;
    setMsg('');
    const j = await W.conCuenta('/api/avisos/qg-votar-web', { id: q.id, lado }, 'p');
    if (!j) return;
    if (j.ok) {
      const m = Object.assign({}, mios, { [q.id]: lado });
      setMios(m); guardar('lg:qg', m);
      setD((d) => d && Object.assign({}, d, { f: d.f.map((x) => (x.id === q.id ? Object.assign({}, x, { na: j.na, nb: j.nb }) : x)) }));
    } else setMsg(j.error === 'cerrada' ? 'Ya se definió: el voto cerró.' : 'No se pudo votar. Prueba de nuevo.');
  };
  return (
    <section className="qg" aria-label="¿Quién gana la final?">
      {fs.map((q) => {
        const n = (q.na || 0) + (q.nb || 0);
        const pa = n ? Math.round((100 * q.na) / n) : 50;
        const mio = mios[q.id] || '';
        const fav = q.na === q.nb ? '' : q.na > q.nb ? 'A' : 'B';
        const nom = (x) => limpio(((liga.fila(x) || {}).n) || x);
        const res = q.abierta ? (n ? num(n) + (n === 1 ? ' voto' : ' votos') + ' · cierra cuando se define' : 'Sé el primero en votar · cierra cuando se define')
          : q.g === 'A' || q.g === 'B'
            ? (n ? (fav ? 'El público ' + (fav === q.g ? 'acertó' : 'se equivocó') : 'El público estaba dividido') + ' · ' + num(n) + (n === 1 ? ' voto' : ' votos') : 'Nadie votó')
            : 'Cerrado sin resultado';
        return (
          <article key={q.id} className={'qg-i' + (q.abierta ? ' abierta' : '')}>
            <header><em>{q.abierta ? '¿Quién gana la final?' : '¿Quién ganaba la final?'}</em>
              <small>{q.ev ? limpio(q.ev) + ' · ' : ''}{siglaDe(q.sv)}{q.abierta ? <span className="qg-vivo"> · en vivo</span> : ''}</small></header>
            <div className="qg-vs">
              <Lado liga={liga} n={q.a} p={pa} on={mio === 'A'} gano={q.g === 'A'} abierta={q.abierta} onVotar={() => votar(q, 'A')} />
              <span className="qg-x" aria-hidden="true">VS</span>
              <Lado liga={liga} n={q.b} p={100 - pa} on={mio === 'B'} gano={q.g === 'B'} abierta={q.abierta} onVotar={() => votar(q, 'B')} />
            </div>
            <span className="qg-barra" aria-hidden="true"><i style={{ width: pa + '%' }} /></span>
            <small className="qg-pie">{res}{mio && !q.abierta && (q.g === 'A' || q.g === 'B') ? ' · tú votaste por ' + nom(mio === 'A' ? q.a : q.b) : ''}</small>
          </article>
        );
      })}
      {msg ? <small className="qg-msg" role="status">{msg}</small> : null}
    </section>
  );
}
