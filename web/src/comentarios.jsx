// 💬 LOS COMENTARIOS DE PUBLICACIONES (12/11/2026). Dlx, a la maqueta: «Sí, constrúyelo».
// Dos clases y se ven distinto a propósito:
// - los SIMULADOS vienen en el muro (`it.cm`, los arma `bot/comentarios_sim.py`): `[i, clave, nombre, texto, hora,
//   etiqueta]`. Etiqueta `''` = esa persona le dijo que sí a Dlx; `'s'` = sin preguntar, lleva «simulado» pegado al
//   nombre (así sale también en una captura); `'l'` = un personaje de la Liga. Los de hora futura se esconden hasta
//   que llega.
// - los DE VERDAD los escribe la gente verificada y los guarda el objeto (`/api/avisos/comentarios`).
// ⚠️ Nunca se le saca la etiqueta a un simulado acá: eso lo decide sólo el permiso, en el ciclo.
import { useEffect, useRef, useState } from 'react';
import { DUENO, limpio, quienMira, utc } from './liga.js';
import { Cara, accion } from './piezas.jsx';

const W = typeof window !== 'undefined' ? window : {};
const E = { por: null, pidiendo: false, t: 0, oyentes: new Set(), mios: {} };
const avisar = () => E.oyentes.forEach((f) => f());

function pedir(forzar = false) {
  if (E.pidiendo || (!forzar && E.por && Date.now() - E.t < 60000)) return;
  E.pidiendo = true;
  fetch('/api/avisos/comentarios', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { E.pidiendo = false; if (j && j.por) { E.por = j.por; E.t = Date.now(); avisar(); } })
    .catch(() => { E.pidiendo = false; });
}

/** Los comentarios de verdad de todas las publicaciones, y que la pantalla se entere cuando llegan. */
export function useComentarios() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    E.oyentes.add(f);
    pedir();
    return () => { E.oyentes.delete(f); };
  }, []);
  return E;
}

/** Los de una publicación, juntos y en orden: los simulados que ya llegaron a su hora y los de verdad. */
export function delHilo(it, ahora) {
  const sim = (it.cm || []).filter((c) => utc(c[4]) <= ahora).map((c) => ({ id: 's' + c[0], k: c[1], n: c[2], tx: c[3],
    t: utc(c[4]), et: c[5], resp: '' }));
  const borrados = E.mios.borrados || {};
  const ver = ((E.por && E.por[it.id]) || []).concat((E.mios[it.id] || []))
    .filter((c, i, a) => !borrados[c[0]] && a.findIndex((x) => x[0] === c[0]) === i)
    .map((c) => ({ id: 'c' + c[0], c: c[0], k: c[1], n: c[2], tx: c[3], resp: c[4] || '', t: c[5], et: 'v' }));
  return sim.concat(ver).sort((a, b) => a.t - b.t);
}

/** 💬 Comentar desde afuera del hilo (la barra de responder de las historias): `{ok}` o `{ok: false, msg}`. */
export async function comentar(it, tx) {
  if (!it || !it.id || !String(tx || '').trim() || !W.conCuenta) return { ok: false, msg: '' };
  const j = await W.conCuenta('/api/avisos/comentar', { id: it.id, tx, resp: '' }, 'p');
  if (!j) return { ok: false, msg: '' };
  if (j.ok) {
    E.mios[it.id] = (E.mios[it.id] || []).concat([[j.c, j.k, j.n, j.tx, j.resp, j.t]]);
    avisar();
    return { ok: true };
  }
  return { ok: false, msg: ERR[j.error] || (j.status === 401 ? 'Entra con Discord de nuevo.' : 'No se pudo: prueba de nuevo.') };
}

export const PJ = { eh: ['EH', '#E41373'], ul: ['UL', '#29B298'], ej: ['EJ', '#FFD24A'] };
const ERR = { vacio: 'Escribe algo.', largo: 'Es muy largo: hasta 200 letras.', link: 'Sin links en los comentarios.',
  mencion: 'Sin @everyone ni @here.', sin_verificar: 'Para comentar necesitas tu cuenta verificada.',
  nueva: 'Tu cuenta de Discord es muy nueva para comentar.', espera: 'Ya comentaste mucho hoy: sigue mañana.',
  no_existe: 'Esa publicación ya no está.' };

