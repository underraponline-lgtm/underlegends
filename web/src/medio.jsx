// El medio del Inicio: Fechas, Lo último, Los que mandan y el panel de abajo. Traducido de docs/remake/reales.py
// (fechas, noticias, raperos, panel, tus_eventos, tu_temporada, numeros).
import { DIAS, hora, ksDe, limpio, minutosDelDia, num, resultado, siglaDe, srcLogo, utc } from './liga.js';
import { miReaccion, reaccionesDe, useAplausos } from './aplausos.js';
import { PjDentro, autorDe, comentarAca, delHilo, pjDe, pjFondo, useComentarios } from './comentarios.jsx';
import { Escudo, escudoDe } from './escudo.jsx';
import { Algunos, Alguien, Bandera, Cara, Carta, Compartir, Ico, Pest, Rango, Sec, aDiscord, accion, enlace, nombrePais } from './piezas.jsx';
import { FondoPropio } from './fondo_propio.jsx';
import { avance, premioTexto, proximoEspecial, usePase, usePases } from './pase.js';
import { SelloPremium, esPremium } from './sello.jsx';
import { useEffect, useRef, useState } from 'react';
import { ComentariosFlotantes } from './flotantes.jsx';
import { pedirLigas } from './ligas_datos.js';
import { NombreT } from './puesto.js';

// 🗓️ HOY SUELE HABER (Dlx, 12/10/2026, «5. B»: casi todos anuncian a último momento, así que lo que no se ve con
// tiempo se adivina por costumbre). Un servidor que jugó este mismo día de la semana dos veces o más en las últimas
// cuatro semanas y todavía no anunció nada para hoy: «suele jugar · 18:00», marcado como probable. ⚠️ Sólo hasta una
// hora después de su hora de siempre: más tarde, ya no va a pasar. Como mucho dos, para no tapar lo anunciado
function sueleHoy(liga) {
  const hoy = liga.diaClave(liga.ahora);
  if (!hoy) return [];
  const dow = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); };
  const dHoy = dow(hoy);
  const ya = new Set();
  liga.vivo().concat(liga.luego()).forEach((e) => { if (liga.diaClave(liga.cuandoDe(e)) === hoy) ya.add(e.sv); });
  const por = {};
  (liga.d.calendario || []).forEach((c) => {
    const t = utc(c.t);
    if (!c.sv || isNaN(t)) return;
    const k = liga.diaClave(t);
    if (k === hoy) { ya.add(c.sv); return; }
    if (c.fut || t > liga.ahora || liga.ahora - t > 28 * 864e5 || dow(k) !== dHoy) return;
    (por[c.sv] = por[c.sv] || []).push(t);
  });
  const ahoraM = minutosDelDia(liga.ahora);
  return Object.entries(por).filter(([sv, ts]) => ts.length >= 2 && !ya.has(sv)).map(([sv, ts]) => {
    const xs = ts.map((t) => [minutosDelDia(t), t]).sort((a, b) => a[0] - b[0]);
    const [m, t] = xs[Math.floor((xs.length - 1) / 2)];
    return { sv, m, t, n: ts.length };
  }).filter((x) => ahoraM <= x.m + 60).sort((a, b) => a.m - b.m).slice(0, 2);
}

// ── Fechas ────────────────────────────────────────────────────────────────────────────────────────
export function Fechas({ liga }) {
  const t = [];
  // 🔑 (18/11/2026) sin hora que se pueda leer (`sin_hora`), su «cuando» es el de publicación: decía «empezó» a la hora en
  // que se anunció
  liga.vivo().forEach((e) => t.push({ c: 'vivo', dia: 'HOY', hora: '● EN VIVO' + (e.sin_hora ? '' : ' · empezó ' + liga.dia(e.cuando).replace(/^hoy /, '')), sv: e.sv, ev: limpio(e.nombre),
    det: e.modalidad || 'se mira en Discord', link: (aDiscord(liga, e, true) || {}).url }));
  // ⏸ lo que el organizador pausó —«seguimos mañana»—: ni en vivo ni terminado (ver `liga.estado()`)
  liga.pausados().forEach(({ e, st }) => t.push({ c: 'pausado', dia: 'HOY', hora: '⏸ EN PAUSA', sv: e.sv, ev: limpio(e.nombre),
    det: liga.estadoTexto(st, e), link: (aDiscord(liga, e, true) || {}).url }));
  liga.luego().forEach((e) => {
    const dor = liga.esDorado(e.nombre, e.sv);
    const det = [e.modalidad, e.cupos ? 'cupos ' + String(e.cupos).toLowerCase() : ''].filter(Boolean).join(' · ');
    // ⏰ el que se atrasó, con su hora nueva y dicho
    const cu = liga.cuandoDe(e);
    const st = liga.estado(e) || {};
    const atr = st.tipo === 'atrasado';
    // 🔑 (18/11/2026) y el anunciado sin hora que se pueda leer (`sin_hora`, a lo sumo 3 h después de publicado: ver
    // `SIN_HORA_H` de bot/subir_web.py) viene con la de publicación, que ya pasó: salía como si arrancara a esa hora.
    // ⏰ Salvo que el organizador haya dicho la hora nueva (`nueva`, 18/11/2026) y todavía no llegó: ésa sí se lee, y
    // decía «anunciado …»
    const sh = e.sin_hora && !(atr && st.nueva && utc(cu) > liga.ahora);
    t.push({ c: dor ? 'dorado' : atr ? 'pausado' : '', dia: sh ? 'HOY' : liga.dia(cu).split(' ')[0].toUpperCase(),
      hora: sh ? 'anunciado ' + liga.cuando(e.cuando) : (atr ? '⏰ ' : '') + hora(cu) + (atr ? ' · se atrasó' : ' · tu hora'),
      sv: e.sv, ev: limpio(e.nombre), det, badge: dor ? 'DORADO ×3' : '', link: (aDiscord(liga, e, false) || {}).url });
  });
  // 🗓️ lo que suele haber hoy y todavía no se anunció (ver `sueleHoy()`)
  sueleHoy(liga).forEach((x) => t.push({ c: 'suele', dia: 'HOY', hora: 'SUELE JUGAR · ' + hora(x.t), sv: x.sv,
    ev: (liga.svs[x.sv] || {}).nombre || siglaDe(x.sv), det: 'probable · todavía sin anuncio' }));
  // 🔴 lo que se canceló (el vigía vio que el anuncio se borró, ver `liga.cancelados()`): dice «CANCELADO» hasta seis
  // horas después de la hora en que era, en vez de desaparecer como si nada (Dlx, 01/10/2026: «B»). Uno borrado y vuelto
  // a publicar no: ver `cancelacionesVisibles()`
  liga.cancelacionesVisibles().forEach((c) => {
    const ini = c.ini ? new Date(c.ini) : null;
    if (ini && (liga.ahora - ini) > 6 * 3600000) return;
    t.push({ c: 'cancelado', dia: ini ? liga.dia(ini).split(' ')[0].toUpperCase() : 'HOY', hora: 'CANCELADO',
      sv: c.sv, ev: limpio(c.n), det: ini ? 'era a las ' + hora(ini) : 'el servidor lo canceló' });
  });
  // y lo que se canceló con el anuncio en pie: le borraron la llave y no hubo otra (LA REDENCION, 03/10/2026, ver
  // `liga.canceladoCal()`). Las mismas seis horas
  (liga.d.calendario || []).forEach((c) => {
    const ini = utc(c.t);
    if (liga.ahora - ini < 0 || liga.ahora - ini > 6 * 3600000 || !liga.canceladoCal(c)) return;
    if (t.some((x) => x.c === 'cancelado' && x.sv === c.sv && x.ev.toLowerCase() === limpio(c.n).toLowerCase())) return;
    t.push({ c: 'cancelado', dia: liga.dia(ini).split(' ')[0].toUpperCase(), hora: 'CANCELADO', sv: c.sv, ev: limpio(c.n),
      det: 'era a las ' + hora(ini) });
  });
  // 🔑 lo que terminó recién y el ciclo todavía no procesó (la NAVE DE EXTERMINACIÓN, 03/10/2026): con su campeón y su
  // llave, hasta que llegue la procesada. Ver `liga.recienTerminadas()`
  // 🪪 el campeón con su cara y su nombre oficial (17/11/2026); sin link: la tarjeta entera ya lleva a la llave
  liga.recienTerminadas().forEach(({ L, e, camp, campN }) => {
    t.push({ c: 'hecho', dia: liga.cuando(new Date(L.ed || L.pub)).toUpperCase(),
      hora: 'TERMINÓ' + (L.participantes ? ' · ' + L.participantes + ' raperos' : ''), sv: L.sv || (e && e.sv) || '',
      ev: limpio((e && e.nombre) || L.nombre), det: camp ? <>{campN.length > 1 ? 'Campeones: ' : 'Campeón: '}<Algunos liga={liga} nombres={campN} link={false} /></> : 'los puntos llegan en un rato', llave: 'v:' + L.id });
  });
  // lo que pasó, hasta completar la fila de cinco de la compu (de diez si lo que viene ya pasa de cinco): con tres
  // fijas, sin nada anunciado quedaban dos lugares vacíos al lado (Dlx, 02/10/2026: «un espacio tan grande vacío»)
  const fila = t.length > 4 ? 10 : 5;
  // y por FECHA, del más nuevo al más viejo: el número de la llave es el orden en que se cargó, y con cinco «ayer» salía
  // después de «el miércoles»
  const porFecha = liga.llaves().slice().sort((a, b) => utc(liga.fechaLlave(b)) - utc(liga.fechaLlave(a)));
  porFecha.slice(0, Math.max(t.length > 4 ? 0 : 1, fila - t.length)).forEach((ll) => {
    const g = liga.campeon(ll);
    t.push({ c: 'hecho', dia: liga.cuando(liga.fechaLlave(ll)).toUpperCase(), hora: 'TERMINÓ · ' + ll.participantes + ' raperos', sv: ll.sv,
      ev: limpio(ll.nombre), det: g.length ? <>{g.length > 1 ? 'Campeones: ' : 'Campeón: '}<Algunos liga={liga} nombres={g} link={false} /></> : 'Sin campeón cargado', llave: ll.n });
  });
  if (!t.length) return null;
  return (
    <Sec id="fechas" titulo="Fechas" enlace="Calendario" href="#/eventos">
      <div className="rail fechas2">
        {t.map((x, i) => {
          const cuerpo = <><div className="f-dia"><b>{x.dia}</b></div><img alt="" src={liga.logo(x.sv)} /><b className="f-ev">{x.ev}</b>
            <span className="f-hora">{x.hora}</span><small>{x.det}</small>{x.badge ? <span className="f-badge">{x.badge}</span> : null}</>;
          if (x.llave) return <button type="button" key={i} className={'fecha ' + x.c} onClick={() => accion.llave(x.llave)}>{cuerpo}</button>;
          if (x.link) return <a key={i} className={'fecha ' + x.c} href={x.link} target="_blank" rel="noopener noreferrer">{cuerpo}</a>;
          return <article key={i} className={'fecha ' + x.c}>{cuerpo}</article>;
        })}
      </div>
    </Sec>
  );
}

