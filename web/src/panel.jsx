// ── 🎛️ EL PANEL NUEVO DEL INICIO (Dlx, 12/11/2026, en vivo conmigo y con la maqueta
// https://claude.ai/artifact/3QYBFKti9isEEnbn9SjgRD; a construirlo, «Yes, start»). Lo que pidió, en sus palabras:
//   · «en el panel ser más visual» y «asegúrate que el PANEL sea simétrico»: cada pieza con su par, del mismo ancho;
//   · la fila del nombre y los Puntos se fue («¿para qué serviría esa línea ahora?»);
//   · la racha y la campana, chicas, y «una vez que la campana esté activa, que no aparezca»: la racha ocupa la fila;
//   · el VS «con el estilo del inicio original», con «un porcentaje de ganar», y tus próximas batallas: una a la vista y
//     las demás en un pop-up («no que se agrande el panel»);
//   · «BATALLAR, o sea buscar rival… de momento será simulación»: sale alguien al azar y eliges la hora;
//   · en el centro, tus tarjetas, con los rankings «a los costados» (Temporada, Competitivo, ELO, País, tu servidor y tu
//     crew), lo último que te dijeron en Publicaciones con «Responder» y tu último evento al lado, que lleva a ese evento;
//   · en vez de Ranking, la Crew («ranking está arriba y es muy relevante»); Se busca entra en Misiones como carteles;
//   · el Pase, decorativo; y cada panel con su material y un solo color («mejora los otros paneles algo así»);
//   · Eventos: «los eventos generales en las barras vs los que tú participaste»;
//   · Tienda y La semana, en la misma línea.
// ⚠️ SIN DEGRADÉS: cada panel lleva su color en un fondo teñido y un borde (la regla del remake), no en un degradé.
// ⚠️ Los comentarios de los personajes de la Liga son BOTS y lo dicen (`bot`): Dlx, «Liga characters as bots yeah».
import { useEffect, useMemo, useRef, useState } from 'react';
import { limpio, num, siglaDe, srcLogo, utc } from './liga.js';
import { Bandera, Cara, Ico, accion, nombrePais, useCampana } from './piezas.jsx';
import { urlFondo, useFondos } from './fondos.js';
import { Escudo, escudoDe } from './escudo.jsx';
import { avance, pasePost, usePase } from './pase.js';
import { cuantosNuevos } from './inv_nuevos.js';
import { cobrarRacha } from './racha.js';
import { dondeEstoy, faltaTxt, nombreDe, useCompetencias } from './competencias_datos.js';
import { eventoDelBoton } from './arriba.jsx';
import { ERR_LIBRE, LB, libreAccion, useLibres } from './libres.js';
import { svElegido, useElegidos } from './elegidos.js';
import { pedirLigas } from './ligas_datos.js';
import { BarraDia } from './drops.jsx';
import { Elegido, Opinion, X2 } from './encuestas.jsx';
import { PopCab } from './pop.jsx';
import { delHilo, useComentarios } from './comentarios.jsx';
import { conCrewsVivas, useCrews } from './crews.js';

