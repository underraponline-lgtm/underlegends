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
//
// 🐣 LA PRIMERA SEMANA, SEGUNDA MANO (17/11/2026, Dlx a la maqueta privada, «Tus elecciones»). Lo que midió la simulación
// y cómo se arregló:
//   · EL PANEL EMPEZABA EN y=1118 de un teléfono de 844: va PRIMERO en el Inicio (App.jsx), en el teléfono y en la compu,
//     mientras dure tu semana. Pasado el día 7 el Inicio queda como antes (esto devuelve `null`).
//   · «TUS PRIMEROS 7 DÍAS» (el «Cobrar 200» de la racha) ERA OTRA TARJETA QUE PEDÍA LO MISMO: es una fila del día de hoy,
//     con su mismo botón y su mismo premio (`cobrarRacha('bienvenida')`), y la fila de arriba no la repite (`FilaRacha`).
//   · SIETE DE LAS DIECISÉIS PEDÍAN VERIFICARSE Y NO LO DECÍA: verificarse va el día 1, y las que lo piden llevan candado y
//     «Al verificarte» en vez de «Ir» (la lista es una sola, `NUEVO_VERIF` de bot/avisos.js, y viene con la pista).
//   · LOS PREMIOS SE PAGABAN CALLADOS (la Caja sólo cambiaba de color): cada misión cobrada sale en un aviso corto, cada día
//     completo en un momento a pantalla completa (el escenario de los drops), una vez por día y por dispositivo, y en la
//     campana (eso lo anota el objeto). La Caja del Nuevo se abre como un cofre.
import { useEffect, useRef, useState } from 'react';
import { num } from './liga.js';
import { Ico, accion } from './piezas.jsx';
import { RED_NOMBRE, RED_SVG } from './redes_ico.jsx';
import { DIAS_PISTA, enSemanaNueva, nuevoLocal, pedirRecorrido, redAbierta, tuto, tutoPoner } from './primera.js';
import { cobrarRacha, useRacha } from './racha.js';
import { COFRES, abrirCajaNuevo, abrirMomento, abrirOrigen } from './drops.jsx';

const W = typeof window !== 'undefined' ? window : {};
const E = { d: null, cuenta: null, va: false, t: 0, oyen: new Set() };
const avisar = () => E.oyen.forEach((f) => f());

// 🎉 LO QUE YA SE FESTEJÓ EN ESTE DISPOSITIVO (17/11/2026): las misiones (`m`) y los días (`d`), en `lg:tuto` (`nvp`), así
// recargar no vuelve a festejar nada. La primera vez que un dispositivo ve la pista se SIEMBRA con lo que ya estaba hecho
// —menos lo que el objeto acaba de pagar en ese mismo pedido (`recien`)—: quien ya iba por la mitad cuando salió esto no
// recibe de golpe los festejos de días que ya pasaron. Sin almacenamiento, en memoria (dura la visita)
let MEM = null;
function memoria() {
  const T = tuto();
  const x = T ? T.nvp : MEM;
  return x && Array.isArray(x.m) && Array.isArray(x.d) ? x : null;
}
function guardarMemoria(x) {
  if (tuto()) tutoPoner({ nvp: x }); else MEM = x;
}
function sembrar(P) {
  if (memoria() || !P || P.fin) return;
  const rec = P.recien || { mis: [], dias: [] };
  guardarMemoria({
    m: P.dias.flatMap((x) => x.mis).filter((m) => m.ok && !(rec.mis || []).includes(m.id)).map((m) => m.id),
    d: P.dias.filter((x) => x.hecho && !(rec.dias || []).includes(x.n)).map((x) => x.n),
    // la Caja, aparte: se puede ganar poniéndose al día con uno de atrás, con el día 7 ya festejado
    c: !!P.caja && !rec.caja,
  });
}

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
        sembrar(j.pista);
      }
      avisar();
      // 🐉 si cobró algo nuevo, la barra de los drops se vuelve a pedir (la escucha `lg:cofre`)
      if (cuenta && antes && JSON.stringify(cobrado(antes)) !== JSON.stringify(cobrado(j))) W.dispatchEvent(new Event('lg:cofre'));
      if (cuenta && j.pista && j.pista.recien && (j.pista.recien.mis || []).length && !antes) W.dispatchEvent(new Event('lg:cofre'));
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
/** La pista que se dibuja: la del objeto (con cuenta) o la de este navegador (sin cuenta, su primera semana). `null`
 *  pasada la semana o sin pista: ahí el panel no está y el Inicio queda como siempre */
