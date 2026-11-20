// Eventos, rehecho (`#/eventos`). Dlx, 02/10/2026: «AHORA hay que remake la página de eventos». Es el TABLERO que
// aprobó el 29/09 (*«sí, pero con una mezcla del actual, que podamos ver las llaves»*): los días arriba, lo que pasa
// cada día en tres grupos —en vivo, lo que viene y lo que terminó, con su llave—, el mes, la campana y los últimos
// campeones. Para todos desde la 1.93 (Dlx, 02/10/2026: «sí, publícalo»), con sus dos ideas: el campeón como imagen
// para historias y cuándo suele jugar cada servidor. (La de app.js fue el respaldo hasta la tanda 4, 27/10/2026.)
//
// ⚠️ TODO SALE DEL PAYLOAD (`calendario`, `proximos`, `llaves`, `actividad`, `orgs`) y de lo que app.js ya sabe en vivo
// (`VIVO_L`): no hay ninguna llamada nueva. La campana la maneja campana.js (`window.Campana`); acá sólo se dibuja.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { DIAS, MESES, esSinTitulo, hora, limpio, minutosDelDia, norm, num, quienMira, recorte, resultado, siglaDe, utc } from './liga.js';
import { claveOrg, seguirOrg, useOrgs } from './orgs.js';
import { Alguien, Algunos, Anotados, Cara, Carta, Compartir, Ico, aDiscord, accion, enlace, useCampana } from './piezas.jsx';
import { CuadroMini, LlaveCorta, cortaDe, eventoDelBoton, gcal, ganador, lados, llaveEnVivo } from './arriba.jsx';
import { PopCab } from './pop.jsx';
import { H, W, aPng, armarYCompartir, cargarImg, carta, lienzo, pie } from './historia.js';
import CSS_PAGINA from './css/eventos.css?inline';
import { usarCss } from './css.js';
import { useAplausos } from './aplausos.js';

// 🎨 su CSS, con su pedazo (web/src/css/eventos.css)
usarCss('eventos', CSS_PAGINA);

// 🔑 CÓMO TE FUE (Dlx, 02/10/2026, al ver la preview: «sí, hazla como sugeriste»): en cada evento que jugaste, una línea
// «VOS», y un punto en los días que jugaste. Antes había dicho «no sobrecargar»: por eso es una línea y un punto, nada más
// tu fila en una llave: por la clave cuando viene (dos «SOL» se separan así), si no por el nombre
function miFila(liga, ll) {
  const yo = liga.yo;
  if (!yo || !ll) return null;
  return (ll.tabla || []).find((r) => (r[3] ? r[3] === yo.k : ((liga.quien(r[0]) || {}).k === yo.k))) || null;
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
  // 🔴 una ronda no es un formato: DDF escribe «CUARTOS:» u «OCTAVOS:» donde el lector espera la modalidad (14/10/2026)
  const tn = t.normalize('NFKC');
  if (/^(?:filtros?|octavos|cuartos|semis?|semifinal(?:es)?|final(?:es)?)\b/i.test(tn.replace(/[^\p{L}\s]/gu, '').trim())
    || /octavos de final|cuartos de final/i.test(tn)) return '';
  // «1v1», «1 vs 1», «1x1», «1 🆚 1», «⚔️ 1v1» → «1VS1», y lo que sigue se queda: «1v1 sin replica» → «1VS1 sin réplica».
  // ⚠️ «4x4» no: en el rap son entradas de 4 compases («4x4 3E Libre», SNAKE INSIGNIA), no equipos de cuatro
  const x = /^[^\p{L}\p{N}]*(\d+)\s*(vs|v|x|🆚️?)\s*(\d+)\b\s*(.*)$/iu.exec(t);
  if (x && /^x$/i.test(x[2]) && x[1] === '4' && x[3] === '4') return t;
  return x ? (x[1] + 'VS' + x[3] + (x[4] ? ' ' + x[4] : '')).replace(/\breplica\b/i, 'réplica') : t;
}

// ── la campana, con el estado de campana.js (`useCampana()` de piezas.jsx): los mismos pasos de siempre, con el estilo nuevo ──
// 🔔 CUÁNDO MIRÓ EL VIGÍA, CONTRA EL RELOJ DE AHORA (13/10/2026). `liga.cuando()` mide contra `liga.ahora`, que es la
// hora en que llegaron los datos de la página: con una hora del vigía más nueva que eso daba «hoy 22:19» en vez de
// «recién», y con la pestaña abierta un rato, un «hace» que no era. La campana pide el estado cada minuto
// (`refrescarEstado()` en campana.js) y esto se vuelve a dibujar con cada respuesta
function haceVigia(liga, t) {
  const s = (Date.now() - utc(t).getTime()) / 1000;
  if (isNaN(s)) return '';
  if (s < 60) return 'hace menos de un minuto';
  if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
  return liga.cuando(t);
}

// 🔔 un interruptor por servidor (Dlx, 21/10/2026, eligió la opción A de la maqueta: «Grouped Notification Toggles»
// de 21st). Campana.elegir() suma o saca un servidor y «todos» es la lista vacía, así que apagar uno con «todos» prendido
// es elegir los demás, uno por uno (el guardado espera medio segundo y sale una sola vez)
function Interruptor({ on, label, onClick }) {
  return <button type="button" role="switch" aria-checked={!!on} aria-label={label} className={'evp-sw' + (on ? ' on' : '')} onClick={onClick} />;
}
function CampanaServidores({ liga, e, C }) {
  const [nota, setNota] = useState('');
  const prueba = (sv) => sv === e.pruebaSv;
  const prendido = (sv) => (prueba(sv) ? !!e.prueba : e.todos || e.elegidos.includes(sv));
  const tocar = (sv) => {
    setNota('');
    if (prueba(sv) || !prendido(sv)) { C.elegir(sv); return; }
    if (e.todos) { e.svs.forEach((s) => { if (s.sv !== sv && !prueba(s.sv)) C.elegir(s.sv); }); return; }
    // apagar el último sería volver a «todos» (la lista vacía): se dice en vez de hacer lo contrario de lo que se tocó
    if (e.elegidos.length <= 1) { setNota('Deja al menos uno. Para no recibir ninguno, «Desactivar».'); return; }
    C.elegir(sv);
  };
  return (
    <>
      <ul className="evp-cam-l" aria-label="Servidores de los avisos">
        <li className="evp-cam-todos"><span>Todos los servidores</span>
          <Interruptor on={e.todos} label="Avisos de todos los servidores" onClick={() => { if (!e.todos) C.elegir(''); }} /></li>
        {e.svs.map((s) => (
          <li key={s.sv}><img alt="" src={liga.logo(s.sv)} /><span>{s.n || siglaDe(s.sv)}</span>
            <Interruptor on={prendido(s.sv)} label={'Avisos de ' + (s.n || siglaDe(s.sv))} onClick={() => tocar(s.sv)} /></li>
        ))}
      </ul>
      {nota ? <p className="evp-msg" role="status">{nota}</p> : null}
    </>
  );
}

