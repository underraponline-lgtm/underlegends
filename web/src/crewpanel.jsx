// 👥 LO QUE SE TOCA DE LAS CREWS (Dlx, 19/10/2026; las reglas en bot/crews.js, los datos en crews.js): entrar, pedir,
// aceptar una invitación, invitar, y el panel de quien manda —los pedidos, los rangos, sacar, pasar el liderazgo, los
// representantes, cómo se entra, el nombre y cerrarla—. Y «Mi crew» en Mi cuenta, con el formulario para crear una.
// ⚠️ Lo que el rol no deja, no se muestra; y si igual se pide, el objeto dice que no (la página no decide nada).
import { useState } from 'react';
import { limpio, norm, num } from './liga.js';
import { Cara, DosToques } from './piezas.jsx';
import { ENTRADA_NOMBRE, ROL_NOMBRE, accionCrew, crewDe, errorCrew, useCrews } from './crews.js';

const nombreDe = (liga, k) => { const f = liga.T[k]; return f ? limpio(f.n) : k; };
const enlaceCrew = (id) => '#/crew/' + encodeURIComponent(id);

/** Un botón que hace una acción y dice cómo le fue. */
function useAccion() {
  const [va, setVa] = useState(false);
  const [msg, setMsg] = useState('');
  const hacer = (cuerpo, ok) => {
    if (va) return;
    setVa(true);
    setMsg('');
    accionCrew(cuerpo).then((j) => {
      setVa(false);
      if (j === null) return;
      if (j && j.ok) { if (ok) setMsg(ok); return; }
      setMsg(errorCrew(j));
    }).catch(() => { setVa(false); setMsg('No pude. Probá de nuevo en un rato.'); });
  };
  return { va, msg, hacer };
}

/** El rango, como pastilla. */
export function RolCrew({ rol }) {
  return rol ? <span className={'cw-rol ' + rol}>{ROL_NOMBRE[rol] || rol}</span> : null;
}

// ── entrar: lo que ve quien no está en esa crew ──────────────────────────────────────────────────────────────────────
export function EntrarCrew({ c }) {
  const { mia, todas } = useCrews();
  const { va, msg, hacer } = useAccion();
  if (!c) return null;
  const yo = mia && mia.crew;
  if (yo && yo.id === c.id) return null;
  const inv = mia && (mia.inv || []).find((x) => x.crew === c.id);
  const pedi = mia && (mia.ped || []).find((x) => x.crew === c.id);
  let cuerpo;
  if (yo) cuerpo = <p className="cw-nota">Estás en <a href={enlaceCrew(yo.id)}>{limpio(yo.nombre)}</a>: para entrar a otra, primero salí de esa.</p>;
  else if (inv) {
    cuerpo = (
      <div className="cw-fila">
        <button type="button" className="btn verde" disabled={va} onClick={() => hacer({ accion: 'responder', crew: c.id, si: true }, '¡Entraste!')}>Aceptar la invitación</button>
        <button type="button" className="btn borde2" disabled={va} onClick={() => hacer({ accion: 'responder', crew: c.id, si: false })}>No, gracias</button>
      </div>
    );
  } else if (pedi) {
    cuerpo = (
      <div className="cw-fila"><span className="cw-nota">Pediste entrar: falta que te acepten.</span>
        <button type="button" className="btn borde2 chico" disabled={va} onClick={() => hacer({ accion: 'cancelar_pedido', crew: c.id })}>Cancelar el pedido</button></div>
    );
  } else if (c.entrada === 'invitacion') cuerpo = <p className="cw-nota">A esta crew se entra sólo si te invitan.</p>;
  else if ((c.gente || []).length >= ((todas && todas.max) || 20)) cuerpo = <p className="cw-nota">La crew está llena.</p>;
  else {
    cuerpo = (
      <button type="button" className="btn verde" disabled={va}
        onClick={() => hacer({ accion: 'pedir', crew: c.id }, c.entrada === 'abierta' ? '¡Entraste!' : 'Listo: te avisamos cuando te acepten.')}>
        {c.entrada === 'abierta' ? 'Unirme a la crew' : 'Pedir entrar'}</button>
    );
  }
  return <div className="cw-entrar">{cuerpo}{msg ? <small role="status" className="cw-msg">{msg}</small> : null}</div>;
}