function hace(t, ahora) {
  const m = Math.max(1, Math.round((ahora - t) / 60000));
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.round(m / 60);
  if (h < 24) return 'hace ' + h + ' h';
  const d = Math.round(h / 24);
  return 'hace ' + d + (d === 1 ? ' día' : ' días');
}

function Comentario({ liga, c, ahora, yo, dueno, onResponder, onBorrar, onReportar, todos }) {
  const pj = c.et === 'l' ? PJ[c.k] || ['LG', '#E41373'] : null;
  const f = !pj ? liga.T[c.k] : null;
  const a = c.resp ? todos.find((x) => x.id === c.resp) : null;
  return (
    <li className="cmh-c">
      {pj ? <span className="cmh-pj" style={{ background: pj[1] }}>{pj[0]}</span>
        : <Cara liga={liga} k={c.k} nombre={c.n} cls="cara cmh-cara" lazy />}
      <div className="cmh-cu">
        <div className="cmh-q">
          {f ? <a href={'#/r/' + encodeURIComponent(c.k)}>{limpio(c.n)}</a> : <b>{limpio(c.n)}</b>}
          {f && f.rg ? <i className="cmh-rg" style={{ background: f.rgc || liga.colorRg(f.rg) }}>{f.rg}</i> : null}
          {c.et === 's' ? <i className="cmh-et sim">simulado</i> : c.et === 'l' ? <i className="cmh-et liga">Liga</i> : null}
          <time>{hace(c.t, ahora)}</time>
        </div>
        {a ? <small className="cmh-a">↪ a {limpio(a.n)}</small> : null}
        <p>{c.tx}</p>
        <div className="cmh-acc">
          <button type="button" onClick={() => onResponder(c)}>Responder</button>
          {c.c && (c.k === yo || dueno) ? <button type="button" onClick={() => onBorrar(c)}>Borrar</button> : null}
          {c.c && yo && c.k !== yo && !dueno ? <button type="button" onClick={() => onReportar(c)}>Reportar</button> : null}
        </div>
      </div>
    </li>
  );
}

/**
 * El hilo de una publicación. Cerrado muestra el último comentario y «Ver los N»; abierto, todos y la caja para
 * escribir. `chico`: dentro de una fila de un grupo (los rangos, los anuncios), sólo el botón hasta que se abre.
 */