function Campana({ liga }) {
  const e = useCampana();
  const C = window.Campana;
  if (!e || !C) return <p className="pronto-p">La campana no cargó en este navegador. Recarga la página.</p>;
  let cuerpo;
  if (!e.soporta && e.ios && !e.instalada) {
    cuerpo = (
      <>
        <p className="evp-tx">En iPhone y iPad los avisos llegan con la Liga en la pantalla de inicio:</p>
        <ol className="evp-pasos"><li>Toca <b>Compartir</b> (el cuadrado con la flecha).</li><li>Elige <b>Agregar a inicio</b>.</li>
          <li>Abre la Liga <b>desde ese ícono</b> y vuelve acá.</li></ol>
      </>
    );
  } else if (!e.soporta) {
    cuerpo = <p className="evp-tx">Este navegador no puede recibir avisos. En Android andan Chrome, Firefox, Edge y Samsung Internet; en la compu, cualquiera de esos.</p>;
  } else if (e.negado) {
    cuerpo = <p className="evp-tx">Las notificaciones de esta página están <b>bloqueadas</b>. Toca el candado al lado de la dirección → <b>Notificaciones</b> → <b>Permitir</b>, y recarga.</p>;
  } else if (!e.activa) {
    cuerpo = (
      <>
        {e.pedido ? <p className="evp-ok">Vas a activar los avisos de <b>{e.pedido}</b>, como elegiste en Discord.</p> : null}
        <p className="evp-tx">Un aviso por evento, al minuto de que el servidor lo anuncia. Nada más: ni resultados ni publicidad.</p>
        <button type="button" className="btn verde" onClick={() => C.activar()}><Ico n="campana" t={18} />Activar avisos</button>
      </>
    );
  } else {
    cuerpo = (
      <>
        <p className="evp-ok">Este dispositivo recibe los avisos.</p>
        {e.svs.length > 1 ? (
          <>
            <p className="evp-tx">Elige de cuáles servidores.</p>
            <CampanaServidores liga={liga} e={e} C={C} />
          </>
        ) : null}
        <div className="evp-acc">
          <button type="button" className="btn borde2 chico" onClick={() => C.probar()}>Mandar una de prueba</button>
          <button type="button" className="evp-lnk" onClick={() => C.desactivar()}>Desactivar</button>
        </div>
        <div className="evp-yo">
          <p className="evp-tx"><b>Tus avisos</b>: cuando te toca pelear en una llave en vivo, cuando subes de rango o desbloqueas una tarjeta, cuando te felicitan, cuando alguien te sigue y cuando alguien que sigues gana.</p>
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
      {/* 🔔 en pausa desde el Dashboard: si no se dice, la campana parece rota */}
      {e.pausada ? <p className="evp-msg" role="status">⏸ La campana está en pausa por un rato. Los avisos vuelven solos.</p> : null}
      <p className="evp-nota">Desde Discord: escribe <b>/notify</b> en cualquier servidor de la Liga y el bot te trae acá con ese servidor ya elegido.</p>
      {e.vigia ? (
        <p className="evp-vig">{e.vigia.ok ? '● ' : '⚠ '}Revisa los canales de eventos cada minuto · última vez {haceVigia(liga, e.vigia.t)}
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
      {TACTIL ? <p className="evp-nota">Desde el teléfono, Google no deja sumarlo: hazlo una vez en calendar.google.com, en «Otros calendarios» → «Desde URL», con este link. Después aparece solo en el teléfono.</p> : null}
      <code className="evp-ics">{url}</code>
    </div>
  );
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
// 🏷️ el nombre que se lee de un evento del calendario (18/11/2026): «(sin titulo)» es la marca del lector; con su llave,
// el de `liga.nombreLlave()` —así la lista del día y «Los últimos campeones» dicen lo mismo—, y si no, «Sin título».
// Sólo para mostrar: los cruces por nombre siguen con `limpio(c.n)`
function nombreCal(liga, c) {
  if (!esSinTitulo(c.n)) return limpio(c.n);
  const ll = c.ll ? (liga.d.llaves || {})[c.ll] : null;
  return ll ? liga.nombreLlave(ll) : 'Sin título';
}
async function imagenCampeon(liga, ll) {
  const { c, g, letra } = await lienzo();
  const tabla = ll.tabla || [];
  let filas = tabla.filter((r) => r[1] === 'Campeón');
  if (!filas.length && tabla.length) filas = [tabla[0]];
  const varios = filas.length > 1;
  letra(700, 34, true); g.fillStyle = '#A5A5A0';
  g.fillText(('LIGA GLOBAL · ' + liga.temp + ' · ' + (varios ? 'CAMPEONES' : 'CAMPEÓN')).toUpperCase(), 72, 132);
  // el evento, en hasta tres renglones: se achica hasta que entra
  // 🏷️ con el nombre que se lee (18/11/2026): «(sin titulo)» es la marca del lector, y la #651 es «RED BULL INTERNACIONAL»
  const titulo = liga.nombreLlave(ll).toUpperCase();
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
  g.fillText([siglaDe(ll.sv), ll.participantes ? ll.participantes + ' raperos' : '', fechaFija(liga, liga.fechaLlave(ll))].filter(Boolean).join(' · ').toUpperCase(), x, y);
  // la carta (o las dos de una pareja), con lo que queda arriba del escalón, la línea de la final y el logo
  const yc = y + 56;
  const tope = H - 280 - 48 - 70 - 210 - 28;
  const dos = filas.slice(0, 2);
  let ch = 0;
  // de a una: cada carta sin foto recorta su círculo, y dos a la vez se pisaban el recorte
  for (let i = 0; i < dos.length; i += 1) {
    const r = dos[i];
    const f = liga.quien(r[0], r[3]);
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
  // 🪪 con su nombre oficial (17/11/2026): la llave trae el que escribió el organizador
  const quien = filas.map((r) => liga.aka(r[0], r[3])).join(' y ').toUpperCase();
  let pn = 100;
  letra(900, pn, false);
  while (pn > 40 && g.measureText(quien).width > ew - 60) { pn -= 4; letra(900, pn, false); }
  g.fillText(quien, W / 2, ye + 135 + Math.round(pn * 0.36));
  // a quién le ganó la final, cuando eso se puede decir sin dudas: un campeón y un subcampeón
  const sub = tabla.filter((r) => r[1] === 'Subcampeón');
  if (!varios && sub.length === 1) {
    const txt = ('Le ganó la final a ' + liga.aka(sub[0][0], sub[0][3])).toUpperCase();
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
    // 🏷️ el nombre que se lee (18/11/2026): decía «Puppy ganó (sin titulo) en la Liga Global»; sin ninguno, «un evento»
    const nm = liga.nombreLlave(ll);
    armarYCompartir(() => imagenCampeon(liga, ll), 'campeon-' + slug(nm) + '.png',
      g.join(' y ') + (g.length > 1 ? ' ganaron ' : ' ganó ') + (esSinTitulo(nm) ? 'un evento' : nm) + ' en la Liga Global. ' + enlace('#/eventos/' + dia), setEst, 'eventos');
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
      {e.ll ? <button type="button" className="btn verde chico" onClick={() => accion.llave(e.ll)}>Ver la llave entera</button> : null}
      {ll && liga.campeon(ll).length ? <BotonCampeon liga={liga} ll={ll} /> : null}
      {!e.ll && L ? <button type="button" className="btn verde chico" onClick={() => accion.llave('v:' + L.id)}>{L.terminada ? 'Ver la llave' : 'Ver la llave en vivo'}</button> : null}
      {fut ? <button type="button" className="btn verde chico" onClick={() => accion.ir('ev-campana')}><Ico n="campana" t={16} />Quiero aviso</button> : null}
      {/* 🔑 sin una hora que se pueda leer (`sh`, 18/11/2026), sin «+ Calendario»: lo anotaba a la hora de publicación, ya pasada */}
      {fut && !e.sh ? <a href={gcal({ nombre: e.n, sv: e.sv, cuando: e.t, link: e.link })} target="_blank" rel="noopener noreferrer">+ Calendario</a> : null}
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
// ── 🔁 DESPUÉS DE JUGAR, TU PRÓXIMO (Dlx, 13/10/2026, «dale haz todo»: ahí se pierde el 42 % que juega una sola vez).
// Debajo de tu resultado del último evento que jugaste (48 h), el mismo que el botón grande del Inicio
// (`eventoDelBoton()`), y SÓLO si ese día ya no queda nada por jugar: si queda, «Más tarde» ya está arriba con su
// botón, y repetirlo acá sería lo mismo dos veces
// «la llave más nueva» con una sola (18/11/2026): al arrancar una temporada decía «las 1 llaves más nuevas»
const llavesNuevas = (n) => (n === 1 ? 'la llave más nueva' : 'las ' + n + ' llaves más nuevas');
function TuProximo({ liga, s }) {
  const ins = s.anotado ? null : aDiscord(liga, s.e, false);
  return (
    <p className="evp-sig">
      {/* ⏰ un anuncio sin hora que se pueda leer dice cuándo se anunció, y uno atrasado va con su hora nueva (18/11/2026):
          `cuando` de un sin_hora es la hora de publicación, y se leía como la de arranque */}
      <span>{s.anotado ? 'Ya estás anotado en' : 'Tu próximo:'} <b>{limpio(s.e.nombre)}</b> · {s.e.sin_hora ? 'anunciado ' + liga.cuando(s.e.cuando) : liga.dia(liga.cuandoDe(s.e))}</span>
      {ins ? <a className="btn verde chico" href={ins.url} target="_blank" rel="noopener noreferrer">Anotarme</a> : null}
    </p>
  );
}

// 🔑 la hora de un evento del día; el anunciado sin una hora que se pueda leer (`sh`, 18/11/2026) trae la de publicación,
// así que dice «anunciado hace 20 min» y no una hora de inicio que nadie dio
const horaEv = (liga, it) => (it.est === 'prox' && it.c.sh ? 'anunciado ' + liga.cuando(it.c.t) : hora(it.c.t));
// la hora de la columna: «21:30», o «9:30» con el «p. m.» debajo (la hora de 12, de los Ajustes, no entra en una línea)
// `dia`: en las listas que juntan varios días (debajo de la semana y del mes), la fecha arriba de la hora
function HoraCol({ t, dia }) {
  if (isNaN(utc(t))) return <time className="evp-tlh" />;
  const [h, ...r] = hora(t).split(' ');
  return <time className="evp-tlh" dateTime={utc(t).toISOString()}>{dia ? <em>{dia}</em> : null}<b>{h}</b>{r.length ? <small>{r.join(' ')}</small> : null}</time>;
}
// 👥 las caras del campeón, apiladas, y +N si son más (las pandillas). «Avatar Stack» de 21st (Dlx eligió la maqueta A)
function Pila({ liga, filas, n = 2 }) {
  const vis = filas.slice(0, n);
  const mas = filas.length - vis.length;
  return (
    <span className="evp-pila" aria-hidden="true">
      {vis.map((r, i) => { const f = liga.quien(r[0], r[3]); return <Cara key={i} liga={liga} k={f ? f.k : ''} nombre={r[0]} cls="cara evp-pila-c" />; })}
      {mas > 0 ? <em>+{mas}</em> : null}
    </span>
  );
}
// el ancla de cada evento, para bajar hasta él desde la semana
const idEv = (c) => 'ev-' + slug((c.link || '').replace(/\D+/g, '').slice(-12) || (c.sv + '-' + c.n + '-' + c.t));

// ══ 🕒 LA D (Dlx, 16/11/2026, a la maqueta https://claude.ai/artifact/FJUbuWF8i6uYyF9q1Nsiat: «una mezcla entre A y B.
// Realísticamente me gusta más B»). El día POR HORA (la B) o EN LISTA (la A), y el evento elegido abajo con su llave de a
// una ronda. Reemplaza a la tarjeta que se abría adentro de la lista: con la llave entera, un evento medía 800 px ══

// el color de la letra sobre el color de un servidor: el que más contraste da, medido como WCAG. Con el brillo «a ojo»
// de crewpanel.jsx, el celeste de DDF, el naranja de SNK y el verde de FRZ llevaban blanco (2,6 a 3,4:1; medido el 16/11)
function tintaSobre(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  return (L + 0.05) / 0.0512 > 1.05 / (L + 0.05) ? '#030304' : '#FFFFFF';
}
// 👥 un equipo viene como «Majiztral | Mats»: dicho en palabras, sin la raya
const nombreCamp = (g) => g.map((n) => String(n).replace(/\s*[|]\s*/g, ' y ')).join(' y ');
// lo que dice el estado de un evento (lo que antes ponía la tarjeta): con lo que el organizador avisó después
function etiquetaDe(liga, e, est, ll, L) {
  // ⚠️ por `e.ll` y no por la llave del payload, que trae las 12 más nuevas: 21 de 33 decían «SIN LLAVE» al lado de
  // un «Ver la llave» que andaba (revisión del 03/10/2026)
  const st = ll || e.ll ? null : liga.estado({ link: e.link, t: e.t, sv: e.sv, n: e.n });
  // 🔑 por jugarse sin una hora que se pueda leer (`sh`, 18/11/2026): «HORA SIN CONFIRMAR», no «POR JUGARSE» a una hora
  // que es la de publicación
  const txt = st && st.tipo === 'pausado' ? '⏸ EN PAUSA' : st && st.tipo === 'atrasado' && est !== 'hecho' ? '⏰ SE ATRASÓ'
    : est === 'vivo' ? '● EN VIVO' : est === 'prox' ? (e.sh ? 'HORA SIN CONFIRMAR' : 'POR JUGARSE') : est === 'cancelado' ? 'CANCELADO' : ll || e.ll || (L && L.terminada) ? 'TERMINÓ' : 'SIN LLAVE';
  return { st, txt };
}
function detalleDe(liga, e, ll, sinSigla) {
  const inf = (ll && ll.info) || {};
  const x = e.px || {};
  // 🎭 el evento de estilo que marcó Dlx (17/11/2026): jugarlo da nivel en ese estilo. `je` es el nombre (`bot/eventos_estilo.py`)
  return [sinSigla ? '' : siglaDe(e.sv), e.je ? '🎭 evento de ' + e.je : '', formato(e.mod || inf.mod || x.modalidad), x.cupos ? 'cupos ' + String(x.cupos).toLowerCase() : '',
    ll ? ll.participantes + ' raperos' : '',
    // 👥 de a uno y con su nombre de la Liga («HERYIETEERJOUK…» era Benjixo): `Liga.orgsDe()`
    (() => { const os = liga.orgsDe(x.org || x.os ? x : inf); return os.length ? 'organiza ' + os.map((o) => limpio(o.f ? o.f.n : o.n)).join(', ') : ''; })()]
    .filter(Boolean).join(' · ');
}
// la sigla en su color, como en las cartas
function Sigla({ liga, sv }) {
  const c = (liga.svs[sv] || {}).color || '#29B298';
  return <em className="evl-sig" style={{ background: c, color: tintaSobre(c) }}>{siglaDe(sv)}</em>;
}

// 📋 EN LISTA (la A): una fila corta por evento —la hora, el color del servidor, el nombre con su sigla y el campeón en un
// chip—. Tocarla lo abre abajo, en el elegido. `conDia`: en las listas de varios días, la fecha arriba de la hora
function Fila({ liga, it, sel, onSel, conDia }) {
  const e = it.c;
  const ll = e.ll ? (liga.d.llaves || {})[e.ll] : null;
  const camp = ll ? liga.campeon(ll) : [];
  const fc = ll ? (ll.tabla || []).filter((r) => r[1] === 'Campeón') : [];
  const color = (liga.svs[e.sv] || {}).color || '#29B298';
  const { txt } = etiquetaDe(liga, e, it.est, ll, it.L);
  const mia = it.est === 'hecho' ? miFila(liga, ll) : null;
  // 🔑 sin una hora que se pueda leer (`sh`, 18/11/2026): «—» en la columna (no entra «anunciado …») y lo dice al lado
  const sh = it.est === 'prox' && !!e.sh;
  return (
    <li id={idEv(e)}>
      <button type="button" className={'evl-f es-' + it.est + (sel ? ' sel' : '') + (liga.esDorado(e.n, e.sv) ? ' dorado' : '')} style={{ '--c': color }}
        aria-pressed={!!sel} onClick={onSel}>
        {sh ? <span className="evp-tlh" aria-hidden="true"><b>—</b></span> : <HoraCol t={e.t} dia={conDia ? fechaFija(liga, e.t) : ''} />}
        <i className="evl-c" aria-hidden="true" />
        <span className="evl-tx"><b>{mia ? <em className="rk-vos">TÚ</em> : null}{nombreCal(liga, e)}</b>
          <small><Sigla liga={liga} sv={e.sv} />{[sh ? horaEv(liga, it) : '', detalleDe(liga, e, ll, true)].filter(Boolean).join(' · ')}</small></span>
        {camp.length || it.campVivo ? (
          <span className="evl-camp">{fc.length ? <Pila liga={liga} filas={fc} /> : null}<b>{camp.length ? nombreCamp(camp) : it.campVivo}</b></span>
        ) : <span className={'evl-est' + (it.est === 'vivo' ? ' vivo' : '')}>{txt}</span>}
      </button>
    </li>
  );
}

// ⏱️ cuánto dura un evento, estimado: por las rondas de su llave; sin llave, hora y media
const durDe = (liga, c) => {
  const ll = c.ll ? (liga.d.llaves || {})[c.ll] : null;
  const r = ll && ll.rondas ? ll.rondas.length : 0;
  return r ? Math.min(3, Math.max(1, 0.5 + 0.4 * r)) : 1.5;
};
// 🕒 POR HORA (la B): una fila por servidor y una columna por hora, como una guía de TV. Cada evento es un bloque del
// color de su servidor, en su hora y con su largo estimado; lo que ya pasó, apagado; lo en vivo, con borde rojo; el
// campeón, un punto dorado con su inicial. La línea de «ahora», sólo en el día de hoy. En el teléfono se desliza de
// costado con la columna de los servidores fija
function Guia({ liga, items, sel, onSel, esHoy }) {
  const xs = items.filter((it) => !isNaN(utc(it.c.t))).map((it) => ({ it, h: minutosDelDia(it.c.t) / 60, d: durDe(liga, it.c), k: 0 }));
  if (!xs.length) return null;
  const H0 = Math.min(6, Math.floor(Math.min(...xs.map((x) => x.h))));
  const H1 = Math.min(24, Math.max(23, Math.ceil(Math.max(...xs.map((x) => x.h + x.d)))));
  const NH = H1 - H0;
  // un servidor por fila, en el orden de su primer evento; dos eventos que se pisan van en dos carriles
  const filas = [];
  xs.slice().sort((a, b) => a.h - b.h).forEach((x) => {
    let f = filas.find((y) => y.sv === x.it.c.sv);
    if (!f) { f = { sv: x.it.c.sv, fin: [], xs: [] }; filas.push(f); }
    let k = f.fin.findIndex((fin) => fin <= x.h + 0.05);
    if (k < 0) { k = f.fin.length; f.fin.push(0); }
    f.fin[k] = x.h + x.d;
    x.k = k;
    f.xs.push(x);
  });
  // la etiqueta de cada hora, dicha como las demás de la página (24 h o 12 h, en la zona de los Ajustes)
  const ref = xs[0];
  const etH = (h) => hora(new Date(utc(ref.it.c.t).getTime() + (h - ref.h) * 3600000)).replace(/:00(?=\s|$)/, '');
  const ahoraH = minutosDelDia(liga.ahora) / 60;
  const verAhora = esHoy && ahoraH >= H0 && ahoraH <= H1;
  const cada = NH > 18 ? 2 : 1;
  return (
    <div className="evg-w">
      <div className="evg" style={{ '--nh': NH, minWidth: 96 + NH * 46 + 'px' }}>
        <div className="evg-hs" aria-hidden="true"><span className="evg-sv" />{Array.from({ length: NH }, (_, i) => <span key={i}>{i % cada ? '' : etH(H0 + i)}</span>)}</div>
        {filas.map((f) => {
          const c = (liga.svs[f.sv] || {}).color || '#29B298';
          return (
            <div key={f.sv} className="evg-f" style={{ '--c': c, '--t': tintaSobre(c), '--car': f.fin.length }}>
              <span className="evg-sv"><Sigla liga={liga} sv={f.sv} /><small>{f.xs.length}</small></span>
              <div className="evg-p">
                {Array.from({ length: NH }, (_, i) => <i key={i} aria-hidden="true" />)}
                {f.xs.map((y) => {
                  const e = y.it.c;
                  const ll = e.ll ? (liga.d.llaves || {})[e.ll] : null;
                  const g = ll ? liga.campeon(ll) : [];
                  const cp = g.length ? g[0] : y.it.campVivo;
                  const id = y.it.id;
                  const pas = y.it.est === 'hecho' || y.it.est === 'cancelado';
                  return (
                    <button type="button" key={id} className={'evg-b es-' + y.it.est + (pas ? ' pasado' : '') + (sel === id ? ' sel' : '') + (cp ? ' con-cp' : '')}
                      style={{ left: (((y.h - H0) / NH) * 100).toFixed(3) + '%', width: 'calc(' + (((Math.min(y.d, H1 - y.h)) / NH) * 100).toFixed(3) + '% - 3px)', top: 5 + y.k * 50 + 'px' }}
                      aria-pressed={sel === id} aria-label={nombreCal(liga, e) + ', ' + horaEv(liga, y.it) + (g.length ? ', ganó ' + nombreCamp(g) : y.it.est === 'vivo' ? ', en vivo' : '')}
                      title={nombreCal(liga, e) + ' · ' + horaEv(liga, y.it) + (g.length ? ' · ganó ' + nombreCamp(g) : '')} onClick={() => onSel(id)}>
                      {/* 🔑 sin una hora que se pueda leer (`sh`, 18/11/2026), «anunciado …» (`horaEv`): va en la hora de publicación */}
                      <b>{nombreCal(liga, e)}</b><small>{horaEv(liga, y.it)}{y.it.est === 'vivo' ? ' · en vivo' : y.it.est === 'cancelado' ? ' · cancelado' : y.it.est === 'pausa' ? ' · en pausa' : ''}</small>
                      {cp ? <i className="evg-cp" aria-hidden="true">{String(cp).trim().charAt(0).toUpperCase()}</i> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {verAhora ? <span className="evg-ahora" style={{ left: 'calc(96px + (100% - 96px) * ' + ((ahoraH - H0) / NH).toFixed(4) + ')' }}><b>AHORA {hora(liga.ahora)}</b></span> : null}
      </div>
    </div>
  );
}

// 🏆 LA LLAVE, DE A UNA RONDA (la B): los cruces de la ronda elegida, con quién ganó. Arranca en la que se está jugando o,
// terminada, en la final. Entera, en «Ver la llave entera». `vivo`: sólo en una que se juega se busca la ronda en juego
// (en una terminada, un cruce sin ganador —un abandono— la dejaba en Octavos)
function LlaveRondas({ liga, ll, vivo }) {
  const rs = (ll.rondas || []).filter((r) => (r.b || []).length);
  const enJuego = vivo ? rs.findIndex((r) => r.b.some((b) => !ganador(b) && lados(b).length >= 2)) : -1;
  let fin = rs.length - 1;
  while (fin > 0 && /tercer/i.test(rs[fin].r || '')) fin -= 1;
  // `null`: sola, la que se juega (o la final). Con un número fijo, en vivo se quedaba en Octavos cuando ya se jugaban los
  // Cuartos (revisión del 16/11); al tocar una ronda, manda la elegida
  const [elegida, setI] = useState(null);
  const i = elegida == null ? (enJuego >= 0 ? enJuego : fin) : elegida;
  const r = rs[Math.max(0, Math.min(i, rs.length - 1))];
  if (!r) return null;
  return (
    <div className="evs-ll">
      <div className="evs-ll-t"><span>La llave, de a una ronda</span>
        {rs.length > 1 ? (
          <span className="evs-rs" role="group" aria-label="Ronda">
            {rs.map((x, j) => <button type="button" key={j} className={x === r ? 'on' : ''} aria-pressed={x === r} onClick={() => setI(j)}>{x.r || 'Ronda ' + (j + 1)}</button>)}
          </span>
        ) : <b className="evs-r1">{r.r}</b>}
      </div>
      <div className="evs-cr">
        {r.b.map((b, j) => {
          const g = ganador(b);
          const ls = lados(b);
          // 👥 EN UN GRUPO DONDE PASAN VARIOS, TODOS LOS QUE PASAN (18/11/2026): el ganador viene «PRAISERIZA, rodrilp» y los
          // lados sueltos, así que `n === g` no marcaba a nadie (NEW GENESIS, qcyo rapeen 17). Es la 3.12: «también pasa». Un
          // lado de equipo con coma («Eze, PichulaMc») que es el ganador entero se sigue comparando entero
          const gs = g && !ls.includes(g) ? g.split(/\s*,\s*/) : [g];
          const gana = (n) => !!g && gs.includes(n);
          return (
            <div key={j} className="evs-c">
              {/* 🪪 con su cara, su nombre oficial y su perfil (17/11/2026); el nombre que vino sigue diciendo quién ganó */}
              {(ls.length ? ls : ['—']).map((n, k) => <span key={k} className={gana(n) ? 'g' : ''}><b>{n && n !== '—' ? <Alguien liga={liga} nombre={n} /> : '—'}</b>{gana(n) ? <i>ganó</i> : null}</span>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
// 🏅 el orden de los puestos, el mismo de `ORD_P` en llave.jsx (no se exporta: llave.jsx se baja aparte)
const ORD_P = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos', 'Dieciseisavos', 'R32'];
const puestoDe = (x) => { const i = ORD_P.indexOf(x); return i < 0 ? 99 : i; };
// el podio de un evento: del 1 al 4, con su cara
// 🔴 POR PUESTO Y NO POR PUNTOS (18/11/2026): `tabla` viene de más puntos a menos, y con un walk-in o puntos de equipo el
// podio decía «1 MaYeuTyK · SUBCAMPEÓN, 2 Puppy · CAMPEÓN» (#659) o dejaba afuera al subcampeón (#647). A igual puesto,
// los puntos. Con `.slice()`, la tabla de la llave no se toca
function Podio({ liga, ll }) {
  const filas = (ll.tabla || []).slice().sort((a, b) => puestoDe(a[1]) - puestoDe(b[1]) || (Number(b[2]) || 0) - (Number(a[2]) || 0)).slice(0, 4);
  return (
    <ol className="podio2 evs-podio">
      {filas.map((r, i) => {
        const f = liga.quien(r[0], r[3]);
        // 🪪 con su nombre oficial y su perfil (17/11/2026)
        const q = <><Cara liga={liga} k={f ? f.k : ''} nombre={r[0]} cls="cara evp-pc" />{liga.aka(r[0], r[3])}</>;
        return <li key={r[0] + i}><b>{i + 1}</b>{f && f.k ? <a className="evp-pq" href={'#/r/' + encodeURIComponent(f.k)}>{q}</a> : <span className="evp-pq">{q}</span>}<em>{resultado(r[1], true)} · +{num(r[2])}</em></li>;
      })}
    </ol>
  );
}

// 👆 EL ELEGIDO (la B): el evento que se tocó, abajo de la guía o de la lista. Es lo que tenía la tarjeta abierta —el
// estado, el dorado, el multiplicador, lo que avisó el organizador, «TÚ», tu próximo, los anotados y los botones— más el
// campeón con su carta y la llave de a una ronda
// `arriba`: el evento en vivo cuya llave ya está en el escenario de arriba: acá no se repite
// `campVivo`: el campeón de una llave que terminó y el ciclo todavía no procesó (`liga.recienTerminadas()`)
function Elegido({ liga, it, sig, pub, Ap }) {
  const e = it.c;
  const est = it.est;
  const ll = e.ll ? (liga.d.llaves || {})[e.ll] : null;
  const x = e.px || {};
  const dor = liga.esDorado(e.n, e.sv);
  // 📅 el multiplicador de SU semana, no el de hoy (Dlx, 14/10/2026: un evento del 1/10 decía «URB VA ×3 ESTA SEMANA»
  // con el ×3 de esta semana). Jugado: «SUMÓ ×3 · URB ESA SEMANA»; por jugarse esta semana: «URB VA ×3 ESTA SEMANA»;
  // de una semana que todavía no se sorteó, nada
  const me = liga.multEn(e.sv, e.t);
  const m = me && me.x !== 1 ? me.x : 0;
  const multTx = !m ? '' : est === 'hecho' || est === 'vivo'
    ? 'SUMÓ ×' + String(m).replace('.', ',') + ' · ' + siglaDe(e.sv) + (me.esta ? ' ESTA SEMANA' : ' ESA SEMANA')
    : me.esta ? siglaDe(e.sv) + ' VA ×' + String(m).replace('.', ',') + ' ESTA SEMANA' : '';
  const camp = ll ? liga.campeon(ll) : [];
  const r = ll ? ((ll.tabla || []).find((y) => y[1] === 'Campeón') || []) : [];
  const f = r.length ? liga.quien(r[0], r[3]) : null;
  const cual = f ? liga.cartaDe(f.k, { sv: e.sv }) : '';
  const mia = est === 'hecho' ? miFila(liga, ll) : null;
  const { st, txt } = etiquetaDe(liga, e, est, ll, it.L);
  const color = (liga.svs[e.sv] || {}).color || '#29B298';
  const det = detalleDe(liga, e, ll, true);
  // la llave en vivo (o recién terminada, sin procesar): de a una ronda si trae rondas, si no el cuadro
  const Lx = !ll && it.L && !it.arriba ? it.L : null;
  return (
    <article className={'evs es-' + est + (dor ? ' dorado' : '')} style={{ '--c': color }} id="ev-elegido" aria-label={nombreCal(liga, e)}>
      <header className="evs-cab">
        <img alt="" src={liga.logo(e.sv)} />
        <span className="evs-nm"><small><Sigla liga={liga} sv={e.sv} />{fechaFija(liga, e.t)} · {horaEv(liga, it)}</small><b>{nombreCal(liga, e)}</b>{det ? <small>{det}</small> : null}</span>
        <span className="t-est">{txt}</span>
      </header>
      {dor || multTx || x.premios || (e.ct && est !== 'hecho') ? (
        <div className="evp-xtra">
          {dor ? <span className="evp-dor">EVENTO DORADO · {est === 'hecho' ? 'VALIÓ' : 'VALE'} ×3</span> : multTx ? <span className="evp-mult">{multTx}</span> : null}
          {/* ⏰ anunciado con tiempo (Dlx, 12/10/2026, «5. C»): +10 % para quien lo juega (`multiplicadores.ANTICIPO_X`) */}
          {e.ct && est !== 'hecho' ? <span className="evp-mult">ANUNCIADO CON TIEMPO · +10 %</span> : null}
          {/* ✂️ con el corte del ciclo (18/11/2026): `subir_web.py` y el vigía lo cortan en 60; más corto vino entero, y no se
              le come la última palabra corta («a las 9 pm» → «a las 9…») */}
          {x.premios ? <span className="evp-premio">Premio: {recorte(x.premios, 90, 60)}</span> : null}
        </div>
      ) : null}
      {/* ✂️ el vigía corta el aviso en 300 (`anotarEstado()`, 18/11/2026): más corto vino entero. Se mira el crudo, porque sin
          los emojis queda más corto aunque haya venido cortado */}
      {st ? <p className="evp-aviso"><b>{liga.estadoTexto(st, { cuando: e.t, t: e.t, sv: e.sv, n: e.n, link: e.link })}</b>{st.texto ? <span>«{recorte(st.texto.replace(/<a?:\w+:\d+>/g, '').replace(/\s+/g, ' ').trim(), 140, String(st.texto).length < 300 ? 300 : 0)}»</span> : null}</p> : null}
      {/* «TÚ» y tu próximo: lo tuyo (ver `TuProximo`) */}
      {mia ? <p className="evp-vos"><em className="rk-vos">TÚ</em><b>{resultado(mia[1])}</b><span>· +{num(mia[2])}</span></p> : null}
      {mia && sig && sig.e ? <TuProximo liga={liga} s={sig} /> : null}
      {/* 🏆 SIN FILA «CAMPEÓN», NI LA PIEZA DEL CAMPEÓN NI EL PODIO (18/11/2026): «- L VS MOSQUI» dibujaba una carta vacía
          con «?» y un podio «1 Calíz · 2 LAST» de dos que perdieron en Cuartos, lo que `liga.campeon()` dejó de inventar el
          16/11. La llave de a una ronda se queda, a lo ancho (`sin-camp`) */}
      {ll ? (
        <div className={'evs-cuerpo' + (camp.length ? '' : ' sin-camp')}>
          {camp.length ? (
            <div className="evs-camp">
              {f && cual ? <Carta liga={liga} k={f.k} cual={cual} cls="evs-ci" />
                : <span className="evs-sin"><Cara liga={liga} k={f ? f.k : ''} nombre={camp[0] || '?'} cls="cara evs-cara" /></span>}
              <span className="evs-tag">{camp.length > 1 ? 'Campeones' : 'Campeón'}</span><b><Algunos liga={liga} nombres={camp} cara={false} /></b>
            </div>
          ) : null}
          <div className="evs-der">
            <LlaveRondas key={e.ll} liga={liga} ll={ll} />
            {camp.length ? <Podio liga={liga} ll={ll} /> : null}
          </div>
        </div>
      ) : null}
      {!ll && it.campVivo ? <p className="evp-camp">Campeón: <b>{(it.campN || []).length ? <Algunos liga={liga} nombres={it.campN} /> : it.campVivo}</b></p> : null}
      {Lx ? (Array.isArray(Lx.rondas) && Lx.rondas.length ? <LlaveRondas key={Lx.id || 'v'} liga={liga} ll={Lx} vivo={!Lx.terminada} /> : <CuadroLleno liga={liga} ll={Lx} />) : null}
      {est === 'vivo' && it.arriba ? <p className="t-nota evp-tx">La llave en vivo está arriba, en el escenario.</p> : null}
      {est === 'vivo' && !it.L ? <p className="t-nota evp-tx">La llave aparece acá apenas la carguen, cruce por cruce.</p> : null}
      {est === 'prox' || (est === 'vivo' && !it.L) ? <Anotados liga={liga} e={e} /> : null}
      <div className="evs-acc">
        <Acciones liga={liga} e={e} L={it.L} fut={est === 'prox'} ll={est === 'hecho' && camp.length ? ll : null} est={est} />
        {pub ? <Aplauso liga={liga} it={pub} A={Ap} /> : null}
      </div>
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
// 👏 Felicitar al campeón desde acá (Dlx, 15/11/2026, de la maqueta B de Publicaciones: «Campeones → Eventos»). Cada
// llave se cruza con su publicación del muro por el número (`ll` en bot/muro.py), que es lo que se felicita: sin
// publicación (una llave más vieja que el muro), no hay botón
function Aplauso({ liga, it, A }) {
  const id = it.id;
  const n = Number(A.cu[id] || 0);
  const mio = !!A.mios[id];
  const tuyo = liga.yo && (it.ks || []).includes(liga.yo.k);
  return (
    <div className="evp-cp-soc">
      {tuyo ? (n ? <span className="evp-fel tuyo" title="Te felicitaron">👏 {num(n)}</span> : null) : (
        <button type="button" className={'evp-fel' + (mio ? ' on' : '')} aria-pressed={mio} disabled={mio || !!A.va[id]}
          onClick={() => { if (window.felicitar) window.felicitar(id); }} aria-label={(mio ? 'Felicitaste' : 'Felicitar') + (n ? ' · ' + n : '')}>
          <span aria-hidden="true">👏</span>{n ? num(n) : (mio ? '' : 'Felicitar')}
        </button>
      )}
      <a className="evp-cm" href={'#/publicaciones/' + encodeURIComponent(id)} aria-label="Comentar">💬</a>
    </div>
  );
}
function Campeones({ liga }) {
  const A = useAplausos();
  // 🧱 en grilla fija (la D, 16/11/2026): en una tira de 140 px se pisaban, y los que no tienen carta eran un recuadro
  // punteado vacío. Seis a la vista y el resto con «Ver los 12»
  const [todos, setTodos] = useState(false);
  const lsT = liga.llavesPorFecha().filter((x) => liga.campeon(x).length).slice(0, 12);
  const ls = todos ? lsT : lsT.slice(0, 6);
  const pubs = useMemo(() => {
    const m = {};
    (liga.muro || []).forEach((it) => { if (it.tipo === 'campeon' && it.id && it.ll != null && !m[String(it.ll)]) m[String(it.ll)] = it; });
    return m;
  }, [liga]);
  if (!ls.length) return null;
  return (
    <>
    <div className="evp-camps2">
      {ls.map((ll) => {
        const g = liga.campeon(ll);
        const r = (ll.tabla || []).find((x) => x[1] === 'Campeón') || (ll.tabla || [])[0] || [];
        const f = liga.quien(r[0] || g[0], r[3]);
        const pub = pubs[String(ll.n)];
        return (
          <div key={ll.n} className="evp-cp-w">
            <button type="button" className="evp-cp" onClick={() => accion.llave(ll.n)}>
              {f && liga.cartaDe(f.k, { sv: ll.sv }) ? <Carta liga={liga} k={f.k} cual={liga.cartaDe(f.k, { sv: ll.sv })} cls="evp-cp-ci" abre={false} />
                : <span className="evp-cp-sin"><Cara liga={liga} k={f ? f.k : ''} nombre={g[0] || '?'} cls="cara evp-cp-cara" /></span>}
              <small><img alt="" src={liga.logo(ll.sv)} />{siglaDe(ll.sv)} · {liga.cuando(liga.fechaLlave(ll))}</small>
              <b>{g.join(' y ')}</b>
              {/* 🏷️ el nombre que se lee, el mismo que el del calendario (18/11/2026) */}
              <span>{liga.nombreLlave(ll)}</span>
            </button>
            {pub ? <Aplauso liga={liga} it={pub} A={A} /> : null}
          </div>
        );
      })}
    </div>
    {lsT.length > 6 && !todos ? <button type="button" className="btn borde chico evp-camps-mas" onClick={() => setTodos(true)}>Ver los {lsT.length}</button> : null}
    </>
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
// 📊 los eventos de la temporada por día de la semana, apilados con el color de cada servidor («Activity Heatmap» de 21st
// pasado a barras; Dlx eligió la maqueta A el 21/10/2026). Arriba de la lista de cada servidor, que se queda
function Barras({ P, color }) {
  const por = SEMANA.map(() => ({}));
  P.todos.forEach((x) => { por[x.dow][x.sv] = (por[x.dow][x.sv] || 0) + 1; });
  const tot = por.map((c) => Object.values(c).reduce((s, v) => s + v, 0));
  const tope = Math.max(...tot);
  if (!tope) return null;
  const top = [0, 1, 2, 3, 4, 5, 6].filter((i) => tot[i]).sort((a, b) => tot[b] - tot[a]).slice(0, 2);
  return (
    <>
      <p className="evp-tx">{top.length > 1 ? <>Los <b>{SEMANA_P[top[0]]}</b> y los <b>{SEMANA_P[top[1]]}</b> son los días con más eventos.</>
        : <>Los <b>{SEMANA_P[top[0]]}</b> son los días con más eventos.</>}</p>
      <div className="evp-cjb" role="img" aria-label={SEMANA_P.map((d, i) => d + ': ' + tot[i]).join(', ')}>
        {SEMANA.map((d, i) => (
          <div key={i} className="evp-cjb-d">
            <span className="evp-cjb-col">
              {Object.entries(por[i]).sort((a, b) => b[1] - a[1]).map(([sv, v]) => (
                <i key={sv} title={siglaDe(sv) + ': ' + v} style={{ height: ((100 * v) / tope).toFixed(1) + '%', background: color(sv) }} />
              ))}
            </span>
            <b>{tot[i] || ''}</b><small>{d}</small>
          </div>
        ))}
      </div>
    </>
  );
}
function CuandoJuega({ liga, cal, dia, color, et }) {
  const P = useMemo(() => patrones(liga, cal), [liga, cal]);
  // 📅 y quiénes organizan en cada uno (Dlx, 12/10/2026, «5. A»: «cuándo cada sv organiza usualmente y quiénes»), del
  // «Organiza:» de sus anuncios o de quien los publica (`subir_web._agenda()`)
  const ag = liga.d.agenda || {};
  // 📣 y seguirlos: con la cuenta, un ☆ al lado de cada uno (Dlx, 12/10/2026, «5. E»). Ver `orgs.js`
  const dc = quienMira().dc;
  const orgs = useOrgs(dc);
  const sigo = new Set((orgs || []).map((o) => o.org));
  const [nota, setNota] = useState('');
  const alternar = async (n) => {
    const si = !sigo.has(claveOrg(n));
    const e = await seguirOrg(n, si);
    setNota(e === 'sin_sesion' ? 'Entra con Discord para seguir organizadores.' : e === 'muchos' ? 'Ya sigues a 30.'
      : e ? 'No se pudo.' : si ? 'Te avisamos cuando ' + limpio(n) + ' anuncie un evento (en la campana).' : '');
  };
  if (!P.svs.length) return null;
  const desde = P.primero ? liga.fechaLarga(P.primero) : '';
  const dow = dia ? dowDe(dia) : -1;
  // para un día sin nada (hoy o adelante): lo que hubo los otros días como éste, con su hora
  const antes = dia && dia >= liga.diaClave(liga.ahora) ? P.todos.filter((x) => x.dow === dow && x.k < dia).sort((a, b) => a.m - b.m) : null;
  return (
    <div className="evp-cuando">
      {et ? <span className="evp-et">{et}</span> : null}
      {antes ? null : <Barras P={P} color={color} />}
      {antes ? (antes.length ? (
        <>
          <p className="evp-tx">Los {SEMANA_P[dow]} anteriores hubo:</p>
          <ul className="evp-antes">{antes.slice(0, 8).map((x, i) => <li key={i}><img alt="" src={liga.logo(x.sv)} />{siglaDe(x.sv)}<b>{hora(x.t)}</b></li>)}</ul>
        </>
      ) : <p className="evp-tx">Ningún {SEMANA_S[dow]} tuvo eventos todavía.</p>) : null}
      <ul className="evp-cj">
        <li className="evp-cj-cab" aria-hidden="true"><span />{SEMANA.map((d, i) => <u key={i} className={i === dow ? 'on' : ''}>{d}</u>)}</li>
        {P.svs.map((s) => (
          <li key={s.sv} aria-label={siglaDe(s.sv) + ': ' + diasEnPalabras(s.dias) + ', de ' + horaDe(s.ref, s.desde) + ' a ' + horaDe(s.ref, s.hasta)}>
            <span className="evp-cj-sv"><img alt="" src={liga.logo(s.sv)} />{siglaDe(s.sv)}</span>
            {s.dias.map((k, i) => (
              <i key={i} className={(k ? 'si' : 'no') + (i === dow ? ' on' : '')} style={k ? { background: color(s.sv), opacity: k >= 3 ? 1 : k === 2 ? 0.72 : 0.42 } : null}
                title={k ? k + (k === 1 ? ' evento un ' + SEMANA_S[i] : ' eventos los ' + SEMANA_P[i]) : 'ningún ' + SEMANA_S[i]} />
            ))}
            <b className="evp-cj-h">{horaDe(s.ref, s.desde)} a {horaDe(s.ref, s.hasta)}</b>
            {(ag[s.sv] || []).length ? (
              <small className="evp-cj-org">organiza{ag[s.sv].length > 1 ? 'n' : ''}{' '}
                {ag[s.sv].map(([o], j) => {
                  // 👥 con su cara y su perfil (Dlx, 14/10/2026: «que los organizadores tengan su foto y perfil»); el ☆
                  // para seguirlo va al lado, ya no es el nombre entero. ✍️ «Avísame», con tú (18/11/2026): decía «Avisame»
                  const { f } = liga.orgsDe({ org: o })[0] || {};
                  return (
                    <span key={o} className="evp-cj-o">{j ? ' · ' : ''}
                      {f ? <a href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cara evp-oc" />{limpio(f.n)}</a>
                        : <span><Cara liga={liga} nombre={o} cls="cara evp-oc" />{limpio(o)}</span>}
                      {dc ? (
                        <button type="button" className={'evp-org' + (sigo.has(claveOrg(o)) ? ' si' : '')} onClick={() => alternar(o)}
                          aria-label={(sigo.has(claveOrg(o)) ? 'Dejar de seguir a ' : 'Avísame cuando organice ') + limpio(o)}
                          title={sigo.has(claveOrg(o)) ? 'Dejar de seguir' : 'Avísame cuando organice'}>{sigo.has(claveOrg(o)) ? '★' : '☆'}</button>
                      ) : null}
                    </span>
                  );
                })}
              </small>
            ) : null}
          </li>
        ))}
      </ul>
      {nota ? <p className="evp-nota" role="status">{nota}</p> : null}
      <p className="evp-nota">Sobre los {P.todos.length} eventos {desde === 'hoy' || desde === 'ayer' ? 'desde ' + desde : 'desde el ' + desde}, en tu hora.{dc ? ' Toca un organizador para que te avisemos cuando anuncie.' : ''}</p>
    </div>
  );
}

// ── cómo se juega: los formatos y quién organiza, de las llaves que viajan en el lobby ───────────────────────────────
function comoDatos(liga) {
  const ls = liga.llaves();
  const fmt = {};
  const org = {};
  let gente = 0;
  ls.forEach((ll) => {
    const inf = ll.info || {};
    const k = formato(inf.mod);                        // sin formato no hay barra: el «11» dibujaba una sin nombre
    // ✅ «1VS1» y «1VS1 sin réplica», una sola barra (Dlx, 03/10/2026: «5. A»): acá cuenta el formato, no el detalle
    const kb = (/^\d+VS\d+\b/.exec(k) || [k])[0];
    if (kb) fmt[kb] = (fmt[kb] || 0) + 1;
    // 👥 de a uno y por su perfil (14/10/2026): «FLENNZS + LEWITO + AX» suma uno a cada uno, y «FLENNZS LEWITO» con
    // «FLENNZS LEWITO AX» ya no son dos organizadores distintos
    liga.orgsDe(inf).forEach(({ n, f }) => { const kk = f ? f.k : 'n:' + n.toLowerCase(); org[kk] = org[kk] || [n, 0]; org[kk][1] += 1; });
    gente += ll.participantes || 0;
  });
  // 📋 los formatos de TODA la temporada, con un nombre por formato (Dlx, 14/10/2026: «sé que han habido otros eventos,
  // por ejemplo nave de funa, 5 vidas…»): `subir_web.formato_evento()`. Sin ese dato, como antes: las llaves de acá
  const fsT = (liga.d.formatos || []).filter((x) => x && x[0] && x[1]);
  const fs = fsT.length ? fsT.slice(0, 9) : Object.entries(fmt).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totF = fsT.reduce((s, x) => s + x[1], 0);
  const os = Object.entries(org).sort((a, b) => b[1][1] - a[1][1]);
  return { ls, fs, totF, os, gente };
}
// `parte`: «formatos» (con cuándo suele jugar cada servidor, en el teléfono) u «orgs». Cada una va en su ventana
function ComoSeJuega({ liga, cal, color, parte }) {
  const { ls, fs, totF, os: osT, gente } = comoDatos(liga);
  const os = osT.slice(0, 12);
  const hay = patrones(liga, cal).svs.length > 0;
  const max = fs.length ? fs[0][1] : 1;
  if (parte === 'orgs') {
    return os.length ? (
      <div className="evp-como">
        <ul className="evp-orgs">
          {os.map(([kk, [n, c]]) => {
            const f = !kk.startsWith('n:') ? liga.T[kk] : null;
            return (
              <li key={kk}>{f ? <a href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cara evp-oc" />{limpio(f.n)}</a> : <span><Cara liga={liga} nombre={n} cls="cara evp-oc" />{limpio(n)}</span>}<em>{c}</em></li>
            );
          })}
        </ul>
        {/* con una sola, «la llave más nueva»; si no, los mismos pedazos de antes (los busca el inglés de /en) */}
        <p className="evp-nota">{ls.length === 1 ? 'Sobre la llave más nueva' : <>Sobre las {ls.length} llaves más nuevas</>}{ls.length ? ', con ' + Math.round(gente / ls.length) + ' raperos por llave en promedio' : ''}. El número es en cuántas organizó.</p>
      </div>
    ) : null;
  }
  return (
    <div className="evp-como">
      {fs.length ? (
        <div>
          <span className="evp-et">FORMATOS</span>
          {fs.map(([k, n]) => <div key={k} className="evp-bar"><span>{k}</span><i><u style={{ width: Math.round((100 * n) / max) + '%' }} /></i><b>{n}</b></div>)}
        </div>
      ) : null}
      {hay ? <CuandoJuega liga={liga} cal={cal} color={color} et="CUÁNDO SUELE JUGAR CADA SERVIDOR" /> : null}
      {/* 🔢 con uno solo (el arranque de una temporada, 18/11/2026) decía «Sobre los 1 eventos» */}
      <p className="evp-nota">{totF ? (totF === 1 ? 'Sobre el único evento de la temporada.' : 'Sobre los ' + totF + ' eventos de la temporada.') : 'Sobre ' + llavesNuevas(ls.length) + '.'}</p>
    </div>
  );
}


// 🪟 una ventana como las del panel del Inicio (`pn-pop` + `PopCab`): «Cómo se juega» y «Quién organiza» eran media
// página abajo de todo (la D, 16/11/2026). No se sacó nada: está todo adentro
function Ventana({ dref, ico, t, sub, children }) {
  const cerrar = () => { if (dref.current) dref.current.close(); };
  return (
    <dialog className="pn-pop evp-pop" ref={dref} aria-label={t} onClick={(ev) => { if (ev.target === dref.current) cerrar(); }}>
      <PopCab ico={ico} t={t} sub={sub} cerrar={cerrar} />
      <div className="evp-pop-in">{children}</div>
    </dialog>
  );
}
// los dos cuadros que abren esas ventanas, con un adelanto de lo que hay adentro
function ComoTiles({ liga, cal, color }) {
  const fmt = useRef(null);
  const org = useRef(null);
  const D = comoDatos(liga);
  const hay = patrones(liga, cal).svs.length > 0;
  if (!D.fs.length && !D.os.length && !hay) return null;
  const nombres = (xs) => (xs.length > 3 ? xs.slice(0, 3).join(', ') + ' y ' + (xs.length - 3) + ' más' : xs.join(', '));
  const osN = D.os.map(([kk, [n]]) => { const f = !kk.startsWith('n:') ? liga.T[kk] : null; return limpio(f ? f.n : n); });
  const abrir = (r) => { if (r.current && r.current.showModal) r.current.showModal(); };
  return (
    <div className="evp-tiles">
      {D.fs.length || hay ? (
        <button type="button" style={{ '--c': '#29B298' }} aria-haspopup="dialog" onClick={() => abrir(fmt)}>
          <i>Cómo se juega</i><b>{D.fs.length ? nombres(D.fs.map(([k]) => k)) : 'Cuándo suele jugar cada servidor'}</b><small>Los formatos de la temporada, en una ventana</small>
        </button>
      ) : null}
      {D.os.length ? (
        <button type="button" style={{ '--c': '#F0559A' }} aria-haspopup="dialog" onClick={() => abrir(org)}>
          <i>Quién organiza</i><b>{nombres(osN)}</b><small>Con su perfil, en una ventana</small>
        </button>
      ) : null}
      <Ventana dref={fmt} ico="competencias" t="Cómo se juega" sub="Los formatos de la temporada"><ComoSeJuega liga={liga} cal={cal} color={color} parte="formatos" /></Ventana>
      <Ventana dref={org} ico="micro" t="Quién organiza" sub={'En ' + llavesNuevas(D.ls.length)}><ComoSeJuega liga={liga} cal={cal} color={color} parte="orgs" /></Ventana>
    </div>
  );
}

// 🔥 CUÁNDO SE JUEGA (la B): los eventos de la temporada por día de la semana y por hora, en tu hora. Lo de antes de las
// 5 AM cuenta como la noche anterior (`MADRUGADA`), igual que en «Cuándo suele jugar»
function Calor({ liga, cal }) {
  const P = useMemo(() => patrones(liga, cal), [liga, cal]);
  if (P.todos.length < 5) return null;
  const hs = P.todos.map((x) => Math.floor(x.m / 60));
  const h0 = Math.min(...hs);
  const h1 = Math.max(...hs);
  const cols = [];
  for (let h = h0; h <= h1; h += 1) cols.push(h);
  const M = SEMANA.map(() => cols.map(() => 0));
  P.todos.forEach((x) => { M[x.dow][Math.floor(x.m / 60) - h0] += 1; });
  const tope = Math.max(...M.flat());
  const ref = P.todos[0];
  const etH = (h) => horaDe(ref, h * 60).replace(/:00(?=\s|$)/, '');
  let mx = [0, 0];
  M.forEach((row, d) => row.forEach((v, j) => { if (v > M[mx[0]][mx[1]]) mx = [d, j]; }));
  const cada = cols.length > 12 ? 3 : 2;
  return (
    <div className="evp-calor">
      <p className="evp-tx">El momento con más eventos: los <b>{SEMANA_P[mx[0]]}</b> a las <b>{etH(cols[mx[1]])}</b>.</p>
      <div className="evp-calg" style={{ '--n': cols.length }} role="img"
        aria-label={'Eventos por día y hora. El momento con más: los ' + SEMANA_P[mx[0]] + ' a las ' + etH(cols[mx[1]])}>
        <span />{cols.map((h, j) => <small key={h}>{j % cada ? '' : etH(h)}</small>)}
        {M.map((row, d) => (
          <Fragment key={d}>
            <small>{SEMANA[d]}</small>
            {row.map((v, j) => <i key={j} className={v ? '' : 'no'} style={v ? { opacity: (0.2 + (0.8 * v) / tope).toFixed(2) } : null}
              title={v ? v + (v === 1 ? ' evento' : ' eventos') + ' · ' + SEMANA_P[d] + ' a las ' + etH(cols[j]) : ''} />)}
          </Fragment>
        ))}
      </div>
      <p className="evp-nota">Sobre los {P.todos.length} eventos de la temporada, en tu hora.</p>
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

// 🗓️ LA SEMANA (Dlx, 21/10/2026: «que se pueda alternar el calendario por semana, por mes y por día»): de lunes a
// domingo, la semana del día elegido. En la compu, siete columnas como una guía de TV; en el teléfono, los días uno
// abajo del otro con una fila corta por evento. Tocar un evento abre el día con ese evento abierto
function Semana({ liga, porDia, dia, hoyK, color, estado, onDia, onEvento, mover }) {
  const lunes = diaMas(dia, -dowDe(dia));
  const ks = [0, 1, 2, 3, 4, 5, 6].map((i) => diaMas(lunes, i));
  const fecha = (k) => { const [, m, d] = k.split('-').map(Number); return [d, MESES[m - 1]]; };
  const [d1, m1] = fecha(ks[0]);
  const [d7, m7] = fecha(ks[6]);
  const rango = m1 === m7 ? d1 + ' – ' + d7 + ' de ' + m7 : d1 + ' de ' + m1 + ' – ' + d7 + ' de ' + m7;
  return (
    <div className="evp-sem">
      <div className="evp-sem-top">
        <button type="button" className="evp-fl" aria-label="Semana anterior" onClick={() => mover(-7)}><Ico n="flecha" t={16} /></button>
        <b>{rango}</b>
        <button type="button" className="evp-fl der" aria-label="Semana siguiente" onClick={() => mover(7)}><Ico n="flecha" t={16} /></button>
      </div>
      <div className="evp-sem-g">
        {ks.map((k) => {
          const evs = (porDia[k] || []).slice().sort((a, b) => (a.t < b.t ? -1 : 1));
          return (
            <section key={k} className={'evp-sem-c' + (k === hoyK ? ' hoy' : '') + (k === dia ? ' sel' : '') + (evs.length ? '' : ' vacia')}>
              <button type="button" className="evp-sem-h" onClick={() => onDia(k)} aria-label={'Ver el ' + tituloLargo(liga, k, hoyK)}>
                <small>{nombreDia(k, hoyK)}</small><b>{fecha(k)[0]}</b><em>{evs.length ? evs.length + (evs.length === 1 ? ' evento' : ' eventos') : '—'}</em>
              </button>
              {evs.length ? (
                <ul>
                  {evs.map((c, i) => {
                    const ll = c.ll ? (liga.d.llaves || {})[c.ll] : null;
                    const fc = ll ? (ll.tabla || []).filter((r) => r[1] === 'Campeón') : [];
                    const s = estado(c);
                    return (
                      <li key={c.link || c.n + i}>
                        <button type="button" className={'evp-sem-e se-' + s.cls} style={{ '--c': color(c.sv) }} onClick={() => onEvento(k, c)}>
                          <time>{hora(c.t)}</time>
                          <img alt="" src={liga.logo(c.sv)} />
                          <b>{nombreCal(liga, c)}</b>
                          {fc.length ? <Pila liga={liga} filas={fc} /> : <small>{s.txt}</small>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="evp-sem-nada">{k >= hoyK ? 'Nada anunciado todavía' : 'Sin eventos'}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
function tituloLargo(liga, k, hoyK) {
  return k === hoyK ? 'día de hoy' : liga.fechaLarga(k + 'T16:00:00Z');
}

export function Eventos({ liga, vivoL, dia: diaRuta, avisos }) {
  // 🔔 con la campana ya prendida en este dispositivo, el día vacío no la pide (19/10/2026, como el Inicio)
  const camp = useCampana();
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
    // lo anunciado que el calendario todavía no trae (recién anunciado). 🔑 Con su `sh` si viene sin una hora que se pueda
    // leer (`sin_hora`, 18/11/2026): su `cuando` es el de publicación (ver `sinHora` más abajo)
    liga.proximos().forEach((p) => {
      if (!liga.esCancelado(p) && !out.some((c) => c.link && c.link === p.link)) out.push({ n: p.nombre, sv: p.sv, t: p.cuando, link: p.link, mod: p.modalidad, fut: 1, px: p, sh: p.sin_hora ? 1 : 0 });
    });
    return out;
  }, [liga]);
  // 📊 lo que saben «Cuándo suele jugar» y «Cuándo se juega», para no dibujar su título solo al arrancar una temporada
  // (18/11/2026: el calendario es de la temporada y arranca vacío). Ver las dos secciones al final
  const Pc = useMemo(() => patrones(liga, cal), [liga, cal]);
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
  // 🗓️ Día · Semana · Mes (Dlx, 21/10/2026). Se recuerda en este navegador: es una comodidad, no un dato
  const [vista, setVistaS] = useState(() => { try { const v = localStorage.getItem('lg:ev-vista'); return ['dia', 'semana', 'mes'].includes(v) ? v : 'dia'; } catch (e) { return 'dia'; } });
  const setVista = (v) => { setVistaS(v); try { localStorage.setItem('lg:ev-vista', v); } catch (e) { /* sin guardar */ } };
  // el evento que se tocó en la semana: se abre y se baja hasta él
  const [foco, setFoco] = useState('');
  // 🕒 el día por hora o en lista (la D, 16/11/2026): por hora en la compu y en lista en el teléfono, y se recuerda
  const [forma, setFormaS] = useState(() => {
    try { const v = localStorage.getItem('lg:ev-forma'); if (v === 'hora' || v === 'lista') return v; } catch (e) { /* sin guardar */ }
    return typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches ? 'hora' : 'lista';
  });
  const setForma = (v) => { setFormaS(v); try { localStorage.setItem('lg:ev-forma', v); } catch (e) { /* sin guardar */ } };
  const diaRef = useRef(null);
  const selRef = useRef(null);
  const bajarSel = useRef(false);
  // 👏 felicitar al campeón desde el elegido: su publicación del muro, por el número de la llave (como en Campeones)
  const Ap = useAplausos();
  const pubs = useMemo(() => {
    const m = {};
    (liga.muro || []).forEach((it) => { if (it.tipo === 'campeon' && it.id && it.ll != null && !m[String(it.ll)]) m[String(it.ll)] = it; });
    return m;
  }, [liga]);
  const tira = useRef(null);
  const grupos = useRef(null);
  const der = useRef(null);
  // cuántos de «lo último que se jugó»: arranca chico y crece hasta llenar el costado (ver el bloque al final de <main>)
  const [mas, setMas] = useState({ k: '', n: 0 });
  const [, setMedida] = useState(0);
  const poolN = useRef(0);

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
    if (bajar && diaRef.current) diaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // otro día, desde la tira, el mes o la fila de cuatro: sin el elegido del día de antes
  const elegirDia = (k, bajar) => { setFoco(''); elegir(k, bajar); };
  const bajarA = () => setTimeout(() => { if (diaRef.current) diaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  const cambiarVista = (v) => { setVista(v); setFoco(''); };
  // de la semana o del mes al día: con el evento tocado abierto
  const abrirDia = (k, c) => { bajarSel.current = !!c; setFoco(c ? idEv(c) : ''); setVista('dia'); elegir(k); if (!c) bajarA(); };
  // tocar un evento lo abre en el elegido; si el elegido no se ve (en el teléfono queda abajo), se baja hasta él
  const ver = (id) => {
    const el = selRef.current;
    const r = el && el.getBoundingClientRect();
    bajarSel.current = !r || r.top > window.innerHeight - 140 || r.bottom < 90;
    setFoco(id);
  };
  useEffect(() => {
    if (!foco || vista !== 'dia' || !bajarSel.current) return undefined;
    bajarSel.current = false;
    const t = setTimeout(() => { if (selRef.current) selRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    return () => clearTimeout(t);
  }, [foco, vista]);
  // el día elegido, a la vista en la tira
  useEffect(() => {
    const t = tira.current;
    const b = t && t.querySelector('button.on');
    if (b && t.scrollWidth > t.clientWidth) t.scrollTo({ left: Math.max(0, b.offsetLeft - (t.clientWidth - b.offsetWidth) / 2), behavior: 'smooth' });
  }, [dia]);

  // ── lo del día elegido, en tres grupos ──
  const ahora = liga.ahora.getTime();
  // 🕒 POR NOMBRE, SÓLO SI LA HORA ESTÁ A MENOS DE 6 H (18/11/2026), la ventana de `termino()` en liga.js: los nombres se
  // repiten («GG SANGRERAP» de FDS ×6) y la GG SANGRERAP del 24/10, sin llave, salía «● en vivo» mientras se jugaba la
  // de hoy, y después con su campeón. Lo mismo `termDe` y `esArriba`
  const cerca = (a, b) => Math.abs(utc(a) - utc(b)) < 6 * 3600000;
  const esVivo = (c) => vivoS.some((e) => (e.link && e.link === c.link) || (e.sv === c.sv && limpio(e.nombre) === limpio(c.n) && cerca(e.cuando, c.t)));
  // 🔑 lo que terminó y el ciclo todavía no procesó: su llave y su campeón (ver `liga.recienTerminadas()`). Antes de `prox`,
  // que lo usa (`sinHora`)
  const term = liga.recienTerminadas();
  const termDe = (c) => (c.ll ? null : term.find((x) => x.e && ((x.e.link && x.e.link === c.link) || (x.e.sv === c.sv && limpio(x.e.nombre) === limpio(c.n) && cerca(x.e.cuando, c.t)))) || null);
  // 🔑 LO ANUNCIADO SIN UNA HORA QUE SE PUEDA LEER (`sh`, 18/11/2026): su `t` es la de PUBLICACIÓN, así que a los minutos
  // de anunciado ya «había pasado» y caía en «Terminados» como «SIN LLAVE». Va con lo que viene durante 3 h —la ventana
  // de `SIN_HORA_H` en subir_web.py— y al final, como en `liga.luego()`. Lo cancelado, lo pausado y lo que ya terminó
  // (`termDe`) siguen en su grupo
  const sinHora = (c) => !!c.sh && !c.ll && ahora - utc(c.t) < 3 * 3600000 && !liga.canceladoCal(c)
    && !liga.enPausa({ link: c.link, t: c.t, sv: c.sv, n: c.n }) && !termDe(c);
  const evs = porDia[dia] || [];
  // ⚠️ por la hora y no por el día: uno que empezó a las 23:30 y sigue a las 00:20 salía en «Terminados · SIN LLAVE»
  // de ayer mientras la tarjeta de arriba decía EN VIVO (revisión del 03/10/2026). `esVivo` ya mira lo que el vigía
  // ve en juego ahora
  const vivos = evs.filter((c) => !c.ll && esVivo(c));
  const prox = evs.filter((c) => !vivos.includes(c) && (utc(c.t).getTime() > ahora || sinHora(c)))
    .sort((a, b) => (a.sh ? 1 : 0) - (b.sh ? 1 : 0) || (a.t < b.t ? -1 : 1));
  // 🔴 y lo que se canceló con el anuncio en pie —le borraron la llave y no hubo otra— va con los cancelados, no con
  // «Terminados · SIN LLAVE» (LA REDENCION, 03/10/2026, Dlx: «debería decir cancelado también»). Ver `canceladoCal()`
  const pasados = evs.filter((c) => !vivos.includes(c) && !prox.includes(c));
  // ⏸ y lo que el organizador pausó («seguimos mañana») va en su grupo, no en «Terminados · SIN LLAVE»
  const pausa = pasados.filter((c) => !c.ll && liga.enPausa({ link: c.link, t: c.t, sv: c.sv, n: c.n }));
  const hechos = pasados.filter((c) => !liga.canceladoCal(c) && !pausa.includes(c)).sort((a, b) => (a.t < b.t ? 1 : -1));
  const nomSv = (sv, n) => sv + '|' + limpio(n).toLowerCase();
  const delCal = pasados.filter((c) => liga.canceladoCal(c)).map((c) => ({ id: c.link || c.n, n: c.n, sv: c.sv, ini: c.t, link: c.link }));
  const cancelados = delCal.concat(liga.cancelacionesVisibles()
    .filter((c) => c.ini && liga.diaClave(c.ini) === dia && (!svFil || c.sv === svFil) && !delCal.some((d) => nomSv(d.sv, d.n) === nomSv(c.sv, c.n))));
  const enVivo = (c) => llaveEnVivo({ cuando: c.t, sv: c.sv, nombre: c.n }, vivoL);
  // (lo que terminó sin procesar, `termDe`, está arriba: `prox` lo usa)
  // el que va en la tarjeta negra de arriba (`vivoS[0]`), con su llave
  const esArriba = (c) => !!vivoS[0] && ((vivoS[0].link && vivoS[0].link === c.link) || (vivoS[0].sv === c.sv && limpio(vivoS[0].nombre) === limpio(c.n) && cerca(vivoS[0].cuando, c.t)));
  // 🕒 lo del día, de a uno, para la guía, la lista y el elegido
  const itemsDia = [
    ...vivos.map((c) => ({ c, est: 'vivo', L: enVivo(c), arriba: esArriba(c) })),
    ...pausa.map((c) => ({ c, est: 'pausa', L: enVivo(c) })),
    ...prox.map((c) => ({ c, est: 'prox' })),
    ...hechos.map((c) => { const T = termDe(c); return { c, est: 'hecho', L: T ? T.L : undefined, campVivo: T ? T.camp : '', campN: T ? T.campN : [] }; }),
    // con su link, si lo tiene: el id sale de ahí, y tocar el cancelado en la semana tiene que elegir a ESE (revisión del 16/11)
    ...cancelados.map((x) => ({ c: { n: x.n, sv: x.sv, t: x.ini, link: x.link }, est: 'cancelado' })),
  ].map((it) => Object.assign(it, { id: idEv(it.c) }));
  // el elegido: el que se tocó; si no, el en vivo, el último que terminó con llave o lo próximo
  const selIt = itemsDia.find((it) => it.id === foco) || itemsDia.find((it) => it.est === 'vivo')
    || itemsDia.find((it) => it.est === 'hecho' && it.c.ll) || itemsDia.find((it) => it.est === 'prox') || itemsDia[0] || null;
  const de = (est) => itemsDia.filter((it) => it.est === est);
  // un evento de otro día (lo que viene, lo último): tocarlo abre su día con él elegido
  const filaOtra = (c, est) => { const it = { c, est, id: idEv(c) }; return <Fila key={it.id} liga={liga} it={it} conDia onSel={() => abrirDia(liga.diaClave(c.t), c)} />; };

  // ── la tira: de 6 días atrás a 2 adelante, y los días de la semana que pasó con algo ──
  const tiraDias = [];
  for (let i = -6; i <= 2; i += 1) tiraDias.push(diaMas(hoyK, i));
  if (!tiraDias.includes(dia)) tiraDias.unshift(dia);

  // ── el momento de arriba: lo que se juega ahora, lo próximo, o el último campeón ──
  const proximo = cal.filter((c) => utc(c.t).getTime() > ahora && !esVivo(c)).sort((a, b) => (a.t < b.t ? -1 : 1))[0];
  const vivoAhora = vivoS[0];
  const ultima = liga.llavesPorFecha().find((x) => liga.campeon(x).length);
  const A = liga.d.actividad || {};
  const jugadosPorSv = {};
  cal.forEach((c) => { if (c.ll) jugadosPorSv[c.sv] = (jugadosPorSv[c.sv] || 0) + 1; });
  const masActivo = Object.keys(jugadosPorSv).sort((a, b) => jugadosPorSv[b] - jugadosPorSv[a])[0];
  const svsCal = [...new Set(cal.map((c) => c.sv).filter(Boolean))].sort((a, b) => (jugadosPorSv[b] || 0) - (jugadosPorSv[a] || 0));
  let momento = null;
  if (vivoAhora) {
    const L = llaveEnVivo(vivoAhora, vivoL);
    // 🔑 LA LLAVE VA ACÁ, ADENTRO DE LO NEGRO (Dlx, 03/10/2026: «prefiero que esté dentro del espacio negro como estaba
    // antes»): con Octavos o más, la llave corta —la que se jugó, la de ahora y la que sigue—; con menos, el cuadro entero.
    // ⚠️ Y en «Hoy» ya no se repite (`arriba` de Evento): la llave dos veces era el «se está repitiendo eso» del mismo día
    const corta = cortaDe(L);
    const dv = aDiscord(liga, vivoAhora, true);
    momento = (
      <div className="evp-mo vivo">
        <span className="tag">EN VIVO AHORA</span>
        <div className="evp-mo-n"><img alt="" src={liga.logo(vivoAhora.sv)} /><b>{limpio(vivoAhora.nombre)}</b></div>
        <small className="evp-mo-s">{siglaDe(vivoAhora.sv)} · empezó {liga.dia(vivoAhora.cuando).replace(/^hoy /, '')}</small>
        {L ? (corta ? <LlaveCorta liga={liga} m={corta} /> : <CuadroLleno liga={liga} ll={L} />)
          : <p className="hero-p">La llave aparece apenas la carguen. Mientras, se mira en Discord.</p>}
        <div className="hero-acc">
          {L ? <button type="button" className="btn verde" onClick={() => accion.llave('v:' + L.id)}>{corta ? 'Ver la llave completa' : 'Ver la llave'}</button> : null}
          {dv ? <a className={'btn ' + (L ? 'borde' : 'verde')} href={dv.url} target="_blank" rel="noopener noreferrer">{dv.txt} ↗</a> : null}
        </div>
      </div>
    );
  } else if (proximo) {
    // 🎟️ EL BOLETO (Dlx, 21/10/2026, eligió la maqueta A; «Admit One Ticket» y «Event RSVP Card» de 21st): la cuenta
    // atrás, cuántos se anotaron contra los cupos —cuando el anuncio dice un número—, y el talón con la hora y los botones
    const px = proximo.px || {};
    const pi = px.ins ? aDiscord(liga, { sv: proximo.sv, ins: px.ins }, false) : null;
    const nAn = liga.anotados({ link: proximo.link }).length;
    const cup = parseInt((/\d+/.exec(String(px.cupos || '')) || [''])[0], 10);
    const orgs = liga.orgsDe(px.org || px.os ? px : {}).map((o) => limpio(o.f ? o.f.n : o.n));
    const [hh, ...ampm] = hora(proximo.t).split(' ');
    // 📅 A MÁS DE DOS DÍAS, EN DÍAS Y CON LA FECHA EN EL TALÓN (18/11/2026): `liga.falta()` cuenta sólo horas y
    // `nombreDia()` da sólo «DOM», así que DISCORD STYLE 20 decía «EMPIEZA EN 280 H 35 MIN» y «DOM» faltando 11 días, y se
    // leía como el domingo que viene
    const fh = (utc(proximo.t).getTime() - ahora) / 3600000;
    const kP = liga.diaClave(proximo.t);
    momento = (
      <div className="evp-mo evp-bol">
        <div className="evp-bol-a">
          <span className="tag">LO PRÓXIMO · EMPIEZA EN {fh >= 48 ? Math.floor(fh / 24) + ' DÍAS' : liga.falta(proximo.t).toUpperCase()}</span>
          <div className="evp-mo-n"><img alt="" src={liga.logo(proximo.sv)} /><b>{limpio(proximo.n)}</b></div>
          <small className="evp-mo-s">{[siglaDe(proximo.sv), formato(proximo.mod || px.modalidad), orgs.length ? 'organiza ' + orgs.join(', ') : ''].filter(Boolean).join(' · ')}</small>
          {cup > 0 ? (
            <div className="evp-bol-cup">
              <span><u style={{ width: Math.min(100, Math.round((100 * nAn) / cup)) + '%' }} /></span>
              {/* 🪑 lleno: los que se anotaron después del último cupo son suplentes, en orden (20/11/2026, Dlx: «suplentes») */}
              <small>{Math.min(nAn, cup)} de {cup} cupos{nAn > cup ? ' · ' + (nAn - cup) + (nAn - cup === 1 ? ' suplente' : ' suplentes') : ''}{String(px.cupos).trim() !== String(cup) ? ' · ' + String(px.cupos).toLowerCase() : ''}</small>
            </div>
          ) : px.cupos ? <small className="evp-mo-s">Cupos: {String(px.cupos).toLowerCase()}</small> : null}
        </div>
        <div className="evp-bol-t">
          <small>{((nombreDia(kP, hoyK) || '') + (kP > diaMas(hoyK, 1) ? ' ' + fechaFija(liga, proximo.t) : '')).toUpperCase()}</small>
          <b>{hh}{ampm.length ? <em>{ampm.join(' ')}</em> : null}</b>
          {pi ? <a className="btn verde chico" href={pi.url} target="_blank" rel="noopener noreferrer">{pi.txt} ↗</a> : null}
          <button type="button" className={'btn chico ' + (pi ? 'evp-bol-av' : 'verde')} onClick={() => accion.ir('ev-campana')}><Ico n="campana" t={16} />Avísame</button>
          {pi ? null : <a className="evp-bol-cal" href={gcal({ nombre: proximo.n, sv: proximo.sv, cuando: proximo.t, link: proximo.link })} target="_blank" rel="noopener noreferrer">+ Calendario</a>}
        </div>
      </div>
    );
  } else if (ultima) {
    const g = liga.campeon(ultima);
    const r = (ultima.tabla || []).find((x) => x[1] === 'Campeón') || [];
    const f0 = liga.quien(r[0] || g[0], r[3]);
    // 🃏 sólo con carta de verdad (revisión del 18/11/2026): `quien()` ahora también da la fila ligera de quien está fuera
    // de las 200 (sin cartas), y se dibujaba «<clave> · SIN CARTA» en vez del bloque sin carta de siempre
    const cvU = f0 ? liga.cartaDe(f0.k, { sv: ultima.sv }) : null;
    const f = cvU ? f0 : null;
    // la carta del campeón al lado de su nombre (en el celular, una columna de texto al lado de la carta se cortaba). Los
    // pedazos van sueltos, sin caja que los agrupe: así la grilla los acomoda distinto en el celular —la carta al lado
    // del nombre— y en la compu —la carta a la izquierda de todo, para que la tarjeta no sea más alta que el título—
    momento = (
      <div className={'evp-mo ult' + (f ? '' : ' sin-carta')}>
        <span className="tag">ÚLTIMO CAMPEÓN · {liga.cuando(liga.fechaLlave(ultima)).toUpperCase()}</span>
        {f ? <div className="evp-mo-carta"><Carta liga={liga} k={f.k} cual={cvU} nombre={f.n} cls="evp-mo-ci" /></div> : null}
        <div className="evp-mo-txt">
          <div className="evp-mo-n"><img alt="" src={liga.logo(ultima.sv)} /><b><Algunos liga={liga} nombres={g} cara={false} /></b></div>
          {/* 🏷️ con el nombre que se lee: «(sin titulo)» es la marca del lector (18/11/2026) */}
          <small className="evp-mo-s">{liga.nombreLlave(ultima)} · {siglaDe(ultima.sv)} · {ultima.participantes} raperos</small>
        </div>
        <div className="hero-acc">
          <button type="button" className="btn verde" onClick={() => accion.llave(ultima.n)}>Ver la llave</button>
          {g.length ? <BotonCampeon liga={liga} ll={ultima} estilo="borde" ic /> : null}
          {camp && camp.activa ? null
            : <button type="button" className="btn borde" onClick={() => accion.ir('ev-campana')}><Ico n="campana" t={18} />Activar la campana</button>}
        </div>
      </div>
    );
  }
  // 🔢 los filtros con cuántos eventos tiene cada servidor en lo que se está mirando: el día, la semana o el mes
  const rangoK = vista === 'dia' ? [dia] : vista === 'semana' ? [0, 1, 2, 3, 4, 5, 6].map((i) => diaMas(diaMas(dia, -dowDe(dia)), i)) : null;
  const ymK = ym[0] + '-' + String(ym[1] + 1).padStart(2, '0');
  const cuentaSv = {};
  cal.forEach((c) => { const k = liga.diaClave(c.t); if (k && (rangoK ? rangoK.includes(k) : k.startsWith(ymK))) cuentaSv[c.sv] = (cuentaSv[c.sv] || 0) + 1; });
  const cuentaTot = Object.values(cuentaSv).reduce((s, v) => s + v, 0);
  // en la semana, lo que dice cada evento sin campeón. 🔑 El anunciado sin una hora que se pueda leer (`sinHora`,
  // 18/11/2026) también decía «sin llave» a los minutos de anunciado
  const estadoCorto = (c) => (esVivo(c) && !c.ll ? { cls: 'vivo', txt: '● en vivo' } : liga.canceladoCal(c) ? { cls: 'canc', txt: 'cancelado' }
    : utc(c.t).getTime() > ahora || sinHora(c) ? { cls: 'prox', txt: c.sh ? 'hora sin confirmar' : 'por jugarse' } : { cls: 'sin', txt: c.ll ? 'terminó' : 'sin llave' });
  const tituloDe = (k) => (k === hoyK ? 'Hoy' : k === diaMas(hoyK, -1) ? 'Ayer' : k === diaMas(hoyK, 1) ? 'Mañana' : liga.fechaLarga(k + 'T16:00:00Z'));
  const tituloDia = tituloDe(dia);
  const nada = !vivos.length && !prox.length && !hechos.length && !cancelados.length;
  // 🧱 lo último que se jugó (el bloque al final de <main>): en el día, lo de antes de ese día; en la semana y el mes, lo más nuevo
  const pasPool = filtrado.filter((c) => c.ll && utc(c.t).getTime() <= ahora && (vista !== 'dia' || liga.diaClave(c.t) < dia))
    .sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 30);
  poolN.current = pasPool.length;
  // atado a la vista, el día y el filtro: al cambiar cualquiera vuelve a arrancar chico. ⚠️ No con un efecto que lo
  // reinicie: el reinicio y el «crece» caían en la misma pasada, daban el mismo número de antes y React no volvía a
  // dibujar ni a medir (medido: 247 px de hueco al pasar de Mes a Día)
  const claveMas = vista + '|' + dia + '|' + svFil;
  const nMas = mas.k === claveMas ? mas.n : (vista === 'dia' ? (nada ? 6 : 3) : 4);
  // …y crece mientras al lado quede hueco, sólo con la página en dos columnas (en el teléfono el costado va abajo)
  useEffect(() => {
    const m = grupos.current;
    const a = der.current;
    if (!m || !a || !m.lastElementChild) return;
    if (getComputedStyle(m.parentNode).gridTemplateColumns.trim().split(/\s+/).length < 2) return;
    const hueco = a.getBoundingClientRect().bottom - m.lastElementChild.getBoundingClientRect().bottom;
    if (hueco > 90 && nMas < poolN.current) setMas({ k: claveMas, n: Math.min(poolN.current, nMas + Math.max(1, Math.floor(hueco / 66))) });
  });
  // el costado cambia de largo solo (la campana carga después, la ventana cambia de ancho): se vuelve a medir
  useEffect(() => {
    const a = der.current;
    if (!a || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setMedida((x) => x + 1));
    ro.observe(a);
    return () => ro.disconnect();
  }, []);
  // lo último que hubo, para el día vacío
  const ultimoDia = conDias.filter((k) => k < dia).pop();
  // 🔁 tu último evento (48 h) y tu próximo, para «después de jugar» (ver `TuProximo`)
  const tuUlt = liga.yo ? cal.filter((c) => c.ll && (liga.ahora - utc(c.t)) / 3600000 < 48 && miFila(liga, (liga.d.llaves || {})[c.ll]))
    .sort((a, b) => (a.t < b.t ? 1 : -1))[0] : null;
  const sigDe = (c, quedan) => (tuUlt && c === tuUlt && !quedan ? eventoDelBoton(liga) : null);
  // 4️⃣ lo de la fila de cuatro: de todos los servidores, sin el filtro
  // 🔴 sin los que el ciclo marcó cancelados (`can`, 18/11/2026): `cal` sólo saca los que vio el vigía, y «qcyo rapeen 16»
  // y «COMPE PANDILLAS» contaban como eventos de la semana y del día más cargado
  const calHoy = cal.filter((c) => liga.diaClave(c.t) === hoyK && !liga.canceladoCal(c));
  const nVivoHoy = calHoy.filter((c) => !c.ll && esVivo(c)).length;
  // 🔑 con lo anunciado sin una hora que se pueda leer (`sinHora`, 18/11/2026): si no, decía «Ya terminó lo anunciado»
  const nTardeHoy = calHoy.filter((c) => (utc(c.t).getTime() > ahora || sinHora(c)) && !esVivo(c)).length;
  // los últimos 7 días, como el «Esta semana» de la portada (`actividad.ev`, de subir_web.py): de lunes a domingo, un
  // lunes decía «Nada todavía» al lado de un 26
  const semK = [-6, -5, -4, -3, -2, -1, 0].map((i) => diaMas(hoyK, i));
  const calSem = cal.filter((c) => semK.includes(liga.diaClave(c.t)) && !liga.canceladoCal(c));
  const porDow = semK.map((k) => calSem.filter((c) => liga.diaClave(c.t) === k).length);
  const dowTop = dowDe(semK[porDow.indexOf(Math.max(...porDow))]);
  const campHoy = liga.llaves().filter((ll) => liga.diaClave(liga.fechaLlave(ll)) === hoyK).map((ll) => nombreCamp(liga.campeon(ll))).filter(Boolean);
  const nSv = (xs) => new Set(xs.map((c) => c.sv).filter(Boolean)).size;
  const cuantos = (n) => n + (n === 1 ? ' evento' : ' eventos');
  const svT = (n) => n + (n === 1 ? ' servidor' : ' servidores');
  const hoyNom = (() => { const [y, m, d] = hoyK.split('-').map(Number); return DIAS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()] + ' ' + d; })();

  return (
    <>
      <div className="escena evp-esc" style={{ '--mo-c': '#E41373', '--mo-o': 0.85 }}>
        <section className="evp-cab">
          <div className="evp-cabtx" data-tuto="ev-cab">
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
              {masActivo ? <div><dt>El más activo</dt><dd className="evp-sv"><img alt="" src={liga.logo(masActivo)} />{siglaDe(masActivo)}</dd></div> : null}
            </dl> : null}
          </div>
          {momento}
        </section>
      </div>
      <nav data-tuto="ev-dias" className="evp-dias" aria-label="Días">
        <div className="evp-dias-in" ref={tira}>
          {tiraDias.map((k) => {
            const xs = porDia[k] || [];
            const n = xs.length;
            const [, , d] = k.split('-').map(Number);
            return (
              <button type="button" key={k} className={(k === dia ? 'on' : '') + (k === hoyK ? ' hoy' : '') + (n ? '' : ' sin')} aria-pressed={k === dia}
                aria-label={nombreDia(k, hoyK) + ' ' + d + ': ' + (n ? n + (n === 1 ? ' evento' : ' eventos') : 'sin eventos')} onClick={() => elegirDia(k)}>
                <span>{nombreDia(k, hoyK)}</span><b>{d}</b>
                {/* 🔵 un punto por evento, del color de su servidor (la maqueta A, 21/10/2026), en vez de «5 eventos» */}
                <i className="evp-pts" aria-hidden="true">{n ? <>{xs.slice(0, 8).map((c, j) => <u key={j} style={{ background: color(c.sv) }} />)}{n > 8 ? <em>+{n - 8}</em> : null}</> : '—'}</i>
                {misDias.has(k) ? <em className="evp-dyo" title="Jugaste" aria-label="jugaste" /> : null}
              </button>
            );
          })}
        </div>
      </nav>
      {/* 4️⃣ LA FILA DE CUATRO (la A de la maqueta, como la del Inicio): hoy, la semana, los campeones de hoy y la campana.
          Cada cuadro lleva a lo suyo */}
      <div className="evp-cuerpo">
        <div className="evp-f4">
          <button type="button" style={{ '--c': '#29B298' }} onClick={() => { cambiarVista('dia'); elegirDia(hoyK, true); }}>
            <i>Hoy · {hoyNom}</i>
            <b>{calHoy.length ? cuantos(calHoy.length) + ' · ' + svT(nSv(calHoy)) : 'Nada anunciado todavía'}</b>
            <small>{[nVivoHoy ? nVivoHoy + ' en vivo' : '', nTardeHoy ? nTardeHoy + ' más tarde' : ''].filter(Boolean).join(', ') || (calHoy.length ? 'Ya terminó lo anunciado: avisan 15 min antes' : 'Se anuncian unos 15 minutos antes')}</small>
          </button>
          <button type="button" style={{ '--c': '#F0559A' }} onClick={() => { elegirDia(hoyK); cambiarVista('semana'); }}>
            <i>Los últimos 7 días</i>
            <b>{calSem.length ? cuantos(calSem.length) + ' · ' + svT(nSv(calSem)) : 'Nada todavía'}</b>
            <small>{calSem.length ? 'El ' + SEMANA_S[dowTop] + ' fue el día más cargado' : 'Toca para ver la semana'}</small>
          </button>
          {/* 🏆 sin ningún campeón todavía (el arranque de una temporada, 18/11/2026) «Los últimos campeones» no se dibuja y
              este cuadro bajaba a nada: abre hoy, como el de al lado. Y lo próximo, con su día: a 11 días decía «7:00 PM»
              debajo de «Campeones de hoy», y se leía como esta noche */}
          <button type="button" style={{ '--c': '#F5C542' }} onClick={() => { if (ultima) accion.ir('ev-campeones'); else { cambiarVista('dia'); elegirDia(hoyK, true); } }}>
            <i>Campeones de hoy</i>
            <b>{campHoy.length ? (campHoy.length > 2 ? campHoy.slice(0, 2).join(', ') + ' y ' + (campHoy.length - 2) + ' más' : campHoy.join(' y ')) : 'Todavía ninguno'}</b>
            <small>{proximo ? 'Lo próximo: ' + limpio(proximo.n) + ', ' + liga.dia(proximo.t) : ultima ? 'Los últimos, abajo' : 'La temporada recién empieza'}</small>
          </button>
          <button type="button" style={{ '--c': '#5CC8FF' }} onClick={() => accion.ir('ev-campana')}>
            <i>La campana</i>
            <b>{camp && camp.activa ? 'Prendida en este dispositivo' : 'Te avisa al minuto'}</b>
            <small>{'De los ' + svsCal.length + ' servidores' + (camp && camp.activa ? '' : ' · actívala')}</small>
          </button>
        </div>
        {/* 🗓️ Día · Semana · Mes (Dlx, 21/10/2026). Reemplaza el botón «Mes» que estaba al lado de la tira */}
        <div className="evp-barra">
          <div className="evp-vista" role="group" aria-label="Ver los eventos por">
            {[['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']].map(([v, t]) => (
              <button type="button" key={v} className={vista === v ? 'on' : ''} aria-pressed={vista === v} onClick={() => cambiarVista(v)}>{t}</button>
            ))}
          </div>
          {svsCal.length > 1 ? (
            <div className="evp-chips evp-filtro" role="group" aria-label="Filtrar por servidor">
              <button type="button" className={!svFil ? 'on' : ''} aria-pressed={!svFil} onClick={() => setSvFil('')}>Todos{cuentaTot ? <u>{cuentaTot}</u> : null}</button>
              {svsCal.map((s) => (
                <button type="button" key={s} className={svFil === s ? 'on' : ''} aria-pressed={svFil === s} onClick={() => setSvFil(svFil === s ? '' : s)}>
                  <img alt="" src={liga.logo(s)} />{siglaDe(s)}{cuentaSv[s] ? <u>{cuentaSv[s]}</u> : null}</button>
              ))}
            </div>
          ) : null}
        </div>
        {vista === 'semana' ? (
          <Semana liga={liga} porDia={porDia} dia={dia} hoyK={hoyK} color={color} estado={estadoCorto}
            onDia={(k) => abrirDia(k)} onEvento={(k, c) => abrirDia(k, c)} mover={(n) => elegir(diaMas(dia, n))} />
        ) : null}
        {vista === 'mes' ? (
          <div className="evp-mes-v">
            <Mes liga={liga} porDia={porDia} dia={dia} onDia={(k) => abrirDia(k)} ym={ym} setYm={setYm} color={color} />
            <div className="evp-ley">{svsCal.map((s) => <span key={s}><i style={{ background: color(s) }} />{siglaDe(s)}</span>)}</div>
          </div>
        ) : null}
        {/* 🕒 EL DÍA, POR HORA O EN LISTA (la D): a lo ancho, arriba del elegido */}
        {vista === 'dia' ? (
          <section className="evp-hoy" ref={diaRef}>
            <div className="evp-dia-t">
              <h2 className="evp-dia">{tituloDia}<small>{evs.length ? cuantos(evs.length) : ''}{dia === hoyK && evs.length ? ' · ahora son las ' + hora(liga.ahora) : ''}</small></h2>
              {itemsDia.length ? (
                <div className="evp-forma" role="group" aria-label="Cómo ver el día">
                  {[['hora', 'Por hora'], ['lista', 'En lista']].map(([v, t]) => (
                    <button type="button" key={v} className={forma === v ? 'on' : ''} aria-pressed={forma === v} onClick={() => setForma(v)}>{t}</button>
                  ))}
                </div>
              ) : null}
            </div>
            {itemsDia.length && forma === 'hora' ? <Guia liga={liga} items={itemsDia} sel={selIt ? selIt.id : ''} onSel={ver} esHoy={dia === hoyK} /> : null}
            {itemsDia.length && forma === 'lista' ? (
              <div className="evp-grupos">
                {[['vivo', '● En vivo'], ['pausa', '⏸ En pausa'], ['prox', dia === hoyK ? 'Más tarde' : 'Por jugarse'], ['hecho', 'Terminados'], ['cancelado', 'Cancelados']].map(([est, t]) => (de(est).length ? (
                  <section key={est} className="grupo"><h3 className={'g-t' + (est === 'vivo' ? ' vivo' : '')}>{t}</h3>
                    <ol className="evl">{de(est).map((it) => <Fila key={it.id} liga={liga} it={it} sel={!!selIt && selIt.id === it.id} onSel={() => ver(it.id)} />)}</ol></section>
                ) : null))}
              </div>
            ) : null}
            {nada ? (
              <div className="evp-nada">
                <p>{dia === hoyK ? 'Hoy todavía no se anunció ningún evento. Los servidores los anuncian unos 15 minutos antes: con la campana te llega al minuto.'
                  : dia > hoyK ? 'Para ese día todavía no hay nada anunciado.' : 'Ese día no hubo eventos.'}</p>
                <CuandoJuega liga={liga} cal={filtrado} dia={dia} color={color} et="CUÁNDO SUELE JUGAR CADA SERVIDOR" />
                {ultimoDia ? <button type="button" className="btn borde2 chico" onClick={() => elegirDia(ultimoDia, true)}>Ver el último día con eventos</button> : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      <div className="evp-t3">
        <main className="evp-centro" ref={grupos}>
          {/* 👆 el elegido, con su llave de a una ronda */}
          {vista === 'dia' && selIt ? (
            <div className="evs-w" ref={selRef}>
              <Elegido key={selIt.id} liga={liga} it={selIt} sig={selIt.est === 'hecho' ? sigDe(selIt.c, prox.length + vivos.length) : null}
                pub={selIt.c.ll != null ? pubs[String(selIt.c.ll)] : null} Ap={Ap} />
            </div>
          ) : null}
          {/* 🧱 debajo de la semana y del mes, lo que viene y lo último que se jugó: en la compu la columna de al lado es más
              larga y quedaba un hueco grande (Dlx, 21/10/2026: «debajo hay un espacio vacío que se ve feo») */}
          {vista !== 'dia' ? (() => {
            const fut = filtrado.filter((c) => utc(c.t).getTime() > ahora && !liga.canceladoCal(c)).sort((a, b) => (a.t < b.t ? -1 : 1)).slice(0, 3);
            return fut.length ? (
              <section className="grupo evp-mas"><h3 className="g-t">Lo que viene</h3>
                <ol className="evl">{fut.map((c) => filaOtra(c, 'prox'))}</ol></section>
            ) : null;
          })() : null}
          {/* un día sin nada no es un callejón: abajo, lo que viene y lo último que se jugó */}
          {vista === 'dia' && dia >= hoyK ? (() => {
            const fut = filtrado.filter((c) => utc(c.t).getTime() > ahora && liga.diaClave(c.t) !== dia && !liga.canceladoCal(c)).sort((a, b) => (a.t < b.t ? -1 : 1)).slice(0, 3);
            return fut.length ? (
              <section className="grupo evp-mas"><h3 className="g-t">Lo que viene</h3>
                <ol className="evl">{fut.map((c) => filaOtra(c, 'prox'))}</ol></section>
            ) : null;
          })() : null}
          {/* 🧱 LO ÚLTIMO QUE SE JUGÓ, con su fecha, en las tres vistas: en el día, lo de antes de ese día; en la semana y el mes,
              lo más nuevo. Arranca con 3 o 4 y, si la página va en dos columnas, suma eventos hasta llegar al largo de la de
              al lado (Dlx, 21/10/2026, con una captura del iPad). Ver el efecto de `nMas` */}
          {pasPool.length ? (
            <section className="grupo evp-mas evp-ultdia"><h3 className="g-t">Lo último que se jugó</h3>
              <ol className="evl">{pasPool.slice(0, nMas).map((c) => filaOtra(c, 'hecho'))}</ol>
            </section>
          ) : null}
        </main>
        <aside className="evp-der" ref={der}>
          {/* en la vista Mes, el mes ya está en el centro: al costado sería el mismo dos veces */}
          <section className={'evp-bloque evp-mes-pc' + (vista === 'mes' ? ' fuera' : '')}><h2 className="evp-h2">El mes</h2>
            <Mes liga={liga} porDia={porDia} dia={dia} onDia={(k) => elegirDia(k, false)} ym={ym} setYm={setYm} color={color} />
            <div className="evp-ley">{svsCal.map((s) => <span key={s}><i style={{ background: color(s) }} />{siglaDe(s)}</span>)}</div>
          </section>
          <section data-tuto="ev-campana" className="evp-bloque" id="ev-campana"><h2 className="evp-h2"><Ico n="campana" t={20} />La campana</h2><Campana liga={liga} /></section>
          <section className="evp-bloque"><h2 className="evp-h2">En tu calendario</h2><Calendario /></section>
          {/* en la compu, al costado: llena lo que queda abajo de la campana mientras el día sigue (en el teléfono va en
              «Cómo se juega») */}
          {/* 🧱 sólo si algún servidor tiene 3 eventos (18/11/2026): `CuandoJuega` no dibuja nada con menos, y el título quedaba
              solo en la compu */}
          {Pc.svs.length ? <section className="evp-bloque evp-cuando-pc"><h2 className="evp-h2">Cuándo suele jugar</h2><CuandoJuega liga={liga} cal={cal} color={color} /></section> : null}
        </aside>
      </div>
      {/* 🏆 con algún campeón y no con alguna llave (18/11/2026): `Campeones` sólo dibuja las que tienen, y con llaves sin
          campeón quedaba el título solo */}
      {ultima ? (
        <section className="sec negra evp-campeones" id="ev-campeones">
          {/* 🔢 «N esta semana» del calendario (los 28 días) y no de `liga.llaves()` (18/11/2026): ésas son las 12 que viajan
              en el lobby (`LLAVES_WEB`), y desde el jueves decía «12 esta semana» con 20 a 40. Sin los registros de llaves en
              vivo (un `ll` de más de 6 cifras), que no tienen campeón. Y su clase ya no es `evp-sem`, la de la vista Semana:
              le daba su grilla y su relleno */}
          <div className="sec-t"><h2>Los últimos campeones{(() => { const d = liga.desdeLunes(); const n = new Set(cal.filter((c) => c.ll && String(c.ll).length <= 6 && utc(c.t) >= d).map((c) => String(c.ll))).size; return n ? <small className="evp-camp-n">{n} esta semana</small> : null; })()}</h2><Compartir cls="evp-comp" url={enlace('#/eventos')} texto="Los eventos de la Liga Global" etiqueta="Compartir" /></div>
          <Campeones liga={liga} />
        </section>
      ) : null}
      {/* 🔥 cuándo se juega (la B), y «Cómo se juega» y «Quién organiza» en ventanas. 🧱 Sólo si alguno de los dos tiene
          qué dibujar (18/11/2026): `Calor` pide 5 eventos y `ComoTiles` formatos, organizadores o un servidor con 3 */}
      {(() => {
        const Dc = comoDatos(liga);
        return Pc.todos.length >= 5 || Dc.fs.length || Dc.os.length || Pc.svs.length ? (
          <section className="sec evp-como-sec"><div className="sec-t"><h2>Cuándo se juega</h2><a href="#/guia">La guía <Ico n="flecha" t={16} /></a></div>
            <div className="evp-cuando2"><Calor liga={liga} cal={cal} /><ComoTiles liga={liga} cal={cal} color={color} /></div>
          </section>
        ) : null;
      })()}
    </>
  );
}
