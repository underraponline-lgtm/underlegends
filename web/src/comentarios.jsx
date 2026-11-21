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
import { usePases } from './pase.js';
import { SelloPremium, esPremium } from './sello.jsx';

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
  // 💬 el séptimo valor, si está, es a cuál de antes le contesta (la versión 2 de bot/comentarios_sim.py, 15/11/2026)
  const sim = (it.cm || []).filter((c) => utc(c[4]) <= ahora).map((c) => ({ id: 's' + c[0], k: c[1], n: c[2], tx: c[3],
    t: utc(c[4]), et: c[5], resp: c.length > 6 && c[6] !== null && c[6] !== '' ? 's' + c[6] : '' }));
  const borrados = E.mios.borrados || {};
  const ver = ((E.por && E.por[it.id]) || []).concat((E.mios[it.id] || []))
    .filter((c, i, a) => !borrados[c[0]] && a.findIndex((x) => x[0] === c[0]) === i)
    .map((c) => ({ id: 'c' + c[0], c: c[0], k: c[1], n: c[2], tx: c[3], resp: c[4] || '', t: c[5], et: 'v' }));
  return sim.concat(ver).sort((a, b) => a.t - b.t);
}

// 🔁 UN COMENTARIO REPETIDO (18/11/2026): el objeto contesta `{ok, ya, c}` sin la fila (ni k, ni n, ni tx, ni t), y
// empujarlo a `E.mios` dejaba una fila rota —sin nombre ni texto, «hace NaN días» y «Reportar» sobre el propio— cuando
// la lista todavía no lo traía (recargaste antes de que el borde lo sirviera, o lo mandaste desde otro dispositivo).
// No se empuja: se vuelve a pedir la lista, ahora y pasados los 30 s del borde. Dice si ya se ve
function yaEstaba(it, c) {
  if (((E.por && E.por[it.id]) || []).concat(E.mios[it.id] || []).some((x) => x[0] === c)) return true;
  pedir(true);
  setTimeout(() => pedir(true), 31000);
  return false;
}

/** 💬 Comentar desde afuera del hilo (la barra de responder de las historias): `{ok}` o `{ok: false, msg}`. */
export async function comentar(it, tx) {
  if (!it || !it.id || !String(tx || '').trim() || !W.conCuenta) return { ok: false, msg: '' };
  const j = await W.conCuenta('/api/avisos/comentar', { id: it.id, tx, resp: '' }, 'p');
  if (!j) return { ok: false, msg: '' };
  // con la fila entera (si algún día el objeto la manda también con `ya`), sigue por el camino de siempre
  if (j.ok && j.ya && !j.t) { yaEstaba(it, j.c); return { ok: true }; }
  if (j.ok) {
    E.mios[it.id] = (E.mios[it.id] || []).concat([[j.c, j.k, j.n, j.tx, j.resp, j.t]]);
    avisar();
    return { ok: true };
  }
  return { ok: false, msg: ERR[j.error] || (j.status === 401 ? 'Entra con Discord de nuevo.' : 'No se pudo: prueba de nuevo.') };
}