// ── Lo último ─────────────────────────────────────────────────────────────────────────────────────
export function Vis({ liga, v, cls = 'n-vis' }) {
  if (v[0] === 'carta') return <Carta liga={liga} k={v[1]} cual={v[2]} cls={cls + ' n-carta'} abre={false} />;
  if (v[0] === 'rango') return <span className={cls + ' rgv'} style={{ background: liga.colorRg(v[1]) }}>{v[1]}</span>;
  if (v[0] === 'cara') return <Cara liga={liga} k={v[1]} nombre={v[2]} cls={cls + ' n-cara'} />;
  if (v[0] === 'sv') return <img className={cls} alt="" src={liga.logo(v[1])} />;
  if (v[0] === 'enc') return <span className={cls + ' n-enc'}>{v[1]}</span>;
  // 🖼️ el flyer de una liga (14/10/2026): la imagen, recortada al cuadro
  if (v[0] === 'img') return <img className={cls + ' n-img'} alt="" src={v[1]} loading="lazy" />;
  return <img className={cls} alt="" src="/ul.png" />;
}
function irA(d, raiz) {
  if (!d) return;
  if (d.carta) accion.carta(d.carta, d.cual);
  else if (d.perfil) accion.perfil(d.perfil);
  else if (d.llave) accion.llave(d.llave);
  else if (d.ruta) location.hash = d.ruta;
  else if (d.link) window.open(d.link, '_blank', 'noopener');
  else if (d.ancla) accion.ir(d.ancla);
}
// 🔔 LO ÚLTIMO, CON EL ESTILO DE LA CAMPANA (Dlx, 13/11/2026, mirando el panel de notificaciones: «realmente me gusta
// bastante el estilo de notificaciones… que la sección de lo último sea algo así también», y «eso de TøKiØ rango B no se
// ve tan importante y el de Akus su tarjeta de País tampoco»). Era un mosaico (5.10) y las piezas chicas quedaban como
// cajas vacías con una línea de texto. Ahora: a la izquierda lo más grande —la última carta nueva o el último logro—, y
// a la derecha la lista de la campana: filtros arriba y cada novedad en una fila con su cara (o su carta) y la esquinita
// de qué es. Debajo de la grande, «Anoche en la Liga» y el afiche de la liga, para que las dos columnas queden parejas. La letra del rango va grande y en su color, al costado.
// Cada fila abre lo suyo; las reacciones y los comentarios no la abren
const LU_FILAS = 5;
const luHace = (liga, t) => { const c = liga.cuando(t); return c ? c.charAt(0).toUpperCase() + c.slice(1) : ''; };
// 👏 lo que el Worker deja reaccionar: `APLAUDIBLES` de bot/avisos.js. ⚠️ Una carta nueva no: «le toca a todo el que
// juega una vez». Si se cambia allá, se cambia acá
// 🔄 y lo que publica sola la gente desde el 15/11 (bot/muro_solos.py): se felicitaba en Publicaciones y acá no
// (revisión del 16/11)
export const LU_REAC = new Set(['campeon', 'rango', 'caza', 'sobrevivio', 'pase', 'sorteo', 'ligahito', 'mesaward',
  'podio', 'top10', 'subio', 'racha', 'svtop']);
// los filtros: como los de la campana, cuatro
const LU_FILTROS = [['todo', 'Todo'], ['cartas', 'Cartas'], ['logros', 'Logros'], ['liga', 'Liga']];
const luCat = (it) => (it.tipo === 'tarjeta' ? 'cartas' : LU_REAC.has(it.tipo) ? 'logros' : 'liga');
// la esquinita de cada fila, por lo que cuenta
const LU_BADGE = { tarjeta: '🃏', campeon: '🏆', caza: '🎯', ligahito: '🏟️', flyer: '🏟️', liga: '📣', rango: '' };
// 🎨 EL COLOR DE CADA NOVEDAD (Dlx, 15/11/2026: «que mejores visualmente más el apartado de Lo último, y asegurarte que se
// vea bien en cada una»). Una franja a la izquierda, la etiqueta y el aro de la cara del mismo color, para que cada fila
// diga qué es antes de leerla: la letra en el color de su rango (el del payload, `colorRg`), el campeón en oro, la caza en
// magenta, la carta nueva en verde y las ligas en azul
const luTono = (liga, it) => (it.tipo === 'rango' ? liga.colorRg(it.rg) : { campeon: '#FFD024', caza: '#E41373', tarjeta: '#29B298',
  ligahito: '#7FA8FF', flyer: '#7FA8FF', liga: '#F6F6F6' }[it.tipo] || '#FF4F9A');
// 🔀 sin cuatro iguales seguidas: con varios «pasa a rango» juntos la lista se leía como una sola cosa repetida. Se toma la
// más nueva que no sea del mismo tipo que la anterior, mirando las tres que siguen; si no hay, la que toca
function mezclar(xs) {
  const resto = xs.slice();
  const out = [];
  while (resto.length) {
    const ant = out.length ? out[out.length - 1].tipo : '';
    let j = resto.slice(0, 4).findIndex((it) => it.tipo !== ant);
    if (j < 0) j = 0;
    out.push(resto.splice(j, 1)[0]);
  }
  return out;
}
// 🧪 LA VISTA DE PRUEBA (`?prev=loultimo`): una novedad de cada tipo, para ver que cada una se vea bien. Las que hoy no
// hay se arman con gente de la tabla y SIN `id` —no se pueden reaccionar ni comentar, para no mandar nada falso al objeto—
function muestraLU(liga, muro, cual) {
  const T = liga.d.tabla || [];
  const uno = (t, f = () => true) => muro.find((it) => it.tipo === t && f(it));
  const out = [];
  const poner = (it) => { if (it && !out.includes(it)) out.push(it); };
  if (cual !== 'logro') poner(uno('tarjeta'));
  const camp = uno('campeon', (it) => ksDe(it).length === 1);
  poner(camp);
  let dos = uno('campeon', (it) => ksDe(it).length > 1);
  if (!dos && camp && T.length > 2) {
    const o = T.find((f) => !ksDe(camp).includes(f.k));
    dos = Object.assign({}, camp, { id: '', quien: (camp.quien || []).concat([o.n]), ks: ksDe(camp).concat([o.k]), t: camp.t });
  }
  poner(dos);
  const letras = new Set();
  muro.filter((it) => it.tipo === 'rango').forEach((it) => { if (letras.size < 2 && !letras.has(it.rg)) { letras.add(it.rg); poner(it); } });
  poner(uno('caza'));
  const L = liga.ligas()[0];
  poner(uno('ligahito') || (L && T[3] ? { tipo: 'ligahito', que: 'invicto', pg: 5, ln: L.n, liga: L.id, sv: L.sv, quien: [T[3].n], ks: [T[3].k], t: new Date(liga.ahora).toISOString() } : null));
  poner(uno('liga') || { tipo: 'liga', tit: 'Prueba · un anuncio de la Liga, con un título largo para ver cómo corta', link: '', t: new Date(liga.ahora).toISOString() });
  if (cual !== 'logro') { poner(uno('flyer', (it) => it.img)); poner(uno('resnoche')); }
  return out.filter(Boolean);
}

// 🙂 LA CARITA DE REACCIONAR (Dlx, 13/11/2026, con la captura de la de Discord: «el emoji al que me refería era éste, pero
// feliz»): un círculo con ojos y sonrisa, dibujado acá —no un emoji—, para que se lea como botón
export function Carita({ t = 18 }) {
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="currentColor" />
      <circle cx="8.4" cy="9.8" r="1.55" fill="#0B0B0D" />
      <circle cx="15.6" cy="9.8" r="1.55" fill="#0B0B0D" />
      <path d="M7.3 13.4c1.1 2.4 2.8 3.6 4.7 3.6s3.6-1.2 4.7-3.6" fill="none" stroke="#0B0B0D" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 🔥 LAS REACCIONES DE CADA NOVEDAD (Dlx, 13/11/2026: «donde si haces click ahí te aparecen las reacciones que tengas, se
// supone que tengo una de fueguito también pero no está»). La 🔥 y la 🎤 son de la fila premium del Pase (niveles 3 y 12)
// y nunca se habían conectado: ahora cada uno reacciona con una, la que quiera de las suyas, y cambiarla pisa la de antes
// (`reaccionesDe()` en bot/avisos.js). Al lado, lo que ya tiene esa novedad, como en Discord: tocar una que tienes es
// reaccionar con ésa. Las que te faltan salen apagadas, con el nivel que las da
// 💬 IR A UNA PUBLICACIÓN SIN RECARGAR (15/11/2026). La fila de Lo último corta la propagación del clic para que reaccionar no
// la abra, y con eso el link `#/…` no llegaba al script del principio (el que lo ataja): el navegador iba a `/#/publicaciones/<id>`
// y recargaba la página entera, con su pantalla de carga. Ahora se navega acá, igual que el buscador (`location.hash`)
export const irPub = (e, id) => {
  e.preventDefault();
  e.stopPropagation();
  if (id) location.hash = '#/publicaciones/' + encodeURIComponent(id);
};

// `sinCm`: sin el botón de comentar (la grande lo lleva en su fila de botones); sin reacciones tampoco, no dibuja nada
// 💬 `aca` (21/11/2026): en el Inicio, el globito abre la hoja de comentarios encima de la página (`comentarAca`) en vez de
// ir a Publicaciones. En Publicaciones no va: ahí la hoja ya es la de la página
export function LuSocial({ liga, it, A, hilo, P, sinCm = false, aca = false }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { const p = e.composedPath ? e.composedPath() : []; if (caja.current && !p.includes(caja.current)) setAbierto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fuera, true); document.removeEventListener('keydown', esc); };
  }, [abierto]);
  const id = it.id;
  if (!id) return null;
  const reac = reaccionesDe(A, id);
  const mia = miReaccion(A, id);
  const yo = liga.yo;
  const propio = !!(yo && ksDe(it).includes(yo.k));
  const puede = LU_REAC.has(it.tipo) && !propio;
  const nc = hilo.length;
  // las tuyas (sin entrar, la de todos: tocarla te lleva a entrar con Discord) y todas las que existen, con su nivel
  const mias = (P && Array.isArray(P.reacciones) && P.reacciones.length) ? P.reacciones : ['👏'];
  const todas = [['👏', 0]];
  ((P && P.fila_premium) || []).forEach((p) => { if (p[2] === 'reaccion' && !todas.some((x) => x[0] === p[3])) todas.push([p[3], p[0]]); });
  const va = !!A.va[id];
  const reaccionar = (e) => { if (window.felicitar) window.felicitar(id, e); setAbierto(false); };
  const parar = (e) => e.stopPropagation();
  const err = A.err[id];
  if (sinCm && !reac.length && !puede && !err) return null;
  return (
    <span className="lu-soc" ref={caja} onClick={parar} onKeyDown={parar}>
      {reac.map(([e, n]) => (
        <button key={e} type="button" className={'lu-rc' + (mia === e ? ' on' : '')} disabled={!puede || !mias.includes(e) || mia === e || va}
          onClick={() => reaccionar(e)} aria-pressed={mia === e}
          aria-label={num(n) + ' ' + e + (mia === e ? ', la tuya' : puede && mias.includes(e) ? ': reaccionar con ésta' : '')}>
          <span aria-hidden="true">{e}</span><em>{num(n)}</em></button>
      ))}
      {puede ? (
        <button type="button" className={'lu-car' + (abierto ? ' on' : '')} aria-expanded={abierto} aria-haspopup="dialog"
          aria-label={mia ? 'Cambiar tu reacción' : 'Reaccionar'} title={mia ? 'Cambiar tu reacción' : 'Reaccionar'} onClick={() => setAbierto((v) => !v)}>
          <Carita />{reac.length ? null : <span className="lu-car-t">Reaccionar</span>}
        </button>
      ) : null}
      {sinCm ? null : <a className="lu-cm" href={'#/publicaciones/' + encodeURIComponent(id)} onClick={aca ? comentarAca(it) : (e) => irPub(e, id)} aria-label={nc ? nc + (nc === 1 ? ' comentario' : ' comentarios') : 'Comentar'}>
        <Ico n="globo" t={15} />{nc ? <em>{num(nc)}</em> : null}</a>}
      {err && err.error === 'reaccion' ? <small className="lu-err">Esa reacción es del Pase premium</small> : null}
      {abierto ? (
        <span className="lu-reac" role="dialog" aria-label="Reaccionar">
          <span className="lu-reac-h">{mia ? 'Cambia tu reacción' : 'Reacciona'}</span>
          <span className="lu-reac-g">
            {todas.map(([e, nv]) => {
              const tiene = mias.includes(e);
              return (
                <button key={e} type="button" className={'lu-reac-e' + (mia === e ? ' on' : '') + (tiene ? '' : ' bloq')} disabled={!tiene || mia === e || va}
                  onClick={() => reaccionar(e)} aria-label={tiene ? 'Reaccionar con ' + e : e + ': Pase premium, nivel ' + nv}>
                  <span aria-hidden="true">{e}</span>{tiene ? null : <small>NV {nv}</small>}
                </button>
              );
            })}
          </span>
          {/* 🔁 (18/11/2026) el `parar` del span corta el clic antes del script que ataja los `#/…` (web/montar.py), y el
              navegador iba a `/#/pase` recargando la página entera: se navega acá, como `irPub`. Con Ctrl o la rueda, otra pestaña */}
          {todas.some(([e]) => !mias.includes(e)) ? <a className="lu-reac-pie" href="#/pase"
            onClick={(e) => { if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); setAbierto(false); location.hash = '#/pase'; }}>
            Las apagadas se ganan con el Pase premium</a> : null}
        </span>
      ) : null}
    </span>
  );
}

