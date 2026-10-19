// 👥 LO QUE SE TOCA DE LAS CREWS (Dlx, 19/10/2026; las reglas en bot/crews.js, los datos en crews.js): entrar, pedir,
// aceptar una invitación, invitar, y el panel de quien manda —los pedidos, los rangos, sacar, pasar el liderazgo, los
// representantes, cómo se entra, el nombre y cerrarla—. Y «Mi crew» en Mi cuenta, con el formulario para crear una.
// ⚠️ Lo que el rol no deja, no se muestra; y si igual se pide, el objeto dice que no (la página no decide nada).
import { useEffect, useRef, useState } from 'react';
import { limpio, norm, num } from './liga.js';
import { Cara, DosToques } from './piezas.jsx';
import { aBase64, achicar } from './imagen.js';
import { ENTRADA_NOMBRE, ROL_NOMBRE, accionCrew, crewDe, cuandoVence, errorCrew, quedan, useCrews } from './crews.js';

// el orden de las letras para elegir el mínimo (de la mejor a la peor): sólo el orden, los umbrales viven en comun/rangos.py
const LETRAS = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E'];
const nombreDe = (liga, k) => { const f = liga.T[k]; return f ? limpio(f.n) : k; };
const enlaceCrew = (id) => '#/crew/' + encodeURIComponent(id);

/** Un botón que hace una acción y dice cómo le fue. `ok`: el texto, o una función de la respuesta que lo arma. */
function useAccion() {
  const [va, setVa] = useState(false);
  const [msg, setMsg] = useState('');
  const hacer = (cuerpo, ok) => {
    if (va) return Promise.resolve(null);
    setVa(true);
    setMsg('');
    return accionCrew(cuerpo).then((j) => {
      setVa(false);
      if (j === null) return null;
      if (j && j.ok) { const t = typeof ok === 'function' ? ok(j) : ok; if (t) setMsg(t); return j; }
      setMsg(errorCrew(j));
      return null;
    }).catch(() => { setVa(false); setMsg('No pude. Probá de nuevo en un rato.'); return null; });
  };
  return { va, msg, hacer, setMsg };
}

// 🖼️ EL LOGO DE UNA CREW (Dlx, 19/10/2026: «que cuando se cree la crew se necesite un logo que pase por el auto filtro
// que tenemos»). Se achica acá a 512×512 en webp —el canvas, además, no copia la ubicación de una foto del celular— y el
// objeto lo pasa por el filtro de los fondos: limpio se ve ya, dudoso espera revisión (bot/crews.js)
const LOGO_LADO = 512, LOGO_TOPE = 300 * 1024;
function ElegirLogo({ vista, onElegido, onError, chico }) {
  const elegir = async (e) => {
    const a = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!a) return;
    if (!/^image\//.test(a.type)) { onError('Eso no es una imagen.'); return; }
    try { const b = await achicar(a, LOGO_LADO, LOGO_LADO, LOGO_TOPE); onElegido(b, URL.createObjectURL(b)); } catch (er) { onError('No pude usar esa imagen: ' + er.message); }
  };
  return (
    <span className={'cw-logo-el' + (chico ? ' chico' : '')}>
      <span className="cw-logo-v">{vista ? <img src={vista} alt="El logo elegido" /> : <span aria-hidden="true">LOGO</span>}</span>
      <label className="btn borde2 chico cw-logo-b">{vista ? 'Cambiar' : 'Elegir el logo'}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={elegir} /></label>
    </span>
  );
}
// ⏳ CREAR UNA CREW TARDA, Y LA PÁGINA NO DECÍA NADA (Dlx, 19/10/2026, después de armar la suya: «que diga está
// cargando… por favor no cambiar la página ni salirse ni apagar el dispositivo… o una barra de progreso porque se
// demoró»). El logo pasa por la IA del filtro antes de guardarse: de 5 a 30 segundos. Cuánto falta de verdad no se
// sabe —es un solo pedido—, así que la barra avanza por etapas según el tiempo, nunca llega sola al final, y se va
// cuando el objeto contesta. Mientras tanto, salir de la página pide confirmar: si se corta, la crew puede quedar a medias.
const ETAPAS_CREAR = [[0, 'Subiendo el logo'], [2500, 'Revisando el logo con el filtro automático'], [14000, 'Armando la crew'],
  [26000, 'Ya casi: el filtro está tardando un poco más']];