export const PJ = { eh: ['EH', '#E41373'], ul: ['UL', '#29B298'], ej: ['EJ', '#FFD24A'] };
// 📣 LAS BARRAS DE CADA SERVIDOR (21/11/2026, Dlx: «sí» a los fans de la Liga, bots a la vista): «La barra de FFA» es un
// personaje más de la Liga (`b:<servidor>`), con la sigla de su servidor sobre su color y la pastilla «Liga». Devuelve
// [texto, fondo, color del texto]: el texto en blanco sobre un color oscuro (el de FFA es casi negro)
export function pjDe(k, liga) {
  if (PJ[k]) return [PJ[k][0], PJ[k][1], '#030304'];
  if (String(k || '').startsWith('b:')) {
    const sv = String(k).slice(2), s = liga && liga.svs && liga.svs[sv];
    const c = (s && s.color) || '#E41373';
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    const lum = m ? ((parseInt(m[1].slice(0, 2), 16) * 299 + parseInt(m[1].slice(2, 4), 16) * 587 + parseInt(m[1].slice(4, 6), 16) * 114) / 1000) : 0;
    return [String((s && s.sigla) || sv).slice(0, 4), c, lum > 150 ? '#030304' : '#F6F6F6'];
  }
  return ['LG', '#E41373', '#F6F6F6'];
}
// 🪪 QUIÉN ESCRIBIÓ, CON EL NOMBRE DE HOY (17/11/2026): el comentario guarda el nombre que tenía al escribir (`c.n`), y si
// después se lo cambió quedaba el viejo. Con su clave en la tabla, el de su perfil; los de la Liga (`et: 'l'`) son un
// personaje y no tienen perfil
export const autorDe = (liga, c) => (c && c.et !== 'l' && c.k && liga && liga.T[c.k] ? limpio(liga.T[c.k].n) : limpio(c && c.n));
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