export function pistaDe(D, dc) {
  if (!D) return null;
  const P = dc ? D.pista : (enSemanaNueva() ? pistaLocal(D.plantilla) : null);
  return P && !P.fin ? P : null;
}
/** ¿Se ve el panel? Para lo que se acomoda alrededor (la fila de la racha no repite «Tus primeros 7 días») */
export function usePistaVisible(dc) {
  return !!pistaDe(useNuevo(dc, quierePista(dc)), dc);
}

/** Un premio en palabras (`NUEVO_PISTA` de bot/avisos.js) */
export function txtPremio(pr) {
  const n = pr[1];
  switch (pr[0]) {
    case 'pdt': return num(n) + ' Puntos de Tienda';
    case 'drop': return n === 1 ? '1 Dragón Drop' : n + ' Dragón Drops';
    case 'star': return n === 1 ? '1 Star Dragon' : n + ' Star Dragons';
    // 🎁 un cofre de verdad desde el 17/11/2026 (`['cofre', t]`, uno de `COFRES`); el de antes no decía cuál
    case 'cofre': return n == null ? '1 cofre' : 'un ' + (COFRES[n] || COFRES[0]);
    case 'titulo': return 'Título «' + n + '»';
    case 'redes': return '1 Star Dragon por red';
    case 'caja': return 'Caja del Nuevo';
    default: return '';
  }
}
//: el premio de una misión en su pastilla: entrar con Discord es «tu primer cofre» (Dlx, «Tus elecciones»)
const txtMision = (m) => (m.id === 'entrar' && m.premio[0] === 'cofre' ? 'Tu primer cofre · ' + (COFRES[m.premio[1]] || COFRES[1]) : txtPremio(m.premio));
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

//: 🌱 a dónde lleva cada paso de «Tus primeros 7 días» (`BIENVENIDA` de bot/avisos.js). Lo usan esta fila y la tarjeta
//: corta de panel.jsx, que sale pasada la semana de la pista
export const IR_BIEN = { seguir: '#/ranking', campana: '#/avisos', llave: '#/eventos', verificar: '#/cuenta/verificar', anotarse: '#/eventos' };