const ETAPAS_LOGO = [[0, 'Subiendo el logo'], [2500, 'Revisando el logo con el filtro automático'], [20000, 'Ya casi: el filtro está tardando un poco más']];
function Cargando({ titulo, etapas }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => setT(Date.now() - t0), 250);
    const salir = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', salir);
    return () => { clearInterval(iv); window.removeEventListener('beforeunload', salir); };
  }, []);
  const pct = Math.min(95, Math.round(95 * (1 - Math.exp(-t / 9000))));
  const etapa = etapas.filter(([d]) => t >= d).pop()[1];
  return (
    <div className="cw-cargando" role="status" aria-live="polite">
      <b className="cw-cargando-t">{titulo}</b>
      <div className="cw-cargando-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={etapa}>
        <i style={{ width: pct + '%' }} />
      </div>
      <p className="cw-cargando-e">{etapa}… <span>{pct}%</span></p>
      <p className="cw-cargando-ojo">⚠️ No cierres ni cambies la página, y no apagues el dispositivo. Puede tardar hasta medio minuto.</p>
    </div>
  );
}
const msgLogo = (j) => (j && j.logo === 'revisar' ? ' El logo lo revisa la Liga antes de mostrarse: te avisamos en la campana.' : '');

/** El rango, como pastilla. */
export function RolCrew({ rol }) {
  return rol ? <span className={'cw-rol ' + rol}>{ROL_NOMBRE[rol] || rol}</span> : null;
}