// 💬 EL ÚLTIMO COMENTARIO, A LA VISTA (Dlx, 13/11/2026: «que ese pop up de los comentarios sean mejores y quizás más
// grandes»). Antes flotaba al pasar el mouse y no se leía; ahora va debajo de la novedad, con la cara de quien escribió.
// En la grande, los dos últimos. ⚠️ El simulado lleva su etiqueta: eso lo decide el permiso en el ciclo, nunca acá
export function LuNube({ liga, it, hilo, n = 1, aca = false }) {
  // 💎 el aro dorado en la cara de quien tiene el Pase de rapero premium
  const pub = usePases();
  if (!hilo.length) return null;
  const cs = hilo.slice(-n);
  return (
    <a className={'lu-nube' + (n > 1 ? ' grande' : '')} href={'#/publicaciones/' + encodeURIComponent(it.id || '')} onClick={aca ? comentarAca(it) : (e) => irPub(e, it.id)}>
      {cs.map((c) => {
        const pj = c.et === 'l' ? pjDe(c.k, liga) : null;
        return (
          <span className="lu-nube-c" key={c.id}>
            {pj ? <span className="lu-nube-cara pj" style={{ background: pjFondo(pj), color: pj[2] }}><PjDentro pj={pj} /></span> : <Cara liga={liga} k={c.k} nombre={c.n} cls={'lu-nube-cara' + (esPremium(pub, c.k) ? ' sp-prem-aro' : '')} lazy />}
            <span className="lu-nube-x"><b>{autorDe(liga, c)}{c.et === 's' ? <i>simulado</i> : null}</b><span>{c.tx}</span></span>
          </span>
        );
      })}
      {n > 1 ? <small className="lu-nube-mas">{hilo.length > n ? 'Ver los ' + hilo.length + ' comentarios' : 'Responder'}</small> : null}
    </a>
  );
}