/** A dónde lleva cada misión. `el`: una pieza de la pista (de ahí sale el shadow root, para llegar a las historias) */
function irA(id, abrirRedes, el) {
  const rutas = { campana: '#/avisos', verif: '#/cuenta/verificar', perfil: '#/cuenta', sigue3: '#/ranking', fel: '#/publicaciones',
    cm: '#/publicaciones', nivel1: '#/pase', tareas2: '#/pase', cancha: '#/eventos', crew: '#/crews', encuesta: '#/publicaciones' };
  if (id === 'corto') return () => pedirRecorrido('corto');
  if (id === 'completo') return () => { location.hash = '#/guia'; setTimeout(() => W.dispatchEvent(new Event('lg:aprende')), 300); };
  if (id === 'entrar') return () => accion.entrar();
  if (id === 'redes') return abrirRedes;
  // 📸 las historias ya no son lo primero del Inicio (la pista va arriba de todo): se baja hasta su fila
  if (id === 'historia') {
    return () => {
      const r = el && el.getRootNode ? el.getRootNode() : null;
      const h = r && r.querySelector ? r.querySelector('[data-tuto="historias"]') : null;
      try { if (h) h.scrollIntoView({ behavior: 'smooth', block: 'center' }); else W.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { W.scrollTo(0, 0); }
    };
  }
  return () => { location.hash = rutas[id] || '#/'; };
}

// 🎉 lo que dice cada festejo
//: los colores del momento de un día: el magenta de la pista (el de la Funda del Campeón), y el oro de la Caja el día 7
const PAL_DIA = { c: '#E41373', b1: '#FF5A9C', b2: '#2A0313' };
const PAL_CAJA = { c: '#F5C542', b1: '#FFE07A', b2: '#7E4C00' };
const tipoDe = (pr) => (pr[0] === 'titulo' ? 'titulo' : pr[0] === 'redes' ? 'star' : pr[0]);
const itemsCaja = (C) => [{ txt: num(C.puntos) + ' Puntos de Tienda', small: 'Caja del Nuevo', tipo: 'pdt' },
  { txt: C.star + ' Star Dragons', small: 'Caja del Nuevo', tipo: 'star' }, { txt: 'Título «' + C.titulo + '»', small: 'Caja del Nuevo', tipo: 'titulo' }];
const botonesCaja = (P, el) => [{ txt: 'Abrir la Caja del Nuevo', fn: () => abrirCajaNuevo(el, P.cajaPremio) }, { txt: 'Luego' }];
/**
 * El momento de un día completo: qué ganaste (el premio del día y las misiones que cerraron con él) y qué abre mañana.
 * `conCaja`: además, la Caja del Nuevo, que este día (uno de atrás) terminó de ganar
 */
function momentoDe(x, P, mis, el, conCaja) {
  const lista = [];
  const dia7 = x.premio[0] === 'caja';
  const caja = !!(P.caja && P.cajaPremio && (dia7 || conCaja));
  if (!dia7) lista.push({ txt: txtPremio(x.premio), small: 'Premio del día', tipo: tipoDe(x.premio), t: x.premio[1] });
  mis.filter((m) => m.n === x.n).forEach((m) => lista.push({ txt: txtMision(m), small: m.t, tipo: tipoDe(m.premio), t: m.premio[1] }));
  if (caja) lista.push(...itemsCaja(P.cajaPremio));
  const hoy = Math.min(P.dia, P.de);
  const sig = P.dias[x.n];
  const nota = caja ? 'Completaste los ' + P.de + ' días: ganaste la Caja del Nuevo.'
    : sig ? (x.n >= hoy ? 'Mañana se abre el día ' + sig.n + ': ' + sig.t : 'Ya tienes abierto el día ' + sig.n + ': ' + sig.t)
      : 'Completa los días que te faltan y te llevas la Caja del Nuevo.';
  // con la Caja hay algo que elegir (abrirla ya o después): ese no se va solo
  return { sub: 'Día ' + x.n + ' de ' + P.de + ' · completo', titulo: x.t, lista, nota, botones: caja ? botonesCaja(P, el) : [{ txt: 'Seguir' }],
    pal: caja ? PAL_CAJA : PAL_DIA, dur: caja ? 0 : 6500 };
}
/** La Caja sola, si se ganó sin que se completara ningún día en este dispositivo (el día ya se había festejado en otro) */
const momentoCaja = (P, el) => ({ sub: 'Los ' + P.de + ' días · completos', titulo: 'Caja del Nuevo', lista: itemsCaja(P.cajaPremio), nota: '',
  botones: botonesCaja(P, el), pal: PAL_CAJA, dur: 0 });

/** 🐣 El rectángulo de las misiones: lo primero del Inicio durante tu primera semana */
export function PistaNuevos({ liga, dc }) {
  const D = useNuevo(dc, quierePista(dc));
  const R = useRacha(!!dc);
  const [sel, setSel] = useState(null);
  const [redes, setRedes] = useState(false);
  const [toast, setToast] = useState(null);
  const [bienMsg, setBienMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  const yo = useRef(null);
  const P = pistaDe(D, dc);
  // 🎉 lo que se cobró y este dispositivo todavía no festejó: las misiones, en un aviso corto; los días, en su momento
  // (uno detrás del otro). Se anota ANTES de mostrarlo: recargar no lo repite
  useEffect(() => {
    if (!dc || !P || !D || !D.pista) return;
    sembrar(D.pista);
    const mem = memoria();
    if (!mem) return;
    const mis = [], dias = [];
    P.dias.forEach((x) => {
      x.mis.forEach((m) => { if (m.ok && !mem.m.includes(m.id)) mis.push(Object.assign({ n: x.n }, m)); });
      if (x.hecho && !mem.d.includes(x.n)) dias.push(x);
    });
    const cajaNueva = !!(P.caja && P.cajaPremio && !mem.c);
    if (!mis.length && !dias.length && !cajaNueva) return;
    guardarMemoria({ m: mem.m.concat(mis.map((m) => m.id)), d: mem.d.concat(dias.map((x) => x.n)), c: !!(mem.c || P.caja) });
    // las misiones de un día que se completó van en su momento; las otras, en el aviso
    const enDia = new Set(dias.map((x) => x.n));
    const sueltas = mis.filter((m) => !enDia.has(m.n));
    if (sueltas.length) setToast({ k: Date.now(), mis: sueltas });
    const el = yo.current;
    // la Caja va en el momento del último día que se festeja (si es el 7 ya la trae), o sola
    const cola = dias.map((x, j) => momentoDe(x, P, mis, el, cajaNueva && j === dias.length - 1));
    if (cajaNueva && !dias.length) cola.push(momentoCaja(P, el));
    (async () => {
      for (const m of cola) {
        try { await abrirMomento(el, m); } catch (e) { /* sin escenario: queda el aviso */ }
      }
    })();
  }, [D]); // eslint-disable-line react-hooks/exhaustive-deps
  // el aviso se va solo (≈4 s)
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  if (!P) return null;
  const caja = dc ? D.pista.cajaPremio : D.caja;
  const hoy = Math.min(P.dia, P.de) - 1;
  const i = sel == null ? hoy : sel;
  const d = P.dias[i];
  const quedan = DIAS_PISTA - hoy;
  const ya = P.dias.filter((x) => x.hecho).length;
  // la línea que une los niveles se llena hasta hoy
  const lleno = P.de > 1 ? (100 * hoy) / (P.de - 1) : 0;
  // 🔒 las que piden verificarse (`NUEVO_VERIF`), si no lo estás. Sin cuenta, todas las de la lista
  const VER = new Set(D.verif || []);
  const verificado = !!(dc && P.v);
  const traba = (m) => !m.ok && VER.has(m.id) && !verificado;
  // 🌱 «Tus primeros 7 días»: una fila de hoy (Dlx, «Tus elecciones»: el mismo botón y el mismo premio que tenía)
  const B = dc && R ? R.bienvenida : null;
  const bPaso = B && (B.pasos || [])[B.paso];
  const cobrarBien = async () => {
    setOcup(true); setBienMsg('');
    const r = await cobrarRacha('bienvenida').catch(() => null);
    if (r && r.cobrado) setToast({ k: Date.now(), txt: '+' + num(r.cobrado) + ' Puntos de Tienda', sub: 'Tus primeros 7 días' });
    else setBienMsg(r && r.error === 'manana' ? 'Uno por día: vuelve mañana.' : r && r.error === 'falta' && bPaso ? 'Primero: ' + bPaso[2].toLowerCase() + '.' : 'No se pudo: prueba de nuevo.');
    setOcup(false);
  };
  const cofreEn = toast && toast.mis ? toast.mis.find((m) => m.premio[0] === 'cofre') : null;
  return (
    <section className="nvp" aria-labelledby="nvp-t" ref={yo}>
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
        {/* 🎁 ganada, la Caja se abre como un cofre (17/11/2026): lo que pagó, destapado con la animación de los cofres */}
        {dc && P.caja ? (
          <button type="button" className="nvp-caja hecho" onClick={() => abrirCajaNuevo(yo.current, caja)}
            aria-label={'Abrir la Caja del Nuevo: ' + num(caja.puntos) + ' Puntos de Tienda, ' + caja.star + ' Star Dragons y el título «' + caja.titulo + '»'}>
            <span className="nvp-cj" aria-hidden="true"><Ico n="premio" t={22} /></span><b>Caja del Nuevo</b><small>Ábrela</small>
          </button>
        ) : (
          <span className={'nvp-caja' + (ya === P.de ? ' hecho' : '')} title={caja ? num(caja.puntos) + ' Puntos de Tienda, ' + caja.star + ' Star Dragons y el título «' + caja.titulo + '»' : ''}>
            <span className="nvp-cj" aria-hidden="true"><Ico n="premio" t={22} /></span><b>Caja del Nuevo</b><small>{ya} de {P.de} días</small>
          </span>
        )}
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
        <ul className={'nvp-ms n' + d.mis.length}>
          {d.mis.map((m) => (
            <li key={m.id} className={(m.ok ? 'ok' : '') + (traba(m) ? ' traba' : '')}>
              <span className="nvp-ck" aria-hidden="true">{m.ok ? <Ico n="ok" t={14} /> : traba(m) ? <Ico n="candado" t={12} /> : null}</span>
              <span className="nvp-mt"><b>{m.t}</b>
                <span className={'nvp-pr ' + CLASE[m.premio[0]] + (!dc || !d.abierto ? ' lock' : '')}>
                  {!dc || !d.abierto ? <Ico n="candado" t={11} /> : null}{txtMision(m)}</span></span>
              {m.ok ? <span className="nvp-ya">Hecho</span>
                : !d.abierto ? <span className="nvp-ya">Día {d.n}</span>
                  : traba(m) ? <a className="nvp-ir nvp-lockb" href="#/cuenta/verificar" aria-label={m.t + ': se abre al verificarte'}><Ico n="candado" t={12} />Al verificarte</a>
                    : <button type="button" className="nvp-ir" onClick={irA(m.id, () => setRedes(true), yo.current)}>{m.id === 'entrar' ? 'Entrar' : 'Ir'}</button>}
            </li>
          ))}
        </ul>
        {i === hoy && bPaso ? (
          <div className="nvp-bien">
            <span className="nvp-bien-ic" aria-hidden="true"><Ico n="premio" t={18} /><b>{B.paso + 1}<small>/7</small></b></span>
            <span className="nvp-mt"><b>Tus primeros 7 días</b>
              <span className="nvp-bien-tx">{B.hoy ? 'Ya cobraste el de hoy: mañana viene el que sigue.' : B.hecha ? 'Listo: cobra ' + num(bPaso[0]) + ' Puntos de Tienda.'
                : 'Hoy: ' + bPaso[2].toLowerCase() + ' y cobras ' + num(bPaso[0]) + '.'}</span>
              {bienMsg ? <small className="nvp-bien-msg" role="status">{bienMsg}</small> : null}</span>
            {B.hoy ? <span className="nvp-ya">Hecho hoy</span>
              : B.hecha ? <button type="button" className="nvp-ir" disabled={ocup} onClick={cobrarBien}>{ocup ? '…' : 'Cobrar ' + num(bPaso[0])}</button>
                : IR_BIEN[bPaso[1]] ? <a className="nvp-ir" href={IR_BIEN[bPaso[1]]}>Ir</a> : null}
          </div>
        ) : null}
      </div>
      {toast ? (
        <div className="nvt" role="status" key={toast.k}>
          <span className="nvt-ic" aria-hidden="true"><Ico n={toast.mis ? 'ok' : 'moneda'} t={18} /></span>
          <span className="nvt-tx">
            {toast.mis ? <>
              <b>{toast.mis.length === 1 ? '¡Misión cumplida!' : '¡' + toast.mis.length + ' misiones cumplidas!'}</b>
              {toast.mis.slice(0, 3).map((m) => <small key={m.id}><em>{txtMision(m)}</em> · {m.t}</small>)}
            </> : <><b>{toast.txt}</b><small>{toast.sub}</small></>}
          </span>
          {cofreEn ? <button type="button" className="nvt-b" onClick={() => { setToast(null); abrirOrigen(yo.current, 'cofre5:' + cofreEn.premio[1] + ':nuevo:m:' + cofreEn.id); }}>Abrir</button> : null}
          <button type="button" className="nvt-x" aria-label="Cerrar" onClick={() => setToast(null)}><Ico n="cerrar" t={14} /></button>
        </div>
      ) : null}
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