// ── ⏳ la primera semana de una crew nueva ──────────────────────────────────────────────────────────────────────────
// Dlx, 19/10/2026: «una semana para invitar a 2 personas como mínimo, o la crew se eliminará; que esto sea notable por el
// líder». Al Líder y a los Colíderes, arriba de todo y grande, con lo que falta, hasta cuándo y el botón a invitar; a la
// gente de la crew, lo mismo sin el botón; a quien la mira de afuera, una línea —que también le sirve: busca gente—
const DIA = 86400000;
export function SemanaCrew({ c, rol, publico, onInvitar }) {
  const { todas } = useCrews();
  if (!c || !c.vence) return null;
  const total = 1 + ((todas && todas.prueba && todas.prueba.sumar) || 2);
  const n = (c.gente || []).length;
  const falta = Math.max(0, total - n);
  const resta = c.vence - Date.now();
  if (falta <= 0 || resta <= 0) return null;
  const quienes = falta === 1 ? '1 persona más' : falta + ' personas más';
  if (publico) return <p className="cw-nota cw-semana-p">⏳ Crew nueva: busca <b>{quienes}</b> hasta el {cuandoVence(c.vence)}.</p>;
  const manda = rol === 'lider' || rol === 'colider';
  return (
    <div className={'cw-semana' + (resta <= 2 * DIA ? ' urge' : '')}>
      <div className="cw-semana-t">
        <span className="cw-semana-tag">Primera semana</span>
        <b className="cw-semana-q">{quedan(resta)}</b>
      </div>
      <p className="cw-semana-d">{manda ? 'Sumá' : 'La crew necesita'} <b>{quienes}</b> antes del {cuandoVence(c.vence)}, o la crew <b>se borra</b>.</p>
      <div className="cw-semana-pie">
        <span className="cw-semana-pips" role="img" aria-label={n + ' de ' + total + ' en la crew'}>
          {Array.from({ length: total }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
          <small>{n} de {total}</small>
        </span>
        {manda && onInvitar ? <button type="button" className="btn verde chico" onClick={onInvitar}>Invitar</button>
          : manda ? <a className="btn verde chico" href={enlaceCrew(c.id)}>Ir a invitar</a> : null}
      </div>
    </div>
  );
}

// ── 🏆 el tier (Dlx, 19/10/2026: «como los equipos de fútbol: pueden bajar de división, subir y mantenerse») ─────
// Las reglas y los colores viajan en el payload (`liga.d.crews_tiers`, de bot/crews_tiers.py): acá no se escribe ninguno
const TINTA_OSCURA = '#030304';
function tintaSobre(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? TINTA_OSCURA : '#fff';
}
export function TierChip({ n = 0, T, chico }) {
  if (!T || !T.nombres) return null;
  const c = (T.colores || [])[n] || '#888';
  return <span className={'tier-chip' + (chico ? ' chico' : '')} style={{ background: c, color: tintaSobre(c) }}>{T.nombres[n]}</span>;
}

export function TierCrew({ T, id }) {
  if (!T || !T.crews) return null;
  const [n, pts, jug, antes] = T.crews[id] || [0, 0, 0, null];
  const sig = n + 1 < T.nombres.length ? n + 1 : null;
  const sube = sig !== null ? T.sube[n] : null, juegan = sig !== null ? T.juegan[sig] : 0, baja = T.baja[n];
  const pct = sube ? Math.min(100, Math.round((100 * pts) / sube)) : 100;
  const vino = antes === null || antes === undefined || antes === n ? '' : antes < n ? 'Subió la semana pasada' : 'Bajó la semana pasada';
  return (
    <div className="tier-caja" style={{ '--tier': T.colores[n] }}>
      <div className="tier-arriba">
        <TierChip n={n} T={T} />
        {vino ? <small className="tier-vino">{vino}</small> : null}
      </div>
      <p className="tier-sem">Esta semana: <b>{num(pts)} puntos</b> · {jug === 1 ? 'jugó 1' : 'jugaron ' + jug} de la crew</p>
      {sube ? (
        <>
          <div className="tier-barra" role="img" aria-label={pct + '% de lo que pide ' + T.nombres[sig]}><i style={{ width: pct + '%' }} /></div>
          <p className="cw-nota">Para subir a <b>{T.nombres[sig]}</b>: {num(sube)} puntos en la semana{juegan > 1 ? ' y que jueguen ' + juegan + ' de la crew' : ''}.
            {baja ? <> Con menos de {num(baja)}, baja a {T.nombres[n - 1]}.</> : null}</p>
        </>
      ) : <p className="cw-nota">El tier más alto.{baja ? <> Con menos de {num(baja)} puntos en la semana, baja a {T.nombres[n - 1]}.</> : null}</p>}
      <p className="cw-nota">La semana cierra el lunes a las 11 AM (hora del este). {n >= T.tarjeta ? 'La crew tiene desbloqueada su tarjeta personalizable.'
        : 'En ' + T.nombres[T.tarjeta] + ' se desbloquea la tarjeta de la crew, personalizable por su Líder.'}</p>
    </div>
  );
}

/** Todos los que tienen perfil (`/api/perfiles`, `p[k].f`): se piden la primera vez que se busca, como en el buscador
 *  de arriba (`Buscar` de arriba.jsx). La tabla de la temporada sola dejaba afuera a quien no jugó la T1 (Dlx, 19/10/2026:
 *  «quiero invitar a mi admin Lil Drako pero no aparece»). */
function usePerfiles(activo) {
  const [todos, setTodos] = useState(null);
  useEffect(() => {
    if (todos || !activo || typeof window.perfiles !== 'function') return undefined;
    let vivo = true;
    Promise.resolve(window.perfiles()).then((d) => { if (vivo && d && d.p) setTodos(d.p); }).catch(() => {});
    return () => { vivo = false; };
  }, [activo, todos]);
  return todos;
}
// «lildrako» encuentra a «Lil Drako»: también se compara todo junto, sin espacios ni signos
const junto = (s) => norm(s).replace(/[^\p{L}\p{N}]/gu, '');

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
  if (yo && inv) {
    // 📨 invitado estando en otra crew (19/10/2026): aceptar es cambiarse
    cuerpo = (
      <div className="cw-entrar">
        <p className="cw-nota">Te invitaron. Estás en <a href={enlaceCrew(yo.id)}>{limpio(yo.nombre)}</a>: si aceptás, la dejás{mia.rol === 'lider'
          ? ', pero antes tenés que pasarle el liderazgo a alguien' : ''}, y por 7 días no te podés cambiar de nuevo.</p>
        <div className="cw-fila">
          <button type="button" className="btn verde" disabled={va || mia.rol === 'lider'}
            onClick={() => hacer({ accion: 'responder', crew: c.id, si: true }, (j) => '¡Entraste!' + (j.dejo ? ' Dejaste ' + limpio(j.dejo) + '.' : ''))}>Aceptar y cambiarme</button>
          <button type="button" className="btn borde2" disabled={va} onClick={() => hacer({ accion: 'responder', crew: c.id, si: false })}>No, gracias</button>
        </div>
      </div>
    );
  } else if (yo) cuerpo = <p className="cw-nota">Estás en <a href={enlaceCrew(yo.id)}>{limpio(yo.nombre)}</a>: para entrar a otra, primero salí de esa (o que te inviten).</p>;
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
  return <div className="cw-entrar"><SemanaCrew c={c} publico />{cuerpo}{msg ? <small role="status" className="cw-msg">{msg}</small> : null}</div>;
}

// ── el panel de los de adentro ───────────────────────────────────────────────────────────────────────────────────────
export function PanelCrew({ liga, c }) {
  const { mia, todas } = useCrews();
  const { va, msg, hacer, setMsg } = useAccion();
  const [q, setQ] = useState('');
  const busca = useRef(null);
  const todos = usePerfiles(q.trim().length >= 2);
  if (!c || !mia || !mia.crew || mia.crew.id !== c.id) return null;
  const rol = mia.rol;
  const manda = rol === 'lider' || rol === 'colider';
  const invita = manda || rol === 'veterano';
  const maxReps = (todas && todas.ranking && todas.ranking.n) || 5;
  const reps = c.reps || [];
  const gente = c.gente || [];
  const nq = norm(q).trim(), nqc = junto(q);
  // 📨 TODOS LOS QUE TIENEN PERFIL, TAMBIÉN LOS QUE ESTÁN EN OTRA CREW (19/10/2026): antes sólo la tabla de la temporada y
  // sin crew, y el buscador decía «nadie» de Velatz (Líder de otra) y de Lil Drako (no jugó la T1)
  const pool = new Map();
  Object.values(liga.T).forEach((f) => { if (f && f.k) pool.set(f.k, f); });
  Object.values(todos || {}).forEach((x) => { if (x && x.f && x.f.k && !pool.has(x.f.k)) pool.set(x.f.k, x.f); });
  const deMiCrew = new Set(gente.map((g) => g[0]));
  const candidatos = nq.length >= 2 ? [...pool.values()].filter((f) => f.k !== mia.de && !deMiCrew.has(f.k)
    && (norm(f.n).includes(nq) || (nqc.length >= 2 && junto(f.n).includes(nqc)))).slice(0, 8) : [];
  const yaInvitados = new Set((mia.invitados || []).map((x) => x.k));
  return (
    <section className="cw-panel" aria-label="Tu crew">
      <SemanaCrew c={c} rol={rol} onInvitar={invita ? () => { const el = busca.current; if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); } } : null} />
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
              <input ref={busca} type="search" className="cw-busca" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscá a quién invitar"
                aria-label="Buscar a quién invitar a la crew" enterKeyHint="search" />
              {candidatos.length ? (
                <ul className="cw-lista">{candidatos.map((f) => (
                  <li key={f.k}>
                    <Cara liga={liga} k={f.k} nombre={f.n} cls="cara cw-cara" />
                    <span>{limpio(f.n)}{crewDe(f.k) ? <small className="cw-en"> · en {limpio(crewDe(f.k).c.nombre)}</small> : null}</span>
                    <span className="cw-acc">{yaInvitados.has(f.k) ? <small>Invitado</small>
                      : <button type="button" className="btn verde chico" disabled={va} onClick={() => hacer({ accion: 'invitar', a: f.k }, 'Invitación enviada a ' + limpio(f.n) + '.')}>Invitar</button>}</span>
                  </li>
                ))}</ul>
              ) : nq.length >= 2 ? <p className="cw-nota">{todos ? 'Nadie con ese nombre.' : 'Buscando…'}</p> : null}
              <small className="cw-nota">A quien ya está en otra crew también lo podés invitar: si acepta, se cambia a la tuya.</small>
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

      {rol === 'lider' ? <AjustesLider c={c} va={va} hacer={hacer} setMsg={setMsg} pend={mia.logo_pend} /> : null}
    </section>
  );
}