// ── el panel de los de adentro ───────────────────────────────────────────────────────────────────────────────────────
export function PanelCrew({ liga, c }) {
  const { mia, todas } = useCrews();
  const { va, msg, hacer } = useAccion();
  const [q, setQ] = useState('');
  if (!c || !mia || !mia.crew || mia.crew.id !== c.id) return null;
  const rol = mia.rol;
  const manda = rol === 'lider' || rol === 'colider';
  const invita = manda || rol === 'veterano';
  const maxReps = (todas && todas.ranking && todas.ranking.n) || 5;
  const reps = c.reps || [];
  const gente = c.gente || [];
  const nq = norm(q);
  const candidatos = nq.length >= 2 ? Object.values(liga.T).filter((f) => norm(f.n).includes(nq) && !crewDe(f.k) && f.k !== mia.de).slice(0, 8) : [];
  const yaInvitados = new Set((mia.invitados || []).map((x) => x.k));
  return (
    <section className="cw-panel" aria-label="Tu crew">
      <div className="cw-yo">
        <span>Sos <RolCrew rol={rol} /> de <b>{limpio(c.nombre)}</b></span>
        {rol === 'lider' && gente.length > 1 ? <small>Para irte, primero pasale el liderazgo a alguien.</small> : (
          <DosToques className="btn borde2 chico" confirmar={rol === 'lider' ? '¿Cerrar la crew?' : '¿Seguro? Esperás 7 días para otra'}
            disabled={va} onClick={() => hacer({ accion: 'salir' }, rol === 'lider' ? 'La crew se cerró.' : 'Saliste de la crew.')}>
            {rol === 'lider' ? 'Cerrar la crew' : 'Salir de la crew'}</DosToques>
        )}
      </div>
      {msg ? <p role="status" className="cw-msg">{msg}</p> : null}

      {manda && (mia.pedidos || []).length ? (
        <div className="cw-bloque">
          <h3 className="cw-h">Quieren entrar · {mia.pedidos.length}</h3>
          <ul className="cw-lista">{mia.pedidos.map((p) => (
            <li key={p.k}>
              <Cara liga={liga} k={p.k} nombre={nombreDe(liga, p.k)} cls="cara cw-cara" />
              <a href={'#/r/' + encodeURIComponent(p.k)}>{nombreDe(liga, p.k)}</a>
              <span className="cw-acc">
                <button type="button" className="btn verde chico" disabled={va} onClick={() => hacer({ accion: 'decidir', a: p.k, si: true })}>Aceptar</button>
                <button type="button" className="btn borde2 chico" disabled={va} onClick={() => hacer({ accion: 'decidir', a: p.k, si: false })}>No</button>
              </span>
            </li>
          ))}</ul>
        </div>
      ) : null}

      {invita ? (
        <div className="cw-bloque">
          <h3 className="cw-h">Invitar</h3>
          {gente.length >= ((todas && todas.max) || 20) ? <p className="cw-nota">La crew está llena.</p> : (
            <>
              <input type="search" className="cw-busca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscá a quién invitar"
                aria-label="Buscar a quién invitar a la crew" enterKeyHint="search" />
              {candidatos.length ? (
                <ul className="cw-lista">{candidatos.map((f) => (
                  <li key={f.k}>
                    <Cara liga={liga} k={f.k} nombre={f.n} cls="cara cw-cara" />
                    <span>{limpio(f.n)}</span>
                    <span className="cw-acc">{yaInvitados.has(f.k) ? <small>Invitado</small>
                      : <button type="button" className="btn verde chico" disabled={va} onClick={() => hacer({ accion: 'invitar', a: f.k }, 'Invitación enviada a ' + limpio(f.n) + '.')}>Invitar</button>}</span>
                  </li>
                ))}</ul>
              ) : nq.length >= 2 ? <p className="cw-nota">Nadie sin crew con ese nombre.</p> : null}
              {(mia.invitados || []).length ? <p className="cw-nota">Esperan respuesta: {mia.invitados.map((x) => nombreDe(liga, x.k)).join(', ')}.</p> : null}
            </>
          )}
        </div>
      ) : null}

      {manda ? (
        <div className="cw-bloque">
          <h3 className="cw-h">La gente</h3>
          <ul className="cw-lista">{gente.filter((g) => g[0] !== mia.de).map(([k, r]) => {
            const puedeTocar = rol === 'lider' || r === 'veterano' || r === 'miembro';
            return (
              <li key={k}>
                <Cara liga={liga} k={k} nombre={nombreDe(liga, k)} cls="cara cw-cara" />
                <span>{nombreDe(liga, k)} <RolCrew rol={r} /></span>
                {puedeTocar ? (
                  <span className="cw-acc">
                    <select className="cw-sel" value={r} disabled={va || r === 'lider'} aria-label={'El rango de ' + nombreDe(liga, k)}
                      onChange={(e) => hacer({ accion: 'rol', a: k, rol: e.target.value })}>
                      {(rol === 'lider' ? ['colider', 'veterano', 'miembro'] : ['veterano', 'miembro']).map((x) => <option key={x} value={x}>{ROL_NOMBRE[x]}</option>)}
                      {r === 'lider' ? <option value="lider">{ROL_NOMBRE.lider}</option> : null}
                    </select>
                    {rol === 'lider' ? <DosToques className="btn borde2 chico" confirmar="¿Seguro?" disabled={va} onClick={() => hacer({ accion: 'lider', a: k }, 'Ahora el Líder es ' + nombreDe(liga, k) + '.')}>Hacer Líder</DosToques> : null}
                    <DosToques className="btn borde2 chico" confirmar="¿Sacarlo?" disabled={va} onClick={() => hacer({ accion: 'sacar', a: k })}>Sacar</DosToques>
                  </span>
                ) : null}
              </li>
            );
          })}</ul>
        </div>
      ) : null}

      {manda ? (
        <div className="cw-bloque">
          <h3 className="cw-h">Quiénes los representan · hasta {maxReps}</h3>
          <p className="cw-nota">Cuando el ranking de crews se arma con los representantes, cuentan sólo los puntos de estos.</p>
          <div className="cw-reps">{gente.map(([k]) => {
            const on = reps.includes(k);
            return (
              <label key={k} className={'cw-rep' + (on ? ' on' : '')}>
                <input type="checkbox" checked={on} disabled={va || (!on && reps.length >= maxReps)}
                  onChange={() => hacer({ accion: 'reps', reps: on ? reps.filter((x) => x !== k) : reps.concat(k) })} />
                {nombreDe(liga, k)}
              </label>
            );
          })}</div>
        </div>
      ) : null}

      {rol === 'lider' ? <AjustesLider c={c} va={va} hacer={hacer} /> : null}
    </section>
  );
}