function Comentario({ liga, c, ahora, yo, dueno, onResponder, onBorrar, onReportar, todos, pub }) {
  const pj = c.et === 'l' ? pjDe(c.k, liga) : null;
  const f = !pj ? liga.T[c.k] : null;
  // 💎 el sello Premium: sólo de una persona (los de la Liga son un personaje, no un perfil)
  const prem = !pj && esPremium(pub, c.k);
  const a = c.resp ? todos.find((x) => x.id === c.resp) : null;
  return (
    <li className="cmh-c">
      {pj ? <span className="cmh-pj" style={{ background: pj[1], color: pj[2] }}>{pj[0]}</span>
        : <Cara liga={liga} k={c.k} nombre={c.n} cls={'cara cmh-cara' + (prem ? ' sp-prem-aro' : '')} lazy />}
      <div className="cmh-cu">
        <div className="cmh-q">
          {f ? <a href={'#/r/' + encodeURIComponent(c.k)}>{autorDe(liga, c)}</a> : <b>{autorDe(liga, c)}</b>}
          {prem ? <SelloPremium t={13} /> : null}
          {f && f.rg ? <i className="cmh-rg" style={{ background: f.rgc || liga.colorRg(f.rg) }}>{f.rg}</i> : null}
          {c.et === 's' ? <i className="cmh-et sim">simulado</i> : c.et === 'l' ? <i className="cmh-et liga">Liga</i> : null}
          <time>{hace(c.t, ahora)}</time>
        </div>
        {a ? <small className="cmh-a">↪ a {autorDe(liga, a)}</small> : null}
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
 * 📰 `ver`: cuántos se ven cerrado (la edición del día, 20/11/2026: dos en cada nota y cuatro en el titular; Dlx: «más
 * comentarios y respuestas»). `rapidas`: las respuestas de un toque, que se mandan como un comentario más.
 */
const RAPIDAS = ['👑 Merecido', '🔥 Qué nivel', '😮 No lo vi venir', '🎤 Quiero revancha'];
export function Hilo({ liga, it, chico, ver: verN = 1, rapidas = false }) {
  useComentarios();
  const pub = usePases();
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
    setTx((t) => (t.startsWith('@') ? t : '@' + autorDe(liga, c) + ' ' + t));
    setTimeout(() => { if (caja.current) caja.current.focus(); }, 0);
  };
  // 📵 SIN RED, CON AVISO (21/11/2026, revisión de robustez): `conCuenta()` revienta si el pedido no sale, y borrar y
  // reportar no lo atajaban: el toque no hacía nada y quedaba un error suelto en la consola. Abre el hilo para que se lea:
  // el aviso vive en la caja de escribir, que cerrado no está
  const SIN_RED = 'Sin conexión: prueba de nuevo.';
  const borrar = async (c) => {
    if (!W.conCuenta) return;
    let j = null;
    try { j = await W.conCuenta('/api/avisos/comentario-borrar', { c: c.c }, 'p'); } catch (e) { setAbierto(true); setMsg(SIN_RED); return; }
    if (j && j.ok) { E.mios.borrados = Object.assign({}, E.mios.borrados, { [c.c]: 1 }); avisar(); }
  };
  // 🚩 reportar: con tres personas distintas se esconde solo (`comentarioReportar()`); para quien reporta, se va ya
  const reportar = async (c) => {
    if (!W.conCuenta) return;
    let j = null;
    try { j = await W.conCuenta('/api/avisos/comentario-reportar', { c: c.c }, 'p'); } catch (e) { setAbierto(true); setMsg(SIN_RED); return; }
    if (j && j.ok) { E.mios.borrados = Object.assign({}, E.mios.borrados, { [c.c]: 1 }); setMsg('Gracias: lo vamos a revisar.'); avisar(); }
    else if (j) setMsg(j.error === 'espera' ? 'Ya reportaste mucho hoy.' : 'No se pudo reportar.');
  };
  // 💬 una respuesta rápida: sin cuenta, a entrar; sin verificar, el aviso; si no, se manda como un comentario más
  const rapida = (texto) => {
    setAbierto(true);
    if (!dc) { accion.entrar(); return; }
    if (!yo) { setMsg('Para comentar necesitas tu cuenta verificada.'); return; }
    mandar(texto);
  };
  const enviar = (e) => { e.preventDefault(); mandar(tx); };
  const mandar = async (texto) => {
    if (!String(texto || '').trim() || va || !W.conCuenta) return;
    setVa(true);
    setMsg('');
    try {
      const j = await W.conCuenta('/api/avisos/comentar', { id: it.id, tx: texto, resp: resp ? resp.id : '' }, 'p');
      if (!j) return;
      // 🔁 repetido y sin la fila (ver `yaEstaba()`): no se empuja una fila rota
      if (j.ok && j.ya && !j.t) {
        setTx('');
        setResp(null);
        if (!yaEstaba(it, j.c)) setMsg('Ya lo habías enviado: aparece en unos segundos.');
        return;
      }
      if (j.ok) {
        // lo propio se ve enseguida: la lista de todos llega con hasta 30 s de atraso del borde
        E.mios[it.id] = (E.mios[it.id] || []).concat([[j.c, j.k, j.n, j.tx, j.resp, j.t]]);
        setTx('');
        setResp(null);
        avisar();
      } else setMsg(ERR[j.error] || (j.status === 401 ? 'Entra con Discord de nuevo.' : 'No se pudo: prueba de nuevo.'));
    } catch (e) {
      // 📵 el mismo agujero que borrar y reportar (arriba), en comentar: el botón volvía y no decía nada
      setMsg(SIN_RED);
    } finally { setVa(false); }
  };
  if (chico && !abierto) {
    return <button type="button" className="cmh-chico" onClick={() => setAbierto(true)} aria-label={'Comentarios: ' + n}>💬 {n || ''}</button>;
  }
  const ver = abierto ? todos : todos.slice(-verN);
  return (
    <div className={'cmh' + (chico ? ' en-fila' : '')}>
      {n ? (
        <>
          {!abierto && n > verN ? <button type="button" className="cmh-mas" onClick={() => setAbierto(true)}>Ver los {n} comentarios</button> : null}
          <ul className="cmh-l">
            {ver.map((c) => <Comentario key={c.id} liga={liga} c={c} ahora={ahora} yo={yo} dueno={dueno} todos={todos} pub={pub}
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
      {rapidas ? (
        <div className="cmh-rap" role="group" aria-label="Respuestas rápidas">
          {RAPIDAS.map((r) => <button key={r} type="button" disabled={va} onClick={() => rapida(r)}>{r}</button>)}
        </div>
      ) : null}
    </div>
  );
}

// para el Dashboard y Mi cuenta
export const CM_ESTADOS = [['si', 'Sí'], ['pre', 'Sin preguntar'], ['no', 'No']];