function AjustesLider({ c, va, hacer, setMsg, pend }) {
  const [nombre, setNombre] = useState(c.nombre);
  const [sigla, setSigla] = useState(c.sigla || '');
  const [desc, setDesc] = useState(c.desc || '');
  const [logo, setLogo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [rg, setRg] = useState((c.req && c.req.rg) || '');
  const [ev, setEv] = useState(String((c.req && c.req.ev) || 0));
  return (
    <div className="cw-bloque">
      <h3 className="cw-h">Cómo se entra</h3>
      <div className="cw-reps">{Object.entries(ENTRADA_NOMBRE).map(([k, t]) => (
        <label key={k} className={'cw-rep' + (c.entrada === k ? ' on' : '')}>
          <input type="radio" name="cw-entrada" checked={c.entrada === k} disabled={va} onChange={() => hacer({ accion: 'entrada', entrada: k })} />{t}
        </label>
      ))}</div>
      {/* 🎯 lo que pide para entrar, como los trofeos mínimos de un clan (19/10/2026): se mira al pedir o al unirse a una
          abierta, no al aceptar una invitación (bot/crews.js `faltaReq()`) */}
      <h3 className="cw-h">Qué pide para entrar</h3>
      <form className="cw-fila" onSubmit={(e) => { e.preventDefault(); hacer({ accion: 'req', req: { rg, ev: Number(ev) || 0 } }, 'Listo: así se ve en la página de crews.'); }}>
        <label className="cw-req-l">Letra mínima
          <select className="cw-sel" value={rg} onChange={(e) => setRg(e.target.value)}>
            <option value="">Ninguna</option>
            {LETRAS.map((x) => <option key={x} value={x}>{x} o más</option>)}
          </select>
        </label>
        <label className="cw-req-l">Eventos en la temporada
          <input className="cw-busca cw-req-n" type="number" min={0} max={100} inputMode="numeric" value={ev} onChange={(e) => setEv(e.target.value)} />
        </label>
        <button type="submit" className="btn borde2 chico" disabled={va}>Guardar</button>
      </form>
      <small className="cw-nota">Se mira cuando alguien pide entrar o se une a una abierta. A quien invitás, entra igual.</small>
      <h3 className="cw-h">El nombre</h3>
      <form className="cw-fila" onSubmit={(e) => { e.preventDefault(); hacer({ accion: 'nombre', nombre, sigla }, 'Listo.'); }}>
        <input className="cw-busca" value={nombre} maxLength={24} onChange={(e) => setNombre(e.target.value)} aria-label="El nombre de la crew" />
        <input className="cw-busca cw-sigla" value={sigla} maxLength={4} required minLength={2} onChange={(e) => setSigla(e.target.value)} placeholder="Sigla" aria-label="La sigla" />
        <button type="submit" className="btn borde2 chico" disabled={va}>Guardar</button>
      </form>
      <small className="cw-nota">El nombre se cambia una vez cada 30 días. La sigla es obligatoria.</small>
      <h3 className="cw-h">El logo</h3>
      <div className="cw-fila">
        <ElegirLogo vista={logo ? logo[1] : c.logo} chico onElegido={(b, u) => setLogo([b, u])} onError={setMsg} />
        {logo && !subiendo ? <button type="button" className="btn verde chico" disabled={va}
          onClick={async () => {
            setSubiendo(true);
            const j = await hacer({ accion: 'logo', img: await aBase64(logo[0]) }, (r) => 'Listo.' + msgLogo(r));
            setSubiendo(false);
            if (j) setLogo(null);
          }}>Subir el logo</button> : null}
      </div>
      {subiendo ? <Cargando titulo="Subiendo el logo de la crew" etapas={ETAPAS_LOGO} /> : null}
      {pend ? <small className="cw-nota">Tu logo nuevo espera que lo revise la Liga.</small> : null}
      <h3 className="cw-h">La descripción</h3>
      <form className="cw-crear" onSubmit={(e) => { e.preventDefault(); hacer({ accion: 'desc', desc: desc.trim() }, 'Listo.'); }}>
        <textarea className="cw-busca cw-desc-in" value={desc} maxLength={160} minLength={10} required rows={2} onChange={(e) => setDesc(e.target.value)}
          aria-label="La descripción de la crew" />
        <button type="submit" className="btn borde2 chico" disabled={va}>Guardar</button>
      </form>
    </div>
  );
}

// ── en un perfil: «Invitar a mi crew» ───────────────────────────────────────────────────────────────────────────────
export function InvitarACrew({ k, nombre }) {
  const { mia } = useCrews();
  const { va, msg, hacer } = useAccion();
  const suya = crewDe(k);
  if (!mia || !mia.crew || !['lider', 'colider', 'veterano'].includes(mia.rol) || k === mia.de || (suya && suya.c.id === mia.crew.id)) return null;
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
  const { va, msg, hacer, setMsg } = useAccion();
  const [nombre, setNombre] = useState('');
  const [sigla, setSigla] = useState('');
  const [desc, setDesc] = useState('');
  const [logo, setLogo] = useState(null);
  const [entrada, setEntrada] = useState('pedido');
  const [armando, setArmando] = useState(false);
  if (!dc) return <p className="cu-d">Entrá con Discord para armar tu crew o aceptar una invitación.</p>;
  if (!mia) return <p className="cu-d">Mirando tu crew…</p>;
  if (!mia.de) return <p className="cu-d">Las crews son de los Miembros de Discord Rap Español: <a href="#/cuenta/verificar">verificate</a> y armá la tuya o sumate a una.</p>;
  if (mia.crew) {
    return (
      <div className="cw-mia">
        {msg ? <p role="status" className="cw-msg cw-listo">{msg}</p> : null}
        <SemanaCrew c={mia.crew} rol={mia.rol} />
        <p className="cu-d">Sos <RolCrew rol={mia.rol} /> de <a href={enlaceCrew(mia.crew.id)}><b>{limpio(mia.crew.nombre)}</b></a> · {mia.crew.gente.length} de {mia.max}.</p>
        {mia.logo_pend ? <p className="cu-d">🖼️ El logo de tu crew espera que lo revise la Liga: te avisamos en la campana cuando se vea.</p> : null}
        {(mia.inv || []).length ? (
          <div className="cw-bloque">
            <h3 className="cw-h">Te invitaron a otra crew</h3>
            <ul className="cw-lista">{mia.inv.map((x) => (
              <li key={x.crew}>
                <a href={enlaceCrew(x.crew)}><b>{limpio(x.nombre)}</b></a>
                <small>te invitó {nombreDe(liga, x.de)}</small>
                <span className="cw-acc">
                  <button type="button" className="btn verde chico" disabled={va || mia.rol === 'lider'}
                    onClick={() => hacer({ accion: 'responder', crew: x.crew, si: true }, '¡Te cambiaste a ' + limpio(x.nombre) + '!')}>Aceptar y cambiarme</button>
                  <button type="button" className="btn borde2 chico" disabled={va} onClick={() => hacer({ accion: 'responder', crew: x.crew, si: false })}>No</button>
                </span>
              </li>
            ))}</ul>
            <small className="cw-nota">{mia.rol === 'lider' ? 'Sos Líder: para cambiarte, primero pasale el liderazgo a alguien de tu crew.'
              : 'Si aceptás, dejás ' + limpio(mia.crew.nombre) + ' y por 7 días no te podés cambiar de nuevo.'}</small>
          </div>
        ) : null}
        <label className="cw-pref">
          <input type="checkbox" checked={mia.recibe !== false} disabled={va}
            onChange={(e) => hacer({ accion: 'pref_inv', si: e.target.checked }, e.target.checked ? 'Vas a recibir invitaciones de otras crews.' : 'Ya no vas a recibir invitaciones de otras crews.')} />
          Recibir invitaciones de otras crews
        </label>
        <a className="btn verde chico" href={enlaceCrew(mia.crew.id)}>Ir a la crew</a>
      </div>
    );
  }
  const precio = mia.precio ?? 2500;
  const sumar = (mia.prueba && mia.prueba.sumar) || 2;
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
        <p className="cu-d cw-aviso-semana">⏳ Después tenés <b>una semana para sumar {sumar} personas</b> a la crew. Si no llegan, la crew se borra y los Puntos no vuelven.</p>
        <form className="cw-crear" onSubmit={async (e) => {
          e.preventDefault();
          if (armando) return;
          if (!logo) { setMsg('Falta el logo de la crew.'); return; }
          setArmando(true);
          await hacer({ accion: 'crear', nombre: nombre.trim(), sigla: sigla.trim(), desc: desc.trim(), entrada, img: await aBase64(logo[0]) },
            (j) => '¡Tu crew está armada! Ahora sumá a ' + sumar + ' personas en una semana.' + msgLogo(j));
          setArmando(false);
        }}>
          <fieldset className="cw-campos" disabled={armando}>
          <div className="cw-logo-campo"><span className="cw-logo-t">Logo</span>
            <ElegirLogo vista={logo && logo[1]} onElegido={(b, u) => setLogo([b, u])} onError={setMsg} />
            <small>Cuadrado, se ve en un círculo. Pasa por el filtro automático: nada de desnudos, sangre, odio ni datos personales.</small></div>
          <label>Nombre<input className="cw-busca" value={nombre} maxLength={24} required minLength={3} onChange={(e) => setNombre(e.target.value)} placeholder="Los del Barrio" /></label>
          <label>Sigla <small>(2 a 4 letras)</small><input className="cw-busca cw-sigla" value={sigla} maxLength={4} required minLength={2} pattern="[\p{L}\p{N}]{2,4}" title="De 2 a 4 letras o números" onChange={(e) => setSigla(e.target.value)} placeholder="LDB" /></label>
          <label>Descripción <small>(10 a 160 letras, sin links)</small><textarea className="cw-busca cw-desc-in" value={desc} maxLength={160} minLength={10} required rows={2}
            onChange={(e) => setDesc(e.target.value)} placeholder="Quiénes son, de dónde, qué buscan" /></label>
          <fieldset className="cw-reps"><legend>Cómo se entra</legend>{Object.entries(ENTRADA_NOMBRE).map(([k, t]) => (
            <label key={k} className={'cw-rep' + (entrada === k ? ' on' : '')}><input type="radio" name="cw-ent" checked={entrada === k} onChange={() => setEntrada(k)} />{t}</label>
          ))}</fieldset>
          </fieldset>
          {armando ? <Cargando titulo="Armando tu crew" etapas={ETAPAS_CREAR} /> : (
            <button type="submit" className="btn verde" disabled={va || espera || (typeof mia.saldo === 'number' && mia.saldo < precio)}>
              Armar la crew · {num(precio)}</button>
          )}
        </form>
      </div>
      {msg ? <p role="status" className="cw-msg">{msg}</p> : null}
      {todas && todas.crews && todas.crews.length ? <p className="cu-d">O sumate a una: <a href="#/ranking/crews">las crews de la Liga</a>.</p> : null}
    </div>
  );
}
