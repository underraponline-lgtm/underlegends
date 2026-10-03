// Eventos, rehecho (`#/eventos`). Dlx, 02/10/2026: «AHORA hay que remake la página de eventos». Es el TABLERO que
// aprobó el 29/09 (*«sí, pero con una mezcla del actual, que podamos ver las llaves»*): los días arriba, lo que pasa
// cada día en tres grupos —en vivo, lo que viene y lo que terminó, con su llave—, el mes, la campana y los últimos
// campeones. Para todos desde la 1.93 (Dlx, 02/10/2026: «sí, publícalo»), con sus dos ideas: el campeón como imagen
// para historias y cuándo suele jugar cada servidor. La vista de app.js queda escondida, de respaldo.
//
// ⚠️ TODO SALE DEL PAYLOAD (`calendario`, `proximos`, `llaves`, `actividad`, `orgs`) y de lo que app.js ya sabe en vivo
// (`VIVO_L`): no hay ninguna llamada nueva. La campana la maneja campana.js (`window.Campana`); acá sólo se dibuja.
import { useEffect, useMemo, useRef, useState } from 'react';
import { DIAS, MESES, hora, limpio, minutosDelDia, norm, num, recorte, resultado, utc } from './liga.js';
import { Anotados, Cara, Carta, Compartir, Ico, aDiscord, accion, enlace, useCampana } from './piezas.jsx';
import { CuadroMini, enJuegoDe, gcal, llaveEnVivo } from './arriba.jsx';
import { H, W, aPng, armarYCompartir, cargarImg, carta, lienzo, pie } from './historia.js';

// 🔑 CÓMO TE FUE (Dlx, 02/10/2026, al ver la preview: «sí, hazla como sugeriste»): en cada evento que jugaste, una línea
// «VOS», y un punto en los días que jugaste. Antes había dicho «no sobrecargar»: por eso es una línea y un punto, nada más
// tu fila en una llave: por la clave cuando viene (dos «SOL» se separan así), si no por el nombre
function miFila(liga, ll) {
  const yo = liga.yo;
  if (!yo || !ll) return null;
  return (ll.tabla || []).find((r) => (r[3] ? r[3] === yo.k : ((liga.fila(r[0]) || {}).k === yo.k))) || null;
}

const ANDROID = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
const TACTIL = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
// Google no puede leer `localhost`: desde la compu de desarrollo el .ics apunta al dominio público
const ICS = (typeof location !== 'undefined' && !/^(localhost|127\.|\[::1\])/.test(location.hostname) && location.host
  ? location.host : 'underlegends.pages.dev') + '/calendario.ics';

// «1vs1», «1V1» y «1 VS 1» son el mismo formato (la regla de `claveFormato()` de app.js)
function formato(m) {
  const t = String(m || '').trim();
  // un número suelto no es un formato: el anuncio de la Dos Generaciones Vol 2 decía «11» (los cupos, o nada)
  if (/^\d+$/.test(t.replace(/\s+/g, ''))) return '';
  // «1v1», «1 vs 1», «1x1» → «1VS1», y lo que sigue se queda: «1v1 sin replica» → «1VS1 sin réplica», al lado de los otros 1VS1
  const x = /^(\d+)\s*(?:vs|v|x)\s*(\d+)\b\s*(.*)$/i.exec(t);
  return x ? (x[1] + 'VS' + x[2] + (x[3] ? ' ' + x[3] : '')).replace(/\breplica\b/i, 'réplica') : t;
}

// ── la campana, con el estado de campana.js (`useCampana()` de piezas.jsx): los mismos pasos de siempre, con el estilo nuevo ──
function Campana({ liga }) {
  const e = useCampana();
  const C = window.Campana;
  if (!e || !C) return <p className="pronto-p">La campana no cargó en este navegador. Recargá la página.</p>;
  let cuerpo;
  if (!e.soporta && e.ios && !e.instalada) {
    cuerpo = (
      <>
        <p className="evp-tx">En iPhone y iPad los avisos llegan con la Liga en la pantalla de inicio:</p>
        <ol className="evp-pasos"><li>Tocá <b>Compartir</b> (el cuadrado con la flecha).</li><li>Elegí <b>Agregar a inicio</b>.</li>
          <li>Abrí la Liga <b>desde ese ícono</b> y volvé acá.</li></ol>
      </>
    );
  } else if (!e.soporta) {
    cuerpo = <p className="evp-tx">Este navegador no puede recibir avisos. En Android andan Chrome, Firefox, Edge y Samsung Internet; en la compu, cualquiera de esos.</p>;
  } else if (e.negado) {
    cuerpo = <p className="evp-tx">Las notificaciones de esta página están <b>bloqueadas</b>. Tocá el candado al lado de la dirección → <b>Notificaciones</b> → <b>Permitir</b>, y recargá.</p>;
  } else if (!e.activa) {
    cuerpo = (
      <>
        {e.pedido ? <p className="evp-ok">Vas a activar los avisos de <b>{e.pedido}</b>, como elegiste en Discord.</p> : null}
        <p className="evp-tx">Un aviso por evento, al minuto de que el servidor lo anuncia. Nada más: ni resultados ni publicidad.</p>
        <button type="button" className="btn verde" onClick={() => C.activar()}><Ico n="campana" t={18} />Activar avisos</button>
      </>
    );
  } else {
    const on = (sv) => !e.todos && e.elegidos.includes(sv);
    cuerpo = (
      <>
        <p className="evp-ok">Este dispositivo recibe los avisos.</p>
        {e.svs.length > 1 ? (
          <>
            <p className="evp-tx">¿De qué servidores?</p>
            <div className="evp-chips" role="group" aria-label="Servidores de los avisos">
              <button type="button" className={e.todos ? 'on' : ''} aria-pressed={e.todos} onClick={() => C.elegir('')}>Todos</button>
              {e.svs.map((s) => (
                <button type="button" key={s.sv} className={on(s.sv) ? 'on' : ''} aria-pressed={on(s.sv)} title={s.n} onClick={() => C.elegir(s.sv)}>
                  <img alt="" src={liga.logo(s.sv)} />{s.sv}</button>
              ))}
            </div>
          </>
        ) : null}
        <div className="evp-acc">
          <button type="button" className="btn borde2 chico" onClick={() => C.probar()}>Mandar una de prueba</button>
          <button type="button" className="evp-lnk" onClick={() => C.desactivar()}>Desactivar</button>
        </div>
        <div className="evp-yo">
          <p className="evp-tx"><b>Tus avisos</b>: cuando te toca pelear en una llave en vivo, cuando subís de rango o desbloqueás una tarjeta, cuando te felicitan, cuando alguien te sigue y cuando alguien que seguís gana.</p>
          {e.yo && e.yo.id ? (
            <p className="evp-ok">Vinculado con tu Discord{e.yo.n ? ' (' + e.yo.n + ')' : ''}. <button type="button" className="evp-lnk" onClick={() => C.desvincular()}>Desvincular</button></p>
          ) : <button type="button" className="btn borde2 chico" onClick={() => C.vincular()}>Vincular con mi Discord</button>}
        </div>
      </>
    );
  }
  return (
    <div className="evp-campana">
      {cuerpo}
      {e.msg ? <p className="evp-msg" role="status">{e.msg}</p> : null}
      <p className="evp-nota">Desde Discord: escribí <b>/notify</b> en cualquier servidor de la Liga y el bot te trae acá con ese servidor ya elegido.</p>
      {e.vigia ? (
        <p className="evp-vig">{e.vigia.ok ? '● ' : '⚠ '}Revisa los canales de eventos cada minuto · última vez {liga.cuando(e.vigia.t)}
          {e.vigia.dispositivos ? ' · ' + e.vigia.dispositivos + ' dispositivos con la campana' : ''}</p>
      ) : null}
    </div>
  );
}

