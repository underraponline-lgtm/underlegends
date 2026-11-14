// 🐣 MISIONES PARA NUEVOS (13/11/2026). Dlx: «que estas sean MISIONES PARA NUEVOS y sus recompensas... un track especial
// para los nuevos... un rectángulo grande encima de los 4 mini paneles... como niveles que cada nivel se avance haciendo
// esas misiones... que dure una semana para cada nuevo. Que cada día se desbloquee el siguiente nivel con sus misiones»,
// y a la maqueta, «Sí, así». Qué cuenta y qué paga lo decide el objeto (`nuevoDe()` en bot/avisos.js), que mira las
// tablas de cada cosa: acá sólo se dibuja. Sin cuenta se ve igual, con candados: «estas recompensas te esperan si te
// vinculas» (Dlx).
//
// ⭐ Y LAS REDES DE LA LIGA, un Star Dragon por cada una (Dlx: «en premio gratis... otras opciones para aquellos q no nos
// han seguido en nuestras redes sociales»). ⚠️ Ninguna red deja saber si alguien de verdad te sigue: cuenta abrir el link,
// una vez por red y por cuenta.
import { useEffect, useState } from 'react';
import { num } from './liga.js';
import { Ico, accion } from './piezas.jsx';
import { RED_NOMBRE, RED_SVG } from './redes_ico.jsx';
import { DIAS_PISTA, enSemanaNueva, nuevoLocal, pedirRecorrido, redAbierta, tuto, tutoPoner } from './primera.js';

const W = typeof window !== 'undefined' ? window : {};
const E = { d: null, cuenta: null, va: false, t: 0, oyen: new Set() };
const avisar = () => E.oyen.forEach((f) => f());

/** Lo tuyo, del objeto (con cuenta) o la pista vacía (sin cuenta). Lo nuevo que se cobró trae los drops de nuevo */
export function pedirNuevo(dc, forzar) {
  const cuenta = !!dc;
  if (E.va || (!forzar && E.d && E.cuenta === cuenta && Date.now() - E.t < 60000)) return Promise.resolve(E.d);
  E.va = true;
  const cuerpo = Object.assign({}, nuevoLocal(), cuenta ? { cuenta: true } : {});
  const p = cuenta && W.conCuenta ? W.conCuenta('/api/avisos/nuevo', cuerpo)
    : fetch('/api/avisos/nuevo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => r.json());
  return p.then((j) => {
    E.va = false;
    if (j && j.ok) {
      const antes = E.d;
      E.d = j; E.cuenta = cuenta; E.t = Date.now();
      // 💾 lo que el objeto sabe y este navegador no: si tiene pista (así se la vuelve a pedir) y las redes que ya cobró
      if (cuenta) {
        const T = tuto() || {};
        const redes = [...new Set([...(T.redes || []), ...(j.redes || [])])];
        tutoPoner({ pista: j.pista && !j.pista.fin ? 'si' : 'no', redes });
      }
      avisar();
      // 🐉 si cobró algo nuevo, la barra de los drops se vuelve a pedir (la escucha `lg:cofre`)
      if (cuenta && antes && JSON.stringify(cobrado(antes)) !== JSON.stringify(cobrado(j))) W.dispatchEvent(new Event('lg:cofre'));
    }
    return E.d;
  }).catch(() => { E.va = false; return E.d; });
}
const cobrado = (j) => [((j.pista || {}).hechas) || 0, (j.redes || []).length];

/**
 * Lo tuyo. `quiere`: si hace falta pedirlo —cada pedido despierta al Worker, y la pista es de pocos—: la pista, sólo a
 * quien este navegador cree nuevo o ya la tenía; las redes, al abrirlas
 */
export function useNuevo(dc, quiere = true) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!quiere) return undefined;
    const f = () => setN((n) => n + 1);
    E.oyen.add(f);
    pedirNuevo(dc);
    // lo que se hizo en otra pestaña o en otra página cuenta al volver
    const vuelve = () => { if (document.visibilityState === 'visible') pedirNuevo(dc); };
    const ya = () => pedirNuevo(dc, true);
    document.addEventListener('visibilitychange', vuelve);
    W.addEventListener('lg:nuevo', ya);
    return () => { E.oyen.delete(f); document.removeEventListener('visibilitychange', vuelve); W.removeEventListener('lg:nuevo', ya); };
  }, [!!dc, quiere]); // eslint-disable-line react-hooks/exhaustive-deps
  return E.cuenta === !!dc ? E.d : null;
}
/** ¿Hay que pedir la pista? */
export const quierePista = (dc) => enSemanaNueva() || !!(dc && (tuto() || {}).pista === 'si');