export function Hilo({ liga, it, chico }) {
  useComentarios();
  const [abierto, setAbierto] = useState(() => !!it.id && W.__pubFoco === it.id);
  // 🎯 y si el foco cambia estando ya en Publicaciones (otro aviso de la campana), también se abre
  const foco = W.__pubFoco;
  useEffect(() => { if (it.id && foco === it.id) setAbierto(true); }, [foco, it.id]);
  const [tx, setTx] = useState('');
  const [resp, setResp] = useState(null);
  const [msg, setMsg] = useState('');
  const [va, setVa] = useState(false);
  const caja = useRef(null);
  const ahora = Date.now();
  const todos = delHilo(it, ahora);
  const { dc } = quienMira();
  const yo = (dc && dc.clave) || '';
  const dueno = !!dc && String(dc.id) === DUENO;
  if (!it.id) return null;
  const n = todos.length;
  const responder = (c) => {
    setAbierto(true);
    setResp(c);
    setTx((t) => (t.startsWith('@') ? t : '@' + limpio(c.n) + ' ' + t));
    setTimeout(() => { if (caja.current) caja.current.focus(); }, 0);
  };
  const borrar = async (c) => {
    if (!W.conCuenta) return;
    const j = await W.conCuenta('/api/avisos/comentario-borrar', { c: c.c }, 'p');
    if (j && j.ok) { E.mios.borrados = Object.assign({}, E.mios.borrados, { [c.c]: 1 }); avisar(); }
  };
  // 🚩 reportar: con tres personas distintas se esconde solo (`comentarioReportar()`); para quien reporta, se va ya
  const reportar = async (c) => {
    if (!W.conCuenta) return;
    const j = await W.conCuenta('/api/avisos/comentario-reportar', { c: c.c }, 'p');
    if (j && j.ok) { E.mios.borrados = Object.assign({}, E.mios.borrados, { [c.c]: 1 }); setMsg('Gracias: lo vamos a revisar.'); avisar(); }
    else if (j) setMsg(j.error === 'espera' ? 'Ya reportaste mucho hoy.' : 'No se pudo reportar.');
  };
  const enviar = async (e) => {
    e.preventDefault();
    if (!tx.trim() || va || !W.conCuenta) return;
    setVa(true);
    setMsg('');
    try {
      const j = await W.conCuenta('/api/avisos/comentar', { id: it.id, tx, resp: resp ? resp.id : '' }, 'p');
      if (!j) return;
      if (j.ok) {
        // lo propio se ve enseguida: la lista de todos llega con hasta 30 s de atraso del borde
        E.mios[it.id] = (E.mios[it.id] || []).concat([[j.c, j.k, j.n, j.tx, j.resp, j.t]]);
        setTx('');
        setResp(null);
        avisar();
      } else setMsg(ERR[j.error] || (j.status === 401 ? 'Entra con Discord de nuevo.' : 'No se pudo: prueba de nuevo.'));
    } finally { setVa(false); }
  };
  if (chico && !abierto) {
    return <button type="button" className="cmh-chico" onClick={() => setAbierto(true)} aria-label={'Comentarios: ' + n}>💬 {n || ''}</button>;
  }
  const ver = abierto ? todos : todos.slice(-1);
  return (
    <div className={'cmh' + (chico ? ' en-fila' : '')}>
      {n ? (
        <>
          {!abierto && n > 1 ? <button type="button" className="cmh-mas" onClick={() => setAbierto(true)}>Ver los {n} comentarios</button> : null}
          <ul className="cmh-l">
            {ver.map((c) => <Comentario key={c.id} liga={liga} c={c} ahora={ahora} yo={yo} dueno={dueno} todos={todos}
              onResponder={responder} onBorrar={borrar} onReportar={reportar} />)}
          </ul>
        </>
      ) : null}
      {!abierto ? (
        <button type="button" className="cmh-abrir" onClick={() => { setAbierto(true); setTimeout(() => { if (caja.current) caja.current.focus(); }, 0); }}>
          💬 {n ? 'Comentar' : 'Sé el primero en comentar'}</button>
      ) : !dc ? (
        <p className="cmh-nota"><button type="button" className="cmh-entrar" onClick={accion.entrar}>Entra con Discord</button> para comentar.</p>
      ) : !yo ? (
        <p className="cmh-nota">Para comentar necesitas tu cuenta verificada: <a href="#/cuenta">verifícate</a>.</p>
      ) : (
        <form className="cmh-f" onSubmit={enviar}>
          {resp ? <small className="cmh-r">Respondiendo a {limpio(resp.n)} <button type="button" onClick={() => { setResp(null); setTx(''); }} aria-label="No responder">×</button></small> : null}
          <div className="cmh-fila">
            <Cara liga={liga} k={yo} nombre={(liga.T[yo] || {}).n || dc.nombre || ''} cls="cara cmh-cara" />
            <input ref={caja} id={'cm-' + it.id} type="text" maxLength={200} value={tx} onChange={(e) => setTx(e.target.value)}
              placeholder="Escribe un comentario" aria-label="Escribe un comentario" />
            <button type="submit" className="cmh-env" disabled={va || !tx.trim()}>Enviar</button>
          </div>
          {msg ? <small className="cmh-msg" role="alert">{msg}</small> : null}
        </form>
      )}
    </div>
  );
}

// para el Dashboard y Mi cuenta
export const CM_ESTADOS = [['si', 'Sí'], ['pre', 'Sin preguntar'], ['no', 'No']];