// ── sumarlo al calendario de cada uno: el .ics que sirve el Worker (Google, Apple, Outlook) ─────────────────────────
function Calendario() {
  const [copiado, setCopiado] = useState(false);
  const url = 'https://' + ICS;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch (e) { setCopiado(false); }
  };
  return (
    <div className="evp-cal">
      <p className="evp-tx">Todos los eventos de la Liga en tu calendario, solos: se actualizan cada algunas horas.</p>
      <div className="evp-acc">
        {/* en el teléfono Google no deja sumar un calendario por link: sólo desde la compu (app.js, 27/09/2026) */}
        {!TACTIL ? <a className="btn borde2 chico" href={'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent('webcal://' + ICS)} target="_blank" rel="noopener noreferrer">Google Calendar</a> : null}
        {/* `webcal://` lo abre el iPhone y la compu; Android no tiene quién */}
        {!ANDROID ? <a className="btn borde2 chico" href={'webcal://' + ICS}>Apple · Outlook</a> : null}
        <button type="button" className="btn borde2 chico" onClick={copiar}>{copiado ? 'Link copiado' : 'Copiar el link'}</button>
      </div>
      {TACTIL ? <p className="evp-nota">Desde el teléfono, Google no deja sumarlo: hacelo una vez en calendar.google.com, en «Otros calendarios» → «Desde URL», con este link. Después aparece solo en el teléfono.</p> : null}
      <code className="evp-ics">{url}</code>
    </div>
  );
}

// ── una tarjeta por evento: la hora grande, el servidor, lo que es y qué se puede hacer ─────────────────────────────
function Hora({ t }) {
  return isNaN(utc(t)) ? null : <span className="evp-h">{hora(t)}</span>;
}
// ── el campeón como imagen para historias (Dlx, 02/10/2026: «me gusta»): el evento, la carta de verdad del campeón —las
// dos, si ganó una pareja— y su escalón, con el mismo marco que «Mi puesto» del Ranking (historia.js) ────────────────
function partir(g, texto, ancho) {
  const out = [];
  let l = '';
  texto.split(/\s+/).filter(Boolean).forEach((p) => {
    const x = l ? l + ' ' + p : p;
    if (l && g.measureText(x).width > ancho) { out.push(l); l = p; } else l = x;
  });
  if (l) out.push(l);
  return out;
}
// la imagen se mira días después: «ayer» mentiría, así que va la fecha («1 OCT»)
function fechaFija(liga, t) {
  const k = liga.diaClave(t);
  if (!k) return '';
  const [, m, d] = k.split('-').map(Number);
  return d + ' ' + MESES[m - 1].slice(0, 3);
}
const slug = (s) => norm(limpio(s)).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'evento';
async function imagenCampeon(liga, ll) {
  const { c, g, letra } = await lienzo();
  const tabla = ll.tabla || [];
  let filas = tabla.filter((r) => r[1] === 'Campeón');
  if (!filas.length && tabla.length) filas = [tabla[0]];
  const varios = filas.length > 1;
  letra(700, 34, true); g.fillStyle = '#A5A5A0';
  g.fillText(('LIGA GLOBAL · ' + liga.temp + ' · ' + (varios ? 'CAMPEONES' : 'CAMPEÓN')).toUpperCase(), 72, 132);
  // el evento, en hasta tres renglones: se achica hasta que entra
  const titulo = limpio(ll.nombre).toUpperCase();
  let px = 104;
  let lineas = [];
  for (;;) {
    letra(900, px, false);
    lineas = partir(g, titulo, W - 144);
    if ((lineas.length <= 3 && lineas.every((l) => g.measureText(l).width <= W - 144)) || px <= 56) break;
    px -= 6;
  }
  g.fillStyle = '#F6F6F6';
  let y = 156;
  lineas.forEach((l) => { y += Math.round(px * 0.95); g.fillText(l, 72, y); });
  // el servidor, cuánta gente y el día
  y += 76;
  let x = 72;
  try {
    const lg = await cargarImg(liga.logo(ll.sv));
    g.save(); g.beginPath(); g.arc(x + 26, y - 12, 26, 0, 2 * Math.PI); g.closePath(); g.clip();
    g.drawImage(lg, x, y - 38, 52, 52);
    g.restore();
    x += 72;
  } catch (e) { /* sin logo */ }
  letra(700, 34, true); g.fillStyle = '#F6F6F6'; g.textAlign = 'left';
  g.fillText([ll.sv, ll.participantes ? ll.participantes + ' raperos' : '', fechaFija(liga, liga.fechaLlave(ll))].filter(Boolean).join(' · ').toUpperCase(), x, y);
  // la carta (o las dos de una pareja), con lo que queda arriba del escalón, la línea de la final y el logo
  const yc = y + 56;
  const tope = H - 280 - 48 - 70 - 210 - 28;
  const dos = filas.slice(0, 2);
  let ch = 0;
  // de a una: cada carta sin foto recorta su círculo, y dos a la vez se pisaban el recorte
  for (let i = 0; i < dos.length; i += 1) {
    const r = dos[i];
    const f = r[3] ? liga.T[r[3]] : liga.fila(r[0]);
    const cx = dos.length === 2 ? W / 2 + (i ? 225 : -225) : W / 2;
    // eslint-disable-next-line no-await-in-loop
    ch = Math.max(ch, await carta(g, letra, liga, f ? f.k : '', r[0], 'temporada', cx, yc, dos.length === 2 ? 420 : 540, tope - yc));
  }
  // el escalón del campeón, en verde agua, con su nombre
  const ye = yc + ch + 28;
  const ew = dos.length === 2 ? 870 : 600;
  g.fillStyle = '#29B298'; g.fillRect((W - ew) / 2, ye, ew, 210);
  letra(700, 34, true); g.fillStyle = '#030304'; g.textAlign = 'center';
  g.fillText(varios ? 'CAMPEONES' : 'CAMPEÓN', W / 2, ye + 60);
  const quien = filas.map((r) => limpio(r[0])).join(' y ').toUpperCase();
  let pn = 100;
  letra(900, pn, false);
  while (pn > 40 && g.measureText(quien).width > ew - 60) { pn -= 4; letra(900, pn, false); }
  g.fillText(quien, W / 2, ye + 135 + Math.round(pn * 0.36));
  // a quién le ganó la final, cuando eso se puede decir sin dudas: un campeón y un subcampeón
  const sub = tabla.filter((r) => r[1] === 'Subcampeón');
  if (!varios && sub.length === 1) {
    const txt = ('Le ganó la final a ' + limpio(sub[0][0])).toUpperCase();
    let pf = 34;
    letra(700, pf, true);
    while (pf > 24 && g.measureText(txt).width > W - 144) { pf -= 2; letra(700, pf, true); }
    g.fillStyle = '#F6F6F6';
    g.fillText(txt, W / 2, ye + 210 + 70);
  }
  await pie(g, letra);
  return aPng(c);
}
function BotonCampeon({ liga, ll, estilo = 'borde2 chico', ic = false }) {
  const [est, setEst] = useState('');
  const hacer = () => {
    if (est === 'armando') return;
    const g = liga.campeon(ll);
    const dia = liga.diaClave(liga.fechaLlave(ll));
    armarYCompartir(() => imagenCampeon(liga, ll), 'campeon-' + slug(ll.nombre) + '.png',
      g.join(' y ') + (g.length > 1 ? ' ganaron ' : ' ganó ') + limpio(ll.nombre) + ' en la Liga Global. ' + enlace('#/eventos/' + dia), setEst, 'eventos');
  };
  const txt = est === 'armando' ? 'Armando la imagen…' : est === 'bajada' ? 'Imagen guardada' : est === 'error' ? 'No pude armarla' : 'Para historias';
  return (
    <button type="button" className={'btn ' + estilo + ' evp-hist' + (ic ? ' ic' : '')} onClick={hacer} aria-busy={est === 'armando'} aria-live="polite" title={ic ? txt : undefined}>
      <Ico n="compartir" t={16} /><span>{txt}</span>
    </button>
  );
}

function Acciones({ liga, e, L, fut, ll, est }) {
  // a Discord con la invitación, no con el link al mensaje: «Inscribite ya» antes de empezar, «Entrar al servidor» en
  // vivo (Dlx, 03/10/2026: «2. A»; ver `aDiscord()`). Lo que ya pasó sigue llevando al anuncio
  const dd = fut || est === 'vivo' ? aDiscord(liga, { sv: e.sv, ins: (e.px || {}).ins, link: e.link }, !fut) : null;
  return (
    <div className="t-acc">
      {e.ll ? <button type="button" className="btn verde chico" onClick={() => accion.llave(e.ll)}>Ver la llave</button> : null}
      {ll ? <BotonCampeon liga={liga} ll={ll} /> : null}
      {!e.ll && L ? <button type="button" className="btn verde chico" onClick={() => accion.llave('v:' + L.id)}>Ver la llave en vivo</button> : null}
      {fut ? <button type="button" className="btn verde chico" onClick={() => accion.ir('ev-campana')}><Ico n="campana" t={16} />Quiero aviso</button> : null}
      {fut ? <a href={gcal({ nombre: e.n, sv: e.sv, cuando: e.t, link: e.link })} target="_blank" rel="noopener noreferrer">+ Calendario</a> : null}
      {dd ? <a href={dd.url} target="_blank" rel="noopener noreferrer">{dd.txt} ↗</a>
        : e.link ? <a href={e.link} target="_blank" rel="noopener noreferrer">Discord ↗</a> : null}
    </div>
  );
}
// el ancho de verdad de una caja (sin su relleno), y cada vez que cambia
function useAncho() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((xs) => { const n = Math.floor(xs[0].contentRect.width); setW((v) => (Math.abs(v - n) > 2 ? n : v)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
// el cuadro de una llave, llenando el ancho que tiene (`lugar` de CuadroMini): el de un evento terminado, el de uno en
// vivo y el de arriba. Con la medida de la pantalla quedaba en la mitad de la tarjeta (Dlx, 02/10/2026: «too much white»)
function CuadroLleno({ liga, ll }) {
  const [ref, w] = useAncho();
  return <div className="evp-cm" ref={ref}><CuadroMini liga={liga} ll={ll} lugar={w || undefined} /></div>;
}
// el evento abierto: el podio y el cuadro. En una tarjeta ancha, el podio en dos columnas (vivo.css, por el ancho de la
// tarjeta); en el teléfono, como siempre
function Abierto({ liga, ll }) {
  return (
    <div className="evp-abierto">
      <ol className="podio2">
        {(ll.tabla || []).slice(0, 4).map((r, i) => {
          const f = r[3] ? liga.T[r[3]] : liga.fila(r[0]);
          return <li key={r[0] + i}><b>{i + 1}</b><span className="evp-pq"><Cara liga={liga} k={f ? f.k : ''} nombre={r[0]} cls="cara evp-pc" />{limpio(r[0])}</span><em>{resultado(r[1], true)} · +{num(r[2])}</em></li>;
        })}
      </ol>
      <CuadroLleno liga={liga} ll={ll} />
    </div>
  );
}
function Evento({ liga, e, est, L, abierto }) {
  const ll = e.ll ? (liga.d.llaves || {})[e.ll] : null;
  const inf = (ll && ll.info) || {};
  const x = e.px || {};
  const dor = liga.esDorado(e.n, e.sv);
  const m = liga.multSv(e.sv);
  const det = [e.sv, formato(e.mod || inf.mod || x.modalidad), x.cupos ? 'cupos ' + String(x.cupos).toLowerCase() : '',
    ll ? ll.participantes + ' raperos' : '', x.org || inf.org ? 'organiza ' + (x.org || inf.org) : ''].filter(Boolean).join(' · ');
  const camp = ll ? liga.campeon(ll) : [];
  const mia = est === 'hecho' ? miFila(liga, ll) : null;
  // ⚠️ por `e.ll` y no por la llave del payload, que trae las 12 más nuevas: 21 de 33 decían «SIN LLAVE» al lado de
  // un «Ver la llave» que andaba (revisión del 03/10/2026)
  const etq = est === 'vivo' ? '● EN VIVO' : est === 'prox' ? 'POR JUGARSE' : est === 'cancelado' ? 'CANCELADO' : ll || e.ll ? 'TERMINÓ' : 'SIN LLAVE';
  return (
    // 🔴 `es-prox` Y NO `prox`: `.prox` es una clase global del Inicio (estilo.css, una grilla de 44px | 1fr | auto) y
    // las tarjetas «por jugarse» salían con el nombre en una columna angosta (encontrado con los anotados, 03/10/2026)
    <article className={'t-ev evp-ev ' + (est === 'prox' ? 'es-prox' : est) + (dor ? ' dorado' : '') + (est === 'vivo' ? ' es-vivo' : '')} style={{ '--c': (liga.svs[e.sv] || {}).color || '#29B298' }}>
      <header>
        <img alt="" src={liga.logo(e.sv)} />
        <div className="evp-nm">
          <Hora t={e.t} />
          <b>{limpio(e.n)}</b>
          <small>{det}</small>
        </div>
        <span className="t-est">{etq}</span>
      </header>
      {dor || m > 1 || x.premios ? (
        <div className="evp-xtra">
          {dor ? <span className="evp-dor">EVENTO DORADO · VALE ×3</span> : m > 1 ? <span className="evp-mult">{e.sv} VA ×{String(m).replace('.', ',')} ESTA SEMANA</span> : null}
          {x.premios ? <span className="evp-premio">Premio: {recorte(x.premios, 90)}</span> : null}
        </div>
      ) : null}
      {mia ? <p className="evp-vos"><em className="rk-vos">VOS</em><b>{resultado(mia[1])}</b><span>· +{num(mia[2])}</span></p> : null}
      {camp.length && !abierto ? <p className="evp-camp">{camp.length > 1 ? 'Campeones' : 'Campeón'}: <b>{camp.join(' y ')}</b></p> : null}
      {abierto && ll ? <Abierto liga={liga} ll={ll} /> : null}
      {est === 'vivo' && L ? <CuadroLleno liga={liga} ll={L} /> : null}
      {est === 'vivo' && !L ? <p className="t-nota evp-tx">La llave aparece acá apenas la carguen, cruce por cruce.</p> : null}
      {est === 'prox' || (est === 'vivo' && !L) ? <Anotados liga={liga} e={e} /> : null}
      <Acciones liga={liga} e={e} L={L} fut={est === 'prox'} ll={est === 'hecho' && camp.length ? ll : null} est={est} />
    </article>
  );
}

// ── el mes: los días con algo, con el color de cada servidor ────────────────────────────────────────────────────────
function Mes({ liga, porDia, dia, onDia, ym, setYm, color }) {
  const [y, m] = ym;
  const ini = new Date(y, m, 1);
  const arranque = (ini.getDay() + 6) % 7;
  const n = new Date(y, m + 1, 0).getDate();
  const hoyK = liga.diaClave(liga.ahora);
  const celdas = [];
  for (let i = 0; i < arranque; i += 1) celdas.push(<span key={'v' + i} className="evp-vacio" />);
  for (let d = 1; d <= n; d += 1) {
    const k = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const evs = porDia[k] || [];
    celdas.push(
      <button type="button" key={k} className={(k === hoyK ? 'hoy ' : '') + (k === dia ? 'sel ' : '') + (evs.length ? 'con' : '') + (evs.length && k < hoyK ? ' pas' : '')}
        onClick={() => onDia(k)} aria-label={d + (evs.length ? ': ' + evs.length + (evs.length === 1 ? ' evento' : ' eventos') : '')} aria-pressed={k === dia}>
        {d}<em>{evs.slice(0, 4).map((e, i) => <i key={i} style={{ background: color(e.sv) }} />)}{evs.length > 4 ? <u>+{evs.length - 4}</u> : null}</em>
      </button>,
    );
  }
  const mover = (k) => { const d = new Date(y, m + k, 1); setYm([d.getFullYear(), d.getMonth()]); };
  return (
    <div className="evp-mes">
      <div className="evp-mes-t">
        <button type="button" className="evp-fl" aria-label="Mes anterior" onClick={() => mover(-1)}><Ico n="flecha" t={16} /></button>
        <b>{MESES[m].charAt(0).toUpperCase() + MESES[m].slice(1)} {y}</b>
        <button type="button" className="evp-fl der" aria-label="Mes siguiente" onClick={() => mover(1)}><Ico n="flecha" t={16} /></button>
      </div>
      <div className="mes-g evp-g"><b>L</b><b>M</b><b>M</b><b>J</b><b>V</b><b>S</b><b>D</b>{celdas}</div>
    </div>
  );
}

// ── los últimos campeones: la carta de verdad del campeón (o su cara) y su llave ──────────────────────────────────
function Campeones({ liga }) {
  const ls = liga.llaves().slice(0, 8);
  if (!ls.length) return null;
  return (
    <div className="rail evp-camps">
      {ls.map((ll) => {
        const g = liga.campeon(ll);
        const r = (ll.tabla || []).find((x) => x[1] === 'Campeón') || (ll.tabla || [])[0] || [];
        const f = r[3] ? liga.T[r[3]] : liga.fila(r[0] || g[0]);
        return (
          <button type="button" key={ll.n} className="evp-cp" onClick={() => accion.llave(ll.n)}>
            {f && (f.c || []).includes('temporada') ? <Carta liga={liga} k={f.k} cual="temporada" cls="evp-cp-ci" abre={false} />
              : <span className="evp-cp-sin"><Cara liga={liga} k={f ? f.k : ''} nombre={g[0] || '?'} cls="cara evp-cp-cara" /></span>}
            <small><img alt="" src={liga.logo(ll.sv)} />{ll.sv} · {liga.cuando(liga.fechaLlave(ll))}</small>
            <b>{g.join(' y ')}</b>
            <span>{limpio(ll.nombre)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── cuándo suele jugar cada servidor (Dlx, 02/10/2026: «me gusta»): de los eventos que ya pasaron, qué días de la
// semana y en qué franja, en la hora de quien mira. Sólo los servidores con 3 o más: con menos, «suele» sería
// inventarlo. Y la franja es la del medio (del 20 % al 80 % de los horarios), así un evento raro no la estira ──────────
const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const SEMANA_S = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const SEMANA_P = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const MADRUGADA = 5 * 60;   // lo de antes de las 5 AM es la noche anterior: 0:30 cuenta como 24:30 para la franja
function dowDe(k) {
  const [y, m, d] = k.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() + 6) % 7;   // 0 = lunes
}
function patrones(liga, cal) {
  const ahora = liga.ahora.getTime();
  const por = {};
  const todos = [];
  cal.forEach((c) => {
    const t = utc(c.t);
    if (!c.sv || c.fut || isNaN(t) || t.getTime() > ahora) return;
    const k = liga.diaClave(t);
    let m = minutosDelDia(t);
    if (m < MADRUGADA) m += 1440;
    const x = { t, k, sv: c.sv, dow: dowDe(k), m };
    (por[c.sv] = por[c.sv] || []).push(x);
    todos.push(x);
  });
  const svs = Object.keys(por).filter((s) => por[s].length >= 3).sort((a, b) => por[b].length - por[a].length).map((s) => {
    const xs = por[s];
    const dias = [0, 0, 0, 0, 0, 0, 0];
    xs.forEach((x) => { dias[x.dow] += 1; });
    const ms = xs.map((x) => x.m).sort((a, b) => a - b);
    const desde = Math.floor(ms[Math.floor(0.2 * (ms.length - 1))] / 60) * 60;
    const hasta = Math.max(desde + 60, Math.ceil(ms[Math.ceil(0.8 * (ms.length - 1))] / 60) * 60);
    return { sv: s, n: xs.length, dias, desde, hasta, ref: xs[0] };
  });
  const primero = todos.reduce((a, x) => (!a || x.t < a ? x.t : a), null);
  return { svs, todos, primero };
}
// una hora del día (en minutos; puede pasar de las 24) dicha como las demás de la página: se corre un instante real
function horaDe(ref, min) { return hora(new Date(ref.t.getTime() + (min - ref.m) * 60000)); }
function diasEnPalabras(dias) {
  const ds = SEMANA_P.filter((_, i) => dias[i]);
  return ds.length === 7 ? 'todos los días' : 'los ' + (ds.length > 1 ? ds.slice(0, -1).join(', ') + ' y ' + ds[ds.length - 1] : ds[0]);
}
function CuandoJuega({ liga, cal, dia, color, et }) {
  const P = useMemo(() => patrones(liga, cal), [liga, cal]);
  if (!P.svs.length) return null;
  const desde = P.primero ? liga.fechaLarga(P.primero) : '';
  const dow = dia ? dowDe(dia) : -1;
  // para un día sin nada (hoy o adelante): lo que hubo los otros días como éste, con su hora
  const antes = dia && dia >= liga.diaClave(liga.ahora) ? P.todos.filter((x) => x.dow === dow && x.k < dia).sort((a, b) => a.m - b.m) : null;
  return (
    <div className="evp-cuando">
      {et ? <span className="evp-et">{et}</span> : null}
      {antes ? (antes.length ? (
        <>
          <p className="evp-tx">Los {SEMANA_P[dow]} anteriores hubo:</p>
          <ul className="evp-antes">{antes.slice(0, 8).map((x, i) => <li key={i}><img alt="" src={liga.logo(x.sv)} />{x.sv}<b>{hora(x.t)}</b></li>)}</ul>
        </>
      ) : <p className="evp-tx">Ningún {SEMANA_S[dow]} tuvo eventos todavía.</p>) : null}
      <ul className="evp-cj">
        <li className="evp-cj-cab" aria-hidden="true"><span />{SEMANA.map((d, i) => <u key={i} className={i === dow ? 'on' : ''}>{d}</u>)}</li>
        {P.svs.map((s) => (
          <li key={s.sv} aria-label={s.sv + ': ' + diasEnPalabras(s.dias) + ', de ' + horaDe(s.ref, s.desde) + ' a ' + horaDe(s.ref, s.hasta)}>
            <span className="evp-cj-sv"><img alt="" src={liga.logo(s.sv)} />{s.sv}</span>
            {s.dias.map((k, i) => (
              <i key={i} className={(k ? 'si' : 'no') + (i === dow ? ' on' : '')} style={k ? { background: color(s.sv), opacity: k >= 3 ? 1 : k === 2 ? 0.72 : 0.42 } : null}
                title={k ? k + (k === 1 ? ' evento un ' + SEMANA_S[i] : ' eventos los ' + SEMANA_P[i]) : 'ningún ' + SEMANA_S[i]} />
            ))}
            <b className="evp-cj-h">{horaDe(s.ref, s.desde)} a {horaDe(s.ref, s.hasta)}</b>
          </li>
        ))}
      </ul>
      <p className="evp-nota">Sobre los {P.todos.length} eventos {desde === 'hoy' || desde === 'ayer' ? 'desde ' + desde : 'desde el ' + desde}, en tu hora.</p>
    </div>
  );
}

// ── cómo se juega: los formatos y quién organiza, de las llaves que viajan en el lobby ───────────────────────────────
function ComoSeJuega({ liga, cal, color }) {
  const ls = liga.llaves();
  const fmt = {};
  const org = {};
  let gente = 0;
  ls.forEach((ll) => {
    const inf = ll.info || {};
    const k = formato(inf.mod);                        // sin formato no hay barra: el «11» dibujaba una sin nombre
    if (k) fmt[k] = (fmt[k] || 0) + 1;
    if (inf.org) { const kk = (liga.d.orgs || {})[inf.org] || 'n:' + inf.org.toLowerCase(); org[kk] = org[kk] || [inf.org, 0]; org[kk][1] += 1; }
    gente += ll.participantes || 0;
  });
  const fs = Object.entries(fmt).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const os = Object.entries(org).sort((a, b) => b[1][1] - a[1][1]).slice(0, 6);
  const hay = patrones(liga, cal).svs.length > 0;
  if (!fs.length && !os.length && !hay) return null;
  const max = fs.length ? fs[0][1] : 1;
  return (
    <div className="evp-como">
      {fs.length ? (
        <div>
          <span className="evp-et">FORMATOS</span>
          {fs.map(([k, n]) => <div key={k} className="evp-bar"><span>{k}</span><i><u style={{ width: Math.round((100 * n) / max) + '%' }} /></i><b>{n}</b></div>)}
        </div>
      ) : null}
      {os.length ? (
        <div>
          <span className="evp-et">QUIÉN ORGANIZA</span>
          <ul className="evp-orgs">
            {os.map(([kk, [n, c]]) => {
              const f = !kk.startsWith('n:') ? liga.T[kk] : null;
              return (
                <li key={kk}>{f ? <a href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cara evp-oc" />{limpio(f.n)}</a> : <span>{n}</span>}<em>{c}</em></li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {hay ? <CuandoJuega liga={liga} cal={cal} color={color} et="CUÁNDO SUELE JUGAR CADA SERVIDOR" /> : null}
      <p className="evp-nota">Sobre las {ls.length} llaves más nuevas{ls.length ? ': ' + Math.round(gente / ls.length) + ' raperos por llave, en promedio' : ''}.</p>
    </div>
  );
}

// ── la tira de los días: ayer, hoy, mañana y los de la semana que tuvieron algo ────────────────────────────────────
function diaMas(k, n) {
  const [y, m, d] = k.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n, 12));
  return x.getUTCFullYear() + '-' + String(x.getUTCMonth() + 1).padStart(2, '0') + '-' + String(x.getUTCDate()).padStart(2, '0');
}
function nombreDia(k, hoyK) {
  if (k === hoyK) return 'Hoy';
  if (k === diaMas(hoyK, -1)) return 'Ayer';
  if (k === diaMas(hoyK, 1)) return 'Mañana';
  const [y, m, d] = k.split('-').map(Number);
  return DIAS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()].slice(0, 3);
}

export function Eventos({ liga, vivoL, dia: diaRuta, avisos }) {
  const vivoS = useMemo(() => liga.vivo(), [liga]);
  const hoyK = liga.diaClave(liga.ahora);
  const [svFil, setSvFil] = useState('');
  const color = (sv) => (liga.svs[sv] || {}).color || '#A5A5A0';
  // el calendario, con lo que trae el anuncio de cada uno que todavía no se jugó (cupos, premio, quién organiza)
  const cal = useMemo(() => {
    const px = {};
    liga.proximos().forEach((p) => { if (p.link) px[p.link] = p; });
    // ⚠️ sin lo que el vigía ya vio cancelado (como el Inicio): se ofrecía para inscribirse (revisión del 03/10/2026)
    const out = (liga.d.calendario || []).filter((c) => !liga.esCancelado(c))
      .map((c) => Object.assign({}, c, { px: (c.link && px[c.link]) || null }));
    // lo anunciado que el calendario todavía no trae (recién anunciado)
    liga.proximos().forEach((p) => {
      if (!liga.esCancelado(p) && !out.some((c) => c.link && c.link === p.link)) out.push({ n: p.nombre, sv: p.sv, t: p.cuando, link: p.link, mod: p.modalidad, fut: 1, px: p });
    });
    return out;
  }, [liga]);
  const filtrado = svFil ? cal.filter((c) => c.sv === svFil) : cal;
  const porDia = useMemo(() => {
    const m = {};
    filtrado.forEach((c) => { const k = liga.diaClave(c.t); if (k) (m[k] = m[k] || []).push(c); });
    return m;
  }, [filtrado, liga]);
  // el día que se abre: el de la dirección; si no, hoy si tiene algo; si no, el último que tuvo
  const conDias = Object.keys(porDia).sort();
  // los días que jugaste: los de las llaves donde estás
  const misDias = useMemo(() => {
    const m = new Set();
    if (!liga.yo) return m;
    cal.forEach((c) => { const ll = c.ll ? (liga.d.llaves || {})[c.ll] : null; if (ll && miFila(liga, ll)) m.add(liga.diaClave(c.t)); });
    return m;
  }, [cal, liga]);
  const porDefecto = porDia[hoyK] ? hoyK : (conDias.filter((k) => k <= hoyK).pop() || hoyK);
  const [dia, setDia] = useState(() => (/^\d{4}-\d\d-\d\d$/.test(diaRuta || '') ? diaRuta : porDefecto));
  useEffect(() => { if (/^\d{4}-\d\d-\d\d$/.test(diaRuta || '')) setDia(diaRuta); }, [diaRuta]);
  const [ym, setYm] = useState(() => { const [y, m] = dia.split('-').map(Number); return [y, m - 1]; });
  const [verMes, setVerMes] = useState(false);
  const tira = useRef(null);
  const grupos = useRef(null);

  // `#/avisos`: la campana, a la vista
  useEffect(() => {
    if (!avisos) return undefined;
    const t = setTimeout(() => accion.ir('ev-campana'), 300);
    return () => clearTimeout(t);
  }, [avisos]);

  const elegir = (k, bajar) => {
    setDia(k);
    const [y, m] = k.split('-').map(Number);
    setYm([y, m - 1]);
    try { history.replaceState(history.state, '', window.urlLG ? window.urlLG('#/eventos/' + k) : '#/eventos/' + k); } catch (e) { /* queda */ }
    if (bajar && grupos.current) grupos.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // el día elegido, a la vista en la tira
  useEffect(() => {
    const t = tira.current;
    const b = t && t.querySelector('button.on');
    if (b && t.scrollWidth > t.clientWidth) t.scrollTo({ left: Math.max(0, b.offsetLeft - (t.clientWidth - b.offsetWidth) / 2), behavior: 'smooth' });
  }, [dia]);

  // ── lo del día elegido, en tres grupos ──
  const ahora = liga.ahora.getTime();
  const esVivo = (c) => vivoS.some((e) => (e.link && e.link === c.link) || (e.sv === c.sv && limpio(e.nombre) === limpio(c.n)));
  const evs = porDia[dia] || [];
  // ⚠️ por la hora y no por el día: uno que empezó a las 23:30 y sigue a las 00:20 salía en «Terminados · SIN LLAVE»
  // de ayer mientras la tarjeta de arriba decía EN VIVO (revisión del 03/10/2026). `esVivo` ya mira lo que el vigía
  // ve en juego ahora
  const vivos = evs.filter((c) => !c.ll && esVivo(c));
  const prox = evs.filter((c) => !vivos.includes(c) && utc(c.t).getTime() > ahora).sort((a, b) => (a.t < b.t ? -1 : 1));
  const hechos = evs.filter((c) => !vivos.includes(c) && !prox.includes(c)).sort((a, b) => (a.t < b.t ? 1 : -1));
  const cancelados = liga.cancelados().filter((c) => c.ini && liga.diaClave(c.ini) === dia && (!svFil || c.sv === svFil));
  const enVivo = (c) => llaveEnVivo({ cuando: c.t, sv: c.sv, nombre: c.n }, vivoL);

  // ── la tira: de 6 días atrás a 2 adelante, y los días de la semana que pasó con algo ──
  const tiraDias = [];
  for (let i = -6; i <= 2; i += 1) tiraDias.push(diaMas(hoyK, i));
  if (!tiraDias.includes(dia)) tiraDias.unshift(dia);

  // ── el momento de arriba: lo que se juega ahora, lo próximo, o el último campeón ──
  const proximo = cal.filter((c) => utc(c.t).getTime() > ahora && !esVivo(c)).sort((a, b) => (a.t < b.t ? -1 : 1))[0];
  const vivoAhora = vivoS[0];
  const ultima = liga.llaves()[0];
  const A = liga.d.actividad || {};
  const jugadosPorSv = {};
  cal.forEach((c) => { if (c.ll) jugadosPorSv[c.sv] = (jugadosPorSv[c.sv] || 0) + 1; });
  const masActivo = Object.keys(jugadosPorSv).sort((a, b) => jugadosPorSv[b] - jugadosPorSv[a])[0];
  const svsCal = [...new Set(cal.map((c) => c.sv).filter(Boolean))].sort((a, b) => (jugadosPorSv[b] || 0) - (jugadosPorSv[a] || 0));
  let momento = null;
  if (vivoAhora) {
    const L = llaveEnVivo(vivoAhora, vivoL);
    // 🔴 SIN EL CUADRO: la llave entera va abajo, en «Hoy». Arriba hacía la tarjeta tres veces más alta que el título —un
    // hueco gigante al lado— y repetía la misma llave dos veces (Dlx, 03/10/2026). Acá, lo que se juega en una línea
    const J = L ? enJuegoDe(L) : null;
    const dv = aDiscord(liga, vivoAhora, true);
    const vs = (x) => x.lados.map((n, i) => {
      const f = liga.fila(n);
      return <span key={i} className="evp-ah-l">{i ? <em>vs</em> : null}<Cara liga={liga} k={f ? f.k : ''} nombre={n} cls="cara evp-ah-c" />{n}</span>;
    });
    momento = (
      <div className="evp-mo vivo">
        <span className="tag">EN VIVO AHORA</span>
        <div className="evp-mo-n"><img alt="" src={liga.logo(vivoAhora.sv)} /><b>{limpio(vivoAhora.nombre)}</b></div>
        <small className="evp-mo-s">{vivoAhora.sv} · empezó {liga.dia(vivoAhora.cuando).replace(/^hoy /, '')}</small>
        {J && J.ahora ? (
          <div className="evp-ah">
            <span className="evp-ah-t">AHORA · {String(J.ahora.r).toUpperCase()}</span>
            <div className="evp-ah-vs">{vs(J.ahora)}</div>
            {J.sigue ? <small className="evp-ah-s">Sigue: {J.sigue.lados.join(' vs ')}</small> : null}
          </div>
        ) : null}
        {J ? (J.total ? <small className="evp-mo-s">{J.jugados} de {J.total} batallas jugadas</small> : null)
          : <p className="hero-p">La llave aparece apenas la carguen. Mientras, se mira en Discord.</p>}
        <div className="hero-acc">
          {L ? <button type="button" className="btn verde" onClick={() => accion.llave('v:' + L.id)}>Ver la llave</button> : null}
          {dv ? <a className={'btn ' + (L ? 'borde' : 'verde')} href={dv.url} target="_blank" rel="noopener noreferrer">{dv.txt} ↗</a> : null}
        </div>
      </div>
    );
  } else if (proximo) {
    const pi = (proximo.px || {}).ins ? aDiscord(liga, { sv: proximo.sv, ins: proximo.px.ins }, false) : null;
    momento = (
      <div className="evp-mo">
        <span className="tag">LO PRÓXIMO · {liga.dia(proximo.t).toUpperCase()}</span>
        <div className="evp-mo-n"><img alt="" src={liga.logo(proximo.sv)} /><b>{limpio(proximo.n)}</b></div>
        <small className="evp-mo-s">{[proximo.sv, formato(proximo.mod || (proximo.px || {}).modalidad)].filter(Boolean).join(' · ')}</small>
        <div className="mo-cuenta"><small>EMPIEZA EN</small><b>{liga.falta(proximo.t)}</b></div>
        <div className="hero-acc">
          {pi ? <a className="btn verde" href={pi.url} target="_blank" rel="noopener noreferrer">{pi.txt} ↗</a> : null}
          <button type="button" className={'btn ' + (pi ? 'borde' : 'verde')} onClick={() => accion.ir('ev-campana')}><Ico n="campana" t={18} />Quiero aviso</button>
          {pi ? null : <a className="btn borde" href={gcal({ nombre: proximo.n, sv: proximo.sv, cuando: proximo.t, link: proximo.link })} target="_blank" rel="noopener noreferrer">+ Calendario</a>}
        </div>
      </div>
    );
  } else if (ultima) {
    const g = liga.campeon(ultima);
    const r = (ultima.tabla || []).find((x) => x[1] === 'Campeón') || [];
    const f = r[3] ? liga.T[r[3]] : liga.fila(r[0] || g[0]);
    // la carta del campeón al lado de su nombre (en el celular, una columna de texto al lado de la carta se cortaba). Los
    // pedazos van sueltos, sin caja que los agrupe: así la grilla los acomoda distinto en el celular —la carta al lado
    // del nombre— y en la compu —la carta a la izquierda de todo, para que la tarjeta no sea más alta que el título—
    momento = (
      <div className={'evp-mo ult' + (f ? '' : ' sin-carta')}>
        <span className="tag">ÚLTIMO CAMPEÓN · {liga.cuando(liga.fechaLlave(ultima)).toUpperCase()}</span>
        {f ? <div className="evp-mo-carta"><Carta liga={liga} k={f.k} cual="temporada" cls="evp-mo-ci" /></div> : null}
        <div className="evp-mo-txt">
          <div className="evp-mo-n"><img alt="" src={liga.logo(ultima.sv)} /><b>{g.join(' y ')}</b></div>
          <small className="evp-mo-s">{limpio(ultima.nombre)} · {ultima.sv} · {ultima.participantes} raperos</small>
        </div>
        <div className="hero-acc">
          <button type="button" className="btn verde" onClick={() => accion.llave(ultima.n)}>Ver la llave</button>
          {g.length ? <BotonCampeon liga={liga} ll={ultima} estilo="borde" ic /> : null}
          <button type="button" className="btn borde" onClick={() => accion.ir('ev-campana')}><Ico n="campana" t={18} />Activar la campana</button>
        </div>
      </div>
    );
  }
  const tituloDe = (k) => (k === hoyK ? 'Hoy' : k === diaMas(hoyK, -1) ? 'Ayer' : k === diaMas(hoyK, 1) ? 'Mañana' : liga.fechaLarga(k + 'T16:00:00Z'));
  const tituloDia = tituloDe(dia);
  const nada = !vivos.length && !prox.length && !hechos.length && !cancelados.length;
  // lo último que hubo, para el día vacío
  const ultimoDia = conDias.filter((k) => k < dia).pop();

  return (
    <>
      <div className="escena evp-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.85 }}>
        <section className="evp-cab">
          <div className="evp-cabtx">
            <span className="tag">EVENTOS · {liga.temp}</span>
            <h1 className="hero-ev largo">Eventos</h1>
            {/* lo de los 15 minutos vivía en la tarjeta del último campeón, y la hacía más alta que el título: en la compu
                quedaba un hueco grande al lado (Dlx, 02/10/2026). Acá vale siempre, haya o no algo anunciado */}
            <p className="hero-p">Lo que se juega en la Liga, día por día, con el color de cada servidor. Cada evento se anuncia unos 15 minutos antes: con la campana te llega al minuto.</p>
            {/* el día del arranque, sin un evento todavía, una fila de ceros dice «no pasa nada»: no se dibuja (la regla de
                «La Liga en números» del Inicio) */}
            {liga.d.eventos || A.ev ? <dl className="evp-num">
              <div><dt>En la temporada</dt><dd>{num(liga.d.eventos || 0)}</dd></div>
              <div><dt>Esta semana</dt><dd>{num(A.ev || 0)}</dd></div>
              <div><dt>Raperos esta semana</dt><dd>{num(A.gente || 0)}</dd></div>
              {masActivo ? <div><dt>El más activo</dt><dd className="evp-sv"><img alt="" src={liga.logo(masActivo)} />{masActivo}</dd></div> : null}
            </dl> : null}
          </div>
          {momento}
        </section>
      </div>
      <nav className="evp-dias" aria-label="Días">
        <div className="evp-dias-in" ref={tira}>
          {tiraDias.map((k) => {
            const n = (porDia[k] || []).length;
            const [, , d] = k.split('-').map(Number);
            return (
              <button type="button" key={k} className={(k === dia ? 'on' : '') + (k === hoyK ? ' hoy' : '') + (n ? '' : ' sin')} aria-pressed={k === dia} onClick={() => elegir(k)}>
                <span>{nombreDia(k, hoyK)}</span><b>{d}</b><i>{n ? n + (n === 1 ? ' evento' : ' eventos') : '—'}</i>
                {misDias.has(k) ? <em className="evp-dyo" title="Jugaste" aria-label="jugaste" /> : null}
              </button>
            );
          })}
        </div>
        {/* el mes, FUERA de la tira y siempre a la vista: al final de la tira quedaba detrás de nueve días y había que
            deslizar hasta el fondo para encontrarlo (Dlx, 03/10/2026: «hacer el acceso al calendario vista por mes más
            sencillo en celular»). Al abrirlo, baja hasta él */}
        <button type="button" className={'evp-mes-b' + (verMes ? ' on' : '')} aria-expanded={verMes}
          onClick={() => { const v = !verMes; setVerMes(v); if (v) setTimeout(() => { if (grupos.current) grupos.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); }}>
          <span>Mes</span><Ico n="eventos" t={18} /></button>
      </nav>
      <div className="evp-t3">
        <main className="evp-centro" ref={grupos}>
          {verMes ? <div className="evp-mes-movil"><Mes liga={liga} porDia={porDia} dia={dia} onDia={(k) => { elegir(k); setVerMes(false); }} ym={ym} setYm={setYm} color={color} /></div> : null}
          {svsCal.length > 1 ? (
            <div className="evp-chips evp-filtro" role="group" aria-label="Filtrar por servidor">
              <button type="button" className={!svFil ? 'on' : ''} aria-pressed={!svFil} onClick={() => setSvFil('')}>Todos</button>
              {svsCal.map((s) => (
                <button type="button" key={s} className={svFil === s ? 'on' : ''} aria-pressed={svFil === s} onClick={() => setSvFil(svFil === s ? '' : s)}>
                  <img alt="" src={liga.logo(s)} />{s}</button>
              ))}
            </div>
          ) : null}
          <h2 className="evp-dia">{tituloDia}<small>{evs.length ? evs.length + (evs.length === 1 ? ' evento' : ' eventos') : ''}</small></h2>
          {vivos.length ? (
            <section className="grupo"><h3 className="g-t vivo">● En vivo</h3>{vivos.map((c) => <Evento key={c.link || c.n} liga={liga} e={c} est="vivo" L={enVivo(c)} />)}</section>
          ) : null}
          {prox.length ? (
            <section className="grupo"><h3 className="g-t">{dia === hoyK ? 'Más tarde' : 'Por jugarse'}</h3>{prox.map((c) => <Evento key={c.link || c.n} liga={liga} e={c} est="prox" />)}</section>
          ) : null}
          {hechos.length ? (
            <section className="grupo"><h3 className="g-t">Terminados</h3>
              {hechos.map((c, i) => <Evento key={c.link || c.n + i} liga={liga} e={c} est="hecho" abierto={i === 0 && !!c.ll} />)}</section>
          ) : null}
          {cancelados.length ? (
            <section className="grupo"><h3 className="g-t">Cancelados</h3>
              {cancelados.map((c) => <Evento key={c.id} liga={liga} e={{ n: c.n, sv: c.sv, t: c.ini }} est="cancelado" />)}</section>
          ) : null}
          {nada ? (
            <div className="evp-nada">
              <p>{dia === hoyK ? 'Hoy todavía no se anunció ningún evento. Los servidores los anuncian unos 15 minutos antes: con la campana te llega al minuto.'
                : dia > hoyK ? 'Para ese día todavía no hay nada anunciado.' : 'Ese día no hubo eventos.'}</p>
              <CuandoJuega liga={liga} cal={filtrado} dia={dia} color={color} et="CUÁNDO SUELE JUGAR CADA SERVIDOR" />
              {ultimoDia ? <button type="button" className="btn borde2 chico" onClick={() => elegir(ultimoDia, true)}>Ver el último día con eventos</button> : null}
            </div>
          ) : null}
          {/* un día sin nada no es un callejón: abajo, lo último que se jugó (era media página en blanco en la compu) */}
          {nada && ultimoDia ? (
            <section className="grupo evp-ultdia"><h3 className="g-t">Lo último que se jugó · {tituloDe(ultimoDia)}</h3>
              {(porDia[ultimoDia] || []).slice().sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 3)
                .map((c, i) => <Evento key={c.link || c.n + i} liga={liga} e={c} est="hecho" abierto={i === 0 && !!c.ll} />)}
            </section>
          ) : null}
        </main>
        <aside className="evp-der">
          <section className="evp-bloque evp-mes-pc"><h2 className="evp-h2">El mes</h2>
            <Mes liga={liga} porDia={porDia} dia={dia} onDia={(k) => elegir(k, false)} ym={ym} setYm={setYm} color={color} />
            <div className="evp-ley">{svsCal.map((s) => <span key={s}><i style={{ background: color(s) }} />{s}</span>)}</div>
          </section>
          <section className="evp-bloque" id="ev-campana"><h2 className="evp-h2"><Ico n="campana" t={20} />La campana</h2><Campana liga={liga} /></section>
          <section className="evp-bloque"><h2 className="evp-h2">En tu calendario</h2><Calendario /></section>
          {/* en la compu, al costado: llena lo que queda abajo de la campana mientras el día sigue (en el teléfono va en
              «Cómo se juega») */}
          <section className="evp-bloque evp-cuando-pc"><h2 className="evp-h2">Cuándo suele jugar</h2><CuandoJuega liga={liga} cal={cal} color={color} /></section>
        </aside>
      </div>
      {liga.llaves().length ? (
        <section className="sec negra evp-campeones" id="ev-campeones">
          <div className="sec-t"><h2>Los últimos campeones</h2><Compartir cls="evp-comp" url={enlace('#/eventos')} texto="Los eventos de la Liga Global" etiqueta="Compartir" /></div>
          <Campeones liga={liga} />
        </section>
      ) : null}
      <section className="sec evp-como-sec"><div className="sec-t"><h2>Cómo se juega</h2><a href="#/guia">La guía <Ico n="flecha" t={16} /></a></div><ComoSeJuega liga={liga} cal={cal} color={color} /></section>
    </>
  );
}