/** Un premio en palabras (`NUEVO_PISTA` de bot/avisos.js) */
export function txtPremio(pr) {
  const n = pr[1];
  switch (pr[0]) {
    case 'pdt': return num(n) + ' Puntos de Tienda';
    case 'drop': return n === 1 ? '1 Dragón Drop' : n + ' Dragón Drops';
    case 'star': return n === 1 ? '1 Star Dragon' : n + ' Star Dragons';
    case 'cofre': return '1 cofre';
    case 'titulo': return 'Título «' + n + '»';
    case 'redes': return '1 Star Dragon por red';
    case 'caja': return 'Caja del Nuevo';
    default: return '';
  }
}
const CLASE = { pdt: 'pdt', drop: 'drop', star: 'star', cofre: 'cofre', titulo: 'tit', redes: 'star', caja: 'cofre' };

/** La pista sin cuenta: la del objeto, con lo que sabe este navegador (los tutoriales) y el día desde su primera visita */
function pistaLocal(pl) {
  const T = tuto();
  if (!T || !pl) return null;
  const et = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const dia = Math.round((Date.parse(et(Date.now())) - Date.parse(et(T.t))) / 86400000) + 1;
  const local = { corto: T.corto === 'fin', completo: !!T.completo };
  let hechas = 0, total = 0;
  const dias = pl.map(([t, premio, mis], i) => {
    const abierto = i + 1 <= dia;
    const ms = mis.map(([id, tx, pr]) => { const ok = abierto && !!local[id]; total++; if (ok) hechas++; return { id, t: tx, premio: pr, ok }; });
    return { n: i + 1, t, premio, abierto, hecho: false, mis: ms };
  });
  return { dia: Math.min(dia, pl.length + 1), de: pl.length, fin: dia > pl.length, hechas, total, dias };
}