function AjustesLider({ c, va, hacer }) {
  const [nombre, setNombre] = useState(c.nombre);
  const [sigla, setSigla] = useState(c.sigla || '');
  return (
    <div className="cw-bloque">
      <h3 className="cw-h">Cómo se entra</h3>
      <div className="cw-reps">{Object.entries(ENTRADA_NOMBRE).map(([k, t]) => (
        <label key={k} className={'cw-rep' + (c.entrada === k ? ' on' : '')}>
          <input type="radio" name="cw-entrada" checked={c.entrada === k} disabled={va} onChange={() => hacer({ accion: 'entrada', entrada: k })} />{t}
        </label>
      ))}</div>
      <h3 className="cw-h">El nombre</h3>
      <form className="cw-fila" onSubmit={(e) => { e.preventDefault(); hacer({ accion: 'nombre', nombre, sigla }, 'Listo.'); }}>
        <input className="cw-busca" value={nombre} maxLength={24} onChange={(e) => setNombre(e.target.value)} aria-label="El nombre de la crew" />
        <input className="cw-busca cw-sigla" value={sigla} maxLength={4} onChange={(e) => setSigla(e.target.value)} placeholder="Sigla" aria-label="La sigla (opcional)" />
        <button type="submit" className="btn borde2 chico" disabled={va}>Guardar</button>
      </form>
      <small className="cw-nota">El nombre se cambia una vez cada 30 días.</small>
    </div>
  );
}

// ── en un perfil: «Invitar a mi crew» ───────────────────────────────────────────────────────────────────────────────
export function InvitarACrew({ k, nombre }) {
  const { mia } = useCrews();
  const { va, msg, hacer } = useAccion();
  if (!mia || !mia.crew || !['lider', 'colider', 'veterano'].includes(mia.rol) || k === mia.de || crewDe(k)) return null;
  const ya = (mia.invitados || []).some((x) => x.k === k);
  return (
    <span className="cw-inv-b">
      <button type="button" className="btn borde chico" disabled={va || ya}
        onClick={() => hacer({ accion: 'invitar', a: k }, 'Invitación enviada.')}>{ya ? 'Invitado a ' + limpio(mia.crew.nombre) : 'Invitar a mi crew'}</button>
      {msg ? <small role="status" className="cw-msg">{msg}</small> : null}
    </span>
  );
}