const W = typeof window !== 'undefined' ? window : {};
const ET = 'America/New_York';
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const guardar = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIA_MS = 86400000;
// el lunes 00:00 de esta semana, en la hora de quien mira
function lunes(ahora) {
  const d = new Date(ahora);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
// «hoy 11 AM», «vie 6 PM», en la hora del este (la de la Liga)
function cuando(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const hoy = new Date().toLocaleDateString('en', { timeZone: ET }) === d.toLocaleDateString('en', { timeZone: ET });
  const h = d.toLocaleTimeString('en', { timeZone: ET, hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  return (hoy ? 'hoy' : d.toLocaleDateString('es', { timeZone: ET, weekday: 'short' }).replace('.', '')) + ' ' + h;
}
const quieto = () => { try { return W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

// ── 🔔 la campana chica: sólo si este teléfono la puede tener y todavía no está activa (y vinculada, con cuenta) ──
export function campanaPide(c, dc) {
  if (!c || !W.Campana || !c.soporta || c.negado || (c.ios && !c.instalada) || c.pausada) return false;
  if (!c.activa) return true;
  return !!dc && !(c.yo && c.yo.id);
}
function CampanaCorta({ dc }) {
  const c = useCampana();
  if (!campanaPide(c, dc)) return null;
  const paso2 = !!c.activa;
  return (
    <section className="pn-camp">
      <span className="pn-camp-ic"><Ico n="campana" t={20} /></span>
      <span className="pn-tx"><b>{paso2 ? 'Falta un paso' : 'Activa la campana'}</b>
        <small>{paso2 ? 'Vincula este teléfono con tu Discord: te llegan los tuyos' : 'Te avisa al minuto de cada evento. Nunca por DM'}</small></span>
      <button type="button" className="btn verde chico" onClick={() => (paso2 ? W.Campana.vincular() : W.Campana.activar())}>{paso2 ? 'Vincular' : 'Activar'}</button>
    </section>
  );
}

// ── 🔥 la racha, chica: los siete días de la semana, cuántos llevas y cobrar el de hoy (los números, de avisos.js) ──
function RachaCorta({ R, sola }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  if (!R) return null;
  if (R.bienvenida) return <BienvenidaCorta B={R.bienvenida} />;
  const r = R.racha || {};
  const ps = R.premios || [];
  const actual = r.actual || 0;
  const hoy = ps.find((x) => x[0] === R.hoy);
  const cobrar = async () => {
    setOcup(true); setMsg('');
    const d = await cobrarRacha('dia').catch(() => null);
    setMsg(d && d.cobrado ? '+' + num(d.cobrado) + ' Puntos' : 'No se pudo');
    setOcup(false);
  };
  return (
    <section className="pn-racha" aria-label="Tu racha">
      <span className="pn-fuego"><Ico n="fuego" t={22} />{actual}</span>
      <span className="pn-tx"><b>{actual === 1 ? '1 día seguido' : actual + ' días seguidos'}</b>
        {ps.length ? <span className="pn-dias" aria-hidden="true">{ps.map(([d, , cobrado], i) => <i key={d} title={LETRAS[i]} className={(cobrado ? 'si' : '') + (d === R.hoy ? ' hoy' : '')} />)}</span> : null}
        {/* 🔥 más cosas en la racha (Dlx, 12/11/2026): el próximo premio, siempre, y si te queda el día de perdón */}
        {R.hito || r.gracia ? <small className="pn-rsub">{R.hito ? 'Día ' + R.hito[0] + ': +' + num(R.hito[1]) : ''}
          {R.hito && r.gracia ? ' · ' : ''}{r.gracia ? 'perdón libre' : ''}</small> : null}</span>
      {r.maxima ? <span className="pn-rnum"><small>Tu mejor</small><b>{r.maxima}</b></span> : null}
      {hoy && hoy[3] ? <button type="button" className="btn verde chico" disabled={ocup} onClick={cobrar}>{ocup ? '…' : 'Cobrar ' + num(hoy[1])}</button>
        : msg ? <small className="pn-ok" role="status">{msg}</small> : null}
    </section>
  );
}
// 🌱 los primeros 7 días de quien recién llega, chicos, en el lugar de la racha
const IR_PASO = { seguir: '#/ranking', campana: '#/avisos', llave: '#/eventos', verificar: '#/cuenta/verificar', anotarse: '#/eventos' };
function BienvenidaCorta({ B }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const pasos = B.pasos || [];
  const ahora = pasos[B.paso];
  if (!ahora) return null;
  const cobrar = async () => {
    setOcup(true); setMsg('');
    const d = await cobrarRacha('bienvenida').catch(() => null);
    setMsg(d && d.cobrado ? '+' + num(d.cobrado) + ' Puntos' : d && d.error === 'manana' ? 'Mañana el que sigue' : 'No se pudo');
    setOcup(false);
  };
  return (
    <section className="pn-racha bien" aria-label="Tus primeros 7 días">
      <span className="pn-fuego"><Ico n="premio" t={22} />{B.paso + 1}<small>/7</small></span>
      <span className="pn-tx"><b>Tus primeros 7 días</b>
        <small>{B.hoy ? 'Mañana viene el que sigue' : 'Hoy: ' + ahora[2].toLowerCase() + ' · +' + num(ahora[0])}</small></span>
      {!B.hoy && B.hecha ? <button type="button" className="btn verde chico" disabled={ocup} onClick={cobrar}>{ocup ? '…' : 'Cobrar ' + num(ahora[0])}</button>
        : !B.hoy && IR_PASO[ahora[1]] ? <a className="btn verde chico" href={IR_PASO[ahora[1]]}>Ir</a> : msg ? <small className="pn-ok">{msg}</small> : null}
    </section>
  );
}

// 🎉 el festejo de la racha a los 7 y a los 30 días, una vez por racha (lo que hacía tu barra)
function Festejo({ R }) {
  const [fest, setFest] = useState(null);
  const actual = R && R.racha ? R.racha.actual || 0 : 0;
  const inicio = R && R.racha ? R.racha.inicio || '' : '';
  useEffect(() => {
    const hito = actual >= 30 ? 30 : actual >= 7 ? 7 : 0;
    if (!hito || !inicio) return;
    const ya = leer('lg:racha-fest') || {};
    if (ya[hito] === inicio) return;
    setFest(hito);
    guardar('lg:racha-fest', Object.assign({}, ya, { [hito]: inicio }));
  }, [actual, inicio]);
  if (!fest) return null;
  return (
    <button type="button" className="lb-fest" onClick={() => setFest(null)}>
      <Ico n="fuego" t={26} /><span><b>¡{fest} DÍAS SEGUIDOS!</b><small>Tu racha llegó a {fest}. Toca para seguir.</small></span>
    </button>
  );
}

// 🎁 PREMIO GRATIS (12/11/2026, Dlx: «un 4to cuadro encima de todo al costado de racha y llave… un cuadrado de premio
// gratis o algo así que llame la atención, donde pedimos simplemente tareas, así como votar encuestas»).
// 🗳️ DESDE EL 13/11/2026, SÓLO LAS ENCUESTAS Y UNA VEZ POR SEMANA (Dlx: «que aparezca una vez por semana, que eso de cosas
// más rápidas desaparezca… sólo eso de la encuesta. También podrías añadir otra encuesta de qué te parece la página»): el
// cuadro sale mientras haya una encuesta de la semana sin votar —el ×2, El Elegido y «¿Qué te parece la página?»— y se va
// cuando votaste las tres, hasta las de la semana que viene. Lo de la barra del día (felicitar, comentar, la Tarea del
// Pase) y los drops para abrir siguen en su cuadro, `BarraDia`. Votar el ×2 y El Elegido sigue dando el cofre
/** Las encuestas de la semana para el cuadro: las que hay y las que te faltan. Sin saber todavía tus votos (`enc`), ninguna:
 *  el cuadro aparece cuando se sabe, en vez de aparecer y desaparecer */
function encuestasDeLaSemana(liga, enc) {
  const x2 = liga.encuesta('x2');
  const el = liga.encuesta('elegido');
  const pg = liga.encuesta('pagina');
  const todas = [x2, el, pg].filter(Boolean);
  const faltan = enc ? todas.filter((E) => !enc.mio[E.id]) : [];
  return { x2, el, pg, cofre: [x2, el].filter(Boolean), faltan };
}
function PremioGratis({ liga, enc, dc }) {
  const dlg = useRef(null);
  // 👤 sin cuenta (Dlx, 12/11/2026, mirando el Inicio de alguien nuevo: «hay botones que desaparecen»): lo que de verdad te
  // dan al entrar, los Puntos de Tienda de arranque (`liga.d.tienda.inicial`, de bot/precios.py)
  if (!dc) {
    const ini = (liga.d.tienda || {}).inicial;
    return (
      <button type="button" className="pn-gratis" onClick={accion.entrar} aria-label="Premio gratis: entra con Discord">
        <span className="pn-gr-ic" aria-hidden="true"><Ico n="premio" t={22} /></span>
        <span className="pn-tx"><i className="pn-gr-et">Premio gratis</i><b>{ini ? num(ini) + ' Puntos de Tienda' : 'Tu Pase y tus drops'}</b>
          <small>{ini ? 'Para empezar: entra con Discord' : 'Entra con Discord y empieza a sumar'}</small></span>
      </button>
    );
  }
  const S = encuestasDeLaSemana(liga, enc);
  if (!S.faltan.length) return null;
  const { x2, el, pg, cofre, faltan } = S;
  const x = x2 ? String(x2.x || 2).replace('.', ',') : '';
  const sinCofre = cofre.filter((E) => faltan.includes(E));
  const tit = faltan[0] === x2 ? 'Vota quién se lleva el ×' + x : faltan[0] === el ? 'Vota a El Elegido' : '¿Qué te parece la página?';
  const sub = sinCofre.length ? (cofre.length > 1 ? 'Vota las ' + cofre.length + ' de la semana y te llevas un cofre' : 'Vótala y te llevas un cofre')
    : 'Tu opinión, en un toque';
  const hasta = (faltan[0] || {}).hasta;
  const cerrar = () => dlg.current && dlg.current.close();
  return (
    <>
      <button type="button" id="encuestas" className="pn-gratis hacer" onClick={() => dlg.current && dlg.current.showModal()}
        aria-label={'Premio gratis: ' + tit + '. ' + sub}>
        <span className="pn-gr-ic" aria-hidden="true"><Ico n="premio" t={22} /><em>{faltan.length}</em></span>
        <span className="pn-tx"><i className="pn-gr-et">Premio gratis</i><b>{tit}</b><small>{sub}</small></span>
      </button>
      <dialog className="pn-pop pop-gratis" ref={dlg} aria-label="Premio gratis" onClick={(e) => { if (e.target === dlg.current) cerrar(); }}>
        <PopCab ico="premio" t="Premio gratis" sub={'Las encuestas de la semana' + (hasta ? ' · cierran ' + liga.dia(hasta) : '')} cerrar={cerrar} />
        <div className="pn-est-in">
          {cofre.length ? <>
            <h5>Las encuestas de la semana {sinCofre.length ? <span className="pop-gr-cofre">{cofre.length > 1 ? 'vótalas todas' : 'vótala'}: un cofre</span>
              : <span className="pop-gr-ok">✓ {cofre.length > 1 ? 'votaste las ' + cofre.length : 'ya votaste'}</span>}</h5>
            <div className={'en-g' + (x2 && el ? ' dos' : '')}>
              {x2 ? <X2 liga={liga} enc={enc} E={x2} corta /> : null}
              {el ? <Elegido liga={liga} enc={enc} E={el} corta /> : null}
            </div>
          </> : null}
          {pg ? <><h5>Y tu opinión</h5><Opinion liga={liga} enc={enc} E={pg} /></> : null}
        </div>
      </dialog>
    </>
  );
}

/** La fila de arriba: la racha y la campana, o la racha sola a lo ancho; sin cuenta, la invitación */
// 🐉 LA FILA DE ARRIBA, DE A TRES (12/11/2026, la opción A de la maqueta; Dlx: «uno que activa la campana… sería para todos
// hasta que la activen; si la activan, aparecería en vez el último evento»): la racha, la campana o tu último evento, y la
// barra del día de los Dragón Drops. Sin cuenta, entrar y la campana
// 🔢 SIEMPRE CUATRO (Dlx, 13/11/2026: «en este caso hay sorteo… que el 4to cuadrado sea el del sorteo para participar…
// recuerda siempre son 4 mini paneles, no 3… si no hay premio semanal o sorteo, debería aparecer el de último anuncio de
// cualquier servidor»). Con las encuestas votadas el Premio gratis se iba y la fila quedaba de a tres. Ahora los dos
// lugares que pueden quedar libres —el 2.º si no hay campana ni último evento, y el 4.º— se llenan en este orden:
// el sorteo abierto en el que todavía no entraste · el Premio gratis (las encuestas) · el sorteo que ya cerró o en el que
// ya estás (cuándo se sortea, quién ganó) · el último anuncio de un servidor
export function FilaRacha({ dc, R, liga, enc }) {
  const c = useCampana();
  const camp = campanaPide(c, dc);
  const ult = dc && !camp && liga && liga.yo ? ultimoDe(liga, liga.yo) : null;
  const [S, setS] = useSorteo(dc);
  const [recien, setRecien] = useState(false);
  // 🔥 la racha llega como `null` mientras viene y también si falló: a los 4 s sin ella, su lugar lo toma el que sigue
  const [sinRacha, setSinRacha] = useState(false);
  useEffect(() => {
    if (!dc || R) { setSinRacha(false); return undefined; }
    const t = setTimeout(() => setSinRacha(true), 4000);
    return () => clearTimeout(t);
  }, [!!dc, !!R]); // eslint-disable-line react-hooks/exhaustive-deps
  const ahora = Date.now();
  const s = S && S.sorteo;
  const soAbierto = !!(s && ahora < s.cierra);
  // hasta un día después de sortearse, para que se vea quién ganó
  const resT = S && S.resultado ? Number(S.resultado.t) || Date.parse(S.resultado.t) || 0 : 0;
  const soVer = !!(s && (soAbierto || ahora < s.cuando + 86400000 || (resT && ahora < resT + 86400000)));
  const gratis = dc ? encuestasDeLaSemana(liga, enc).faltan.length > 0 : false;
  const an = anuncioDeServidor(liga);
  const extras = [];
  if (soAbierto && (!S.mio || recien)) extras.push('sorteo');
  if (gratis) extras.push('gratis');
  if (soVer && !extras.includes('sorteo')) extras.push('sorteo');
  if (an) extras.push('anuncio');
  // 🗓️ y si todavía falta uno —sin cuenta y sin sorteo quedaban tres—, el próximo evento de la Liga, con su inscripción
  const prox = liga ? liga.luego()[0] || null : null;
  if (prox) extras.push('proximo');
  // ✖️ y el que no falta nunca: el multiplicador más alto de la semana (a las 4 AM no hay eventos anunciados)
  const mm = liga ? (liga.d.mult || {}) : {};
  const mx = Object.entries(mm.sv || {}).sort((p, q) => q[1] - p[1])[0];
  if (mx && mx[1] > 1) extras.push('semana');
  // el 1.º: tu racha; mientras viene, su lugar guardado (así no salta), y si no llega, el que sigue de la lista
  const primero = !dc ? 'invita' : R ? 'racha' : sinRacha ? extras.shift() || null : 'espera';
  const segundo = camp ? 'campana' : ult ? 'ultimo' : extras.shift() || null;
  const cuarto = extras.shift() || null;
  const pinta = (q) => (q === 'campana' ? <CampanaCorta key="c" dc={dc} /> : q === 'ultimo' ? <UltCorto key="u" liga={liga} u={ult} />
    : q === 'gratis' ? <PremioGratis key="g" liga={liga} enc={enc} dc={dc} />
      : q === 'sorteo' ? <SorteoCorto key="s" liga={liga} dc={dc} S={S} entro={(d) => { setRecien(true); setS(d); }} />
        : q === 'anuncio' ? <AnuncioCorto key="a" liga={liga} a={an} />
          : q === 'proximo' ? <AnuncioCorto key="p" liga={liga} a={{ sv: prox.sv, tit: limpio(prox.nombre), t: utc(liga.cuandoDe(prox)).toISOString(),
            link: prox.ins || prox.link || '', et: 'Próximo evento', ins: !!prox.ins }} />
            : q === 'semana' ? <AnuncioCorto key="w" liga={liga} a={{ sv: mx[0], et: 'Esta semana', link: '#/sv/' + encodeURIComponent(mx[0]),
              tit: 'Sus eventos, ×' + String(mx[1]).replace('.', ','),
              sub: (mx[1] === 2 ? 'Valen el doble' : mx[1] === 3 ? 'Valen el triple' : 'Valen más') + (mm.fin ? ' · quedan ' + faltaTxt(mm.fin) : ' hasta el lunes') }} /> : null);
  // Sin cuenta, el 3.º es el Premio gratis de entrar (los Puntos de Tienda de arranque)
  const n = (primero ? 1 : 0) + (segundo ? 1 : 0) + 1 + (cuarto ? 1 : 0);
  return (
    <>
      <Festejo R={R} />
      <div className={'pn-fila' + (n === 4 ? ' tres cuatro' : n === 3 ? ' tres' : n === 1 ? ' sola' : ' dos')}>
        {primero === 'racha' ? <RachaCorta R={R} sola={n === 1} />
          : primero === 'espera' ? (
            <section className="pn-racha espera" aria-busy="true">
              <span className="pn-tx"><b>Tu racha</b><small>Un momento…</small></span>
            </section>
          ) : primero === 'invita' ? (
            <section className="pn-racha invita">
              <span className="pn-tx"><b>¿Juegas en la Liga?</b><small>Entra con Discord: tu racha, tus tarjetas y tu Pase</small></span>
              <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar</button>
            </section>
          ) : pinta(primero)}
        {pinta(segundo)}
        {dc ? <BarraDia dc={dc} /> : <PremioGratis liga={liga} enc={enc} dc={dc} />}
        {pinta(cuarto)}
      </div>
    </>
  );
}

// 🎟️ EL SORTEO DEL PASE PREMIUM, PARA EL CUADRO: lo que programó Dlx en el Dashboard (`sorteoDe()` de bot/avisos.js, lo
// mismo que la página del Pase). Se pide una vez cada 10 minutos por pestaña (`lg:sorteo-ini`): cada pedido despierta al
// objeto, y el Inicio se abre seguido
const SORTEO_MS = 10 * 60000;
function sorteoGuardado(id) {
  try {
    const x = JSON.parse(sessionStorage.getItem('lg:sorteo-ini') || 'null');
    return x && x.id === id && Date.now() - x.t < SORTEO_MS ? x.d : undefined;
  } catch (e) { return undefined; }
}
function useSorteo(dc) {
  const id = dc && dc.id ? String(dc.id) : '';
  const [S, setS] = useState(() => sorteoGuardado(id));
  const guardar = (v) => {
    try { sessionStorage.setItem('lg:sorteo-ini', JSON.stringify({ id, t: Date.now(), d: v })); } catch (e) { /* igual */ }
    setS(v);
  };
  useEffect(() => {
    const ya = sorteoGuardado(id);
    if (ya !== undefined) { setS(ya); return undefined; }
    let vivo = true;
    pasePost('sorteo', {}).then((d) => {
      if (!vivo) return;
      guardar(d && d.sorteo ? { sorteo: d.sorteo, mio: d.mio || 0, resultado: d.resultado || null } : null);
    });
    return () => { vivo = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return [S || null, (d) => guardar(d && d.sorteo ? { sorteo: d.sorteo, mio: d.mio || 0, resultado: d.resultado || null } : S)];
}
function SorteoCorto({ liga, dc, S, entro }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const s = S.sorteo;
  const res = S.resultado;
  const ahora = Date.now();
  const abierto = ahora < s.cierra;
  const iso = (ms) => new Date(ms).toISOString();
  const nombre = (k) => (liga.T && liga.T[k] ? limpio(liga.T[k].n) : k);
  const entrar = async () => {
    if (!dc) { accion.entrar(); return; }
    setOcup(true); setMsg('');
    const d = await pasePost('sorteo-entrar', {});
    if (d && d._ok) entro(d);
    else setMsg(d && d.error === 'miembro' ? 'Es de los miembros de DRA: verifícate' : d && d.error === 'cerrado' ? 'Ya cerró' : 'No se pudo: prueba de nuevo');
    setOcup(false);
  };
  const puedeEntrar = abierto && !S.mio;
  const tit = res ? 'Ganó ' + nombre(res.k) : S.mio ? 'Estás adentro con ' + S.mio + (S.mio === 1 ? ' boleto' : ' boletos')
    : abierto ? 'Entra gratis al sorteo' : 'Se sortea en ' + faltaTxt(iso(s.cuando));
  const sub = msg || (res ? 'El sorteo del Pase premium · míralo en el Pase'
    : puedeEntrar ? 'Pase premium · cierra en ' + faltaTxt(iso(s.cierra))
      : abierto ? 'Se sortea en ' + faltaTxt(iso(s.cuando)) + ', en vivo en el Pase'
        : num(s.personas || 0) + (s.personas === 1 ? ' entró' : ' entraron') + ' · en vivo en el Pase');
  const props = { className: 'pn-gratis pn-srt' + (puedeEntrar ? ' hacer' : ' listo'), 'aria-label': 'Sorteo: ' + tit + '. ' + sub };
  const cuerpo = (
    <>
      <span className="pn-gr-ic" aria-hidden="true"><Ico n="pase" t={22} /></span>
      <span className="pn-tx"><i className="pn-gr-et">Sorteo{puedeEntrar ? ' · gratis' : ''}</i><b>{ocup ? '…' : tit}</b><small>{sub}</small></span>
    </>
  );
  return puedeEntrar ? <button type="button" {...props} disabled={ocup} onClick={entrar}>{cuerpo}</button>
    : <a {...props} href="#/pase">{cuerpo}</a>;
}

// 📢 EL ÚLTIMO ANUNCIO DE UN SERVIDOR, PARA EL CUADRO: el más nuevo de los canales de anuncios de los socios (`oficiales`
// del payload); si ése es el que ya muestra «Último anuncio oficial» más abajo, el que le sigue. Sin ninguno, el último
// anuncio de un evento
function anuncioDeServidor(liga) {
  if (!liga) return null;
  const of = (Array.isArray(liga.d.oficiales) ? liga.d.oficiales : []).filter((o) => o && o.t && o.tit && o.sv)
    .map((o) => ({ sv: o.sv, tit: limpio(o.tit).slice(0, 80), t: utc(o.t).toISOString(), link: o.link || '' }))
    .sort((a, b) => new Date(b.t) - new Date(a.t));
  const yaArriba = anuncioOficial(liga);
  const a = of.find((o) => !(yaArriba && o.link && o.link === yaArriba.link && o.t === yaArriba.t)) || null;
  if (a) return a;
  const ua = ultimoAnuncio(liga);
  return ua ? { sv: ua.sv, tit: limpio(ua.nombre), t: ua.t, link: ua.link, ev: true } : null;
}
function AnuncioCorto({ liga, a }) {
  const fut = a.t ? new Date(a.t).getTime() > Date.now() : false;
  const afuera = /^https?:/.test(a.link || '');
  return (
    <a className="pn-anc" href={a.link || '#/publicaciones'} target={afuera ? '_blank' : undefined} rel={afuera ? 'noopener noreferrer' : undefined}>
      {(a.sv && liga.logo(a.sv)) ? <img className="pn-anc-logo" alt="" src={liga.logo(a.sv)} /> : <span className="pn-anc-logo"><Ico n="publicaciones" t={20} /></span>}
      <span className="pn-tx"><i className="pn-anc-et">{a.et || 'Último anuncio'} · {a.sv ? siglaDe(a.sv) : 'La Liga'}</i><b>{a.tit}</b>
        <small>{a.sub || (fut ? 'en ' + faltaTxt(a.t) : 'hace ' + hace(new Date(a.t).getTime()))}{a.ins ? ' · inscríbete' : ''}</small></span>
    </a>
  );
}

/** Tu último evento: el más nuevo de las llaves que viajan, o el de tu fila (`ult` y el número de tu perfil, `ue`) */
function ultimoDe(liga, yo) {
  const u = (liga.semanaDe(yo.k) || [])[0] || null;
  if (u) return { ll: u[0], t: utc(liga.fechaLlave(u[0])), ronda: u[1], pts: Number(u[2]) || 0 };
  if (Array.isArray(yo.ult) && yo.ult[0]) {
    const n = (yo.ue && yo.ue[0]) || 0;
    return { ll: { n, nombre: n ? 'la llave #' + n : 'tu último evento' }, t: utc(yo.ult[0] + 'T23:00:00Z'), ronda: yo.ult[1] };
  }
  return null;
}
function UltCorto({ liga, u }) {
  const f = new Date(u.t);
  // ⚔️ cómo te fue en esa llave (Dlx, 12/11/2026: «poner más cosas… la llave»): ganadas, perdidas y los puntos
  const c = u.ll.rondas ? liga.crucesDe(liga.yo.k, { ll: u.ll }) : null;
  return (
    <button type="button" className="pn-ultc" onClick={() => (u.ll.n ? accion.llave(u.ll.n) : (location.hash = '#/r/' + encodeURIComponent(liga.yo.k)))}>
      <span className="pn-cal"><i>{f.toLocaleDateString('es', { weekday: 'short' }).replace('.', '')}</i><b>{f.getDate()}</b></span>
      <span className="pn-tx"><b>{limpio(u.ll.nombre)}</b><small>Tu último evento{u.ronda ? ' · ' + u.ronda : ''}{u.pts ? ' · +' + num(u.pts) + ' pts' : ''}</small>
        {c && c.fuerte ? <small className="pn-ultc-r"><span>Más fuerte: {c.fuerte.n}</span><i>#{c.fuerte.pos}</i></small> : null}</span>
      {c && c.g + c.p ? <span className="pn-gp" aria-label={c.g + ' ganadas, ' + c.p + ' perdidas'}><b className="g">{c.g}</b><i>G</i><b className="p">{c.p}</b><i>P</i></span> : null}
    </button>
  );
}

// ── 🗓️⚔️ SIN BATALLAS: TU PRÓXIMO EVENTO Y UN RIVAL DE TU NIVEL (Dlx, 12/11/2026: «me gusta eso de 1 y 2») ──────────
// A la izquierda, el próximo evento con su cuenta atrás y el botón para inscribirte: SIEMPRE, aunque el botón grande de
// arriba muestre el mismo (Dlx, 12/11/2026: «que salga siempre el próximo evento aunque se repita»; la 4.72 mostraba el
// siguiente y, sin otro, nada). Es el mismo que elige el botón grande (`eventoDelBoton()`: el tuyo, el de tu servidor),
// y sin ninguno anunciado, «Todavía no anunciaron» con el calendario. A la derecha, el que tienes justo arriba en la Temporada (o el que te sigue, si eres el #1), con cuántos puntos te
// separan, el cara a cara y «Retar», que abre las horas de la batalla libre
// 📣 EL ÚLTIMO ANUNCIO DE LA LIGA (Dlx, 12/11/2026: «en vez de lo que viene que sea último anuncio… cualquier anuncio de
// cualquier servidor de la Liga, pero el más reciente»): el de número de mensaje de Discord más alto —crece con el tiempo—
// entre los próximos (los del vigía incluidos) y el calendario. Sin ninguno con número, el próximo evento, como antes
const idMsg = (u) => { const m = /\/(\d{15,22})\/?$/.exec(String(u || '')); return m ? m[1] : ''; };
const masNuevo = (a, b) => (a.length !== b.length ? a.length > b.length : a > b);
function ultimoAnuncio(liga) {
  let mejor = null, mid = '';
  const ver = (id, x) => { if (id && (!mejor || masNuevo(id, mid))) { mejor = x; mid = id; } };
  for (const e of liga.proximos()) if (!liga.esCancelado(e)) ver(idMsg(e.link), { nombre: e.nombre, sv: e.sv, t: utc(liga.cuandoDe(e)).toISOString(), ins: e.ins || '', link: e.link || '' });
  for (const c of liga.d.calendario || []) if (!liga.canceladoCal(c)) ver(idMsg(c.link), { nombre: c.n, sv: c.sv, t: utc(c.t).toISOString(), ins: '', link: c.link || '' });
  return mejor;
}
// 📢 …y OFICIAL, no de un evento (Dlx, el mismo día: «cuando me refiero, que sea un anuncio oficial, no un anuncio de
// evento»): lo último que publicó la Liga en su canal de DRA (`novedades`, de `_novedades()` en bot/subir_web.py, lo mismo
// que Publicaciones). Sin ninguno, el último anuncio de evento; y sin eso, el próximo evento
// …y DE TODOS LOS SERVIDORES (Dlx: «Sí, de todos»): los anuncios de sus canales que no son eventos (`oficiales` del
// payload, de `oficial_de()` en bot/anuncios.py) junto con los de la Liga; gana el más nuevo
function anuncioOficial(liga) {
  const xs = (liga.d.novedades || []).filter((x) => x && x.t && (x.tit || x.tx))
    .map((n) => ({ sv: '', tit: limpio(n.tit || String(n.tx).split(/\r?\n/)[0]).slice(0, 80), t: utc(n.t).toISOString(), link: n.link || '' }))
    // ⚠️ SÓLO UNA LISTA (12/11/2026, «a veces el panel no aparece»): `oficiales` del payload fue un NÚMERO hasta la 4.86 —el
    // «#3 de N» de los perfiles, con el mismo nombre— y `.filter` de un número rompía el panel entero (`Aislada` lo apaga)
    .concat((Array.isArray(liga.d.oficiales) ? liga.d.oficiales : []).filter((o) => o && o.t && o.tit)
      .map((o) => ({ sv: o.sv || '', tit: limpio(o.tit).slice(0, 80), t: utc(o.t).toISOString(), link: o.link || '' })));
  return xs.sort((a, b) => new Date(b.t) - new Date(a.t))[0] || null;
}
function SinBatallas({ liga, yo, yoF, T, retar }) {
  const of = anuncioOficial(liga);
  const ua = of ? null : ultimoAnuncio(liga);
  const ev = of || ua ? null : eventoDelBoton(liga).e || liga.luego()[0] || null;
  const miPos = yoF.pos || yo.pos || 0;
  let rv = null;
  if (miPos) {
    const arriba = T.filter((f) => f.pos < miPos && f.k !== yo.k);
    rv = arriba.length ? arriba[arriba.length - 1] : T.find((f) => f.pos > miPos && f.k !== yo.k) || null;
  }
  const sube = rv && miPos && rv.pos < miPos;
  const dif = rv ? Math.abs((rv.pts || 0) - (yoF.pts || yo.pts || 0)) : 0;
  const ins = ev ? ev.ins || ev.link || '' : '';
  // ⚠️ la hora del anuncio viene en UTC sin «Z»: `new Date()` la leería como la hora de quien mira, `utc()` no
  const evT = ev ? utc(liga.cuandoDe(ev)).toISOString() : '';
  // sin rival (quien todavía no jugó), el evento solo, a lo ancho
  return (
    <section className={'pn-sb' + (rv ? '' : ' solo ev')}>
      {of ? (
        <div className="pn-sb-ev">
          <img className="pn-sb-logo" alt="" src={(of.sv && liga.logo(of.sv)) || '/ul.png'} />
          <span className="pn-sb-tx"><em>Último anuncio oficial</em><b>{of.tit}</b>
            <small>{of.sv ? siglaDe(of.sv) : 'La Liga'} · <span className="pn-sb-t">hace {hace(new Date(of.t).getTime())}</span></small></span>
          {of.link ? <a className="btn verde chico" href={of.link} target="_blank" rel="noopener noreferrer">Ver anuncio</a>
            : <a className="btn verde chico" href="#/publicaciones">Ver</a>}
        </div>
      ) : ua ? (() => {
        const fut = new Date(ua.t).getTime() > Date.now();
        return (
          <div className="pn-sb-ev">
            {liga.logo(ua.sv) ? <img className="pn-sb-logo" alt="" src={liga.logo(ua.sv)} /> : <span className="pn-sb-logo"><Ico n="eventos" t={20} /></span>}
            <span className="pn-sb-tx"><em>Último anuncio</em><b>{limpio(ua.nombre)}</b>
              <small>{siglaDe(ua.sv)} · {cuando(ua.t)} · <span className="pn-sb-t">{fut ? 'en ' + faltaTxt(ua.t) : 'fue hace ' + hace(new Date(ua.t).getTime())}</span></small></span>
            {ua.ins && fut ? <a className="btn verde chico" href={ua.ins} target="_blank" rel="noopener noreferrer">Inscribirme</a>
              : ua.link ? <a className="btn verde chico" href={ua.link} target="_blank" rel="noopener noreferrer">Ver anuncio</a>
                : <a className="btn verde chico" href="#/eventos">Ver</a>}
          </div>
        );
      })() : ev ? <div className="pn-sb-ev">
        {liga.logo(ev.sv) ? <img className="pn-sb-logo" alt="" src={liga.logo(ev.sv)} /> : <span className="pn-sb-logo"><Ico n="eventos" t={20} /></span>}
          <span className="pn-sb-tx"><em>Tu próximo evento</em><b>{limpio(ev.nombre)}</b>
            <small>{siglaDe(ev.sv)} · {cuando(evT)} · <span className="pn-sb-t">en {faltaTxt(evT)}</span></small></span>
          {ins ? <a className="btn verde chico" href={ins} target="_blank" rel="noopener noreferrer">Inscribirme</a>
            : <a className="btn verde chico" href="#/eventos">Ver</a>}
      </div> : (
        <div className="pn-sb-ev">
          <span className="pn-sb-logo"><Ico n="eventos" t={20} /></span>
          <span className="pn-sb-tx"><em>Tu próximo evento</em><b>Todavía no anunciaron</b><small>Se anuncian con poco tiempo</small></span>
          <a className="btn borde chico" href="#/eventos">Calendario</a>
        </div>
      )}
      {rv ? (
        <div className="pn-sb-rv">
          <Cara liga={liga} k={rv.k} nombre={rv.n} cls="pn-vs-c otro" />
          <span className="pn-sb-tx"><em>{sube ? 'El que tienes arriba' : 'El que te sigue'}</em><b>{limpio(rv.n)}</b>
            <small>#{rv.pos} · {sube ? 'te faltan ' : 'le llevas '}{num(dif)} pts · {caraACara(liga, yo.k, rv.k)}</small></span>
          <button type="button" className="btn mag chico" onClick={() => retar(rv)}>Retar</button>
        </div>
      ) : null}
    </section>
  );
}

// ── ⚔️ TUS PRÓXIMAS BATALLAS, CON EL ESTILO DEL VS ──────────────────────────────────────────────────────
const ESTIMADO = (ovrR, ovrY) => 1 / (1 + Math.pow(10, ((ovrR || 0) - (ovrY || 0)) / 25));
function caraACara(liga, a, b) {
  const R = liga.d.rivales || {};
  const par = R[[a, b].sort().join('|')];
  // ⚔️ y las libres confirmadas entre los dos (no tocan el ranking: van aparte)
  const L = ((LB.d && LB.d.libres) || []).filter((x) => x.estado === 'hecha' && [x.a, x.b].sort().join('|') === [a, b].sort().join('|'));
  const lib = L.length ? ' · libres ' + L.filter((x) => x.ganador === a).length + '–' + L.filter((x) => x.ganador === b).length : '';
  return (par ? 'Cara a cara ' + (par[a] || 0) + '–' + (par[b] || 0) : 'Primer cruce') + lib;
}

// ── ⚔️ LAS BATALLAS LIBRES, DE VERDAD (12/11/2026, Dlx: «tuve una batalla con Saiko a las 9pm pero ni idea quién ganó y no
// sé dónde se ve eso», y a la pregunta, «Hacerla real»). Hasta acá Retar guardaba la hora sólo en tu navegador y a esa hora
// la batalla se borraba sola. Ahora vive en el objeto (`libreCrear()` en bot/avisos.js): tu rival la ve en su Inicio (y le
// llega a su campana), y pasada la hora cada uno dice quién ganó. Si coinciden, queda en su cara a cara; si no, «sin
// acuerdo». No toca el ranking
function duelos(f) {
  const du = f && f.du;
  return du && du[1] ? <><span className="pn-largo">Duelos </span>{du[0]}/{du[1]} · {Math.round((du[0] / du[1]) * 100)} %</> : 'Sin duelos todavía';
}
// 🏅 LOS 5 GRANDES LOGROS DE CADA LADO DEL VS (12/11/2026, Dlx: «que cada lado tenga su fondo por su parte y 5 grandes logros,
// así como lo hace Clash Royale»). Salen de la fila de la Temporada de cada uno, los dos con las mismas cinco, en el mismo
// orden, así se comparan de un vistazo; un cero se ve apagado y no se esconde (si se escondiera, los dos lados no
// quedarían parejos)
function logrosDe(f) {
  if (!f) return null;
  const du = Array.isArray(f.du) ? f.du : null;
  const rch = Array.isArray(f.rch) ? f.rch : [0, 0];
  return [
    ['copa', f.oro || 0, 'Títulos'], ['premio', f.pod || 0, 'Podios'], ['fuego', rch[1] || 0, 'Racha'],
    ['mira', f.caz || 0, 'Cazas'], ['cruce', du ? du[0] : 0, 'Duelos'],
  ];
}
// (Dlx, el mismo día: «los logros son demasiado grandes» y «en ningún momento te dije que lo hagas más grande»: chicos,
// en una sola línea, y el VS del mismo alto que antes)
const TIT_LG = { Títulos: 'Títulos', Podios: 'Podios', Racha: 'Mejor racha', Cazas: 'Cazas', Duelos: 'Duelos ganados' };
function Logros({ f, cls }) {
  const L = logrosDe(f);
  if (!L) return null;
  return (
    <ul className={'pn-lg ' + cls} aria-label="Sus logros">
      {L.map(([i, v, t]) => <li key={t} className={v ? '' : 'cero'} title={TIT_LG[t] + ': ' + num(v)}><span className="pn-lg-i"><Ico n={i} t={11} /></span><b>{num(v)}</b><small>{t}</small></li>)}
    </ul>
  );
}
// 🖼️ el fondo de cada lado: el SUYO si eligió mostrarlo en su perfil (Dlx: «en este caso me gustaría que aparezca ahí mi
// fondo»); si no, su bandera, grande y apagada («eso del fondo de tu bandera está genial… por default»)
const fondoLado = (f, fo) => {
  const propio = fo && fo[1] ? urlFondo(fo[0]) : '';
  if (propio) return { '--bf': propio };
  // 🔎 la bandera en HD (`/banderas/xl/`, 1280 de ancho, de 04_Pais/banderas): la de `/banderas/g/` mide 240×160 y acá se
  // estira a media pantalla. Va encima de la chica: si un país no tiene la grande, se ve la de siempre
  return f && f.cc ? { '--bf': 'url("/banderas/xl/' + f.cc + '.webp"), url("/banderas/g/' + f.cc + '.webp")' } : {};
};
// las horas para una batalla libre: las cuatro próximas de 6 y 9 PM del este
function horasLibres() {
  const out = [];
  const ahora = Date.now();
  const enET = (ms) => new Date(new Date(ms).toLocaleString('en-US', { timeZone: ET }));
  const corr = enET(ahora).getTime() - ahora;
  for (let d = 0; out.length < 4 && d < 4; d++) {
    for (const hh of [18, 21]) {
      const b = enET(ahora);
      b.setDate(b.getDate() + d); b.setHours(hh, 0, 0, 0);
      const real = b.getTime() - corr;
      if (real > ahora + 30 * 60000 && out.length < 4) out.push(new Date(real).toISOString());
    }
  }
  return out;
}

export function Batallas({ liga, dc }) {
  const C = useCompetencias();
  const yo = liga.yo;
  const [fase, setFase] = useState('nada');
  const [rival, setRival] = useState(null);
  const LBd = useLibres(dc);
  const [msg, setMsg] = useState('');
  const [cara, setCara] = useState('');
  const dlg = useRef(null);
  const giro = useRef(null);
  const fondos = useFondos();
  const T = useMemo(() => (liga.d.tabla || []).filter((f) => f.pos).sort((a, b) => a.pos - b.pos), [liga]);
  const d = useMemo(() => (C && yo ? dondeEstoy(C, yo.k) : null), [C, yo]);
  const pend = (d && d.pend) || [];
  const enPend = new Set(pend.map((x) => x[1].rival));
  // ⚠️ tu puesto sale de la tabla, no de tu cuenta: con `liga.yo.pos` vacío «Otro rival» no encontraba a nadie y no hacía
  // nada (Dlx, 12/11/2026: «estoy clickeando otro rival y no me deja»)
  const miPos = yo ? ((T.find((f) => f.k === yo.k) || {}).pos || yo.pos || 0) : 0;
  // 🔴 y la tabla del payload trae los 200 primeros: para quien va más abajo (Dlx, #229) no había nadie a ±25 puestos. Si
  // pasa eso, los 15 más cercanos que haya
  const candidatos = useMemo(() => {
    if (!yo || !miPos) return [];
    const libres = T.filter((f) => f.k !== yo.k && !enPend.has(f.k));
    const cerca = libres.filter((f) => Math.abs(f.pos - miPos) <= 25);
    return cerca.length >= 3 ? cerca : libres.slice().sort((x, y) => Math.abs(x.pos - miPos) - Math.abs(y.pos - miPos)).slice(0, 15);
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [T, yo, miPos, pend.length]);
  const buscar = () => {
    if (!candidatos.length) return;
    clearInterval(giro.current);
    setFase('busca');
    const fin = () => { clearInterval(giro.current); setRival(candidatos[Math.floor(Math.random() * candidatos.length)]); setFase('hora'); };
    if (quieto()) { setTimeout(fin, 500); return; }
    let n = 0;
    giro.current = setInterval(() => { setCara(candidatos[n++ % candidatos.length].k); if (n > 14) fin(); }, 110);
  };
  useEffect(() => () => clearInterval(giro.current), []);
  // el botón «Batallar» del centro avisa por acá
  useEffect(() => {
    const f = () => buscar();
    W.addEventListener('lg:batallar', f);
    return () => W.removeEventListener('lg:batallar', f);
  });
  if (!dc || !yo) return null;
  const elegir = async (iso) => {
    setMsg('');
    const j = await libreAccion('libre-crear', { rival: rival.k, t: iso });
    if (j && j.ok) { setFase('nada'); setRival(null); } else setMsg((j && ERR_LIBRE[j.error]) || 'No se pudo guardar: prueba de nuevo.');
  };
  const cancelar = async (id) => { await libreAccion('libre-cancelar', { id }); if (dlg.current && dlg.current.open) dlg.current.close(); };
  const decir = async (id, gane) => { setMsg(''); const j = await libreAccion('libre-resultado', { id, gane }); if (!(j && j.ok)) setMsg((j && ERR_LIBRE[j.error]) || 'No se pudo guardar.'); };
  const yoF = T.find((f) => f.k === yo.k) || yo;
  if (fase === 'busca') {
    return (
      <section className="pn-vs pn-busca" aria-live="polite">
        <span className="pn-gira"><Cara liga={liga} k={cara || (candidatos[0] || {}).k} nombre="" cls="pn-gira-c" /></span>
        <span className="pn-tx"><b>Buscando rival…</b><small>Entre los que están cerca tuyo en el ranking</small></span>
      </section>
    );
  }
  if (fase === 'hora' && rival) {
    return (
      <section className="pn-vs pn-hora">
        <div className="pn-duo">
          <span><Cara liga={liga} k={yo.k} nombre={yo.n} cls="pn-vs-c" /><b>{limpio(yo.n)}</b></span>
          <span className="pn-vs-x">VS</span>
          <span><Cara liga={liga} k={rival.k} nombre={rival.n} cls="pn-vs-c otro" /><b>{limpio(rival.n)}</b><small>#{rival.pos} · OVR {rival.ovr || '—'}</small></span>
        </div>
        <div className="pn-elige"><b>¿Cuándo batallan?</b>
          <div className="pn-horas">{horasLibres().map((h) => <button key={h} type="button" onClick={() => elegir(h)}>{cuando(h)}</button>)}</div>
          <div className="pn-elige-pie"><button type="button" className="pn-x" onClick={buscar}>Otro rival</button>
            <button type="button" className="pn-x" onClick={() => setFase('nada')}>Cancelar</button></div>
          {msg ? <small className="pn-lb-msg" role="alert">{msg}</small> : <small className="pn-lb-nota">Le llega a su Inicio. Cuando la jueguen, cada uno dice quién ganó.</small>}</div>
      </section>
    );
  }
  // la lista: primero las libres que ya pasaron y esperan que digas quién ganó, después las que vienen, y las de Competencias
  const ahoraMs = Date.now();
  const todas = [];
  const libres = ((LBd && LBd.libres) || []).filter((x) => x.estado === 'pend').sort((a, b) => utc(a.t) - utc(b.t));
  for (const x of libres) {
    const otro = x.a === yo.k ? x.b : x.a;
    const f = liga.T[otro] || T.find((r) => r.k === otro) || null;
    const paso = utc(x.t).getTime() <= ahoraMs;
    todas.push({ et: (x.a === yo.k ? '' : 'Te retó · ') + 'Batalla libre', f, k: otro, n: f ? f.n : otro, id: x.id, libre: true, paso, mio: x.mio, suyo: x.suyo,
      cuando: paso ? 'era ' + cuando(x.t) : cuando(x.t), p: f ? ESTIMADO(f.ovr, yoF.ovr) : 0.5 });
  }
  todas.sort((a, b) => (b.paso ? 1 : 0) - (a.paso ? 1 : 0));
  for (const [et, c, hasta] of pend) {
    const f = liga.T[c.rival] || null;
    todas.push({ et, f, k: c.rival, n: nombreDe(liga, C, c.rival), cuando: hasta ? 'se define ' + cuando(hasta) : '', p: c.p });
  }
  const p0 = todas[0];
  if (!p0) return <SinBatallas liga={liga} yo={yo} yoF={yoF} T={T} retar={(f) => { setRival(f); setFase('hora'); }} />;
  const pct = Math.round((p0.p || 0) * 100);
  const nom = (x) => limpio((x.f && x.f.n) || x.n || x.k);
  const FO = fondos || {};
  // ⚔️ cada una como un VS (12/11/2026, los pop-ups nuevos): tu cara, la barra de a quién le dan más chance, la del rival
  const fila = (x) => {
    const pc = x.p != null ? Math.round(x.p * 100) : null;
    return (
      <li key={x.et + x.k} className="pop-vs">
        <Cara liga={liga} k={yo.k} nombre={yo.n} cls="pn-bt-c" />
        <span className="pop-vs-m"><em className={x.libre ? 'libre' : ''}>{x.et}</em><b>vs {nom(x)}</b>
          {pc != null ? <span className="pop-vs-p" aria-hidden="true"><i style={{ width: pc + '%' }} /></span> : null}
          <small>{x.cuando}{pc != null ? ' · ' + pc + ' % a favor' : ''}</small></span>
        <Cara liga={liga} k={x.k} nombre={nom(x)} cls="pn-bt-c otro" />
        {x.libre && !x.paso ? <button type="button" className="pn-x" onClick={() => cancelar(x.id)}>cancelar</button> : null}
      </li>
    );
  };
  return (
    <section className="pn-vs con-lg">
      <span className="pn-vs-f izq" aria-hidden="true" style={fondoLado(yoF, FO[yo.k])} /><span className="pn-vs-f der" aria-hidden="true" style={fondoLado(p0.f, FO[p0.k])} />
      <div className="pn-rv"><Cara liga={liga} k={yo.k} nombre={yo.n} cls="pn-vs-c" />
        <span><b>{limpio(yo.n)}</b><small><span className="pn-pos">#{yoF.pos || '—'} · </span>OVR {yoF.ovr || '—'}</small><small className="pn-du">{duelos(yoF)}</small></span></div>
      <div className="pn-mid">
        <em className={p0.libre ? 'libre' : ''}>{p0.et}</em>
        <b className="pn-vs-x">VS</b>
        {/* ⚔️ una libre que ya pasó: quién ganó (cada uno lo dice; si coinciden, queda) */}
        {p0.paso && !p0.mio ? <span className="pn-lb-q"><b>¿Quién ganó?</b>
          <span><button type="button" className="pn-lb-b yo" onClick={() => decir(p0.id, true)}>Gané yo</button>
            <button type="button" className="pn-lb-b" onClick={() => decir(p0.id, false)}>Ganó {nom(p0)}</button></span></span>
          : p0.paso ? <small className="pn-lb-esp">{p0.mio === yo.k ? 'Dijiste que ganaste tú' : 'Dijiste que ganó ' + nom(p0)} · falta {nom(p0)}</small>
            : <span className="pn-prob" aria-label={'Chance de ganar: ' + pct + ' % contra ' + (100 - pct) + ' %'}><b>{pct} %</b><i style={{ '--p': pct + '%' }} /><b>{100 - pct} %</b></span>}
        <small>{p0.cuando}</small>
        <small className="pn-cac">{caraACara(liga, yo.k, p0.k)}{p0.libre && !p0.paso ? ' · % estimado' : ''}</small>
        {msg ? <small className="pn-lb-msg" role="alert">{msg}</small> : null}
        <span className="pn-acc-v">
          {p0.libre && !p0.paso ? <button type="button" className="pn-x" onClick={() => cancelar(p0.id)}>cancelar</button> : null}
          {todas.length > 1 ? <button type="button" className="pn-ver" onClick={() => dlg.current && dlg.current.showModal()}>Ver las {todas.length}</button> : null}
        </span>
      </div>
      <div className="pn-rv der"><span><b>{nom(p0)}</b><small>{p0.f ? <><span className="pn-pos">#{p0.f.pos || '—'} · </span>OVR {p0.f.ovr || '—'}</> : ''}</small>
        <small className="pn-du">{duelos(p0.f)}</small></span><Cara liga={liga} k={p0.k} nombre={nom(p0)} cls="pn-vs-c otro" /></div>
      <Logros f={yoF} cls="izq" />
      <Logros f={p0.f} cls="der" />
      <dialog className="pn-pop pop-bat" ref={dlg} aria-label="Tus próximas batallas" onClick={(e) => { if (e.target === dlg.current) dlg.current.close(); }}>
        <PopCab ico="cruce" t="Tus próximas batallas" sub={todas.length === 1 ? '1 por jugar' : todas.length + ' por jugar'} cerrar={() => dlg.current.close()} />
        <ul className="pn-pop-l">{todas.map(fila)}</ul>
      </dialog>
    </section>
  );
}

// ── 🎒 LO TUYO DEL INVENTARIO, para la Tienda y el botón de Inventario (como la maqueta: «MARCOS 12 · TAGS 25» y «1 NUEVA»).
// Una vez por visita y sólo con cuenta: los mismos dos pedidos que hace el inventario
const MIOS = { d: null, va: false, oyen: new Set() };
function useMios(dc) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!dc) return undefined;
    const f = () => setN((n) => n + 1);
    MIOS.oyen.add(f);
    if (!MIOS.d && !MIOS.va) {
      MIOS.va = true;
      Promise.all([pasePost('tags-mios', {}), pasePost('marcos', {})]).then(([t, m]) => {
        // 👑 el dueño los tiene todos (`dueno` de tags-mios): contarle los guardados decía «1»
        const tags = t && t._ok ? (t.dueno ? 'Todos' : Object.values(t.ganados || {}).reduce((s, xs) => s + Object.keys(xs || {}).length, 0)) : null;
        MIOS.d = { tags, nuevos: t && t._ok ? cuantosNuevos(t) : 0, marcos: m && m._ok && Array.isArray(m.tienes) ? m.tienes.length : null };
        MIOS.oyen.forEach((g) => g());
      }).finally(() => { MIOS.va = false; });
    }
    return () => { MIOS.oyen.delete(f); };
  }, [!!dc]); // eslint-disable-line react-hooks/exhaustive-deps
  return dc ? MIOS.d : null;
}

// ── 🃏 EL CENTRO: tus tarjetas, tus rankings a los costados, lo último que te dijeron y tu último evento ──────────────
const CARTAS = ['temporada', 'competitivo', 'servidor', 'pais'];
const NOM = { temporada: 'Temporada', competitivo: 'Competitiva', servidor: 'Servidor', pais: 'País' };
const BOTS = [['El Hype', 'EH'], ['ULAYA', 'UL'], ['El Jurado', 'EJ']];
function textoBot(res, nombre) {
  const r = String(res || '');
  if (/campe[oó]n/i.test(r) && !/sub/i.test(r)) return '¡Campeón en ' + nombre + '! Esa final la vimos todos 🔥';
  if (/subcampe/i.test(r)) return 'Subcampeón en ' + nombre + ': la próxima final es tuya';
  if (/semi/i.test(r)) return 'Semifinal en ' + nombre + '… estuviste cerca, ¿revancha?';
  return r ? r + ' en ' + nombre + '. ¿Cuándo vuelves a la llave?' : 'Te vimos en ' + nombre + '. ¿Cuándo vuelves?';
}
function hace(ms) {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (m < 60) return m + ' min';
  const h = Math.round(m / 60);
  return h < 48 ? h + ' h' : Math.round(h / 24) + ' d';
}
const ICO_RK = { Temporada: 'eventos', Competitivo: 'copa', ELO: 'cruce', Crew: 'escudo' };
const COLOR_RK = { Temporada: '#29B298', Competitivo: '#E8B923', ELO: '#FF4F93', 'País': '#58A6FF', Servidor: '#C9D1DB', Crew: '#AEB6C1' };

function rankingsDe(liga, yo, svEl) {
  const T = liga.oficiales();
  const comp = T.filter((f) => f.rg).sort((a, b) => (b.sc || 0) - (a.sc || 0));
  const elo = [];
  for (const g of ((liga.d.div || {}).d || [])) for (const gg of g || []) for (const x of gg || []) elo.push(x);
  elo.sort((a, b) => (b[1] || 0) - (a[1] || 0));
  // tu servidor: el que elegiste, si tienes puesto ahí; si no, donde más jugaste (el de tu carta de Servidor)
  const tienePuesto = (x) => x && T.some((f) => f.sv === x && f.k === yo.k);
  const sv = (tienePuesto(svEl) ? svEl : yo.sv) || svEl || '';
  const delSv = T.filter((f) => f.sv === sv).sort((a, b) => a.pos - b.pos);
  const delPais = yo.cc ? T.filter((f) => f.cc === yo.cc).sort((a, b) => a.pos - b.pos) : [];
  const crews = (liga.d.crews || []).filter((c) => c.rk !== 0);
  const mia = liga.crewDe(yo);
  const iCrew = mia ? crews.findIndex((c) => c.crew === mia.crew) : -1;
  const iDe = (l, fn) => { const i = l.findIndex(fn); return i >= 0 ? i + 1 : null; };
  // 🙋 quien está afuera de los 200 del lobby trae su puesto en el país y en su crew en su perfil (`rk`, App.jsx)
  const rk = yo.rk || {};
  return [
    // ⚠️ el total es la gente de la temporada (`gente`), no las 200 filas que viajan: con 200, el #228 era «top 114 %»
    ['Temporada', yo.pos || null, Math.max(T.length, Number(liga.d.gente) || 0), 0, 'Temporada'],
    ['Competitivo', iDe(comp, (f) => f.k === yo.k), comp.length, 1, 'Competitivo'],
    ['ELO', iDe(elo, (x) => x[0] === yo.n), elo.length, -1, 'ELO'],
    ['País', yo.cc ? (iDe(delPais, (f) => f.k === yo.k) || (rk.pa && rk.pa[0]) || null) : null,
      Math.max(delPais.length, (rk.pa && rk.pa[1]) || 0), 3, yo.cc ? limpio(nombrePais(yo.cc)) : 'País'],
    ['Servidor', sv ? iDe(delSv, (f) => f.k === yo.k) : null, delSv.length, 2, sv ? siglaDe(sv) : 'Servidor', sv],
    ['Crew', iCrew >= 0 ? iCrew + 1 : null, crews.length, -1, mia ? limpio(mia.crew) : 'Crew'],
  ];
}

function Chip({ liga, x, elegida, onElegir }) {
  const [n, p, de, carta, et, sv] = x;
  const top = p && de ? Math.max(1, Math.round((p / de) * 100)) : null;
  const ico = n === 'País' && liga.yo && liga.yo.cc ? <Bandera cc={liga.yo.cc} cls="pn-chip-flag" />
    : n === 'Servidor' && sv && liga.logo(sv) ? <img className="pn-chip-sv" alt="" src={liga.logo(sv)} /> : <Ico n={ICO_RK[n] || 'ranking'} t={16} />;
  const on = carta >= 0 && carta === elegida;
  return (
    <button type="button" className={'pn-chip' + (on ? ' on' : '') + (p ? '' : ' vacio')} style={{ '--c': COLOR_RK[n] }}
      onClick={() => { if (carta >= 0) onElegir(carta); }} aria-pressed={carta >= 0 ? on : undefined}>
      <span className="pn-chip-i">{ico}</span><span className="pn-chip-n">{et}</span>
      <strong>{p ? '#' + p : '—'}</strong>
      <span className="pn-chip-pie">{p ? <><i><u style={{ width: Math.max(4, Math.round((1 - (p - 1) / Math.max(1, de)) * 100)) + '%' }} /></i><small>top {top} %</small></>
        : <small>{n === 'Crew' && et === 'Crew' ? 'sin crew' : 'sin puesto'}</small>}</span>
    </button>
  );
}

export function Vestuario({ liga, dc }) {
  const yo = liga.yo;
  const el = useElegidos();
  // 🏟️ y tu mejor carta de liga (12/11/2026, Dlx: «yo debería tener… al menos el de la mejor liga»): la de más OVR, del
  // mismo pedido que ya hace el Inicio (`pedirLigas`)
  const [ligaC, setLigaC] = useState(null);
  useEffect(() => {
    if (!yo || !yo.k) return undefined;
    let vivo = true;
    pedirLigas(liga.d.sello).then((x) => {
      const cs = (x && x.cartas && x.cartas[yo.k]) || [];
      const m = cs.slice().sort((p, q) => (q[2] || 0) - (p[2] || 0))[0];
      const lg = m && ((x.lobby && x.lobby.ligas) || []).find((l) => l.id === m[0]);
      if (vivo && m) setLigaC({ src: liga.d.r2 + '/' + yo.k + '/liga-' + m[0] + '.webp?v=' + m[1], nom: lg ? limpio(lg.n || lg.nombre || 'Liga') : 'Liga' });
    });
    return () => { vivo = false; };
  }, [yo && yo.k, liga.d.sello]); // eslint-disable-line react-hooks/exhaustive-deps
  const disp = yo ? CARTAS.filter((c) => liga.cartaUrl(yo.k, c)) : [];
  const srcs = disp.map((c) => liga.cartaUrl(yo.k, c)).concat(ligaC ? [ligaC.src] : []);
  const noms = disp.map((c) => NOM[c]).concat(ligaC ? [ligaC.nom] : []);
  const [elegida, setElegida] = useState(0);
  const mios = useMios(dc);
  const est = useRef(null);
  const camp = useCampana();
  useComentarios();
  // 🐉 con la campana activa, tu último evento sube a la fila de arriba (`FilaRacha`): acá no se repite
  const ultArriba = !!dc && !campanaPide(camp, dc);
  const nC = srcs.length;
  const i = nC ? Math.min(elegida, nC - 1) : 0;
  if (!yo) {
    const top = (liga.d.tabla || []).filter((f) => f.pos && liga.cartaUrl(f.k, 'temporada')).slice(0, 3);
    return (
      <div className="pn-cu pn-yo sin">
      <div className="pn-sin-in">
        <div className="pn-abre">{top.map((f, j) => <img key={f.k} alt="" data-o={j === 0 ? 0 : j === 1 ? 2 : 1} src={liga.cartaUrl(f.k, 'temporada')} />)}</div>
        <div className="pn-sin-tx"><b>Tus tarjetas</b>
          <small>{dc ? 'Juega tu primer evento y entras al ranking: tu carta sale con el nivel 1 del Pase.' : 'Entra con Discord: acá van tus tarjetas, tus rankings y lo que te dicen.'}</small>
          {dc ? <a className="btn verde chico" href="#/eventos">Ver los próximos eventos</a> : <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button>}</div>
      </div>
        {/* 🔒 los cuatro de siempre, también acá (Dlx, 12/11/2026: «hay botones que desaparecen»): con candado y qué los abre.
            Sin cuenta llevan a entrar; con cuenta y sin jugar, a los eventos (el Inventario ya se puede mirar) */}
        <nav className="pn-acc bloq" aria-label="Lo tuyo, cuando juegues">
          <button type="button" onClick={dc ? () => { location.hash = '#/eventos'; } : accion.entrar}><Ico n="ranking" t={22} /><b>Estadísticas</b>
            <small>{dc ? 'Con tu primer evento' : 'Entra con Discord'}</small><Ico n="candado" t={14} /></button>
          {dc ? <a href="#/inventario"><Ico n="tarjetas" t={22} /><b>Inventario</b><small>Tus TAGs</small></a>
            : <button type="button" onClick={accion.entrar}><Ico n="tarjetas" t={22} /><b>Inventario</b><small>Entra con Discord</small><Ico n="candado" t={14} /></button>}
          <span className="pn-pronto" aria-disabled="true"><Ico n="mira" t={22} /><b>Entrenar</b><small>Pronto</small><em>pronto</em></span>
          <button type="button" onClick={dc ? () => { location.hash = '#/eventos'; } : accion.entrar}><Ico n="cruce" t={22} /><b>Batallar</b>
            <small>{dc ? 'Cuando entres al ranking' : 'Entra con Discord'}</small><Ico n="candado" t={14} /></button>
        </nav>
      </div>
    );
  }
  const rks = rankingsDe(liga, yo, svElegido(liga, el, yo.k));
  const cartaDeChip = (c) => { const k = CARTAS[c]; const j = disp.indexOf(k); return j; };
  const conCarta = rks.map((x) => { const y = x.slice(); y[3] = x[3] >= 0 ? cartaDeChip(x[3]) : -1; return y; });
  // lo último: tu último evento y lo que dijo de él un personaje de la Liga (bot)
  const ult = (liga.semanaDe(yo.k) || [])[0] || null;
  // 🗓️ y si tu último evento ya no viaja en el lobby (sólo van las llaves más nuevas), el de tu fila (`ult`: el día y
  // hasta dónde llegaste) con su número, que trae tu perfil (`ue`, App.jsx). Antes decía «Todavía no jugaste» a quien
  // sí jugó (Dlx, 12/11/2026: «yo he participado en un evento, debería estar ahí con más info»)
  const viejo = !ult && Array.isArray(yo.ult) && yo.ult[0]
    ? { n: (yo.ue && yo.ue[0]) || 0, nombre: yo.ue && yo.ue[0] ? 'la llave #' + yo.ue[0] : 'tu último evento', t: yo.ult[0] + 'T23:00:00Z', r: yo.ult[1] } : null;
  const ll = ult ? ult[0] : viejo;
  const fechaUlt = ult ? utc(liga.fechaLlave(ll)) : viejo ? utc(viejo.t) : 0;
  const ronda = ult ? ult[1] : viejo ? viejo.r : '';
  const bot = BOTS[(ll ? String(ll.n).split('').reduce((s, ch) => s + ch.charCodeAt(0), 0) : 0) % BOTS.length];
  // 💬 el último comentario en una publicación tuya (las de los últimos días del muro)
  const comTuyo = (() => {
    const ahoraMs = Date.now();
    let mejor = null;
    for (const it of liga.muro || []) {
      const ks = Array.isArray(it.ks) ? it.ks : [];
      if (!it.id || !ks.includes(yo.k)) continue;
      const hs = delHilo(it, ahoraMs).filter((c) => c.k !== yo.k);
      const c = hs[hs.length - 1];
      if (c && (!mejor || c.t > mejor.c.t)) mejor = { id: it.id, c };
    }
    return mejor;
  })();
  return (
    <div className="pn-cu pn-yo">
      <div className="pn-yo-in">
        <div className="pn-izq">{conCarta.slice(0, 3).map((x) => <Chip key={x[0]} liga={liga} x={x} elegida={i} onElegir={setElegida} />)}</div>
        <div className="pn-car">
          <div className="pn-abre" role="button" tabIndex={0} aria-label="Ver la siguiente carta" onClick={() => setElegida((i + 1) % Math.max(1, nC))}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setElegida((i + 1) % Math.max(1, nC)); } }}>
            {srcs.map((src, j) => <img key={src} alt={'Tu carta ' + noms[j]} data-o={Math.min(3, (j - i + nC) % nC)} src={src} />)}
          </div>
          {nC > 1 ? (
            <div className="pn-nav"><button type="button" aria-label="Carta anterior" onClick={() => setElegida((i - 1 + nC) % nC)}>‹</button>
              <b>{noms[i]}</b><button type="button" aria-label="Carta siguiente" onClick={() => setElegida((i + 1) % nC)}>›</button></div>
          ) : nC ? <div className="pn-nav"><b>{noms[0]}</b></div> : <small className="pn-gris">Tus cartas salen con el nivel 1 del Pase</small>}
        </div>
        <div className="pn-der">{conCarta.slice(3).map((x) => <Chip key={x[0]} liga={liga} x={x} elegida={i} onElegir={setElegida} />)}</div>
        <div className="pn-com">
          {/* 💬 lo último que te comentaron en una publicación tuya (de verdad o simulado, con su etiqueta), y Responder te
              lleva a ESA publicación con el hilo abierto (12/11/2026); sin ninguno, el personaje de la Liga de antes */}
          {comTuyo ? (
            <span className="pn-dice">{comTuyo.c.et === 'l' ? <span className="pn-bot-av" aria-hidden="true">{comTuyo.c.k.toUpperCase()}</span>
              : <Cara liga={liga} k={comTuyo.c.k} nombre={comTuyo.c.n} cls="cara pn-bot-av" />}
              <b>{limpio(comTuyo.c.n)}{comTuyo.c.et === 's' ? <span className="pn-tag-bot">simulado</span> : comTuyo.c.et === 'l' ? <span className="pn-tag-bot">Liga</span> : null}
                <small>· {hace(comTuyo.c.t)}</small></b>
              <p>{comTuyo.c.tx}</p></span>
          ) : (
            <span className="pn-dice"><span className="pn-bot-av" aria-hidden="true">{bot[1]}</span>
              <b>{bot[0]}<span className="pn-tag-bot">bot</span><small>{fechaUlt ? '· ' + hace(fechaUlt) : ''}</small></b>
              <p>{ll ? textoBot(ronda, limpio(ll.nombre)) : 'Todavía no jugaste en la ' + (liga.temp || 'T1') + '. ¿Te anotas al próximo?'}</p></span>
          )}
          <a className="pn-resp" href={comTuyo ? '#/publicaciones/' + comTuyo.id : ll ? '#/publicaciones' : '#/eventos'}>{comTuyo || ll ? 'Responder' : 'Ver eventos'}</a>
          {ll && !ultArriba ? (
            <button type="button" className="pn-ult" onClick={() => (ll.n ? accion.llave(ll.n) : (location.hash = '#/r/' + encodeURIComponent(yo.k)))}>
              <span className="pn-cal"><i>{new Date(fechaUlt).toLocaleDateString('es', { weekday: 'short' }).replace('.', '')}</i><b>{new Date(fechaUlt).getDate()}</b></span>
              <span className="pn-ult-t"><em>Tu último evento · {ronda}</em><strong>{limpio(ll.nombre)}</strong></span><small>Ver el evento ›</small>
            </button>
          ) : null}
        </div>
        <nav className="pn-acc" aria-label="Lo tuyo">
          <button type="button" onClick={() => est.current && est.current.showModal()}><Ico n="ranking" t={22} /><b>Estadísticas</b><small>Tus números</small></button>
          <a href="#/inventario"><Ico n="tarjetas" t={22} /><b>Inventario</b><small>Tus TAGs</small>
            {mios && mios.nuevos ? <em className="pn-nueva">{mios.nuevos === 1 ? '1 nueva' : mios.nuevos + ' nuevas'}</em> : null}</a>
          <span className="pn-pronto" aria-disabled="true"><Ico n="mira" t={22} /><b>Entrenar</b><small>Pronto</small><em>pronto</em></span>
          <button type="button" className="pn-bat" onClick={() => W.dispatchEvent(new CustomEvent('lg:batallar'))}><Ico n="cruce" t={22} /><b>Batallar</b><small>Busca rival</small></button>
        </nav>
      </div>
      <dialog className="pn-pop pn-est pop-est" ref={est} aria-label="Tus estadísticas" onClick={(e) => { if (e.target === est.current) est.current.close(); }}>
        <PopCab ico="ranking" t="Tus estadísticas" sub={(liga.temp || 'T1') + (yo.pos ? ' · #' + yo.pos + ' de la Temporada' : ' · tus números')} cerrar={() => est.current.close()} />
        <Estadisticas liga={liga} yo={yo} rks={rks} />
      </dialog>
    </div>
  );
}

// ── 🏟️ TU LIGA, O LA QUE TE RECOMENDAMOS (12/11/2026, Dlx: «la posición en tu liga verdadera… y si no está, que se una a
// una liga, recomendación basada en el ELO, actividad y nivel competitivo»). Las ligas de los servidores (`/api/ligas`):
// si estás en alguna, tu puesto en su tabla; si no, la que más se parece a ti entre las que se jugaron en las últimas tres
// semanas: la gente de cada una contra tu ELO, tu OVR y tu Score, con la actividad y tu servidor a favor ──────────────
const LIGA_ACTIVA_DIAS = 21;
function nivelesDe(liga) {
  const elo = {};
  for (const g of ((liga.d.div || {}).d || [])) for (const gg of g || []) for (const x of gg || []) if (x && x[0]) elo[limpio(x[0]).toLowerCase()] = Number(x[1]) || 0;
  return (k) => {
    // ⚠️ quien está más allá de los 200 del lobby no está en `T`: su fila es `liga.yo` (la trae su perfil, App.jsx)
    const f = liga.T[k] || (liga.yo && liga.yo.k === k ? liga.yo : null);
    if (!f) return null;
    return { elo: elo[limpio(f.n).toLowerCase()] || 0, ovr: Number(f.ovr) || 0, sc: Number(f.sc) || 0 };
  };
}
export function recomendarLiga(liga, ls, yoK) {
  const de = nivelesDe(liga);
  const yo = de(yoK);
  if (!yo) return null;
  const ahora = liga.ahora.getTime ? liga.ahora.getTime() : Number(liga.ahora);
  let mejor = null;
  for (const L of ls) {
    const dias = L.ult_t ? (ahora - utc(L.ult_t).getTime()) / 86400000 : 99;
    if (dias > LIGA_ACTIVA_DIAS) continue;
    const gente = Object.values(L.ks || {}).map(de).filter(Boolean);
    if (gente.length < 2) continue;
    const prom = (c) => { const xs = gente.map((g) => g[c]).filter((v) => v > 0); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; };
    const e = prom('elo'), o = prom('ovr'), s = prom('sc');
    let d = 0;
    const por = [];
    if (yo.elo && e) { d += Math.abs(yo.elo - e) / 25; if (Math.abs(yo.elo - e) < 60) por.push('ELO parecido al tuyo'); }
    if (yo.ovr && o) { d += Math.abs(yo.ovr - o) / 5; if (Math.abs(yo.ovr - o) < 8) por.push('nivel parecido (OVR ' + Math.round(o) + ')'); }
    if (yo.sc && s) d += Math.abs(yo.sc - s) / 5;
    d += dias * 0.4;
    if (dias < 3) por.push(dias < 1 ? 'se jugó hoy' : 'activa esta semana');
    const sv = (liga.T[yoK] || liga.yo || {}).sv;
    if (sv && L.sv === sv) { d -= 3; por.push('de tu servidor'); }
    if (!mejor || d < mejor.d) mejor = { L, d, por, n: gente.length };
  }
  return mejor;
}
/** La liga más jugada ahora: activa, con gente, y con más batallas por jugar (después, la que se jugó más recién) */
function masJugada(liga, ls) {
  const ahora = liga.ahora.getTime ? liga.ahora.getTime() : Number(liga.ahora);
  const act = ls.map((L) => ({ L, dias: L.ult_t ? (ahora - utc(L.ult_t).getTime()) / 86400000 : 99, n: Object.keys(L.ks || {}).length }))
    .filter((x) => x.dias <= LIGA_ACTIVA_DIAS && x.n >= 2)
    .sort((a, b) => (b.L.pend || 0) - (a.L.pend || 0) || a.dias - b.dias);
  const x = act[0];
  if (!x) return null;
  return { L: x.L, n: x.n, por: [x.dias < 1 ? 'se jugó hoy' : x.dias < 3 ? 'activa esta semana' : 'activa', siglaDe(x.L.sv)] };
}
export function PnMiLiga({ liga }) {
  const yo = liga.yo;
  const [X, setX] = useState(null);
  useEffect(() => {
    let vivo = true;
    pedirLigas(liga.d.sello).then((x) => { if (vivo) setX(x || {}); });
    return () => { vivo = false; };
  }, [liga.d.sello]);
  const ls = (X && X.lobby && X.lobby.ligas) || [];
  const cab = (t) => <div className="pn-ml-cab"><h4>{t}</h4></div>;
  // 🖼️ el afiche de la liga a la derecha, visible (Dlx, 12/11/2026: «ligas tiene su vacío en la parte derecha»); sin
  // afiche, el escudo de su servidor
  const afiche = (L) => (L.fl ? <img className="pn-ml-afiche" alt="" src={L.fl} />
    : liga.logo(L.sv) ? <img className="pn-ml-afiche logo" alt="" src={liga.logo(L.sv)} /> : null);
  if (!X) return <div className="pn-cu pn-ml">{cab(yo ? 'Tu liga' : 'Ligas')}<small className="pn-gris">{yo ? 'Buscando tu liga…' : 'Buscando las ligas…'}</small></div>;
  // las tuyas: donde estás en la tabla; la que se jugó más recién primero
  const mias = !yo ? [] : ls.map((L) => {
    const i = (L.tabla || []).findIndex((r) => (L.ks || {})[r[0]] === yo.k);
    return i >= 0 ? { L, i, r: L.tabla[i] } : null;
  }).filter(Boolean).sort((a, b) => String(b.L.ult_t || '').localeCompare(String(a.L.ult_t || '')));
  const m = mias[0];
  if (m) {
    const ovrL = ((X.cartas || {})[yo.k] || []).find((c) => c[0] === m.L.id);
    return (
      <a className="pn-cu pn-ml" href={'#/ligas/' + encodeURIComponent(m.L.id)}>
        {m.L.fl ? <img className="pn-ml-fl" alt="" src={m.L.fl} /> : null}
        {afiche(m.L)}
        {cab('Tu liga')}
        <span className="pn-ml-n"><b>{limpio(m.L.n)}</b><small>{siglaDe(m.L.sv)}{mias.length > 1 ? ' · y ' + (mias.length - 1) + ' más' : ''}</small></span>
        <span className="pn-ml-pos"><strong>#{m.i + 1}</strong><small>de {(m.L.tabla || []).length}</small></span>
        <small className="pn-ml-dato">{m.L.pend ? num(m.L.pend) + ' batallas por jugar · ' : ''}{m.L.ult_t ? 'se jugó ' + hace(utc(m.L.ult_t).getTime()) : ''}</small>
        <span className="pn-ml-m">
          <span><i>Puntos</i><b>{num(m.r[3] || 0)}</b></span>
          <span><i>Jugadas</i><b>{num(m.r[1] || 0)}</b></span>
          {ovrL ? <span><i>OVR</i><b>{ovrL[2]}</b></span> : <span><i>Ganadas</i><b>{num(m.r[2] || 0)}</b></span>}
        </span>
        <small className="pn-ml-ir">Ver la liga ›</small>
      </a>
    );
  }
  // 👤 sin fila en el ranking (sin cuenta, o sin jugar todavía; Dlx: «así lo ve una persona nueva… hay botones que
  // desaparecen»): la liga que más se está jugando, en vez de un hueco
  const rec = yo ? recomendarLiga(liga, ls, yo.k) : masJugada(liga, ls);
  if (!rec) {
    return (
      <a className="pn-cu pn-ml" href="#/ligas">{cab('Ligas')}
        <span className="pn-ml-n"><b>Todavía no juegas en ninguna</b><small>Las ligas de los servidores, con su tabla y sus fechas</small></span>
        <small className="pn-ml-ir">Ver las ligas ›</small></a>
    );
  }
  return (
    <a className="pn-cu pn-ml rec" href={'#/ligas/' + encodeURIComponent(rec.L.id)}>
      {rec.L.fl ? <img className="pn-ml-fl" alt="" src={rec.L.fl} /> : null}
      {afiche(rec.L)}
      <div className="pn-ml-cab"><h4>Ligas</h4><em>{yo ? 'Para ti' : 'En juego'}</em></div>
      <span className="pn-ml-n"><small>{yo ? 'Todavía no juegas en una liga. Te recomendamos:' : 'La que más se está jugando:'}</small><b>{limpio(rec.L.n)}</b>
        <small>{siglaDe(rec.L.sv)} · {rec.n} raperos</small></span>
      {rec.por.length ? <span className="pn-ml-por">{rec.por.slice(0, 3).map((p) => <i key={p}>{p}</i>)}</span> : null}
      <small className="pn-ml-dato">{rec.L.pend ? num(rec.L.pend) + ' batallas por jugar · ' : ''}{rec.L.ult_t ? 'se jugó ' + hace(utc(rec.L.ult_t).getTime()) : ''}</small>
      {/* quién va arriba en esa liga: las caras de su tabla, para saber contra quién te tocaría */}
      {(rec.L.tabla || []).length ? <span className="pn-ml-top">{rec.L.tabla.slice(0, 3).map((r, i) => {
        const k = (rec.L.ks || {})[r[0]] || '';
        return <span key={r[0]}><em>{i + 1}</em><Cara liga={liga} k={k} nombre={r[0]} cls="cara pn-ml-c" /><b>{limpio(r[0])}</b><small>{num(r[3] || 0)}</small></span>;
      })}</span> : null}
      <small className="pn-ml-ir">Ver la liga y sumarte ›</small>
    </a>
  );
}

// ── 📊 TUS ESTADÍSTICAS, EN UN POP-UP (12/11/2026, Dlx: «cuando abrir estadísticas que abra un pop up con las estadísticas mías
// en general, no que me mande a mi perfil»). Todo sale de tu fila; abajo, tus últimos eventos y el perfil entero ──────────
function Estadisticas({ liga, yo, rks }) {
  const du = Array.isArray(yo.du) ? yo.du : null;
  const rch = Array.isArray(yo.rch) ? yo.rch : [0, 0];
  // 📊 arriba lo que más se mira, grande (OVR, puntos, Win %); abajo lo demás, y los rankings como barras de cuán arriba vas
  const heroes = [
    ['OVR', yo.ovr || '—', 'Temporada'], ['Puntos', num(yo.pts || 0), yo.pos ? '#' + yo.pos + ' de la Temporada' : ''],
    ['Win %', yo.wr || '—', du ? du[0] + ' de ' + du[1] + ' duelos' : 'sin duelos'],
  ];
  const tiles = [
    ['Eventos', num(yo.ev || 0), ''], ['Podios', num(yo.pod || 0), yo.oro ? yo.oro + ' de oro' : ''],
    ['Racha', rch[0] || 0, 'la mejor: ' + (rch[1] || 0)],
    ['Score', yo.sc ? String(yo.sc) : '—', yo.rg ? 'rango ' + yo.rg : 'sin rango'], ['Cazas', num(yo.caz || 0), yo.czd ? 'te cazaron ' + yo.czd : ''],
    ['Misiones', num(yo.mis || 0), 'puntos'],
  ];
  const ult = (liga.semanaDe(yo.k) || []).slice(0, 5);
  return (
    <div className="pn-est-in">
      <ul className="pop-est-h">{heroes.map(([t, v, s]) => <li key={t}><span>{t}</span><b>{v}</b>{s ? <small>{s}</small> : null}</li>)}</ul>
      <ul className="pn-est-t">{tiles.map(([t, v, s]) => <li key={t}><span>{t}</span><b>{v}</b>{s ? <small>{s}</small> : null}</li>)}</ul>
      <h5>Tus rankings</h5>
      <ul className="pop-rk">{rks.map((x) => {
        const top = x[1] && x[2] ? Math.max(4, Math.round(100 * (1 - (x[1] - 1) / x[2]))) : 0;
        return (
          <li key={x[0]} className={x[1] ? '' : 'vacio'} style={{ '--c': COLOR_RK[x[0]] }}>
            <span>{x[4]}</span><b>{x[1] ? '#' + x[1] : '—'}</b>
            <i aria-hidden="true"><u style={{ width: top + '%' }} /></i>
            <small>{x[1] && x[2] ? 'de ' + num(x[2]) : 'sin puesto'}</small>
          </li>
        );
      })}</ul>
      {ult.length ? (
        <><h5>Tus últimos eventos</h5>
          <ul className="pn-est-u">{ult.map(([ll, r]) => (
            <li key={ll.n}><button type="button" onClick={() => accion.llave(ll.n)}><b>{limpio(ll.nombre)}</b><small>{r} · {liga.dia(liga.fechaLlave(ll))}</small></button></li>
          ))}</ul></>
      ) : Array.isArray(yo.ult) && yo.ult[0] ? <p className="pn-est-nota">Tu último evento: {yo.ult[1]}, el {yo.ult[0].split('-').reverse().slice(0, 2).join('/')}.</p> : null}
      <a className="btn verde chico pn-est-perfil" href={'#/r/' + encodeURIComponent(yo.k)}>Ver mi perfil completo</a>
    </div>
  );
}

// ── 📅 EVENTOS: los de la semana, todos contra los tuyos ─────────────────────────────────────────────────────────
export function PnEventos({ liga, ancho = false }) {
  const ahora = liga.ahora;
  const l0 = lunes(ahora);
  const hoyI = Math.floor((ahora - l0) / DIA_MS);
  const todos = [0, 0, 0, 0, 0, 0, 0];
  for (const c of liga.d.calendario || []) {
    if (liga.canceladoCal(c)) continue;
    const k = Math.floor((utc(c.t) - l0) / DIA_MS);
    if (k >= 0 && k < 7) todos[k] += 1;
  }
  const yo = liga.yo;
  const mios = [0, 0, 0, 0, 0, 0, 0];
  let pasada = 0;
  for (const [ll] of yo ? liga.semanaDe(yo.k) || [] : []) {
    const k = Math.floor((utc(liga.fechaLlave(ll)) - l0) / DIA_MS);
    if (k >= 0 && k < 7) mios[k] += 1; else if (k >= -7 && k < 0) pasada += 1;
  }
  const max = Math.max(1, ...todos);
  const total = todos.reduce((s, x) => s + x, 0);
  const jugaste = mios.reduce((s, x) => s + x, 0);
  const vivos = liga.vivo();
  const ult = (liga.d.pasados || [])[0];
  return (
    <a className={'pn-cu pn-ev' + (ancho ? ' ancho' : '')} href="#/eventos">
      <h4>Eventos{vivos.length ? <span className="pn-vivo">EN VIVO</span> : null}</h4>
      <div className="pn-ev-n"><span className="pn-n">{total}</span><small>esta semana</small></div>
      {yo ? <small className="pn-tuyos">jugaste <b>{jugaste}</b> · la pasada {pasada}</small> : null}
      <div className="pn-barras" aria-label={'Eventos por día: ' + todos.join(', ')}>{todos.map((n, i) => (
        <i key={i} className={i < hoyI ? 'si' : i === hoyI ? 'hoy' : ''} style={{ height: (i <= hoyI ? Math.max(8, Math.round((100 * n) / max)) : 8) + '%' }}>
          {mios[i] ? <u style={{ height: Math.round((100 * Math.min(mios[i], n || 1)) / Math.max(1, n)) + '%' }} /> : null}</i>))}</div>
      <div className="pn-letras" aria-hidden="true">{LETRAS.map((l, i) => <span key={i}>{l}</span>)}</div>
      {yo ? <div className="pn-ley"><span><i className="t" />Todos</span><span><i className="y" />Tú</span></div> : null}
      {ult ? <span className="pn-ult3">{liga.logo(ult.sv) ? <img alt="" src={liga.logo(ult.sv)} /> : null}<span>Último: {limpio(ult.nombre)}</span></span> : null}
    </a>
  );
}

// ── 🛡️ CREW: la tuya, o súmate (en el lugar del Ranking, que ya está arriba) ─────────────────────────────────────
export function PnCrew({ liga }) {
  const yo = liga.yo;
  // 🗑️ la lista en vivo, si tienes perfil: borrar tu crew, salir o entrar a una se ve al instante (`liga.crewDe()`)
  useCrews(yo ? 'todas' : 'nada');
  const mia = yo ? liga.crewDe(yo) : null;
  const ct = liga.d.crews_tiers || {};
  const tierDe = (c) => { const t = ((ct.crews || {})[c.clave || c.crew] || [])[0]; return t != null ? [(ct.nombres || [])[t], (ct.colores || [])[t]] : null; };
  const crews = (liga.d.crews || []).filter((c) => c.rk !== 0);
  // 🛡️ el escudo grande de fondo, como la maqueta (`.grande`): decorado, no dice nada
  const fondo = <svg className="pn-cr-fondo" viewBox="0 0 100 114" aria-hidden="true"><path d="M50 2 96 18v38c0 28-20 46-46 56C24 102 4 84 4 56V18Z" fill="currentColor" /></svg>;
  // las de la lista, también las que todavía no tienen puesto (menos de 3): eran 2 donde la maqueta mostraba 3
  const todas = conCrewsVivas(liga.d.crews || []).slice().sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const logo = (c, cls) => (escudoDe(c.logo, limpio(c.crew)) ? <span className={cls}><Escudo e={escudoDe(c.logo, limpio(c.crew))} /></span>
    : c.logo ? <img className={cls} alt="" src={srcLogo(c.logo)} /> : <span className={cls + ' ini'}>{limpio(c.crew).slice(0, 2).toUpperCase()}</span>);
  if (mia) {
    const i = crews.findIndex((c) => c.crew === mia.crew);
    const t = tierDe(mia);
    // 📈 la semana: cuánto lleva contra lo que pide subir de tier (`crews_tiers`: [tier, puntos de la semana, …])
    const fila = (ct.crews || {})[mia.clave || mia.crew] || [];
    const tier = fila[0] != null ? fila[0] : null;
    const sube = tier != null ? (ct.sube || [])[tier] : null;
    const sig = tier != null ? (ct.nombres || [])[tier + 1] : null;
    const semana = Number(fila[1]) || 0;
    const gente = mia.gente || [];
    return (
      <a className="pn-cu pn-cr" href={'#/crew/' + encodeURIComponent(mia.clave || mia.crew)}>
        {fondo}
        <h4>Tu crew</h4>
        <span className="pn-cr-tu">{logo(mia, 'pn-cr-logo')}<span><b>{limpio(mia.crew)}</b>{t ? <em style={{ color: t[1] }}>{t[0]}</em> : null}</span></span>
        {gente.length ? <span className="pn-cr-gente">{gente.slice(0, 6).map((n) => { const f = liga.fila(n); return <Cara key={n} liga={liga} k={f ? f.k : ''} nombre={n} cls="pn-cr-cara" />; })}
          {gente.length > 6 ? <i>+{gente.length - 6}</i> : null}</span> : null}
        {sube && sig ? (
          <span className="pn-cr-meta" style={{ '--c': (ct.colores || [])[tier + 1] || '#E8B923' }}>
            <small>Para {sig} esta semana</small><i aria-hidden="true"><u style={{ width: Math.min(100, Math.round((100 * semana) / sube)) + '%' }} /></i>
            <small><b>{num(semana)}</b> de {num(sube)}</small>
          </span>
        ) : null}
        {/* 🛡️ sin hueco (12/11/2026, Dlx: «tu crew tiene un hueco»): su puesto entre las crews arriba a la derecha y sus
            números en cajitas, como las demás piezas del panel */}
        {i >= 0 ? <span className="pn-cr-pos"><strong>#{i + 1}</strong><small>de {crews.length}</small></span>
          : t ? <span className="pn-cr-pos tier"><strong style={{ color: t[1] }}>{t[0]}</strong><small>su tier</small></span> : null}
        <span className="pn-cr-m">
          <span><i>Puntos</i><b>{num(mia.pts || 0)}</b></span>
          <span><i>Raperos</i><b>{num(mia.n || gente.length)}</b></span>
          <span><i>Esta semana</i><b>{num(semana)}</b></span>
        </span>
      </a>
    );
  }
  return (
    <a className="pn-cu pn-cr" href="#/crews">
      {fondo}
      <h4>Crew</h4>
      <span className="pn-q">Sin crew</span><small>Súmate a una o arma la tuya</small>
      <ul className="pn-cr-l">{todas.slice(0, 3).map((c) => { const t = tierDe(c); return (
        <li key={c.crew}>{logo(c, 'pn-cr-mini')}<b>{limpio(c.crew)}</b>{t ? <em style={{ color: t[1] }}>{t[0]}</em> : null}</li>); })}</ul>
    </a>
  );
}

// ── 🎯 MISIONES, con los carteles de Se busca ─────────────────────────────────────────────────────────────────────
export function PnMisiones({ liga, chica = false }) {
  const M = liga.d.mis || {};
  const lista = M.lista || [];
  const yo = liga.yo;
  const mio = yo ? Object.keys(M.prog || {}).find((raw) => liga.esDe(raw, yo.k)) : null;
  const hechas = mio ? lista.filter((x, i) => ((M.prog[mio] || [])[i] || 0) >= x.m).length : 0;
  const mw = liga.d.mw || {};
  const sueltos = (mw.b || []).filter((b) => b.e !== 'cazado' && b.e !== 'escondio' && !(yo && b.k === yo.k))
    .sort((a, b) => (Number(b.v) || 0) - (Number(a.v) || 0)).slice(0, 3);
  const nSueltos = (mw.b || []).filter((b) => b.e !== 'cazado' && b.e !== 'escondio').length;
  const teBuscan = !!(yo && liga.buscado(yo.k));
  const dlg = useRef(null);
  if (!lista.length && !sueltos.length) return null;
  const prog = (mio && M.prog[mio]) || [];
  const todos = (mw.b || []).slice().sort((a, b) => (a.e === 'suelto' ? 0 : 1) - (b.e === 'suelto' ? 0 : 1) || (Number(b.v) || 0) - (Number(a.v) || 0));
  const ESTADO = { suelto: 'suelto', cazado: 'cazado', escondio: 'se escondió', sobrevivio: 'sobrevivió' };
  return (
    <>
    <dialog className="pn-pop pn-mis-pop pop-mis" ref={dlg} aria-label="Misiones y Most Wanted" onClick={(e) => { if (e.target === dlg.current) dlg.current.close(); }}>
      <PopCab ico="mira" t="Misiones y Most Wanted" sub={(lista.length ? hechas + ' de ' + lista.length + ' misiones' : '') + (lista.length && todos.length ? ' · ' : '') + (todos.length ? nSueltos + (nSueltos === 1 ? ' suelto' : ' sueltos') : '')}
        cerrar={() => dlg.current.close()} />
      <div className="pn-mis-in">
        {lista.length ? (
          <section><h5>Las misiones de la semana{M.bono ? <span className="pn-bono">+{num(M.bono)} si haces todas</span> : null}</h5>
            <span className="pop-seg" aria-hidden="true">{lista.map((x, i) => <i key={x.id} className={i < hechas ? 'si' : ''} />)}</span>
            <ul className="pn-mis-l">{lista.map((x, i) => {
              const v = Math.min(x.m, prog[i] || 0);
              return (
                <li key={x.id} className={v >= x.m ? 'hecha' : ''}>
                  <span className="pop-n" aria-hidden="true">{v >= x.m ? '✓' : i + 1}</span>
                  <span><b>{x.t}</b><small>{v >= x.m ? '✓ hecha' : v + ' de ' + x.m}</small></span>
                  <em>+{num(x.p)}</em>
                  <i aria-hidden="true"><u style={{ width: Math.round((100 * v) / Math.max(1, x.m)) + '%' }} /></i>
                </li>
              );
            })}</ul></section>
        ) : null}
        {todos.length ? (
          <section><h5>Most Wanted<small>{nSueltos} {nSueltos === 1 ? 'suelto' : 'sueltos'}</small></h5>
            <ul className="pn-mw-l">{todos.map((b) => (
              <li key={b.k} className={b.e}>
                <Cara liga={liga} k={b.k} nombre={b.n} cls="pn-mw-c" />
                <span><b>{limpio(b.n)}</b><small>{b.cn || ''}{b.m ? ' · ' + b.m : ''}</small></span>
                <span className="pn-mw-v"><strong>{num(Number(b.v) || 0)}</strong><small>{ESTADO[b.e] || b.e}</small></span>
              </li>
            ))}</ul></section>
        ) : null}
        <div className="pn-mis-pie"><a className="btn borde2 chico" href="#/ranking/misiones">Ranking de misiones</a><a className="btn borde2 chico" href="#/ranking/mw">Ranking del Most Wanted</a></div>
      </div>
    </dialog>
    <a className={'pn-cu pn-mi' + (chica ? ' chica' : '')} href={sueltos.length ? '#/ranking/mw' : '#/ranking/misiones'}
      onClick={(e) => { if (dlg.current && dlg.current.showModal) { e.preventDefault(); dlg.current.showModal(); } }}>
      <div className="pn-mi-cab"><h4>Misiones</h4>{M.bono ? <span className="pn-bono">+{num(M.bono)} de bono</span> : null}</div>
      <span className="pn-mi-sub">{lista.length ? <span className="pn-sellos" aria-label={hechas + ' de ' + lista.length}>{lista.map((x, i) => <i key={x.id} className={i < hechas ? 'si' : ''} />)}</span> : null}
        <small>{teBuscan ? 'Te buscan a ti · ' : ''}{nSueltos} {nSueltos === 1 ? 'sigue suelto' : 'siguen sueltos'}</small></span>
      {sueltos.length ? <span className="pn-carteles">{sueltos.map((b) => (
        <span key={b.k} className="pn-cartel"><em>SE BUSCA</em><Cara liga={liga} k={b.k} nombre={b.n} cls="pn-cartel-c" /><b>{limpio(b.n)}</b><span>{num(Number(b.v) || 0)}</span></span>
      ))}</span> : null}
    </a>
    </>
  );
}

// ── 🎟️ EL PASE, decorativo: tu nivel en un hexágono, la pista y lo que viene después del último ─────────────────────
export function PnPase({ dc, chico = false }) {
  const P = usePase(!!dc);
  // ⚠️ `avance()` es null en el último nivel (no hay siguiente): con el 30 completo decía «para los miembros de DRA» (Dlx)
  const mio = !!(P && P.listo && P.miembro);
  const a = mio ? avance(P) || { falta: 0 } : null;
  const niveles = (P && P.niveles) || 30;
  const nivel = a ? P.nivel || 0 : 0;
  const tramos = 10;
  const llenos = Math.round((nivel / niveles) * tramos);
  return (
    <a className={'pn-cu pn-pa' + (chico ? ' chico' : '')} href="#/pase">
      <h4>Pase rapero</h4>
      <span className="pn-nv"><span className="pn-hex">{a ? nivel : niveles}</span>
        <span><b>{a ? 'Nivel ' + nivel + ' de ' + niveles : niveles + ' niveles'}</b>
          <small>{a ? (a.falta ? 'te faltan ' + num(a.falta) + ' XP para el ' + (nivel + 1) : '¡lo completaste!') : dc && P && P.listo ? 'para los miembros de DRA' : 'Tareas que dan premios'}</small></span></span>
      {a && a.de ? <span className="pn-xp" aria-label={num(a.lleva) + ' de ' + num(a.de) + ' XP'}><i><u style={{ width: Math.round((100 * a.lleva) / a.de) + '%' }} /></i><small>{num(a.lleva)} / {num(a.de)} XP</small></span>
        : mio ? <span className="pn-xp lleno"><i><u style={{ width: '100%' }} /></i><small>Pase completo</small></span> : null}
      <span className="pn-pista" aria-hidden="true">{Array.from({ length: tramos }, (_, j) => <i key={j} className={(j < llenos ? 'si' : '') + ((j + 1) % 5 === 0 ? ' hito' : '')} />)}</span>
      <span className="pn-cola"><Ico n="premio" t={20} /><small>Del {niveles} en adelante, un Dragón Drop cada 3.000 XP y más Puntos</small></span>
    </a>
  );
}

// ── 🛍️ Tienda y 📅 La semana, en la misma línea ──────────────────────────────────────────────────────────────────
export function PnTienda({ saldo, dc, cuadro = false, liga = null }) {
  const valor = typeof W.valorCabezas === 'function' ? W.valorCabezas() || {} : {};
  const tope = Object.values(valor).reduce((m, v) => Math.max(m, Number(v) || 0), 0);
  const mios = useMios(dc);
  // 🔁 cuadrada, en el lugar de Eventos (12/11/2026, Dlx: «intercambiar tienda x eventos»)
  if (cuadro) {
    // 🛍️ COMO UNA TIENDA DE VERDAD (12/11/2026, Dlx: «creo que tienda… puede ser mejor»): la cabeza más cara con su cara
    // (lo que más se mira), y lo que se vende hoy con su precio y si te alcanza (los mismos que `Catalogo` de tienda2.jsx)
    const T = liga.d.tienda || {};
    const caraK = Object.keys(valor).reduce((m, k) => (!m || (Number(valor[k]) || 0) > (Number(valor[m]) || 0) ? k : m), '');
    const fc = caraK ? liga.fila(caraK) : null;
    const tieneCrew = !!(liga.yo && liga.crewDe(liga.yo));
    const items = [
      ['mira', 'Precio por cabeza', Number(T.min) || 500, true],
      ['novedades', '+1 semana de tu promo', 2500, false],
      tieneCrew ? null : ['crews', 'Fundar tu crew', 2500, false],
    ].filter(Boolean);
    return (
      <a className="pn-cu pn-ti2" href="#/tienda">
        <div className="pn-ti2-cab"><h4>Tienda</h4>
          <span className="pn-ti2-bill"><i aria-hidden="true">$</i><b>{saldo != null ? num(saldo) : '—'}</b></span></div>
        {tope ? (
          <span className="pn-ti2-top">
            <Cara liga={liga} k={fc ? fc.k : ''} nombre={fc ? fc.n : caraK} cls="cara pn-ti2-c" />
            <span><em>La cabeza más cara</em><b>{limpio(fc ? fc.n : caraK)}</b></span>
            <strong>{num(tope)}</strong>
          </span>
        ) : null}
        <span className="pn-ti2-l">
          {items.map(([ic, t, p, desde]) => {
            const ok = saldo != null && saldo >= p;
            return (
              <span key={t} className={ok ? 'si' : ''}><Ico n={ic} t={16} /><i>{t}</i>
                <strong>{desde ? 'desde ' : ''}{num(p)}</strong><u aria-label={ok ? 'te alcanza' : 'no te alcanza'}>{ok ? '✓' : '–'}</u></span>
            );
          })}
        </span>
        <small className="pn-ti2-ir">{mios && mios.marcos != null ? num(mios.marcos) + ' marcos · ' : ''}Ir a la Tienda ›</small>
      </a>
    );
  }
  return (
    <a className="pn-baja-t pn-ti" href="#/tienda">
      <span className="pn-ti-ic" aria-hidden="true">$</span>
      <span className="pn-baja-tx"><b>Tienda</b>{saldo != null ? <span className="pn-saldo">{num(saldo)}</span> : null}<small>{saldo != null ? 'Puntos para gastar' : 'Tus Puntos de Tienda'}</small></span>
      <span className="pn-minis">
        {tope ? <span className="pn-mini con-ico"><Ico n="mira" t={16} /><span>La cabeza más cara</span><strong>{num(tope)}</strong></span> : null}
        {mios && mios.marcos != null ? <span className="pn-mini con-ico"><Ico n="tarjetas" t={16} /><span>Marcos</span><strong>{num(mios.marcos)}</strong></span> : null}
        {mios && mios.tags != null ? <span className="pn-mini con-ico"><Ico n="premio" t={16} /><span>TAGs</span><strong>{typeof mios.tags === 'number' ? num(mios.tags) : mios.tags}</strong></span> : null}
      </span>
    </a>
  );
}
export function PnSemana({ liga, chica = false }) {
  const C = useCompetencias();
  if (!C || !C.ligas) return null;
  const dia = C.dia || 1;
  const yo = liga.yo;
  const d = yo ? dondeEstoy(C, yo.k) : null;
  const copa = d && d.copa ? (d.copa.campeon ? 'Campeón' : d.copa.fuera ? 'Afuera' : (d.copa.ronda || {}).r || '—') : String((C.copa || []).length);
  const rapid = d && d.rapid ? (d.rapid.campeon ? 'Campeón' : d.rapid.fuera ? 'Afuera' : (d.rapid.ronda || {}).r || '—') : String((C.rapid || []).length);
  // ⚔️ tus duelos de esta semana y el rival más fuerte que te tocó (Dlx, 12/11/2026)
  const cr = yo ? liga.crucesDe(yo.k, { desde: liga.desdeLunes() }) : null;
  // ✂️ chica, en la mitad de abajo del Pase (12/11/2026, Dlx: «dividir pase rapero a la mitad y poner ahí la semana»)
  const metaL = (C.mini || []).find((x) => x.id === 'meta' && x.objetivo);
  const eq = (C.equipo || [])[0];
  if (chica) {
    return (
      <a className="pn-cu pn-se2" href="#/competencias" style={{ '--p': Math.round((dia / 7) * 100) }}>
        <div className="pn-se2-cab"><h4>La semana</h4><span className="pn-anillo"><b>{dia}/7</b></span></div>
        <span className="pn-dias7" aria-hidden="true">{LETRAS.map((l, j) => <i key={j} className={j + 1 < dia ? 'si' : j + 1 === dia ? 'hoy' : ''}>{l}</i>)}</span>
        <span className="pn-se2-m">
          {cr ? <span className="pn-gpm"><i>Duelos</i><strong><b className="g">{cr.g}</b>G <b className="p">{cr.p}</b>P</strong></span> : null}
          <span><i>Ligas</i><strong>{d && d.liga ? d.liga.pos + '.º' : 'J' + (C.ligas.jornada || 1)}</strong></span>
          <span><i>Copa</i><strong>{copa}</strong></span>
          <span><i>Rapid</i><strong>{rapid}</strong></span>
        </span>
        {cr && cr.fuerte ? <small className="pn-se2-r">Rival más fuerte: <b>{cr.fuerte.n}</b> #{cr.fuerte.pos}</small> : null}
        {/* 📅 más vida (12/11/2026, Dlx: «la semana y ligas se ve sin vida… agrega más cosas»): cuándo cierra y cuántos
            compiten, la meta de toda la Liga y el mejor del equipo de la semana */}
        <span className="pn-se2-x">
          <small>{C.fin ? <>Cierra en <b>{faltaTxt(C.fin)}</b></> : null}{C.activos ? <> · <b>{num(C.activos)}</b> compiten</> : null}</small>
          {metaL ? <span className="pn-se2-meta"><i>{metaL.nombre}</i><b>{num(metaL.n)}/{num(metaL.objetivo)}</b>
            <u aria-hidden="true"><s style={{ width: Math.min(100, Math.round((100 * metaL.n) / Math.max(1, metaL.objetivo))) + '%' }} /></u></span> : null}
          {eq ? <small className="pn-se2-eq">Equipo de la semana: <b>{limpio(nombreDe(liga, C, eq[0]))}</b> · {String(eq[1]).replace('.', ',')}</small> : null}
        </span>
      </a>
    );
  }
  return (
    <a className="pn-baja-t pn-se" href="#/competencias" style={{ '--p': Math.round((dia / 7) * 100) }}>
      <span className="pn-anillo"><b>{dia}/7</b></span>
      <span className="pn-baja-tx"><b>La semana</b><small>Competencias ›</small>
        <span className="pn-dias7" aria-hidden="true">{LETRAS.map((l, j) => <i key={j} className={j + 1 < dia ? 'si' : j + 1 === dia ? 'hoy' : ''}>{l}</i>)}</span></span>
      {cr ? <span className="pn-mini pn-gpm"><span>Duelos</span><strong><b className="g">{cr.g}</b>G <b className="p">{cr.p}</b>P</strong></span> : null}
      {cr && cr.fuerte ? <span className="pn-mini pn-rivm"><span>Rival más fuerte</span>
        <strong><Cara liga={liga} k={cr.fuerte.k} nombre={cr.fuerte.n} cls="cara pn-rivm-c" /><em>{cr.fuerte.n}</em><i>#{cr.fuerte.pos}</i></strong></span> : null}
      <span className="pn-mini"><span>Ligas</span><strong>{d && d.liga ? d.liga.pos + '.º' : 'J' + (C.ligas.jornada || 1)}</strong></span>
      <span className="pn-mini"><span>Copa</span><strong>{copa}</strong></span>
      <span className="pn-mini"><span>Rapid</span><strong>{rapid}</strong></span>
    </a>
  );
}

// ── 🏠 TU SERVIDOR (12/11/2026, Dlx: «al costado de eventos… hay un espacio, posicionemos todo bien»): lo que el panel no
// mostraba en ningún lado: el multiplicador de esta semana, la guerra de servidores, la meta de raperos de la semana, tu
// puesto ahí y su próximo evento. El servidor es el que elegiste o, si no, donde más jugaste (el de tu carta de Servidor)
export function PnServidor({ liga }) {
  const yo = liga.yo;
  const el = useElegidos();
  const M = liga.d.mult || {};
  // 👤 sin servidor tuyo (sin cuenta o sin jugar): el servidor de la semana, el del multiplicador más alto, en vez de un hueco
  const delaSemana = () => Object.keys(M.sv || {}).sort((a, b) => (M.sv[b] - M.sv[a]) || (a < b ? -1 : 1))[0] || '';
  const propio = yo ? svElegido(liga, el, yo.k) || yo.sv : '';
  const sv = propio || delaSemana();
  if (!sv) return null;
  const x = (M.sv || {})[sv];
  const par = (((M.guerra || {}).pares) || []).find((pp) => pp.includes(sv));
  const rival = par ? par.find((y) => y !== sv) : '';
  const meta = (M.metas || {})[sv] || 0;
  const va = (M.meta_va || {})[sv] || 0;
  const delSv = liga.oficiales().filter((f) => f.sv === sv).sort((a, b) => a.pos - b.pos);
  const i = yo ? delSv.findIndex((f) => f.k === yo.k) : -1;
  const ev = liga.luego().find((e) => e.sv === sv) || null;
  const evT = ev ? utc(liga.cuandoDe(ev)).toISOString() : '';
  // 🏠 más cosas (Dlx: «tu servidor, que haya más cosas, hay un espacio vacío»): sus tres de arriba, los eventos de esta
  // semana y si le toca el dorado
  const top = delSv.slice(0, 3);
  const lun = liga.desdeLunes();
  const evSem = (liga.d.calendario || []).filter((c) => c.sv === sv && utc(c.t) >= lun && utc(c.t) <= liga.ahora).length;
  const dorado = !!(M.dorado && M.dorado.sv === sv);
  // y su último evento (todos los servidores tienen uno, aunque nadie de ahí esté entre los 200 del lobby)
  const ultSv = (liga.d.calendario || []).filter((c) => c.sv === sv && utc(c.t) <= liga.ahora).sort((a, b) => utc(b.t) - utc(a.t))[0]
    || (() => { const ll = liga.llavesPorFecha().find((x) => x.sv === sv); return ll ? { n: ll.nombre, t: liga.fechaLlave(ll) } : null; })();
  return (
    <a className="pn-baja-t pn-sv" href={'#/sv/' + encodeURIComponent(sv)}>
      {liga.logo(sv) ? <img className="pn-sv-logo" alt="" src={liga.logo(sv)} /> : <span className="pn-sv-logo">{siglaDe(sv)}</span>}
      <span className="pn-baja-tx"><b>{propio ? 'Tu servidor' : 'Servidor de la semana'}</b><small>{siglaDe(sv)}{i >= 0 ? ' · tú vas #' + (i + 1) + ' de ' + delSv.length : ''}</small>
        {/* ✅ sólo lo que hay (Dlx, 12/11/2026, la regla de «ninguna sección se dibuja vacía»): sin próximo evento, el último;
            los eventos de la semana sólo si hubo, y el dorado si le toca */}
        {ev ? <small className="pn-sv-ev">Próximo: {limpio(ev.nombre)} · en {faltaTxt(evT)}</small>
          : ultSv ? <small className="pn-sv-ev">Último: {limpio(ultSv.n)} · hace {hace(utc(ultSv.t).getTime())}</small> : null}
        {evSem || dorado ? <small>{evSem ? evSem + (evSem === 1 ? ' evento' : ' eventos') + ' esta semana' : ''}{evSem && dorado ? ' · ' : ''}{dorado ? '✨ es el servidor dorado' : ''}</small> : null}
        {!ev && !ultSv && delSv.length ? <small>{delSv.length} {delSv.length === 1 ? 'rapero' : 'raperos'} de aquí en el ranking</small> : null}</span>
      {top.length ? <span className="pn-sv-top">{top.map((f, j) => (
        <span key={f.k}><em>{j + 1}</em><Cara liga={liga} k={f.k} nombre={f.n} cls="cara pn-sv-c" /><b>{limpio(f.n)}</b></span>
      ))}</span> : null}
      {/* 📐 LAS TRES CAJAS, JUNTAS Y DEL MISMO ANCHO (Dlx, 13/11/2026: «posiciona bien… las cosas dentro de tu servidor»):
          sueltas con `space-between` quedaban a distintas alturas y con huecos desparejos */}
      {x || rival || meta ? <span className="pn-sv-st">
        {x ? <span className="pn-mini"><span>Esta semana</span><strong>×{String(x).replace('.', ',')}</strong></span> : null}
        {/* ⚔️ la guerra de servidores, con los dos escudos: lo que más dice esta caja */}
        {rival ? <span className="pn-sv-gu" aria-label={'Guerra de servidores: ' + siglaDe(sv) + ' contra ' + siglaDe(rival)}>
          <i>Guerra</i>
          <span>{liga.logo(sv) ? <img alt="" src={liga.logo(sv)} /> : <b>{siglaDe(sv)}</b>}<em>VS</em>{liga.logo(rival) ? <img alt="" src={liga.logo(rival)} /> : <b>{siglaDe(rival)}</b>}</span>
          <small>{siglaDe(sv)} contra {siglaDe(rival)}</small>
        </span> : null}
        {meta ? <span className="pn-mini pn-sv-meta"><span>Meta de la semana</span><strong>{num(va)}/{num(meta)}</strong>
          <i aria-hidden="true"><u style={{ width: Math.min(100, Math.round((100 * va) / meta)) + '%' }} /></i></span> : null}
      </span> : null}
    </a>
  );
}