/** A dónde lleva cada misión */
function irA(id, abrirRedes) {
  const rutas = { campana: '#/avisos', verif: '#/cuenta/verificar', perfil: '#/cuenta', sigue3: '#/ranking', fel: '#/publicaciones',
    cm: '#/publicaciones', nivel1: '#/pase', tareas2: '#/pase', cancha: '#/eventos', crew: '#/crews', encuesta: '#/publicaciones' };
  if (id === 'corto') return () => pedirRecorrido('corto');
  if (id === 'completo') return () => { location.hash = '#/guia'; setTimeout(() => W.dispatchEvent(new Event('lg:aprende')), 300); };
  if (id === 'entrar') return () => accion.entrar();
  if (id === 'redes') return abrirRedes;
  if (id === 'historia') return () => { try { W.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { W.scrollTo(0, 0); } };
  return () => { location.hash = rutas[id] || '#/'; };
}

/** 🐣 El rectángulo de arriba de los cuatro paneles del Inicio */
export function PistaNuevos({ liga, dc }) {
  const D = useNuevo(dc, quierePista(dc));
  const [sel, setSel] = useState(null);
  const [redes, setRedes] = useState(false);
  if (!D) return null;
  const P = dc ? D.pista : (enSemanaNueva() ? pistaLocal(D.plantilla) : null);
  if (!P || P.fin) return null;
  const caja = dc ? D.pista.cajaPremio : D.caja;
  const hoy = Math.min(P.dia, P.de) - 1;
  const i = sel == null ? hoy : sel;
  const d = P.dias[i];
  const quedan = DIAS_PISTA - hoy;
  const ya = P.dias.filter((x) => x.hecho).length;
  // la línea que une los niveles se llena hasta hoy
  const lleno = P.de > 1 ? (100 * hoy) / (P.de - 1) : 0;
  return (
    <section className="nvp" aria-labelledby="nvp-t">
      <div className="nvp-cab">
        <div>
          <span className="nvp-k">MISIONES PARA NUEVOS · DÍA {hoy + 1} DE {P.de}</span>
          <h2 id="nvp-t">Tu primera semana en la Liga</h2>
        </div>
        <span className="nvp-cuenta">{P.hechas} de {P.total} misiones · {quedan === 1 ? 'último día' : 'quedan ' + quedan + ' días'}</span>
      </div>
      <div className="nvp-pista" style={{ '--nvp-lleno': lleno + '%' }}>
        <ol>
          {P.dias.map((x, j) => {
            const falta = x.mis.filter((m) => !m.ok).length;
            const sub = x.hecho ? 'Hecho' : j === hoy ? 'Hoy' : !x.abierto ? (j === hoy + 1 ? 'Mañana' : 'Día ' + x.n) : falta === 1 ? 'Te falta 1' : 'Te faltan ' + falta;
            return (
              <li key={x.n}>
                <button type="button" className={'nvp-nv' + (x.hecho ? ' hecho' : '') + (j === hoy ? ' hoy' : '') + (!x.abierto ? ' cerrado' : '') + (j === i ? ' sel' : '')}
                  aria-pressed={j === i} aria-label={'Día ' + x.n + ': ' + x.t + ' (' + sub + ')'} onClick={() => setSel(j)}>
                  <span className="nvp-c">{x.hecho ? <Ico n="ok" t={18} /> : !x.abierto ? <Ico n="candado" t={15} /> : x.n}</span>
                  <b>{x.t}</b><small>{sub}</small>
                </button>
              </li>
            );
          })}
        </ol>
        <span className={'nvp-caja' + (ya === P.de ? ' hecho' : '')} title={caja ? num(caja.puntos) + ' Puntos de Tienda, ' + caja.star + ' Star Dragons y el título «' + caja.titulo + '»' : ''}>
          <span className="nvp-cj" aria-hidden="true"><Ico n="premio" t={22} /></span><b>Caja del Nuevo</b><small>{ya} de {P.de} días</small>
        </span>
      </div>
      {!dc ? (
        <div className="nvp-vinc">
          <span>Estas recompensas te esperan en cuanto vincules tu cuenta de Discord.</span>
          <button type="button" className="btn chico nvp-dc" onClick={accion.entrar}>Vincular con Discord</button>
        </div>
      ) : null}
      <div className="nvp-dia">
        <span className="nvp-dt"><b>Día {d.n} · {d.t}</b>{d.abierto ? null : <em>se abre {i === hoy + 1 ? 'mañana' : 'el día ' + d.n}</em>}
          <span className={'nvp-pr ' + CLASE[d.premio[0]]}>Al completarlo: {d.premio[0] === 'caja' ? 'la Caja del Nuevo (los siete días)' : txtPremio(d.premio)}</span></span>
        <ul className="nvp-ms">
          {d.mis.map((m) => (
            <li key={m.id} className={m.ok ? 'ok' : ''}>
              <span className="nvp-ck" aria-hidden="true">{m.ok ? <Ico n="ok" t={14} /> : null}</span>
              <span className="nvp-mt"><b>{m.t}</b>
                <span className={'nvp-pr ' + CLASE[m.premio[0]] + (!dc || !d.abierto ? ' lock' : '')}>
                  {!dc || !d.abierto ? <Ico n="candado" t={11} /> : null}{txtPremio(m.premio)}</span></span>
              {m.ok ? <span className="nvp-ya">Hecho</span>
                : d.abierto ? <button type="button" className="nvp-ir" onClick={irA(m.id, () => setRedes(true))}>{m.id === 'entrar' ? 'Entrar' : 'Ir'}</button>
                  : <span className="nvp-ya">Día {d.n}</span>}
            </li>
          ))}
        </ul>
      </div>
      {redes ? <VentanaRedes liga={liga} dc={dc} cerrar={() => setRedes(false)} /> : null}
    </section>
  );
}

/** Las redes como ventana (desde la misión del día 2) */
function VentanaRedes({ liga, dc, cerrar }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') cerrar(); };
    W.addEventListener('keydown', k);
    return () => W.removeEventListener('keydown', k);
  }, [cerrar]);
  return (
    <div className="nvp-velo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className="nvp-ven" role="dialog" aria-modal="true" aria-labelledby="rds-t">
        <button type="button" className="btn-ico nvp-x" aria-label="Cerrar" onClick={cerrar}><Ico n="cerrar" t={18} /></button>
        <RedesLista liga={liga} dc={dc} titulo />
      </div>
    </div>
  );
}