export function Noticias({ liga, raiz, prueba = '' }) {
  const A = useAplausos();
  // los comentarios de verdad (los simulados ya vienen en el muro): para contarlos y para la nube
  useComentarios();
  // tus reacciones (las del Pase): sólo si entraste con Discord
  const P = usePase(typeof window !== 'undefined' && !!window.DC);
  const [fil, setFil] = useState('todo');
  const hiloDe = (it) => (it && it.id ? delHilo(it, liga.ahora) : []);
  const muro0 = liga.muroLimpio().filter((it) => it.tipo !== 'anuncio' && it.tipo !== 'promo');
  const muro = prueba ? muestraLU(liga, muro0, prueba) : muro0;
  if (!muro.length) return null;
  // la grande: la última carta nueva; si no hay, el último logro
  const feat = muro.find((it) => it.tipo === 'tarjeta') || muro.find((it) => LU_REAC.has(it.tipo) && liga.itemMuro(it)) || null;
  // 🌙 (18/11/2026) sólo si es de anoche: una noche sin eventos no deja resumen (`resumen_noche()` de bot/muro.py da None),
  // y al otro día «Anoche en la Liga» mostraba, sin fecha, la de dos noches atrás. `t` es las 3 AM ET del día siguiente a
  // esa noche: se ve hasta las 5 AM del otro, y el de la noche nueva entra antes
  const noche0 = muro.find((it) => it.tipo === 'resnoche') || null;
  const noche = noche0 && liga.ahora - utc(noche0.t) < 26 * 3600000 ? noche0 : null;
  // el afiche de la liga va grande a la izquierda, debajo de la carta: es lo más visual que hay
  const flyer = muro.find((it) => it.tipo === 'flyer' && it.img) || null;
  // la lista: todo lo demás que se sabe dibujar, sin dos cartas seguidas de la misma persona (llegan juntas)
  const lista0 = [];
  const lista = lista0;
  for (const it of muro) {
    if (it === feat || it === flyer || it.tipo === 'resnoche' || !liga.itemMuro(it)) continue;
    if (it.tipo === 'tarjeta' && feat && JSON.stringify(ksDe(it)) === JSON.stringify(ksDe(feat))) continue;
    if (lista.some((o) => o.tipo === it.tipo && JSON.stringify(ksDe(o)) === JSON.stringify(ksDe(it)))) continue;
    lista.push(it);
    if (lista.length >= 40) break;
  }
  const mezcla = mezclar(lista0);
  lista.splice(0, lista.length, ...mezcla);
  const cuenta = { todo: lista.length };
  lista.forEach((it) => { cuenta[luCat(it)] = (cuenta[luCat(it)] || 0) + 1; });
  const filtros = LU_FILTROS.filter(([k]) => k === 'todo' || cuenta[k]);
  const filas = lista.filter((it) => fil === 'todo' || luCat(it) === fil).slice(0, prueba ? 20 : LU_FILAS);
  const ir = (it) => { const x = liga.itemMuro(it); if (x) irA(x[4], raiz); };
  // ⌨️ (18/11/2026) sólo la tecla sobre la fila misma: Enter en «Su perfil», «Comentar» o la nube subía hasta acá, el
  // `preventDefault()` cancelaba el link y se abría la carta. Lo de adentro se activa solo (como competencias.jsx)
  const tecla = (fn) => (e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  // 🪪 la clave de cada uno aunque el muro no la traiga: por su nombre, sus alias o lo que reconoció el vigía (17/11/2026)
  const kDe = (it, i = 0) => ksDe(it)[i] || ((it.quien || [])[i] ? (liga.quien(it.quien[i]) || {}).k || '' : '');
  // lo de la izquierda de cada fila: la carta, el afiche o la cara con su esquinita
  const visual = (it, x) => {
    const ks = [kDe(it, 0), kDe(it, 1)];
    if (it.tipo === 'tarjeta') return <span className="lu-r-v v-carta"><Carta liga={liga} k={ks[0]} cual={it.carta} cls="lu-r-carta" abre={false} /></span>;
    if (it.tipo === 'flyer') return <span className="lu-r-v v-img"><img alt="" src={it.img} loading="lazy" /></span>;
    if (it.tipo === 'liga') return <span className="lu-r-v v-cara"><span className="nt-cara nt-ico"><img alt="" src="/ul.png" /></span></span>;
    const k = ks[0] || '';
    const f = k ? liga.T[k] : null;
    // (la letra del rango no va en la esquinita: va grande a la derecha, y repetida chica no decía nada más)
    const badge = it.tipo !== 'rango' && LU_BADGE[it.tipo] ? <i className="nt-badge">{LU_BADGE[it.tipo]}</i> : null;
    return (
      <span className="lu-r-v v-cara">
        <span className="nt-cara">
          {f ? <Cara liga={liga} k={k} nombre={f.n} cls="nt-c" /> : <span className="nt-c nt-ico">{(x[1] || '?').slice(0, 1)}</span>}
          {badge}
        </span>
        {/* los campeones de a dos: la cara del segundo, encimada */}
        {it.tipo === 'campeon' && ks[1] && liga.T[ks[1]] ? <Cara liga={liga} k={ks[1]} nombre={liga.T[ks[1]].n} cls="nt-c lu-r-dos" /> : null}
      </span>
    );
  };
  const fila = (it) => {
    const x = liga.itemMuro(it);
    const hilo = hiloDe(it);
    const sv = it.sv ? siglaDe(it.sv) : '';
    const f0 = liga.T[kDe(it)];
    const sub = it.tipo === 'campeon' ? [sv, it.part ? it.part + ' raperos' : ''].filter(Boolean).join(' · ')
      : it.tipo === 'tarjeta' ? (f0 ? [f0.rg ? 'Rango ' + f0.rg : '', f0.pos ? '#' + f0.pos + ' Temporada' : ''].filter(Boolean).join(' · ') : '')
        : it.tipo === 'rango' ? (f0 ? [f0.pos ? '#' + f0.pos + ' Temporada' : '', f0.ovr ? 'OVR ' + f0.ovr : ''].filter(Boolean).join(' · ') : '')
          : it.tipo === 'caza' ? [it.cat, sv].filter(Boolean).join(' · ')
            : sv;
    // a la derecha, lo propio de cada una: la letra del rango, el escudo del servidor del campeón, lo que cobró el cazador
    const der = it.tipo === 'rango' ? <span className="lu-r-letra" style={{ background: liga.colorRg(it.rg) }} aria-label={'Rango ' + it.rg}>{it.rg}</span>
      : (it.tipo === 'campeon' || it.tipo === 'ligahito') && it.sv ? <img className="lu-r-sv" alt={siglaDe(it.sv)} src={liga.logo(it.sv)} loading="lazy" />
        : it.tipo === 'caza' && it.pts ? <span className="lu-r-pts">+{num(it.pts)}</span> : null;
    return (
      <li key={it.id || it.t + it.tipo}>
        <div className={'nt-f lu-r t-' + it.tipo} style={{ '--lu-c': luTono(liga, it) }} role="link" tabIndex={0} onClick={() => ir(it)} onKeyDown={tecla(() => ir(it))}>
          {visual(it, x)}
          <span className="nt-t">
            <span className="lu-cat">{x[0]}</span>
            <b>{x[1]}</b>
            {sub ? <small>{sub}</small> : null}
            <LuSocial liga={liga} it={it} A={A} hilo={hilo} P={P} aca />
            <LuNube liga={liga} it={it} hilo={hilo} aca />
          </span>
          <span className="lu-r-der">
            <span className="nt-hora">{luHace(liga, it.t)}</span>
            {/* 🅱️ la letra, grande y en su color (Dlx: «TøKiØ rango B no se ve tan importante») */}
            {der}
          </span>
        </div>
      </li>
    );
  };

  // la grande
  let grande = null;
  if (feat) {
    const x = liga.itemMuro(feat);
    const k = kDe(feat);
    const f = k ? liga.T[k] : null;
    const esCarta = feat.tipo === 'tarjeta';
    const hilo = hiloDe(feat);
    // 🃏 un logro también va con su carta (la de Temporada; el rango, la Competitiva): la cara sola, en el cuadro de la
    // carta, salía como una franja recortada. Sin carta, la cara redonda. Y un sticker que dice qué es
    const visF = x[2][0] === 'cara' && f && (f.c || []).includes('temporada') ? ['carta', k, 'temporada'] : x[2];
    const stk = esCarta ? 'NUEVA' : { campeon: 'CAMPEÓN', caza: 'CAZÓ', rango: 'RANGO ' + (feat.rg || ''), ligahito: 'LIGA' }[feat.tipo] || '';
    grande = (
      <div className="lu-feat" style={{ '--lu-c': luTono(liga, feat) }} role="link" tabIndex={0} onClick={() => ir(feat)} onKeyDown={tecla(() => ir(feat))}>
        <span className={'lu-feat-v' + (visF[0] === 'cara' ? ' redonda' : '')}><Vis liga={liga} v={visF} cls="lu-feat-i" />{stk ? <span className="sticker">{stk}</span> : null}</span>
        <span className="lu-feat-t">
          <span className="lu-cat">{x[0]} · {luHace(liga, feat.t)}</span>
          <b className="lu-tit">{x[1]}</b>
          {f ? <span className="lu-datos">
            {f.rg ? <span>Rango <b style={{ color: f.rgc || undefined }}>{f.rg}</b></span> : null}
            {f.pos ? <span>#{f.pos} Temporada</span> : null}
            {/* 🔢 (18/11/2026) en singular cuando es uno: decía «1 eventos» (en /api/lobby hay filas con ev = 1) */}
            {f.ev ? <span>{f.ev} {f.ev === 1 ? 'evento' : 'eventos'}</span> : null}
          </span> : null}
          <span className="lu-acc">
            {esCarta ? <button type="button" className="lu-btn v" onClick={(e) => { e.stopPropagation(); accion.carta(k, feat.carta); }}>Ver la carta</button> : null}
            {/* 🔁 (18/11/2026) el `stopPropagation()` frenaba también al script que ataja los `#/…` (web/montar.py): el navegador
                iba a `/#/r/<k>` y recargaba la página entera. Se navega acá, como `irPub`; con Ctrl o la rueda, otra pestaña */}
            {k ? <a className="lu-btn" href={'#/r/' + encodeURIComponent(k)} onClick={(e) => {
              e.stopPropagation();
              if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              location.hash = '#/r/' + encodeURIComponent(k);
            }}>Su perfil</a> : null}
            {/* 💬 comentar, en la fila de los botones (Dlx, 17/11/2026: «ese comentario muévelo a otra parte»): solo, abajo,
                ocupaba una fila entera para un botón chico */}
            {/* 💬 y sin comentarios, sólo el globo, como en las otras piezas (revisión 22/11/2026, G1#10): con la palabra sumaban 366 px
                en 333 y «COMENTAR» volvía a quedar solo en el renglón de abajo */}
            {feat.id ? <a className="lu-btn lu-btn-cm" href={'#/publicaciones/' + encodeURIComponent(feat.id)} onClick={comentarAca(feat)}
              aria-label={hilo.length ? hilo.length + (hilo.length === 1 ? ' comentario' : ' comentarios') : 'Comentar'} title={hilo.length ? undefined : 'Comentar'}>
              <Ico n="globo" t={14} />{hilo.length ? num(hilo.length) : null}</a> : null}
          </span>
          <LuSocial liga={liga} it={feat} A={A} hilo={hilo} P={P} sinCm aca />
          {hilo.length >= 2 ? <ComentariosFlotantes liga={liga} it={feat} hilo={hilo} cls="cfl-feat" onAbrir={() => comentarAca(feat)()} /> : <LuNube liga={liga} it={feat} hilo={hilo} n={2} aca />}
        </span>
      </div>
    );
  }

  // 🌙 anoche en la Liga y 🖼️ el afiche: debajo de la grande, así las dos columnas quedan parejas
  let nocheT = null;
  if (noche) {
    const cs = (noche.campeones || []);
    const caras = [];
    cs.forEach((c) => (c.quien || []).forEach(([n, k]) => { if (caras.length < 5 && !caras.some((y) => y[1] === k)) caras.push([n, k]); }));
    // 🌙 SIN AFICHE, ESTA CAJA ES LA ÚLTIMA DE LA COLUMNA Y SE ESTIRA hasta la altura de la lista (18/11/2026, Dlx con la
    // captura: «is this a bug?»): estiraba sus tres renglones —607 px de caja para 92 de contenido—. Ahora trae el resumen
    // entero (campeones, más puntos, subieron), que ya venía en el muro y sólo se leía en Publicaciones. Lo que no entra se
    // va de a grupo entero (vivo.css, `.lu-nl`); en el celular no se estira nada y queda la fila de caras
    const larga = !flyer;
    const fila3 = (key, cs3, t, s, d, dCls) => (
      <span key={key} className="lu-nl-f">
        <span className="lu-nl-caras">{cs3.map(([n, k]) => <Cara key={k} liga={liga} k={k} nombre={n} cls="nt-c" />)}</span>
        <span className="lu-nl-t"><b>{t}</b>{s ? <small>{s}</small> : null}</span>
        {d ? <span className={'lu-nl-d' + (dCls ? ' ' + dCls : '')}>{d}</span> : null}
      </span>
    );
    const suman = noche.suman || [], suben = noche.suben || [];
    // cada grupo: el título pegado a su primera fila (nunca un título solo) y las demás filas sueltas, así el último grupo
    // muestra las que entran
    const grupo = (key, titulo, filas) => (filas.length ? [
      <span key={key} className="lu-nl-g"><small className="lu-nl-k">{titulo}</small>{filas[0]}</span>, ...filas.slice(1)] : []);
    nocheT = (
      <a className={'lu-noche' + (larga ? ' larga' : '')} href="#/publicaciones">
        <span className="lu-cat">Anoche en la Liga</span>
        {/* 🔢 (18/11/2026) `part` suma los participantes de cada llave: son participaciones, no raperos distintos (el 17/11,
            69 de unos 52). Publicaciones ya lo llama así */}
        <span className="lu-num">{noche.eventos}<small>{noche.eventos === 1 ? 'evento' : 'eventos'}</small>{noche.part}<small>{noche.part === 1 ? 'participación' : 'participaciones'}</small>{cs.length}<small>{cs.length === 1 ? 'campeón' : 'campeones'}</small></span>
        <span className="lu-noche-c">{caras.map(([n, k]) => <Cara key={k} liga={liga} k={k} nombre={n} cls="nt-c" />)}
          <small>{cs.slice(0, 2).map((c) => (c.quien || []).map((y) => liga.aka(y[0], y[1])).join(' y ')).join(', ')}{cs.length > 2 ? ' y ' + (cs.length - 2) + ' más' : ''}</small></span>
        {larga ? (
          <span className="lu-nl">
            {grupo('gc', cs.length === 1 ? 'El campeón' : 'Los campeones',
              cs.map((c, i) => fila3('c' + i, (c.quien || []).slice(0, 2), (c.quien || []).map((y) => liga.aka(y[0], y[1])).join(' y '),
                [c.ev, c.sv ? siglaDe(c.sv) : ''].filter(Boolean).join(' · '))))}
            {grupo('gs', 'Los que más sumaron',
              suman.map((x) => fila3('s' + x.k, [[x.n, x.k]], liga.aka(x.n, x.k), x.ev === 1 ? '1 evento' : x.ev + ' eventos', '+' + num(x.pts))))}
            {grupo('gu', 'Subieron en la Temporada',
              suben.map((x) => fila3('u' + x.k, [[x.n, x.k]], liga.aka(x.n, x.k), '', '#' + x.de + ' → #' + x.a, 'lu-nl-sube')))}
          </span>
        ) : null}
        {larga ? <span className="lu-nl-pie"><span>Todo lo de anoche, en Publicaciones</span><b>→</b></span> : null}
      </a>
    );
  }
  let flyerT = null;
  if (flyer) {
    const x = liga.itemMuro(flyer);
    flyerT = (
      <div className="lu-fly" role="link" tabIndex={0} onClick={() => ir(flyer)} onKeyDown={tecla(() => ir(flyer))}>
        <img alt="" src={flyer.img} loading="lazy" />
        <span className="lu-fly-p"><span className="lu-cat">{x[0]} · {luHace(liga, flyer.t)}</span><b>{x[1]}</b></span>
      </div>
    );
  }

  return (
    <Sec id={prueba ? 'noticias-' + prueba : 'noticias'} titulo={prueba ? 'Prueba · Lo último' + (prueba === 'logro' ? ' sin carta nueva' : '') : 'Lo último'} enlace="Publicaciones" href="#/publicaciones">
      <div className={'lu-dos' + (grande || nocheT || flyerT ? '' : ' solo') + (prueba ? ' lu-prueba' : '')}>
        {grande || nocheT || flyerT ? <div className="lu-izq">{grande}{nocheT}{flyerT}</div> : null}
        <div className="nt-p lu-panel">
          {filtros.length > 2 ? (
            <div className="nt-chips" role="group" aria-label="Filtrar lo último">{filtros.map(([k, t]) => (
              <button key={k} type="button" className={'nt-chip' + (fil === k ? ' on' : '')} aria-pressed={fil === k} onClick={() => setFil(k)}>
                {t}<em>{cuenta[k] || 0}</em></button>
            ))}</div>
          ) : null}
          <ul className="lu-lista">{filas.map(fila)}</ul>
          <a className="nt-pie lu-pie" href="#/publicaciones"><span>Todo lo que pasó, en Publicaciones</span><b>Ver todo</b></a>
        </div>
      </div>
    </Sec>
  );
}

// ── Los que mandan: las siete categorías del podio de la web de hoy, cinco en cada una ──────────────
// la tarjeta ya dice quién es, de dónde, su puesto y sus números: abajo va sólo lo que la tarjeta NO dice (los duelos
// ganados, los podios, la racha). Dlx, 01/10/2026: «las cosas de abajo son innecesarias porque la tarjeta ya tiene esa
// info». El perfil sigue a un toque: la tarjeta abre su visor, que tiene «Ver su perfil»
export function McPersona({ liga, f, dato, cual = 'temporada', arriba = '' }) {
  // ⏳ mientras la carta se redibuja, su número puede no coincidir con el orden de acá: se dice
  // y sólo si hay carta: «SIN CARTA» con «⌛ redibujando» abajo se contradecían (revisión 22/11/2026, G5#10)
  const vieja = liga.cartaVieja(f.k, cual) && !!liga.cartaUrl(f.k, cual);
  return (
    <article className="mc">
      {/* el puesto de ESTE ranking, arriba y aparte, cuando la carta trae el «#» de otro (ELO, Ligas) */}
      {arriba ? <span className="mc-arriba">{arriba}</span> : null}
      <Carta liga={liga} k={f.k} cual={cual} cls="ci mc-ci" />
      {/* ⏳ corto y en un renglón (revisión 21/11): «SE ESTÁ REDIBUJANDO» iba en dos renglones abajo de cada carta del
          celular, y al pie de la destacada (más baja) quedaba ~20 px más arriba que los de su fila */}
      {dato || vieja ? <div className="mc-pie"><small>{dato}{dato && vieja ? ' · ' : ''}{vieja ? <span className="mc-dib" title="La carta se está redibujando: su número puede no coincidir todavía">⏳ redibujando</span> : null}</small></div> : null}
    </article>
  );
}
function McGrupo({ n, img, nombre, dato, href }) {
  return (
    <a className="mc grupo" href={href}>
      <div className="mc-tile"><span className="mc-n">#{n}</span>{img}</div>
      <div className="mc-pie"><b>{nombre}</b><small>{dato}</small></div>
    </a>
  );
}
// ── tu puesto, debajo del top 5 (Dlx, 30/09/2026: «me gustan todas», la A): dónde estás y a cuánto del de arriba.
// Sólo si no estás en el top 5 —ahí ya te ves—; sin haber entrado, la invitación a entrar.
// 🏁 CON SU BARRA DESDE EL 13/11/2026 (la opción A de la maqueta, «Progress Card»): cuánto te falta para el de arriba,
// dicho con su nombre («Te faltan 9.714 pts para pasar a Tenor (#33)»), y la barra de lo tuyo contra lo suyo
function Puesto({ cara, quien, pos, txt, href, pct }) {
  return (
    <div className="mc-yo">
      {cara}
      <span className="mc-yo-q"><small>{quien}</small><b>{pos}</b></span>
      <span className="mc-yo-t">{pct != null ? <span className="mc-yo-barra" aria-hidden="true"><i style={{ width: pct + '%' }} /></span> : null}{txt}</span>
      {href ? <a className="mc-yo-a" href={href}>Ver el ranking <Ico n="flecha" t={14} /></a> : null}
    </div>
  );
}
// el nombre de lo que va en una lista: una fila de la tabla, un `[x, fila]` del ELO, un duelo, un país o una crew
const nomDe = (o) => (Array.isArray(o) ? limpio((o[1] || {}).n || '') : o.crew ? limpio(o.crew) : o.n && typeof o.n === 'string' ? limpio(o.n) : o.cc ? nombrePais(o.cc) : '');
function puestoDe(liga, lista, esMio, valor, unidad, dec = 0, posDe = null) {
  const i = lista.findIndex(esMio);
  if (i < 5) return null;
  const d = valor(lista[i - 1]) - valor(lista[i]);
  const dist = dec ? d.toFixed(dec).replace('.', ',') : num(d);
  // el puesto: el oficial si la lista lo trae (la Temporada tiene empates), si no el lugar en la lista
  const pos = posDe ? posDe(lista[i]) : i + 1;
  const arriba = posDe ? posDe(lista[i - 1]) : i;
  const nom = nomDe(lista[i - 1]);
  const pct = valor(lista[i - 1]) > 0 ? Math.max(2, Math.min(100, Math.round((100 * valor(lista[i])) / valor(lista[i - 1])))) : null;
  return {
    i, pos, pct,
    txt: d > 0 ? 'Te faltan ' + dist + ' ' + unidad + ' para pasar a ' + (nom ? nom + ' (#' + arriba + ')' : 'el #' + arriba) : 'Empatado con ' + (nom || 'el #' + arriba),
  };
}

// 👑 LOS QUE MANDAN, OPCIÓN A (Dlx, 13/11/2026: «x último remakea estas 2 últimas secciones», y a la maqueta
// https://claude.ai/artifact/Rumigw5P7eu1sFKJqaa8T9, «A y A»): la carta del #1 grande y sus números al lado; del #2 al
// #5 en filas, cada uno con su carta chica, su bandera, su letra y una barra contra el #1, y abajo tu fila. Las cartas
// son las de verdad: no se tocan. Cada fila es `{key, href, grande, mini, nom, cc, rg, sub, v, vt, vl}`: `v` el número
// de la barra, `vt` cómo se lee y `vl` qué es (OVR, SCORE…). Ideas de 21st, sólo miradas: «First Place Leaderboard»,
// «Leaderboard Card» (trophyso) y «Rank Bars» (eugeneshilow)
const QUIEN_MANDA = {
  temporada: 'El que manda en la temporada', competitivo: 'El mejor Score de la temporada', elo: 'El de más ELO',
  duelos: 'El que más duelos ganó', ligas: 'El mejor OVR de las ligas', podios: 'El de más campeonatos',
  rachas: 'La racha más larga', paises: 'El país que manda', crews: 'La crew que manda',
};
// 🥇 LOS QUE MANDAN, MÁS CLAROS (Dlx, 15/11/2026: «mejora también la sección de Los que mandan»). El #1 con sus números en
// cuadros (`st`) y cuánto le saca al #2 (`VENTAJA`), el #2 y el #3 con su medalla de plata y bronce, y lo de países y
// crews (que no tienen carta) estirado al alto de la lista. Con uno solo en el ranking, se dice en vez de dejar el hueco
const VENTAJA = {
  temporada: 'de OVR', competitivo: 'de Score', elo: 'de ELO', duelos: 'duelos ganados', ligas: 'de OVR', podios: 'campeonatos',
  rachas: 'eventos seguidos', paises: 'pts', crews: 'pts',
};
function ventaja(c, a, b) {
  const d = (Number(a.v) || 0) - (Number(b.v) || 0);
  if (d <= 0) return 'Empatado con ' + b.nom;
  const uno = { duelos: 'duelo ganado', podios: 'campeonato', rachas: 'evento seguido' };
  const t = c === 'competitivo' ? d.toFixed(1).replace('.', ',') : c === 'paises' || c === 'crews' ? corto(d) : num(d);
  return '+' + t + ' ' + ((d === 1 && uno[c]) || VENTAJA[c] || '') + ' sobre ' + b.nom;
}
// 💎 `pub`: lo público del Pase, para el sello Premium de cada persona (`pk`: los países y las crews no lo tienen)
function Mandan({ liga, c, xs, yoFila, pub }) {
  const uno = xs[0];
  const tope = Math.max(1, Number(uno.v) || 0);
  return (
    <div className={'mn' + (uno.tile ? ' con-tile' : '')}>
      <div className="mn-uno">{uno.grande}</div>
      <div className="mn-lado">
        <a className="mn-top" href={uno.href}>
          {uno.pk ? <FondoPropio liga={liga} k={uno.pk} /> : null}
          <span className="mn-n1">#1</span>
          <span className="mn-top-t">
            <small>{QUIEN_MANDA[c] || ''}</small>
            <b>{uno.cc ? <Bandera cc={uno.cc} cls="mn-flag" /> : null}<span className="mn-top-nom">{uno.nom}</span>{esPremium(pub, uno.pk) ? <SelloPremium t={18} /> : null}</b>
            {uno.st && uno.st.length ? null : <span>{uno.sub1 || uno.sub}</span>}
          </span>
        </a>
        {uno.st && uno.st.length ? (
          <div className="mn-st">
            {uno.st.map(([v, et]) => <span key={et}><b>{v}</b><small>{et}</small></span>)}
            {xs[1] ? <em className="mn-ventaja">{ventaja(c, uno, xs[1])}</em> : null}
          </div>
        ) : null}
        {xs.length < 2 ? <p className="mn-vacio">Todavía no hay nadie más en este ranking.</p> : null}
        <ol className="mn-lista">
          {xs.slice(1).map((x, i) => (
            <li key={x.key} className={i === 0 ? 'p2' : i === 1 ? 'p3' : ''}>
              <a className="mn-f" href={x.href}>
                {x.pk ? <FondoPropio liga={liga} k={x.pk} /> : null}
                <span className="mn-n">{i + 2}</span>
                <span className="mn-mini">{x.mini}</span>
                <span className="mn-t">
                  <b>{x.cc ? <Bandera cc={x.cc} cls="mn-flag" /> : null}<span className="mn-nom">{x.pk ? <NombreT k={x.pk} n={x.nom} /> : x.nom}</span>{esPremium(pub, x.pk) ? <SelloPremium t={13} /> : null}{x.rg ? <Rango liga={liga} rg={x.rg} /> : null}</b>
                  <small>{x.sub}</small>
                </span>
                <span className="mn-barra" aria-hidden="true"><i style={{ width: Math.max(3, Math.min(100, Math.round((100 * (Number(x.v) || 0)) / tope))) + '%' }} /></span>
                <span className="mn-v">{x.vt}<small>{x.vl}</small></span>
              </a>
            </li>
          ))}
        </ol>
      </div>
      {/* tu fila, a lo ancho debajo de las dos columnas: dentro de la de la derecha la estiraba y dejaba un hueco bajo la carta */}
      {yoFila}
    </div>
  );
}

// los números grandes en corto: 786.861 → 787K, 1.250.000 → 1,25M
const corto = (n) => (n >= 1e6 ? (Math.round(n / 1e4) / 100).toString().replace('.', ',') + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : num(n));
// 🎯 LOS EVENTOS DE LA LETRA SON LOS DE TIER 1 (18/11/2026): «tu fila» del Competitivo y Tu temporada contaban `ev` (todos
// los eventos), y a quien tenía 10 o más pero menos de 10 de Tier 1 le decían «Tu letra llega con la próxima corrida»
// (Vilca: 26 eventos, 4 de Tier 1). La regla es la del Ranking (ranking.jsx, 13/11/2026): `evc ?? ev` —el payload trae
// `evc` sólo cuando difiere—, y el 10 sale de los requisitos del payload, como allá
const evcDe = (f) => (f && typeof f.evc === 'number' ? f.evc : (f && f.ev) || 0);
function pideComp(liga) {
  const q = (liga.d.requisitos || []).find((x) => x.id === 'competitivo');
  const m = q && /(\d+)/.exec((q.pide || [])[0] || '');
  return (m && Number(m[1])) || 10;
}

export function LosQueMandan({ liga, dc }) {
  const [ligasR, setLigasR] = useState(null);
  useEffect(() => { let vivo = true; pedirLigas(liga.d.sello).then((d) => { if (vivo && d) setLigasR(d); }); return () => { vivo = false; }; }, [liga.d.sello]);
  const ligasC = ligasR && ligasR.cartas;
  const ligasL = ligasR && ligasR.lobby;
  const T = liga.oficiales();
  const yo = liga.yo;
  const pub = usePases();
  const cara = yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls={'mc-yo-c' + (esPremium(pub, yo.k) ? ' sp-prem-aro' : '')} /> : null;
  const quien = yo ? 'TÚ · ' + limpio(yo.n).toUpperCase() : '';
  const fila = (x, href) => (x ? <Puesto cara={cara} quien={quien} pos={'#' + x.pos} txt={x.txt} pct={x.pct} href={href} /> : null);
  // una persona de la tabla: su carta grande (abre su visor) y la chica en la fila, que lleva a su perfil
  // `sub1`: lo que dice el #1, que tiene más lugar (si no, lo mismo que las filas)
  // `st`: los números del #1, en cuadros (`[valor, qué es]`)
  const per = (f, cual, v, vt, vl, sub, sub1, st) => ({
    key: f.k, pk: f.k, href: '#/r/' + encodeURIComponent(f.k), nom: limpio(f.n), cc: f.cc, rg: f.rg, sub, sub1: sub1 || sub, v, vt, vl, st,
    grande: <Carta liga={liga} k={f.k} cual={cual} cls="ci mn-carta" />,
    mini: <Carta liga={liga} k={f.k} cual={cual} cls="ci mn-ci" abre={false} />,
  });
  const evs = (f) => num(f.pts || 0) + ' pts · ' + (f.ev || 0) + (f.ev === 1 ? ' evento' : ' eventos');
  const cats = [];
  cats.push(['temporada', 'Temporada', T.slice(0, 5).map((f) => per(f, 'temporada', f.ovr || 0, f.ovr || '—', 'OVR', evs(f),
    (f.ovr || '—') + ' de OVR · ' + evs(f) + (f.oro ? ' · ' + f.oro + (f.oro === 1 ? ' campeonato' : ' campeonatos') : ''),
    [[f.ovr || '—', 'OVR'], [corto(f.pts || 0), 'PTS'], [f.ev || 0, 'EVENTOS'], [f.oro || 0, f.oro === 1 ? 'CAMPEONATO' : 'CAMPEONATOS']])),
    yo ? fila(puestoDe(liga, T, (f) => f.k === yo.k, (f) => f.pts || 0, 'pts', 0, (f) => f.pos), '#/ranking/temporada') : null]);
  const compT = T.filter((f) => f.rg).sort((a, b) => (b.sc || 0) - (a.sc || 0));
  let yoComp = null;
  if (yo && !yo.rg) {
    // los de Tier 1 (`evcDe()`, 18/11/2026), con el texto del Ranking Competitivo
    const pide = pideComp(liga);
    const evc = evcDe(yo);
    const falta = Math.max(0, pide - evc);
    yoComp = <Puesto cara={cara} quien={quien} pos="—" pct={Math.round((100 * Math.min(pide, evc)) / pide)}
      txt={falta ? 'Te ' + (falta === 1 ? 'falta 1 evento' : 'faltan ' + falta + ' eventos') + ' en servidores Tier 1 o 2 para tu letra' : 'Tu letra llega con la próxima corrida'} href="#/ranking/competitivo" />;
  } else if (yo) {
    yoComp = fila(puestoDe(liga, compT, (f) => f.k === yo.k, (f) => f.sc || 0, 'de Score', 1), '#/ranking/competitivo');
  }
  const sc1 = (x) => (Number(x) || 0).toFixed(1).replace('.', ',');
  // los eventos del Competitivo, los de Tier 1 (`evcDe()`, 18/11/2026): decía 34 de Carlosss y su Ranking, 28
  cats.push(['competitivo', 'Competitivo', compT.slice(0, 5).map((f) => per(f, 'competitivo', f.sc || 0, sc1(f.sc), 'SCORE', 'Rango ' + f.rg + ' · ' + evcDe(f) + ' eventos', '',
    [[sc1(f.sc), 'SCORE'], [f.rg, 'RANGO'], [evcDe(f), 'EVENTOS'], [f.wr || '—', 'GANADAS']])), yoComp]);
  // ⚔️ ELO (Dlx, 12/11/2026: «los rankings que faltan»): las batallas uno contra uno por divisiones. La carta es la
  // Competitiva (la que habla de batallas); su «#» es el del Competitivo: el puesto en ELO es el de esta lista
  const eloT = [];
  for (const g of ((liga.d.div || {}).d || [])) for (const gg of g || []) for (const x of gg || []) eloT.push(x);
  eloT.sort((a, b) => (b[1] || 0) - (a[1] || 0));
  // sin los de «fuera de concurso», como los demás rankings de acá (`oficiales()`)
  const eloF = eloT.map((x) => [x, liga.fila(x[0])]).filter(([, f]) => f && f.k && liga.T[f.k] && !liga.T[f.k].fc);
  const yoElo = yo ? puestoDe(liga, eloF, ([, f]) => f.k === yo.k, ([x]) => x[1] || 0, 'de ELO') : null;
  cats.push(['elo', 'ELO', eloF.slice(0, 5).map(([x, f]) => { const g = liga.T[f.k]; return per(g, liga.cartaDe(f.k, { comp: 1 }) || 'temporada', x[1] || 0, num(x[1] || 0), 'ELO',
    'Batallas 1 contra 1 por divisiones', '', [[num(x[1] || 0), 'ELO'], [g.du ? g.du[0] + '/' + g.du[1] : '—', 'DUELOS'], [g.rg || '—', 'RANGO']]); }),
  yoElo ? fila(yoElo, '#/ranking/divisiones') : null]);
  // ⚔️ de la tabla (`du: [ganados, jugados]`, 29/10/2026): la lista entera de Duelos ya no viaja en el lobby, y acá sólo
  // se mira a los de la tabla. El mismo orden que el Ranking de Duelos: ganados, jugados y nombre
  const duT = (liga.d.duelos || T.filter((f) => f.du).map((f) => ({ k: f.k, n: f.n, g: f.du[0], t: f.du[1], fc: f.fc }))
    .sort((a, b) => b.g - a.g || b.t - a.t || ((a.n || '') < (b.n || '') ? -1 : (a.n || '') > (b.n || '') ? 1 : 0)))
    .filter((d) => !d.fc && liga.T[d.k]);
  cats.push(['duelos', 'Duelos', duT.slice(0, 5).map((d) => per(liga.T[d.k], liga.cartaDe(d.k, { comp: 1 }) || 'temporada', d.g || 0, d.g || 0, 'GANADOS',
    'de ' + (d.t || 0) + ' duelos jugados', '', [[d.g || 0, 'GANADOS'], [d.t || 0, 'JUGADOS'], [d.t ? Math.round((100 * (d.g || 0)) / d.t) + '%' : '—', 'EFECTIVIDAD']])),
    yo ? fila(puestoDe(liga, duT, (d) => d.k === yo.k, (d) => d.g || 0, 'duelos ganados'), '#/ranking/duelos') : null]);
  // 🏟️ LIGAS (Dlx, 12/11/2026): los cinco mejores OVR de liga, sumando todas las ligas, con su carta de liga. Quién tiene
  // carta y con qué OVR viene en `/api/ligas` (`cartas`), el mismo pedido que la página ya hace una vez por lobby
  if (ligasC && Object.keys(ligasC).length) {
    const nomLiga = {};
    ((ligasL || {}).ligas || []).forEach((L) => { nomLiga[L.id] = L.n; });
    // 🧑 (18/11/2026) no sólo los de la tabla: la carta de liga no sale de las 200 filas, y quien está más abajo (Krtman es
    // el #133 y no viaja) no entraba nunca, ni a su propia fila. Con su fila entera (`persona()`: la tabla, un perfil
    // abierto o los perfiles ya bajados) y sin «fuera de concurso». ⚠️ El staff que no compite (`solo`: Ceko, OVR de liga
    // 98) sigue afuera hasta que Dlx diga si cuenta; y de quien sólo viaja con su nombre no se sabe si es `fc`: afuera
    const todas = [];
    // 🏷️ y la marca de `/api/ligas` (18/11/2026, `_con_cartas_liga()`: 1 fuera de concurso, 2 staff que no compite, 3 no
    // jugó la temporada, 0 del pool con número) dice lo que el Inicio no sabe de quien sólo viaja con su nombre; con un
    // `/api/ligas` de antes, sin marca, como hasta ahí
    Object.entries(ligasC).forEach(([k, xs]) => {
      const f = liga.persona(k);
      const marca = ((xs || [])[0] || [])[4];
      if ((f && (f.fc || f.solo)) || marca === 1 || marca === 2 || marca === 3 || (!f && marca == null)) return;
      (xs || []).forEach((x) => todas.push({ k, lid: x[0], v: x[1], ovr: x[2] || 0 }));
    });
    todas.sort((a, b) => b.ovr - a.ovr);
    const vistos = new Set();
    const mejores = todas.filter((x) => (vistos.has(x.k) ? false : vistos.add(x.k))).slice(0, 5);
    const miL = yo ? todas.filter((x) => x.k === yo.k)[0] : null;
    const iMiL = miL ? todas.filter((x, j) => todas.findIndex((y) => y.k === x.k) === j).findIndex((x) => x.k === yo.k) : -1;
    const src = (x, chica) => liga.d.r2 + '/' + encodeURIComponent(x.k) + '/liga-' + x.lid + (chica ? '.chica' : '') + '.webp?v=' + x.v;
    cats.push(['ligas', 'Ligas', mejores.map((x) => {
      // la fila de fuera de la tabla también (`persona()`, ver arriba): el nombre, con `nombreDe()`
      const f = liga.persona(x.k) || liga.quienK(x.k) || {};
      return {
        key: x.k, pk: x.k, href: '#/ligas/' + encodeURIComponent(x.lid), nom: liga.nombreDe(x.k, f.n), cc: f.cc, sub: nomLiga[x.lid] ? limpio(nomLiga[x.lid]) : 'Su liga', v: x.ovr, vt: x.ovr, vl: 'OVR',
        st: [[x.ovr, 'OVR DE LIGA'], [(ligasC[x.k] || []).length, (ligasC[x.k] || []).length === 1 ? 'LIGA' : 'LIGAS']],
        grande: <img className="ci mn-carta" alt={'Carta de liga de ' + liga.nombreDe(x.k, f.n)} loading="lazy" src={src(x, true)} />,
        mini: <img className="ci mn-ci" alt="" loading="lazy" src={src(x, true)} />,
      };
    }),
    iMiL >= 5 ? <Puesto cara={cara} quien={quien} pos={'#' + (iMiL + 1)} txt={'OVR de liga ' + miL.ovr + (nomLiga[miL.lid] ? ' · ' + nomLiga[miL.lid] : '')} href="#/ligas" /> : null]);
  }
  const medT = T.filter((f) => (f.oro || 0) + (f.seg || 0) + (f.ter || 0))
    .sort((a, b) => (b.oro || 0) - (a.oro || 0) || (b.seg || 0) - (a.seg || 0) || (b.ter || 0) - (a.ter || 0) || a.pos - b.pos);
  const iMed = yo ? medT.findIndex((f) => f.k === yo.k) : -1;
  cats.push(['podios', 'Podios', medT.slice(0, 5).map((f) => per(f, 'temporada', f.oro || 0, f.oro || 0, '1.º', '2.º ×' + (f.seg || 0) + ' · 3.º ×' + (f.ter || 0), '',
    [[f.oro || 0, '1.º'], [f.seg || 0, '2.º'], [f.ter || 0, '3.º'], [f.ev || 0, 'EVENTOS']])),
    iMed >= 5 ? <Puesto cara={cara} quien={quien} pos={'#' + (iMed + 1)} txt={'1.º ×' + (yo.oro || 0) + ' · 2.º ×' + (yo.seg || 0) + ' · 3.º ×' + (yo.ter || 0)} href="#/ranking/podios" /> : null]);
  const con = T.filter((f) => (f.rch || []).length > 1 && f.rch[1]);
  // 🔥 la más larga, como el ranking de Rachas desde el 16/11/2026 (Dlx: «debería ser máxima»): hasta ahí mandaba la viva
  // y el #1 de acá no era el del ranking. A igual racha, la que sigue viva
  const raT = con.slice().sort((a, b) => (b.rch[1] - a.rch[1]) || (b.rch[0] - a.rch[0]) || a.pos - b.pos);
  const racha = (f) => f.rch[1];
  const sigue = (f) => f.rch[0] && f.rch[0] === f.rch[1];
  cats.push(['rachas', 'Rachas', raT.slice(0, 5).map((f) => per(f, 'temporada', racha(f), racha(f), 'SEGUIDOS', sigue(f) ? 'Su mejor racha, y sigue' : 'Su mejor racha de la temporada', '',
    [[racha(f), sigue(f) ? 'SEGUIDOS, Y SIGUE' : 'SEGUIDOS'], [f.rch[0] || 0, 'AHORA'], [f.ev || 0, 'EVENTOS']])),
    yo ? fila(puestoDe(liga, raT, (f) => f.k === yo.k, racha, 'eventos seguidos'), '#/ranking/rachas') : null]);
  // 🧑‍🤝‍🧑 países y crews no tienen carta: debajo de su bandera o su escudo, sus tres mejores (estirar la bandera la recortaba)
  const mejores = (fs, titulo) => (fs.length ? (
    <div className="mn-gente"><small>{titulo}</small>
      {fs.slice(0, 3).map((f) => <a key={f.k} className="mn-g" href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="mn-g-c" /><b>{limpio(f.n)}</b>{f.pos ? <span>#{f.pos}</span> : null}</a>)}
    </div>
  ) : null);
  const paT = (liga.d.paises || []).filter((p) => p.n);
  const miPais = yo && yo.cc ? puestoDe(liga, paT, (p) => p.cc === yo.cc, (p) => p.pts || 0, 'pts') : null;
  cats.push(['paises', 'Países', paT.slice(0, 5).map((p) => ({
    key: p.cc, href: '#/pais/' + p.cc, nom: nombrePais(p.cc), sub: p.n + (p.n === 1 ? ' rapero' : ' raperos'), sub1: num(p.pts || 0) + ' pts · ' + p.n + (p.n === 1 ? ' rapero' : ' raperos'), v: p.pts || 0, vt: corto(p.pts || 0), vl: 'PTS',
    tile: true, st: [[corto(p.pts || 0), 'PTS'], [p.n, p.n === 1 ? 'RAPERO' : 'RAPEROS']],
    grande: <div className="mn-tile-col"><a className="mn-tile" href={'#/pais/' + p.cc}><Bandera cc={p.cc} cls="mn-tile-bandera" /></a>
      {mejores(T.filter((f) => f.cc === p.cc), 'Sus mejores')}</div>,
    mini: <Bandera cc={p.cc} cls="mn-ci bandera" />,
  })),
  miPais ? <Puesto cara={<Bandera cc={yo.cc} cls="mc-yo-flag" />} quien={'TU PAÍS · ' + nombrePais(yo.cc).toUpperCase()} pos={'#' + miPais.pos} txt={miPais.txt} pct={miPais.pct} href="#/ranking/paises" /> : null]);
  const crT = (liga.d.crews || []).filter((c) => c.rk !== 0);
  const miCrew = yo ? liga.crewDe(yo) : null;
  const xCrew = miCrew ? puestoDe(liga, crT, (c) => c.crew === miCrew.crew, (c) => c.pts || 0, 'pts') : null;
  const escudo = (c, cls) => (escudoDe(c.logo, limpio(c.crew)) ? <span className={cls + ' con-esc'}><Escudo e={escudoDe(c.logo, limpio(c.crew))} /></span>
    : <img className={cls} alt="" src={srcLogo(c.logo)} />);
  cats.push(['crews', 'Crews', crT.slice(0, 5).map((c) => ({
    key: c.crew, href: '#/crew/' + encodeURIComponent(c.clave || c.crew), nom: limpio(c.crew), sub: c.n + (c.n === 1 ? ' rapero' : ' raperos'), sub1: num(c.pts || 0) + ' pts · ' + c.n + (c.n === 1 ? ' rapero' : ' raperos'), v: c.pts || 0, vt: corto(c.pts || 0), vl: 'PTS',
    tile: true, st: [[corto(c.pts || 0), 'PTS'], [c.n, c.n === 1 ? 'RAPERO' : 'RAPEROS']],
    grande: <div className="mn-tile-col"><a className="mn-tile" href={'#/crew/' + encodeURIComponent(c.clave || c.crew)}>{escudo(c, 'mn-tile-logo')}</a>
      {mejores((c.gente || []).map((n) => liga.fila(n)).filter(Boolean).sort((a, b) => (a.pos || 1e9) - (b.pos || 1e9)), 'Sus mejores')}</div>,
    mini: escudo(c, 'mn-ci logo'),
  })),
  xCrew ? <Puesto cara={null} quien={'TU CREW · ' + limpio(miCrew.crew).toUpperCase()} pos={'#' + xCrew.pos} txt={xCrew.txt} pct={xCrew.pct} href="#/ranking/crews" /> : null]);
  // sin haber entrado (ni con Discord ni eligiendo quién eres), la invitación a verse
  const invita = !yo && !dc ? (
    <div className="mc-yo invita"><span className="mc-yo-t">¿Y tú? Entra con Discord y ves tu puesto en cada categoría.</span>
      <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar</button></div>
  ) : null;
  const items = cats.filter((x) => x[2].length).map(([c, et, xs, yoFila]) => ({ c, et, t: 'Los que mandan', cuerpo: <Mandan liga={liga} c={c} xs={xs} yoFila={yoFila || invita} pub={pub} /> }));
  return <Pest id="raperos" titulo="Los que mandan" bajada="Los cinco primeros de cada ranking de la temporada." enlace="Todos los raperos" href="#/ranking" items={items} extra="negra raya" />;
}

// ── el panel de abajo: Misiones + el Pase · Tus eventos + Tu temporada · La Liga en números ──────────
// Hasta el 05/10/2026 las dos iban como «Próximamente», sin números de ejemplo (Dlx, «3. sí»). Ahora existen: las
// Misiones viajan en el lobby (`mis`, bot/misiones.py) y el Pase lo pide cada uno con su sesión (pase.js).
function Misiones({ liga }) {
  const M = liga.d.mis;
  const lista = (M && M.lista) || [];
  if (!lista.length) return null;
  const yo = liga.yo;
  const esYo = (raw) => !!yo && liga.esDe(raw, yo.k);
  const mio = Object.keys(M.prog || {}).find(esYo);
  return (
    <section className="mis">
      <div className="mis-cab"><span>MISIONES DE LA SEMANA · SUMAN A TU TEMPORADA</span><em>HASTA {liga.dia(M.fin).toUpperCase()}</em></div>
      <ol>
        {lista.map((x, i) => {
          const v = Math.min(mio ? (M.prog[mio] || [])[i] || 0 : 0, x.m);
          const ok = !!mio && v >= x.m;
          return (
            <li key={x.id} className={ok ? 'hecha' : ''}>
              <span className="mis-ok" aria-hidden="true">{ok ? '✓' : ''}</span>
              <div className="mis-txt">
                <b>{x.t}</b>
                {yo ? <><span className="mb"><i style={{ width: Math.round(100 * v / x.m) + '%' }} /></span><small>{v} de {x.m}</small></> : null}
              </div>
              <span className="mis-pts">+{num(x.p)}<small>PTS</small></span>
            </li>
          );
        })}
      </ol>
      <div className="mis-pie"><small>Fácil, media y difícil juntas: <b>+{num(M.bono)}</b> más.</small><a className="btn borde2 chico" href="#/ranking/misiones">Ver las misiones</a></div>
    </section>
  );
}
// ── 🚪 LAS PUERTAS DEL LOBBY (Dlx, 13/10/2026: «el Inicio quiero que se sienta como un inicio, un home, un lobby»). En
// el lobby de un juego, lo de abajo del escenario son puertas, y cada una dice qué hay del otro lado AHORA: cuántos
// eventos hay hoy, en qué puesto vas, cuántos buscados quedan, tu nivel. Son la forma corta de los bloques que se
// mudaron a su sección (Misiones, Se busca, Encuestas, Merch, La Liga en números): el Inicio pasó de 11 a 6
export function Puertas({ liga, dc }) {
  const P = usePase(!!dc);
  const ahora = liga.ahora;
  const hoyK = liga.diaClave(new Date(ahora).toISOString());
  const cal = (liga.d.calendario || []).filter((c) => !liga.canceladoCal(c));
  const hoy = cal.filter((c) => liga.diaClave(c.t) === hoyK && utc(c.t) > ahora - 3 * 3600000);
  const prox = cal.filter((c) => utc(c.t) > ahora).sort((a, b) => utc(a.t) - utc(b.t))[0];
  const ev = hoy.length ? (hoy.length === 1 ? 'Hoy hay 1 evento' : 'Hoy hay ' + hoy.length + ' eventos')
    : prox ? 'El próximo, ' + liga.cuando(new Date(utc(prox.t))) : 'El calendario de la Liga';
  const yo = liga.yo;
  const uno = (liga.d.tabla || []).find((f) => f.pos === 1);
  const rk = yo && yo.pos ? 'Vas #' + yo.pos + ' de la temporada' : uno ? '#1: ' + limpio(uno.n) : 'Las tablas de la temporada';
  const mw = liga.d.mw || {};
  const bus = (mw.b || []).length;
  const se = bus ? bus + ' buscados · vencen ' + liga.dia(mw.fin) : 'Quién cazó a quién';
  const pa = dc && P && P.listo && P.miembro ? 'Vas en el nivel ' + P.nivel + ' de ' + P.niveles : '30 niveles con premios';
  const tj = yo ? 'La tuya y las de todos' : 'Las de cada rapero';
  const puertas = [
    ['eventos', '#/eventos', 'Eventos', ev],
    ['ranking', '#/ranking', 'Ranking', rk],
    ['mira', '#/ranking/mw', 'Se busca', se],
    ['tarjetas', '#/tarjetas', 'Tarjetas', tj],
    ['pase', '#/pase', 'Pase', pa],
    ['tienda', '#/tienda', 'Tienda', 'Puntos, precios y ropa'],
  ];
  return (
    <nav className="puertas" aria-label="Entrar a">
      {puertas.map(([ic, href, t, d]) => (
        <a key={href} className="pu" href={href}><Ico n={ic} t={26} /><b>{t}</b><small>{d}</small></a>
      ))}
    </nav>
  );
}

// 🎟️ el Pase: tu nivel y tu XP si sos miembro de DRA; si no, qué es y cómo se sube (con XP desde el 06/10/2026)
function Pase({ liga, dc }) {
  const P = usePase(!!dc);
  const pub = usePases();
  if (dc && P && P.listo && P.miembro) {
    const cuenta = (b) => (b ? b.tareas.filter((t) => t.hecha).length + ' de ' + b.tareas.length : '');
    const sig = proximoEspecial(P.premios, P.nivel);
    const a = avance(P);
    return (
      <section className="tu pase">
        <div className="tu-t">PASE DE RAPERO · {liga.temp}</div>
        <div className="tu-fila">
          <div className="tu-pos"><b>NIVEL {P.nivel}</b><small>de {P.niveles} · {num(P.xp)} XP</small></div>
          {P.nivel < P.niveles ? <span className="pase-sig" title="El próximo nivel">{P.nivel + 1}</span> : null}
        </div>
        {/* lo que llevás del nivel que estás haciendo; con el Pase completo, llena */}
        <span className="mb pase-b"><i style={{ width: (a ? Math.round((100 * a.lleva) / a.de) : 100) + '%' }} /></span>
        <ul className="pase-l">
          {a ? <li><span>Para el nivel {P.nivel + 1}</span><b>{num(a.falta)} XP</b></li> : null}
          {P.hoy ? <li><span>Tareas de hoy</span><b>{cuenta(P.hoy)}</b></li> : null}
          {P.semana ? <li><span>Tareas de esta semana</span><b>{cuenta(P.semana)}</b></li> : null}
          {sig ? <li><span>En el nivel {sig[0]}</span><b>{premioTexto(sig)}</b></li> : null}
        </ul>
        <a className="btn negro" href="#/pase">Ver el Pase</a>
      </section>
    );
  }
  const cfg = (pub && pub.cfg) || {};
  return (
    <section className="tu pase">
      <div className="tu-t">PASE DE RAPERO · {liga.temp}</div>
      <p className="pronto-p pase-p">{cfg.niveles || 30} niveles por temporada: las Tareas dan XP, la XP sube de nivel y cada nivel paga Puntos de Tienda.</p>
      {(cfg.semanales || []).length ? <ul className="pase-l">{cfg.semanales.map((t) => <li key={t[0]}><span>{t[1]}</span><b>+{num(t[5])} XP</b></li>)}</ul> : null}
      {dc ? <a className="btn negro" href="#/pase">Ver el Pase</a>
        : <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>}
      <small className="pase-nota">Para los miembros de Discord Rap Español.</small>
    </section>
  );
}
// Dlx, 30/09/2026: «tus últimos eventos son raros porque dice que son los últimos eventos». Decía «Tus eventos» en
// la pestaña y mostraba los de la Liga, que ya están en Fechas. Ahora son los tuyos, o cómo verlos.
// 🔴 QUIEN JUGÓ Y NO ESTÁ EN LAS 200 FILAS QUE VIAJAN (revisión del 03/10/2026): `liga.yo` sale de la tabla, que llega
// cortada en 200, y a los de más abajo se les decía «todavía no jugaste». `lg:dc` trae sus eventos y su clave
function FueraDe200({ dc, cls, tit }) {
  return (
    <section className={cls}>
      {cls === 'te' ? <div className="mis-cab"><span>{tit}</span></div> : <div className="tu-t">{tit}</div>}
      <p className="pronto-p">Jugaste {dc.ev} {dc.ev === 1 ? 'evento' : 'eventos'} en la temporada: estás más abajo de los 200 que muestra la tabla de la página. En tu perfil están tus tarjetas; tus eventos y tus duelos aparecen cuando entras entre los 200.</p>
      <div className="te-acc"><a className="btn negro" href={'#/r/' + encodeURIComponent(dc.clave)}>Ver mi perfil</a></div>
    </section>
  );
}

export function TusEventos({ liga, dc }) {
  const f = liga.yo;
  if (!f && dc && dc.ev > 0 && dc.clave) return <FueraDe200 dc={dc} cls="te" tit="CÓMO TE FUE" />;
  if (!f && dc) {
    return (
      <section className="te">
        <div className="mis-cab"><span>CÓMO TE FUE</span></div>
        <p className="pronto-p">Tu cuenta de Discord todavía no tiene eventos en la {liga.temp}. Con el primero que juegues, acá aparecen tu puesto y los puntos que sumaste.</p>
        <div className="te-acc"><a className="btn negro" href="#/eventos">Ver los próximos eventos</a></div>
      </section>
    );
  }
  if (!f) {
    return (
      <section className="te">
        <div className="mis-cab"><span>CÓMO TE FUE</span></div>
        <p className="pronto-p">Entra con Discord y acá aparecen los eventos que jugaste esta temporada, con tu puesto y los puntos que sumaste.</p>
        <div className="te-acc"><button type="button" className="btn negro" onClick={accion.entrar}>Entrar con Discord</button></div>
      </section>
    );
  }
  const mios = liga.semanaDe(f.k).slice(0, 5);
  return (
    <section className="te">
      <div className="mis-cab"><span>CÓMO TE FUE · {liga.temp}</span><em>{f.ev || 0} {f.ev === 1 ? 'EVENTO' : 'EVENTOS'}</em></div>
      {mios.length ? (
        <ol className="te-l">
          {mios.map(([ll, res, pts]) => (
            <li key={ll.n}><button type="button" className="sin-boton te-b" onClick={() => accion.llave(ll.n)}>
              <img alt="" src={liga.logo(ll.sv)} />
              <div><b>{limpio(ll.nombre)}</b><small>{siglaDe(ll.sv)} · {liga.cuando(liga.fechaLlave(ll))} · {ll.participantes} raperos</small></div>
              <span className={'te-vos' + (res === 'Campeón' ? ' campeon' : '')}>{resultado(res, true)}<small>+{num(pts)} pts</small></span>
            </button></li>
          ))}
        </ol>
      ) : (
        <p className="pronto-p">Todavía no jugaste en esta temporada. Los próximos eventos están en el <a className="te-link" href="#/eventos">calendario</a>.</p>
      )}
    </section>
  );
}
export function TuTemporada({ liga, dc }) {
  const f = liga.yo;
  if (!f && dc && dc.ev > 0 && dc.clave) return <FueraDe200 dc={dc} cls="tu" tit="TU TEMPORADA" />;
  if (!f && dc) {
    return (
      <section className="tu">
        <div className="tu-t">TU TEMPORADA</div>
        <p className="pronto-p">Todavía no jugaste en la {liga.temp}. Con tu primer evento aparecen tu puesto y tu OVR; tu carta de Temporada sale con tu primera Tarea del Pase.</p>
        <button type="button" className="btn negro" onClick={accion.cuenta}>Mi cuenta</button>
      </section>
    );
  }
  if (!f) {
    return (
      <section className="tu">
        <div className="tu-t">TU TEMPORADA</div>
        <p className="pronto-p">Entra con Discord y acá vas a ver tu puesto, tu OVR, cuánto te falta para tu letra y si te buscan.</p>
        <button type="button" className="btn negro" onClick={accion.entrar}>Entrar con Discord</button>
      </section>
    );
  }
  const ev = f.ev || 0;
  // 🎯 la letra pide eventos de Tier 1 (`evcDe()`, 18/11/2026): con `ev` decía «Ya tienes letra.» a quien no la tenía
  const pide = pideComp(liga);
  const evc = evcDe(f);
  const falta = f.rg ? 0 : Math.max(0, pide - evc);
  const llenas = f.rg ? 10 : Math.round((10 * Math.min(pide, evc)) / pide);
  const bus = liga.buscado(f.k);
  const mw = liga.d.mw || {};
  return (
    <section className="tu" id="tu">
      <div className="tu-t">TU TEMPORADA · {limpio(f.n).toUpperCase()}</div>
      <div className="tu-fila">
        <div className="tu-pos"><b>{f.pos ? '#' + f.pos : '—'}</b><small>OVR {f.ovr || '—'} · {num(f.pts)} pts · {ev} eventos</small></div>
        {f.rg ? <Rango liga={liga} rg={f.rg} /> : <span className="rg sinletra">?</span>}
      </div>
      <div className="tu-prog">
        <div className="barra10">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < llenas ? 'si' : ''} />)}</div>
        <small>{falta ? 'Todavía sin letra: ' + evc + ' de ' + pide + ' eventos en servidores Tier 1 o 2. Te ' + (falta === 1 ? 'falta 1' : 'faltan ' + falta) + ' para tu rango.'
          : f.rg ? 'Ya tienes letra.' : 'Tu letra llega con la próxima corrida.'}</small>
      </div>
      {bus ? <div className="te-buscan"><b>HOY TE BUSCAN</b><span>{num(bus.v)} pts por tu cabeza · {bus.cn} · hasta {liga.dia(mw.fin)}</span></div> : null}
      <div className="tu-acc"><a className="btn negro" href={'#/r/' + encodeURIComponent(f.k)}>Ver mi perfil</a>
        <Compartir cls="btn borde2" url={liga.cartaUrl(f.k, 'temporada') || enlace('#/r/' + encodeURIComponent(f.k))} texto="Mi carta de la Liga Global" etiqueta="Compartir mi carta" /></div>
    </section>
  );
}
// ¿hubo al menos una participación en las dos semanas de «Lo que se jugó»?
const jugoAlgo = (a) => (a.dias || []).some(([, x]) => Object.values(x || {}).some((n) => n > 0));
function Numeros({ liga }) {
  const c = liga.d.comunidad || {};
  const a = liga.d.actividad || {};
  // 🔢 la cuenta de personas sale de los Discords que el bot puede leer, que pueden ser menos que los socios: decía «en 15
  // servidores» al lado de «Servidores 16» (revisión 21/11). Si faltan, se dice de cuántos
  // los socios son los que tienen tier (25/11/2026): Cypherhood sigue en `liga.svs` por lo jugado y no es socio
  const nSv = c.servidores || 0, totSv = Object.values(liga.svs || {}).filter((s) => s && s.tier).length;
  const grandes = [['PERSONAS', c.personas, 'en ' + nSv + (totSv > nSv ? ' de los ' + totSv : '') + ' servidores'], ['EN LA LISTA', c.lista, 'compitieron o se anotaron'],
    // 🪪 (18/11/2026) «con las cuatro tarjetas» era la regla de antes de la 2.41: verificarse da la Servidor, y las demás
    // piden lo suyo. `verificados` cuenta a quien pasa el portón: Miembro de DRA, con su Discord y su país
    ['CON SU DISCORD', c.con_id, 'el bot sabe quiénes son'], ['VERIFICADAS', c.verificados, 'Miembros de Discord Rap Español']].filter((x) => x[1]);
  // sin un solo evento en las dos semanas no se dibuja: una tira de ceros el día del arranque dice «no pasa nada»,
  // y lo que pasa es que la temporada recién empieza (medido con la página en cero, 02/10/2026)
  const dias = jugoAlgo(a) ? a.dias : [];
  const tope = Math.max(1, ...dias.map(([, x]) => Object.values(x).reduce((s, v) => s + v, 0)));
  return (
    <div className="num-g">
      <div>
        {grandes.length ? <div className="num-4">{grandes.map(([t, v, d]) => <div key={t}><span>{t}</span><b>{num(v)}</b><small>{d}</small></div>)}</div> : null}
        {dias.length ? (
          <section className="act">
            <div className="mis-cab"><span>LO QUE SE JUGÓ · DOS SEMANAS</span><em>{a.ev || 0} EVENTOS ESTA SEMANA</em></div>
            <div className="act-g">
              {dias.map(([d, x]) => {
                const dd = utc(d + 'T12:00:00Z');
                return (
                  <i key={d}><span className="act-b">{Object.entries(x).sort().map(([sv, n]) => (
                    <u key={sv} style={{ height: (100 * n / tope).toFixed(1) + '%', background: (liga.svs[sv] || {}).color || '#A5A5A0' }} title={siglaDe(sv) + ' ' + n} />
                  ))}</span><em>{DIAS[dd.getUTCDay()].slice(0, 1).toUpperCase()}</em></i>
                );
              })}
            </div>
            {/* 🔑 MÁS DETALLE (Dlx, 03/10/2026: «cuántos nuevos hay, cuántas personas rapearon estas 2 semanas, etc.»):
                la semana, las dos semanas, los nuevos y los que volvieron. Sin el dato nuevo (un payload viejo), la línea
                de siempre */}
            {a.gente14 != null ? (
              <div className="act-4">
                <div><span>ESTA SEMANA</span><b>{num(a.gente || 0)}</b><small>raperos · {num(a.part || 0)} participaciones</small></div>
                <div><span>DOS SEMANAS</span><b>{num(a.gente14 || 0)}</b><small>raperos distintos</small></div>
                <div><span>NUEVOS</span><b>{num(a.nuevos || 0)}</b><small>{a.nuevos_ant ? 'su primer evento · ' + num(a.nuevos_ant) + ' la anterior' : 'su primer evento, esta semana'}</small></div>
                <div><span>VOLVIERON</span><b>{num(a.vuelven || 0)}</b><small>{a.gente_ant ? 'de los ' + num(a.gente_ant) + ' de la semana anterior' : 'jugaron las dos semanas'}</small></div>
              </div>
            ) : <p className="act-n"><b>{num(a.part || 0)}</b> participaciones · <b>{num(a.gente || 0)}</b> raperos distintos en 7 días</p>}
          </section>
        ) : null}
      </div>
      {(liga.d.records || []).length ? (
        <section className="rec">
          <div className="mis-cab"><span>LOS RÉCORDS DE LA {liga.temp}</span></div>
          <ol>{(liga.d.records || []).slice(0, 6).map((r) => (
            // 🔢 «90.5%» llega armado del payload: el decimal con coma y el % separado, como el resto de la página (revisión 22/11/2026,
            // G5#21). Sólo el número pegado a «%»: el punto de los miles («1.500») no se toca
            <li key={r.id}><span>{r.que}</span><a href={r.k ? '#/r/' + encodeURIComponent(r.k) : undefined}><b>{liga.aka(r.n, r.k)}</b></a><em>{typeof r.v === 'number' ? num(r.v) : String(r.v).replace(/(\d)\.(\d+)\s*%/, '$1,$2 %')}</em></li>
          ))}</ol>
        </section>
      ) : null}
    </div>
  );
}
// Misiones, solas: Dlx, 30/09/2026, «dejar abajo solo las misiones». Tus eventos subió al lugar de las encuestas y
// La Liga en números bajó, debajo del Merchandising.
export function Panel({ liga, dc }) {
  return (
    <Sec id="panel" titulo="Misiones" enlace="El Pase" href="#/pase">
      <div className="pz-2"><Misiones liga={liga} /><Pase liga={liga} dc={dc} /></div>
    </Sec>
  );
}

// La Liga en números, sola, debajo del Merchandising (Dlx, 30/09/2026). Sin datos, no se dibuja
export function LaLiga({ liga }) {
  const c = liga.d.comunidad || {};
  const a = liga.d.actividad || {};
  const hay = c.personas || c.lista || c.con_id || c.verificados || jugoAlgo(a) || (liga.d.records || []).length;
  if (!hay) return null;
  // sin «Socios →»: esta sección vive en la página de Socios, y el link recargaba la misma página (revisión 21/11)
  return <Sec id="numeros" titulo="La Liga en números"><Numeros liga={liga} /></Sec>;
}