// ── Mi cuenta → Mi crew ──────────────────────────────────────────────────────────────────────────────────────────────
export function MiCrew({ liga, dc }) {
  const { mia, todas } = useCrews();
  const { va, msg, hacer } = useAccion();
  const [nombre, setNombre] = useState('');
  const [sigla, setSigla] = useState('');
  const [entrada, setEntrada] = useState('pedido');
  if (!dc) return <p className="cu-d">Entrá con Discord para armar tu crew o aceptar una invitación.</p>;
  if (!mia) return <p className="cu-d">Mirando tu crew…</p>;
  if (!mia.de) return <p className="cu-d">Las crews son de los Miembros de Discord Rap Español: <a href="#/cuenta/verificar">verificate</a> y armá la tuya o sumate a una.</p>;
  if (mia.crew) {
    return (
      <div className="cw-mia">
        <p className="cu-d">Sos <RolCrew rol={mia.rol} /> de <a href={enlaceCrew(mia.crew.id)}><b>{limpio(mia.crew.nombre)}</b></a> · {mia.crew.gente.length} de {mia.max}.</p>
        <a className="btn verde chico" href={enlaceCrew(mia.crew.id)}>Ir a la crew</a>
      </div>
    );
  }
  const precio = mia.precio ?? 2500;
  const espera = mia.espera_ms > 0;
  return (
    <div className="cw-mia">
      {(mia.inv || []).length ? (
        <div className="cw-bloque">
          <h3 className="cw-h">Te invitaron</h3>
          <ul className="cw-lista">{mia.inv.map((x) => (
            <li key={x.crew}>
              <a href={enlaceCrew(x.crew)}><b>{limpio(x.nombre)}</b></a>
              <small>te invitó {nombreDe(liga, x.de)}</small>
              <span className="cw-acc">
                <button type="button" className="btn verde chico" disabled={va || espera} onClick={() => hacer({ accion: 'responder', crew: x.crew, si: true }, '¡Entraste!')}>Aceptar</button>
                <button type="button" className="btn borde2 chico" disabled={va} onClick={() => hacer({ accion: 'responder', crew: x.crew, si: false })}>No</button>
              </span>
            </li>
          ))}</ul>
        </div>
      ) : null}
      {(mia.ped || []).length ? <p className="cu-d">Pediste entrar a {mia.ped.map((x) => limpio(x.nombre)).join(', ')}: falta que te acepten.</p> : null}
      {espera ? <p className="cu-d">Saliste de una crew hace poco: podés entrar a otra o armar la tuya en {Math.ceil(mia.espera_ms / 86400000)} días.</p> : null}
      <div className="cw-bloque">
        <h3 className="cw-h">Armá tu crew</h3>
        <p className="cu-d">Cuesta <b>{num(precio)} Puntos de Tienda</b>{typeof mia.saldo === 'number' ? <> (tenés {num(mia.saldo)})</> : null}. Hasta {mia.max} raperos; vos sos el Líder.</p>
        <form className="cw-crear" onSubmit={(e) => { e.preventDefault(); hacer({ accion: 'crear', nombre: nombre.trim(), sigla: sigla.trim(), entrada }, '¡Tu crew está armada!'); }}>
          <label>Nombre<input className="cw-busca" value={nombre} maxLength={24} required minLength={3} onChange={(e) => setNombre(e.target.value)} placeholder="Los del Barrio" /></label>
          <label>Sigla <small>(opcional)</small><input className="cw-busca cw-sigla" value={sigla} maxLength={4} onChange={(e) => setSigla(e.target.value)} placeholder="LDB" /></label>
          <fieldset className="cw-reps"><legend>Cómo se entra</legend>{Object.entries(ENTRADA_NOMBRE).map(([k, t]) => (
            <label key={k} className={'cw-rep' + (entrada === k ? ' on' : '')}><input type="radio" name="cw-ent" checked={entrada === k} onChange={() => setEntrada(k)} />{t}</label>
          ))}</fieldset>
          <button type="submit" className="btn verde" disabled={va || espera || (typeof mia.saldo === 'number' && mia.saldo < precio)}>
            Armar la crew · {num(precio)}</button>
        </form>
      </div>
      {msg ? <p role="status" className="cw-msg">{msg}</p> : null}
      {todas && todas.crews && todas.crews.length ? <p className="cu-d">O sumate a una: <a href="#/ranking/crews">las crews de la Liga</a>.</p> : null}
    </div>
  );
}