/** ¿Le falta seguir alguna red? (para el Premio gratis) */
export function faltanRedes(liga, dc) {
  const D = E.cuenta === !!dc ? E.d : null;
  const ya = new Set([...((D && D.redes) || []), ...((tuto() || {}).redes || [])]);
  return redesDe(liga).filter(([r]) => !ya.has(r)).length;
}
const redesDe = (liga) => ((liga.d && liga.d.redes) || []).filter((r) => r && RED_SVG[r[0]] && /^https:\/\//.test(r[1] || ''));

/** ⭐ Las redes de la Liga con su Star Dragon: el Premio gratis y la misión del día 2 */
export function RedesLista({ liga, dc, titulo }) {
  const D = useNuevo(dc);
  const [, setN] = useState(0);
  const xs = redesDe(liga);
  if (!xs.length) return null;
  const T = tuto() || {};
  const cobradas = new Set((D && D.redes) || []);
  const abiertas = new Set(T.redes || []);
  const n = xs.filter(([r]) => cobradas.has(r) || abiertas.has(r)).length;
  const abrir = (r, url) => {
    try { W.open(url, '_blank', 'noopener'); } catch (e) { /* el link igual */ }
    redAbierta(r);
    setN((k) => k + 1);
    if (dc) pedirNuevo(dc, true);
  };
  return (
    <div className="rds">
      {titulo ? <><span className="nvp-k">PREMIO GRATIS</span><h3 id="rds-t" className="rds-t">Síguenos y gana Star Dragons</h3></> : null}
      <p className="rds-que"><span className="rds-st" aria-hidden="true">★</span>
        <span>Un <b>Star Dragon</b> es un Dragón Drop que sale de <b>Vinilo para arriba</b>: nunca Maqueta ni Mixtape. Uno por cada red que sigas. Llevas <b className="rds-n">{n} de {xs.length}</b>.</span></p>
      {!dc ? <p className="rds-sin">Puedes seguirnos igual: los Star Dragons te esperan al vincular tu cuenta de Discord.
        <button type="button" className="btn chico nvp-dc" onClick={accion.entrar}>Vincular</button></p> : null}
      <ul className="rds-l">
        {xs.map(([r, url]) => {
          const ya = cobradas.has(r) || abiertas.has(r);
          return (
            <li key={r}>
              <span className="rds-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20">{RED_SVG[r]}</svg></span>
              <span className="rds-nm"><b>{RED_NOMBRE[r] || r}</b><small>{url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}</small></span>
              {ya ? <button type="button" className={'rds-b ya' + (dc && cobradas.has(r) ? '' : ' espera')} onClick={() => abrir(r, url)}>
                {dc && cobradas.has(r) ? 'Listo · +1' : dc ? 'Abierta' : 'Te espera'}</button>
                : <button type="button" className="rds-b" onClick={() => abrir(r, url)}>Seguir</button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
