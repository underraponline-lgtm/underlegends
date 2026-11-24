// 🔒 EL DASHBOARD DEL DUEÑO (Dlx, 04/10/2026: «el bot y la página, que esté en una página nueva creada sólo para el
// owner… la única manera de iniciar sesión ahí es con mi cuenta… ahí poné esa información y configuraciones extras»).
//
// ⚠️ LA PUERTA NO ES ESTA PÁGINA: es `/avisos/dueno` en bot/avisos.js, que le pregunta a Discord (o a la sesión) quién
// es y contesta 403 a cualquiera que no sea Dlx. Acá sólo se dibuja lo que el servidor manda. Sin cuenta, el botón de
// entrar; con otra cuenta, «esta página es del dueño» y nada más. Los ajustes pasan por la misma puerta
// (`/avisos/dueno/ajuste`), y el servidor valida cada valor antes de guardarlo.
import { Fragment, createContext, useContext, useEffect, useRef, useState } from 'react';
import { diaISO, hora, limpio, mult, num, siglaDe } from './liga.js';
import { Cara, DosToques, Ico, usePerfiles } from './piezas.jsx';
import { urlFondo } from './fondos.js';
import { pedirCrews, useCrews } from './crews.js';
import { AjEventosEstilo } from './dash_estilos.jsx';
import { useNumero } from './anima.js';
import { textoRol } from './roles.js';

// 📸 la dirección de una foto de tarjeta, para el CSS: sólo del bucket de la Liga (las caras y las que esperan revisión)
const urlFoto = (u) => (/^https:\/\/pub-[a-z0-9]+\.r2\.dev\/(fotos\/[a-z0-9-]+\/[\p{L}\p{N}_]+@[a-z]+|pendientes\/[a-f0-9]{24})\.(webp|jpg|png)$/u.test(String(u || ''))
  ? 'url("' + u + '")' : '');
// 🔒 su CSS viene con este pedazo y no con el paquete de todos (ver dashboard.css)
import ESTILO from './dashboard.css?inline';

const W = typeof window !== 'undefined' ? window : {};
const entrar = () => { if (W.urlLogin) W.location.href = W.urlLogin('o'); };
const corto = (dia) => Number(dia.slice(8, 10)) + '/' + Number(dia.slice(5, 7));
// los que se pueden elegir a mano (el servidor acepta de ×0,5 a ×5)
const FACTORES = [0.5, 1, 1.5, 2, 3, 5];
const DURACIONES = [['1 hora', 1], ['6 horas', 6], ['1 día', 24], ['3 días', 72], ['1 semana', 168]];
// 🗄️ la Lista vive en datos/ desde el 12/11/2026 (el Sheet quedó congelado, sheet/espejo_t1.py): se mira en el repo,
// una fila por línea. ✅ Decidir es «Para decidir», acá mismo. Las corridas del ciclo, en GitHub
const ATAJOS = [
  ['El mapa en vivo', '/mapa'],
  ['La Lista de Raperos', 'https://github.com/underraponline-lgtm/underlegends/blob/main/datos/t1_lista.json'],
  ['Las corridas del ciclo', 'https://github.com/underraponline-lgtm/underlegends/actions'],
  ['Cloudflare', 'https://dash.cloudflare.com'],
];

// lo que contesta la puerta: `{d}` con todo, o en qué estado quedó
function pedirDueno() {
  return fetch('/api/avisos/dueno', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    .then(async (r) => ({ r, j: await r.json().catch(() => ({})) }))
    .then(({ r, j }) => (r.status === 403 ? { no: true } : r.status === 401 ? { sinCuenta: true } : r.ok ? { d: j } : { error: j.error || String(r.status) }))
    .catch(() => ({ error: 'red' }));
}

async function ajustar(cual, valor, deshacer) {
  const r = await fetch('/api/avisos/dueno/ajuste', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(deshacer ? { cual, valor, deshacer: true } : { cual, valor }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : j.error || String(r.status));
  return { ajustes: j.ajustes || {}, hist: j.hist };
}

const avisoVigente = (aj) => (aj.aviso_web && Date.parse(aj.aviso_web.hasta) > Date.now() ? aj.aviso_web : null);

// ── 👥 LA SEMANA EN PERSONAS: LOS CINCO CUADROS (23/11/2026). Dlx: «¿puedes hacer más concisa la información? para ver
// cuántas personas diferentes han accedido a la página, cuántas han usado el bot, cuántas interactuaron»; de la maqueta
// eligió la A, «Cinco cuadros». Va arriba de Números: las personas distintas de la semana en grande y cinco cuadros, cada
// uno con su flecha contra la semana anterior y cinco semanas en barras. Las siete pestañas de antes quedan plegadas abajo
// («Más números»). Reemplaza a las cuatro cajas de «Esta semana», que contaban siete días corridos y sumaban las visitas
// de cada día (quien entraba toda la semana contaba siete veces). Los números salen de `_usoSemanas()` (bot/avisos.js):
// `abrieron` (navegadores distintos, sin robots; se cuenta desde el 23/11) y `hacen` (aplaudir, comentar, votar, apostar,
// seguir); «Jugaron» sale de las semanas de la Liga (`datos/semanas.json`), con `medirSemana()`
const DIA_SEM = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const enCursoSem = (w, hoy) => masDias(w.lunes, 7) > hoy;
function Barras5({ s, ultima }) {
  const hay = s.filter((x) => x != null);
  const tope = Math.max(1, ...hay);
  return (
    <span className="nc-b" role="img" aria-label={'Cinco semanas: ' + s.map((x) => (x == null ? 'sin dato' : num(x))).join(', ')}>
      {s.map((x, j) => <i key={j} className={(j === s.length - 1 ? ultima : '') + (x == null ? ' nada' : '')}
        style={x == null ? undefined : { height: Math.max(10, Math.round(100 * x / tope)) + '%' }} />)}
    </span>
  );
}
function Flecha({ d, largo }) {
  if (d == null) return null;
  return <small className={'nc-d ' + (d > 0 ? 'sube' : d < 0 ? 'baja' : '')}>{d > 0 ? '▲ ' : d < 0 ? '▼ ' : '= '}{num(Math.abs(d))}{largo || ''}</small>;
}
// 🧩 «INTERACTUARON», POR QUÉ (23/11/2026, Dlx: «dame detalles más específicos, interactuaron divídelos en más secciones,
// recuerda algunos están simulados»): una fila por tipo con las personas distintas, cuántas veces y la flecha contra la
// semana anterior, de la que más gente tuvo a la que menos. Los tipos son `HACEN` de bot/avisos.js: si se suma uno allá,
// va acá. Sólo lo de verdad: los comentarios simulados viven en el muro y nunca se guardan como de alguien
const TIPOS_HACEN = [
  ['aplaudieron', 'Aplaudieron', 'aplausos'], ['comentaron', 'Comentaron', 'comentarios'],
  ['votaron', 'Votaron en encuestas', 'votos'], ['pronosticaron', 'Dijeron quién gana', 'pronósticos'],
  ['apostaron', 'Apostaron', 'apuestas'], ['siguieron', 'Siguieron a alguien', 'seguidos'],
  ['personalizaron', 'Arreglaron su carta o perfil', 'cambios'], ['sorteo', 'Entraron al sorteo', 'entradas'],
];
// 🧾 QUÉ HACE LA GENTE Y DÓNDE (23/11/2026, Dlx: «make sure we have knowledge for every action»): de la tabla `acciones`
// del objeto (`accionesResumen()`), cada cosa que alguien hizo con su cuenta en la página y cada comando o botón de Discord,
// con sus personas distintas en 7 días. El nombre de cada una sale de acá; una que no está en la lista se ve con su código
const ACCION_NOMBRE = {
  'web:drop-abrir': 'Abrir un Drop', 'web:pase-dia': 'Abrir el Drop del día', 'web:drops': 'Mirar sus Drops', 'web:billetera': 'Mirar su billetera',
  'web:comentar': 'Comentar', 'web:felicitar': 'Aplaudir', 'web:votar': 'Votar en una encuesta', 'web:liga-votar': 'Decir quién gana una liga',
  'web:qg-votar-web': 'Decir quién gana una batalla', 'web:seguir': 'Seguir a un rapero', 'web:seguir-sv': 'Seguir a un servidor',
  'web:seguir-org': 'Seguir a una organización', 'web:liga-seguir': 'Seguir una liga', 'web:tienda': 'Mirar la Tienda',
  'web:tienda-accion': 'Comprar o canjear en la Tienda', 'web:tienda-arte': 'La Tienda (arte)', 'web:perfil-mio': 'Editar su perfil',
  'web:mi-foto': 'Cambiar su foto', 'web:mi-fondo': 'Su fondo', 'web:fondo': 'Subir un fondo', 'web:foto-carta': 'Subir la foto de una carta',
  'web:mi-foto-carta': 'La foto de sus cartas', 'web:mi-servidor': 'Elegir su servidor', 'web:crew': 'Crear o manejar una crew', 'web:crew-mia': 'Mirar su crew',
  'web:racha': 'Su racha', 'web:semanal': 'El premio de la semana', 'web:bandeja': 'Su bandeja', 'web:historias': 'Historias vistas',
  'web:muro-mio': 'Sus publicaciones', 'web:nuevo': 'Misiones de nuevos', 'web:ref': 'Invita y gana', 'web:libre-crear': 'Crear una batalla libre',
  'web:libres': 'Mirar las batallas libres', 'web:libre-resultado': 'Cargar una batalla libre', 'web:libre-cancelar': 'Cancelar una batalla libre',
  'web:pedido': 'Hacer un pedido', 'web:mis-pedidos': 'Sus pedidos', 'web:reportar': 'Reportar', 'web:comentario-reportar': 'Reportar un comentario',
  'web:comentario-borrar': 'Borrar un comentario', 'web:video-reportar': 'Reportar un video', 'web:vincular': 'Vincular los avisos',
  'web:precio': 'Poner precio a una cabeza', 'web:pase-vivo': 'Mirar una llave en vivo', 'web:promo-vio': 'Ver una promo',
  'web:promo-extender': 'Extender una promo', 'web:panel-socio': 'El panel del socio', 'web:mods': 'Mods', 'web:mis-ligas': 'Sus ligas',
  'web:mis-servidores': 'Gente en sus servidores', 'web:calificar': 'Calificar un evento', 'web:cm-mio': 'Sus comentarios', 'web:mis-videos': 'Sus videos',
  'btn:dd': 'Abrir un Drop', 'btn:c': 'Elegir carta en /card', 'btn:l': 'Elegir carta de liga', 'btn:s': 'El menú de /card', 'btn:qg': '¿Quién gana?',
  'btn:ap': 'Apostar', 'mod:monto': 'Apostar (el monto)', 'btn:vx': 'Estadísticas del VS', 'btn:vp': 'Perfiles del VS', 'btn:ve': 'El VS',
  'btn:ntf': 'Elegir sus avisos', 'btn:cfg': 'Configurar avisos del servidor', 'btn:eq': 'Equipar', 'btn:cw': 'Su crew', 'btn:apo': 'Su apodo',
  'btn:su': '/setup del socio', 'btn:ar': 'El anti-raid', 'btn:baja': 'Borrar sus datos',
};
const nombreAccion = (q) => ACCION_NOMBRE[q] || (q.startsWith('cmd:') ? '/' + q.slice(4) : q);
const DROP_TIPO = { pase: 'Del Pase', star: 'Star Drops', cofre: 'Cofres', nido: 'Nidos', pdia: 'El Drop del día', dia: 'La barra del día',
  ref: 'Invita y gana', refj: 'Invita y gana', nuevo: 'Misiones de nuevos', nota: 'La nota', mira: 'Mirar en vivo', de: 'De regalo' };
const RAREZA_DROP = ['Maqueta', 'Mixtape', 'Vinilo', 'Disco de Oro', 'Micrófono de Oro'];
function ListaAcciones({ t, xs }) {
  if (!xs.length) return <div className="qh-col"><h4 className="nc-t">{t}</h4><p className="pronto-p">Nada en 7 días.</p></div>;
  const tope = Math.max(1, ...xs.map((x) => x.p));
  return (
    <div className="qh-col">
      <h4 className="nc-t">{t}</h4>
      <ul className="qh-l">{xs.map((x) => (
        <li key={x.que}>
          <span className="qh-n">{nombreAccion(x.que)}</span>
          <span className="nc-hz-b" aria-hidden="true"><i style={{ width: (100 * x.p / tope).toFixed(1) + '%' }} /></span>
          <b>{num(x.p)}</b>
          <Flecha d={x.antes == null ? null : x.p - x.antes} />
        </li>
      ))}</ul>
    </div>
  );
}
function QueHace({ a }) {
  if (!a) return <p className="pronto-p">Todavía no llegó: falta desplegar el Worker.</p>;
  const web = a.filas.filter((f) => f.por === 'web'), bot = a.filas.filter((f) => f.por === 'bot');
  return (
    <div className="qh">
      <p className="db-tx"><b>{num(a.personas)}</b> personas hicieron algo en 7 días: <b>{num(a.web)}</b> en la página con su cuenta y <b>{num(a.bot)}</b> en
        Discord. Cada fila cuenta personas distintas.{a.desde ? ' Se anota desde el ' + corto(a.desde) + '.' : ''}</p>
      <div className="qh-cols"><ListaAcciones t="En la página" xs={web} /><ListaAcciones t="En Discord" xs={bot} /></div>
    </div>
  );
}
function DropsNumeros({ r }) {
  if (!r) return <p className="pronto-p">Todavía no llegó: falta desplegar el Worker.</p>;
  const s = r.semana, b = r.antes;
  const tipos = Object.entries(s.por).sort((x, y) => y[1].dados + y[1].abiertos - x[1].dados - x[1].abiertos);
  const cajas = [['Dados', s.dados, b.dados], ['Abiertos', s.abiertos, b.abiertos], ['Personas que abrieron', s.personas, b.personas]];
  return (
    <div className="qh">
      <div className="dz-nums">{cajas.map(([t, v, x]) => (
        <div key={t} className="dz-num"><span>{t.toLowerCase()}</span><b>{num(v)}</b><Flecha d={v - x} largo=" contra los 7 de antes" /></div>
      ))}
        <div className="dz-num"><span>esperando, cerrados</span><b>{num(r.cerrados)}</b><small>de {num(r.con_cerrados)} personas</small></div>
      </div>
      <p className="db-tx"><b>Dónde se abrieron:</b> {num(r.donde.web)} personas en la página y {num(r.donde.discord)} en Discord
        ({num(r.donde.mira_discord)} miraron <code>/drops</code>).{r.donde.desde ? ' El lugar se anota desde el ' + corto(r.donde.desde) + '.' : ''}</p>
      <p className="db-tx"><b>Lo que salió:</b> {RAREZA_DROP.map((n, j) => n + ' ' + num(s.rarezas[j] || 0)).join(' · ')}</p>
      {tipos.length ? (
        <ul className="qh-l qh-tipos">{tipos.map(([k, v]) => (
          <li key={k}><span className="qh-n">{DROP_TIPO[k] || k}</span><small>{num(v.dados)} dados</small><b>{num(v.abiertos)}</b><small>abiertos</small></li>
        ))}</ul>
      ) : <p className="pronto-p">Ningún drop en 7 días.</p>}
    </div>
  );
}
function HacenPor({ w, ant }) {
  const hp = w.hacen_por;
  if (!hp) return null;
  const hb = ant && ant.hacen_por;
  const filas = TIPOS_HACEN.map(([k, t, u]) => {
    const x = hp[k] || { p: 0, n: 0 };
    return { k, t, u, x, d: hb && hb[k] ? x.p - hb[k].p : null };
  }).sort((a, b) => b.x.p - a.x.p || b.x.n - a.x.n);
  const tope = Math.max(1, ...filas.map((f) => f.x.p));
  return (
    <div className="nc-hz">
      <h4 className="nc-t">Interactuaron, por qué · {num(w.hacen || 0)} {w.hacen === 1 ? 'persona' : 'personas'}</h4>
      <ul>{filas.map((f) => (
        <li key={f.k} className={f.x.p ? '' : 'cero'}>
          <span className="nc-hz-t">{f.t}</span>
          <span className="nc-hz-b" aria-hidden="true"><i style={{ width: (100 * f.x.p / tope).toFixed(1) + '%' }} /></span>
          <b>{num(f.x.p)}</b>
          <small>{f.x.n ? num(f.x.n) + ' ' + f.u : '—'}{f.x.parcial ? ' · incompleto' : ''}</small>
          <Flecha d={f.d} />
        </li>
      ))}</ul>
      <p className="nc-p">Personas distintas en cada fila: una misma persona puede estar en varias. Sólo lo de verdad: los comentarios
        simulados no cuentan.{hp.aplaudieron && hp.aplaudieron.parcial ? ' Los aplausos se borran a los 30 días: esta semana los tiene de menos.' : ''} De
        lo que eligieron para su carta o su perfil cuenta el último cambio.</p>
    </div>
  );
}
// 📚 HASTA HOY, ACUMULADO (23/11/2026, Dlx: «un histórico con el número actual de hasta ahora: cuántos entraron con Discord
// a su cuenta, verificados, cuántas personas diferentes abrieron drops… info acumulada e histórica»). Del objeto
// (`historico()`): la primera vez de cada uno en la página, en el bot, interactuando y abriendo un drop. De los datos del
// repo: los verificados (`verificados_desde.json`, Miembro de DRA) y quién jugó en la T1 (los que debutaron cada semana).
// Cada cuadro dice desde cuándo se cuenta y cuántos se sumaron en 7 días
let verifP = null;
const pedirVerif = () => (verifP = verifP || Promise.all(['verificados_desde.json', 'verificados.json'].map((f) => fetch(RAW + f, { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null))).then(([desde, hoy]) => (desde ? Object.assign({}, desde, { hoy }) : null)));
// 🙈 Dlx no cuenta (23/11/2026: «I don't want my account to be counted in this or the bots»). Los bots con el rol Miembro
// los saca bot/verificados.py desde la próxima vuelta del ciclo; acá, por las dudas, también los dos de la Liga
const NO_CUENTAN = new Set(['739338101603696681', '1550026808404217926', '996162009412423782']);
function HastaHoy({ h, S }) {
  const [v, setV] = useState(null);
  useEffect(() => { let vivo = true; pedirVerif().then((x) => { if (vivo) setV(x || false); }); return () => { vivo = false; }; }, []);
  const hace7 = masDias(hoyET(), -7);
  // 🔑 «VERIFICADOS» ERA EL ACUMULADO Y SE LEÍA COMO OTRA COSA (Dlx, 23/11/2026, con 3.000: «so there are 3000 who entered
  // with their discord account?»). Era todos los que tuvieron el rol alguna vez, también los 218 que ya no lo tienen. El
  // número grande es el de HOY (`verificados.json`); el acumulado queda dicho abajo
  const ver = v && v.ids ? Object.entries(v.ids).filter(([id]) => !NO_CUENTAN.has(id)).map(([, d]) => d) : null;
  const verHoy = v && v.hoy && Array.isArray(v.hoy.ids) ? v.hoy.ids.filter((id) => !NO_CUENTAN.has(String(id))).length : null;
  const ss = (S && S.semanas) || [];
  const jugaron = ss.reduce((t, w) => t + ((w.debut || []).length), 0);
  const ultima = ss.length ? ss[ss.length - 1] : null;
  const cajas = [
    { t: 'Verificados hoy', v: verHoy != null ? verHoy : ver ? ver.length : null, n: ver ? ver.filter((x) => x !== 'pre' && x > hace7).length : null,
      p: 'con el rol Miembro de DRA' + (ver && verHoy != null ? ' · ' + num(ver.length) + ' lo tuvieron alguna vez' + (v.pre ? ' desde el ' + corto(v.pre) : '') : '') },
    { t: 'Entraron con su cuenta', v: h && h.web.n, n: h && h.web.nuevos, p: h && h.web.desde ? 'a la página, alguna vez · se cuenta desde el ' + corto(h.web.desde) : 'a la página, alguna vez' },
    { t: 'Usaron el bot', v: h && h.bot.n, n: h && h.bot.nuevos, p: h && h.bot.desde ? 'alguna vez · desde el ' + corto(h.bot.desde) : 'alguna vez' },
    { t: 'Jugaron en la T1', v: ss.length ? jugaron : null, n: ultima ? (ultima.debut || []).length : null, nTxt: ' esta semana',
      p: 'personas distintas que jugaron al menos un evento' },
    { t: 'Interactuaron', v: h && h.hace.n, n: h && h.hace.nuevos, p: h && h.hace.desde ? 'alguna vez · desde el ' + corto(h.hace.desde) : 'alguna vez' },
    { t: 'Abrieron un Drop', v: h && h.drops.personas, n: h && h.drops.nuevos,
      p: h ? num(h.drops.abiertos) + ' drops abiertos de ' + num(h.drops.dados) + ' dados' : '' },
  ];
  return (
    <div className="nc-hh">
      <h4 className="dz-h">Hasta hoy<small>acumulado · personas distintas</small></h4>
      <div className="nc-hh-l">{cajas.map((c) => (
        <div key={c.t} className="nc-c">
          <span className="nc-t">{c.t}</span>
          <b className={c.v == null ? 'nc-nada' : ''}>{c.v == null ? '—' : num(c.v)}</b>
          {c.n ? <small className="nc-d sube">+ {num(c.n)}{c.nTxt || ' en 7 días'}</small> : null}
          {c.p ? <small className="nc-p">{c.p}</small> : null}
        </div>
      ))}</div>
      {!h ? <p className="nc-p">Lo de la página, el bot y los drops llega cuando se despliegue el Worker.</p> : null}
    </div>
  );
}
// 👀 AHORA Y QUIÉN (23/11/2026). Dlx: «who is on the website right now, at what time there are more people, which staffs
// are more active, who entered the website with and without their account», y a los nombres, «Names for everyone» (lo dice
// /privacidad desde ese día). SÓLO DLX: `/avisos/dueno-ahora` contesta 403 a cualquier otro, y sin respuesta (el Worker sin
// desplegar, otra cuenta) no se dibuja. Lo de «ahora» se pide cada minuto con la pestaña a la vista; lo demás lo guarda el
// objeto 10 minutos (`numerosAhora()` en bot/avisos.js). Con cuenta son personas; sin cuenta, pestañas: no se sabe quién es
const pedirAhora = () => fetch('/api/avisos/dueno-ahora', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null);
const SECC_AQUI = { inicio: 'el Inicio', perfil: 'un perfil', servidor: 'un servidor', ranking: 'el Ranking', tarjetas: 'Tarjetas',
  ligas: 'Ligas', pase: 'el Pase', tienda: 'la Tienda', eventos: 'Eventos', publicaciones: 'Publicaciones', socios: 'Socios', guia: 'la Guía',
  cuenta: 'Tu cuenta', ajustes: 'Ajustes', cambios: 'Lo nuevo', llave: 'una llave', crew: 'una crew', crews: 'Crews', pais: 'un país',
  salon: 'el Salón', competencias: 'Competencias', inventario: 'el Inventario', invitar: 'Invita y gana', mods: 'Mods', dashboard: 'el Dashboard',
  socio: 'el panel del socio', misiones: 'Misiones', global: 'el Ranking Global' };
const enSecc = (s) => SECC_AQUI[s] || s || '—';
const hh = (h) => (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');
const quienTxt = (x) => limpio(x.n || x.dn || '') || 'Cuenta sin nombre';
// ⏱️ ¿SE QUEDAN? (23/11/2026, Dlx: «dar más estadísticas si es que los usuarios se quedan enganchados, cuánto tiempo en la
// página se quedan usualmente»). De `_enganche()` en bot/avisos.js, 7 días: el tiempo típico de una visita (la mediana: el
// promedio lo tiran para arriba las pestañas que quedan abiertas), cuántos se van en menos de un minuto, cuántas secciones
// abren, si vuelven, y con cuenta cuántos días entra cada uno y quién pasó más tiempo. Sin datos todavía, no se dibuja
const durTxt = (ms) => (ms == null ? '—' : ms < 60000 ? 'menos de 1 min' : ms < 3600000 ? Math.round(ms / 60000) + ' min'
  : Math.floor(ms / 3600000) + ' h ' + Math.round((ms % 3600000) / 60000) + ' min');
const GRUPO_TXT = { '<1': 'menos de 1 min', '1-5': '1 a 5 min', '5-15': '5 a 15 min', '15-30': '15 a 30 min', '30-60': '30 min a 1 h', '60+': 'más de 1 h' };
const VUELVE_TXT = [['1', 'vinieron ayer'], ['2-7', 'hace 2 a 7 días'], ['8-30', 'hace 8 a 30 días'], ['30+', 'hace más de un mes'], ['nuevo', 'la primera vez']];
function SeQuedan({ e, liga }) {
  if (!e || !e.pestanas) return null;
  const vTot = Object.values(e.vuelven || {}).reduce((s, n) => s + n, 0);
  const vVuelven = vTot - ((e.vuelven || {}).nuevo || 0);
  const gTope = Math.max(1, ...(e.grupos || []).map((g) => g.n));
  const fTot = (e.frec || []).reduce((s, x) => s + x.n, 0);
  const cuadros = [
    { t: 'Una visita dura', v: durTxt(e.mediana), p: 'lo típico (la mitad dura menos) · con cuenta ' + durTxt(e.mediana_con) + ', sin cuenta ' + durTxt(e.mediana_sin) },
    { t: 'Se van enseguida', v: e.rebote == null ? '—' : e.rebote + ' %', p: 'de las visitas duran menos de un minuto' },
    { t: 'Secciones por visita', v: e.secciones == null ? '—' : String(e.secciones).replace('.', ','), p: 'cuántas partes de la página abren' },
    { t: 'Vuelven', v: vTot ? Math.round((100 * vVuelven) / vTot) + ' %' : '—', p: vTot ? 'de los que entraron ya habían venido antes' : 'se empieza a contar con la próxima visita' },
    { t: 'Volvieron esta semana', v: e.pasada ? Math.round((100 * e.volvieron) / e.pasada) + ' %' : '—', p: e.pasada ? num(e.volvieron) + ' de los ' + num(e.pasada) + ' que entraron con su cuenta la semana pasada' : 'con cuenta, contra la semana pasada' },
  ];
  return (
    <div className="aq-sq">
      <h4 className="dz-h">¿Se quedan?<small>7 días · {num(e.pestanas)} visitas medidas{e.desde ? ' desde el ' + corto(e.desde) : ''}</small></h4>
      <div className="nc-l">{cuadros.map((c) => (
        <div key={c.t} className="nc-c"><span className="nc-t">{c.t}</span><b className={c.v === '—' ? 'nc-nada' : 'aq-sq-v'}>{c.v}</b><small className="nc-p">{c.p}</small></div>
      ))}</div>
      <div className="aq-cols">
        <div className="nc-c">
          <span className="nc-t">Cuánto dura cada visita</span>
          <ul className="aq-gr">{(e.grupos || []).map((g) => (
            <li key={g.g}><span>{GRUPO_TXT[g.g] || g.g}</span><i><em style={{ width: Math.round((g.n / gTope) * 100) + '%' }} /></i><b>{num(g.n)}</b></li>
          ))}</ul>
        </div>
        <div className="nc-c">
          <span className="nc-t">Cada cuánto vuelven</span>
          {vTot ? <ul className="aq-gr">{VUELVE_TXT.map(([b, t]) => (
            <li key={b}><span>{t}</span><i><em style={{ width: Math.round((((e.vuelven || {})[b] || 0) / Math.max(1, ...Object.values(e.vuelven || {}))) * 100) + '%' }} /></i><b>{num((e.vuelven || {})[b] || 0)}</b></li>
          ))}</ul> : <small className="nc-p">Se empieza a contar con la próxima visita de cada navegador.</small>}
          {fTot ? <small className="nc-p">Con cuenta, días que entraron esta semana: {(e.frec || []).map((x) => num(x.n) + ' ' + (x.g === '1' ? 'un día' : x.g === '7' ? 'todos los días' : 'de ' + x.g.replace('-', ' a ') + ' días')).join(' · ')}.</small> : null}
        </div>
      </div>
      {(e.mas_tiempo || []).length ? (
        <div className="nc-c">
          <span className="nc-t">Los que más tiempo pasaron</span>
          <ol className="aq-top">{e.mas_tiempo.map((x) => (
            <li key={x.quien}><b>{x.k ? <a href={'#/r/' + encodeURIComponent(x.k)}>{quienTxt(x)}</a> : quienTxt(x)}</b><span>{durTxt(x.ms)} · {x.pest} {x.pest === 1 ? 'visita' : 'visitas'}</span></li>
          ))}</ol>
        </div>
      ) : null}
    </div>
  );
}
function AhoraYQuien({ liga }) {
  const [a, setA] = useState(null);
  const [lista, setLista] = useState('entraron');
  useEffect(() => {
    let vivo = true;
    const ir = () => { if (document.visibilityState === 'visible') pedirAhora().then((x) => { if (vivo) setA(x || false); }); };
    ir();
    const t = setInterval(ir, 60000);
    document.addEventListener('visibilitychange', ir);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', ir); };
  }, []);
  if (!a || !a.ok) return null;
  const ah = a.ahora || { con: [], sin: 0, secc: {} };
  const total = ah.con.length + (ah.sin || 0);
  const horas = Array.from({ length: 24 }, (_, h) => (a.horas || []).find((x) => x.h === h) || { h, n: 0, nc: 0 });
  const dias = Math.max(1, a.horas_dias || 1);
  const tope = Math.max(1, ...horas.map((x) => x.n));
  const pico = horas.reduce((m, x) => (x.n > m.n ? x : m), horas[0]);
  const persona = (x) => (x.k ? <a href={'#/r/' + encodeURIComponent(x.k)}>{quienTxt(x)}</a> : <span>{quienTxt(x)}</span>);
  const secc = Object.entries(ah.secc || {}).sort((p, q) => q[1] - p[1]).slice(0, 4);
  return (
    <section className="nc aq">
      <div className="nc-cab"><h3 className="dz-h">Ahora y quién<small>con nombre · sólo lo ves tú · hora del este</small></h3></div>
      <div className="nc-hero">
        <div>
          <span className="nc-t">En la página ahora</span>
          <p className="nc-v"><b>{num(total)}</b><span className="nc-d">{num(ah.con.length)} con su cuenta · {num(ah.sin || 0)} sin cuenta</span></p>
          <small className="nc-p">{total ? 'Avisaron en los últimos ' + (a.vivo_min || 6) + ' minutos' + (secc.length ? ' · ' + secc.map(([s, n]) => n + ' en ' + enSecc(s)).join(', ') : '') + '.'
            : 'Nadie en los últimos ' + (a.vivo_min || 6) + ' minutos.'}</small>
        </div>
      </div>
      {ah.con.length ? (
        <ul className="aq-ya">{ah.con.map((x) => (
          <li key={x.quien}>
            <Cara liga={liga} k={x.k || ''} nombre={quienTxt(x)} cls="aq-av" lazy />
            <span className="aq-q"><b>{persona(x)}</b><small>en {enSecc(x.s)} · lleva {Math.max(1, Math.round((x.t - x.ini) / 60000))} min{x.pest > 1 ? ' · ' + x.pest + ' pestañas' : ''}{x.dn && x.n && x.dn !== x.n ? ' · ' + x.dn + ' en Discord' : ''}</small></span>
          </li>
        ))}</ul>
      ) : null}
      <div className="aq-cols">
        <div className="nc-c aq-horas">
          <span className="nc-t">A qué hora entra la gente</span>
          {a.horas_dias ? <>
            <div className="aq-hb" role="img" aria-label={'Pestañas por hora; la más fuerte, de ' + hh(pico.h) + ' a ' + hh((pico.h + 1) % 24)}>{horas.map((x) => (
              <i key={x.h} title={hh(x.h) + ': ' + (Math.round((x.n / dias) * 10) / 10) + ' pestañas por día (' + (Math.round((x.nc / dias) * 10) / 10) + ' con cuenta)'}
                style={{ height: Math.max(2, Math.round((x.n / tope) * 100)) + '%' }} className={x.h === pico.h ? 'on' : ''}>
                <em style={{ height: (x.n ? Math.round((x.nc / x.n) * 100) : 0) + '%' }} /></i>
            ))}</div>
            <div className="aq-fechas"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>
            <small className="nc-p">La más fuerte, de <b>{hh(pico.h)} a {hh((pico.h + 1) % 24)}</b>: {Math.round((pico.n / dias) * 10) / 10} pestañas por día. Lo oscuro, con cuenta. {a.horas_dias} {a.horas_dias === 1 ? 'día' : 'días'} medidos.</small>
          </> : <small className="nc-p">Se empieza a medir con el primer aviso de una pestaña.</small>}
        </div>
        <div className="nc-c aq-dias">
          <span className="nc-t">Con y sin cuenta, por día</span>
          {(a.por_dia || []).length ? (
            <ul className="aq-dl">{a.por_dia.slice(-7).reverse().map((x) => (
              <li key={x.dia}><span>{corto(x.dia)}</span><b>{num(x.con)}</b><small>con cuenta</small><b>{num(x.sin)}</b><small>pestañas sin cuenta</small></li>
            ))}</ul>
          ) : <small className="nc-p">Todavía sin días medidos.</small>}
        </div>
      </div>
      <SeQuedan e={a.enganche} liga={liga} />
      <div className="aq-tabs" role="tablist" aria-label="Listas">
        <button type="button" role="tab" aria-selected={lista === 'entraron'} onClick={() => setLista('entraron')}>Entraron con su cuenta · {num(a.entraron_n || 0)}</button>
        <button type="button" role="tab" aria-selected={lista === 'staff'} onClick={() => setLista('staff')}>El staff · {num(a.staff_activos || 0)} de {num(a.staff_n || 0)} activos</button>
      </div>
      {lista === 'entraron' ? (
        <ul className="aq-l">{(a.entraron || []).map((x) => (
          <li key={x.quien}>
            <span className="aq-q"><b>{persona(x)}</b><small>{x.visto ? 'visto ' + hace(x.visto) : 'último día ' + corto(x.ult)}</small></span>
            <span className="aq-n"><b>{x.dias}</b><small>{x.dias === 1 ? 'día' : 'días'} en la página</small></span>
            <span className="aq-n"><b>{x.bot}</b><small>en el bot</small></span>
            <span className="aq-n"><b>{x.acc}</b><small>acciones</small></span>
          </li>
        ))}{!(a.entraron || []).length ? <li className="cero">Nadie en los últimos 7 días.</li> : null}</ul>
      ) : (
        <ul className="aq-l">{(a.staff || []).map((x) => (
          <li key={x.quien} className={x.punt ? '' : 'cero'}>
            <span className="aq-q"><b>{persona(x)}</b><small>{x.roles.map(textoRol).join(' · ')}{x.visto ? ' · visto ' + hace(x.visto) : ''}</small></span>
            <span className="aq-n"><b>{x.corr}</b><small>correcciones</small></span>
            <span className="aq-n"><b>{x.web}</b><small>días en la página</small></span>
            <span className="aq-n"><b>{x.bot}</b><small>en el bot</small></span>
          </li>
        ))}</ul>
      )}
      <p className="nc-p">7 días. Las correcciones son lo que hizo con Mods o desde el panel de su servidor; «visto», la última vez que tuvo la página abierta. Tu cuenta y los bots no cuentan.</p>
    </section>
  );
}

function CincoCuadros({ uso, S, h }) {
  const [i0, setI] = useState(null);
  const us = uso || [];
  const ss = (S && S.semanas) || [];
  const hoy = hoyET();
  if (!us.length) return <p className="pronto-p">Midiendo…</p>;
  // de entrada, la última semana ENTERA: la de ahora va por la mitad (con › se ve igual, contra los mismos días)
  const def = us.length > 1 && enCursoSem(us[us.length - 1], hoy) ? us.length - 2 : us.length - 1;
  const i = i0 === null ? def : Math.min(Math.max(i0, 0), us.length - 1);
  const w = us[i], wb = i > 0 ? us[i - 1] : null;
  const curso = enCursoSem(w, hoy);
  const dias = curso ? Math.min(7, Math.round((Date.parse(hoy + 'T12:00:00Z') - Date.parse(w.lunes + 'T12:00:00Z')) / 864e5) + 1) : 7;
  const k = dias < 7 ? dias : 0;
  // la anterior, entera o en sus primeros días («a igual día», como Comparar semanas)
  const ant = wb ? (k ? wb.k || null : wb) : null;
  const jIdx = (lunes) => ss.findIndex((x) => x.lunes === lunes);
  const jug = jIdx(w.lunes) >= 0 ? medirSemana(ss, jIdx(w.lunes), k) : null;
  const jugB = wb && jIdx(wb.lunes) >= 0 ? medirSemana(ss, jIdx(wb.lunes), k) : null;
  const dif = (a, b) => (a != null && b != null ? a - b : null);
  const cinco = us.slice(Math.max(0, i - 4), i + 1);
  while (cinco.length < 5) cinco.unshift(null);
  const serie = (f) => cinco.map((x) => (x ? f(x) : null));
  const color = (d) => (d != null && d < 0 ? 'baja' : 'on');
  const dP = dif(w.personas, ant && ant.personas);
  const cuadros = [
    { t: 'Abrieron la página', v: w.abrieron, d: dif(w.abrieron, ant && ant.abrieron), s: serie((x) => x.abrieron),
      p: w.abrieron == null ? 'todavía no se contaba' : w.abrieron_desde ? 'celus o compus distintos, desde el ' + corto(w.abrieron_desde)
        : 'celus o compus distintos, sin robots' },
    { t: 'Entraron con su cuenta', v: w.web, d: dif(w.web, ant && ant.web), s: serie((x) => x.web) },
    { t: 'Interactuaron', v: w.hacen, d: dif(w.hacen, ant && ant.hacen), s: serie((x) => x.hacen),
      p: w.hacen == null ? 'ya no está guardado' : 'hicieron algo en la página: abajo, qué' },
    { t: 'Usaron el bot', v: w.bot, d: dif(w.bot, ant && ant.bot), s: serie((x) => x.bot) },
    { t: 'Jugaron un evento', v: jug ? jug.raperos : null, d: dif(jug && jug.raperos, jugB && jugB.raperos),
      s: serie((x) => { const j = jIdx(x.lunes); return j >= 0 ? ss[j].raperos : null; }),
      p: jug && jug.debut ? num(jug.debut) + ' por primera vez' : null },
  ];
  // 🗣️ lo que dice la semana, sólo con hechos: cuánta gente más o menos, y los eventos que hubo
  const contra = k ? 'los mismos días de la anterior' : 'la semana anterior';
  const frase = [];
  if (dP != null) frase.push(dP === 0 ? 'En el bot y la página, las mismas personas que ' + contra
    : 'En el bot y la página, ' + num(Math.abs(dP)) + (Math.abs(dP) === 1 ? ' persona ' : ' personas ') + (dP > 0 ? 'más' : 'menos') + ' que ' + contra);
  if (jug && jugB) {
    const dj = jug.raperos - jugB.raperos;
    frase.push((frase.length ? 'jugaron ' : 'Jugaron ') + (dj === 0 ? 'los mismos' : num(Math.abs(dj)) + (dj > 0 ? ' más' : ' menos'))
      + ', con ' + num(jug.eventos) + (jug.eventos === 1 ? ' evento' : ' eventos') + ' contra ' + num(jugB.eventos));
  }
  return (
    <section className="nc" id="nu-uso" aria-label="La semana en personas">
      <div className="nc-cab">
        <h3 className="dz-h">La semana en personas<small>cada persona cuenta una vez</small></h3>
        <div className="nc-sem">
          <button type="button" className="nc-fl" aria-label="Semana anterior" disabled={i === 0} onClick={() => setI(i - 1)}>‹</button>
          <span>{rangoSem(w.lunes)}{curso ? ' · va por el ' + DIA_SEM[dias - 1] : ''}</span>
          <button type="button" className="nc-fl" aria-label="Semana siguiente" disabled={i === us.length - 1} onClick={() => setI(i + 1)}>›</button>
        </div>
      </div>
      <div className="nc-hero">
        <div>
          <span className="nc-t">Personas distintas en la Liga</span>
          <p className="nc-v"><b>{w.personas == null ? '—' : num(w.personas)}</b><Flecha d={dP} largo={' contra ' + contra} /></p>
          <small className="nc-p">{w.personas == null ? 'Esa semana ya no está guardada (35 días por persona).' : 'Usaron el bot o la página con su cuenta.'}</small>
        </div>
        <Barras5 s={serie((x) => x.personas)} ultima={color(dP)} />
      </div>
      <div className="nc-l">{cuadros.map((c) => (
        <div key={c.t} className="nc-c">
          <span className="nc-t">{c.t}</span>
          <b className={c.v == null ? 'nc-nada' : ''}>{c.v == null ? '—' : num(c.v)}</b>
          <Flecha d={c.d} />
          {c.p ? <small className="nc-p">{c.p}</small> : null}
          <Barras5 s={c.s} ultima={color(c.d)} />
        </div>
      ))}</div>
      <HacenPor w={w} ant={ant} />
      {frase.length ? <p className="nc-f"><b>Lo que dice la semana:</b> {frase.join('; ')}.</p> : null}
      <HastaHoy h={h} S={S} />
    </section>
  );
}

// 🔗 DE QUÉ LINK LLEGARON (21/11/2026, el plan de alcance): un link con `?de=urbanstreet` (o el canal que sea) cuenta la
// visita nueva de ese canal (`visita()` de bot/avisos.js). Sólo números: nunca quién. Sin ningún link así, no se dibuja
function Llegadas({ l }) {
  return (
    <div className="dz-nums">{l.map((x) => (
      <div key={x.de} className="dz-num"><span>{x.de}</span><b>{num(x.n || 0)}</b><small>visitas nuevas</small></div>
    ))}</div>
  );
}

// día por día, las tres cosas en barras: el alto es contra el máximo de cada serie, así una no aplasta a las otras
function Dias({ dias }) {
  const tope = (k) => Math.max(1, ...dias.map((d) => d[k] || 0));
  const series = [['bot', 'Bot', 'var(--verde)'], ['web', 'Con su cuenta', 'var(--magenta)'], ['visitas', 'Abrieron la página', '#A5A5A0']];
  return (
    <div className="db-dias">
      {series.map(([k, t, c]) => (
        <div key={k} className="db-serie">
          <span className="db-t">{t}</span>
          <div className="db-barras">{dias.map((d) => (
            <i key={d.dia} title={corto(d.dia) + ' · ' + (d[k] || 0)}><u style={{ height: (100 * (d[k] || 0) / tope(k)).toFixed(1) + '%', background: c }} /></i>
          ))}</div>
          <em>{num(dias[dias.length - 1][k] || 0)} hoy</em>
        </div>
      ))}
      <div className="db-fechas"><span>{corto(dias[0].dia)}</span><span>{corto(dias[dias.length - 1].dia)}</span></div>
    </div>
  );
}

const hace = (t) => {
  if (!t) return '—';
  const m = Math.round((Date.now() - (typeof t === 'number' ? t : Date.parse(t))) / 60000);
  return m < 1 ? 'recién' : m < 60 ? 'hace ' + m + ' min' : m < 48 * 60 ? 'hace ' + Math.round(m / 60) + ' h' : 'hace ' + Math.round(m / 1440) + ' días';
};

// 🐞 LO QUE SE ROMPIÓ EN LA PÁGINA (Dlx, 19/10/2026: «ok»). Lo manda web/src/errores.js: en qué parte, el mensaje y dónde
// del código, nunca quién. «inicio» es la página entera (cayó a la de respaldo); «global» y «promesa», lo que no agarró
// ninguna sección
function ErroresPagina({ e }) {
  if (!(e || []).length) return <p className="pronto-p">Ningún error en los últimos 7 días.</p>;
  return (
    <div className="db-aj">
      <ul className="db-corr">{e.map((x) => (
        <li key={x.donde + x.msg}><b>{x.donde}</b><span>{x.msg}</span>
          <small>{num(x.n)} {x.n === 1 ? 'vez' : 'veces'} · {x.dias === 1 ? 'un día' : x.dias + ' días'} · el último {hace(x.ultimo)}
            {x.f ? ' · ' + x.f : ''}{x.tipo ? ' · ' + x.tipo : ''}</small></li>
      ))}</ul>
      <p className="db-tx">Cada error una vez por sesión de cada navegador: «12 veces» son 12 visitas que lo vieron. El lugar del código es del archivo ya construido (<code>inicio/…js:línea:columna</code>).</p>
    </div>
  );
}

function Sistema({ s, sesiones }) {
  const d = (s.disparador || {}).ultimo || {};
  const filas = [
    ['El vigía', s.ok ? 'anda · ' + hace(s.vigia) : '⚠️ no contesta · ' + hace(s.vigia)],
    ['El ciclo', d.t ? (d.ok ? 'disparado ' : '⚠️ falló ') + hace(d.t) : '—'],
    ['Dispositivos con la campana', num(s.suscripciones || 0)],
    ['Avisos en 24 h', num((s.ultimas_24h || {}).avisos || 0) + ' · ' + num((s.ultimas_24h || {}).enviados || 0) + ' enviados'],
    ['Sesiones abiertas', num(sesiones || 0) + ' personas'],
    ['Último error', s.ultimo_error ? s.ultimo_error.error + ' · ' + hace(s.ultimo_error.t) : 'ninguno'],
  ];
  return <dl className="db-sis">{filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

// ── ▶️ las corridas del ciclo, y correrlo ahora (05/10/2026) ───────────────────────────────────────────────────────
// Esa tarde una corrida estuvo 15 minutos «en cola» en GitHub sin que nada lo dijera, y GitHub la canceló. Las cuatro
// últimas las trae la puerta (`corridasCiclo()` en bot/avisos.js, con el token del Worker); correrlo es el mismo
// `workflow_dispatch` que larga el cron cada media hora, como mucho una vez cada 10 minutos (`cicloAMano()`).
const ESTADO_CORRIDA = { queued: '⏳ en cola', waiting: '⏳ esperando', pending: '⏳ en cola', requested: '⏳ pedida', in_progress: '▶️ corriendo' };
// ⚠️ las otras conclusiones de GitHub también (18/11/2026): el 11/11 una `startup_failure` salió en inglés crudo y como
// «terminó» en Salud. Cada una con su emoji y un espacio delante: cuatro lugares le cortan la primera palabra
const FIN_CORRIDA = { success: '✅ terminó bien', failure: '⚠️ falló', cancelled: '⛔ cancelada', timed_out: '⚠️ se pasó de tiempo', skipped: 'salteada',
  startup_failure: '⚠️ no arrancó', action_required: '⚠️ pide aprobación', neutral: '✅ terminó', stale: '⚠️ quedó vieja' };
function Corridas({ corridas, s, github }) {
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  const correr = async () => {
    setOcup(true); setMsg('');
    try {
      const r = await fetch('/api/avisos/dueno/ciclo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setMsg('✅ Pedido: GitHub lo larga en uno o dos minutos.');
      else if (j.error === 'espera') setMsg('⏳ Ya se corrió hace poco: prueba en ' + (j.minutos || 10) + ' min.');
      else setMsg('⚠️ No se pudo: ' + (r.status === 401 ? 'la sesión venció, entra de nuevo' : j.error || r.status) + '.');
    } catch (e) { setMsg('⚠️ No se pudo: sin red.'); }
    setOcup(false);
  };
  const m = s.ciclo_mano || {};
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>Las corridas del ciclo</h3>{m.t ? <span className="db-est">{m.por === 'verificar' ? 'por alguien que se verificó' : 'a mano'}: {hace(m.t)}</span> : null}</div>
      {github ? (
        <p className="db-vig"><b>⚠️ A GitHub Actions le pasa algo ahora</b><small>{github.incidente || 'Anda lento'}{github.desde ? ' · desde ' + hora(github.desde) : ''}. Las corridas pueden quedar en cola o cancelarse solas; vuelven cuando GitHub se arregla. La página en vivo, la campana y el bot no dependen de esto.</small></p>
      ) : null}
      {(corridas || []).length ? (
        <ul className="db-corr">{corridas.map((c) => {
          const t = c.empezo || c.creada;
          const que = c.estado === 'completed' ? (FIN_CORRIDA[c.fin] || c.fin || 'terminó') : (ESTADO_CORRIDA[c.estado] || c.estado);
          const dura = c.estado === 'completed' && c.empezo && c.toco ? Math.max(1, Math.round((Date.parse(c.toco) - Date.parse(c.empezo)) / 60000)) : 0;
          return (
            <li key={c.creada} className={c.fin && c.fin !== 'success' && c.fin !== 'skipped' ? 'ojo' : ''}>
              <b>{que}</b>
              <span>{t ? hora(new Date(t)) : ''}{dura ? ' · ' + dura + ' min' : c.estado !== 'completed' && t ? ' · ' + hace(t) : ''}</span>
              {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">ver ↗</a> : null}
            </li>
          );
        })}</ul>
      ) : <p className="db-tx">No pude preguntarle a GitHub ahora.</p>}
      <div className="cu-btns">
        <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para correrlo" onClick={correr}>▶️ Correr el ciclo ahora</DosToques>
      </div>
      <p className="db-tx">Es la misma corrida que sale sola cada media hora: lee Discord, procesa lo que terminó y actualiza la página. Como mucho una vez cada 10 minutos.</p>
      {msg ? <p className="db-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// ── 💸 lo que gasta Cloudflare hoy (05/10/2026: «¿cuántas escrituras tiene el KV ahora?») ──────────────────────────
// Lo mide el ciclo en cada corrida (`bot/cuotas.py`: KV, el objeto, el Worker y R2) y lo deja en `datos/estado_*.json`,
// que el mapa en vivo ya lee de GitHub: no cuesta nada nuevo. ⚠️ El día de Cloudflare es UTC: se renueva a las 8 PM ET
// (7 PM en invierno), y lo medido antes de esa hora es del día anterior.
const RAW = 'https://raw.githubusercontent.com/underraponline-lgtm/underlegends/main/datos/';
const TOPES = [
  ['kv', 'write', 'KV · escrituras', 1000],
  ['kv', 'read', 'KV · lecturas', 100000],
  ['objeto', 'leidas', 'El objeto · filas leídas', 5000000],
  ['objeto', 'escritas', 'El objeto · filas escritas', 100000],
  ['objeto', 'pedidos', 'El objeto · pedidos', 100000],
];
const corta = (n) => (n >= 1e6 ? String(Math.round(n / 1e5) / 10).replace('.', ',') + ' M' : num(n));
// los dos estados del ciclo, una vez por visita: los leen las cuotas y la meta del lobby
let estadosP = null;
const estados = () => (estadosP = estadosP || Promise.all(['estado_dibujar.json', 'estado_escuchar.json'].map((f) =>
  fetch(RAW + f, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null))));
function useCuotas(activo) {
  const [q, setQ] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    estados()
      .then((xs) => {
        const c = xs.filter((x) => x && x.cuotas).sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)))[0];
        if (vivo) setQ(c ? Object.assign({ cuando: c.cuando }, c.cuotas) : false);
      });
    return () => { vivo = false; };
  }, [activo]);
  return q;
}
// ── 🎯 LA META DEL LOBBY, ESCRITA ANTES DE MIRAR (Dlx, 13/10/2026: «hacer todo»; el research «Lobbies de juegos que
// enganchan», decisión 9 A: «se mide dos semanas antes y cuatro después contra una meta escrita»). El número es
// «Vuelven a jugar» (`rankings.retencion()`): de los que debutan en una semana, cuántos juegan otro evento, otro día,
// dentro de 14 días. Antes = las semanas de debut del 28/09 y el 05/10; con el lobby (para todos desde el 13/10) = las
// del 12/10, 19/10, 26/10 y 02/11. La del 21/09 no cuenta: fue la del arranque, con todos nuevos. ⚠️ Una semana se
// sabe recién 21 días después de su lunes (7 de debut + 14), por eso «completa». ⚠️ LA META NO SE CAMBIA DESPUÉS DE
// MIRAR: es lo que la hace una meta
const META_LOBBY = {
  puntos: 10, escrita: '2026-10-13',
  antes: ['2026-09-28', '2026-10-05'], despues: ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'],
  // lo que puede torcer el número, anotado antes (el research: «una semana rara, un feriado o un servidor nuevo»)
  ojo: ['FVS entró a la Liga el 12/10: gente nueva de otro servidor justo en la primera semana con el lobby'],
};
function useRetencion(activo) {
  const [r, setR] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    estados().then((xs) => {
      const c = xs.filter((x) => x && x.retencion && x.retencion.cohortes).sort((a, b) => String(b.cuando).localeCompare(String(a.cuando)))[0];
      if (vivo) setR(c ? c.retencion : false);
    });
    return () => { vivo = false; };
  }, [activo]);
  return r;
}
// 📈 LA VUELTA AL SEGUNDO EVENTO (25/10/2026, el research del Dashboard: «el número del problema central, mostrado sin
// trampa»). De los que debutan en una semana, cuántos juegan otro evento, otro día, dentro de 14 días: la misma cuenta que
// `MetaLobby`, del ciclo. Cuatro reglas para no engañarse con pocos datos: cada porcentaje con su cantidad de personas;
// con menos de 30, el rango en que puede estar de verdad (Wilson, 95 %); la semana que todavía no cerró dice «abierta» y
// no suma; y el número grande junta las últimas 4 cerradas, porque una sola semana tiene muy poca gente
function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, m = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - m), Math.min(1, c + m)];
}
// 📌 LO QUE SALIÓ CADA SEMANA, para leer un salto con su causa (25/10/2026, el research: las marcas de Grafana). Las
// versiones de la página (`/cambios.json`, el mismo changelog público) y los ajustes del Dashboard que mueven a la gente
// (multiplicadores, campana, sorteo, promos), por el lunes de su semana en hora del este
let cambiosP = null;
const pedirCambios = () => (cambiosP = cambiosP || fetch('/cambios.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
function useCambios(activo) {
  const [c, setC] = useState(null);
  useEffect(() => { if (activo) pedirCambios().then((x) => setC((x && x.cambios) || [])); }, [activo]);
  return c;
}
const lunesDe = (dia) => { const d = new Date(String(dia).slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const MARCA_AJ = { multiplicadores: 'multiplicador a mano', campana_pausada: 'campana', pase_sorteo: 'sorteo', promos_mano: 'promos', aviso_web: 'aviso en la web' };
// ⚠️ LAS VERSIONES VAN CONTADAS, NO UNA POR UNA: hay semanas con 30 a 100, y una lista así no se lee. Los títulos
// quedan al pasar el mouse; los ajustes a mano, que son pocos, van con su nombre
function marcasPorSemana(cambios, hist) {
  const v = {}, a = {}, m = {};
  for (const c of cambios || []) if (c.dia && c.version) { const k = lunesDe(c.dia); (v[k] = v[k] || []).push(c.version + ' ' + (c.titulo || '')); }
  // 📅 el día del ajuste en hora del este, como las cohortes (18/11/2026): con `toISOString()` era el día UTC, y lo
  // tocado un domingo desde las 7 PM ET caía en la semana siguiente
  const diaET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  for (const h of hist || []) if (MARCA_AJ[h.cual]) { const k = lunesDe(diaET.format(new Date(msDe(h.t)))); (a[k] = a[k] || new Set()).add('✍ ' + MARCA_AJ[h.cual]); }
  for (const k of new Set([...Object.keys(v), ...Object.keys(a)])) {
    const xs = (v[k] || []);
    m[k] = { corto: [xs.length ? num(xs.length) + (xs.length === 1 ? ' versión' : ' versiones') + ' de la página' : '', ...(a[k] || [])].filter(Boolean),
      largo: xs.concat([...(a[k] || [])]) };
  }
  return m;
}

function VueltaSegundo({ r, marcas }) {
  if (r === null) return <p className="pronto-p">Midiendo…</p>;
  if (!r || !(r.cohortes || []).length) return <p className="pronto-p">Todavía no hay una medición del ciclo.</p>;
  const cs = [...r.cohortes].sort((a, b) => String(a.semana).localeCompare(String(b.semana)));
  // ⚠️ LA PRIMERA SEMANA DE LA TEMPORADA NO CUENTA: ahí «debuta» todo el que ya jugaba antes del arranque, y la vuelta
  // sale inflada (71 % la del 21/9, contra 41 % la siguiente). Se ve en la lista, marcada, pero no entra al número grande
  const arranque = cs[0] && cs[0].semana;
  const cerradas = cs.filter((c) => c.completa && c.nuevos && c.semana !== arranque);
  const ult = cerradas.slice(-4);
  const n = ult.reduce((t, c) => t + c.nuevos, 0), k = ult.reduce((t, c) => t + c.volvieron, 0);
  const [lo, hi] = wilson(k, n);
  const ant = cerradas.slice(-8, -4);
  const na = ant.reduce((t, c) => t + c.nuevos, 0), ka = ant.reduce((t, c) => t + c.volvieron, 0);
  const [loA, hiA] = wilson(ka, na);
  // un cambio cuenta si los dos rangos no se pisan; si se pisan, «sin cambio claro»
  const claro = na >= 30 && n >= 30 && (lo > hiA || hi < loA);
  const pc = (x) => Math.round(100 * x);
  return (
    <div className="dz-vuelta">
      {n ? (
        <div className="dz-vuelta-c">
          <b>{pc(k / n)} %</b>
          <div>
            <p><b>{num(k)} de {num(n)}</b> que debutaron {ult.length === 1 ? 'en la última semana cerrada' : 'en las últimas ' + ult.length + ' semanas cerradas'} volvieron a jugar en 14 días.</p>
            {/* 🔢 cuántas «de antes» de verdad (18/11/2026): hasta tener 8 cerradas son menos de 4, y decía «Las 4 de antes» por una sola */}
            <small>De verdad puede estar entre {pc(lo)} % y {pc(hi)} %{na ? '. ' + (ant.length === 1 ? 'La semana de antes' : 'Las ' + ant.length + ' de antes') + ': ' + pc(ka / na) + ' % (' + num(na) + ' personas)' + (claro ? (k / n > ka / na ? ': subió.' : ': bajó.') : ': sin cambio claro.') : '.'}</small>
          </div>
        </div>
      ) : <p className="db-tx">Todavía no cerró ninguna semana: la primera se sabe 14 días después del debut.</p>}
      <ol className="dz-vuelta-l" aria-label="Semana por semana">{cs.slice(-8).map((c) => {
        const p = c.nuevos ? c.volvieron / c.nuevos : 0, [a, b] = wilson(c.volvieron, c.nuevos);
        return (
          <li key={c.semana} className={!c.completa ? 'abierta' : c.semana === arranque ? 'arranque' : ''}>
            <span>{corto(c.semana)}</span>
            <i aria-hidden="true">{c.nuevos ? <><em style={{ left: pc(a) + '%', width: Math.max(1, pc(b) - pc(a)) + '%' }} /><u style={{ left: pc(p) + '%' }} /></> : null}</i>
            <b>{c.nuevos ? pc(p) + ' %' : '—'}</b>
            <small>{num(c.volvieron)} de {num(c.nuevos)}{!c.completa ? ' · abierta' : c.semana === arranque ? ' · arranque, no cuenta' : c.nuevos < 30 ? ' · pocos' : ''}</small>
            {(marcas || {})[c.semana] ? <em className="dz-marcas" title={marcas[c.semana].largo.join(' · ')}>📌 {marcas[c.semana].corto.join(' · ')}</em> : null}
          </li>
        );
      })}</ol>
      <p className="db-tx">La barra gris es el rango; la raya, lo medido. «Abierta»: todavía no pasaron los 14 días, así que va a subir. «Pocos»: menos de 30 personas, el rango es ancho. La semana del arranque no cuenta: ahí «debutaron» también los que ya jugaban antes. 📌 Lo que salió esa semana (versiones de la página y ajustes a mano): sirve para leer un salto con su causa, no prueba que la causa sea ésa.</p>
    </div>
  );
}
// 🔁 LOS PRIMERIZOS Y LOS ENFRIADOS, CON NOMBRE (25/10/2026, el research del Dashboard: «un número no dice a quién
// mirar; una lista sí»). Los arma el ciclo (`bot/primerizos.py`) y llegan sólo acá. La acción es avisarle por su campana
// con un texto fijo (`PLANTILLAS_VUELVE` de bot/avisos.js): nunca un DM. Sólo le llega a quien tiene cuenta
const VUELVE = [['evento', 'Te esperamos en el próximo evento'], ['pase', 'Tu Pase de rapero te espera'], ['crew', 'Súmate a una crew']];
// un porcentaje con su cantidad y su rango (Wilson): «41 % · 54 de 131» y, si son pocos, el rango
const pctN = ([n, k]) => (n ? Math.round((100 * k) / n) + ' %' : '—');
function RangoTxt({ par }) {
  const [n, k] = par || [0, 0];
  if (!n) return <small>nadie todavía</small>;
  const [a, b] = wilson(k, n);
  return <small>{num(k)} de {num(n)}{n < 30 ? ' · pocos: entre ' + Math.round(100 * a) + ' y ' + Math.round(100 * b) + ' %' : ''}</small>;
}
// dos grupos: ¿la diferencia es clara (los rangos no se pisan) o no?
function veredicto(a, b) {
  const [na, ka] = a || [0, 0], [nb, kb] = b || [0, 0];
  if (na < 10 || nb < 10) return 'Todavía hay muy poca gente para comparar.';
  const [a1, a2] = wilson(ka, na), [b1, b2] = wilson(kb, nb);
  return a1 > b2 ? 'La diferencia es clara.' : a2 < b1 ? 'La diferencia es clara, al revés.' : 'Sin diferencia clara por ahora: los rangos se pisan.';
}

// 🔁 EL EMBUDO DEL PRIMERIZO (25/10/2026, el research; Dlx: «haz todas»). De los que debutaron hace 14 días o más (fuera
// de la semana del arranque), cuántos ganaron alguna batalla, cuántos volvieron, y la vuelta según cómo les fue en su
// primera. Lo arma el ciclo (`rankings._embudo()`): sólo conteos
function Embudo({ e }) {
  if (!e || !e.n) return <p className="pronto-p">El embudo se arma con los que debutaron hace 14 días o más: llega con el ciclo.</p>;
  // «ganaron alguna» sólo se puede saber de los que tienen duelos leídos: la etiqueta dice de cuántos
  const conDuelos = e.n - ((e.sin_duelos || [0])[0] || 0);
  const pasos = [['Debutaron', e.n], ['Ganaron alguna batalla en su debut (de ' + num(conDuelos) + ' con duelos leídos)', e.gano], ['Volvieron en 14 días', e.volvio], ['Llegaron a 3 eventos', e.tres], ['Llegaron a 5', e.cinco]];
  return (
    <div className="dz-embudo">
      <ol className="dz-emb-l">{pasos.map(([t, v]) => (
        <li key={t}><span>{t}</span><i><u style={{ width: (100 * v / e.n).toFixed(1) + '%' }} /></i><b>{num(v)}</b><small>{Math.round((100 * v) / e.n)} %</small></li>
      ))}</ol>
      <div className="dz-nums">
        <div className="dz-num"><span>si ganó alguna en su debut</span><b>{pctN(e.si_gano)}</b><RangoTxt par={e.si_gano} /></div>
        <div className="dz-num"><span>si no ganó ninguna</span><b>{pctN(e.no_gano)}</b><RangoTxt par={e.no_gano} /></div>
        <div className="dz-num"><span>cayó en la primera con uno de los fuertes</span><b>{pctN(e.cayo_fuerte)}</b><RangoTxt par={e.cayo_fuerte} /></div>
        <div className="dz-num"><span>cayó en la primera con otro</span><b>{pctN(e.cayo_otro)}</b><RangoTxt par={e.cayo_otro} /></div>
      </div>
      <p className="db-tx">Cada número es «volvió a jugar en 14 días». {veredicto(e.si_gano, e.no_gano).replace('La diferencia', 'Entre ganar alguna y no ganar ninguna, la diferencia')}
        {' '}Los fuertes son el cuarto que más eventos jugó ({num(e.corte_fuerte || 0)} o más). {e.sin_duelos && e.sin_duelos[0] ? num(e.sin_duelos[0]) + ' debutaron en eventos sin duelos leídos (por equipos o sin batallas) y no entran en esas cuentas.' : ''}</p>
    </div>
  );
}

function PrimerizosLista({ P, vuelve, liga, alVuelve }) {
  const [pest, setPest] = useState('una');
  const [sv, setSv] = useState('');
  const [q, setQ] = useState('');
  const [mas, setMas] = useState(false);
  const [que, setQue] = useState('evento');
  const [res, setRes] = useState({});
  if (!P) return <p className="pronto-p">La lista llega con la próxima vuelta del ciclo.</p>;
  const xs0 = pest === 'una' ? P.una || [] : P.frio || [];
  const svs = [...new Set(xs0.map((f) => f[1]).filter(Boolean))].sort();
  const xs = xs0.filter((f) => (!sv || f[1] === sv) && contiene([f[0]], q));
  const ver = mas ? xs.slice(0, 200) : xs.slice(0, 25);
  // 📅 días de calendario en hora del este (18/11/2026): `f[2]` y `f[3]` son días ET y se redondeaban horas contra el
  // mediodía UTC, así que desde las 7 PM ET un debut de hoy decía «ayer»
  const hoy = Date.parse(hoyET() + 'T12:00:00Z');
  const dias = (d) => Math.max(0, Math.round((hoy - Date.parse(d + 'T12:00:00Z')) / 864e5));
  const haceDias = (d) => { const n = dias(d); return n === 0 ? 'hoy' : n === 1 ? 'ayer' : 'hace ' + n + ' días'; };
  const avisar = async (k) => {
    setRes((r) => Object.assign({}, r, { [k]: '…' }));
    try {
      const r = await fetch('/api/avisos/dueno/vuelve', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k, que }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) { alVuelve(j.avisados || {}); setRes((x) => Object.assign({}, x, { [k]: '' })); return; }
      setRes((x) => Object.assign({}, x, { [k]: j.error === 'sin_cuenta' ? 'No tiene cuenta en la página: no le llega.' : j.error === 'reciente' ? 'Ya se le avisó esta semana.'
        : j.error === 'tope' ? 'Llegaron a 40 avisos hoy: mañana.' : j.error === 'control' ? 'Es del grupo sin aviso: no se le avisa, para comparar.' : 'No se pudo: ' + (j.error || r.status) }));
    } catch (e) { setRes((x) => Object.assign({}, x, { [k]: 'No se pudo: sin red.' })); }
  };
  const h = P.hist || {}, hmax = Math.max(1, ...Object.values(h));
  return (
    <div className="dz-prim">
      {Object.keys(h).length ? (
        <div className="dz-hist" role="img" aria-label={'Cuántos eventos jugó cada uno: ' + Object.entries(h).map(([k, v]) => v + ' jugaron ' + (k === '10' ? '10 o más' : k)).join(', ')}>
          {Object.entries(h).map(([k, v]) => (
            <div key={k} className={k === '1' ? 'uno' : ''}><b>{num(v)}</b><i><u style={{ height: (100 * v / hmax).toFixed(1) + '%' }} /></i><span>{k === '10' ? '10+' : k}</span></div>
          ))}
          <small>eventos jugados · {num(P.jugadores || 0)} personas en la temporada</small>
        </div>
      ) : null}
      {P.prueba_aviso ? (
        <div className="dz-prueba">
          <h4 className="dz-h4">¿Sirve avisar? · volvieron en 14 días</h4>
          <div className="dz-nums">
            <div className="dz-num"><span>a los que se les avisó</span><b>{pctN(P.prueba_aviso.aviso)}</b><RangoTxt par={P.prueba_aviso.aviso} /></div>
            <div className="dz-num"><span>el grupo sin aviso</span><b>{pctN(P.prueba_aviso.control)}</b><RangoTxt par={P.prueba_aviso.control} /></div>
          </div>
          <p className="db-tx">{veredicto(P.prueba_aviso.aviso, P.prueba_aviso.control)} Sólo cuentan los de hace 14 días o más; el grupo sin aviso es uno de cada ~7, por sorteo fijo.</p>
        </div>
      ) : null}
      <div className="dz-subs" role="tablist" aria-label="Qué lista">
        <button type="button" role="tab" aria-selected={pest === 'una'} className={'dz-sub' + (pest === 'una' ? ' on' : '')} onClick={() => { setPest('una'); setSv(''); }}>Jugaron una sola vez<i>{num(P.n_una || 0)}</i></button>
        <button type="button" role="tab" aria-selected={pest === 'frio'} className={'dz-sub' + (pest === 'frio' ? ' on' : '')} onClick={() => { setPest('frio'); setSv(''); }}>Se enfriaron<i>{num(P.n_frio || 0)}</i></button>
      </div>
      <p className="db-tx">{pest === 'una' ? 'Jugaron un evento y no volvieron: los más nuevos arriba, porque a quien debutó hace poco todavía se lo puede traer.'
        : 'Jugaron dos o más y hace ' + (P.enfria_dias || 21) + ' días o más que no vuelven: los que más jugaron arriba.'} Lo midió el ciclo {hace(P.cuando)}.</p>
      <div className="dz-prim-f">
        <label className="db-buscar"><Ico n="buscar" t={16} /><input type="search" value={q} placeholder="Buscar un nombre" aria-label="Buscar en la lista" onChange={(e) => setQ(e.target.value)} /></label>
        {svs.length > 1 ? <select value={sv} aria-label="Servidor" onChange={(e) => setSv(e.target.value)}><option value="">Todos los servidores</option>{svs.map((x) => <option key={x} value={x}>{siglaDe(x)}</option>)}</select> : null}
        <select value={que} aria-label="Qué le llega" onChange={(e) => setQue(e.target.value)}>{VUELVE.map(([k, t]) => <option key={k} value={k}>Le llega: «{t}»</option>)}</select>
      </div>
      <ol className="dz-prim-l">{ver.map((f) => {
        const k = f[f.length - 1], av = (vuelve || {})[k], ctl = (P.control || []).includes(k);
        return (
          <li key={pest + k}>
            <div><b><Quien liga={liga} n={f[0]} /> <BotonFicha k={k} n={f[0]} /></b>
              <small>{siglaDe(f[1] || '—')} · {pest === 'una' ? 'jugó el ' + corto(f[2]) + ', ' + haceDias(f[2])
                : num(f[4]) + ' eventos · el último el ' + corto(f[3]) + ', ' + haceDias(f[3])}</small></div>
            {av ? <span className="dz-prim-ya">✓ Se le avisó {hace(av[0])}{av[2] ? ' (' + av[2] + ')' : ''}</span>
              : ctl ? <span className="dz-prim-ctl" title="Uno de cada ~7, por sorteo fijo: sin aviso, para comparar cuántos vuelven solos">grupo sin aviso</span>
                : <button type="button" className="btn borde2 chico" disabled={res[k] === '…'} onClick={() => avisar(k)}>Avisarle</button>}
            {res[k] && res[k] !== '…' ? <small className="dz-prim-msg" role="status">{res[k]}</small> : null}
          </li>
        );
      })}{!ver.length ? <li className="dz-it-nada">Nadie{q ? ' con «' + q + '»' : ''}.</li> : null}</ol>
      {xs.length > 25 ? <button type="button" className="dz-lnk" onClick={() => setMas(!mas)}>{mas ? 'Ver menos' : 'Ver ' + Math.min(200, xs.length) + ' de ' + num(xs.length)}</button> : null}
      <p className="db-tx">«Avisarle» le deja una notificación en la página (y en el celular, si prendió la campana): nunca un mensaje directo. Uno por persona cada 7 días; sólo a quien tiene cuenta.</p>
    </div>
  );
}

// 💰 LOS PUNTOS DE TIENDA (25/10/2026, el research: «la economía mínima»). Qué entra y qué sale cada día y de dónde, quién
// tiene cuánto y lo raro de 24 h, del objeto (`economiaDueno()` de bot/avisos.js). El origen es el principio del id de
// cada movimiento: lo que no está en la lista se muestra tal cual
const ORIGEN_PDT = { ap: 'apuestas', precio: 'precios por cabeza', semana: 'premio de la semana', rdia: 'racha diaria', rhito: 'hitos de racha',
  bien: 'bienvenida', crew: 'crear una crew', 'crew-nombre': 'nombre de crew', 'crew-logo': 'logo de crew', mw: 'Most Wanted', div: 'divisiones',
  mis: 'misiones', caza: 'cazas', mes: 'MES AWARDS', comp: 'Competencias', promo: 'promos', salon: 'Salón',
  // los que salían con su código (12/11/2026, mirándolo con Dlx): «deb», «promox», «pase»
  pase: 'Pase de rapero', 'pase-premium': 'Pase premium', deb: 'reto del debut', wr: 'Writing Challenge',
  promox: 'una semana más de promo' };
function Economia({ e, liga }) {
  // 👤 los perfiles, para nombrar a quien no está en la tabla (18/11/2026: salía la clave cruda)
  usePerfiles();
  if (!e) return <p className="pronto-p">La billetera de la temporada todavía no está configurada.</p>;
  const ent = e.dias.reduce((t, x) => t + x[1], 0), sal = e.dias.reduce((t, x) => t + x[2], 0);
  const max = Math.max(1, ...e.dias.map((x) => Math.max(x[1], x[2])));
  const os = Object.entries(e.origen || {}).sort((a, b) => (b[1][0] + b[1][1]) - (a[1][0] + a[1][1]));
  return (
    <div className="dz-eco">
      <div className="dz-nums">
        <div className="dz-num"><span>personas con billetera</span><b>{num(e.personas)}</b><small>arrancan con {num(e.inicial)}</small></div>
        <div className="dz-num"><span>la persona del medio</span><b>{num(e.mediana)}</b><small>la mitad tiene menos que esto</small></div>
        <div className="dz-num"><span>los 20 de arriba</span><b>{Math.round(100 * e.top_parte)} %</b><small>de todos los puntos que hay</small></div>
        <div className="dz-num"><span>14 días</span><b>{ent >= sal ? '+' : '−'}{num(Math.abs(ent - sal))}</b><small>entraron {num(ent)} · salieron {num(sal)}</small></div>
      </div>
      {e.dias.length ? (
        <div className="dz-eco-d" role="img" aria-label={'Día por día, lo que entró y lo que salió en 14 días'}
          style={{ gridTemplateColumns: 'repeat(' + e.dias.length + ', minmax(0, 1fr))' }}>{/* llegan 15 días (hoy incluido) y la grilla era de 14: hoy caía abajo */}
          {e.dias.map(([d, a, b]) => (
            <div key={d} title={corto(d) + ': entró ' + num(a) + ' · salió ' + num(b)}>
              <i><u className="e" style={{ height: (100 * a / max).toFixed(1) + '%' }} /><u className="s" style={{ height: (100 * b / max).toFixed(1) + '%' }} /></i>
              <span>{corto(d).split('/')[0]}</span>
            </div>
          ))}
          <small><b className="e">■</b> entró · <b className="s">■</b> salió</small>
        </div>
      ) : null}
      <div className="dz-dos">
        <div>
          <h4 className="dz-h4">De dónde entra y a dónde sale · 14 días</h4>
          <ul className="dz-lista">{os.map(([o, [a, b]]) => (
            <li key={o}><span>{ORIGEN_PDT[o] || o}</span><b>{a ? '+' + num(a) : ''}{a && b ? ' · ' : ''}{b ? '−' + num(b) : ''}</b></li>
          ))}</ul>
        </div>
        <div>
          <h4 className="dz-h4">Los que más tienen</h4>
          <ol className="dz-lista dz-eco-top">{e.top.slice(0, 10).map(([k, n], i) => (
            <li key={k + i}><span>{i + 1}. {k ? <><Quien liga={liga} n={liga.nombreDe(k)} /> <BotonFicha k={k} /></> : 'sin perfil'}</span><b>{num(n)}</b></li>
          ))}</ol>
        </div>
      </div>
      {(e.raros || []).length ? (
        <div className="dz-freno">
          <p><b>Para mirar:</b> sumaron 5.000 o más en 24 horas. Puede ser un premio grande; si no, mira de dónde vino en su perfil.</p>
          <ul className="dz-lista">{e.raros.map(([k, n]) => <li key={k}><span>{k ? <><Quien liga={liga} n={liga.nombreDe(k)} /> <BotonFicha k={k} /></> : 'sin perfil'}</span><b>+{num(n)}</b></li>)}</ul>
        </div>
      ) : null}
      <p className="db-tx">Sólo números de la billetera: no se ve qué apostó cada uno. Se mide en cada visita al Dashboard.</p>
    </div>
  );
}

function MetaLobby({ r }) {
  if (r === null) return <p className="pronto-p">Midiendo…</p>;
  if (!r) return <p className="pronto-p">Todavía no hay una medición del ciclo.</p>;
  const por = Object.fromEntries((r.cohortes || []).map((c) => [c.semana, c]));
  const pct = (xs) => {
    const cs = xs.map((k) => por[k]).filter((c) => c && c.completa && c.nuevos);
    const n = cs.reduce((t, c) => t + c.nuevos, 0);
    return cs.length === xs.length && n ? (100 * cs.reduce((t, c) => t + c.volvieron, 0)) / n : null;
  };
  const a = pct(META_LOBBY.antes), d = pct(META_LOBBY.despues);
  const fila = (k, cuando) => {
    const c = por[k];
    return (
      <tr key={k}><td>{corto(k)}</td><td>{cuando}</td><td>{c ? num(c.nuevos) : '—'}</td>
        <td>{c ? num(c.volvieron) + ' · ' + Math.round((100 * c.volvieron) / Math.max(1, c.nuevos)) + ' %' : '—'}</td>
        <td>{c && c.completa ? 'completa' : 'se está midiendo'}</td></tr>
    );
  };
  const fin = new Date(Date.parse(META_LOBBY.despues[META_LOBBY.despues.length - 1] + 'T12:00:00Z') + 21 * 864e5);
  return (
    <div className="db-aj">
      <p className="db-tx"><b>La meta, escrita el {corto(META_LOBBY.escrita)} antes de mirar:</b> «Vuelven a jugar» sube <b>{META_LOBBY.puntos} puntos</b> con el
        lobby. Es la parte de los que debutan en una semana que juega otro evento, otro día, dentro de 14 días.</p>
      <div className="db-tabla"><table>
        <thead><tr><th>Debut</th><th></th><th>Nuevos</th><th>Volvieron</th><th></th></tr></thead>
        <tbody>{META_LOBBY.antes.map((k) => fila(k, 'antes'))}{META_LOBBY.despues.map((k) => fila(k, 'con el lobby'))}</tbody>
      </table></div>
      <p className="db-tx">{a == null ? 'Antes: se sabe cuando cierre la semana del ' + corto(META_LOBBY.antes[1]) + '. '
        : 'Antes: ' + Math.round(a) + ' %. '}{d == null ? 'Con el lobby: se sabe el ' + corto(fin.toISOString().slice(0, 10)) + '.'
        : 'Con el lobby: ' + Math.round(d) + ' %. ' + (d - a >= META_LOBBY.puntos ? '✅ Se cumplió la meta.' : '❌ No llegó a la meta (' + (d >= a ? '+' : '') + Math.round(d - a) + ' puntos).')}</p>
      {META_LOBBY.ojo.map((x) => <p key={x} className="db-tx">⚠️ {x}.</p>)}
    </div>
  );
}

// ── 📊 COMPARAR SEMANAS (Dlx, 18/10/2026: «para tener la opción de comparar actividad, gente y mejoras de gente o peores,
// para comparar con otras semanas»). La competencia y el ranking salen de `datos/semanas.json` (bot/semanas.py: todo
// público, las llaves y el ranking); el uso de la página y del bot, del objeto (`uso_semanas`, sólo acá) ──────────────
let semanasP = null;
const pedirSemanas = () => (semanasP = semanasP || fetch(RAW + 'semanas.json', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null));
function useSemanas(activo) {
  const [s, setS] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    pedirSemanas().then((x) => { if (vivo) setS(x || false); });
    return () => { vivo = false; };
  }, [activo]);
  return s;
}
const MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const masDias = (dia, n) => new Date(Date.parse(dia + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
// «12–18 oct», «28 sep–4 oct»
const rangoSem = (lunes) => {
  const a = new Date(lunes + 'T12:00:00Z'), b = new Date(a.getTime() + 6 * 864e5);
  return a.getUTCDate() + (a.getUTCMonth() === b.getUTCMonth() ? '' : ' ' + MES_C[a.getUTCMonth()]) + '–' + b.getUTCDate() + ' ' + MES_C[b.getUTCMonth()];
};
// el día de hoy en hora del este: las semanas de la Liga van de lunes a domingo en esa hora
const hoyET = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// los números de la semana `i`; con `k`, sólo sus primeros `k` días (para comparar «a igual día»)
function medirSemana(ss, i, k) {
  const w = ss[i];
  if (!w) return null;
  if (!k) {
    return { eventos: w.eventos, raperos: w.raperos, part: w.part, debut: w.debut.length, volvieron: w.volvieron,
      batallas: w.batallas, fuera: w.completa ? w.fuera.length : null };
  }
  const antes = new Set();
  ss.slice(0, i).forEach((x) => x.dias.forEach((d) => d[3].forEach((n) => antes.add(n))));
  const tope = masDias(w.lunes, k);
  const ds = w.dias.filter((d) => d[0] < tope);
  const gente = new Set();
  ds.forEach((d) => d[3].forEach((n) => gente.add(n)));
  let debut = 0, volvieron = 0;
  gente.forEach((n) => { if (antes.has(n)) volvieron += 1; else debut += 1; });
  return { eventos: ds.reduce((t, d) => t + d[1], 0), raperos: gente.size, part: ds.reduce((t, d) => t + d[2], 0),
    debut, volvieron, batallas: null, fuera: null };
}

// quién sumó, subió y bajó en la semana `i`: la foto del ranking al empezarla contra la del lunes siguiente (o la de ahora)
function movimientos(S, i) {
  const ss = S.semanas, w = ss[i];
  const ini = (S.fotos || {})[w.lunes] || {};
  const sig = ss[i + 1];
  const fin = sig ? (S.fotos || {})[sig.lunes] : (S.ultima || {}).foto;
  if (!fin) return null;
  const filas = Object.entries(fin).map(([n, [pos, pts]]) => {
    const a = ini[n] || [0, 0];
    return { n, pos, pts, dPts: pts - a[1], dPos: a[0] && pos ? a[0] - pos : null };
  });
  return {
    sumaron: filas.filter((f) => f.dPts > 0).sort((a, b) => b.dPts - a.dPts).slice(0, 8),
    subieron: filas.filter((f) => f.dPos > 0).sort((a, b) => b.dPos - a.dPos || a.pos - b.pos).slice(0, 8),
    bajaron: filas.filter((f) => f.dPos < 0).sort((a, b) => a.dPos - b.dPos || a.pos - b.pos).slice(0, 8),
  };
}

// una caja: el número de la semana, cuánto cambió contra la otra (▲▼ y %), y el de la otra. `menos`: bajar es mejor
function CajaSem({ t, a, b, menos, i }) {
  const x = useNumero(a == null ? null : a);
  if (a == null) return null;
  const d = b == null ? null : a - b;
  const pct = d != null && b ? Math.round((100 * d) / b) : null;
  const bien = d == null || d === 0 ? '' : (d > 0) !== !!menos ? 'db-sube' : 'db-baja';
  return (
    <div className="cs-caja" style={{ '--i': i }}>
      <span>{t}</span><b>{num(x || 0)}</b>
      {d == null ? <small>sin dato de la otra semana</small> : (
        <small className={bien}>{d > 0 ? '▲ ' : d < 0 ? '▼ ' : '= '}{num(Math.abs(d))}{pct != null && d ? ' · ' + (pct > 0 ? '+' : '') + pct + ' %' : ''}
          <em> · antes {num(b)}</em></small>
      )}
    </div>
  );
}

// un nombre con link a su perfil, si es de la Liga
function Quien({ liga, n }) {
  const f = liga && liga.fila ? liga.fila(n) : null;
  return f ? <a href={'#/r/' + encodeURIComponent(f.k)}>{limpio(n)}</a> : <span>{limpio(n)}</span>;
}

// una lista de gente: los primeros a la vista y el resto detrás de «y N más»
function Gente({ liga, t, xs, d, vs }) {
  const [todo, setTodo] = useState(false);
  if (!xs) return null;
  const ver = todo ? xs : xs.slice(0, 10);
  return (
    <div className="cs-gente">
      <h4>{t} <b>{num(xs.length)}</b>{vs != null ? <em> · antes {num(vs)}</em> : null}</h4>
      {d ? <p className="db-tx">{d}</p> : null}
      {xs.length ? <p className="cs-nombres">{ver.map((n, j) => <Fragment key={n}>{j ? ' · ' : ''}<Quien liga={liga} n={n} /></Fragment>)}
        {xs.length > 10 ? <>{' '}<button type="button" className="cs-mas" onClick={() => setTodo((v) => !v)}>{todo ? 'menos' : 'y ' + (xs.length - 10) + ' más'}</button></> : null}</p>
        : <p className="db-tx">Nadie.</p>}
    </div>
  );
}

function Movidos({ liga, t, xs, f }) {
  if (!xs || !xs.length) return null;
  return (
    <div className="cs-mov">
      <h4>{t}</h4>
      <ol>{xs.map((x, j) => <li key={x.n} style={{ '--i': j }}><Quien liga={liga} n={x.n} /><em>{f(x)}</em></li>)}</ol>
    </div>
  );
}

// la temporada en barras, semana por semana: la elegida en magenta y la otra en verde
function Temporada({ ss, a, b, setA }) {
  const series = [['raperos', 'Raperos'], ['eventos', 'Eventos']];
  return (
    <div className="cs-temp">{series.map(([k, t]) => {
      const tope = Math.max(1, ...ss.map((w) => w[k] || 0));
      return (
        <div key={k} className="cs-serie">
          <span className="db-t">{t}</span>
          <div className="cs-barras">{ss.map((w, j) => (
            <button key={w.lunes} type="button" className={'cs-b' + (j === a ? ' a' : j === b ? ' b' : '') + (w.completa ? '' : ' curso')}
              onClick={() => setA(j)} title={rangoSem(w.lunes) + ' · ' + num(w[k] || 0)} aria-label={t + ' de la semana del ' + rangoSem(w.lunes) + ': ' + num(w[k] || 0)}>
              <u style={{ height: (100 * (w[k] || 0) / tope).toFixed(1) + '%', '--i': j }} /><small>{num(w[k] || 0)}</small>
            </button>
          ))}</div>
        </div>
      );
    })}
    <div className="cs-fechas">{ss.map((w) => <span key={w.lunes}>{rangoSem(w.lunes)}</span>)}</div>
    </div>
  );
}

function CompararSemanas({ S, uso, liga }) {
  const ss = (S && S.semanas) || [];
  const [a, setA0] = useState(Math.max(0, ss.length - 1));
  const [b, setB] = useState(Math.max(0, ss.length - 2));
  const [igual, setIgual] = useState(true);
  if (S === null) return <p className="pronto-p">Midiendo…</p>;
  if (!ss.length) return <p className="pronto-p">Todavía no hay semanas para comparar.</p>;
  const setA = (j) => { setA0(j); if (j === b) setB(j > 0 ? j - 1 : Math.min(ss.length - 1, j + 1)); };
  const wa = ss[a], wb = ss[b];
  // 📅 «a igual día»: si la semana elegida va por la mitad, la otra se mide en los mismos días
  const enCurso = !wa.completa;
  const k0 = enCurso && igual ? Math.max(1, Math.round((Date.parse(hoyET() + 'T12:00:00Z') - Date.parse(wa.lunes + 'T12:00:00Z')) / 864e5) + 1) : 0;
  // el domingo «a igual día» ya es la semana entera: así se ven también las batallas
  const k = k0 >= 7 ? 0 : k0;
  const ma = medirSemana(ss, a, k), mb = medirSemana(ss, b, k);
  const ua = (uso || []).find((x) => x.lunes === wa.lunes), ub = (uso || []).find((x) => x.lunes === wb.lunes);
  const u = (x) => (x ? (k ? x.k || x : x) : null);
  const UA = u(ua), UB = u(ub);
  const comp = [
    ['EVENTOS JUGADOS', ma.eventos, mb.eventos], ['RAPEROS DISTINTOS', ma.raperos, mb.raperos],
    ['PARTICIPACIONES', ma.part, mb.part], ['DEBUTARON', ma.debut, mb.debut],
    ['YA HABÍAN JUGADO', ma.volvieron, mb.volvieron], ['BATALLAS', ma.batallas, mb.batallas],
    ['SE FUERON', ma.fuera, mb.fuera, true],
  ];
  const pag = UA ? [
    ['PERSONAS (BOT O PÁGINA)', UA.personas, UB && UB.personas], ['ENTRARON CON DISCORD', UA.web, UB && UB.web],
    ['USARON EL BOT', UA.bot, UB && UB.bot], ['VISITAS A LA PÁGINA', UA.visitas, UB && UB.visitas],
  ] : [];
  const mv = movimientos(S, a), mvb = movimientos(S, b);
  const opciones = ss.map((w, j) => <option key={w.lunes} value={j}>{rangoSem(w.lunes)}{w.completa ? '' : ' (en curso)'}</option>);
  return (
    <div className="cs">
      <div className="cs-elige">
        <label><span>La semana</span><select value={a} onChange={(e) => setA(Number(e.target.value))}>{opciones}</select></label>
        <button type="button" className="btn borde2 chico" onClick={() => { setA0(b); setB(a); }} aria-label="Dar vuelta las dos semanas">⇄</button>
        <label><span>contra</span><select value={b} onChange={(e) => setB(Number(e.target.value))}>{opciones.filter((_, j) => j !== a)}</select></label>
        {enCurso ? <label className="cs-igual"><input type="checkbox" checked={igual} onChange={(e) => setIgual(e.target.checked)} />
          <span>A igual día{k ? ' (los primeros ' + k + ' días de cada una)' : ''}</span></label> : null}
      </div>
      <Temporada ss={ss} a={a} b={b} setA={setA} />
      <h3 className="cs-t">La competencia</h3>
      <div className="cs-cajas" key={'c' + a + ':' + b + ':' + k}>{comp.map(([t, x, y, menos], j) => <CajaSem key={t} t={t} a={x} b={y} menos={menos} i={j} />)}</div>
      {enCurso && !k ? <p className="db-tx">⚠️ La semana del {rangoSem(wa.lunes)} todavía no terminó: contra una entera, casi todo va a dar menos.</p> : null}
      {pag.length ? <>
        <h3 className="cs-t">La página y el bot</h3>
        <div className="cs-cajas" key={'p' + a + ':' + b + ':' + k}>{pag.map(([t, x, y], j) => <CajaSem key={t} t={t} a={x} b={y} i={j} />)}</div>
      </> : <p className="db-tx">El uso de la página y del bot de esa semana ya no está guardado (se cuenta 35 días por persona).</p>}
      <h3 className="cs-t">La gente</h3>
      <div className="cs-grilla">
        <Gente liga={liga} t="Debutaron" xs={wa.debut} vs={wb.debut.length} />
        <Gente liga={liga} t="Volvieron después de faltar" xs={wa.regreso} vs={wb.regreso.length} d="Habían jugado antes, pero no la semana anterior." />
        {wa.completa ? <Gente liga={liga} t="Se fueron" xs={wa.fuera} vs={wb.completa ? wb.fuera.length : null} d="Jugaron la semana anterior y ésta no." /> : null}
      </div>
      {mv ? <>
        <h3 className="cs-t">Mejoraron y empeoraron</h3>
        <p className="db-tx">El ranking de Temporada al empezar la semana contra el de {a === ss.length - 1 ? 'ahora' : 'al terminarla'}.
          {mvb && mvb.sumaron.length ? <> La del {rangoSem(wb.lunes)}, el que más sumó fue <Quien liga={liga} n={mvb.sumaron[0].n} /> (+{num(mvb.sumaron[0].dPts)} pts).</> : null}</p>
        <div className="cs-grilla">
          <Movidos liga={liga} t="Sumaron más puntos" xs={mv.sumaron} f={(x) => '+' + num(x.dPts) + ' pts'} />
          <Movidos liga={liga} t="Subieron más puestos" xs={mv.subieron} f={(x) => '▲ ' + x.dPos + ' · #' + x.pos} />
          <Movidos liga={liga} t="Bajaron más puestos" xs={mv.bajaron} f={(x) => '▼ ' + Math.abs(x.dPos) + ' · #' + x.pos} />
        </div>
      </> : null}
    </div>
  );
}

// ── 🤝 LOS TIERS (Dlx, 18/10/2026: «3 tier levels of association… el sistema recomienda y muestra qué tan bien los
// servidores han hecho su trabajo»). Cada servidor con su nivel —que se elige acá: ajuste `tiers`, el ciclo lo copia a
// datos/niveles.json—, su puntaje de las últimas 4 semanas y lo que recomienda `bot/tiers.py`. El puntaje no sale de acá
const TIER_QUE = { 1: 'Temporada y Competitivo, todo', 2: 'todo menos «Unirme a los Tier 1»', 3: 'su página, sus ligas (como duelos) y la Temporada' };
// 👥 los miembros que se recomiendan en cada tier: una copia de `RECOMENDADO` de bot/tiers.py (19/11/2026). No es requisito
const MIEMBROS_REC = { 1: 1000, 2: 500, 3: 100 };
// 🎛️ los beneficios de cada servidor (Dlx, 20/10/2026: «qué beneficio dar que no, qué tier, a cada servidor nuevo»). El
// tier los prende en grupo (`PRESET` de bot/tiers.py); cada interruptor manda sobre el preset
const BENEF = [['pagina', 'Su página en Socios'], ['calendario', 'Sus eventos (calendario, campana, Publicaciones)'],
  ['ligas', 'Sus ligas en Ligas'], ['panel', 'El panel de su dueño'], ['suma', 'Sus llaves suman a la Temporada (con 8 o más)'],
  ['competitivo', 'Cuentan para el Competitivo y los duelos'], ['duelos', 'Sus ligas cuentan como duelos'],
  // 🤖 «FFA Bot» con la foto y el banner de su Discord (23/11/2026): sólo el Tier 1 de entrada (`aplicarPerfilBot()` del Worker)
  ['perfil', 'El bot con el perfil de su servidor']];
// 🏆 todos los socios suman a la Temporada desde el 26/10/2026; el Competitivo, el Tier 1 y desde el 19/11/2026 también el 2
// (bot/tiers.py `PRESET`: si se cambia uno, se cambia el otro)
const PRESET = { 1: ['pagina', 'calendario', 'ligas', 'panel', 'suma', 'competitivo', 'duelos', 'perfil'],
  2: ['pagina', 'calendario', 'ligas', 'panel', 'suma', 'competitivo', 'duelos'], 3: ['pagina', 'calendario', 'ligas', 'panel', 'suma'] };

function Beneficios({ x, tier, aj, hacer, ocup }) {
  const mios = (aj.beneficios || {})[x.sv] || {};
  const bloq = x.bloq || [];
  const val = (b) => (bloq.includes(b) ? false : b in mios ? mios[b] : (x.ben && b in x.ben ? x.ben[b] : PRESET[tier].includes(b)));
  const poner = (b, v) => hacer('beneficios', Object.assign({}, aj.beneficios || {}, { [x.sv]: Object.assign({}, mios, { [b]: v }) }),
    BENEF.find((y) => y[0] === b)[1] + (v ? ' prendido' : ' apagado') + ' para ' + siglaDe(x.sv) + '. El ciclo lo aplica en su próxima vuelta.');
  const volver = () => {
    const o = Object.assign({}, aj.beneficios || {});
    delete o[x.sv];
    hacer('beneficios', o, siglaDe(x.sv) + ' vuelve a lo que da su tier.');
  };
  return (
    <div className="ti-ben">
      <small>Lo que recibe {Object.keys(mios).length ? <button type="button" className="ti-ben-x" disabled={ocup} onClick={volver}>volver al tier</button> : null}</small>
      {BENEF.map(([b, t]) => (
        <label key={b} className={bloq.includes(b) ? 'off' : ''} title={bloq.includes(b) ? (x.setup === 'pendiente'
          ? 'Entró con /setup: suma cuando le digas «Que sumen» (en tu DM o en «Los que corrieron /setup»).'
          : 'Para sumar al ranking hay que sumarlo al código: pídeselo a Claude.') : ''}>
          <input type="checkbox" checked={val(b)} disabled={ocup || bloq.includes(b)} onChange={(e) => poner(b, e.target.checked)} />
          <span>{t}{bloq.includes(b) ? (x.setup === 'pendiente' ? ' · espera tu respuesta (/setup)' : ' · falta sumarlo al código') : ''}</span>
        </label>
      ))}
    </div>
  );
}

// ✋ LAS PROMOS A MANO (Dlx, 20/10/2026: «yo debería tener la opción de agregar y qué cosas añadir o borrar manualmente
// en PROMO»). Dos ajustes que aplica bot/promos.py en la vuelta siguiente: `promos_mano` (las que agregas, con sus días; van
// primero y sin el tope por persona) y `promos_quitar` (los links que sacas, vengan de donde vengan)
// a mano, cualquier link (Dlx, 20/10/2026: «servidores de Discord, cualquier link… sólo si es manual, o sea por mí»)
const PLATS = /^https:\/\/\S{6,300}$/;
function PromosMano({ aj, hacer, ocup }) {
  const mano = aj.promos_mano || [], quitar = aj.promos_quitar || [];
  const [f, setF] = useState({ u: '', quien: '', sv: '', dias: 7 });
  const [q, setQ] = useState('');
  const [mal, setMal] = useState('');
  const set = (k) => (e) => setF(Object.assign({}, f, { [k]: k === 'dias' ? Number(e.target.value) : e.target.value }));
  const agregar = async (e) => {
    e.preventDefault();
    const u = f.u.trim();
    if (!PLATS.test(u)) return setMal('Pega un link que empiece con https://.');
    if (mano.some((x) => x.u === u)) return setMal('Esa ya está.');
    setMal('');
    const sv = f.sv.trim().toUpperCase();
    const bien = await hacer('promos_mano', [{ u, quien: f.quien.trim(), sv, dias: f.dias, t: new Date().toISOString() }, ...mano].slice(0, 30),
      'Promo agregada por ' + f.dias + (f.dias === 1 ? ' día' : ' días') + '. Sale en la próxima vuelta del ciclo.');
    if (bien) setF({ u: '', quien: '', sv: '', dias: 7 });
    return null;
  };
  const sacarMia = (u) => hacer('promos_mano', mano.filter((x) => x.u !== u), 'Promo quitada. Se va en la próxima vuelta del ciclo.');
  const sacar = async (e) => {
    e.preventDefault();
    const u = q.trim();
    if (!/^https:\/\//.test(u)) return setMal('Pega el link de la promo que quieres sacar.');
    setMal('');
    const bien = await hacer('promos_quitar', [...new Set([u, ...quitar])].slice(0, 200), 'Esa promo deja de salir en la próxima vuelta del ciclo.');
    if (bien) setQ('');
    return null;
  };
  const devolver = (u) => hacer('promos_quitar', quitar.filter((x) => x !== u), 'Esa promo vuelve a salir en la próxima vuelta del ciclo.');
  return (
    <div className="pm">
      <form className="ti-alta" onSubmit={agregar}>
        <b>Agregar una promo</b>
        <div className="ti-alta-g">
          <input value={f.u} onChange={set('u')} placeholder="Cualquier link: un tema, un video, un servidor de Discord…" aria-label="Link" />
          <input value={f.quien} onChange={set('quien')} placeholder="De quién (nombre en la Lista, opcional)" maxLength={40} aria-label="De quién" />
          <input value={f.sv} onChange={set('sv')} placeholder="Servidor (sigla, opcional)" maxLength={6} aria-label="Servidor" />
          <select value={f.dias} onChange={set('dias')} aria-label="Cuántos días">{[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>)}</select>
          <button type="submit" className="btn chico" disabled={ocup}>Agregar</button>
        </div>
        <small>Va primera en Publicaciones, en las historias y, si pones de quién, en su perfil. Sin el tope de dos por persona.</small>
        {mano.length ? <ul className="ti-alta-p">{mano.map((x) => (
          <li key={x.u}><a href={x.u} target="_blank" rel="noopener noreferrer">{x.u.replace(/^https:\/\/(www\.)?/, '').slice(0, 48)}</a>
            {/* 📅 con diaISO y en corto (18/11/2026): `toLocaleDateString` iba en la zona del dispositivo y con otro formato */}
            {x.quien ? ' · ' + x.quien : ''} · {x.dias} {x.dias === 1 ? 'día' : 'días'} desde el {corto(diaISO(new Date(x.t)))}
            <button type="button" className="ti-ben-x" disabled={ocup} onClick={() => sacarMia(x.u)}>quitar</button></li>
        ))}</ul> : null}
      </form>
      <form className="ti-alta" onSubmit={sacar}>
        <b>Sacar una promo</b>
        <div className="ti-alta-g">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pega el link de la promo" aria-label="Link de la promo que sale" />
          <button type="submit" className="btn chico" disabled={ocup}>Sacar</button>
        </div>
        <small>Sirve para cualquiera: la de un canal de promoción, la de la Liga o una tuya. El link se copia de la promo en Publicaciones.</small>
        {quitar.length ? <ul className="ti-alta-p">{quitar.map((u) => (
          <li key={u}>{u.replace(/^https:\/\/(www\.)?/, '').slice(0, 56)}
            <button type="button" className="ti-ben-x" disabled={ocup} onClick={() => devolver(u)}>devolver</button></li>
        ))}</ul> : null}
      </form>
      {mal ? <p className="ti-bajo" role="alert">{mal}</p> : null}
    </div>
  );
}

// ➕ EL ALTA DE UN SERVIDOR (Dlx, 20/10/2026: «agrega esa función para yo agregar a los servidores manualmente»). Se guarda
// en el ajuste `altas` y el ciclo lo suma (`altas()` de bot/tiers.py): la entrada, el bot y la invitación de la Liga
function SumarServidor({ T, aj, hacer, ocup }) {
  const [f, setF] = useState({ sv: '', n: '', g: '', t: 3, tag: '' });
  const [mal, setMal] = useState('');
  const ya = new Set((T.servidores || []).map((x) => x.sv));
  const pend = Object.entries(aj.altas || {}).filter(([sv]) => !ya.has(sv));
  const set = (k) => (e) => setF(Object.assign({}, f, { [k]: k === 't' ? Number(e.target.value) : e.target.value }));
  const mandar = async (e) => {
    e.preventDefault();
    const sv = f.sv.trim().toUpperCase();
    if (!/^[A-Z]{2,6}$/.test(sv)) return setMal('La sigla: de 2 a 6 letras, sin números ni espacios.');
    if (ya.has(sv)) return setMal(sv + ' ya está en la Liga.');
    if (!f.n.trim()) return setMal('Falta el nombre.');
    if (!/^[0-9]{15,22}$/.test(f.g.trim())) return setMal('El ID del servidor: en Discord, clic derecho en el servidor → «Copiar ID del servidor».');
    setMal('');
    const nuevo = { n: f.n.trim(), g: f.g.trim(), t: f.t };
    if (f.tag.trim()) nuevo.tag = f.tag.trim().toUpperCase();
    const bien = await hacer('altas', Object.assign({}, aj.altas || {}, { [sv]: nuevo }),
      sv + ' entra en la próxima vuelta del ciclo, como Tier ' + f.t + '. Si el bot está adentro, también su invitación.');
    if (bien) setF({ sv: '', n: '', g: '', t: 3, tag: '' });
    return null;
  };
  const quitar = (sv) => {
    const o = Object.assign({}, aj.altas || {});
    delete o[sv];
    hacer('altas', o, sv + ' ya no se suma.');
  };
  return (
    <form className="ti-alta" onSubmit={mandar}>
      <b>Sumar un servidor</b>
      <div className="ti-alta-g">
        <input value={f.sv} onChange={set('sv')} placeholder="Sigla (FDS)" maxLength={6} aria-label="Sigla" />
        <input value={f.n} onChange={set('n')} placeholder="Nombre" maxLength={60} aria-label="Nombre" />
        <input value={f.g} onChange={set('g')} placeholder="ID del servidor de Discord" inputMode="numeric" aria-label="ID del servidor" />
        <input value={f.tag} onChange={set('tag')} placeholder="Etiqueta (opcional)" maxLength={24} aria-label="Etiqueta" />
        <select value={f.t} onChange={set('t')} aria-label="Tier">{[1, 2, 3].map((t) => <option key={t} value={t}>Tier {t}</option>)}</select>
        <button type="submit" className="btn verde chico" disabled={ocup}>Sumar</button>
      </div>
      <small>Entra confirmado y con lo que da su tier; después le cambias los beneficios en su caja. Sumar al ranking pide sumarlo al
        código (pídeselo a Claude): hasta entonces sus llaves no suman. El bot tiene que estar adentro para leer sus anuncios.</small>
      {mal ? <small className="ti-bajo" role="alert">{mal}</small> : null}
      {pend.length ? <ul className="ti-alta-p">{pend.map(([sv, x]) => (
        <li key={sv}><b>{sv}</b> {x.n} · Tier {x.t} · espera la próxima vuelta del ciclo
          <button type="button" className="ti-ben-x" disabled={ocup} onClick={() => quitar(sv)}>quitar</button></li>
      ))}</ul> : null}
    </form>
  );
}
// 🧭 LOS QUE ENTRARON SOLOS CON /setup (19/11/2026, Dlx: «tus elecciones», la 4A). Ya están en la Liga (Tier 3, sus
// anuncios, su página y su kit); lo único que espera es si sus eventos suman a la Temporada. Es el ajuste `setup_suma`
// (`{guild: {si, t}}`), el MISMO que escriben los botones del DM: lo último que toques, acá o allá, es lo que vale, y el
// ciclo lo aplica en su próxima vuelta (`aprobar_setup()` de bot/tiers.py)
const PLANT = { completa: 'Liga completa', basico: 'Lo básico', leer: 'Sólo leer' };
// 🏛️ EL CONSEJO DE SOCIOS (20/11/2026, Dlx: «Tú propones, 1 voto por servidor», «manda salvo veto mío», «Sí, a las 48 h»):
// propones acá, vota cada servidor Tier 1 o 2 desde su panel (7 días, o antes si votan todos), gana el sí con más votos que
// el no y tienes 48 h para vetarlo. Ver `consejoDueno()` en bot/avisos.js
const CONSEJO_EST = { abierta: ['Votando', ''], veto: ['Ganó: puedes vetarla', 'ojo'], aprobada: ['Aprobada', ''], no_paso: ['No pasó', ''], vetada: ['Vetada', ''] };
async function pedirConsejo(cuerpo) {
  try {
    const r = await fetch('/api/avisos/dueno/consejo', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({}));
    return r.ok && !j.error ? j : { error: j.error || String(r.status) };
  } catch (e) { return { error: 'red' }; }
}
function Consejo() {
  const [j, setJ] = useState(null);
  const [f, setF] = useState({ titulo: '', texto: '' });
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  useEffect(() => { pedirConsejo({ accion: 'ver' }).then(setJ); }, []);
  const hacer = (cuerpo, listo) => {
    setOcup(true); setMsg('');
    pedirConsejo(cuerpo).then((x) => {
      setOcup(false);
      if (x.error) { setMsg(x.error === 'fuera_de_plazo' ? 'Ya pasaron las 48 h para vetarla.' : 'No se pudo: ' + x.error + '.'); return; }
      setJ(x); setMsg(listo);
      if (cuerpo.accion === 'crear') setF({ titulo: '', texto: '' });
    });
  };
  if (!j) return <p className="db-tx">Cargando…</p>;
  if (j.error) return <p className="db-tx">No pude leer el consejo ({j.error}).</p>;
  return (
    <div className="dz-cons">
      <p className="db-tx">Votan {(j.votan || []).map(siglaDe).join(', ') || 'nadie todavía'}: un voto por servidor, del dueño o sus admins, durante 7 días.</p>
      <div className="dz-cons-f">
        <input value={f.titulo} maxLength={120} placeholder="La propuesta, en una línea" aria-label="La propuesta" onChange={(e) => setF(Object.assign({}, f, { titulo: e.target.value }))} />
        <textarea value={f.texto} maxLength={1200} rows={2} placeholder="Si hace falta, el detalle" aria-label="El detalle" onChange={(e) => setF(Object.assign({}, f, { texto: e.target.value }))} />
        <button type="button" className="btn verde chico" disabled={ocup || !f.titulo.trim()} onClick={() => hacer({ accion: 'crear', titulo: f.titulo.trim(), texto: f.texto.trim() }, 'Propuesta: les llega a los dueños en su bandeja.')}>Proponer</button>
      </div>
      {(j.lista || []).length ? <ul className="dz-cons-l">{j.lista.map((c) => {
        const [et, cl] = CONSEJO_EST[c.estado] || [c.estado, ''];
        return (
          <li key={c.id}>
            <div><b>{c.titulo}</b>{c.texto ? <small>{c.texto}</small> : null}
              <small>Sí {c.si} · No {c.no} · se abstienen {c.abs} · votaron {c.votaron} de {c.total}{c.estado === 'abierta' ? ' · cierra en ' + Math.max(1, Math.ceil((c.cierra - Date.now()) / 864e5)) + ' días' : ''}{c.estado === 'veto' ? ' · puedes vetarla hasta ' + hora(new Date(c.veto_hasta)) : ''}</small></div>
            <span className={'db-chip' + (cl ? ' ' + cl : '')}>{et}</span>
            <span className="dz-cons-b">
              {c.estado === 'veto' ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo: la vetas" onClick={() => hacer({ accion: 'vetar', id: c.id }, 'Vetada.')}>Vetar</DosToques> : null}
              <DosToques className="dz-lnk" disabled={ocup} confirmar="Toca de nuevo para borrarla" onClick={() => hacer({ accion: 'borrar', id: c.id }, 'Borrada.')}>Borrar</DosToques>
            </span>
          </li>
        );
      })}</ul> : <p className="db-tx">Todavía no propusiste nada.</p>}
      {msg ? <p className="db-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// 🆕 LO NUEVO PRIMERO (20/11/2026, Dlx: «Prueban lo nuevo antes»): lo que los Tier 1 prueban unos días antes que el resto;
// sale en su panel hasta el día que pongas (`lo_nuevo_t1`)
function LoNuevoT1({ aj, hacer, ocup }) {
  const xs = aj.lo_nuevo_t1 || [];
  const [f, setF] = useState({ texto: '', hasta: '' });
  return (
    <div className="dz-cons">
      {xs.length ? <ul className="dz-cons-l">{xs.map((y, i) => (
        <li key={i}><div><b>{y.texto}</b><small>hasta el {corto(y.hasta)}</small></div>
          <span className="dz-cons-b"><button type="button" className="dz-lnk" disabled={ocup} onClick={() => hacer('lo_nuevo_t1', xs.filter((_z, j) => j !== i), 'Sacado del panel de los Tier 1.')}>Sacar</button></span></li>
      ))}</ul> : <p className="db-tx">Nada en prueba ahora.</p>}
      <div className="dz-cons-f">
        <input value={f.texto} maxLength={240} placeholder="Qué prueban, en una línea" aria-label="Qué prueban" onChange={(e) => setF(Object.assign({}, f, { texto: e.target.value }))} />
        <input type="date" value={f.hasta} aria-label="Hasta cuándo" onChange={(e) => setF(Object.assign({}, f, { hasta: e.target.value }))} />
        <button type="button" className="btn verde chico" disabled={ocup || !f.texto.trim() || !f.hasta || xs.length >= 6}
          onClick={() => { hacer('lo_nuevo_t1', [...xs, { texto: f.texto.trim(), hasta: f.hasta }], 'Sale en el panel de los Tier 1 hasta el ' + corto(f.hasta) + '.'); setF({ texto: '', hasta: '' }); }}>Avisar a los Tier 1</button>
      </div>
    </div>
  );
}

function SetupNuevos({ lista, aj, hacer, ocup }) {
  if (!lista || !lista.length) return null;
  const dec = aj.setup_suma || {};
  const decidir = (x, si) => hacer('setup_suma', Object.assign({}, dec, { [x.g]: { si, t: Date.now() } }),
    (x.nombre || x.sigla) + (si ? ': sus eventos suman a la Temporada (Tier 3) desde la próxima vuelta del ciclo.'
      : ': todavía no suma. Lo puedes cambiar cuando quieras.'));
  return (
    <div className="ti-alta">
      <small>Entran solos y como Tier 3: sus anuncios, su página y su kit. Sus puntos de Temporada esperan tu respuesta (también te llegó por DM).</small>
      <ul className="ti-alta-p">{lista.map((x) => {
        const d = dec[x.g] || null;
        return (
          <li key={x.g}><b>{x.sigla || '—'}</b> {x.nombre} · {x.miembros ? num(x.miembros) + ' miembros · ' : ''}{PLANT[x.pl] || x.pl}
            {' · '}{x.admin ? 'el bot es Administrador' : (x.faltan || []).length ? 'al bot le falta ' + x.faltan.join(', ').toLowerCase() : 'el bot tiene lo que necesita'}
            {' · '}{hace(x.t)}
            {x.fuera ? <span> · <b>estaba fuera de la Liga</b>: no entra solo (súmalo arriba si lo quieres)</span>
              : <span> · {d && d.si ? '✅ suma' : d ? '⏸️ todavía no' : '⏳ espera tu respuesta'}
                {' '}<button type="button" className="ti-ben-x" disabled={ocup || (d && d.si)} onClick={() => decidir(x, true)}>Que sumen · Tier 3</button>
                {' '}<button type="button" className="ti-ben-x" disabled={ocup || (d && !d.si)} onClick={() => decidir(x, false)}>Todavía no</button></span>}
          </li>
        );
      })}</ul>
    </div>
  );
}
const REC = { bien: ['✅', 'Bien'], subir: ['⬆️', 'Puede subir'], revisar: ['⚠️', 'Revisar'], casa: ['🏠', 'La casa'] };
const PARTES = [['actividad', 'Actividad', 35], ['alcance', 'Alcance', 25], ['calidad', 'Calidad', 25], ['comunidad', 'Comunidad', 15]];

/** 👑 El dueño de un socio para su panel (`#/socio`): el de Discord, que lee el ciclo, o el que pongas acá, que manda. */
function DuenoSocio({ x, aj, hacer, ocup }) {
  const mano = (aj.socios_duenos || {})[x.sv] || [];
  const [v, setV] = useState(mano.join(', '));
  const [mal, setMal] = useState('');
  const guardar = () => {
    const ids = v.split(/[\s,]+/).map((y) => y.trim()).filter(Boolean);
    if (ids.some((y) => !/^[0-9]{15,22}$/.test(y)) || ids.length > 3) { setMal('Hasta 3 Discord IDs (sólo números), separados por coma.'); return; }
    setMal('');
    const todos = Object.assign({}, aj.socios_duenos || {});
    if (ids.length) todos[x.sv] = ids; else delete todos[x.sv];
    hacer('socios_duenos', todos, ids.length ? 'El panel de ' + siglaDe(x.sv) + ' ahora lo ve ' + ids.join(', ') + '.' : 'El panel de ' + siglaDe(x.sv) + ' vuelve al dueño de Discord.');
  };
  return (
    <div className="ti-dueno">
      <small>Su panel lo ve: <b>{mano.length ? mano.join(', ') + ' (a mano)' : x.dueno ? x.dueno + ' (dueño en Discord)' : 'nadie todavía'}</b> · <a href={'#/socio?sv=' + x.sv}>Ver su panel</a></small>
      <span className="ti-dueno-f">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Otro Discord ID (hasta 3)" aria-label={'Quién ve el panel de ' + x.nombre} inputMode="numeric" />
        <button type="button" className="btn borde2 chico" disabled={ocup || v.trim() === mano.join(', ')} onClick={guardar}>Guardar</button>
      </span>
      {mal ? <small className="ti-bajo" role="alert">{mal}</small> : null}
    </div>
  );
}

// 🎟️ LOS PASES QUE REGALA UN TIER 1 (20/11/2026, Dlx: «Los asigno yo»): cuántos este mes y en qué eventos; el campeón de
// cada uno se lleva un Pase premium a su Inventario (bot/pases_t1.py). Y 🤝 SU ALIANZA («La armas tú, 2 Pases»): con qué
// Tier 2 o 3 va; cuando su aliado sube, +2 Pases para ese mes (`alianza_bonus()` de bot/tiers.py)
const mesET = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 7);
const claveDeEv = (e) => {
  const m = /\/([0-9]{15,22})\/?$/.exec(String((e && e.link) || ''));
  return m ? 'a:' + m[1] : e && e.ll && /^[0-9]{1,6}$/.test(String(e.ll)) ? String(e.ll) : '';
};
function PasesT1({ x, liga, aj, hacer, ocup }) {
  const mes = mesET();
  const todos = aj.pases_t1 || {};
  const mio = todos[x.sv] && todos[x.sv].mes === mes ? todos[x.sv] : { mes, n: 0, ev: [] };
  const [n, setN] = useState(mio.n);
  const [ev, setEv] = useState(mio.ev);
  const al = (aj.alianzas || {})[x.sv] || [];
  const cal = ((liga.d && liga.d.calendario) || []).filter((e) => e.sv === x.sv && String(e.t).slice(0, 7) >= mes);
  const prox = (liga.proximos ? liga.proximos() : []).filter((p) => p.sv === x.sv).map((p) => ({ n: p.nombre, t: p.cuando, link: p.link }));
  const ops = [];
  for (const e of [...cal, ...prox]) { const k = claveDeEv(e); if (k && !ops.some((o) => o[0] === k)) ops.push([k, e.n || e.nombre || '', e.t]); }
  for (const k of ev) if (!ops.some((o) => o[0] === k)) ops.push([k, k.startsWith('a:') ? 'un evento anunciado' : 'el evento #' + k, '']);
  const guardar = () => hacer('pases_t1', Object.assign({}, todos, { [x.sv]: { mes, n: Number(n) || 0, ev } }),
    siglaDe(x.sv) + ' regala ' + (Number(n) || 0) + ' Pases este mes: el ciclo se los da al campeón de cada evento marcado.');
  const otros = Object.keys(liga.svs || {}).filter((s) => s !== x.sv && (liga.svs[s] || {}).tier && (liga.svs[s] || {}).tier > 1);
  const bonos = x.alianza_bonus || [];
  return (
    <div className="ti-pases">
      <small>Pases para regalar · {mes}{bonos.length ? ' · +' + bonos.reduce((t, b) => t + (b.pases || 0), 0) + ' de su Alianza (' + bonos.map((b) => siglaDe(b.aliado) + ' subió a Tier ' + b.a).join(', ') + ')' : ''}</small>
      <label className="ti-pases-n"><span>Cuántos</span><input type="number" min="0" max="20" value={n} onChange={(e) => setN(e.target.value)} /></label>
      {ops.length ? <ul className="ti-pases-l">{ops.slice(0, 12).map(([k, nom, t]) => (
        <li key={k}><label><input type="checkbox" checked={ev.includes(k)} onChange={(e) => setEv(e.target.checked ? [...ev, k].slice(0, 12) : ev.filter((y) => y !== k))} />
          <span>{limpio(nom) || k}{t ? ' · ' + corto(diaISO(new Date(t))) : ''}</span></label></li>
      ))}</ul> : <p className="db-tx">Todavía no tiene eventos este mes para marcar.</p>}
      <button type="button" className="btn verde chico" disabled={ocup || (Number(n) === mio.n && ev.join() === mio.ev.join())} onClick={guardar}>Guardar los Pases</button>
      <small>Su Alianza: {al.length ? al.map(siglaDe).join(', ') : 'ninguna'}</small>
      <span className="ti-pases-al">{otros.map((s) => {
        const si = al.includes(s);
        return <button key={s} type="button" className={'btn chico ' + (si ? 'verde' : 'borde2')} aria-pressed={si} disabled={ocup}
          onClick={() => hacer('alianzas', Object.assign({}, aj.alianzas || {}, { [x.sv]: si ? al.filter((y) => y !== s) : [...al, s].slice(0, 5) }),
            si ? siglaDe(x.sv) + ' deja de acompañar a ' + siglaDe(s) + '.' : siglaDe(x.sv) + ' acompaña a ' + siglaDe(s) + ': si sube de tier, +2 Pases.')}>{siglaDe(s)}</button>;
      })}</span>
    </div>
  );
}

function TierCaja({ x, liga, tier, cambiar, ocup, i, aj, hacer }) {
  const pts = useNumero(x.puntos);
  const m = x.m || {};
  const [ic, et] = REC[x.rec] || ['', x.rec];
  return (
    <article className={'ti-caja r-' + x.rec} style={{ '--i': i }}>
      <header>
        {liga && liga.logo ? <img alt="" src={liga.logo(x.sv)} /> : null}
        <span><b>{x.nombre}</b><small>{siglaDe(x.sv)}</small></span>
        <label className="ti-sel"><span className="rk-sr">El tier de {x.nombre}</span>
          <select value={tier} disabled={ocup} onChange={(e) => cambiar(x.sv, Number(e.target.value))}>
            {[1, 2, 3].map((t) => <option key={t} value={t}>Tier {t}</option>)}
          </select></label>
      </header>
      <p className="ti-que">Tier {tier}: {TIER_QUE[tier]}</p>
      <div className="ti-pts"><b>{pts}</b><small>de 100{x.antes && x.compara !== false ? ' · antes ' + x.antes : ''}</small></div>
      <div className="ti-partes">{PARTES.map(([k, t, tope]) => (
        <div key={k} title={t + ': ' + ((x.partes || {})[k] || 0) + ' de ' + tope}>
          <span>{t}</span><i><u style={{ width: (100 * ((x.partes || {})[k] || 0) / tope).toFixed(0) + '%' }} /></i>
        </div>
      ))}</div>
      {/* 👥 los miembros, sólo recomendados (Dlx, 19/11/2026: «la cantidad no define»): uno por tier, `RECOMENDADO` de bot/tiers.py */}
      <p className="ti-m">{m.miembros ? <b>{num(m.miembros)} miembros{m.miembros < (MIEMBROS_REC[tier] || 0) ? ' (se recomiendan ' + num(MIEMBROS_REC[tier]) + ')' : ''} · </b> : null}{num(m.por_semana || 0)} eventos por semana · {num(m.por_evento || 0)} por evento · {num(m.nuevos || 0)} nuevos
        {m.nuevos ? ' (volvieron ' + Math.round((100 * (m.volvieron || 0)) / m.nuevos) + ' %)' : ''}
        {m.eventos ? ' · ' + (Math.round((10 * (m.ayudas || 0)) / m.eventos) / 10) + ' ayudas por llave' : ''}
        {m.anuncios ? ' · staff en ' + Math.round((100 * (m.con_staff || 0)) / m.anuncios) + ' % de sus anuncios' : ''}
        {m.cancelados ? ' · ' + m.cancelados + ' cancelados' : ''}{m.promos ? ' · ' + m.promos + ' promos' : ''}{m.ligas ? ' · ' + m.ligas + ' ligas' : ''}</p>
      {/* con la lista de abajo, el porqué de «no llega» va corto: el detalle está una línea más abajo */}
      <p className="ti-rec"><span>{ic} {et}</span> {((x.panel || {}).pide || []).length ? String(x.porque || '').replace(/^(no llega a lo que pide Tier \d+):.*$/, '$1') : x.porque}</p>
      {/* 📋 lo que pide su tier para quedarse, fila por fila: lo mismo que «En el aire» de su cabina (`pide()` de bot/tiers.py) */}
      {((x.panel || {}).pide || []).length ? (
        <div className="ti-pide">
          <small>Para quedarse en Tier {x.tier}{x.mide_desde ? ' · recién llegó: se mide desde el ' + corto(x.mide_desde) : ''}</small>
          <ul>{x.panel.pide.map(([q, c, si, cuenta]) => <li key={q} className={si ? 'ok' : x.mide_desde || cuenta ? '' : 'no'}><b>{si ? 'Hecho' : x.mide_desde || cuenta ? 'Va' : 'Falta'}</b> {q} · {c}{cuenta && !si ? ' · cuenta desde el ' + corto(cuenta) : ''}</li>)}</ul>
        </div>
      ) : null}
      {tier === 1 ? <PasesT1 x={x} liga={liga} aj={aj} hacer={hacer} ocup={ocup} /> : null}
      <Beneficios x={x} tier={tier} aj={aj} hacer={hacer} ocup={ocup} />
      <DuenoSocio x={x} aj={aj} hacer={hacer} ocup={ocup} />
    </article>
  );
}

function Tiers({ T, aj, hacer, ocup, msg, liga }) {
  if (!T || !(T.servidores || []).length) return <p className="pronto-p">El puntaje llega con la próxima vuelta del ciclo.</p>;
  const elegidos = aj.tiers || {};
  const tierDe = (x) => elegidos[x.sv] || x.tier || 1;
  const cambiar = (sv, t) => hacer('tiers', Object.assign({}, elegidos, { [sv]: t }),
    siglaDe(sv) + ' pasa a Tier ' + t + '. El ciclo lo aplica en su próxima vuelta' + (t === 3 ? ': deja de contar para el Competitivo.' : ': cuenta para la Temporada y el Competitivo.'));
  return (
    <div className="ti">
      <p className="db-tx">Las últimas {T.semanas || 4} semanas. El puntaje recomienda; <b>el nivel lo eliges tú</b>. Tier 1 suma a la Temporada y
        al Competitivo y lleva todo; Tier 2 lo mismo, menos «Unirme a los Tier 1»; Tier 3 suma a la Temporada (con 8 participantes
        o más) y tiene su página y sus ligas, que cuentan como duelos, sin Competitivo. Los eventos y las redes se promocionan en los tres. Los miembros no son requisito: se recomiendan 1.000 en Tier 1, 500 en Tier 2 y 100 en Tier 3.</p>
      {msg ? <p className="db-msg" role="status">{msg}</p> : null}
      <SumarServidor T={T} aj={aj} hacer={hacer} ocup={ocup} />
      <div className="ti-g">{T.servidores.map((x, i) => <TierCaja key={x.sv} x={x} liga={liga} tier={tierDe(x)} cambiar={cambiar} ocup={ocup} i={i} aj={aj} hacer={hacer} />)}</div>
      {T.t ? <p className="db-tx">Medido {hace(T.t)}.</p> : null}
    </div>
  );
}

// lo que está cerca del techo, para el panel del Inicio
// ⚠️ sólo con una medición de HOY en UTC, la regla de `deAyer` de Cuotas (18/11/2026): el cupo se renueva a medianoche
// UTC y las cuotas se piden una vez por visita, así que «casi llenas hoy» seguía saliendo toda la noche ya renovado
const cuotasEnRojo = (q) => (q && String(q.cuando || '').slice(0, 10) === new Date().toISOString().slice(0, 10)
  ? TOPES.filter(([g, k, , tope]) => ((q[g] || {})[k] || 0) >= 0.9 * tope) : []);
function Cuotas({ q }) {
  if (q === null) return <p className="pronto-p">Midiendo…</p>;
  if (!q) return <p className="pronto-p">Todavía no hay una medición del ciclo.</p>;
  const ahora = new Date();
  const renueva = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + 1));
  const deAyer = String(q.cuando || '').slice(0, 10) !== ahora.toISOString().slice(0, 10);
  const w = q.worker || {}, r2 = q.r2 || {};
  return (
    <div className="db-aj">
      <div className={'db-q' + (deAyer ? ' viejo' : '')}>{TOPES.map(([g, k, t, tope]) => {
        const v = (q[g] || {})[k];
        if (v == null) return null;
        const p = Math.min(100, (100 * v) / tope);
        return (
          <div key={t} className={'db-q-f' + (p >= 90 ? ' lleno' : p >= 70 ? ' ojo' : '')}>
            <span>{t}</span>
            <i><u style={{ width: p.toFixed(1) + '%' }} /></i>
            <b>{p >= 90 ? '⚠️ ' : ''}{corta(v)} <small>de {corta(tope)}</small></b>
          </div>
        );
      })}</div>
      <dl className="db-sis">
        {w.pedidos != null ? <div><dt>El Worker · 24 h</dt><dd>{num(w.pedidos)} pedidos · {w.cortados ? num(w.cortados) + ' cortados' : 'ninguno cortado'}{w.cpu ? ' · ' + num(w.cpu.worker_10) + ' pasaron los 10 ms' : ''}</dd></div> : null}
        {w.cpu ? <div><dt>El objeto · 24 h</dt><dd>{num(w.cpu.objeto_10)} pasaron los 10 ms (no tiene ese tope)</dd></div> : null}
        {r2.objetos != null ? <div><dt>R2 · las tarjetas y las fotos</dt><dd>{num(r2.objetos)} archivos · {String(r2.gb).replace('.', ',')} GB de 10</dd></div> : null}
      </dl>
      <p className="db-tx">{deAyer ? 'Esto es de antes de las ' + hora(new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))) + ', cuando se renovó: la próxima corrida lo mide de nuevo. ' : ''}Lo midió el ciclo {hace(q.cuando)}. Se renueva todos los días a las {hora(renueva)}; si KV se llena, la página y /card se quedan quietos hasta esa hora.</p>
    </div>
  );
}

// ── 🔴 lo que está en vivo ahora (05/10/2026: «estas llaves en vivo no se detectan») ───────────────────────────────
// De cada llave que se está tocando: a qué anuncio se juntó y cómo —por el nombre, o por la serie cuando el número no
// coincide (`LlaveVivo.deEvento()`)—, en qué ronda va y qué dijo el bot en el chat (`vivoDueno()` en bot/avisos.js).
function EnVivo({ vivo, liga, aj, chat }) {
  const dash = aj.en_vivo || {}, dashNivel = aj.en_vivo_nivel || {};
  const c = chat || {}, admin = c.admin || {}, niveles = c.niveles || {};
  const elBot = (sv) => {
    if (dash[sv] === false || (!admin[sv] && dash[sv] !== true)) return 'apagado en ' + siglaDe(sv);
    const n = niveles[dashNivel[sv]] ? dashNivel[sv] : niveles[(c.nivel || {})[sv]] ? c.nivel[sv] : 'normal';
    return 'prendido · ' + ((niveles[n] || [n])[0]).toLowerCase();
  };
  return (
    <ul className="db-vv">{vivo.map((v) => (
      <li key={v.link || v.titulo + v.ed}>
        <div className="db-l1">
          <img alt="" src={liga.logo(v.sv)} width="20" height="20" />
          <b>{limpio(v.anuncio || v.titulo || 'La llave')}</b>
          <span className="db-chip">{v.terminada ? 'terminó' : v.ronda || 'en juego'}</span>
          {!v.anuncio ? <span className="db-chip ojo">sin anuncio</span> : v.como === 'huerfana' ? <span className="db-chip ojo">por la serie</span> : null}
        </div>
        <small>
          {v.como === 'huerfana' ? 'La llave dice «' + limpio(v.titulo) + '»: el número no coincide, se juntó por la serie. ' : ''}
          {!v.anuncio ? 'No la pude juntar con ningún anuncio de las últimas 36 h: en la página sale con el título de la llave. ' : ''}
          {v.como === 'guardado' ? 'Su anuncio ya quedó atrás: es el nombre que el bot le dio cuando lo tenía. ' : ''}
          {v.gente ? v.gente + ' en la llave · ' : ''}tocada {hace(v.ed)}
        </small>
        <small>El bot: {elBot(v.sv)} · {v.chat && v.chat.mensajes ? v.chat.mensajes + ' mensaje(s), el último ' + hace(v.chat.t) : 'todavía no dijo nada'}</small>
        {v.link ? <a className="db-link" href={v.link} target="_blank" rel="noopener noreferrer">Abrir la llave en Discord ↗</a> : null}
      </li>
    ))}</ul>
  );
}

// ── 🎟️ el Pase de rapero, en números (`paseResumen()` en bot/avisos.js: nunca quién) ───────────────────────────────
// ── 🧭 EL TUTORIAL (Dlx, 12/10/2026, «E. Dale»): cuántos navegadores nuevos lo vieron y cuántos lo terminaron. Cada cosa
// cuenta una vez por navegador (web/src/primera.js) y acá llega sumada, nunca de quién (`tutorialResumen()`)
const PASOS_TUTO = ['la bienvenida', 'Eventos', 'Ranking', 'Tarjetas', 'Pase'];
function TutorialNumeros({ t }) {
  const v = (k) => ((t && t.n) || {})[k] || 0;
  const pct = (a, b) => (b ? Math.round((100 * a) / b) + ' %' : '—');
  const cajas = [
    ['VIERON EL RECORRIDO', v('tour'), v('repite') ? 'y ' + num(v('repite')) + ' lo pidieron otra vez en la Guía' : 'la primera vez que entraron, por el Inicio'],
    ['LO TERMINARON', v('tour_fin'), pct(v('tour_fin'), v('tour')) + ' de los que lo vieron'],
    // 🎮 la pantalla de bienvenida (19/10/2026)
    ['VIERON LA BIENVENIDA', v('bienv'), num(v('bienv_unirse')) + ' tocaron «Unirme» · ' + num(v('bienv_listo')) + ' terminaron · '
      + num(v('bienv_luego')) + ' «en otro momento»'],
    ['LLEGARON POR UN LINK', v('franja'), num(v('franja_si')) + ' tocaron «Ver cómo»'],
    ['PRIMEROS PASOS', v('pasos_fin'), 'completos, de ' + num(v('pasos')) + ' que los vieron en el Inicio'],
  ];
  const saltos = PASOS_TUTO.map((x, i) => [x, v('salta' + i)]).filter((x) => x[1]);
  return (
    <>
      <div className="act-4">{cajas.map(([k, n, d]) => <div key={k}><span>{k}</span><b>{num(n || 0)}</b><small>{d}</small></div>)}</div>
      <p className="db-tx">{saltos.length ? 'Dónde lo cortaron: ' + saltos.map(([x, n]) => x + ' ' + num(n)).join(' · ') + '.'
        : 'Nadie lo cortó a la mitad.'} Cuenta navegadores, no personas: quien cambia de celular cuenta otra vez.</p>
    </>
  );
}

// ── 📊 QUÉ SECCIONES SE ABREN (Dlx, 12/10/2026, el research «página sencilla»: medir antes de mover la tira). Cada
// navegador cuenta cada sección una vez por día (App.jsx, `lg:secc`) y acá llega sumado: esta semana y la anterior
const NOMBRE_SECC = { inicio: 'Inicio', eventos: 'Eventos', ranking: 'Ranking', publicaciones: 'Publicaciones',
  tarjetas: 'Tarjetas', ligas: 'Ligas', crews: 'Crews', salon: 'Salón de la fama', pase: 'Pase', tienda: 'Tienda', socios: 'Socios', guia: 'Guía', perfil: 'Un perfil',
  servidor: 'Un servidor', crew: 'Una crew', pais: 'Un país', cuenta: 'Mi cuenta', cambios: 'Novedades',
  'i-historias': 'Las historias', 'i-envivo': 'Lo de arriba (Ahora)', 'i-semana': 'Esta semana', 'i-ira': 'La barra IR A',
  'i-fechas': 'Fechas', 'i-sebusca': 'Se busca', 'i-noticias': 'Lo último', 'i-encuestas': 'Encuestas y Tus eventos',
  'i-raperos': 'Los que mandan', 'i-panel': 'Misiones', 'i-merch': 'La Tienda (ropa)', 'i-numeros': 'La Liga en números',
  'p-eventos': 'Puerta · Eventos', 'p-ranking': 'Puerta · Ranking', 'p-mw': 'Puerta · Se busca', 'p-tarjetas': 'Puerta · Tarjetas',
  'p-pase': 'Puerta · Pase', 'p-tienda': 'Puerta · Tienda' };
// la página de cada servidor llega como «sv-URBF»: con la sigla que se lee (URB, LCW, CYH), no el código (12/11/2026)
const nombreSecc = (k) => NOMBRE_SECC[k] || (/^sv-/i.test(k) ? 'Servidor ' + siglaDe(k.slice(3).toUpperCase()) : k);
// 👥 LOS NÚMEROS DE LAS CREWS (19/10/2026, `crewNumeros()` de bot/crews.js): esta semana contra la anterior, y hoy
const CREW_NUM = [['creada', 'Crews armadas'], ['entro', 'Entraron a una crew'], ['link', '… con un link'],
  ['invito', 'Invitaciones mandadas'], ['se_cambio', 'Se cambiaron de crew'], ['link_nuevo', 'Links armados'],
  ['salio', 'Salieron'], ['cerrada', 'Crews cerradas o borradas'], ['quedo', 'Pasaron su primera semana'],
  ['verifico', 'Se verificaron (estaban sin verificar)'], ['salio_sin_verificar', 'Salieron por no verificarse']];
function CrewsNumeros({ c }) {
  const s = c.semana || {}, a = c.antes || {}, h = c.hoy || {};
  const filas = CREW_NUM.filter(([k]) => s[k] || a[k]);
  const tope = Math.max(1, ...filas.map(([k]) => s[k] || 0));
  return (
    <div className="db-aj">
      <p className="db-tx"><b>Hoy:</b> {num(h.crews || 0)} crews ({num(h.de_la_gente || 0)} armadas por la gente) · {num(h.gente || 0)} personas en una crew{h.sin_verificar ? ' (' + num(h.sin_verificar) + ' sin verificar)' : ''} · {num(h.links || 0)} links
        abiertos · {num(c.paneles || 0)} {c.paneles === 1 ? 'dueño abrió' : 'dueños abrieron'} su panel de socio esta semana.</p>
      {filas.length ? (
        <div className="db-q">{filas.map(([k, t]) => (
          <div key={k} className="db-q-f"><span>{t}</span><i><u style={{ width: ((100 * (s[k] || 0)) / tope).toFixed(1) + '%' }} /></i>
            <b>{num(s[k] || 0)} <small>{a[k] ? 'antes ' + num(a[k]) : 'esta semana'}</small></b></div>
        ))}</div>
      ) : <p className="pronto-p">Todavía no pasó nada esta semana.</p>}
      <p className="db-tx">Los últimos 7 días y, al lado, los 7 de antes. Sirve para saber qué se usa de las crews antes de cambiar algo.</p>
    </div>
  );
}

function SeccionesNumeros({ s, toques }) {
  // `toques`: lo que se toca en el Inicio (`i-` y `p-`); si no, las secciones que se abren
  const filas = Object.entries((s && s.n) || {}).filter(([k]) => /^[ip]-/.test(k) === !!toques).map(([k, v]) => [k, v[0] || 0, v[1] || 0])
    .filter((f) => f[1] || f[2]).sort((a, b) => b[1] - a[1] || b[2] - a[2]);
  const tope = Math.max(1, ...filas.map((f) => f[1]));
  if (!filas.length) return <p className="pronto-p">Todavía no se abrió ninguna.</p>;
  return (
    <div className="db-aj">
      <div className="db-q">{filas.map(([k, n, ant]) => (
        <div key={k} className="db-q-f"><span>{nombreSecc(k)}</span><i><u style={{ width: ((100 * n) / tope).toFixed(1) + '%' }} /></i>
          <b>{num(n)} <small>{ant ? 'antes ' + num(ant) : 'esta semana'}</small></b></div>
      ))}</div>
      <p className="db-tx">{toques ? 'Cuántos celus o compus tocaron algo de cada bloque del Inicio, o cada puerta, en los últimos 7 días (una vez por día cada uno). Para decidir qué sube, qué baja y qué sobra con números.'
        : 'Cuántos celus o compus abrieron cada sección en los últimos 7 días (cada uno cuenta una vez por día), y la semana anterior al lado. Sirve para ordenar la barra de abajo por lo que la gente usa.'}</p>
    </div>
  );
}

// 👆 QUÉ SE TOCA EN TODA LA PÁGINA (16/10/2026, `clics()` en bot/avisos.js): cada botón o link, por sección
const NOMBRE_SECC_C = Object.assign({}, NOMBRE_SECC, { otra: 'Otra', dashboard: 'Dashboard', ajustes: 'Ajustes',
  misiones: 'Misiones', ligas: 'Ligas' });
function ClicsNumeros({ c }) {
  const filas = Object.entries((c && c.n) || {}).map(([k, v]) => [k, v[0] || 0, v[1] || 0]).filter((f) => f[1] || f[2]);
  if (!filas.length) return <p className="pronto-p">Todavía no se tocó nada desde que se cuenta.</p>;
  const tope = Math.max(1, ...filas.map((f) => f[1]));
  return (
    <div className="db-aj">
      <div className="db-q">{filas.slice(0, 50).map(([k, n, ant]) => {
        const i = k.indexOf(':');
        const sec = k.slice(0, i), et = k.slice(i + 1);
        return (
          <div key={k} className="db-q-f"><span><small>{NOMBRE_SECC_C[sec] || nombreSecc(sec)}</small> {et}</span>
            <i><u style={{ width: ((100 * n) / tope).toFixed(1) + '%' }} /></i>
            <b>{num(n)} <small>{ant ? 'antes ' + num(ant) : 'esta semana'}</small></b></div>
        );
      })}</div>
      <p className="db-tx">Cuántas veces se tocó cada botón o link en los últimos 7 días, en cada sección, y la semana anterior al lado. «→ perfil» es un link que lleva a un perfil; lo demás es el texto del botón. Nunca dice quién.</p>
    </div>
  );
}

// 📊 EL TABLERO DEL PASE (25/10/2026; el informe «Pase de rapero enganche», cambio 1, y Dlx: «dale»): una fila por semana
// con cuántos había y qué parte estaba entre el 1 y el 3 —es la foto del antes para cada cambio del Pase—, y los días que
// la diaria tocó «mirar una llave en vivo» sin que nadie mirara ninguna (casi seguro, un día sin evento)
function FotosPase({ p }) {
  const fotos = p.fotos || [];
  const v = p.vivo || [0, 0];
  if (!fotos.length && !v[0]) return null;
  return (
    <>
      {fotos.length ? (
        <div className="db-tabla"><table><thead><tr><th>Semana</th><th>Con nivel</th><th>Del 1 al 3</th><th>Del 4 al 9</th><th>10 o más</th><th>El más alto</th></tr></thead>
          <tbody>{fotos.map(([s, d]) => {
            const xs = Object.entries(d || {}).map(([n, k]) => [Number(n), k]);
            const tot = xs.reduce((a, x) => a + x[1], 0) || 1;
            const de = (a, b) => xs.filter((x) => x[0] >= a && x[0] <= b).reduce((m, x) => m + x[1], 0);
            const pct = (k) => Math.round((100 * k) / tot) + ' %';
            return <tr key={s}><td>{s}</td><td>{num(tot)}</td><td>{pct(de(1, 3))}</td><td>{pct(de(4, 9))}</td><td>{pct(de(10, 999))}</td>
              <td>{xs.length ? Math.max(...xs.map((x) => x[0])) : '—'}</td></tr>;
          })}</tbody></table></div>
      ) : null}
      {v[0] ? <p className="db-tx">La diaria «Mira una llave en vivo» tocó <b>{v[0]}</b> {v[0] === 1 ? 'día' : 'días'}; en <b>{v[1]}</b> nadie miró ninguna (casi seguro, sin evento). Tiene que dar 0.</p> : null}
    </>
  );
}

function PaseNumeros({ p, liga }) {
  const dist = Object.entries(p.dist || {}).map(([n, k]) => [Number(n), k]).sort((a, b) => a[0] - b[0]);
  const tope = Math.max(1, ...dist.map((x) => x[1]));
  const hechas = (p.tareas || []).reduce((s, x) => s + x[1], 0);
  const cajas = [
    ['MIEMBROS DE DRA', p.miembros, 'los que pueden jugarlo'],
    ['CON NIVEL', p.con_nivel, 'llegaron al nivel 1 o más'],
    ['TAREAS ESTA SEMANA', hechas, p.hasta ? 'hasta ' + liga.dia(p.hasta) : 'entre todos'],
    ['EL NIVEL MÁS ALTO', dist.length ? dist[dist.length - 1][0] : 0, 'de ' + p.niveles + (p.salon ? ' · ' + p.salon + ' en el Salón' : '')],
  ];
  return (
    <>
      <div className="act-4">{cajas.map(([t, v, d]) => <div key={t}><span>{t}</span><b>{num(v || 0)}</b><small>{d}</small></div>)}</div>
      {dist.length ? (
        <div className="db-aj"><div className="db-q">{dist.map(([n, k]) => {
          // 📊 trabados: de los de ese nivel, cuántos no cumplen una Tarea hace 7 días o más (25/10/2026)
          const tr = (p.trabados || {})[n];
          return (
            <div key={n} className="db-q-f"><span>Nivel {n}</span><i><u style={{ width: ((100 * k) / tope).toFixed(1) + '%' }} /></i>
              <b>{num(k)} <small>{k === 1 ? 'persona' : 'personas'}{tr && tr[1] ? ' · ' + tr[1] + ' trabad' + (tr[1] === 1 ? 'o' : 'os') : ''}</small></b></div>
          );
        })}</div>
        <p className="db-tx">«Trabados»: sin cumplir una Tarea hace 7 días o más. Es dónde se cae la gente del Pase.</p>
        {/* las Tareas de hoy, de la semana y de la temporada (con XP desde el 06/10/2026), con el % de los que tienen nivel */}
        {[['hoy', p.hoy], ['esta semana', p.tareas], ['en la temporada', p.temporada]].some(([, xs]) => (xs || []).length) ? (
          <ul className="db-corr">{[['hoy', p.hoy], ['esta semana', p.tareas], ['en la temporada', p.temporada]].flatMap(([cu, xs]) =>
            (xs || []).map(([t, k]) => <li key={cu + t}><b>{limpio(t)}</b><span>{num(k)} {k === 1 ? 'vez' : 'veces'} {cu}
              {p.con_nivel ? ' · ' + Math.round((100 * k) / p.con_nivel) + ' %' : ''}</span></li>))}</ul>
        ) : null}
        <FotosPase p={p} />
        </div>
      ) : <p className="pronto-p">Todavía nadie cumplió una Tarea.</p>}
    </>
  );
}

// ── 🔔 la campana: pausarla (no sale ningún aviso) y reanudarla ──────────────────────────────────────────────────────
function AjCampana({ aj, hacer, ocup }) {
  const p = !!aj.campana_pausada;
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>La campana</h3><span className={'db-est' + (p ? ' ojo' : ' ok')}>{p ? '⏸ En pausa' : '● Suena'}</span></div>
      <p className="db-tx">En pausa no sale ningún aviso. Los de los eventos que se anuncien en ese rato no se mandan; los personales esperan y salen al reanudar, si siguen frescos. La página de Eventos dice que está en pausa.</p>
      <div className="cu-btns">
        {p ? <button type="button" className="btn verde chico" disabled={ocup} onClick={() => hacer('campana_pausada', false, 'La campana vuelve a sonar.')}>Reanudar</button>
          : <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para pausar" onClick={() => hacer('campana_pausada', true, 'La campana quedó en pausa.')}>Pausar la campana</DosToques>}
      </div>
    </div>
  );
}

// ── 🎟️ EL SORTEO DEL PASE PREMIUM (Dlx, 25/10/2026: «voy a sortear el rol de Pase de temporada en DRA», y «algo
// interactivo en la página»). Se programa acá: un nombre, cuándo cierra y cuándo se sortea (tu hora). La gente entra
// gratis desde el Pase; a la hora, el vigía elige al ganador con una cuenta que cualquiera repite, la página lo muestra
// en vivo y sale en Publicaciones. El rol «Pase Premium» se lo pone el bot (`sorteoRol()`): «Pase T» es de la
// suscripción del servidor y nadie puede ponerlo a mano ──
const aLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); const z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()); };
// 🎟️ LAS MEJORAS DEL 12/11/2026 (Dlx: «make better the sorteo thing», y eligió las cuatro): el código del sorteo se arma
// solo (`premium-AAAAMMDD`), las fechas tienen botones de un toque (cierra a las 10 PM de ese día y se sortea una hora
// después), ya sorteado se ve el resultado y un «Nuevo sorteo» en vez del formulario viejo, la lista de quién entró y
// los anteriores (`/api/avisos/dueno/sorteo`, sólo con el permiso de ajustes) y «Volver a sortear» si el ganador ya no
// está en DRA. ⚠️ Esa ruta es del Worker: hasta que se despliegue, la lista y el historial no salen (no rompe nada)
const SORTEO_DIAS = [[1, 'Mañana'], [3, 'En 3 días'], [7, 'En una semana']];
const cierreEn = (dias) => { const d = new Date(Date.now() + dias * 864e5); d.setHours(22, 0, 0, 0); return d; };
const idSorteo = (sorteo, usados) => {
  const d = new Date(sorteo); const z = (n) => String(n).padStart(2, '0');
  const base = 'premium-' + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate());
  let id = base, i = 2;
  while (usados.has(id)) id = base + '-' + i++;
  return id;
};
export function AjSorteo({ liga, aj, hacer, ocup }) {
  const S = aj.pase_sorteo || null;
  const [f, setF] = useState(null);           // el formulario abierto: `{cierra, sorteo, nuevo}`, o null
  const [est, setEst] = useState(null);       // lo público: cuántos entraron y el resultado
  const [du, setDu] = useState(null);         // lo del dueño: quién entró, los anteriores
  const [busy, setBusy] = useState(false);
  const [msj, setMsj] = useState('');
  // 👤 los perfiles, para nombrar a quien está fuera de las 200 filas (18/11/2026): se redibuja cuando llegan
  usePerfiles();
  const pedir = () => {
    fetch('/api/avisos/sorteo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then((r) => (r.ok ? r.json() : null)).then(setEst).catch(() => setEst(null));
    fetch('/api/avisos/dueno/sorteo', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{"accion":"ver"}' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => setDu(j && j.ok ? j : null)).catch(() => setDu(null));
  };
  useEffect(() => { if (S) pedir(); else setEst(null); }, [S && S.id, S && S.cierra, S && S.sorteo, ocup]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = est && est.sorteo, res = est && est.resultado;
  // 👤 el nombre aunque no esté en la tabla (18/11/2026): `liga.T` trae 200 filas, y quien ganaba o entraba fuera de
  // ellas salía con la clave cruda («lautarolasinceridad»). Y el plural de «boletos» con su singular, como «persona»
  // 👤 y quien no tiene perfil, con su nombre en DRA (21/11/2026: salía «(sin perfil)» y no había cómo saber quién era)
  const nom = (k, dn) => (k ? liga.nombreDe(k) : dn ? dn + ' (sin perfil)' : '(sin perfil)');
  const gan = du && du.ganador;
  const gk = (res && res.k) || (gan && gan.k) || '';
  const ahora = Date.now();
  const abierto = !!S && ahora < Date.parse(S.cierra), porSortear = !!S && !res && ahora >= Date.parse(S.cierra);
  const usados = new Set([...((du && du.hist) || []).map((h) => h.id), S && S.id].filter(Boolean));
  const ok = !!f && f.cierra && f.sorteo && Date.parse(f.cierra) <= Date.parse(f.sorteo);
  const abrirNuevo = () => { const c = cierreEn(3); setF({ cierra: aLocal(c), sorteo: aLocal(new Date(+c + 3600000)), nuevo: true }); };
  const abrirCambio = () => setF({ cierra: aLocal(S.cierra), sorteo: aLocal(S.sorteo), nuevo: false });
  const rapido = (dias) => { const c = cierreEn(dias); setF({ ...f, cierra: aLocal(c), sorteo: aLocal(new Date(+c + 3600000)) }); };
  const guardar = async () => {
    const nuevoId = f.nuevo || !S;
    const id = nuevoId ? idSorteo(f.sorteo, usados) : S.id;
    await hacer('pase_sorteo', { id, cierra: new Date(f.cierra).toISOString(), sorteo: new Date(f.sorteo).toISOString() },
      nuevoId ? 'Sorteo programado: la gente ya puede entrar desde el Pase.' : 'Fechas cambiadas.');
    setF(null);
  };
  // sin la hora en el texto: la verían igual en todas las zonas. El aviso se va solo cuando cierra (`hasta`)
  const avisar = () => hacer('aviso_web', { texto: '🎟️ El sorteo del Pase premium está abierto: entra gratis desde la pestaña Premium del Pase.',
    hasta: new Date(S.cierra).toISOString() }, 'Aviso puesto arriba de la página hasta que cierre.');
  // 🛠️ LO QUE DLX ARREGLA A MANO (21/11/2026: «agrega funciones para que lo arregle yo»): volver a sortear, darle el premio
  // a otro de los que entraron, sacarle el rol a quien no corresponde y volver a ponérselo. Ver `sorteoDueno()` (avisos.js)
  const accion = async (cuerpo, bien) => {
    setBusy(true); setMsj('');
    try {
      const r = await fetch('/api/avisos/dueno/sorteo', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const j = r.ok ? await r.json() : null;
      setMsj(j && j.ok ? bien : 'No se pudo: ' + ((j && j.error) || 'el servidor no contestó'));
      pedir();
    } finally { setBusy(false); }
  };
  const rehacer = () => accion({ accion: 'rehacer' }, 'Listo: en menos de un minuto sale el ganador nuevo, entre los demás.');
  const elegir = (p) => accion({ accion: 'elegir', ref: p.ref }, 'Listo: ' + nom(p.k, p.dn) + ' es el ganador. El bot le pone el rol en un minuto.');
  const sacarRol = (cual) => accion({ accion: 'sacar_rol', cual }, 'Listo: se le sacó el rol «Pase Premium».');
  const ponerRol = () => accion({ accion: 'reintentar_rol' }, 'Listo: el bot le pone el rol en un minuto.');
  const quedan = ((du && du.partes) || []).filter((p) => !p.gana).length;
  // ○ un sorteo sin nadie (18/11/2026): `sortear()` (avisos.js) no escribe resultado con 0 personas, así que pasada la
  // hora quedaba en «⏳ Por sortear» para siempre y en verde. Ya no se va a sortear: se dice, y en gris
  const nadie = porSortear && !!s && !s.personas && ahora >= Date.parse(S.sorteo);
  const estado = res ? '✓ Sorteado' : abierto ? '● Abierto' : nadie ? '○ Nadie entró' : porSortear ? '⏳ Por sortear' : 'Sin sorteo';
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>El sorteo del premium</h3><span className={'db-est' + (S && !res && !nadie ? ' ok' : '')}>{estado}</span></div>
      <p className="db-tx">La gente entra gratis desde la pestaña Premium del Pase: 1 boleto, y uno más por cada semana con las cinco semanales (hasta 3). A la hora se sortea solo, se ve en vivo en la página y sale en Publicaciones. El bot le pone el rol «Pase Premium» al ganador.</p>

      {S && res && !f ? (
        <div className="db-sr-res">
          <Cara liga={liga} k={gk} nombre={nom(gk, gan && gan.dn)} cls="db-sr-cara" />
          <div className="db-sr-txt">
            <span className="db-sr-et">Ganó</span>
            <b className="db-sr-gan">{nom(gk, gan && gan.dn)}</b>
            <span className="db-sr-dato">{liga.dia(res.t)} · entre {num(res.personas)} {res.personas === 1 ? 'persona' : 'personas'} y {num(res.boletos)} {res.boletos === 1 ? 'boleto' : 'boletos'}</span>
            <span className={'db-sr-rol' + (res.rol === -1 ? ' mal' : res.rol === 1 ? ' bien' : '')}>
              {res.rol === 1 ? '✓ Ya tiene el rol «Pase Premium»' : res.rol === -1 ? '✕ Ya no está en DRA: el bot no pudo ponerle el rol'
                : res.rol === 2 ? '✕ Le sacaste el rol «Pase Premium»' : '… el bot le está poniendo el rol'}</span>
            {res.semilla === 'a-mano' ? <span className="db-sr-dato">Lo elegiste a mano</span>
              : res.semilla ? <span className="db-sr-dato" title={res.semilla}>Cuenta para verificar: {res.semilla.slice(0, 12)}…</span> : null}
          </div>
        </div>
      ) : null}

      {S && !res && !f ? (
        <p className="db-tx">{abierto ? <>Cierra el <b>{liga.dia(S.cierra)}</b> y se sortea el <b>{liga.dia(S.sorteo)}</b>.</>
          : <>Ya cerró. Se sortea el <b>{liga.dia(S.sorteo)}</b>.</>}
        {s ? <> Van <b>{num(s.personas)}</b> {s.personas === 1 ? 'persona' : 'personas'} y <b>{num(s.boletos)}</b> {s.boletos === 1 ? 'boleto' : 'boletos'}.</> : null}</p>
      ) : null}

      {f ? (
        <>
          <div className="db-sr-rap">
            <span className="db-sr-et">Cierra</span>
            {SORTEO_DIAS.map(([d, t]) => <button key={d} type="button" className="btn borde2 chico" onClick={() => rapido(d)}>{t}</button>)}
            <span className="db-sr-nota">a las 10 PM, y se sortea una hora después</span>
          </div>
          <div className="db-sorteo">
            <label>Cierra (tu hora)<input type="datetime-local" value={f.cierra} onChange={(e) => setF({ ...f, cierra: e.target.value })} /></label>
            <label>Se sortea (tu hora)<input type="datetime-local" value={f.sorteo} onChange={(e) => setF({ ...f, sorteo: e.target.value })} /></label>
          </div>
          {!ok && f.cierra && f.sorteo ? <p className="db-tx">Tiene que cerrar antes de sortearse.</p> : null}
          <div className="cu-btns">
            <button type="button" className="btn verde chico" disabled={ocup || !ok} onClick={guardar}>{f.nuevo || !S ? 'Programar el sorteo' : 'Guardar las fechas'}</button>
            <button type="button" className="btn borde2 chico" onClick={() => setF(null)}>Cancelar</button>
          </div>
        </>
      ) : (
        <div className="cu-btns">
          {!S || res ? <button type="button" className="btn verde chico" disabled={ocup} onClick={abrirNuevo}>Nuevo sorteo</button> : null}
          {S && !res ? <button type="button" className="btn borde2 chico" disabled={ocup} onClick={abrirCambio}>Cambiar fechas</button> : null}
          {abierto ? <button type="button" className="btn borde2 chico" disabled={ocup} onClick={avisar}>Avisar que está abierto</button> : null}
          {res && du && quedan ? <DosToques className="btn borde2 chico" disabled={ocup || busy} confirmar="Toca de nuevo: se sortea entre los demás" onClick={rehacer}>Volver a sortear</DosToques> : null}
          {res && du && res.rol === 1 ? <DosToques className="btn borde2 chico" disabled={ocup || busy} confirmar="Toca de nuevo para sacárselo" onClick={() => sacarRol('ganador')}>Sacarle el rol</DosToques> : null}
          {res && du && (res.rol === -1 || res.rol === 2) ? <button type="button" className="btn borde2 chico" disabled={ocup || busy} onClick={ponerRol}>Ponerle el rol</button> : null}
          {S ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para sacarlo" onClick={() => hacer('pase_sorteo', null, 'El sorteo se sacó de la página.')}>{res ? 'Sacarlo de la página' : 'Sacar el sorteo'}</DosToques> : null}
        </div>
      )}
      {msj ? <p className="db-tx">{msj}</p> : null}

      {du && du.partes.length ? (
        <details className="db-sr-lista">
          <summary>Quién entró ({num(du.partes.length)}){res ? ' · darle el premio a otro' : ''}</summary>
          <ul>{du.partes.map((p, i) => <li key={p.ref || i}><span>{nom(p.k, p.dn)}{p.gana ? <b className="db-sr-ya"> · ganó</b> : null}</span>
            <span className="db-sr-der"><b>{p.b} {p.b === 1 ? 'boleto' : 'boletos'}</b>
              {S && !p.gana && p.ref ? <DosToques className="btn borde2 chico" disabled={ocup || busy} confirmar="Toca de nuevo: gana este" onClick={() => elegir(p)}>Darle el premio</DosToques> : null}</span></li>)}</ul>
        </details>
      ) : null}
      {du && (du.hist.length || du.rehechos.length) ? (
        <details className="db-sr-lista">
          <summary>Los sorteos anteriores ({num(du.hist.length)})</summary>
          <ul>
            {du.hist.map((h) => <li key={h.id}><span>{liga.dia(h.t)} · <b>{nom(h.k, h.dn)}</b>{h.mano ? ' · a mano' : ''}</span><span>{num(h.n)} {h.n === 1 ? 'persona' : 'personas'} · {num(h.b)} {h.b === 1 ? 'boleto' : 'boletos'}</span></li>)}
            {du.rehechos.map((h, i) => <li key={'r' + (h.ref || i)} className="db-sr-tachado"><span>{nom(h.k, h.dn)} (perdió el premio: {h.motivo}){h.rol === 2 ? ' · rol sacado' : ''}</span>
              <span className="db-sr-der">{liga.dia(h.t)}
                {h.rol === 1 && h.ref ? <DosToques className="btn borde2 chico" disabled={ocup || busy} confirmar="Toca de nuevo para sacárselo" onClick={() => sacarRol(h.ref)}>Sacarle el rol</DosToques> : null}</span></li>)}
          </ul>
        </details>
      ) : null}
    </div>
  );
}


// ── 📣 un aviso arriba de la página, para todos, hasta una hora ──────────────────────────────────────────────────────
function AjAviso({ liga, aj, hacer, ocup }) {
  const vig = avisoVigente(aj);
  const [txt, setTxt] = useState('');
  const [horas, setHoras] = useState(24);
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>Aviso en la página</h3><span className={'db-est' + (vig ? ' ojo' : '')}>{vig ? '📣 Publicado' : 'Ninguno'}</span></div>
      {vig ? (
        <div className="db-vig">
          <p>{vig.texto}</p>
          <small>Hasta {liga.dia(vig.hasta)}</small>
          <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para sacarlo" onClick={() => hacer('aviso_web', null, 'Aviso sacado.')}>Sacarlo</DosToques>
        </div>
      ) : null}
      <form className="db-form" onSubmit={(e) => {
        e.preventDefault();
        if (!txt.trim()) return;
        hacer('aviso_web', { texto: txt.trim(), hasta: new Date(Date.now() + horas * 3600000).toISOString() },
          'Publicado. Aparece arriba de la página en unos minutos.').then((ok) => { if (ok) setTxt(''); });
      }}>
        <label className="db-campo"><span>{vig ? 'Reemplazarlo por otro' : 'Qué dice'} <small>{txt.length}/240</small></span>
          <textarea rows={2} maxLength={240} value={txt} onChange={(e) => setTxt(e.target.value)}
            placeholder="Ej.: hoy el bot está en mantenimiento, las tarjetas vuelven a la noche." /></label>
        <label className="db-campo db-corto"><span>Por cuánto</span>
          <select value={horas} onChange={(e) => setHoras(Number(e.target.value))}>
            {DURACIONES.map(([t, h]) => <option key={h} value={h}>{t}</option>)}
          </select></label>
        <div className="cu-btns"><button type="submit" className="btn verde chico" disabled={ocup || !txt.trim()}>Publicar</button></div>
      </form>
      <p className="db-tx">Lo ve todo el mundo, arriba de cada página, hasta que vence o lo sacas. Cada uno lo puede cerrar.</p>
    </div>
  );
}

// ── 🎤 el bot en vivo: en qué servidores habla (ver `chatVivo()` en bot/avisos.js) ───────────────────────────────────
// Lo prende el admin de cada servidor con /settings (elige el canal); desde acá Dlx lo prende en el chat general o lo
// apaga aunque el admin lo haya prendido. «Lo decide su admin» es no tocarlo.
// 🔊 Y CUÁNTO HABLA (05/10/2026): lo justo, normal o cada batalla (`NIVELES_CHAT` de avisos.js, que llega en `chat`).
// También lo elige el admin con /settings; lo de acá gana.
const NIVELES_VIVO = { poco: ['Lo justo'], normal: ['Normal'], todo: ['Cada batalla'] };
function AjVivo({ liga, aj, hacer, ocup, chat, general }) {
  const c = chat || {};
  const dash = aj.en_vivo || {};
  const dashNivel = aj.en_vivo_nivel || {};
  const niveles = c.niveles || NIVELES_VIVO;
  const nivelAdmin = (sv) => (c.nivel || {})[sv] || 'normal';
  const admin = c.admin || {};
  const svs = [...new Set([...(c.generales || []).map((x) => x.sv), ...Object.keys(admin), ...Object.keys(dash)])].sort();
  const prendido = (sv) => dash[sv] !== false && (!!admin[sv] || dash[sv] === true);
  const estado = (sv) => (dash[sv] === false ? 'Apagado por ti' : admin[sv] ? 'Lo prendió su admin'
    : dash[sv] === true ? 'Prendido por ti, en el chat general' : 'Apagado: su admin no eligió canal');
  const cambiar = (sv, v) => {
    const n = Object.assign({}, dash);
    if (v === '') delete n[sv]; else n[sv] = v === 'si';
    return hacer('en_vivo', n, 'Guardado: vale desde el próximo minuto.');
  };
  const cambiarNivel = (sv, v) => {
    const n = Object.assign({}, dashNivel);
    if (v === '') delete n[sv]; else n[sv] = v;
    return hacer('en_vivo_nivel', n, 'Guardado: vale desde el próximo minuto.');
  };
  const u = c.ultimo || {};
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>El bot en vivo</h3><span className={'db-est' + (svs.some(prendido) ? ' ok' : '')}>{svs.filter(prendido).length} prendido(s)</span></div>
      <p className="db-tx">Durante un evento cuenta en el chat cómo va, y cuánto habla se elige: <b>lo justo</b> (el arranque y el campeón), <b>normal</b> (además quién pasa cada ronda y la final, como mucho un mensaje cada 10 minutos) o <b>cada batalla</b> (quién gana cada una apenas se sabe, como mucho uno cada 2 minutos). No menciona a nadie. Lo prende el admin de cada servidor con /settings; desde acá lo prendes en el chat general, lo apagas o le cambias cuánto habla aunque su admin haya elegido otra cosa.</p>
      {general ? <p className="db-tx">Si habla y cuánto, servidor por servidor, en Servidores.</p> : svs.length ? (
        <div className="db-mult db-mult-vivo">{svs.map((sv) => (
          <label key={sv} className="db-sv db-sv-vivo" title={estado(sv)}>
            <span><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b></span>
            <select value={dash[sv] === true ? 'si' : dash[sv] === false ? 'no' : ''} disabled={ocup}
              aria-label={'El bot en vivo en ' + siglaDe(sv)} onChange={(e) => cambiar(sv, e.target.value)}>
              <option value="">{admin[sv] ? 'Su admin: prendido' : 'Su admin: apagado'}</option>
              <option value="si">Prendido</option>
              <option value="no">Apagado</option>
            </select>
            <select value={niveles[dashNivel[sv]] ? dashNivel[sv] : ''} disabled={ocup || !prendido(sv)}
              aria-label={'Cuánto habla el bot en vivo en ' + siglaDe(sv)} onChange={(e) => cambiarNivel(sv, e.target.value)}>
              <option value="">{'Su admin: ' + ((niveles[nivelAdmin(sv)] || ['normal'])[0]).toLowerCase()}</option>
              {Object.keys(niveles).map((k) => <option key={k} value={k}>{niveles[k][0]}</option>)}
            </select>
          </label>
        ))}</div>
      ) : <p className="db-tx">Todavía no sé el chat general de ningún servidor: el vigía lo busca en su próxima vuelta.</p>}
      {u.t ? <p className="db-tx">Última vez {hace(u.t)}: {num(u.mandados || 0)} mensaje(s), {num(u.editados || 0)} edición(es){(u.errores || []).length ? ' · ⚠️ Discord dijo que no: ' + u.errores.join(', ') : ''}{u.error ? ' · ⚠️ ' + u.error : ''}</p> : null}
    </div>
  );
}

// ── 📣 el aviso de cada evento en el canal de la Liga (`bot/aviso_evento.py`) ──────────────────────────────────────
// Dlx, 07/10/2026: «para la liga global, pero añade nivel de intensidad». Los mismos tres que `NIVELES_AVISO` de
// bot/avisos.js y `NIVELES` de aviso_evento.py: si se cambia uno, se cambian los tres
const NIVELES_AVISO = {
  poco: ['Lo justo', 'el evento, el campeón y cuántos jugaron'],
  normal: ['Normal', 'además el podio con sus puntos y la tarjeta del campeón'],
  todo: ['Todo', 'además quién subió en el ranking, quién debutó, las insignias, los rangos y la sorpresa'],
};
// 🎛️ Y DÓNDE VA (07/10/2026): ya no a LIGA GLOBAL —que está en «registros»— sino al chat de cada servidor; servidor por
// servidor se elige si va donde habla el bot en vivo, a su chat general siempre o a ningún lado, y a dónde va el que no
// tiene a dónde (ver `canalesChat()` en bot/avisos.js)
function AjAvisos({ liga, aj, hacer, ocup, chat, general }) {
  const v = NIVELES_AVISO[aj.avisos_nivel] ? aj.avisos_nivel : 'normal';
  const ae = aj.aviso_evento || {};
  const porSv = ae.sv || {};
  const svs = svsDe(chat, aj);
  const gens = [...new Set(((chat || {}).generales || []).map((x) => x.sv))].sort();
  const poner = (cambio, ok) => hacer('aviso_evento', Object.assign({ sv: porSv, resto: ae.resto || '' }, cambio), ok);
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>El aviso de cada evento</h3><span className="db-est ok">{NIVELES_AVISO[v][0]}</span></div>
      <p className="db-tx">Cuando el ciclo carga un evento, el bot lo cuenta en el chat del servidor donde se jugó: el mismo donde habla el bot en vivo. Después, sin volver a sonar, le suma lo que cambió y la tarjeta nueva del campeón. Cuánto dice: <b>{NIVELES_AVISO[v][0].toLowerCase()}</b>, {NIVELES_AVISO[v][1]}.</p>
      <label className="db-campo"><span>Cuánto dice</span>
        <select value={v} disabled={ocup} aria-label="Cuánto dice el aviso de cada evento"
          onChange={(e) => hacer('avisos_nivel', e.target.value, 'Guardado: vale desde el próximo evento.')}>
          {Object.keys(NIVELES_AVISO).map((k) => <option key={k} value={k}>{NIVELES_AVISO[k][0]}</option>)}
        </select></label>
      {general ? <p className="db-tx">Dónde va el de cada servidor, en Servidores.</p> : null}
      {!general && svs.length ? (
        <div className="db-mult db-mult-vivo">{svs.map((sv) => (
          <label key={sv} className="db-sv">
            <span><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b></span>
            <select value={porSv[sv] || ''} disabled={ocup} aria-label={'Dónde va el aviso de los eventos de ' + siglaDe(sv)}
              onChange={(e) => {
                const n = Object.assign({}, porSv);
                if (e.target.value) n[sv] = e.target.value; else delete n[sv];
                poner({ sv: n }, 'Guardado: vale desde el próximo evento.');
              }}>
              <option value="">Donde habla el bot en vivo</option>
              <option value="chat">En su chat general, siempre</option>
              <option value="no">Apagado</option>
            </select>
          </label>
        ))}</div>
      ) : null}
      {gens.length ? (
        <label className="db-campo"><span>Si un servidor no tiene a dónde</span>
          <select value={ae.resto || ''} disabled={ocup}
            onChange={(e) => poner({ resto: e.target.value }, 'Guardado: vale desde el próximo evento.')}>
            <option value="">No se manda</option>
            {gens.map((sv) => <option key={sv} value={sv}>Al chat general de {siglaDe(sv)}</option>)}
          </select></label>
      ) : null}
    </div>
  );
}

// ── 🎛️ LOS DE MÁS (Dlx, 07/10/2026: «dame más configuraciones», y a la lista: «Apuestas», «Aviso de cada evento»,
// «Horario de silencio»). Los validan `ajusteValido()` y los usan `apuestasCfg()`, `ritmoCfg()`, `enSilencio()` y
// `canalesChat()` de bot/avisos.js; lo de siempre llega en `chat.def`, así que los números no se escriben acá ──────────
function svsDe(chat, aj) {
  const c = chat || {};
  return [...new Set([...(c.generales || []).map((x) => x.sv), ...Object.keys(c.admin || {}), ...Object.keys(aj.en_vivo || {})])].sort();
}
// 🎲 sin tope desde el 11/11/2026 (Dlx: «que no haya nivel max de apuesta»): «Tope por batalla» se fue
const DEF_AP = { montos: [50, 100, 250, 500], minutos: 3 };
const DEF_RIT = { normal: 10, batalla: 2 };

// 🎲 las apuestas: los botones y cuánto quedan abiertas. Sin tope (11/11/2026) y sin «dónde no van» (12/11/2026)
function AjApuestas({ liga, aj, hacer, ocup, chat, general }) {
  const def = ((chat || {}).def || {}).apuestas || DEF_AP;
  const a = aj.apuestas || null;
  const firma = JSON.stringify(a);
  const [montos, setMontos] = useState((a || def).montos.join(', '));
  const [minutos, setMinutos] = useState((a || def).minutos);
  useEffect(() => {
    const r = a || def;
    setMontos(r.montos.join(', ')); setMinutos(r.minutos);
  }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps
  const ms = montos.split(/[\s,;.]+/).filter(Boolean).map(Number);
  const mal = ms.length < 2 || ms.length > 4 ? 'De 2 a 4 botones.'
    : ms.some((m, i) => !Number.isInteger(m) || m < 10 || m > 5000 || (i && m <= ms[i - 1])) ? 'Los botones van de menor a mayor, de 10 a 5.000.' : '';
  const svs = svsDe(chat, aj);
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>Las apuestas</h3><span className={'db-est' + (a ? ' ojo' : ' ok')}>{a ? '✍ A tu gusto' : 'Como siempre'}</span></div>
      <p className="db-tx">Salen <b>siempre</b>, en todo servidor con el bot en vivo y elija lo que elija su admin: en <b>Con datos</b> y <b>A full</b>, en el mensaje de cada cruce; en los otros niveles, en un mensaje con la batalla que viene. Se toca a quién gana y se abre la ventana para apostar, con Puntos de Tienda; el pozo se reparte entre los que aciertan. No se apagan: sólo no salen donde el bot en vivo está apagado.</p>
      <form className="db-form uno" onSubmit={(e) => {
        e.preventDefault();
        if (!mal) hacer('apuestas', { montos: ms, minutos: Number(minutos), apagadas: {}, prendidas: {} }, 'Guardado: vale para la próxima apuesta.');
      }}>
        <label className="db-campo"><span>Los botones <small>de menor a mayor, separados por coma</small></span>
          <input value={montos} inputMode="numeric" placeholder="50, 100, 250, 500" onChange={(e) => setMontos(e.target.value)} /></label>
        <div className="db-fila">
          <label className="db-campo db-corto"><span>Abiertas</span>
            <select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))}>
              {Array.from({ length: 15 }, (_, i) => i + 1).map((x) => <option key={x} value={x}>{x} {x === 1 ? 'minuto' : 'minutos'}</option>)}
            </select></label>
        </div>
        {/* 🎲 «Prendidas en» se fue el 11/11/2026 y «No hay apuestas en» el 12/11 (Dlx: «the objective of it its to be
            always on»): salen siempre (`hayApuestas()` en avisos.js) */}
        {mal ? <p className="db-tx db-mal">{mal}</p> : null}
        <div className="cu-btns">
          <button type="submit" className="btn verde chico" disabled={ocup || !!mal}>Guardar</button>
          {a ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para volver a lo de siempre"
            onClick={() => hacer('apuestas', null, 'Volvieron los de siempre.')}>Volver a lo de siempre</DosToques> : null}
        </div>
      </form>
      {/* 🎲 sin «y hasta N por batalla» (18/11/2026): el tope se fue el 11/11 y `def.tope` llegaba undefined, «hasta 0» */}
      <p className="db-tx">Lo de siempre: botones de {def.montos.map(num).join(', ')} y {def.minutos} minutos.</p>
    </div>
  );
}

// 🌙 el horario de silencio del bot en vivo, en hora del este
function AjSilencio({ aj, hacer, ocup }) {
  const s = aj.silencio || null;
  const [desde, setDesde] = useState((s && s.desde) || '00:00');
  const [hasta, setHasta] = useState((s && s.hasta) || '09:00');
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>Horario de silencio</h3><span className={'db-est' + (s ? ' ojo' : '')}>{s ? '🌙 De ' + s.desde + ' a ' + s.hasta : 'Sin silencio'}</span></div>
      <p className="db-tx">En ese horario, en hora del este, el bot en vivo no habla en ningún chat ni cuenta quién se anotó. Las apuestas que estaban abiertas se siguen cerrando y pagando. Al terminar, sigue desde donde va la llave: lo que pasó en el medio no lo cuenta tarde. Puede cruzar la medianoche (de 23:00 a 08:00).</p>
      <form className="db-form uno" onSubmit={(e) => {
        e.preventDefault();
        if (desde !== hasta) hacer('silencio', { desde, hasta }, 'Guardado: vale desde el próximo minuto.');
      }}>
        <div className="db-fila">
          <label className="db-campo db-corto"><span>Desde</span><input type="time" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="db-campo db-corto"><span>Hasta</span><input type="time" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        </div>
        <div className="cu-btns">
          <button type="submit" className="btn verde chico" disabled={ocup || !desde || !hasta || desde === hasta}>Guardar</button>
          {s ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para sacarlo"
            onClick={() => hacer('silencio', null, 'Sin silencio: vuelve a hablar a toda hora.')}>Sacarlo</DosToques> : null}
        </div>
      </form>
    </div>
  );
}

// 👥 LAS CREWS (Dlx, 19/10/2026: «que yo tenga la configuración para elegir eso»): cuánto cuesta crear una, cómo se
// arma su ranking (todos, los N mejores o los representantes que elige el líder) y el líder de cada una —las 34 de antes
// arrancaron con el primero de la lista—. El precio y el ranking son ajustes; el líder va por `/avisos/dueno/crew`
const MODOS_CREW = [['todos', 'La suma de todos'], ['mejores', 'Los N mejores de cada una'], ['reps', 'Los representantes que elige el líder']];
// 🏆 los de siempre (bot/crews_tiers.py `SUBE`, `BAJA`, `JUEGAN`), por si el payload todavía no los trae
const TIERS_DEF = { nombres: ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro', 'Leyenda'],
  sube: [15000, 30000, 50000, 80000, 120000, 180000], baja: [5000, 15000, 25000, 40000, 60000, 90000], juegan: [0, 1, 2, 3, 4, 5, 6] };

/** 🏆 Los números de los tiers de las crews (Dlx, 19/10/2026: «Tiers en el Dashboard»): para subir, para no bajar y
 *  cuántos tienen que jugar, tier por tier. Los valida `tiersValidos()` de bot/crews.js y los usa el ciclo en el cierre
 *  de la semana (`bot/crews_tiers.py`); los de hoy llegan con el payload. */
function TiersCrew({ liga, aj, hacer, ocup }) {
  const P = (liga.d && liga.d.crews_tiers) || {};
  const de = aj.crews_tiers_num || { sube: (P.sube || TIERS_DEF.sube).slice(0, 6), baja: (P.baja || [null].concat(TIERS_DEF.baja)).slice(1),
    juegan: P.juegan || TIERS_DEF.juegan };
  const nombres = P.nombres || TIERS_DEF.nombres;
  const [t, setT] = useState(() => ({ sube: de.sube.map(String), baja: de.baja.map(String), juegan: de.juegan.map(String) }));
  // 🔁 vuelve a lo guardado cuando el ajuste cambia (18/11/2026): tras «Volver a los de siempre» o el «Deshacer» la fila
  // sigue abierta, y los campos mostraban (y volvían a guardar) los números de antes. Lo mismo que AjApuestas y AjRitmo
  const firma = JSON.stringify(aj.crews_tiers_num || null);
  useEffect(() => {
    setT({ sube: de.sube.map(String), baja: de.baja.map(String), juegan: de.juegan.map(String) });
  }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps
  const pon = (que, i, v) => setT((x) => Object.assign({}, x, { [que]: x[que].map((y, j) => (j === i ? v : y)) }));
  const num0 = (xs) => xs.map((x) => Number(x));
  return (
    <form className="db-form uno" onSubmit={(e) => {
      e.preventDefault();
      hacer('crews_tiers_num', { sube: num0(t.sube), baja: num0(t.baja), juegan: num0(t.juegan) },
        'Guardado: los tiers se mueven con estos números desde el próximo cierre (lunes 11 AM ET).');
    }}>
      <h4 className="db-sub">Los tiers · puntos de la semana</h4>
      <div className="db-tabla-x"><table className="db-tiers">
        <thead><tr><th>Tier</th><th>Para subir</th><th>Baja con menos de</th><th>Para entrar juegan</th></tr></thead>
        <tbody>{nombres.map((n, i) => (
          <tr key={n}>
            <th>{n}</th>
            <td>{i < 6 ? <input type="number" min="1" max="10000000" step="1000" value={t.sube[i]} aria-label={'Para subir desde ' + n}
              onChange={(e) => pon('sube', i, e.target.value)} /> : '—'}</td>
            <td>{i > 0 ? <input type="number" min="0" max="10000000" step="1000" value={t.baja[i - 1]} aria-label={'Baja de ' + n + ' con menos de'}
              onChange={(e) => pon('baja', i - 1, e.target.value)} /> : '—'}</td>
            <td><input type="number" min="0" max="20" value={t.juegan[i]} aria-label={'Para entrar a ' + n + ', cuántos juegan'}
              onChange={(e) => pon('juegan', i, e.target.value)} /></td>
          </tr>
        ))}</tbody>
      </table></div>
      <p className="db-tx">Cada número de una columna, igual o más que el de arriba. Lo que pide no bajar en un tier no puede ser más que lo
        que pidió subir a él. La tarjeta de crew se desbloquea en Diamante.</p>
      <div className="cu-btns">
        <button type="submit" className="btn verde chico" disabled={ocup}>Guardar los tiers</button>
        {aj.crews_tiers_num ? <button type="button" className="btn borde2 chico" disabled={ocup}
          onClick={() => hacer('crews_tiers_num', null, 'Listo: vuelven los números de siempre.')}>Volver a los de siempre</button> : null}
      </div>
    </form>
  );
}
function AjCrews({ liga, aj, hacer, ocup }) {
  const { todas } = useCrews();
  usePerfiles();
  const r = aj.crews_ranking || { modo: 'todos', n: 5 };
  const [precio, setPrecio] = useState(String(aj.crew_precio ?? 2500));
  // 💸 cambiar el nombre (o la sigla) y el logo (Dlx, 19/10/2026: «cuesta plata»): lo de siempre, `PRECIO_NOMBRE` y
  // `PRECIO_LOGO` de bot/crews.js
  const [pNombre, setPNombre] = useState(String(aj.crew_precio_nombre ?? 1000));
  const [pLogo, setPLogo] = useState(String(aj.crew_precio_logo ?? 1000));
  const [modo, setModo] = useState(r.modo);
  const [n, setN] = useState(String(r.n || 5));
  const [msg, setMsg] = useState('');
  const [va, setVa] = useState(false);
  const lider = (crew, a) => {
    setVa(true);
    setMsg('');
    window.conCuenta('/api/avisos/dueno/crew', { que: 'lider', crew, a }, 's').then((j) => {
      setVa(false);
      if (j && j.ok) { setMsg('Listo: nuevo líder.'); pedirCrews(true); } else setMsg('No pude (' + ((j && j.error) || 'red') + ').');
    }).catch(() => { setVa(false); setMsg('No pude.'); });
  };
  // 👤 el líder y su gente con su nombre aunque estén fuera de las 200 filas (18/11/2026), no con la clave
  const nombre = (k) => liga.nombreDe(k);
  const crews = ((todas && todas.crews) || []).slice().sort((a, b) => (b.oficial - a.oficial) || String(a.nombre).localeCompare(b.nombre));
  return (
    <div className="db-aj db-aj-ancho">
      <div className="db-aj-c"><h3>Las crews</h3><span className="db-est">{crews.length} crews · crear cuesta {num(aj.crew_precio ?? 2500)}</span></div>
      <p className="db-tx">Las arma la gente: verificados, pagando Puntos de Tienda, hasta 20 cada una. Líder, Colíder, Veterano y Miembro; 7 días entre una crew y otra.</p>
      <form className="db-form uno" onSubmit={(e) => {
        e.preventDefault();
        // de a uno, sólo lo que cambió: cada ajuste se guarda solo
        (async () => {
          const cambios = [['crew_precio', precio, aj.crew_precio ?? 2500], ['crew_precio_nombre', pNombre, aj.crew_precio_nombre ?? 1000],
            ['crew_precio_logo', pLogo, aj.crew_precio_logo ?? 1000]].filter(([, v, antes]) => Number(v) !== Number(antes));
          for (const [k, v] of cambios) { if (!(await hacer(k, Number(v), 'Guardado: crear ' + num(Number(precio)) + ', cambiar el nombre ' + num(Number(pNombre)) + ', cambiar el logo ' + num(Number(pLogo)) + '.'))) break; }
        })();
      }}>
        <div className="db-fila">
          <label className="db-campo db-corto"><span>Crear cuesta (Puntos de Tienda)</span>
            <input type="number" min="0" max="50000" step="100" value={precio} onChange={(e) => setPrecio(e.target.value)} /></label>
          <label className="db-campo db-corto"><span>Cambiar el nombre o la sigla</span>
            <input type="number" min="0" max="50000" step="100" value={pNombre} onChange={(e) => setPNombre(e.target.value)} /></label>
          <label className="db-campo db-corto"><span>Cambiar el logo</span>
            <input type="number" min="0" max="50000" step="100" value={pLogo} onChange={(e) => setPLogo(e.target.value)} /></label>
        </div>
        <p className="db-tx">La descripción y los requisitos se cambian gratis. Un logo que no se aprueba se devuelve.</p>
        <div className="cu-btns"><button type="submit" className="btn verde chico" disabled={ocup}>Guardar los precios</button></div>
      </form>
      <form className="db-form uno" onSubmit={(e) => {
        e.preventDefault();
        hacer('crews_ranking', { modo, n: Number(n) }, 'Guardado: el ranking de crews cambia en la próxima vuelta del ciclo.');
      }}>
        <div className="db-fila">
          <label className="db-campo"><span>El ranking de crews suma</span>
            <select value={modo} onChange={(e) => setModo(e.target.value)}>{MODOS_CREW.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
          {modo !== 'todos' ? <label className="db-campo db-corto"><span>{modo === 'reps' ? 'Representantes' : 'Cuántos'}</span>
            <input type="number" min="1" max="20" value={n} onChange={(e) => setN(e.target.value)} /></label> : null}
        </div>
        <div className="cu-btns"><button type="submit" className="btn verde chico" disabled={ocup}>Guardar el ranking</button></div>
      </form>
      <TiersCrew liga={liga} aj={aj} hacer={hacer} ocup={ocup} />
      {crews.length ? (
        <details className="db-det">
          <summary>El líder de cada crew ({crews.length})</summary>
          <ul className="db-crews">{crews.map((c) => {
            const l = (c.gente.find((g) => g[1] === 'lider') || [])[0] || '';
            return (
              <li key={c.id}>
                <a href={'#/crew/' + encodeURIComponent(c.id)}><b>{limpio(c.nombre)}</b></a>{c.oficial ? <small> · de antes</small> : null}
                <select value={l} disabled={va} aria-label={'El líder de ' + c.nombre} onChange={(e) => lider(c.id, e.target.value)}>
                  {c.gente.map(([k]) => <option key={k} value={k}>{nombre(k)}</option>)}
                </select>
              </li>
            );
          })}</ul>
        </details>
      ) : null}
      {msg ? <p className="db-msg" role="status">{msg}</p> : null}
    </div>
  );
}

// ⏱️ el ritmo del bot en vivo: cada cuánto puede mandar un mensaje nuevo en un mismo chat
const RIT_NORMAL = [3, 5, 10, 15, 20, 30];
const RIT_BATALLA = [1, 2, 3, 5, 10];
function AjRitmo({ aj, hacer, ocup, chat }) {
  const def = ((chat || {}).def || {}).ritmo || DEF_RIT;
  const r = aj.ritmo || null;
  const [n, setN] = useState((r || def).normal);
  const [b, setB] = useState((r || def).batalla);
  const firma = JSON.stringify(r);
  useEffect(() => { setN((r || def).normal); setB((r || def).batalla); }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps
  const ops = (xs, v) => (xs.indexOf(v) < 0 ? [...xs, v].sort((x, y) => x - y) : xs);
  const cambio = n !== (r || def).normal || b !== (r || def).batalla;
  return (
    <div className="db-aj">
      <div className="db-aj-c"><h3>El ritmo del bot en vivo</h3><span className={'db-est' + (r ? ' ojo' : ' ok')}>{r ? '✍ A tu gusto' : 'Como siempre'}</span></div>
      <p className="db-tx">Cada cuánto puede mandar un mensaje nuevo en un mismo chat. Editar el de las rondas no cuenta: no suena.</p>
      <div className="db-fila">
        <label className="db-campo db-corto"><span>En «Lo justo» y «Normal»</span>
          <select value={n} disabled={ocup} onChange={(e) => setN(Number(e.target.value))}>
            {ops(RIT_NORMAL, n).map((x) => <option key={x} value={x}>Uno cada {x} min</option>)}
          </select></label>
        <label className="db-campo db-corto"><span>En «Cada batalla» y más</span>
          <select value={b} disabled={ocup} onChange={(e) => setB(Number(e.target.value))}>
            {ops(RIT_BATALLA, b).map((x) => <option key={x} value={x}>Uno cada {x} min</option>)}
          </select></label>
      </div>
      <div className="cu-btns">
        <button type="button" className="btn verde chico" disabled={ocup || !cambio}
          onClick={() => hacer('ritmo', { normal: n, batalla: b }, 'Guardado: vale desde el próximo minuto.')}>Guardar</button>
        {r ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para volver a lo de siempre"
          onClick={() => hacer('ritmo', null, 'Volvió el de siempre.')}>Volver a lo de siempre</DosToques> : null}
      </div>
      <p className="db-tx">Lo de siempre: uno cada {def.normal} minutos, y en «Cada batalla», uno cada {def.batalla}.</p>
    </div>
  );
}



// 🏆 LOS MES AWARDS (16/10/2026, Dlx a «¿de dónde salen los nominados?»: «solos, de los números», y vos podés sacar
// alguno antes de que abra la votación). Los nominados salen el día 1 a las 11 AM ET y la votación abre a las 6 PM: en
// ese rato, sacar a uno guarda `mes_sacar` y en la vuelta siguiente del ciclo entra el que sigue (`bot/mes_awards.py`)
function MesAwardsDueno({ aj, hacer, ocup }) {
  const [S, setS] = useState(null);
  useEffect(() => {
    fetch('/api/salon', { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null)).then((d) => setS(d || {})).catch(() => setS({}));
  }, []);
  if (!S) return <p className="pronto-p">Cargando…</p>;
  const ab = S.abierto;
  if (!ab) {
    const v = S.vivo;
    return <p className="pronto-p">{v ? 'Así va ' + v.nombre + ': los nominados de cada servidor salen el día 1 a las 11 AM, y desde ahí hasta las 6 PM puedes sacar a alguno acá.' : 'Todavía no hay MES AWARDS.'}</p>;
  }
  if (ab.votando) return <p className="pronto-p">Se está votando {ab.nombre}: los nominados ya no se cambian. Cierra el {corto(ab.cierra)}.</p>;
  const ya = ((aj.mes_sacar || {}).mes === ab.mes ? (aj.mes_sacar.quitar || []) : []);
  // 🔁 EL DESCANSO DE QUIEN REPITE LO DECIDE LA DIRECTIVA (Dlx, 18/10/2026): no hay regla automática. Acá se ve quién ya
  // ganó esa misma categoría en un mes anterior, para sacarlo si les parece
  const gano = {};
  for (const h of S.hist || []) {
    for (const [c, x] of Object.entries(h.cats || {})) {
      const f = (x.nom || []).find((y) => y.op === x.gana);
      for (const q of (f && (f.quien || [f.op])) || []) (gano[c + ':' + q] = gano[c + ':' + q] || []).push(h.nombre || h.mes);
    }
  }
  const yaGano = (c, x) => [...new Set((x.quien || [x.op]).flatMap((q) => gano[c + ':' + q] || []))];
  const alternar = (k) => {
    const q = ya.includes(k) ? ya.filter((x) => x !== k) : ya.concat([k]);
    hacer('mes_sacar', q.length ? { mes: ab.mes, quitar: q } : null, ya.includes(k) ? 'Vuelve a estar nominado.' : 'Sacado: en la próxima vuelta del ciclo entra el que sigue.');
  };
  return (
    <div className="db-mes">
      <p className="pronto-p">Los nominados de <b>{ab.nombre}</b>. La votación abre el {corto(ab.abre)}: hasta entonces puedes sacar a alguno.
        El descanso de quien repite lo decide la directiva: «ya ganó» marca a quien se llevó esa categoría antes.</p>
      {(S.cats || []).map(([c, n]) => {
        const nom = ((ab.cats || {})[c] || {}).nom || [];
        const fuera = ya.filter((k) => k.startsWith(c + ':')).map((k) => k.slice(c.length + 1));
        return nom.length || fuera.length ? (
          <div key={c} className="db-mes-c"><b>{n}</b>
            {/* los que sacaste ya no van en la lista: salían dos veces, y «Sacar» los volvía a poner (pasada del 19/10/2026) */}
            <ul>{nom.filter((x) => !ya.includes(c + ':' + x.op)).map((x) => (
              <li key={x.op}><span>{x.n}{yaGano(c, x).length ? <em className="db-mes-gano"> · ya ganó en {yaGano(c, x).join(', ')}</em> : null}</span><button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => alternar(c + ':' + x.op)}>Sacar</button></li>
            ))}{fuera.map((op) => (
              <li key={'f' + op} className="fuera"><span>{op} · sacado</span><button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => alternar(c + ':' + op)}>Volver a poner</button></li>
            ))}</ul>
          </div>
        ) : null;
      })}
      {/* 🏟️ y los de cada servidor Tier 1 (18/10/2026): se sacan igual, con la clave `SV/cat:op` */}
      {Object.keys(ab.sv || {}).sort().map((sv) => (
        <div key={sv} className="db-mes-sv">
          <h4>{sv}</h4>
          {(S.cats_sv || []).map(([c, n]) => {
            const pre = sv + '/' + c + ':';
            const nom = (((ab.sv[sv] || {}).cats || {})[c] || {}).nom || [];
            const fuera = ya.filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length));
            return nom.length || fuera.length ? (
              <div key={c} className="db-mes-c"><b>{n}</b>
                <ul>{nom.filter((x) => !ya.includes(pre + x.op)).map((x) => (
                  <li key={x.op}><span>{x.n}</span><button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => alternar(pre + x.op)}>Sacar</button></li>
                ))}{fuera.map((op) => (
                  <li key={'f' + op} className="fuera"><span>{op} · sacado</span><button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => alternar(pre + op)}>Volver a poner</button></li>
                ))}</ul>
              </div>
            ) : null;
          })}
        </div>
      ))}
    </div>
  );
}

// el `hacer` de los ajustes: guarda, avisa y dice si salió. Lo comparten los ajustes y el historial
// ↩️ Y DESHACER POR 8 SEGUNDOS (25/10/2026, la maqueta: «cada cambio se puede deshacer»): guarda lo que había antes y
// el aviso de abajo lo vuelve a poner con un toque, sin ir al historial
function useHacer(onAj, getAj) {
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  const [aviso, setAviso] = useState(null);
  const tm = useRef(0);
  const mostrar = (a) => { clearTimeout(tm.current); setAviso(a); tm.current = setTimeout(() => setAviso(null), 8000); };
  // `esDeshacer`: vuelve algo a como estaba (el aviso de 8 s o el Historial): se cuenta en los números del Dashboard
  const hacer = async (cual, valor, ok, sinDeshacer, esDeshacer) => {
    const antes = getAj ? getAj()[cual] : undefined;
    setOcup(true); setMsg('');
    let bien = false;
    try {
      onAj(await ajustar(cual, valor, esDeshacer));
      setMsg('✅ ' + ok); bien = true;
      mostrar({ ok: '✅ ' + ok, cual, antes: antes === undefined ? null : antes, puede: !sinDeshacer });
    } catch (e) {
      setMsg('⚠️ No se pudo: ' + e.message + '.');
      mostrar({ ok: '⚠️ No se pudo: ' + e.message + '.', puede: false });
    }
    setOcup(false);
    return bien;
  };
  const deshacer = async () => {
    const a = aviso;
    if (!a || !a.puede) return;
    setAviso(null);
    await hacer(a.cual, volverA(a.cual, a.antes), 'Deshecho: volvió a como estaba.', true, true);
  };
  return { hacer, msg, ocup, aviso, deshacer, cerrarAviso: () => setAviso(null) };
}
// lo que había antes, tal como se puede volver a poner: un aviso que ya venció no se republica (el servidor lo rechaza)
const volverA = (cual, v) => (cual === 'aviso_web' && v && Date.parse(v.hasta) <= Date.now() ? null : v);

// 🔔 lo que pide atención: lo mismo que marca el panel del Inicio, y la última corrida del ciclo si salió mal
// 🔴 LO QUE AVISÓ EL CANAL DE LOGS (Dlx, 17/10/2026: «en el canal de registros aparecen cosas que están malas, en 🔴…
// ¿o aparecer en el dashboard quizás?»): los 🔴 y ⚠️ de los últimos días, del Worker (`/avisos/dueno-logs`). «Ya lo vi»
// los esconde en este navegador; un aviso que vuelve al día siguiente es otro mensaje y aparece de nuevo
const LOGS_VISTO = 'lg:db-logs';
function logsVistos() { try { return JSON.parse(localStorage.getItem(LOGS_VISTO) || '[]') || []; } catch (e) { return []; } }
function useLogs(activo) {
  const [l, setL] = useState(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    fetch('/api/avisos/dueno-logs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(async (r) => (r.ok ? r.json() : { error: r.status }))
      .then((j) => { if (vivo) setL(j || { error: 'vacío' }); })
      .catch(() => { if (vivo) setL({ error: 'red' }); });
    return () => { vivo = false; };
  }, [activo]);
  return l;
}
function Logs({ l }) {
  const [vistos, setVistos] = useState(logsVistos);
  if (!l) return <p className="pronto-p">Leyendo Logs…</p>;
  if (l.error) return <p className="pronto-p">No pude leer Logs ({String(l.error)}).</p>;
  const xs = (l.xs || []).filter((x) => !vistos.includes(x.id));
  const ver = (id) => {
    const v = vistos.concat([id]).slice(-200);
    setVistos(v);
    try { localStorage.setItem(LOGS_VISTO, JSON.stringify(v)); } catch (e) { /* sin guardar: vuelve al recargar */ }
  };
  if (!xs.length) return <p className="db-ok">✅ Nada en rojo ni en amarillo en Logs en los últimos días.</p>;
  return (
    <ul className="db-logs">{xs.map((x) => (
      <li key={x.id} className={'db-log ' + x.nivel}>
        {/* 📅 el día en la zona de quien mira (18/11/2026): `x.t` es el timestamp UTC de Discord y se cortaba el texto, así
            que lo de la noche (desde las 7 PM ET) salía con el día siguiente */}
        <div><b>{x.tit}</b><small>{corto(diaISO(new Date(x.t)))}{' · '}<a href={'https://discord.com/channels/' + l.guild + '/' + l.canal + '/' + x.id} target="_blank" rel="noopener noreferrer">en Discord ↗</a></small>
          {x.mas.length ? <details><summary>Ver el detalle</summary><ul>{x.mas.map((m, i) => <li key={i}>{m}</li>)}</ul></details> : null}
        </div>
        <button type="button" className="btn borde2 chico" onClick={() => ver(x.id)}>Ya lo vi</button>
      </li>
    ))}</ul>
  );
}

// ── 🙋 LOS PEDIDOS DE LA GENTE (17/10/2026): perdí mi cuenta, ese no soy yo, mi país, un video que no es mío. Con lo que
// el bot vio de la cuenta que pide; «Sí» lo aprueba —el de cuenta y el de país los aplica el ciclo; los otros dos los
// resolvés vos y quedan hechos— y «No» lo cierra. Lo pueden contestar vos y los Moderadores
const PED_TIPO = { cuenta: 'Perdí mi cuenta de Discord', identidad: 'Ese no soy yo / mi nombre está mal', pais: 'Mi país está mal', video: 'Un video que no es mío',
  hackeo: 'Me hackearon la cuenta', premio: 'No me llegó un premio', puntos: 'Mis puntos o mi puesto', carta: 'Mi carta está mal', falla: 'Algo no funciona', otro: 'Otra cosa' };
const PED_EST = { '': 'esperando', si: '✅ aprobado · lo aplica el ciclo', hecho: '✅ hecho', no: '⛔ no', no_pude: '⚠️ no se pudo aplicar' };
// lo que hace el «Sí» de cada uno: el de cuenta y el de país los aplica el ciclo; el video se saca solo; el de identidad
// lo arreglás vos, así que el botón es para cuando ya está hecho
const PED_SI = { cuenta: 'Sí, es su cuenta', hackeo: 'Sí, es su cuenta', pais: 'Sí, cambiarlo', video: 'Sí, sacar el video', identidad: 'Ya lo arreglé',
  premio: 'Ya lo arreglé', puntos: 'Ya lo arreglé', carta: 'Ya lo arreglé', falla: 'Ya lo arreglé', otro: 'Ya lo arreglé' };
// 🔎 la cuenta VIEJA (la que hoy tiene ese perfil en la Lista), que averigua el ciclo: si sigue en DRA, ojo
function Vieja({ v }) {
  if (!v) return <p className="db-ped-pr">La cuenta vieja: la mira el ciclo en su próxima vuelta.</p>;
  if (v.sin_cuenta) return <p className="db-ped-pr">La cuenta vieja: ese perfil no tenía cuenta en la Lista.</p>;
  const quien = v.usuario ? '@' + v.usuario : 'sin nombre';
  if (v.en_dra) {
    return <p className="db-ped-pr db-ped-ojo">⚠️ La cuenta vieja (<b>{quien}</b>{v.creada ? ', creada el ' + v.creada : ''}) <b>sigue en DRA</b>
      {v.apodo_dra ? ' como «' + v.apodo_dra + '»' : ''}{v.miembro ? ', con el Miembro' : ''}. Pregúntale por ahí antes de aprobar.</p>;
  }
  return <p className="db-ped-pr">La cuenta vieja: <b>{quien}</b>{v.creada ? ', creada el ' + v.creada : ''} · {v.en_dra === false ? 'ya no está en DRA' : 'no se pudo ver si sigue en DRA'}.</p>;
}
function Pedidos({ ps, liga, alCambiar }) {
  const [va, setVa] = useState(0);
  const [msg, setMsg] = useState('');
  const resolver = (p, si) => {
    setVa(p.id); setMsg('');
    fetch('/api/avisos/dueno-pedido', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, si }) })
      .then(async (r) => ({ r, j: await r.json().catch(() => ({})) }))
      .then(({ r, j }) => { setVa(0); if (r.ok && j.pedidos) alCambiar(j.pedidos); else setMsg(j.error === 'no' ? 'No tienes permiso.' : 'No pude: ' + (j.error || r.status)); })
      .catch(() => { setVa(0); setMsg('No pude: la red.'); });
  };
  if (!ps.length) return <p className="pronto-p">Nadie pidió nada en los últimos días.</p>;
  return (
    <>
      {msg ? <p className="pronto-p" role="alert">{msg}</p> : null}
      <ul className="db-ped">{ps.map((p) => {
        const f = p.k ? liga.T[p.k] : null;
        const pr = p.prueba || {};
        return (
          <li key={p.id} className={p.estado === '' ? 'abierto' : ''}>
            <div>
              <b className="db-ped-t">{PED_TIPO[p.tipo] || p.tipo}{f ? ' · ' + limpio(f.n) : p.k ? ' · ' + p.k : ''}{p.cc ? ' · ' + p.cc.toUpperCase() : ''}</b>
              <small>{corto(diaISO(new Date(p.t)))} · {PED_EST[p.estado] || p.estado}{p.por ? ' (' + p.por + ')' : ''}{p.nota ? ' · ' + p.nota : ''}</small>
              {p.texto ? <p className="db-ped-tx">«{p.texto}»</p> : null}
              {p.k && f ? <p className="db-ped-pr"><a href={'#/r/' + p.k}>Ver el perfil de {limpio(f.n)} ↗</a></p> : null}
              {p.tipo === 'cuenta' || p.tipo === 'hackeo' ? <Vieja v={pr.vieja} /> : null}
              {p.tipo === 'cuenta' || p.tipo === 'hackeo' ? <p className="db-ped-pr">La cuenta que pide: <b>{pr.usuario ? '@' + pr.usuario : 'sin nombre'}</b>{pr.nombre ? ' («' + pr.nombre + '»)' : ''}
                {pr.creada ? ' · creada el ' + pr.creada : ''} · en DRA: {pr.en_dra === false ? 'no está' : (pr.apodo_dra ? '«' + pr.apodo_dra + '»' : 'sin apodo') + (pr.miembro ? ', Miembro' : ', sin el rol Miembro') + (pr.en_dra_desde ? ', desde el ' + pr.en_dra_desde : '')}</p> : null}
              {p.vid ? <p className="db-ped-pr"><a href={'https://youtu.be/' + p.vid} target="_blank" rel="noopener noreferrer">El video ↗</a></p> : null}
            </div>
            {p.estado === '' ? <div className="db-ped-b">
              <button type="button" className="btn verde chico" disabled={va === p.id} onClick={() => resolver(p, true)}>{PED_SI[p.tipo] || 'Sí'}</button>
              <button type="button" className="btn borde2 chico" disabled={va === p.id} onClick={() => resolver(p, false)}>No</button>
            </div> : null}
          </li>
        );
      })}</ul>
    </>
  );
}

// 🔔 LO QUE PIDE ATENCIÓN y no es una cola (las colas son los cuadrados de «Para decidir»): `[ícono, título, detalle,
// área, ancla]`, y el botón «Ir» lleva a donde se arregla (antes decía «Abajo, en…» o «Mira Sistema.» sin link)
function atencion(d, liga, q, logs) {
  const aj = d.ajustes || {};
  const ult = (d.corridas || [])[0];
  return [
    aj.campana_pausada ? ['⏸', 'La campana está en pausa', 'No sale ningún aviso de evento hasta que la reanudes.', 'web', 'aj-campana'] : null,
    d.sistema && d.sistema.ok === false ? ['⚠️', 'El lector de anuncios no contesta', 'Los avisos al minuto y el bot en vivo pueden estar quietos.', 'salud', 'sa-corridas'] : null,
    ult && ult.estado === 'completed' && ult.fin && ult.fin !== 'success' && ult.fin !== 'skipped'
      ? ['⚠️', 'La última vuelta del ciclo ' + String(FIN_CORRIDA[ult.fin] || ult.fin).replace(/^\S+\s/, ''), 'Puedes correrlo de nuevo desde Salud.', 'salud', 'sa-corridas'] : null,
    ...cuotasEnRojo(q).map(([, , t]) => ['⚠️', t + ' casi llenas hoy', 'Se renuevan a las ' + hora(renuevaKV()) + '.', 'salud', 'sa-cuotas']),
    ...(d.reportes || []).filter((x) => x.estado === 'no_pude').map((x) => ['⚠️', 'No se pudo corregir la llave #' + x.llave, x.resultado, 'pendientes', '']),
    // 📋 LOS QUE NO LLEGAN A LO QUE PIDE SU TIER (20/11/2026): el `rec` del ciclo (`recomendar()` de bot/tiers.py), el mismo
    // «Te falta» que ve su dueño en la cabina. Avisa y nada más: el tier lo cambias tú. Quien está en su primer tramo no sale
    ...(() => {
      const no = ((d.tiers || {}).servidores || []).filter((x) => x.rec === 'revisar');
      if (!no.length) return [];
      return [['📋', no.length === 1 ? siglaDe(no[0].sv) + ': revisar su tier' : no.length + ' servidores para revisar su tier',
        no.map((x) => siglaDe(x.sv) + ' (Tier ' + x.tier + ') ' + String(x.porque || '').replace(/^no llega a lo que pide Tier \d+: /, '')).join(' · ')
          + '. Avisa y nada más: el tier lo cambias tú.', 'servidores', 'sv-cada']];
    })(),
    ...(() => {
      const v = logsVistos();
      const n = ((logs && logs.xs) || []).filter((x) => x.nivel === 'rojo' && !v.includes(x.id)).length;
      return n ? [['🔴', n === 1 ? 'Un aviso en rojo en Logs' : n + ' avisos en rojo en Logs', 'Lo que avisó el canal de Logs y no viste.', 'salud', 'sa-logs']] : [];
    })(),
  ].filter(Boolean);
}

// ── 🏟️ AJUSTES POR SERVIDOR: todo lo de cada uno en su tarjeta —el bot en vivo y cuánto habla, las apuestas, el aviso de
// cada evento y el multiplicador de la semana— en vez de que cada ajuste repita la lista de servidores. Cada selector
// guarda con el mismo `ajustar()` y el mismo valor entero que guardaban las cajas de antes
function AjServidores({ liga, aj, hacer, ocup, chat }) {
  const c = chat || {};
  const svs = svsDe(chat, aj);
  if (!svs.length) return <p className="db-tx">Todavía no sé el chat general de ningún servidor: el vigía lo busca en su próxima vuelta.</p>;
  const dash = aj.en_vivo || {}, dashNivel = aj.en_vivo_nivel || {};
  const niveles = c.niveles || NIVELES_VIVO;
  const admin = c.admin || {};
  const nivelAdmin = (sv) => (c.nivel || {})[sv] || 'normal';
  const prendido = (sv) => dash[sv] !== false && (!!admin[sv] || dash[sv] === true);
  const ae = aj.aviso_evento || {};
  const porSv = ae.sv || {};
  const m = liga.d.mult || {};
  const base = m.sv || {};
  const man = aj.multiplicadores && aj.multiplicadores.semana === m.id ? aj.multiplicadores.sv || {} : null;
  const ref = Object.assign({}, base, man || {});
  const YA = 'Guardado: vale desde el próximo minuto.';
  const cambiar = (cual, obj, sv, v) => { const n = Object.assign({}, obj); if (v === '') delete n[sv]; else n[sv] = v; return hacer(cual, n, YA); };
  const cambiarAviso = (sv, v) => {
    const n = Object.assign({}, porSv);
    if (v) n[sv] = v; else delete n[sv];
    return hacer('aviso_evento', { sv: n, resto: ae.resto || '' }, 'Guardado: vale desde el próximo evento.');
  };
  const cambiarMult = (sv, x) => hacer('multiplicadores', { semana: m.id, sv: Object.assign({}, ref, { [sv]: x }) },
    'Guardado. Entra en la próxima corrida del ciclo.');
  return (
    <>
      {m.id ? (
        <div className="db-svs-c">
          <span className={'db-est' + (man ? ' ojo' : '')}>{man ? '✍ El multiplicador de esta semana va a mano' : 'El multiplicador de esta semana es el del sorteo'}</span>
          {man ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para volver al sorteo"
            onClick={() => hacer('multiplicadores', null, 'Vuelve el sorteo en la próxima corrida del ciclo.')}>Volver al sorteo</DosToques> : null}
        </div>
      ) : null}
      <div className="db-svs">{svs.map((sv) => {
        // 🔑 TAMBIÉN EL QUE NO ESTABA EN EL SORTEO (15/10/2026: FRZ entró el miércoles y el sorteo fue el lunes): sin
        // sortear vale ×1, y se puede elegir a mano igual (`a_mano()` de bot/multiplicadores.py lo acepta)
        const vm = ref[sv] == null ? 1 : ref[sv];
        const ops = FACTORES.indexOf(vm) < 0 ? [...FACTORES, vm].sort((a, b) => a - b) : FACTORES;
        return (
          <section key={sv} className="db-svc" aria-label={'Ajustes de ' + siglaDe(sv)}>
            <header><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b>
              <span className={'db-est' + (prendido(sv) ? ' ok' : '')}>{prendido(sv) ? '● bot en vivo' : 'bot apagado'}</span></header>
            <label><span>Bot en vivo</span>
              <select value={dash[sv] === true ? 'si' : dash[sv] === false ? 'no' : ''} disabled={ocup}
                onChange={(e) => cambiar('en_vivo', dash, sv, e.target.value === '' ? '' : e.target.value === 'si')}>
                <option value="">{admin[sv] ? 'Lo que eligió su admin: prendido' : 'Lo que eligió su admin: apagado'}</option>
                <option value="si">Prendido, en su chat general</option>
                <option value="no">Apagado</option>
              </select></label>
            <label><span>Cuánto habla</span>
              <select value={niveles[dashNivel[sv]] ? dashNivel[sv] : ''} disabled={ocup || !prendido(sv)}
                onChange={(e) => cambiar('en_vivo_nivel', dashNivel, sv, e.target.value)}>
                <option value="">{'Lo que eligió su admin: ' + ((niveles[nivelAdmin(sv)] || ['normal'])[0]).toLowerCase()}</option>
                {Object.keys(niveles).map((k) => <option key={k} value={k}>{niveles[k][0]}</option>)}
              </select></label>
            {/* 📅 los eventos de Discord (19/10/2026): cada anuncio, un evento del servidor con «Me interesa» */}
            <label><span>Eventos de Discord</span>
              <select value={(aj.eventos_discord || {})[sv] === true ? 'si' : ''} disabled={ocup}
                onChange={(e) => cambiar('eventos_discord', aj.eventos_discord || {}, sv, e.target.value === 'si' ? true : '')}>
                <option value="">Apagados</option>
                <option value="si">Cada anuncio, un evento de su Discord</option>
              </select>
              {(c.evd || {})[sv] ? <small className="db-tx">{(c.evd[sv].creados || 0) + ' en 7 días'
                + (c.evd[sv].error === 'permiso' ? ' · ⚠️ al bot le falta «Crear eventos» ahí' : c.evd[sv].error ? ' · ⚠️ ' + c.evd[sv].error : '')}</small> : null}</label>
            <label><span>Aviso de cada evento</span>
              <select value={porSv[sv] || ''} disabled={ocup} onChange={(e) => cambiarAviso(sv, e.target.value)}>
                <option value="">Donde habla el bot en vivo</option>
                <option value="chat">En su chat general, siempre</option>
                <option value="no">Apagado</option>
              </select></label>
            {m.id ? (
              <label><span>Multiplicador de la semana</span>
                <select value={String(vm)} disabled={ocup} onChange={(e) => cambiarMult(sv, Number(e.target.value))}>
                  {ops.map((x) => <option key={x} value={String(x)}>{mult(x)}</option>)}
                </select></label>
            ) : null}
          </section>
        );
      })}</div>
    </>
  );
}

// ── 🕓 LOS ÚLTIMOS CAMBIOS, CON «DESHACER» (13/10/2026): lo anota el objeto en cada ajuste (`ajuste()` en avisos.js), con
// lo que había antes. «Deshacer» sólo en el último cambio de cada ajuste: deshacer uno más viejo pisaría los de después
const NOMBRE_AJ = { siglas: 'Las siglas de los servidores', campana_pausada: 'La campana', pase_sorteo: 'El sorteo del premium', multiplicadores: 'El multiplicador de la semana', aviso_web: 'El aviso en la página',
  en_vivo: 'El bot en vivo', en_vivo_nivel: 'Cuánto habla el bot en vivo', ritmo: 'El ritmo del bot en vivo', silencio: 'El horario de silencio',
  apuestas: 'Las apuestas', aviso_evento: 'Dónde va el aviso de cada evento', avisos_nivel: 'Cuánto dice el aviso de cada evento',
  // 🏷️ y los que salían con el código crudo (25/10/2026)
  eventos_discord: 'Los eventos de Discord', tiers: 'El tier de los servidores', beneficios: 'Lo que recibe cada servidor', altas: 'Sumar un servidor',
  setup_suma: 'Los puntos de los que corrieron /setup',
  socios_duenos: 'El dueño de un servidor socio', promos_mano: 'Las promos a mano', promos_quitar: 'Las promos sacadas', mes_sacar: 'Los nominados de los MES AWARDS',
  crew_precio: 'Lo que cuesta crear una crew', crew_precio_nombre: 'Lo que cuesta cambiarle el nombre a una crew', crew_precio_logo: 'Lo que cuesta cambiarle el logo a una crew',
  crews_ranking: 'El ranking de crews', crews_tiers_num: 'Los tiers de las crews', eventos_estilo: 'Los eventos de estilo' };
function Historial({ hist, hacer, ocup }) {
  const xs = (hist || []).slice(0, 15);
  if (!xs.length) return <p className="db-tx">Todavía no hay cambios anotados: el historial empezó el 13/10/2026.</p>;
  const ultimo = new Set();
  return (
    <ul className="db-hist">{xs.map((x) => {
      const puede = !ultimo.has(x.cual);
      ultimo.add(x.cual);
      return (
        <li key={x.t + x.cual}>
          <div><b>{NOMBRE_AJ[x.cual] || x.cual}</b>
            <small>{hace(x.t)} · {x.despues === null ? 'volvió a lo de siempre' : x.antes === null ? 'pasó a tu gusto' : 'cambió'}{x.por && x.por !== 'Dlx' ? ' · lo cambió ' + x.por : ''}</small></div>
          {puede ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo: vuelve a como estaba"
            onClick={() => hacer(x.cual, volverA(x.cual, x.antes), 'Deshecho: volvió a como estaba.')}>Deshacer</DosToques> : null}
        </li>
      );
    })}</ul>
  );
}

// ── 🏷️ LOS ROLES DE LA PÁGINA (13/10/2026). Dlx: «roles superiores ÚNICAMENTE decididos por mí: Moderador de la página
// web, asistente, Admin y owner únicamente yo». Los que salen solos (Competidor, Socio, Staff, Organizador, Jurado,
// Host) los arma el ciclo desde Discord; acá se ponen los de Dlx y se corrige cualquiera. Owner es sólo Dlx ──
const ROLES_MANO = [['admin', 'Admin'], ['moderador', 'Moderador de la página'], ['asistente', 'Asistente'], ['socio', 'Socio'],
  ['staff', 'Staff'], ['organizador', 'Organizador'], ['jurado', 'Jurado'], ['host', 'Host'], ['competidor', 'Competidor']];
const nombreRol = (r) => ((ROLES_MANO.find((x) => x[0] === r) || [r, r === 'owner' ? 'Owner' : r])[1]);
const normN = (s) => String(s || '').normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

async function ponerRol(cuerpo) {
  const r = await fetch('/api/avisos/dueno/rol', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : j.error || String(r.status));
  return j.roles || {};
}

function Roles({ roles, alCambiar, tabla, elegido }) {
  const [x, setX0] = useState(roles || {});
  useEffect(() => { setX0(roles || {}); }, [roles]);
  const setX = (y) => { setX0(y); if (alCambiar) alCambiar(y); };
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState(null);
  // «Cambiar» en la lista de quién tiene un rol abre a esa persona acá
  useEffect(() => { if (elegido && elegido.id) setSel(elegido.id); }, [elegido]);
  const [pide, setPide] = useState(null);
  const [escrito, setEscrito] = useState('');
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const dir = x.dir || [], man = x.manual || {};
  if (!dir.length) return <p className="pronto-p">El ciclo todavía no mandó la lista de la gente: aparece en su próxima corrida.</p>;
  const q = normN(busca);
  const hallados = q.length >= 2 ? dir.filter((p) => normN(p[1]).includes(q)).slice(0, 8) : [];
  const p = sel && dir.find((y) => y[2] === sel);
  const conMano = dir.filter((y) => man[y[2]] && Object.keys(man[y[2]]).length);
  const cambiar = async (rol, si) => {
    setOcup(true); setMsg(''); setPide(null); setEscrito('');
    try { setX(await ponerRol({ id: p[2], rol, si })); } catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup(false);
  };
  // 🛑 DAR UN ROL ALTO PIDE ESCRIBIR SU NOMBRE (25/10/2026, el research: «el freno se mide por el daño»). Admin,
  // Asistente y Moderador abren el Dashboard a esa persona; sacarlo, o los roles que no abren nada, van directo
  const ALTOS = { admin: 1, moderador: 1, asistente: 1 };
  const abre = (rol) => queAbre(rol, tabla);
  const elegir = (rol, v) => {
    const si = v === 'si' ? true : v === 'no' ? false : null;
    if (si === true && ALTOS[rol]) { setPide(rol); setEscrito(''); return; }
    cambiar(rol, si);
  };
  const chips = (l) => (l || []).map((r) => <span key={r[0]} className="db-chip">{nombreRol(r[0])}{r[1] ? ' · ' + r[1].join(', ') : ''}</span>);
  return (
    <div className="db-roles">
      <label className="db-campo"><span>Buscar a alguien de la Lista</span>
        <input type="search" className="db-sel" value={busca} placeholder="su nombre" onChange={(e) => setBusca(e.target.value)} /></label>
      {hallados.length ? <div className="db-opc">{hallados.map((y) => (
        <button key={y[2]} type="button" className={sel === y[2] ? 'on' : ''} onClick={() => setSel(y[2])}>{y[1]}</button>))}</div> : null}
      {p ? (
        <div className="db-rep-form">
          <span className="db-rep-p">{p[1]}{p[0] ? <> · <a href={'#/r/' + p[0]}>su perfil</a> · <BotonFicha k={p[0]} n={p[1]} /></> : null}</span>
          <div className="db-l1">{p[3].length ? chips(p[3]) : <small>Sin roles.</small>}</div>
          {p[2] === '739338101603696681' ? <small>Owner: sólo tú, siempre.</small> : null}
          <ul className="db-roles-l">{ROLES_MANO.map(([rol, n]) => {
            const m = (man[p[2]] || {})[rol];
            const solo = p[4] && p[4][rol];
            return (
              <li key={rol}>
                <b>{n}</b>
                <small>{solo ? 'sale solo' + (solo.length ? ' (' + solo.join(', ') + ')' : '') : ['admin', 'asistente', 'moderador'].includes(rol) ? '' : 'no sale solo'}</small>
                <select className="db-sel" disabled={ocup} value={pide === rol ? 'si' : m === 1 ? 'si' : m === 0 ? 'no' : 'auto'}
                  onChange={(e) => elegir(rol, e.target.value)}>
                  <option value="auto">{['admin', 'asistente', 'moderador'].includes(rol) ? 'No' : 'Como sale solo'}</option>
                  <option value="si">Sí</option>
                  {['admin', 'asistente', 'moderador'].includes(rol) ? null : <option value="no">No, aunque salga solo</option>}
                </select>
              </li>
            );
          })}</ul>
          {pide ? (
            <div className="dz-freno" role="group" aria-label="Confirmar el rol">
              <p>Darle <b>{nombreRol(pide)}</b> a <b>{p[1]}</b> le abre: {abre(pide)}. Para confirmar, escribe su nombre:</p>
              <div className="dz-freno-f">
                <input type="text" value={escrito} aria-label={'Escribe ' + p[1] + ' para confirmar'} placeholder={p[1]} onChange={(e) => setEscrito(e.target.value)} />
                <button type="button" className="btn verde chico" disabled={ocup || normN(escrito) !== normN(p[1])} onClick={() => cambiar(pide, true)}>Darle {nombreRol(pide)}</button>
                <button type="button" className="dz-lnk" onClick={() => { setPide(null); setEscrito(''); }}>Cancelar</button>
              </div>
            </div>
          ) : null}
          {msg ? <small role="status">{msg}</small> : null}
        </div>
      ) : null}
      {conMano.length ? <><span className="db-rep-p">Con roles puestos a mano</span>
        <ul className="db-roles-c">{conMano.map((y) => (
          <li key={y[2]}><button type="button" className="db-link" onClick={() => setSel(y[2])}>{y[1]}</button>
            {Object.entries(man[y[2]]).map(([r, si]) => <span key={r} className="db-chip">{si ? '' : 'sin '}{nombreRol(r)}</span>)}</li>))}</ul></> : null}
      {(x.hist || []).length ? <><span className="db-rep-p">Los últimos cambios</span>
        <ul className="db-roles-c">{x.hist.slice(0, 8).map((h) => (
          <li key={h.t + h.rol}><small>{hace(h.t)}</small> {h.n || h.id}: {h.si === null ? 'como sale solo' : h.si ? 'sí' : 'no'} {nombreRol(h.rol)}</li>))}</ul></> : null}
    </div>
  );
}

// 🎛️ QUÉ PUEDE CADA ROL (11/11/2026, Dlx: «asegurarte que las personas que tengan rangos puedan hacer X tipo de cosas…
// yo como owner»). Lo que dice cada permiso, en palabras; «roles» no se edita: dar y sacar roles es sólo tuyo
const PERMISO_TXT = {
  panel: ['Entrar al Dashboard', 'sin esto no ve nada'],
  ajustes: ['Cambiar los ajustes', 'la página, el bot, los servidores, los números y la salud'],
  ciclo: ['Correr el ciclo a mano', ''],
  reportes: ['Corregir llaves reportadas', 'cambia nombres, ganadores y si una llave cuenta'],
  reportes_cerrar: ['Cerrar reportes y pedidos', 'lo que no mueve puntos'],
  decidir: ['Contestar «¿Quién es quién?»', 'une y separa personas'],
  videos: ['Revisar videos', ''],
  fondos: ['Aprobar fondos, fotos y logos', ''],
  roles: ['Dar y sacar roles', 'sólo tú'],
};
// el mismo nombre que en «Quién tiene un rol» y en `ROLES_MANO`: era «Moderador» acá y «Moderador de la página» allá
const ROLES_DASH = [['admin', 'Admin'], ['moderador', 'Moderador de la página'], ['asistente', 'Asistente']];
//: lo que abre un rol, en palabras, con la tabla vigente
function queAbre(rol, tabla) {
  const t = (tabla && tabla.tabla) || null;
  if (!t) return 'su parte del Dashboard';
  const xs = Object.keys(PERMISO_TXT).filter((k) => (t[k] || []).includes(rol)).map((k) => PERMISO_TXT[k][0].toLowerCase());
  return xs.length ? xs.join(', ') : 'nada';
}

async function ponerPermisos(cuerpo) {
  const r = await fetch('/api/avisos/dueno/permisos', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : j.error || String(r.status));
  return j.permisos || null;
}

function TablaPermisos({ P, alCambiar }) {
  const [t, setT] = useState((P && P.tabla) || {});
  useEffect(() => { setT((P && P.tabla) || {}); }, [P]);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  if (!P || !P.tabla) return <p className="pronto-p">Esto aparece cuando el bot se actualice: la tabla vive en el servidor.</p>;
  const siempre = P.siempre || {};
  const tiene = (k, r) => (t[k] || []).includes(r);
  const poner = (k, r) => setT(Object.assign({}, t, { [k]: tiene(k, r) ? (t[k] || []).filter((x) => x !== r) : [...(t[k] || []), r] }));
  const igual = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
  const cambios = Object.fromEntries((P.editables || []).filter((k) => !igual(t[k], P.tabla[k])).map((k) => [k, t[k] || []]));
  const distinto = (P.editables || []).some((k) => !igual(P.tabla[k], siempre[k]));
  const sinPanel = ROLES_DASH.filter(([r]) => !tiene('panel', r)).map((x) => x[1]);
  const guardar = async (cuerpo, ok) => {
    setOcup(true); setMsg('');
    try { const n = await ponerPermisos(cuerpo); if (n && alCambiar) alCambiar(n); setMsg(ok); } catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup(false);
  };
  return (
    <div className="dz-perm">
      <p className="db-tx">Marca qué puede hacer cada rol. Tú, como owner, puedes todo siempre. Se guarda al tocar «Guardar» y vale desde el próximo pedido de cada uno.</p>
      <div className="db-tabla"><table>
        <thead><tr><th scope="col">Puede…</th>{ROLES_DASH.map(([r, n]) => <th key={r} scope="col">{n}</th>)}</tr></thead>
        <tbody>{Object.keys(PERMISO_TXT).map((k) => {
          const fijo = !(P.editables || []).includes(k);
          return (
            <tr key={k}>
              <th scope="row"><b>{PERMISO_TXT[k][0]}</b>{PERMISO_TXT[k][1] ? <small>{PERMISO_TXT[k][1]}</small> : null}</th>
              {ROLES_DASH.map(([r, n]) => {
                const cambiado = !fijo && tiene(k, r) !== (siempre[k] || []).includes(r);
                return (
                  <td key={r} className={cambiado ? 'dz-perm-cam' : ''}>
                    <input type="checkbox" disabled={fijo || ocup} checked={tiene(k, r)} aria-label={n + ': ' + PERMISO_TXT[k][0]}
                      onChange={() => poner(k, r)} />
                  </td>
                );
              })}
            </tr>
          );
        })}</tbody>
      </table></div>
      {sinPanel.length ? <p className="db-tx"><b>Ojo:</b> {sinPanel.join(' y ')} no {sinPanel.length > 1 ? 'pueden' : 'puede'} entrar al Dashboard, así que lo demás no {sinPanel.length > 1 ? 'les' : 'le'} sirve.</p> : null}
      <div className="dz-perm-b">
        <button type="button" className="btn verde chico" disabled={ocup || !Object.keys(cambios).length} onClick={() => guardar({ cambios }, 'Guardado.')}>Guardar</button>
        {Object.keys(cambios).length ? <button type="button" className="dz-lnk" disabled={ocup} onClick={() => setT(P.tabla)}>Descartar</button> : null}
        {distinto ? <button type="button" className="dz-lnk" disabled={ocup} onClick={() => guardar({ siempre: true }, 'Volvió a lo de siempre.')}>Volver a lo de siempre</button> : null}
        {msg ? <small role="status">{msg}</small> : null}
      </div>
      {(P.hist || []).length ? <><span className="db-rep-p">Los últimos cambios de la tabla</span>
        <ul className="db-roles-c">{P.hist.slice(0, 6).map((h) => (
          <li key={h.t}><small>{hace(h.t)}</small> {h.por || 'Dlx'}: {(P.editables || []).filter((k) => !igual((h.antes || {})[k], (h.despues || {})[k])).map((k) => PERMISO_TXT[k][0]).join(', ') || 'nada'}</li>))}</ul></> : null}
    </div>
  );
}

// ── 🎚️ LLAVES Y FONDOS (11/11/2026) ──────────────────────────────────────
// la lista entera de llaves de la temporada: la misma de «Ver llave» (pública), una vez por visita
let llavesTodas = null;
function useLlavesTodas() {
  const [x, setX] = useState(llavesTodas);
  useEffect(() => {
    if (llavesTodas) return undefined;
    let vivo = true;
    // ⚠️ un fallo NO se guarda (18/11/2026): se guardaba `{}`, que es verdadero, y no se volvía a pedir en toda la visita
    // —la lista salía vacía y sin avisar—. Ahora queda `null` para la próxima vez y esta dice que no pudo (`false`)
    fetch('/api/llaves').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
      const ok = !!j && typeof j === 'object';
      llavesTodas = ok ? j : null;
      if (vivo) setX(ok ? j : false);
    });
    return () => { vivo = false; };
  }, []);
  return x;
}
const claveLlave = (e) => [e.nombre, e.sv, e.fecha].join(' · ');

async function pedirLlaveCuenta(cuerpo) {
  const r = await fetch('/api/avisos/dueno/llave-cuenta', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : r.status === 404 ? 'el bot todavía no se actualizó' : j.error || String(r.status));
  return j.llaves_cuenta;
}

// «(sin titulo)» es como el lector guarda la llave sin nombre: en pantalla, con su tilde
const sinTitulo = (n) => (/^\(?sin t[ií]tulo\)?$/i.test(String(n || '').trim()) ? 'Sin título' : n);

function LlavesCuentan({ L, liga, alCambiar }) {
  const todas = useLlavesTodas();
  const [q, setQ] = useState('');
  const [sv, setSv] = useState('');
  const [seguro, setSeguro] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  if (!L) return <p className="pronto-p">Esto aparece cuando el bot se actualice: la lista de lo que no cuenta vive en el servidor.</p>;
  if (todas === false) return <p className="db-tx">No pude traer las llaves de la temporada: prueba en un rato.</p>;
  if (!todas) return <p className="db-tx">Cargando las llaves de la temporada…</p>;
  const no = new Set(L.no_cuentan || []);
  const ped = L.pedidos || {};
  // 👀 sin las de los servidores que no suman (`ns`, `llaves_sin_sumar.json`): nunca contaron y sacarlas no hace nada. Su
  // número era el final del mensaje de Discord (#195217675) y salían con «Cuenta» (12/11/2026, mirándolo con Dlx)
  // 📅 la más nueva arriba POR FECHA, no por número: una llave cargada tarde tiene número alto y fecha vieja (la #598 es del
  // 23/09 y salía entre la #599 del 08/10 y la #597 del 09/11). A igual día, el número
  const xs = Object.values(todas).filter((e) => e && e.nombre && e.sv && e.fecha && !e.ns)
    .sort((a, b) => String(b.dia || '').localeCompare(String(a.dia || '')) || (b.n || 0) - (a.n || 0));
  const svs = [...new Set(xs.map((e) => e.sv))].sort();
  const qn = normN(q);
  const vis = xs.filter((e) => (!sv || e.sv === sv) && (!qn || normN(e.nombre).includes(qn) || String(e.n) === q.trim().replace('#', '')));
  // las que no cuentan y ya no están en la lista de «Ver llave» (se fueron con la decisión): también se pueden devolver
  const sueltas = [...no].filter((c) => !xs.some((e) => claveLlave(e) === c));
  const estado = (c) => (ped[c] ? (ped[c].cuenta ? 'vuelve' : 'sale') : no.has(c) ? 'no' : 'si');
  const pedir = async (c, n, cuenta) => {
    setOcup(true); setMsg('');
    try { alCambiar(await pedirLlaveCuenta({ clave: c, n: n ? String(n) : '', cuenta, motivo })); setMsg(cuenta ? 'Listo: vuelve a contar en la próxima corrida del ciclo.' : 'Listo: sale del ranking en la próxima corrida del ciclo.'); }
    catch (e) { setMsg('No se pudo: ' + e.message); }
    setSeguro(null); setMotivo(''); setOcup(false);
  };
  const fila = (c, e) => {
    const st = estado(c);
    return (
      <li key={c} className={'dz-ll' + (st === 'no' || st === 'sale' ? ' fuera' : '')}>
        <div>
          <b>{e ? '#' + e.n + ' · ' : ''}{sinTitulo(limpio(e ? e.nombre : c.split(' · ')[0]))}</b>
          <small>{siglaDe(e ? e.sv : c.split(' · ')[1])} · {e ? e.fecha : c.split(' · ')[2]}{e && e.participantes ? ' · ' + e.participantes + ' raperos' : ''}</small>
        </div>
        <span className={'db-chip' + (st === 'si' ? ' ok' : ' ojo')}>{{ si: 'Cuenta', no: 'No cuenta', sale: 'Sale en la próxima corrida', vuelve: 'Vuelve en la próxima corrida' }[st]}</span>
        {seguro === c ? (
          <div className="dz-ll-f">
            {st === 'si' ? <input type="text" className="db-sel" maxLength={160} placeholder="por qué (opcional)" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} /> : null}
            <button type="button" className="btn verde chico" disabled={ocup} onClick={() => pedir(c, e && e.n, st !== 'si' && st !== 'vuelve')}>
              {st === 'si' || st === 'vuelve' ? 'Sí, que no cuente' : 'Sí, que vuelva a contar'}</button>
            <button type="button" className="dz-lnk" onClick={() => setSeguro(null)}>Cancelar</button>
          </div>
        ) : (
          <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => { setSeguro(c); setMotivo(''); }}>
            {st === 'si' || st === 'vuelve' ? 'No cuenta' : 'Vuelve a contar'}</button>
        )}
      </li>
    );
  };
  return (
    <div className="dz-lls">
      <p className="db-tx">Una llave que no cuenta sale del ranking para todos: sus puntos, sus duelos y sus podios. Lo aplica el ciclo en su próxima corrida. Devolverla la hace entrar de nuevo.</p>
      <div className="dz-ll-b">
        <input type="search" className="db-sel" placeholder="nombre o número de la llave" value={q} onChange={(ev) => setQ(ev.target.value)} />
        <select className="db-sel" value={sv} onChange={(ev) => setSv(ev.target.value)}>
          <option value="">Todos los servidores</option>
          {svs.map((x) => <option key={x} value={x}>{siglaDe(x)}</option>)}
        </select>
        <small>{no.size} no cuenta{no.size === 1 ? '' : 'n'} · {Object.keys(ped).length} esperando al ciclo</small>
      </div>
      {sueltas.length ? <><span className="db-rep-p">Las que no cuentan</span><ul className="dz-ll-l">{sueltas.map((c) => fila(c, null))}</ul></> : null}
      <ul className="dz-ll-l">{vis.slice(0, 40).map((e) => fila(claveLlave(e), e))}</ul>
      {vis.length > 40 ? <small>Y {vis.length - 40} más: busca por el nombre o el número.</small> : null}
      {msg ? <small role="status">{msg}</small> : null}
    </div>
  );
}

// 🌆 la imagen, achicada en el navegador antes de subirla: el VS se dibuja a 1200 px, más no se ve y pesa
// 🔎 2400 de ancho (antes 1600) y la calidad más alta que entre en lo que acepta el Worker (1.600.000 caracteres en
// base64, ~1,2 MB): los VS en vivo van a pantalla completa (Dlx, 12/11/2026: «que todo esté siempre en HD»)
function achicar(file, ancho = 2400) {
  return new Promise((ok, mal) => {
    const fr = new FileReader();
    fr.onerror = () => mal(new Error('no pude leer el archivo'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => mal(new Error('no es una imagen'));
      im.onload = () => {
        const f = Math.min(1, ancho / im.width);
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * f); c.height = Math.round(im.height * f);
        const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.drawImage(im, 0, 0, c.width, c.height);
        let b64 = '';
        for (const q of [0.92, 0.86, 0.78, 0.7]) { b64 = c.toDataURL('image/jpeg', q).split(',')[1]; if (b64.length < 1500000) break; }
        ok(b64);
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

async function pedirVsFondo(cuerpo) {
  const r = await fetch('/api/avisos/dueno/vs-fondo', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : r.status === 404 ? 'el bot todavía no se actualizó' : j.error || String(r.status));
  return j.vs_fondos || {};
}

function FondosVs({ F, svs, liga, alCambiar }) {
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  if (!svs.length) return <p className="db-tx">Todavía no sé de ningún servidor con bot en vivo.</p>;
  const subir = async (sv, file) => {
    if (!file) return;
    setOcup(sv); setMsg('');
    try { alCambiar(await pedirVsFondo({ sv, img: await achicar(file) })); setMsg('Listo: el fondo de ' + siglaDe(sv) + ' va desde el próximo VS.'); }
    catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup('');
  };
  const volver = async (sv) => {
    setOcup(sv); setMsg('');
    try { alCambiar(await pedirVsFondo({ sv, borrar: true })); setMsg(siglaDe(sv) + ' vuelve a su fondo de siempre.'); }
    catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup('');
  };
  return (
    <div className="dz-vsf">
      <ul className="dz-vsf-l">{svs.map((sv) => {
        const x = F[sv];
        return (
          <li key={sv}>
            <div className="dz-vsf-img" style={x ? { backgroundImage: 'url("' + x.url + '")' } : undefined}>
              {x ? null : <span>el de siempre</span>}
            </div>
            <div className="dz-vsf-t">
              <b><img alt="" src={liga.logo(sv)} />{siglaDe(sv)}</b>
              <small>{x ? 'subido ' + hace(x.t) + (x.por ? ' por ' + x.por : '') : 'el que viene con el bot'}</small>
              <span className="dz-vsf-b">
                <label className={'btn borde2 chico' + (ocup ? ' off' : '')}>
                  {ocup === sv ? 'Subiendo…' : x ? 'Cambiarlo' : 'Subir uno'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={!!ocup}
                    onChange={(ev) => { subir(sv, ev.target.files && ev.target.files[0]); ev.target.value = ''; }} />
                </label>
                {x ? <button type="button" className="dz-lnk" disabled={!!ocup} onClick={() => volver(sv)}>Volver al de siempre</button> : null}
              </span>
            </div>
          </li>
        );
      })}</ul>
      {msg ? <small role="status">{msg}</small> : null}
    </div>
  );
}

function FondosVistos({ fs, liga }) {
  // el nombre como sale en el ranking («Calíz»), no la clave del perfil («caliz»). Aunque esté fuera de las 200 filas
  // (18/11/2026), y también en el aviso de «Quitado», que decía la clave
  usePerfiles();
  const nom = (k) => (liga ? liga.nombreDe(k) : k);
  const [fuera, setFuera] = useState({});
  const [sel, setSel] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS_FONDO[0]);
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const xs = fs.filter((f) => !fuera[f.quien]);
  if (!xs.length) return <p className="db-tx">Nadie tiene un fondo puesto todavía.</p>;
  const quitar = async (f) => {
    setOcup(true); setMsg('');
    try {
      const r = await fetch('/api/avisos/dueno/fondo', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quien: f.quien, si: false, motivo }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || String(r.status));
      setFuera(Object.assign({}, fuera, { [f.quien]: 1 })); setSel('');
      setMsg('Quitado: a ' + (f.k ? nom(f.k) : 'esa persona') + ' le llega el aviso a su campana.');
    } catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup(false);
  };
  return (
    <div className="dz-fv">
      <ul className="dz-fv-l">{xs.map((f) => (
        <li key={f.quien}>
          <div className="dz-fv-img" style={{ backgroundImage: 'url("' + f.url + '")' }} />
          <div className="dz-fv-t">
            {f.k ? <a href={'#/r/' + f.k}>{nom(f.k)}</a> : <span>sin perfil</span>}
            <small>{hace(f.t)}</small>
            {sel === f.quien ? (
              <span className="dz-fv-q">
                <select className="db-sel" value={motivo} onChange={(ev) => setMotivo(ev.target.value)}>
                  {MOTIVOS_FONDO.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" className="btn verde chico" disabled={ocup} onClick={() => quitar(f)}>Quitarlo</button>
                <button type="button" className="dz-lnk" onClick={() => setSel('')}>Cancelar</button>
              </span>
            ) : <button type="button" className="btn borde2 chico" onClick={() => setSel(f.quien)}>Quitar</button>}
          </div>
        </li>
      ))}</ul>
      {msg ? <small role="status">{msg}</small> : null}
    </div>
  );
}

function QuienTieneRol({ roles, P, alElegir }) {
  const dir = (roles && roles.dir) || [];
  const con = dir.filter((p) => (p[3] || []).some((r) => ['admin', 'moderador', 'asistente'].includes(r[0])));
  if (!dir.length) return <p className="pronto-p">El ciclo todavía no mandó la lista de la gente: aparece en su próxima corrida.</p>;
  if (!con.length) return <p className="db-tx">Nadie tiene un rol del Dashboard todavía, además de ti.</p>;
  return (
    <div className="db-tabla"><table>
      <thead><tr><th scope="col">Persona</th><th scope="col">Rol</th><th scope="col">Puede</th><th scope="col" /></tr></thead>
      <tbody>{con.map((p) => {
        const rs = (p[3] || []).map((r) => r[0]).filter((r) => ['admin', 'moderador', 'asistente'].includes(r));
        return (
          <tr key={p[2]}>
            <td><b>{p[1]}</b>{p[0] ? <> · <BotonFicha k={p[0]} n={p[1]} /></> : null}</td>
            <td>{rs.map((r) => <span key={r} className="db-chip">{nombreRol(r)}</span>)}</td>
            <td className="dz-perm-que">{rs.map((r) => queAbre(r, P)).join(' · ')}</td>
            <td><button type="button" className="btn borde2 chico" onClick={() => alElegir(p[2])}>Cambiar</button></td>
          </tr>
        );
      })}</tbody>
    </table></div>
  );
}

function Ajustes({ liga, aj, chat, hist, hacer, msg, ocup, roles, alRoles, conRoles = true }) {
  return (
    <>
      <h2 className="db-h">Cada servidor</h2>
      <AjServidores liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} />
      {msg ? <p className="db-msg" role="status">{msg}</p> : null}
      <h2 className="db-h">Para todos</h2>
      <div className="db-ajs">
        <AjCampana aj={aj} hacer={hacer} ocup={ocup} />
        <AjSorteo liga={liga} aj={aj} hacer={hacer} ocup={ocup} />
        <AjAviso liga={liga} aj={aj} hacer={hacer} ocup={ocup} />
        <AjVivo liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general />
        <AjRitmo aj={aj} hacer={hacer} ocup={ocup} chat={chat} />
        <AjSilencio aj={aj} hacer={hacer} ocup={ocup} />
        <AjApuestas liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general />
        <AjAvisos liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general />
        <AjCrews liga={liga} aj={aj} hacer={hacer} ocup={ocup} />
      </div>
      <h2 className="db-h">Los últimos cambios</h2>
      <Historial hist={hist} hacer={hacer} ocup={ocup} />
      {conRoles ? <><h2 className="db-h">Roles</h2>
        <Roles roles={roles} alCambiar={alRoles} /></> : null}
    </>
  );
}

// 🎬 LOS VIDEOS QUE NO ENTRARON SOLOS (12/10/2026): un canal grande, un nombre famoso o parecido, o dos de la Liga con
// el mismo nombre. Aprobar o no lo aplica el ciclo (`bot/videos_propios.py`); acá sale de la lista al tocar
function VideosRevisar({ vs }) {
  const [hecho, setHecho] = useState({});
  const decidir = async (id, si) => {
    setHecho(Object.assign({}, hecho, { [id]: '…' }));
    try {
      const r = await fetch('/api/avisos/dueno/video', { method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, si }) });
      setHecho((h) => Object.assign({}, h, { [id]: r.ok ? (si ? 'aprobado' : 'no') : 'falló' }));
    } catch (e) { setHecho((h) => Object.assign({}, h, { [id]: 'falló' })); }
  };
  return (
    <div><h3>Videos para revisar <small>los que no entraron solos</small></h3>
      <ul>{vs.map(([id, raw, tit, url, motivo, resp]) => (
        <li key={id}>
          <div className="db-l1"><b>{limpio(raw)}</b><span className="db-chip ojo">{motivo}</span></div>
          <a className="db-link" href={url} target="_blank" rel="noopener noreferrer">{tit || url}</a>
          {/* 🎬 lo que contestó (16/10/2026): el link de arriba ya abre en ese minuto */}
          {resp ? <p className="db-tx">Dice que aparece como <b>«{limpio(resp.nombre)}»</b>, en el <b>{resp.minuto}</b>. Cómo reconocerlo: {limpio(resp.como)}</p> : null}
          {hecho[id] && hecho[id] !== 'falló' ? <small>{hecho[id] === '…' ? 'mandando…' : hecho[id] === 'aprobado' ? '✓ aprobado: entra en la próxima corrida' : '✗ no entra'}</small> : (
            <div className="cu-btns">
              <button type="button" className="btn verde chico" onClick={() => decidir(id, true)}>Aprobar</button>
              <button type="button" className="btn borde2 chico" onClick={() => decidir(id, false)}>No</button>
              {hecho[id] === 'falló' ? <small>No se pudo: prueba de nuevo.</small> : null}
            </div>
          )}
        </li>
      ))}</ul>
    </div>
  );
}

// ── 📣 LOS ERRORES REPORTADOS EN LAS LLAVES, CON QUÉ HACER (13/10/2026). Dlx: «me llegaron los reportes pero ¿qué
// acciones puedo hacer acá?», y a la propuesta, «Sí, todas». «Corregir» elige de quién era un nombre de esa llave —quien
// lo reportó, otro de la Lista o alguien que no está— o quién ganó una batalla; vale SÓLO para ese evento, lo aplica el
// ciclo en su próxima corrida (`bot/reportes.py --corregir`) y a quien reportó le llega a su campana. «Listo» y «Era una
// prueba» lo sacan de la lista. Lo que se ve de cada llave sale de `/api/llaves`, como las llaves viejas de la página ──
let LLAVES = null;
const pedirLlaves = () => {
  if (!LLAVES) {
    LLAVES = fetch('/api/llaves', { headers: { accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((t) => (t && t.llaves) || t || {})
      .catch(() => { LLAVES = null; return null; });
  }
  return LLAVES;
};
const ESTADO_REP = {
  corregir: ['⏳ en la próxima corrida', ''], aplicado: ['✅ corregido', 'ok'], no_pude: ['⚠️ no se pudo', 'ojo'],
  listo: ['listo', ''], prueba: ['era una prueba', ''],
};
// 🛡️ (16/11/2026) `staff`: lo corrigió el staff del servidor en su panel; `sugerencia`: lo propuso un asistente (`socioLlave()`)
const QUE_REP = { ganador: 'el ganador', gente: 'falta o sobra alguien', nombre: 'un nombre', otro: 'otra cosa', perfil: 'su perfil',
  staff: 'lo corrigió su servidor', sugerencia: 'una sugerencia de su servidor' };
// 🏷️ QUÉ ES LO REPORTADO, EN PALABRAS Y EN UN SOLO LUGAR (18/11/2026): se armaba a mano en cuatro y sólo la Bandeja
// conocía los cuatro tipos; el Resumen, «Desde tu última visita» y la ficha decían «llave #perfil:makmah» o «una liga»
// por un perfil o una llave en vivo
const etiquetaRep = (r) => {
  const l = String(r.llave);
  return /^\d+$/.test(l) ? 'Llave #' + l : l.startsWith('liga:') ? 'Una liga' : l.startsWith('perfil:') ? 'Un perfil' : 'Una llave en vivo';
};
// las partes de un lado: «Presagio, NC, Agus» son tres
const partes = (x) => String(x || '').split(/\s*[,+&]\s*/).map((s) => s.trim()).filter(Boolean);

async function decidirReporte(cuerpo) {
  const r = await fetch('/api/avisos/dueno/reporte', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : j.error || String(r.status));
  return j.reportes || [];
}

// 🏟️ CORREGIR UNA LIGA DESDE UN REPORTE (14/10/2026, Dlx: «Sí, a Reportes»; con todas las opciones desde el 18/11/2026: «que
// hayan suficientes opciones para cada caso basado en hechos reales»). Hasta ese día sólo se podía decir que un nombre era
// quien lo mandó u otro de la Lista, y el reporte de OG en FMH España —jugó UNA batalla de invitado y el host no le puso el
// 🎮— no tenía ninguna respuesta buena. Ahora hay cinco pestañas, con los mismos cambios que el staff de cada servidor hace
// en su panel (`validarCambioLiga()` de bot/avisos.js): el reporte los guarda en el acto y el ciclo los aplica.
// · Un nombre: quien lo mandó / otro de la Lista (el AKA de ese servidor: liga Y llaves, `reportes.corregir_liga()`) / el
//   mismo que otro nombre de ESTA liga (JAHNOH y JAHNO, ZETRYCO y ZETRYKO) / fue invitado (su rival cobra, él no entra a la tabla).
// · Una batalla: quién la ganó y cómo, uno de los dos fue invitado, o no cuenta y por qué (exhibición, repetida, de otra liga…).
// · Falta una batalla · Un DF (si la liga los suma) · El campeón.
// Alguien nuevo no: una liga no crea gente
export const ligaDe = (liga, llave) => (((liga && liga.d && liga.d.ligas) || {}).ligas || []).find((x) => 'liga:' + x.id === String(llave)) || null;
// las batallas de cada liga con su id, las de la página de la liga (`/api/ligas`, `fechas[].b`: [a, b, ganador, cómo, PTB a,
// PTB b, mensaje, video, invitados]), una vez por Dashboard abierto
let LIGAS_DET = null;
const pedirLigasDet = () => {
  if (!LIGAS_DET) {
    LIGAS_DET = fetch('/api/ligas', { headers: { accept: 'application/json' } })
      .then((x) => { if (!x.ok) throw new Error(x.status); return x.json(); })
      .catch(() => { LIGAS_DET = null; return null; });
  }
  return LIGAS_DET;
};
// por qué no cuenta una batalla (`POR_NO_CUENTA` de bot/avisos.js), cada uno con el caso que lo trajo
const POR_NC = [['exhibicion', 'Fue una exhibición'], ['repetida', 'Está repetida'], ['otra_liga', 'Es de otra liga'],
  ['anulada', 'La anuló su liga'], ['no_se_jugo', 'No se jugó']];
// y por qué se suman o restan puntos sueltos (`POR_PUNTOS`): sin batalla detrás, como el punto de Under en Ceuta
const POR_PTS = [['bono', 'Un bono'], ['penalizacion', 'Una penalización'], ['df', 'Un DF'], ['falta', 'Su tabla lo tiene'], ['otro', 'Otro']];
// la causa del cierre (`CAUSAS_REPORTE`), para el contador del Dashboard: lo que el bot leyó mal o lo que hizo el host
const causaDe = (c) => (c.tipo === 'invitado' || c.tipo === 'campeon' || c.tipo === 'puntos' ? 'organizador'
  : c.tipo === 'nombre' || c.tipo === 'lado' ? 'nombre_bot'
    : c.tipo === 'no_cuenta' ? (['repetida', 'anulada', 'no_se_jugo'].includes(c.por) ? 'organizador' : 'llave_bot') : 'llave_bot');
const hoyEt = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
function CorregirLiga({ r, liga, alListo }) {
  const lid = String(r.llave).slice(5);
  const [det, setDet] = useState(undefined);
  useEffect(() => { let vivo = true; pedirLigasDet().then((x) => { if (vivo) setDet(x || null); }); return () => { vivo = false; }; }, []);
  // la del lobby y, si ya no está ahí (una temporada que terminó), la de `/api/ligas`: el servidor hace falta para el cambio
  const L = ligaDe(liga, r.llave) || (((det && det.lobby && det.lobby.ligas) || []).find((x) => x.id === lid)) || null;
  const sv = L ? L.sv : '';
  const bats = ((((det && det.ligas) || {})[lid] || {}).fechas || []).flatMap((f) => (f.b || []).map((b) => (
    { a: b[0], b: b[1], g: b[2], como: b[3], id: b[6], inv: b[8] || '', dia: f.d || '' }))).filter((b) => b.id);
  const nombres = [];
  const sumar = (x) => { if (x && !nombres.includes(x)) nombres.push(x); };
  if (r.batalla) sumar(r.batalla);
  for (const f of (L && L.tabla) || []) sumar(f[0]);
  for (const u of (L && L.ult) || []) u.slice(0, 2).forEach(sumar);
  for (const b of bats) { sumar(b.a); sumar(b.b); }
  const [modo, setModo] = useState(r.que === 'ganador' ? 'batalla' : 'nombre');
  const [nombre, setNombre] = useState(r.batalla || '');
  // «alguien no es de esta liga» (`gente`) abre con el invitado elegido: es lo que casi siempre es (OG en FMH España)
  const [quien, setQuien] = useState(r.que === 'gente' && r.batalla ? 'invitado' : '');
  const [es, setEs] = useState('');
  const [mismo, setMismo] = useState('');
  const [bat, setBat] = useState('');
  const [acc, setAcc] = useState('');
  const [por, setPor] = useState('exhibicion');
  const [era, setEra] = useState('');
  const [f, setF] = useState({ a: '', b: '', gana: '', como: 'directa', dia: hoyEt(), nombre: '', pts: 3, c: '', pn: '', pp: 1, por: 'bono' });
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  const lista = ((liga && liga.d && liga.d.tabla) || []).map((x) => x.n);
  const b = bats.find((x) => x.id + '|' + x.a + '|' + x.b === bat);
  const campo = (k, ph) => <input type="text" value={f[k]} maxLength={60} placeholder={ph} onChange={(e) => setF(Object.assign({}, f, { [k]: e.target.value }))} />;
  // la corrección como la manda el Dashboard: el «es» de siempre, o un cambio de liga (`accion: 'cambio'`)
  const cambio = () => {
    if (modo === 'nombre') {
      if (!nombre) return null;
      if (quien === 'reporta') return { accion: 'nombre', nombre, reporta: true };
      if (quien === 'es') return es.trim() ? { accion: 'nombre', nombre, es: es.trim() } : null;
      if (quien === 'mismo') return mismo && mismo !== nombre ? { tipo: 'nombre', nombre, es: mismo } : null;
      if (quien === 'invitado') return { tipo: 'invitado', quien: nombre };
      return null;
    }
    if (modo === 'batalla') {
      if (!b || !acc) return null;
      const par = { bat: b.id, a: b.a, b: b.b };
      if (acc === 'nc') return Object.assign({ tipo: 'no_cuenta', por }, par);
      const [k, lado, como] = acc.split(':');
      const n = lado === 'a' ? b.a : b.b;
      if (k === 'l') return era.trim() && era.trim().toLowerCase() !== n.toLowerCase() ? Object.assign({ tipo: 'lado', de: n, es: era.trim() }, par) : null;
      return k === 'i' ? Object.assign({ tipo: 'invitado', quien: n }, par) : Object.assign({ tipo: 'ganador', gana: n, como }, par);
    }
    if (modo === 'falta') return f.a.trim() && f.b.trim() && f.gana ? { tipo: 'cargar', a: f.a.trim(), b: f.b.trim(), gana: f.gana, como: f.como, dia: f.dia } : null;
    if (modo === 'df') return f.nombre.trim() ? { tipo: 'df', nombre: f.nombre.trim(), pts: Number(f.pts), dia: f.dia } : null;
    if (modo === 'puntos') return f.pn.trim() && Number(f.pp) ? { tipo: 'puntos', nombre: f.pn.trim(), pts: Number(f.pp), por: f.por, dia: f.dia } : null;
    return f.c ? { tipo: 'campeon', c: f.c } : null;
  };
  const c = cambio();
  // ⚠️ elegir lo que la liga ya dice no cambia nada: se dice (como en las llaves, «estoy haciendo click a aplicar pero nada»)
  const yaDice = c && c.tipo === 'ganador' && b && b.g === c.gana && b.como === c.como ? 'La liga ya dice que ' + c.gana + ' la ganó así.'
    : c && c.tipo === 'invitado' && b && b.inv.includes(acc.split(':')[1]) ? 'Ya figura como invitado en esa batalla.' : '';
  const aplicar = async () => {
    setOcup(true); setMsg('');
    try {
      const cuerpo = c.accion ? Object.assign({ id: r.id, liga: lid }, c)
        : { id: r.id, accion: 'cambio', liga: lid, sv, cambio: c, causa: causaDe(c) };
      alListo(await decidirReporte(cuerpo));
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  const id = 'repl' + r.id;
  const radio = (k, txt, extra) => (
    <label><input type="radio" name={id} checked={quien === k} onChange={() => setQuien(k)} /> {txt}{extra}</label>);
  const NOTA = {
    reporta: 'Queda como su nombre en ' + (sv || 'ese servidor') + ': en la liga y en las llaves de ese servidor.',
    es: 'Queda como su nombre en ' + (sv || 'ese servidor') + ': en la liga y en las llaves de ese servidor.',
    mismo: 'Sólo en esta liga: los dos nombres pasan a ser una fila de la tabla.',
    invitado: 'Sus batallas en esta liga siguen valiendo para su rival, y él sale de la tabla (como el 🎮 que el host no puso).',
  };
  const formas = [['nombre', 'Un nombre'], ['batalla', 'Una batalla'], ['falta', 'Falta una batalla'], ...(L && L.dfc ? [['df', 'Un DF']] : []),
    ['puntos', 'Puntos sueltos'], ['campeon', 'El campeón']];
  return (
    <div className="db-rep-form">
      <div className="db-opc" role="group" aria-label="Qué corregir">
        {formas.map(([k, t]) => <button key={k} type="button" className={modo === k ? 'on' : ''} onClick={() => { setModo(k); setMsg(''); }}>{t}</button>)}
      </div>
      {modo === 'nombre' ? <>
        <span className="db-rep-p">¿Qué nombre de {L ? L.n : 'la liga'} está mal?</span>
        <div className="db-opc">{nombres.map((x) => <button key={x} type="button" className={nombre === x ? 'on' : ''} onClick={() => setNombre(x)}>{x}</button>)}</div>
        {nombre ? <>
          <span className="db-rep-p">«{nombre}» es…</span>
          <div className="db-rep-q">
            {radio('reporta', 'quien lo mandó', r.evid && r.evid.quien ? ' (' + r.evid.quien + ')' : r.de ? ' (' + r.de + ')' : '')}
            <label><input type="radio" name={id} checked={quien === 'es'} onChange={() => setQuien('es')} /> otro de la Lista:
              <input type="text" list={id + 'l'} value={es} placeholder="su nombre" onFocus={() => setQuien('es')} onChange={(e) => setEs(e.target.value)} maxLength={60} /></label>
            <datalist id={id + 'l'}>{lista.map((x) => <option key={x} value={x} />)}</datalist>
            <label><input type="radio" name={id} checked={quien === 'mismo'} onChange={() => setQuien('mismo')} /> el mismo que otro de esta liga:
              <select className="db-sel" value={mismo} onFocus={() => setQuien('mismo')} onChange={(e) => { setMismo(e.target.value); setQuien('mismo'); }}>
                <option value="">Elige</option>{nombres.filter((x) => x !== nombre).map((x) => <option key={x} value={x}>{x}</option>)}
              </select></label>
            {radio('invitado', 'un invitado: no es de esta liga', '')}
          </div>
          {quien ? <p className="db-rep-nota">{NOTA[quien]}</p> : null}
        </> : null}
      </> : modo === 'batalla' ? <>
        <span className="db-rep-p">¿Qué batalla de {L ? L.n : 'la liga'}?</span>
        {det === undefined ? <p className="db-rep-nota">Trayendo las batallas…</p> : !bats.length ? <p className="db-rep-nota">No encuentro las batallas de esta liga en la página.</p>
          : <select className="db-sel" value={bat} onChange={(e) => { setBat(e.target.value); setAcc(''); }}>
            <option value="">Elige la batalla</option>
            {bats.map((x) => <option key={x.id + '|' + x.a + '|' + x.b} value={x.id + '|' + x.a + '|' + x.b}>{x.a} vs {x.b}{x.dia ? ' · ' + x.dia : ''} (dice: {x.g ? x.g + (x.como === 'replica' ? ', réplica' : ', directo') : 'sin resultado'}{x.inv ? ' · 🎮' : ''})</option>)}
          </select>}
        {b ? <>
          <span className="db-rep-p">¿Qué pasó?</span>
          <div className="db-opc">
            {[['a', b.a], ['b', b.b]].map(([l, n]) => ['directa', 'replica'].map((como) => (
              <button key={l + como} type="button" className={acc === 'g:' + l + ':' + como ? 'on' : ''} onClick={() => setAcc('g:' + l + ':' + como)}>Ganó {n} · {como === 'replica' ? 'réplica' : 'directo'}</button>)))}
          </div>
          <div className="db-opc">
            {[['a', b.a], ['b', b.b]].map(([l, n]) => (
              <button key={'i' + l} type="button" className={acc === 'i:' + l ? 'on' : ''} onClick={() => setAcc('i:' + l)}>{n} fue invitado</button>))}
            <button type="button" className={acc === 'nc' ? 'on' : ''} onClick={() => setAcc('nc')}>No cuenta</button>
          </div>
          <div className="db-opc">
            {[['a', b.a], ['b', b.b]].map(([l, n]) => (
              <button key={'l' + l} type="button" className={acc === 'l:' + l ? 'on' : ''} onClick={() => setAcc('l:' + l)}>«{n}» era otro</button>))}
          </div>
          {acc === 'nc' ? <div className="db-opc" role="group" aria-label="Por qué no cuenta">
            {POR_NC.map(([k, t]) => <button key={k} type="button" className={por === k ? 'on' : ''} onClick={() => setPor(k)}>{t}</button>)}
          </div> : null}
          {acc.startsWith('l:') ? <div className="db-rep-q"><label>Era: <input type="text" list={id + 'n'} value={era} maxLength={60} placeholder="como se llama en la liga"
            onChange={(e) => setEra(e.target.value)} /></label><datalist id={id + 'n'}>{nombres.map((x) => <option key={x} value={x} />)}</datalist></div> : null}
          <p className="db-rep-nota">{acc === 'nc' ? 'Sale de la tabla para los dos.' : acc.startsWith('i:') ? 'La batalla sigue valiendo para su rival, y el invitado no entra a la tabla.'
            : acc.startsWith('l:') ? 'Sólo en esta batalla, también si la ganó: el resto de la liga no cambia.' : 'Cambia el resultado de esa batalla, y la tabla con él.'}</p>
        </> : null}
      </> : modo === 'falta' ? <>
        <span className="db-rep-p">La batalla que el bot no leyó</span>
        <div className="db-rep-q">
          <label>Uno: {campo('a', 'como lo escriben en la liga')}</label>
          <label>El otro: {campo('b', 'como lo escriben en la liga')}</label>
          <label>Ganó: <select className="db-sel" value={f.gana} onChange={(e) => setF(Object.assign({}, f, { gana: e.target.value }))}>
            <option value="">Elige</option>{[f.a.trim(), f.b.trim()].filter(Boolean).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Cómo: <select className="db-sel" value={f.como} onChange={(e) => setF(Object.assign({}, f, { como: e.target.value }))}>
            <option value="directa">Directo</option><option value="replica">En réplica</option></select></label>
          <label>Día: <input type="date" value={f.dia} onChange={(e) => setF(Object.assign({}, f, { dia: e.target.value }))} /></label>
        </div>
      </> : modo === 'df' ? <>
        <span className="db-rep-p">Un DF ({L ? L.n : 'la liga'} los suma)</span>
        <div className="db-rep-q">
          <label>Quién: {campo('nombre', 'como lo escriben en la liga')}</label>
          <label>Qué pasó: <select className="db-sel" value={f.pts} onChange={(e) => setF(Object.assign({}, f, { pts: Number(e.target.value) }))}>
            <option value={3}>Ganó por DF: 3 puntos</option><option value={1}>No vino nadie: 1 punto</option></select></label>
          <label>Día: <input type="date" value={f.dia} onChange={(e) => setF(Object.assign({}, f, { dia: e.target.value }))} /></label>
        </div>
      </> : modo === 'puntos' ? <>
        <span className="db-rep-p">Puntos que su tabla suma o resta sin una batalla</span>
        <div className="db-rep-q">
          <label>Quién: <input type="text" list={id + 'n'} value={f.pn} maxLength={60} placeholder="como se llama en la liga"
            onChange={(e) => setF(Object.assign({}, f, { pn: e.target.value }))} /></label>
          <datalist id={id + 'n'}>{nombres.map((x) => <option key={x} value={x} />)}</datalist>
          <label>Puntos: <select className="db-sel" value={f.pp} onChange={(e) => setF(Object.assign({}, f, { pp: Number(e.target.value) }))}>
            {[9, 6, 5, 4, 3, 2, 1, -1, -2, -3, -4, -5, -6, -9].map((n) => <option key={n} value={n}>{n > 0 ? '+' + n : n}</option>)}</select></label>
          <label>Día: <input type="date" value={f.dia} onChange={(e) => setF(Object.assign({}, f, { dia: e.target.value }))} /></label>
        </div>
        <div className="db-opc" role="group" aria-label="Por qué">
          {POR_PTS.map(([k, t]) => <button key={k} type="button" className={f.por === k ? 'on' : ''} onClick={() => setF(Object.assign({}, f, { por: k }))}>{t}</button>)}
        </div>
        <p className="db-rep-nota">Sólo puntos: no suma jugadas ni ganadas.</p>
      </> : <>
        <span className="db-rep-p">¿Quién ganó la temporada?</span>
        <select className="db-sel" value={f.c} onChange={(e) => setF(Object.assign({}, f, { c: e.target.value }))}>
          <option value="">Elige</option>{((L && L.tabla) || []).map((x) => <option key={x[0]} value={x[0]}>{x[0]}</option>)}</select>
        <p className="db-rep-nota">Cierra la temporada que se juega, como si lo anunciara su servidor.</p>
      </>}
      <p className="db-rep-nota">{c && !c.accion ? 'Queda en los cambios de ' + (L ? L.n : 'la liga') + ', que el staff de ' + (sv || 'su servidor') + ' ve en su panel y puede deshacer. ' : ''}Lo aplica el ciclo en su próxima corrida y a quien lo mandó le llega a la campana.</p>
      {yaDice ? <p className="db-rep-ya">{yaDice}</p> : null}
      <div className="cu-btns">
        <button type="button" className="btn verde chico" disabled={!c || !!yaDice || ocup} onClick={aplicar}>{ocup ? 'Guardando…' : 'Aplicar'}</button>
        {!c ? <small>{modo === 'nombre' ? (!nombre ? 'Elige el nombre.' : 'Elige quién es.') : modo === 'batalla' ? (!b ? 'Elige la batalla.' : 'Elige qué pasó.') : 'Completa lo que falta.'}</small> : null}
        {msg ? <small role="status">{msg}</small> : null}
      </div>
    </div>
  );
}

// el formulario de «Corregir»: un nombre o el ganador, con lo que la llave de verdad trae
function Corregir({ r, liga, alListo, hermanos }) {
  const [L, setL] = useState(undefined);
  const [modo, setModo] = useState(r.que === 'ganador' ? 'ganador' : 'nombre');
  // 🏷️ el nombre que eligió quien lo reportó (`batalla`, desde el 12/11/2026) viene puesto
  const [nombre, setNombre] = useState(r.que === 'nombre' && r.batalla ? r.batalla : '');
  const [quien, setQuien] = useState('reporta');
  const [conHermanos, setConHermanos] = useState(true);
  const [es, setEs] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [bat, setBat] = useState('');
  const [gana, setGana] = useState('');
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  useEffect(() => { let vivo = true; pedirLlaves().then((t) => { if (vivo) setL((t && t[r.llave]) || null); }); return () => { vivo = false; }; }, [r.llave]);
  if (L === undefined) return <p className="db-rep-nota">Trayendo la llave…</p>;
  if (!L) return <p className="db-rep-nota">No encuentro la llave #{r.llave} en la página: no se puede corregir desde acá.</p>;
  // los nombres de la llave, una vez: la tabla y cada parte de cada lado
  const nombres = [];
  for (const f of L.tabla || []) if (f[0] && !nombres.includes(f[0])) nombres.push(f[0]);
  for (const ro of L.rondas || []) for (const b of ro.b || []) for (const lado of b[0] || []) for (const p of partes(lado)) if (!nombres.includes(p)) nombres.push(p);
  const batallas = [];
  (L.rondas || []).forEach((ro, i) => (ro.b || []).forEach((b, j) => { if ((b[0] || []).length >= 2) batallas.push({ k: i + ':' + j, ronda: ro.r, lados: b[0], ganador: b[1] }); }));
  const b = batallas.find((x) => x.k === bat);
  const lista = ((liga && liga.d && liga.d.tabla) || []).map((x) => x.n);
  const listo = modo === 'nombre' ? !!nombre && (quien === 'reporta' || (quien === 'es' ? !!es.trim() : !!nuevo.trim()))
    : !!b && !!gana && gana !== b.ganador;
  // ⚠️ ELEGIR LO QUE LA LLAVE YA DICE NO CAMBIA NADA, y el botón apagado no lo decía (Dlx, con el de Zetryko: «estoy
  // haciendo click a aplicar pero nada»): se dice, y se ofrece cerrarlo
  const yaDice = modo === 'ganador' && !!b && !!gana && gana === b.ganador;
  const falta = modo === 'nombre' ? (!nombre ? 'Elige el nombre que está mal.' : !listo ? 'Elige de quién era.' : '')
    : (!b ? 'Elige la batalla.' : !gana ? 'Elige quién la ganó.' : '');
  // 👥 con «quien lo mandó», sólo los reportes hermanos que mandó LA MISMA persona (18/11/2026): `reporta` el ciclo lo
  // resuelve con el autor de cada reporte, así que el de otra persona le daba el nombre (y sus puntos) a ella. Sin
  // `de` ni `evid.quien` no se sabe de quién es y queda afuera: se corrige aparte
  const mismo = (h) => (!!h.de && h.de === r.de) || (!!(h.evid && h.evid.quien) && !!(r.evid && r.evid.quien) && h.evid.quien === r.evid.quien);
  const herm = modo === 'nombre' && quien === 'reporta' ? hermanos.filter(mismo) : hermanos;
  const aplicar = async () => {
    setOcup(true); setMsg('');
    try {
      const c = modo === 'nombre'
        ? Object.assign({ accion: 'nombre', n: r.llave, nombre }, quien === 'reporta' ? { reporta: true } : quien === 'es' ? { es: es.trim() } : { nuevo: nuevo.trim() })
        : { accion: 'ganador', n: r.llave, ronda: b.ronda, lados: b.lados, ganador: gana };
      // 🧩 y lo mismo para los otros reportes abiertos de esta llave, si se marcó (Dlx: «hazlo sencillo de solucionar
      // múltiples problemas»): el ciclo los da por corregidos con la misma regla
      let l = await decidirReporte(Object.assign({ id: r.id }, c));
      for (const h of (conHermanos ? herm : [])) l = await decidirReporte(Object.assign({ id: h.id }, c));
      alListo(l);
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  const cerrarListo = async () => {
    setOcup(true);
    try { alListo(await decidirReporte({ id: r.id, accion: 'listo' })); } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  const id = 'rep' + r.id;
  return (
    <div className="db-rep-form">
      <div className="db-opc" role="group" aria-label="Qué corregir">
        <button type="button" className={modo === 'nombre' ? 'on' : ''} onClick={() => setModo('nombre')}>Un nombre</button>
        <button type="button" className={modo === 'ganador' ? 'on' : ''} onClick={() => setModo('ganador')}>El ganador</button>
      </div>
      {modo === 'nombre' ? <>
        <span className="db-rep-p">¿Qué nombre está mal en la #{r.llave}?</span>
        <div className="db-opc">{nombres.map((x) => <button key={x} type="button" className={nombre === x ? 'on' : ''} onClick={() => setNombre(x)}>{x}</button>)}</div>
        {nombre ? <>
          <span className="db-rep-p">«{nombre}» era…</span>
          <div className="db-rep-q">
            {/* quien lo mandó, siempre: el ciclo sabe su cuenta aunque no tenga perfil en la página */}
            <label><input type="radio" name={id} checked={quien === 'reporta'} onChange={() => setQuien('reporta')} /> quien lo mandó{r.evid && r.evid.quien ? ' (' + r.evid.quien + ')' : r.de ? ' (' + r.de + ')' : ''}</label>
            <label><input type="radio" name={id} checked={quien === 'es'} onChange={() => setQuien('es')} /> otro de la Lista:
              <input type="text" list={id + 'l'} value={es} placeholder="su nombre" onFocus={() => setQuien('es')} onChange={(e) => setEs(e.target.value)} maxLength={60} /></label>
            <label><input type="radio" name={id} checked={quien === 'nuevo'} onChange={() => setQuien('nuevo')} /> alguien que no está en la Lista:
              <input type="text" value={nuevo} placeholder="Agustin 🇺🇾" onFocus={() => setQuien('nuevo')} onChange={(e) => setNuevo(e.target.value)} maxLength={40} /></label>
            <datalist id={id + 'l'}>{lista.map((x) => <option key={x} value={x} />)}</datalist>
          </div>
        </> : null}
      </> : <>
        <span className="db-rep-p">¿Qué batalla de la #{r.llave}?</span>
        <select className="db-sel" value={bat} onChange={(e) => { setBat(e.target.value); setGana(''); }}>
          <option value="">Elige la batalla</option>
          {batallas.map((x) => <option key={x.k} value={x.k}>{x.ronda} · {x.lados.join(' vs ')} (dice: {x.ganador || '—'})</option>)}
        </select>
        {b ? <>
          <span className="db-rep-p">¿Quién la ganó?</span>
          <div className="db-opc">{b.lados.map((x) => <button key={x} type="button" className={gana === x ? 'on' : ''} onClick={() => setGana(x)}>{x}{x === b.ganador ? ' (lo que dice hoy)' : ''}</button>)}</div>
        </> : null}
      </>}
      {yaDice ? <p className="db-rep-ya">La llave ya dice que ganó {gana}: no hay nada que corregir. Si el reporte pedía eso, ciérralo con «Listo».</p>
        : <p className="db-rep-nota">Cambia sólo en la #{r.llave}. Lo aplica el ciclo en su próxima corrida y a quien lo reportó le llega a la campana.</p>}
      {herm.length && !yaDice ? <label className="db-rep-herm"><input type="checkbox" checked={conHermanos} onChange={(e) => setConHermanos(e.target.checked)} />
        {' '}lo mismo para {herm.length === 1 ? 'el otro reporte' : 'los otros ' + herm.length + ' reportes'} de la #{r.llave}</label> : null}
      <div className="cu-btns">
        {yaDice ? <button type="button" className="btn verde chico" disabled={ocup} onClick={cerrarListo}>Listo</button>
          : <button type="button" className="btn verde chico" disabled={!listo || ocup} onClick={aplicar}>{ocup ? 'Guardando…' : 'Aplicar'}</button>}
        {!yaDice && falta ? <small>{falta}</small> : null}
        {msg ? <small role="status">{msg}</small> : null}
      </div>
    </div>
  );
}

// 🔎 LO QUE ENCONTRÓ EL BOT de un reporte (13/10/2026, Dlx: «para cada cosa necesitaremos evidencia… que el bot nos dé
// evidencia»): una línea por prueba —las inscripciones con la cuenta que las escribió, la llamada, lo ya decidido— y,
// si todo apunta a una persona, la corrección sugerida para aplicar con un toque. Es una pista: decide Dlx
function Evidencia({ r, alListo, corrige }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const s = r.evid.sugerencia;
  const abierto = r.estado === '' || r.estado === 'no_pude';
  const aplicar = async () => {
    setOcup(true); setMsg('');
    try {
      alListo(await decidirReporte(Object.assign({ id: r.id, accion: 'nombre', n: r.llave, nombre: s.nombre },
        s.reporta ? { reporta: true } : { es: s.es })));
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  return (
    <div className="db-evid">
      <span className="db-rep-p">🔎 Lo que encontró el bot</span>
      <ul>{r.evid.lineas.slice(1).map(([ic, t]) => <li key={t}><span aria-hidden="true">{ic}</span>{t}</li>)}</ul>
      {s && abierto && corrige && /^\d+$/.test(r.llave) ? (
        <div className="cu-btns">
          <button type="button" className="btn verde chico" disabled={ocup} onClick={aplicar}>
            {ocup ? 'Guardando…' : 'Aplicar lo sugerido: «' + s.nombre + '» era ' + (s.reporta ? 'quien lo mandó' : s.es_txt || s.es)}</button>
          {msg ? <small role="status">{msg}</small> : null}
        </div>) : null}
    </div>
  );
}

// 🔎 LOS FILTROS DE REPORTES Y DECISIONES (Dlx, 13/10/2026: «¿puedes agregar filtros acá? tanto en reportes para ir por
// servidores, decisiones, nivel de importancia, etc.»). Botones por grupo con cuántos hay de cada uno; un grupo con una
// sola opción no se dibuja. Lo elegido queda en este navegador (`lg:db-f-<pestaña>`): al volver sigue igual
const IMP = [['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']];
const IMP_DICE = 'Alta: los puntos de un evento entero · Media: una batalla o un nombre · Baja: quién es quién y el Most Wanted';
function useFiltro(k) {
  const [f, setF0] = useState(() => { try { return JSON.parse(localStorage.getItem('lg:db-f-' + k) || '{}') || {}; } catch (e) { return {}; } });
  const poner = (n) => { setF0(n); try { localStorage.setItem('lg:db-f-' + k, JSON.stringify(n)); } catch (e) { /* sin guardar */ } };
  return [f, (g, v) => { const n = Object.assign({}, f); if (v) n[g] = v; else delete n[g]; poner(n); }, () => poner({})];
}
//: `[[valor, etiqueta, cuántos]]` de un campo, en el orden de `fijo` (si se da) o de más a menos
function opciones(xs, fn, fijo, etiqueta) {
  const m = new Map();
  for (const x of xs) { const v = fn(x); if (v) m.set(v, (m.get(v) || 0) + 1); }
  const ks = fijo ? fijo.map((y) => y[0]).filter((v) => m.has(v)) : [...m.keys()].sort((a, b) => m.get(b) - m.get(a));
  return ks.map((v) => [v, (fijo && (fijo.find((y) => y[0] === v) || [])[1]) || (etiqueta ? etiqueta(v) : v), m.get(v)]);
}
function Filtros({ grupos, f, setF, limpiar, n, total, nota }) {
  // ⚠️ lo elegido se muestra aunque hoy no haya ninguno, así se puede sacar
  const vis = grupos.map(([g, t, ops]) => [g, t, f[g] && !ops.some((o) => o[0] === f[g]) ? ops.concat([[f[g], f[g], 0]]) : ops])
    .filter(([, , ops]) => ops.length > 1);
  if (!vis.length) return null;
  return (
    <div className="db-filtros" role="group" aria-label="Filtros">
      {vis.map(([g, t, ops]) => (
        <div key={g} className="db-filtro"><span>{t}</span>
          <button type="button" className={'db-fch' + (!f[g] ? ' on' : '')} aria-pressed={!f[g]} onClick={() => setF(g, '')}>Todos</button>
          {ops.map(([v, e, c]) => (
            <button key={v} type="button" className={'db-fch' + (f[g] === v ? ' on' : '')} aria-pressed={f[g] === v}
              onClick={() => setF(g, f[g] === v ? '' : v)}>{e} <small>{c}</small></button>))}
        </div>))}
      {nota ? <p className="db-filtro-n">{nota}</p> : null}
      {Object.keys(f).length ? <p className="db-filtro-n">Mostrando {n} de {total} · <button type="button" className="evp-lnk" onClick={limpiar}>sacar los filtros</button></p> : null}
    </div>
  );
}
// 🔎 BUSCAR POR NOMBRE (Dlx, 13/10/2026, de las ideas del Dashboard): sin tildes ni banderas, en todo lo que se ve de
// cada uno (la pregunta, las pistas, las opciones, el evento; en Reportes, la llave, el texto y quién lo mandó)
const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/\s+/g, ' ').trim();
const contiene = (campos, q) => !q || plano(campos.join(' \n ')).includes(plano(q));
function Buscar({ q, setQ, que }) {
  return (
    <label className="db-buscar"><Ico n="buscar" t={16} />
      <input type="search" value={q} placeholder={'Buscar ' + que} aria-label={'Buscar ' + que} onChange={(e) => setQ(e.target.value)} />
    </label>
  );
}

//: el servidor de una pregunta, de su título («COPA · FFA · 12/10 · #380»): la parte que es una sigla de la Liga
const svDeSec = (sec, liga) => {
  const ps = String(sec || '').split(' · ');
  return ps.find((x) => liga && liga.svs && liga.svs[x]) || ps.slice(1).find((x) => /^[A-Z]{2,5}$/.test(x)) || '';
};
const estadoRep = (r) => (r.estado === '' || r.estado === 'no_pude' ? 'abierto' : r.estado === 'corregir' ? 'en_curso' : 'cerrado');
const impRep = (r) => (r.que === 'ganador' ? 'alta' : r.que === 'nombre' || r.que === 'gente' ? 'media' : 'baja');

function Reportes({ rep, liga, alCambiar, corrige = true }) {
  const [lista, setLista0] = useState(rep);
  useEffect(() => { setLista0(rep); }, [rep]);
  // y el número de la pestaña, al día (ver `alCambiar` en el Dashboard)
  const setLista = (l) => { setLista0(l); if (alCambiar) alCambiar(l); };
  const [abierto, setAbierto] = useState(null);
  const [msg, setMsg] = useState({});
  const cerrar = async (r, accion) => {
    setMsg((m) => Object.assign({}, m, { [r.id]: '…' }));
    try { setLista(await decidirReporte({ id: r.id, accion })); setMsg((m) => Object.assign({}, m, { [r.id]: '' })); } catch (e) { setMsg((m) => Object.assign({}, m, { [r.id]: 'No se pudo: ' + e.message })); }
  };
  const [f, setF, limpiar] = useFiltro('rep');
  const [q, setQ] = useState('');
  if (!lista.length) return null;
  const pasa = (r) => (!f.sv || (r.evid && r.evid.sv) === f.sv) && (!f.estado || estadoRep(r) === f.estado)
    && (!f.que || r.que === f.que) && (!f.imp || impRep(r) === f.imp)
    && contiene(['#' + r.llave, r.texto, r.batalla, r.de, r.evid && r.evid.quien, ...((r.evid && r.evid.lineas) || []).map((l) => l[1])], q);
  const vista = lista.filter(pasa);
  // 🧩 todo lo que el bot ya sabe cómo corregir, de una (Dlx: «hazlo sencillo de solucionar múltiples problemas»): de
  // lo que se está mostrando, así se puede aplicar por servidor
  const sugeridos = vista.filter((x) => (x.estado === '' || x.estado === 'no_pude') && x.evid && x.evid.sugerencia && /^\d+$/.test(x.llave));
  const todos = async () => {
    setMsg((m) => Object.assign({}, m, { todos: '…' }));
    try {
      let l = lista;
      for (const x of sugeridos) {
        const s = x.evid.sugerencia;
        l = await decidirReporte(Object.assign({ id: x.id, accion: 'nombre', n: x.llave, nombre: s.nombre }, s.reporta ? { reporta: true } : { es: s.es }));
      }
      setLista(l); setMsg((m) => Object.assign({}, m, { todos: '' }));
    } catch (e) { setMsg((m) => Object.assign({}, m, { todos: 'No se pudo: ' + e.message })); }
  };
  return (
    <div><h3>Reportes de la gente <small>errores en las llaves y en los perfiles</small></h3>
      <Buscar q={q} setQ={setQ} que="un nombre o una llave" />
      <Filtros f={f} setF={setF} limpiar={limpiar} n={vista.length} total={lista.length} grupos={[
        ['sv', 'Servidor', opciones(lista, (r) => r.evid && r.evid.sv)],
        ['estado', 'Estado', opciones(lista, estadoRep, [['abierto', 'Sin mirar'], ['en_curso', 'Corrigiéndose'], ['cerrado', 'Cerrados']])],
        ['que', 'Qué', opciones(lista, (r) => r.que, null, (v) => QUE_REP[v] || v)],
        ['imp', 'Importancia', opciones(lista, impRep, IMP)],
      ]} />
      {corrige && sugeridos.length >= 2 ? <div className="cu-btns">
        <button type="button" className="btn verde chico" disabled={msg.todos === '…'} onClick={todos}>Aplicar todo lo sugerido ({sugeridos.length})</button>
        {msg.todos && msg.todos !== '…' ? <small role="status">{msg.todos}</small> : null}
      </div> : null}
      {!vista.length ? <p className="pronto-p">Ninguno con estos filtros.</p> : null}
      <ul>{vista.map((r) => {
        const est = ESTADO_REP[r.estado];
        const abiertoA = r.estado === '' || r.estado === 'no_pude';
        return (
          <li key={r.id}>
            <div className="db-l1"><b>{/^\d+$/.test(r.llave) ? <a href={'#/llave/' + r.llave}>Llave #{r.llave}</a>
              : String(r.llave).startsWith('liga:') ? <a href={'#/ligas/' + encodeURIComponent(String(r.llave).slice(5))}>Liga {(ligaDe(liga, r.llave) || {}).n || String(r.llave).slice(5)}</a>
                // 🚩 reportar usuario (21/10/2026): `perfil:<clave>`
                : String(r.llave).startsWith('perfil:') ? <a href={'#/r/' + encodeURIComponent(String(r.llave).slice(7))}>Perfil de {limpio(((liga.T || {})[String(r.llave).slice(7)] || {}).n || String(r.llave).slice(7))}</a> : 'Llave en vivo'}</b>
              <span className="db-chip">{QUE_REP[r.que] || r.que}</span>{est ? <span className={'db-chip ' + est[1]}>{est[0]}</span> : null}</div>
            {/* 👤 quién lo mandó: el nombre de la Lista que pone el ciclo (`evid.quien`), aunque no tenga perfil en la página
                (Dlx, 13/10/2026: «¿pero quién lo dice?») */}
            <small>{hace(r.t)}{r.batalla ? ' · ' + r.batalla : ''}{r.evid && r.evid.quien ? <> · lo mandó {r.de ? <a href={'#/r/' + r.de}>{r.evid.quien}</a> : r.evid.quien}</>
              : r.de ? <> · lo mandó <a href={'#/r/' + r.de}>{r.de}</a></> : <> · quién lo mandó: lo dice el ciclo en su próxima corrida</>}</small>
            {r.texto ? <p>{r.texto}</p> : null}
            {r.evid && (r.evid.lineas || []).length > 1 ? <Evidencia r={r} alListo={setLista} corrige={corrige} /> : null}
            {r.estado === 'corregir' && r.fix ? <small>{r.fix.tipo === 'ganador' ? 'Ganó ' + r.fix.ganador + ' (' + r.fix.ronda + ')'
              : '«' + r.fix.nombre + '» era ' + (r.fix.reporta ? 'quien lo reportó' : r.fix.es || r.fix.nuevo)}</small> : null}
            {r.resultado ? <small>{r.resultado}</small> : null}
            {/* 🔐 quién lo decidió, si no fue Dlx (los permisos, 13/10/2026) */}
            {r.por && r.por !== 'Dlx' && r.estado ? <small>Lo decidió {r.por}.</small> : null}
            {abiertoA || r.estado === 'corregir' ? (
              abierto === r.id ? (String(r.llave).startsWith('liga:') ? <CorregirLiga r={r} liga={liga} alListo={(l) => { setLista(l); setAbierto(null); }} />
                : <Corregir r={r} liga={liga} alListo={(l) => { setLista(l); setAbierto(null); }}
                  hermanos={lista.filter((x) => x.id !== r.id && x.llave === r.llave && (x.estado === '' || x.estado === 'no_pude'))} />) : (
                <div className="cu-btns">
                  {corrige && (/^\d+$/.test(r.llave) || String(r.llave).startsWith('liga:')) ? <button type="button" className="btn verde chico" onClick={() => setAbierto(r.id)}>{r.estado === 'corregir' ? 'Cambiar la corrección' : 'Corregir'}</button> : null}
                  {/* 💬 un perfil reportado: su frase se puede quitar desde acá (la tanda 2 del perfil, 27/10/2026) */}
                  {String(r.llave).startsWith('perfil:') ? <QuitarFrase k={String(r.llave).slice(7)} /> : null}
                  <button type="button" className="btn borde2 chico" disabled={msg[r.id] === '…'} onClick={() => cerrar(r, 'listo')}>Listo</button>
                  <button type="button" className="btn borde2 chico" disabled={msg[r.id] === '…'} onClick={() => cerrar(r, 'prueba')}>Era una prueba</button>
                  {msg[r.id] && msg[r.id] !== '…' ? <small role="status">{msg[r.id]}</small> : null}
                </div>)
            ) : null}
          </li>
        );
      })}</ul>
    </div>
  );
}

// 💬 QUITAR LA FRASE DE UN PERFIL REPORTADO (la tanda 2 del perfil, 27/10/2026). La frase la escribe cada uno en su perfil;
// esto la borra (`duenoFrase()` en avisos.js) y queda en el historial con quién lo hizo. Después la puede volver a escribir
function QuitarFrase({ k }) {
  const [est, setEst] = useState('');
  const quitar = async () => {
    setEst('…');
    try {
      const r = await fetch('/api/avisos/dueno/frase', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ k }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || String(r.status));
      setEst(j.quitadas ? 'Frase quitada' : 'No tenía frase');
      window.dispatchEvent(new CustomEvent('lg:perfil-extra', { detail: k }));
    } catch (e) { setEst('No se pudo: ' + e.message); }
  };
  return est && est !== '…' ? <small role="status">{est}</small>
    : <button type="button" className="btn borde2 chico" disabled={est === '…'} onClick={quitar}>Quitar su frase</button>;
}

// 🖼️ LOS FONDOS PARA REVISAR (13/10/2026): la imagen que alguien subió como fondo no se ve hasta que la aprobás (hay
// menores en la Liga). Lo que no se aprueba le llega a su campana con el motivo. Ver `duenoFondo()` en avisos.js
const MOTIVOS_FONDO = ['No es apropiada para la Liga', 'Es de otra persona', 'Tiene datos personales', 'No se ve bien'];
function FondosRevisar({ fs, alCambiar, filtro, alFiltro, fcs = [], alFotos }) {
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  const [motivo, setMotivo] = useState({});
  const decidir = async (f, si) => {
    setOcup(f.quien); setMsg('');
    try {
      // 📸 una foto de tarjeta va por su ruta (13/10/2026)
      const r = await fetch(f.tipo === 'foto' ? '/api/avisos/dueno/foto-carta' : '/api/avisos/dueno/fondo', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quien: f.quien, si, motivo: si ? '' : motivo[f.quien] || MOTIVOS_FONDO[0] }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || String(r.status));
      if (j.fondos) alCambiar(j.fondos);
      if (j.fotos_carta && alFotos) alFotos(j.fotos_carta);
      if (j.filtro && alFiltro) alFiltro(j.filtro);
    } catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup('');
  };
  const fl = filtro || {}, c = fl.cuenta || {}, vivos = fl.vivos || [];
  return (
    <div>{fs.length ? <h3>Fondos para revisar <small>el filtro automático no estuvo seguro: no se ven hasta que los apruebas</small></h3> : null}
      <ul>{fs.map((f) => (
        <li key={f.quien}>
          <div className="db-l1"><b>{f.k ? <a href={'#/r/' + f.k}>{f.k}</a> : 'una cuenta'}</b><small>{hace(f.t)}</small></div>
          <div className="db-fondo" style={{ backgroundImage: urlFondo(f.pend) || 'none' }} role="img" aria-label="El fondo que subió" />
          <div className="cu-btns">
            <button type="button" className="btn verde chico" disabled={ocup === f.quien} onClick={() => decidir(f, true)}>Aprobar</button>
            <select className="db-sel db-sel-corto" value={motivo[f.quien] || MOTIVOS_FONDO[0]} onChange={(e) => setMotivo(Object.assign({}, motivo, { [f.quien]: e.target.value }))}>
              {MOTIVOS_FONDO.map((m) => <option key={m}>{m}</option>)}</select>
            <button type="button" className="btn borde2 chico" disabled={ocup === f.quien} onClick={() => decidir(f, false)}>No</button>
          </div>
        </li>
      ))}</ul>
      {/* 📸 las fotos de tarjeta que el filtro no supo decidir (13/10/2026) */}
      {fcs.length ? <h3>Fotos de tarjeta para revisar <small>el filtro automático no estuvo seguro: no salen hasta que las apruebas</small></h3> : null}
      <ul>{fcs.map((f) => (
        <li key={'p' + f.quien}>
          <div className="db-l1"><b>{f.k ? <a href={'#/r/' + f.k}>{f.k}</a> : 'una cuenta'}</b><small>{hace(f.t)} · para {(f.cartas || []).join(', ')}</small></div>
          <div className="db-foto" style={{ backgroundImage: urlFoto(f.pend) || 'none' }} role="img" aria-label="La foto que subió" />
          <div className="cu-btns">
            <button type="button" className="btn verde chico" disabled={ocup === f.quien} onClick={() => decidir(Object.assign({ tipo: 'foto' }, f), true)}>Aprobar</button>
            <select className="db-sel db-sel-corto" value={motivo[f.quien] || MOTIVOS_FONDO[0]} onChange={(e) => setMotivo(Object.assign({}, motivo, { [f.quien]: e.target.value }))}>
              {MOTIVOS_FONDO.map((m) => <option key={m}>{m}</option>)}</select>
            <button type="button" className="btn borde2 chico" disabled={ocup === f.quien} onClick={() => decidir(Object.assign({ tipo: 'foto' }, f), false)}>No</button>
          </div>
        </li>
      ))}</ul>
      {/* 🛡️ lo que el filtro dejó ver estos días: si algo se le escapó, se quita acá (13/10/2026) */}
      {vivos.length ? <>
        <h3>Ya se ven <small>los aprobó el filtro automático · en 3 días: {[[c.ok, 'aprobado'], [c.no, 'frenado']].map(([n, t]) => (n || 0) + ' ' + t + ((n || 0) === 1 ? '' : 's')).join(', ')} y {c.revisar || 0} a revisar</small></h3>
        <ul>{vivos.map((f) => (
          <li key={'v' + (f.tipo || 'fondo') + f.quien}>
            <div className="db-l1"><b>{f.k ? <a href={'#/r/' + f.k}>{f.k}</a> : 'una cuenta'}</b><small>{hace(f.t)}{f.tipo === 'foto' ? ' · foto de tarjeta: ' + (f.cartas || []).join(', ') : ' · fondo'}</small></div>
            {f.tipo === 'foto' ? <div className="db-foto" style={{ backgroundImage: urlFoto(f.url) || 'none' }} role="img" aria-label="La foto que se ve" />
              : <div className="db-fondo" style={{ backgroundImage: urlFondo(f.url) || 'none' }} role="img" aria-label="El fondo que se ve" />}
            <div className="cu-btns">
              <select className="db-sel db-sel-corto" value={motivo[f.quien] || MOTIVOS_FONDO[0]} onChange={(e) => setMotivo(Object.assign({}, motivo, { [f.quien]: e.target.value }))}>
                {MOTIVOS_FONDO.map((m) => <option key={m}>{m}</option>)}</select>
              <button type="button" className="btn borde2 chico" disabled={ocup === f.quien} onClick={() => decidir(f, false)}>Quitar</button>
            </div>
          </li>
        ))}</ul>
      </> : null}
      {msg ? <small role="status">{msg}</small> : null}
    </div>
  );
}

// 👥 LOS LOGOS DE LAS CREWS (19/10/2026, bot/crews.js `crewDueno()`): lo que el filtro no supo decidir no se ve hasta que
// lo aprobás, y lo que aprobó queda tres días acá con «Quitar» —lo mismo que los fondos—. Al Líder le llega a su campana
function LogosCrews({ cl }) {
  const [lista, setLista] = useState(cl || { pend: [], vistos: [] });
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  const [motivo, setMotivo] = useState({});
  const decidir = async (x, si, de) => {
    setOcup(x.id); setMsg('');
    try {
      const r = await fetch('/api/avisos/dueno/crew', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ que: 'logo', crew: x.id, url: x.url, si, motivo: si ? '' : motivo[x.id] || MOTIVOS_FONDO[0] }) });
      const j = await r.json().catch(() => ({}));
      // 🛡️ se decide sobre el logo que viste: si el Líder subió otro mientras tanto, el objeto contesta `cambio`
      if (j.error === 'cambio') throw new Error('el logo de esta crew cambió mientras lo mirabas: recarga el Dashboard');
      if (!r.ok || j.error) throw new Error(j.error || String(r.status));
      setLista(Object.assign({}, lista, { [de]: lista[de].filter((y) => y.id !== x.id) }));
    } catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup('');
  };
  const fila = (x, de) => (
    <li key={de + x.id}>
      <div className="db-l1"><b><a href={'#/crew/' + encodeURIComponent(x.id)}>{x.nombre}</a></b><small>{hace(x.t)}</small></div>
      <img className="db-logo-crew" src={x.url} alt={'El logo de ' + x.nombre} />
      <div className="cu-btns">
        {de === 'pend' ? <button type="button" className="btn verde chico" disabled={ocup === x.id} onClick={() => decidir(x, true, de)}>Aprobar</button> : null}
        <select className="db-sel db-sel-corto" value={motivo[x.id] || MOTIVOS_FONDO[0]} onChange={(e) => setMotivo(Object.assign({}, motivo, { [x.id]: e.target.value }))}>
          {MOTIVOS_FONDO.map((m) => <option key={m}>{m}</option>)}</select>
        <button type="button" className="btn borde2 chico" disabled={ocup === x.id} onClick={() => decidir(x, false, de)}>{de === 'pend' ? 'No' : 'Quitar'}</button>
      </div>
    </li>
  );
  if (!lista.pend.length && !lista.vistos.length) return null;
  return (
    <div>
      {lista.pend.length ? <><h3>Logos de crews para revisar <small>el filtro automático no estuvo seguro: no se ven hasta que los apruebas</small></h3>
        <ul>{lista.pend.map((x) => fila(x, 'pend'))}</ul></> : null}
      {lista.vistos.length ? <><h3>Logos de crews que ya se ven <small>los aprobó el filtro en los últimos 3 días</small></h3>
        <ul>{lista.vistos.map((x) => fila(x, 'vistos'))}</ul></> : null}
      {msg ? <small role="status">{msg}</small> : null}
    </div>
  );
}

// 🤝 lo que también te llega: los videos y los fondos para revisar. Los reportes y ✅ Decidir tienen su pestaña desde el
// 13/10/2026
function Llego({ d, alFondos, alFiltro, alFotos }) {
  const vs = d.videos || [], fs = d.fondos || [], fcs = d.fotos_carta || [], vivos = (d.filtro && d.filtro.vivos) || [];
  const cl = d.crews_logos || { pend: [], vistos: [] };
  const hayLogos = (cl.pend || []).length || (cl.vistos || []).length;
  if (!vs.length && !fs.length && !fcs.length && !vivos.length && !hayLogos) return <p className="pronto-p">Nada nuevo acá: los reportes de las llaves y lo de ✅ Decidir tienen su pestaña.</p>;
  return <div className="db-llego">{fs.length || fcs.length || vivos.length ? <FondosRevisar fs={fs} alCambiar={alFondos} filtro={d.filtro} alFiltro={alFiltro} fcs={fcs} alFotos={alFotos} /> : null}{hayLogos ? <LogosCrews cl={cl} /> : null}{vs.length ? <VideosRevisar vs={vs} /> : null}</div>;
}

// ── ✅ DECIDIR, EN EL DASHBOARD (13/10/2026). Dlx: «estaba pensando en mover lo de decidir del sheet, aquí», y a la
// propuesta, «Sí, con Reportes». Las MISMAS preguntas de la hoja —las publica el ciclo (`decidir.para_web()`)—, por
// evento, con sus pistas y sus opciones. Contestar lo guarda el objeto y lo aplica el ciclo en su próxima corrida
// como si estuviera escrito en la hoja (`decidir._respuestas()`). La hoja sigue una semana en paralelo ──
async function contestarDecidir(cuerpo) {
  const r = await fetch('/api/avisos/dueno/decidir', { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : j.error || String(r.status));
  return j.decidir || {};
}
export const sinContestar = (dec) => ((dec && dec.preguntas) || []).filter((p) => !((dec.respuestas || {})[p.id])).length;

// ❔ QUÉ SE PREGUNTA Y QUÉ HACE CADA RESPUESTA (Dlx, 13/10/2026: «¿cómo lo resuelvo yo? ¿qué pongo?… que se pueda
// resolver bien y que se entienda bien»). Una línea por tipo, en palabras, y debajo de los botones lo que hace cada uno
const QUE_ES = {
  'Bracket incompleto': 'La llave no dice quién ganó y nadie la terminó. Si sabes quién salió campeón, toca «Ganó…». Si era de prueba o no se jugó, «No cuenta».',
  'Batalla sin ganador': 'La llave no dice quién ganó esta batalla. Elige al que pasó; si nadie siguió (no se presentó o lo reemplazaron), «Nadie siguió».',
  'Evento dudoso': 'Algo de este evento no le cierra al bot. Mira la llave al costado: si está bien así, confírmalo; si no, márcalo para revisar.',
  'Nombre desconocido': 'Este nombre está en una llave y el bot no sabe de quién es. Elige la cuenta, escribe quién es, o márcalo como nuevo.',
  'Alias posible': 'Una misma cuenta de Discord usó dos nombres. Di si son la misma persona: así suma todo junto.',
  'alta': 'Alguien que no está en la Lista apareció en el bot. Si es alguien nuevo de verdad, súmalo; si no, ciérralo.',
  'conflicto': 'Alguien usó /card con un nombre que en la Lista tiene otra cuenta. Mira las dos cuentas abajo: si es la misma persona, la Lista pasa a la cuenta nueva (o junta las dos filas); si es otra, queda como está.',
  'ambiguo': 'Esta cuenta se parece a más de una persona de la Lista.',
  'Vidas cargado': 'El bot cargó solo un 5 vidas desde #veredictos. Confirma que está bien o sácalo.',
  'Evento duplicado': 'El mismo evento quedó cargado dos veces. Si es el mismo, se saca el repetido.',
  'Llave sin resolver': 'El bot no pudo leer esta llave.',
  'Liga terminada': 'Una liga de los servidores lleva tres semanas sin batallas. Si terminó, elige quién la ganó: entra al Salón de campeones con su insignia.',
};
const HACE = [
  [/^No cuenta$/, 'la llave no suma nada, para nadie.'],
  [/^Sí cuenta$/, 'la llave suma como cualquier evento.'],
  [/^La completo en Discord$/, 'la editas (o el organizador) en Discord con quién ganó, y el bot la lee sola en la próxima vuelta.'],
  [/^Ganó /, 'ése gana (o sale campeón) y el resto queda como está en la llave.'],
  [/^Pasó /, 'ése pasa de ronda y los otros quedan afuera.'],
  [/^Nadie siguió/, 'todos cobran esa ronda, nadie pasa y no cuenta como duelo.'],
  [/^No se jugó$/, 'la batalla se borra: nadie cobra ni suma duelo.'],
  [/^Dejar para después$/, 'queda para otro día, sin cambiar nada.'],
  [/^Está bien así$/, 'el bot deja todo como lo leyó.'],
  [/^Hay que revisarlo$/, 'queda marcado para revisarlo a mano.'],
  [/^Es la misma persona$/, 'une los dos nombres: los puntos y la tarjeta van juntos.'],
  [/^Es otra persona$/, 'quedan separados y no se vuelve a preguntar.'],
  [/^Es alguien nuevo$/, 'lo cuenta como una persona nueva.'],
  [/^Es un troll/, 'ese nombre no suma nada.'],
  [/^Es la cuenta /, 'ese nombre es de esa cuenta de Discord: suma a su persona.'],
  [/^Terminó: la ganó /, 'ése es el campeón de la liga: entra al Salón, con el 2º y el 3º de la tabla, y se publica.'],
  [/^Todavía no terminó$/, 'no se vuelve a preguntar hasta que juegue y pare otra vez.'],
  [/^Es /, 'ese nombre es de esa persona de la Lista.'],
  [/^(Ya está resuelto|Ya lo revisé)$/, 'sólo cierra la pregunta.'],
  [/^Sí, es el mismo/, 'se saca el repetido y queda uno solo.'],
  [/^No, son eventos distintos$/, 'quedan los dos.'],
];
const haceQue = (o) => (HACE.find(([re]) => re.test(o)) || [0, ''])[1];

// 🧮 LO QUE PAGA CADA RESPUESTA (Dlx, 11/11/2026, la maqueta de ✅ Decidir: «Dale, arma A»). Lo calcula el ciclo
// (`decidir.efectos()`): qué cobra DE ESA RONDA cada uno de los que no siguen. Acá se muestra sólo a quien le cambia algo
// según la respuesta: el resto cobra lo mismo pase lo que pase
const NO_JUGO = 'No se jugó';
function varian(p) {
  const por = {};
  for (const [k, xs] of Object.entries((p && p.efectos) || {})) {
    if (k !== NO_JUGO) for (const [n, v] of xs) (por[n] = por[n] || new Set()).add(v);
  }
  return new Set(Object.keys(por).filter((n) => por[n].size > 1));
}
// cuánto mueve una pregunta: la mayor diferencia, para una misma persona, entre dos respuestas
function impacto(p) {
  if (!p || p.igual) return 0;
  const por = {};
  for (const [k, xs] of Object.entries(p.efectos || {})) {
    if (k !== NO_JUGO) for (const [n, v] of xs) (por[n] = por[n] || []).push(v);
  }
  return Math.max(0, ...Object.values(por).map((vs) => Math.max(...vs) - Math.min(...vs)));
}
function efectoDe(p, op, vs) {
  const xs = (p.efectos || {})[op];
  if (!xs || !xs.length) return '';
  if (op === NO_JUGO) return 'nadie cobra esta ronda';
  return xs.filter(([n]) => vs.has(n)).map(([n, v]) => limpio(n) + (v ? ' cobra ' + num(v) : ' queda en 0')).join(' · ');
}
const ordenOps = (p) => (p.sug && p.opciones.includes(p.sug) ? [p.sug, ...p.opciones.filter((x) => x !== p.sug)] : p.opciones);
const enHoras = (t) => { const h = Math.round((t - Date.now()) / 36e5); return h >= 1 ? h + ' h' : 'menos de una hora'; };
// ⏳ el anillo de las 48 h (`bot/finales.py`): se vacía hasta que el ciclo la cierra con «Nadie siguió»
function Anillo({ vence }) {
  const f = Math.max(0, Math.min(1, (vence - Date.now()) / (48 * 36e5)));
  const ya = vence <= Date.now();
  return (
    <p className="dz-anillo"><svg viewBox="0 0 36 36" width="30" height="30" aria-hidden="true"><circle cx="18" cy="18" r="15" className="dz-an-f" />
      <circle cx="18" cy="18" r="15" className="dz-an-v" strokeDasharray={(94.2 * f).toFixed(1) + ' 94.2'} transform="rotate(-90 18 18)" /></svg>
      <span>{ya ? 'Ya pasaron las 48 h: el ciclo la cierra con «Nadie siguió» en su próxima vuelta.'
        : <>Se le preguntó al organizador. Si nadie contesta, en <b>{enHoras(vence)}</b> cuenta como «Nadie siguió».</>}</span></p>
  );
}
// 🔎 EL BUSCADOR DE LA LISTA (la maqueta: «en vez de hacerme buscar un usuario… un dropdown»). La Lista la manda el ciclo
// (`decidir.lista_web()`); primero los de la MISMA bandera que el nombre de la pregunta, que es lo que separa a dos
// desconocidos con el mismo nombre (MATHIAS 🇻🇪 es Mathhias 🇻🇪, no MathiasMC 🇨🇴)
const planoB = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '');
const BANDERA_RE = /\p{Regional_Indicator}{2}/u;
const sinMarcas = (s) => String(s || '').replace(/\p{Regional_Indicator}|❓/gu, '').replace(/\s+/g, ' ').trim();
function BuscaLista({ lista, nombre, ocup, onElegir }) {
  const [q, setQ] = useState(() => sinMarcas(nombre));
  const [act, setAct] = useState(0);
  const flag = (String(nombre || '').match(BANDERA_RE) || [])[0] || '';
  const k = planoB(q);
  const xs = k.length < 2 ? [] : (lista || []).filter(([n]) => planoB(n).includes(k))
    .sort((a, b) => (flag ? b[0].includes(flag) - a[0].includes(flag) : 0) || planoB(a[0]).indexOf(k) - planoB(b[0]).indexOf(k)
      || a[0].length - b[0].length).slice(0, 8);
  const elegir = (n) => onElegir(sinMarcas(n));
  const tecla = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setAct((i) => Math.max(0, Math.min(xs.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))); }
    else if (e.key === 'Enter' && xs[act]) { e.preventDefault(); elegir(xs[act][0]); }
  };
  return (
    <div className="dz-bus">
      <label htmlFor={'bus-' + k.slice(0, 8)}>Es alguien de la Lista</label>
      <input id={'bus-' + k.slice(0, 8)} type="text" value={q} autoComplete="off" maxLength={56} disabled={ocup} role="combobox"
        aria-expanded={xs.length > 0} aria-controls="dz-bus-l" onChange={(e) => { setQ(e.target.value); setAct(0); }} onKeyDown={tecla} />
      {xs.length ? (
        <ul id="dz-bus-l" role="listbox">{xs.map(([n, pais], i) => (
          <li key={n} role="option" aria-selected={i === act}><button type="button" disabled={ocup} className={i === act ? 'on' : ''} onClick={() => elegir(n)}>
            <span><b>{n}</b><small>{pais || 'sin país en la Lista'}</small></span>
            {flag ? <em className={n.includes(flag) ? 'ok' : 'no'}>{n.includes(flag) ? 'misma bandera' : BANDERA_RE.test(n) ? 'otra bandera' : 'sin bandera'}</em> : null}
          </button></li>
        ))}</ul>
      ) : k.length >= 2 ? <p className="dz-bus-nada">Nadie en la Lista se llama así.</p> : null}
    </div>
  );
}

function Pregunta({ p, r, alListo, marcada, alMarcar, lista }) {
  const [libre, setLibre] = useState('');
  const [nota, setNota] = useState((r && r.nota) || '');
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const mandar = async (cuerpo) => {
    setOcup(true); setMsg('');
    try { alListo(await contestarDecidir(Object.assign({ id: p.id }, cuerpo))); } catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup(false);
  };
  return (
    <li className={r ? 'db-dec-hecha' : ''}>
      <div className="db-l1">
        {/* ☑️ para contestar varias juntas (ver `Lote`) */}
        {!r && alMarcar ? <label className="db-marca"><input type="checkbox" checked={!!marcada} onChange={() => alMarcar(p.id)} aria-label="Elegir para contestar junto con otras" /></label> : null}
        <span className="db-chip">{p.tipo}</span></div>
      <p className="db-dec-que">{p.que}</p>
      {QUE_ES[p.tipo] && !r ? <p className="db-dec-ayuda">{QUE_ES[p.tipo]}</p> : null}
      {p.pistas && p.pistas !== '—' ? <p className="db-dec-pistas">{p.pistas}</p> : null}
      {r ? (
        <div className="cu-btns">
          <small>✍️ <b>{r.r}</b>{r.nota ? ' · ' + r.nota : ''}{r.por && r.por !== 'Dlx' ? ' · contestó ' + r.por : ''} · lo aplica el ciclo en su próxima corrida</small>
          <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => mandar({ borrar: true })}>Deshacer</button>
        </div>
      ) : <>
        {p.igual ? <p className="dz-igual">Cualquier respuesta paga lo mismo a todos.</p> : null}
        <div className="db-opc">{ordenOps(p).map((x) => {
          const ef = efectoDe(p, x, varian(p));
          const su = !!p.sug && x === p.sug;
          return (
            <button key={x} type="button" disabled={ocup} title={haceQue(x)} className={(ef || su ? 'dz-op' : '') + (su ? ' sug' : '')} onClick={() => mandar({ r: x, nota })}>
              {su ? <em className="dz-op-sug">Lo que sugiere el bot</em> : null}<span>{x}</span>{ef ? <small className="dz-op-ef">{ef}</small> : null}</button>
          );
        })}</div>
        {p.vence ? <Anillo vence={p.vence} /> : null}
        {p.opciones.some(haceQue) ? (
          <details className="db-dec-hace"><summary>Qué hace cada respuesta</summary>
            <ul>{p.opciones.filter(haceQue).map((x) => <li key={x}><b>{x}</b>: {haceQue(x)}</li>)}</ul>
          </details>) : null}
        {p.libre && (lista || []).length ? (
          <BuscaLista lista={lista} nombre={((String(p.que || '').match(/«([^»]+)»/) || [])[1]) || ''} ocup={ocup}
            onElegir={(n) => mandar({ r: 'Es ' + n, nota })} />
        ) : p.libre ? (
          <div className="db-rep-q"><label>Es otro de la Lista:
            <input type="text" value={libre} placeholder="su nombre como figura en la Lista" maxLength={56} onChange={(e) => setLibre(e.target.value)} />
            <button type="button" className="btn verde chico" disabled={ocup || !libre.trim()} onClick={() => mandar({ r: 'Es ' + libre.trim(), nota })}>Es éste</button>
          </label></div>) : null}
        <div className="db-rep-q"><label>Nota (opcional):
          <input type="text" value={nota} placeholder="queda en la hoja con la respuesta" maxLength={300} onChange={(e) => setNota(e.target.value)} /></label></div>
      </>}
      {msg ? <small role="status">{msg}</small> : null}
    </li>
  );
}

// ── 🏆 LA LLAVE AL COSTADO (Dlx, 13/10/2026: «quizás al costado puedas poner la evidencia o el soporte o algo visual?
// por ejemplo la llave en sí que el bot no entiende»). Si el evento tiene número, la llave como la leyó el bot
// (`/api/llaves`, lo mismo que la página de cada llave), con quién ganó cada batalla; si todavía no entró, lo que dice la
// llave, armado de las pistas («Cuartos: A vs B vs C»). Los nombres de la pregunta van marcados ──
const sinB = (s) => limpio(String(s || '')).toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '');
//: los nombres que nombra una pregunta: «X» y los lados de «A 🆚 B»
function nombresDe(p) {
  const out = [];
  for (const m of String(p.que || '').matchAll(/«([^»]+)»/g)) out.push(m[1]);
  const vs = String(p.que || '').split('\n').find((l) => l.includes('🆚'));
  if (vs) out.push(...vs.split('🆚').flatMap((x) => x.split(',')));
  return out.map(sinB).filter(Boolean);
}
//: «Cuartos: a vs b vs c» de las pistas → rondas, para las llaves que todavía no entraron
function rondasDePistas(ps) {
  const rs = [];
  for (const p of ps) {
    for (const l of String(p.pistas || '').split('\n')) {
      const m = l.match(/^\s*([^:]{3,30}):\s*(.+\svs\s.+)$/i);
      if (!m) continue;
      const r = m[1].trim(), lados = m[2].split(/\s+vs\s+/i).map((x) => x.trim()).filter(Boolean);
      let ro = rs.find((x) => x.r === r);
      if (!ro) { ro = { r, b: [] }; rs.push(ro); }
      if (!ro.b.some((b) => b[0].join('|') === lados.join('|'))) ro.b.push([lados, '']);
    }
  }
  return rs;
}
function LlaveAlCostado({ s }) {
  const n = (String(s.sec || '').match(/#(\d+)/) || [])[1] || '';
  const [ll, setLl] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (n) pedirLlaves().then((t) => { if (vivo && t) setLl(t[n] || null); });
    return () => { vivo = false; };
  }, [n]);
  const marca = new Set(s.ps.flatMap(nombresDe));
  const rondas = ll && (ll.rondas || []).length ? ll.rondas : rondasDePistas(s.ps);
  if (!rondas.length) return null;
  const lado = (x, gano, i) => {
    const k = sinB(x);
    return <span key={i} className={'dl-l' + (gano && k === sinB(gano) ? ' dl-gano' : '') + ([...marca].some((m) => m && (k === m || k.includes(m))) ? ' dl-marca' : '')}>{limpio(x)}</span>;
  };
  return (
    <aside className="db-dec-llave" aria-label="La llave">
      <h4>{ll ? 'La llave #' + n + ', como la leyó el bot' : 'Lo que dice la llave'}</h4>
      {rondas.map((r) => (
        <div key={r.r} className="dl-r"><b>{r.r}</b>
          <ul>{(r.b || []).map((b, i) => (
            <li key={i}>{(b[0] || []).map((x, j) => <Fragment key={j}>{j ? <i>vs</i> : null}{lado(x, b[1], j)}</Fragment>)}
              {ll && !b[1] ? <em>sin ganador</em> : null}</li>
          ))}</ul>
        </div>
      ))}
      <p className="dl-pie">{ll ? <><span className="dl-l dl-gano">ganó</span> </> : null}<span className="dl-l dl-marca">de la pregunta</span>
        {ll && (ll.links || [])[0] ? <> · <a href={ll.links[0]} target="_blank" rel="noopener noreferrer">abrirla en Discord ↗</a></> : null}</p>
    </aside>
  );
}

// ☑️ CONTESTAR EN LOTE (Dlx, 13/10/2026, de las ideas del Dashboard): las elegidas, con una respuesta que tengan TODAS
// entre sus opciones («Es alguien nuevo», «Ya lo revisé», «Dejar para después»…). Se mandan de a una, como si se
// tocaran a mano: el objeto y el ciclo no saben que fue en lote
function Lote({ ps, sel, setSel, alListo, visibles, notaInicial = '' }) {
  const [nota, setNota] = useState(notaInicial);
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  const elegidas = ps.filter((p) => sel.has(p.id));
  const libres = visibles.filter((p) => !p.r);
  const comunes = elegidas.length ? elegidas[0].opciones.filter((o) => elegidas.every((p) => (p.opciones || []).includes(o))) : [];
  const contestar = async (resp) => {
    setOcup(resp); setMsg('');
    let ultimo = null, mal = 0;
    for (const p of elegidas) {
      try { ultimo = await contestarDecidir({ id: p.id, r: resp, nota }); } catch (e) { mal += 1; }
    }
    if (ultimo) alListo(ultimo);
    setSel(new Set()); setOcup(''); setNota(notaInicial);
    setMsg(mal ? 'Quedaron ' + mal + ' sin contestar: prueba de nuevo.' : '✓ Contestadas ' + elegidas.length + ': «' + resp + '».');
  };
  if (!elegidas.length) {
    return (
      <div className="db-lote apagado">
        {libres.length >= 2 ? <button type="button" className="evp-lnk" onClick={() => setSel(new Set(libres.map((p) => p.id)))}>Elegir las {libres.length} que se ven, para contestarlas juntas</button> : null}
        {msg ? <small role="status">{msg}</small> : null}
      </div>
    );
  }
  return (
    <div className="db-lote" role="region" aria-label="Contestar varias juntas">
      <p><b>{elegidas.length} elegida{elegidas.length === 1 ? '' : 's'}</b> · <button type="button" className="evp-lnk" onClick={() => setSel(new Set())}>soltarlas</button>
        {libres.length > elegidas.length ? <> · <button type="button" className="evp-lnk" onClick={() => setSel(new Set(libres.map((p) => p.id)))}>elegir las {libres.length} que se ven</button></> : null}</p>
      {comunes.length ? <div className="db-opc">{comunes.map((o) => <button key={o} type="button" disabled={!!ocup} onClick={() => contestar(o)}>{ocup === o ? '…' : o}</button>)}</div>
        : <small>Estas preguntas no tienen ninguna respuesta en común: elige de un solo tipo (el filtro «Tipo» ayuda).</small>}
      {comunes.length ? <div className="db-rep-q"><label>Nota para todas (opcional):
        <input type="text" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} /></label></div> : null}
      {msg ? <small role="status">{msg}</small> : null}
    </div>
  );
}

// ── 🤖 LO QUE SE RESOLVIÓ SOLO (Dlx, 13/10/2026, de las ideas del Dashboard; y «si resolvés algunas cosas asegurate de
// que el bot y la página puedan resolverlo también»). Lo que una regla del ciclo cerró o contestó en los últimos 14 días,
// con la regla, la respuesta y su prueba. «Deshacer» la devuelve a ✅ Decidir en la próxima corrida y esa regla no la
// vuelve a tocar (`deshacer` de `/avisos/decidir-ciclo`) ──
function Solas({ x, alListo }) {
  const [ocup, setOcup] = useState('');
  const [abierto, setAbierto] = useState(false);
  const solas = x.solas || [];
  if (!solas.length) return null;
  const des = new Set(x.deshacer || []);
  const porRegla = {};
  for (const s of solas) porRegla[s.regla || 'otra'] = (porRegla[s.regla || 'otra'] || 0) + 1;
  const deshacer = async (s) => {
    setOcup(s.id);
    try { alListo(await contestarDecidir({ id: s.id, deshacer: true })); } catch (e) { /* queda como estaba */ }
    setOcup('');
  };
  const ver = abierto ? solas : solas.slice(0, 5);
  return (
    <div className="db-solas">
      <h3>🤖 Lo que se resolvió solo <small>{solas.length} en 14 días · {Object.entries(porRegla).map(([r, n]) => r + ' ' + n).join(' · ')}</small></h3>
      <ul>{ver.map((s) => (
        <li key={s.id} className={des.has(s.id) ? 'deshecha' : ''}>
          <div className="db-l1"><span className="db-chip">{s.regla}</span><span className="db-chip">{s.tipo}</span><small>{hace(s.t)}</small></div>
          <p className="db-dec-que">{s.que}{s.sec ? <small> · {s.sec}</small> : null}</p>
          <p className="db-solas-r">→ <b>{s.r}</b>{s.porque ? <span> · {s.porque}</span> : null}</p>
          {des.has(s.id) ? <small>Deshecha: vuelve a ✅ Decidir en la próxima corrida.</small>
            : <button type="button" className="btn borde2 chico" disabled={ocup === s.id} onClick={() => deshacer(s)}>Deshacer</button>}
        </li>
      ))}</ul>
      {solas.length > 5 ? <button type="button" className="evp-lnk" onClick={() => setAbierto(!abierto)}>{abierto ? 'Ver menos' : 'Ver las ' + solas.length}</button> : null}
    </div>
  );
}

function Decisiones({ dec, alCambiar, liga }) {
  const [f, setF, limpiar] = useFiltro('dec');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const marcar = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [x, setX0] = useState(dec || {});
  useEffect(() => { setX0(dec || {}); }, [dec]);
  const setX = (y) => { setX0(y); if (alCambiar) alCambiar(y); };
  const ps = x.preguntas || [], rs = x.respuestas || {};
  if (!ps.length) {
    return <>{(x.solas || []).length ? <Solas x={x} alListo={setX} /> : null}
      <p className="pronto-p">{x.t ? 'Nada para decidir: el ciclo no tiene preguntas abiertas.' : 'Las preguntas aparecen cuando el ciclo las publique, en su próxima corrida.'}</p></>;
  }
  // 🔎 los filtros: servidor (del título), tipo, importancia (`imp` lo pone el ciclo: `decidir.IMPORTANCIA`) y respuesta
  const sv = (p) => svDeSec(p.sec, liga);
  const imp = (p) => p.imp || 'media';
  const resp = (p) => (rs[p.id] ? 'si' : 'no');
  const vista = ps.filter((p) => (!f.sv || sv(p) === f.sv) && (!f.tipo || (p.grupo || p.tipo) === f.tipo)
    && (!f.imp || imp(p) === f.imp) && (!f.resp || resp(p) === f.resp)
    && contiene([p.que, p.pistas, p.sec, ...(p.opciones || [])], q));
  // por evento, en el orden en que vienen (el de la hoja: primero lo que mueve puntos)
  const secs = [];
  for (const p of vista) {
    const s = secs.find((y) => y.sec === p.sec);
    if (s) s.ps.push(p); else secs.push({ sec: p.sec, ps: [p] });
  }
  return (
    <div className="db-dec">
      <p className="db-rep-nota">{sinContestar(x)} sin contestar de {ps.length}{x.t ? ' · el ciclo las publicó ' + hace(x.t) : ''}. Lo que contestes acá vale igual que en la hoja.</p>
      <Solas x={x} alListo={setX} />
      <Buscar q={q} setQ={setQ} que="un nombre, un evento o una llave" />
      <Filtros f={f} setF={setF} limpiar={limpiar} n={vista.length} total={ps.length}
        nota={ps.some((p) => p.imp) ? IMP_DICE : ''} grupos={[
          ['sv', 'Servidor', opciones(ps, sv)],
          ['tipo', 'Tipo', opciones(ps, (p) => p.grupo || p.tipo)],
          ['imp', 'Importancia', ps.some((p) => p.imp) ? opciones(ps, imp, IMP) : []],
          ['resp', 'Respuesta', opciones(ps, resp, [['no', 'Sin contestar'], ['si', 'Contestadas']])],
        ]} />
      {!vista.length ? <p className="pronto-p">Ninguna con estos filtros.</p> : null}
      {/* ☑️ sólo las abiertas (18/11/2026): la que se contestó a mano seguía elegida en `sel`, y el lote la volvía a
          contestar y pisaba su respuesta (el objeto hace INSERT OR REPLACE) */}
      <Lote ps={ps.filter((p) => !rs[p.id])} sel={sel} setSel={setSel} alListo={setX} visibles={vista.map((p) => Object.assign({ r: rs[p.id] }, p))} />
      {secs.map((s) => {
        const link = (s.ps.find((p) => p.link) || {}).link;
        return (
          <div key={s.sec} className="db-dec-sec">
            <h3>{s.sec}{link ? <> <a className="db-link" href={link} target="_blank" rel="noopener noreferrer">la llave en Discord ↗</a></> : null}</h3>
            <div className="db-dec-cuerpo">
              <ul>{s.ps.map((p) => <Pregunta key={p.id} p={p} r={rs[p.id]} alListo={setX} marcada={sel.has(p.id)} alMarcar={marcar} />)}</ul>
              <LlaveAlCostado s={s} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 🧭 EL DASHBOARD, POR ÁREAS (25/10/2026). Dlx: «quisiera que lo remakees completamente… siento que está todo tirado
// pero no necesariamente organizado», y a la maqueta (artifact 9W34gdd8BspxH3A5QyDLxj), «una mezcla… de A el lado
// izquierdo, de B que aparece lo prioritario primero, en cuadrados». Siete áreas en la barra de la izquierda (arriba en el
// teléfono) y cada cosa vive en UNA sola: los ajustes de los servidores estaban repartidos entre Ajustes, Números (los
// tiers) y Hoy (los MES AWARDS). El Resumen abre con lo que hay que decidir, en cuadrados.
// El área elegida se recuerda en este navegador (`lg:db-area`)
const AREAS = [
  ['resumen', 'Resumen', 'M3 12l9-8 9 8M5 10v10h14V10'],
  ['pendientes', 'Pendientes', 'M4 4h16v12H14l-4 4v-4H4z'],
  ['servidores', 'Servidores', 'M4 5h16v5H4zM4 14h16v5H4zM7 7.5h.01M7 16.5h.01'],
  ['web', 'La página y el bot', 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4'],
  ['numeros', 'Números', 'M5 20V11M12 20V5M19 20v-7'],
  ['salud', 'Salud', 'M3 12h4l3-7 4 14 3-7h4'],
  // 🎚️ LLAVES Y FONDOS (Dlx, 11/11/2026: «opciones donde pueda controlar qué llaves cuentan, qué no, los fondos de cada
  // tarjeta, de su en vivo»): qué llaves cuentan, el fondo del VS en vivo de cada servidor y los fondos que ya se ven
  ['control', 'Llaves y fondos', 'M4 6h16M4 12h10M4 18h6M17 14l3 3-3 3'],
  ['historial', 'Historial', 'M12 7v5l3 3M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4'],
  // 🎛️ ROLES, SU PROPIA COLUMNA (Dlx, 11/11/2026: «agrega una nueva columna que diga roles de dashboard, así para navegar
  // de mejor forma el dashboard y dar roles, quitar»): quién tiene uno, qué puede cada uno, y darlos o sacarlos
  ['roles', 'Roles', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M3 21v-1a6 6 0 0 1 12 0v1M17 11l2 2 4-4'],
];
// 🗂️ LAS NUEVE ÁREAS EN TRES GRUPOS CON NOMBRE (21/11/2026, la maqueta «Mods y paneles», Dlx: «para los dashboard me
// gustan los tableros»). En la compu, la barra de la izquierda con el nombre de cada grupo; en el teléfono, un solo botón
// «<área> ▾» que abre una hoja con los tres grupos (antes eran cuatro áreas y «Más…»). El orden de `AREAS` no cambia:
// lo siguen usando Ctrl+K y `lg:db-area`
const GRUPOS_AREA = [
  ['Hoy', ['resumen', 'pendientes', 'salud']],
  ['La Liga', ['servidores', 'control', 'roles']],
  ['La página', ['web', 'numeros', 'historial']],
];
// 🎨 la tinta que se lee sobre el color de un servidor (sale del payload): negra sobre los claros, blanca sobre el resto
const tintaSobre = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#F6F6F6';
  const v = parseInt(m[1], 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.4 ? '#030304' : '#F6F6F6';
};
// 📊 LOS EVENTOS JUGADOS, DÍA POR DÍA (el tablero): los del calendario del lobby con llave leída o marcados jugados, en
// hora del este, los últimos 7 días hasta hoy. Lo mismo que cuenta la cartelera; no se pide nada nuevo
function jugadosDe(liga) {
  const cal = ((liga && liga.d) || {}).calendario || [];
  const hoy = diaISO(new Date());
  const dias = [];
  for (let i = 6; i >= 0; i--) { const x = new Date(hoy + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - i); dias.push(x.toISOString().slice(0, 10)); }
  const n = Object.fromEntries(dias.map((x) => [x, 0]));
  for (const c of cal) {
    if (!(c.ll || c.jugado) || !c.t) continue;
    const t = new Date(c.t);
    if (Number.isNaN(+t)) continue;
    const k = diaISO(t);
    if (k in n) n[k] += 1;
  }
  const xs = dias.map((x) => [x, n[x]]);
  const tope = Math.max(0, ...xs.map((x) => x[1]));
  return { xs, hoy, total: xs.reduce((a, x) => a + x[1], 0), tope, fuertes: tope ? xs.filter((x) => x[1] === tope).map((x) => x[0]) : [] };
}
// las cuatro colas de Pendientes
// 📣 LOS REPORTES DE LA GENTE, PRIMERO (20/11/2026, el plan de los tiers: «los reportes de su gente arriba en tu Dashboard»,
// para todos los servidores y sin orden por tier): en los cuadrados de «Para decidir», en la bandeja y en sus filtros
const SUBP = [['llaves', 'Reportes de la gente'], ['quien', '¿Quién es quién?'], ['imagenes', 'Imágenes y videos'], ['pedidos', 'Pedidos']];
const AREA = 'lg:db-area';
const leerArea = () => { try { const t = localStorage.getItem(AREA); return AREAS.some(([k]) => k === t) ? t : 'resumen'; } catch (e) { return 'resumen'; } };
const ponerArea = (t) => { try { localStorage.setItem(AREA, t); } catch (e) { /* sin almacenamiento */ } };
const msDe = (t) => (typeof t === 'number' ? t : Date.parse(t || '') || 0);

// 🔎 LO QUE ENCUENTRA «BUSCAR» (Ctrl+K): cada ajuste y cada lugar, con el área donde vive y el ancla a la que baja
const BUSCABLES = [
  ['La campana (pausar los avisos)', 'web', 'aj-campana'], ['El sorteo del premium', 'web', 'aj-sorteo'], ['Eventos de estilo (marcar un evento de DRA)', 'web', 'aj-estilos'],
  ['Aviso arriba de la página', 'web', 'aj-aviso'], ['El bot en vivo', 'web', 'aj-vivo'], ['Cada cuánto habla el bot en vivo', 'web', 'aj-ritmo'],
  ['Horario de silencio', 'web', 'aj-silencio'], ['Las apuestas', 'web', 'aj-apuestas'], ['El aviso de cada evento', 'web', 'aj-avisos'],
  ['Las crews: precios, ranking y tiers', 'web', 'aj-crews'], ['MES AWARDS: sacar un nominado', 'web', 'aj-mes'], ['Promos a mano', 'web', 'aj-promos'],
  ['Comentarios simulados: a quién le preguntaste', 'web', 'aj-comentarios'],
  ['El multiplicador de la semana', 'servidores', 'sv-cada'], ['Bot en vivo, apuestas y aviso de cada servidor', 'servidores', 'sv-cada'],
  // ⚓ `sv-tiers` ya no existe (18/11/2026: se fue con la tabla del 25/10): el tier y el dueño viven en la Ficha de cada
  // fila (`sv-cada`) y sumar uno en `sv-sumar`. Con el ancla muerta, el buscador dejaba al principio del área
  ['Los tiers de los servidores', 'servidores', 'sv-cada'], ['Sumar un servidor', 'servidores', 'sv-sumar'], ['El dueño de un servidor socio', 'servidores', 'sv-cada'],
  ['Los que corrieron /setup (sus puntos de Temporada)', 'servidores', 'sv-setup'],
  ['Reportes de la gente (errores en las llaves)', 'pendientes', '', 'llaves'], ['¿Quién es quién? (✅ Decidir)', 'pendientes', '', 'quien'],
  ['Fondos, fotos de carta, logos y videos', 'pendientes', '', 'imagenes'], ['Pedidos de la gente', 'pendientes', '', 'pedidos'],
  ['Comparar semanas', 'numeros', 'nu-semanas'], ['La semana en personas', 'numeros', 'nu-uso'], ['El tutorial', 'numeros', 'nu-tuto'],
  ['Qué se toca en la página', 'numeros', 'nu-clics'], ['¿El lobby hace volver a la gente?', 'numeros', 'nu-lobby'], ['Las crews (números)', 'numeros', 'nu-crews'],
  ['El Pase de rapero (números)', 'numeros', 'nu-pase'], ['Correr el ciclo ahora', 'salud', 'sa-corridas'], ['Lo que gasta Cloudflare hoy', 'salud', 'sa-cuotas'],
  ['Lo que avisó Logs', 'salud', 'sa-logs'], ['Errores de la página', 'salud', 'sa-errores'], ['El mapa en vivo y los atajos', 'salud', 'sa-atajos'],
  ['Historial de cambios (deshacer)', 'historial', 'hi-hist'], ['Quién tiene un rol del Dashboard', 'roles', 'ro-quien'],
  ['Qué puede cada rol (permisos)', 'roles', 'ro-permisos'], ['Dar o sacar un rol', 'roles', 'ro-dar'],
  ['Qué llaves cuentan (sacar una del ranking)', 'control', 'co-llaves'], ['El fondo del VS en vivo de cada servidor', 'control', 'co-vs'],
  ['Los fondos de la gente que ya se ven (quitar uno)', 'control', 'co-fondos'],
];

function BuscarTodo({ abierto, cerrar, ir, visibles, liga, abrirFicha, extra }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  if (!abierto) return null;
  const n = normN(q);
  const xs0 = [...AREAS.filter(([k]) => visibles[k]).map(([k, t]) => [t, k, '']), ...BUSCABLES.filter((x) => visibles[x[1]])]
    .filter((x) => !n || normN(x[0]).includes(n)).slice(0, 10);
  // 🗂️ y la gente (25/10/2026): con dos letras o más, los del ranking y los de la lista de primerizos; abre su ficha
  const gente = [];
  if (n.length >= 2 && abrirFicha) {
    const vistos = new Set();
    for (const [nom, k] of [...Object.values((liga && liga.T) || {}).map((f) => [f.n, f.k]), ...(extra || [])]) {
      if (!k || vistos.has(k) || !normN(nom).includes(n)) continue;
      vistos.add(k); gente.push([limpio(nom), 'ficha', k]);
      if (gente.length >= 6) break;
    }
  }
  const xs = [...xs0, ...gente];
  const elegir = (x) => {
    if (!x) return;
    if (x[1] === 'ficha') abrirFicha(x[2], x[0]); else ir(x[1], x[2], x[3]);
    setQ(''); setI(0); cerrar();
  };
  const tecla = (e) => {
    if (e.key === 'Escape') cerrar();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(xs.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(xs[i]); }
  };
  return (
    <div className="dz-velo" role="presentation" onClick={cerrar}>
      <div className="dz-buscar" role="dialog" aria-modal="true" aria-label="Buscar en el Dashboard" onClick={(e) => e.stopPropagation()}>
        <label className="dz-bq"><Ico n="buscar" t={18} />
          <input autoFocus value={q} placeholder="Busca un ajuste, una acción o a alguien" onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={tecla} /></label>
        {xs.length ? <ul>{xs.map((x, j) => (
          <li key={x[0] + x[1]}><button type="button" className={j === i ? 'on' : ''} onMouseEnter={() => setI(j)} onClick={() => elegir(x)}>
            <b>{x[1] === 'ficha' ? '👤 ' + x[0] : x[0]}</b><small>{x[1] === 'ficha' ? 'su ficha' : (AREAS.find((a) => a[0] === x[1]) || [])[1]}</small></button></li>
        ))}</ul> : <p className="db-tx">Nada con «{q}».</p>}
      </div>
    </div>
  );
}

// 💚 LA SALUD EN UNA FRASE (la maqueta: «Todo anda»), y sólo si algo anda mal, qué. El cupo de escrituras con su ritmo:
// el día de Cloudflare es UTC, así que lo medido se proyecta desde la última medianoche UTC.
// 🌙 SÓLO SOBRE LAS HORAS EN QUE SE ESCRIBE (12/11/2026, mirándolo con Dlx: decía «~1.326, no alcanza» con 363). De 3 a
// 11 AM ET no corre ni el ciclo ni el vigía (`MADRUGADA`), y el día UTC arranca a las 7 PM ET, justo en las horas de los
// eventos: proyectar a 24 h triplicaba la noche. Medido en las corridas del 09 al 11/11: los días cerraron en 360–500
const MADRUGADA = [3, 11];
const _horaET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
function horasActivas(desde, hasta) {
  let n = 0;
  for (let t = desde; t < hasta; t += 900000) {
    const h = Number(_horaET.format(new Date(t)));
    if (h < MADRUGADA[0] || h >= MADRUGADA[1]) n += 0.25;
  }
  return n;
}
function proyeccion(q) {
  const w = q && q.kv && q.kv.write;
  if (w == null || !q.cuando) return null;
  const t = Date.parse(q.cuando);
  const ini = t - (((t % 86400000) + 86400000) % 86400000);
  const ya = horasActivas(ini, t);
  return ya >= 1 ? Math.round((w / ya) * horasActivas(ini, ini + 86400000)) : null;
}
// a qué hora se renueva el cupo de Cloudflare (la medianoche UTC): 7 PM ET en invierno, 8 PM en verano
const renuevaKV = () => { const a = new Date(); return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate() + 1)); };
function saludDe(d, q) {
  const s = d.sistema || {};
  const ult = (d.corridas || [])[0];
  const mal = [];
  if (s.ok === false) mal.push('el lector de anuncios no contesta (los avisos al minuto y el bot en vivo pueden estar quietos)');
  if (ult && ult.estado === 'completed' && ult.fin && ult.fin !== 'success' && ult.fin !== 'skipped') mal.push('la última vuelta del ciclo ' + String(FIN_CORRIDA[ult.fin] || ult.fin).replace(/^\S+\s/, ''));
  if (d.github) mal.push('GitHub anda lento: las vueltas del ciclo pueden atrasarse');
  for (const [, , t] of cuotasEnRojo(q)) mal.push(t.toLowerCase() + ' casi llenas hoy');
  const w = q && q.kv ? q.kv.write : null;
  const p = proyeccion(q);
  const partes = [
    ult ? 'la última vuelta del ciclo: ' + (ult.empezo || ult.creada ? hora(new Date(ult.empezo || ult.creada)) : '—') : '',
    s.vigia ? 'el lector de anuncios leyó ' + hace(s.vigia) : '',
    w != null ? 'escrituras del día: ' + num(w) + ' de 1.000' + (p != null ? (p < 1000 ? ', al ritmo de hoy alcanzan' : ', al ritmo de hoy no alcanzan (~' + num(p) + ')') : '') : '',
  ].filter(Boolean);
  return { ok: !mal.length, mal, partes };
}

// 🕓 «DESDE TU ÚLTIMA VISITA» (la maqueta): lo que pasó mientras no estabas, de lo que el Dashboard ya trae. La última
// visita se guarda en este navegador (`lg:db-visita`): no gasta nada del servidor
const VISITA = 'lg:db-visita';
// ⚠️ UNA VEZ POR CARGA DE LA PÁGINA, no por montaje: la página monta el Dashboard más de una vez al abrirlo (el lazy y el
// respaldo), y el segundo montaje leía la visita que acababa de anotar el primero («desde tu última visita: recién»)
let visitaPrevia = null;
function leerVisita() {
  if (visitaPrevia === null) {
    try { visitaPrevia = Number(localStorage.getItem(VISITA)) || 0; localStorage.setItem(VISITA, String(Date.now())); } catch (e) { visitaPrevia = 0; }
  }
  return visitaPrevia;
}
function desdeVisita(d, prev, logs) {
  if (!prev) return null;
  const xs = [];
  for (const h of d.ajustes_hist || []) if (msDe(h.t) > prev) xs.push([msDe(h.t), (NOMBRE_AJ[h.cual] || h.cual) + ' cambió' + (h.por && h.por !== 'Dlx' ? ' (lo cambió ' + h.por + ')' : ''), 'historial']);
  for (const r of d.reportes || []) if (msDe(r.t) > prev) xs.push([msDe(r.t), 'Un reporte nuevo ' + (/^\d+$/.test(String(r.llave)) ? 'de la llave #' + r.llave : 'de ' + etiquetaRep(r).toLowerCase()) + (r.de ? ', de ' + r.de : ''), 'pendientes', 'llaves']);
  for (const p of d.pedidos || []) if (msDe(p.t) > prev) xs.push([msDe(p.t), 'Un pedido nuevo: ' + (PED_TIPO[p.tipo] || p.tipo).toLowerCase(), 'pendientes', 'pedidos']);
  for (const f of d.fondos || []) if (msDe(f.t) > prev) xs.push([msDe(f.t), 'Un fondo nuevo para revisar', 'pendientes', 'imagenes']);
  for (const c of d.corridas || []) if (msDe(c.creada) > prev && c.fin && c.fin !== 'success' && c.fin !== 'skipped') xs.push([msDe(c.creada), 'Una vuelta del ciclo ' + String(FIN_CORRIDA[c.fin] || c.fin).replace(/^\S+\s/, ''), 'salud']);
  for (const e of d.errores_pag || []) if (msDe(e.primero) > prev) xs.push([msDe(e.primero), 'Un error nuevo en la página: ' + e.donde, 'salud']);
  for (const l of (logs && logs.xs) || []) if (l.nivel === 'rojo' && msDe(l.t) > prev) xs.push([msDe(l.t), 'Logs, en rojo: ' + l.tit, 'salud']);
  return xs.sort((a, b) => b[0] - a[0]).slice(0, 8);
}

// 📅 LO QUE ESTÁ PROGRAMADO O PRENDIDO A MANO (la maqueta), con el área donde se cambia
function programado(aj, liga) {
  const fecha = (t) => { const x = new Date(t); return diaISO(x).slice(8, 10).replace(/^0/, '') + '/' + diaISO(x).slice(5, 7).replace(/^0/, '') + ' a las ' + hora(x); };
  const m = liga.d.mult || {};
  const av = avisoVigente(aj);
  return [
    // ⏳ sólo si todavía no se sorteó: el del 30/10 seguía «programado» el 12/11 (mirándolo con Dlx)
    aj.pase_sorteo && msDe(aj.pase_sorteo.sorteo) > Date.now()
      ? ['El sorteo del premium', 'cierra el ' + fecha(aj.pase_sorteo.cierra) + ' y se sortea el ' + fecha(aj.pase_sorteo.sorteo), 'web', 'aj-sorteo'] : null,
    av ? ['Aviso en la página', '«' + av.texto.slice(0, 80) + (av.texto.length > 80 ? '…' : '') + '» hasta el ' + fecha(av.hasta), 'web', 'aj-aviso'] : null,
    aj.silencio ? ['Horario de silencio', 'el bot en vivo calla de ' + aj.silencio.desde + ' a ' + aj.silencio.hasta, 'web', 'aj-silencio'] : null,
    aj.multiplicadores && aj.multiplicadores.semana === m.id ? ['El multiplicador de esta semana', 'va a mano, no es el del sorteo', 'servidores', 'sv-cada'] : null,
    aj.campana_pausada ? ['La campana', 'está en pausa: no sale ningún aviso', 'web', 'aj-campana'] : null,
  ].filter(Boolean);
}

// ── 📥 LA BANDEJA (25/10/2026). Dlx, al Dashboard por áreas: «está bien que cambiaste el layout, pero me refería a que
// remakees todo… el diseño me gusta pero faltan las funciones». Las cinco colas eran cinco listas largas una abajo de la
// otra, cada una con sus botones a su manera. Ahora es UNA bandeja, como en la maqueta: a la izquierda todo lo que
// espera, con filtros y buscar; a la derecha el detalle grande y sus botones. Al decidir pasa solo al siguiente.
// ⌨️ En la compu: J y K para moverse, A aprobar y R rechazar (imágenes y videos), / para buscar
// Lo que ya revisó el filtro automático y lo que se resolvió solo quedan abajo, plegado
const TIPO_B = {
  quien: ['¿QUIÉN ES QUIÉN?', 'urg'], llave: ['REPORTE DE LA GENTE', 'urg'], imagen: ['IMAGEN', 'ojo'], video: ['VIDEO', 'ojo'], pedido: ['PEDIDO', 'ojo'],
};
const SUB_A_FILTRO = { quien: 'quien', llaves: 'llave', imagenes: 'imagen', videos: 'video', pedidos: 'pedido' };
const FILTROS_B = [['', 'Todo'], ['llave', 'Reportes'], ['quien', '¿Quién es quién?'], ['imagen', 'Imágenes'], ['video', 'Videos'], ['pedido', 'Pedidos']];
const linea1 = (s) => String(s || '').split('\n').map((x) => x.trim()).find(Boolean) || '';

// todo lo que espera algo de ti, de las cinco colas, en una sola lista: lo urgente primero y, adentro, lo más nuevo
// 🔎 UNA LLAVE MAL LEÍDA ES UN CASO (la maqueta, la #562 de LKR): si a un evento le faltan más de dos ganadores en la
// final, el bot leyó la llave mal —todas sus batallas quedaron en «Final»— y no son N preguntas. `sueltas`: los eventos
// que Dlx pidió contestar de a una igual
const enFinal = (p) => /\ben final\?$/i.test(linea1(p.que));
function itemsBandeja(d, ver, sueltas) {
  const xs = [];
  const dec = d.decidir || {}, rs = dec.respuestas || {};
  const abiertas = ver.quien ? (dec.preguntas || []).filter((p) => !rs[p.id]) : [];
  const fin = {};
  for (const p of abiertas) if (p.tipo === 'Batalla sin ganador' && enFinal(p)) (fin[p.sec] = fin[p.sec] || []).push(p);
  const mal = new Set(Object.keys(fin).filter((s) => fin[s].length > 2 && !(sueltas && sueltas.has(s))));
  for (const s of mal) {
    xs.push({ k: 'm' + s.replace(/[^0-9A-Za-z]/g, '').slice(0, 60), tipo: 'quien', mal: true, t: msDe(dec.t), pts: 0, ps: fin[s],
      titulo: 'La llave se leyó mal: ' + fin[s].length + ' batallas en «Final»', sub: 'Una llave, no ' + fin[s].length + ' preguntas',
      p: { id: 'm', tipo: 'Llave mal leída', sec: s, que: '', opciones: [], efectos: {}, igual: false, vence: 0, link: fin[s][0].link || '' } });
  }
  for (const p of abiertas) {
    if (!(mal.has(p.sec) && p.tipo === 'Batalla sin ganador' && enFinal(p))) {
      xs.push({ k: 'q' + p.id, tipo: 'quien', t: msDe(dec.t), titulo: linea1(p.que), sub: p.tipo, p, pts: impacto(p) });
    }
  }
  if (ver.llave) for (const r of d.reportes || []) if (r.estado === '' || r.estado === 'no_pude') {
    const llave = etiquetaRep(r);
    xs.push({ k: 'r' + r.id, tipo: 'llave', t: msDe(r.t), titulo: llave + ' · ' + (QUE_REP[r.que] || r.que), sub: r.texto || (r.de ? 'lo mandó ' + r.de : ''), r });
  }
  if (ver.imagen) {
    for (const f of d.fondos || []) xs.push({ k: 'f' + f.quien, tipo: 'imagen', t: msDe(f.t), titulo: 'Fondo de ' + (f.k || 'una cuenta'), sub: 'el filtro no estuvo seguro', img: { cual: 'fondo', f } });
    for (const f of d.fotos_carta || []) xs.push({ k: 'p' + f.quien, tipo: 'imagen', t: msDe(f.t), titulo: 'Foto de tarjeta de ' + (f.k || 'una cuenta'), sub: 'para ' + (f.cartas || []).join(', '), img: { cual: 'foto', f } });
    for (const x of (d.crews_logos || {}).pend || []) xs.push({ k: 'l' + x.id, tipo: 'imagen', t: msDe(x.t), titulo: 'Logo de la crew ' + x.nombre, sub: 'el filtro no estuvo seguro', img: { cual: 'logo', x } });
  }
  if (ver.video) for (const v of d.videos || []) xs.push({ k: 'v' + v[0], tipo: 'video', t: 0, titulo: v[2] || v[3], sub: 'lo reclama ' + limpio(v[1]) + ' · ' + v[4], v });
  if (ver.pedido) for (const p of d.pedidos || []) if (p.estado === '') xs.push({ k: 'd' + p.id, tipo: 'pedido', t: msDe(p.t), titulo: PED_TIPO[p.tipo] || p.tipo, sub: p.k ? 'de ' + p.k : '', ped: p });
  // 📣 los reportes de la gente arriba de todo (20/11/2026); después las dudas de ✅ Decidir; después lo que no apura
  const urg = (x) => (x.tipo === 'llave' ? 0 : TIPO_B[x.tipo][1] === 'urg' ? 1 : 2);
  // 🧮 las de ✅ Decidir, por evento: primero el evento que más puntos mueve, y adentro la que más mueve (11/11/2026)
  const evMax = {};
  for (const x of xs) if (x.tipo === 'quien') evMax[x.p.sec] = Math.max(evMax[x.p.sec] || 0, x.pts || 0);
  return xs.sort((a, b) => urg(a) - urg(b) || (a.tipo === 'quien' && b.tipo === 'quien'
    ? (evMax[b.p.sec] || 0) - (evMax[a.p.sec] || 0) || String(a.p.sec || '').localeCompare(String(b.p.sec || '')) || (b.pts || 0) - (a.pts || 0)
    : b.t - a.t));
}

// 🖼️ una imagen para revisar: aprobar, o no con su motivo (el mismo pedido que hacían las tres cajas de antes)
function DetalleImagen({ it, alCambiar, motivo, setMotivo }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const { cual } = it.img;
  const decidir = async (si) => {
    setOcup(true); setMsg('');
    try {
      let r, j;
      if (cual === 'logo') {
        const x = it.img.x;
        r = await fetch('/api/avisos/dueno/crew', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ que: 'logo', crew: x.id, url: x.url, si, motivo: si ? '' : motivo }) });
        j = await r.json().catch(() => ({}));
        if (j.error === 'cambio') throw new Error('el logo cambió mientras lo mirabas: recarga');
        if (!r.ok || j.error) throw new Error(j.error || String(r.status));
        alCambiar({ crews_logos: { pend: [], vistos: [] }, _sacarLogo: x.id });
      } else {
        const f = it.img.f;
        r = await fetch(cual === 'foto' ? '/api/avisos/dueno/foto-carta' : '/api/avisos/dueno/fondo', { method: 'POST', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quien: f.quien, si, motivo: si ? '' : motivo }) });
        j = await r.json().catch(() => ({}));
        if (!r.ok || j.error) throw new Error(j.error || String(r.status));
        const o = {};
        if (j.fondos) o.fondos = j.fondos;
        if (j.fotos_carta) o.fotos_carta = j.fotos_carta;
        if (j.filtro) o.filtro = j.filtro;
        alCambiar(o);
      }
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  const f = it.img.f, x = it.img.x;
  return (
    <>
      {cual === 'logo' ? <img className="dz-img logo" src={x.url} alt={'El logo de ' + x.nombre} />
        : <div className={'dz-img ' + cual} style={{ backgroundImage: (cual === 'foto' ? urlFoto(f.pend) : urlFondo(f.pend)) || 'none' }} role="img" aria-label="La imagen que subió" />}
      <p className="dz-dt-tx">No se ve en la página hasta que la apruebes. Si no, a quien la subió le llega a su campana con el motivo.
        {f && f.k ? <> · <a href={'#/r/' + f.k}>su perfil</a></> : x ? <> · <a href={'#/crew/' + encodeURIComponent(x.id)}>la crew</a></> : null}</p>
      <div className="dz-acc">
        <button type="button" className="btn verde" disabled={ocup} onClick={() => decidir(true)}>Aprobar <kbd>A</kbd></button>
        <select className="db-sel db-sel-corto" value={motivo} aria-label="El motivo si no" onChange={(e) => setMotivo(e.target.value)}>
          {MOTIVOS_FONDO.map((m) => <option key={m}>{m}</option>)}</select>
        <button type="button" className="btn borde2" disabled={ocup} onClick={() => decidir(false)}>No <kbd>R</kbd></button>
      </div>
      {msg ? <p className="dz-dt-msg" role="status">{msg}</p> : null}
    </>
  );
}

// 🎬 un video que alguien reclama
function DetalleVideo({ it, alCambiar }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const [id, raw, tit, url, motivo, resp] = it.v;
  const decidir = async (si) => {
    setOcup(true); setMsg('');
    try {
      const r = await fetch('/api/avisos/dueno/video', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, si }) });
      if (!r.ok) throw new Error(String(r.status));
      alCambiar({ _sacarVideo: id });
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  return (
    <>
      <p className="dz-dt-tx"><b>{limpio(raw)}</b> dice que este video es suyo. No entró solo porque: <b>{motivo}</b>.</p>
      <a className="dz-video" href={url} target="_blank" rel="noopener noreferrer"><Ico n="flecha" t={14} /> {tit || url}</a>
      {resp ? <p className="dz-dt-tx">Dice que aparece como <b>«{limpio(resp.nombre)}»</b>, en el <b>{resp.minuto}</b>. Cómo reconocerlo: {limpio(resp.como)}</p> : null}
      <div className="dz-acc">
        <button type="button" className="btn verde" disabled={ocup} onClick={() => decidir(true)}>Es suyo <kbd>A</kbd></button>
        <button type="button" className="btn borde2" disabled={ocup} onClick={() => decidir(false)}>No es suyo <kbd>R</kbd></button>
      </div>
      <p className="dz-dt-tx">Lo aplica el ciclo en su próxima vuelta.</p>
      {msg ? <p className="dz-dt-msg" role="status">{msg}</p> : null}
    </>
  );
}

// 🔎 POR QUÉ SE CIERRA UN REPORTE (25/10/2026, el research: el motivo de cierre de Battlefy). La misma lista que
// `CAUSAS_REPORTE` de bot/avisos.js: cerrar pide una, y el Dashboard cuenta cuál falla más (`CausasLinea`)
// el cuarto, en singular: «1 nombre mal leído», no «1 nombres mal leídos» (12/11/2026)
const CAUSAS = [['nombre_bot', 'El bot leyó mal un nombre', 'nombres mal leídos', 'nombre mal leído'],
  ['llave_bot', 'El bot leyó mal la llave', 'llaves mal leídas', 'llave mal leída'],
  ['organizador', 'Se equivocó el organizador', 'del organizador', 'del organizador'], ['no_corresponde', 'Estaba bien', 'estaban bien', 'estaba bien'],
  ['prueba', 'Era una prueba', 'pruebas', 'prueba']];
// «qué falla más», en una línea: los últimos 30 días, de más a menos (sin quién: sólo cuántos)
function CausasLinea({ cs }) {
  const xs = (cs || []).filter((c) => c.n30 && c.causa !== 'prueba').sort((a, b) => b.n30 - a.n30);
  if (!xs.length) return null;
  return (
    <p className="dz-causas"><b>Qué falló en 30 días:</b> {xs.map((c, i) => (
      <span key={c.causa} className={i ? '' : 'top'}>{num(c.n30)} {(CAUSAS.find((x) => x[0] === c.causa) || [0, 0, c.causa, c.causa])[c.n30 === 1 ? 3 : 2]}</span>
    ))}</p>
  );
}

// 📣 un error en una llave: lo que dice, la evidencia del bot y corregir ahí mismo
function DetalleLlave({ it, liga, d, alCambiar, corrige }) {
  const r = it.r;
  const [abierto, setAbierto] = useState(false);
  const [seguro, setSeguro] = useState(false);
  const [msg, setMsg] = useState('');
  const [ocup, setOcup] = useState(false);
  const setLista = (l) => alCambiar({ reportes: l });
  // cerrar sin corregir: con su causa, que vuelve al conteo
  const cerrar = async (accion, causa, n) => {
    setOcup(true); setMsg('');
    try {
      const rq = await fetch('/api/avisos/dueno/reporte', { method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id, accion, causa, n }) });
      const j = await rq.json().catch(() => ({}));
      if (!rq.ok || j.error) throw new Error(rq.status === 401 ? 'la sesión venció: entra de nuevo' : j.error || String(rq.status));
      alCambiar(Object.assign({ reportes: j.reportes || [] }, j.reportes_causas ? { reportes_causas: j.reportes_causas } : {}));
    } catch (e) { setMsg('No se pudo: ' + e.message); setOcup(false); }
  };
  const hermanos = (d.reportes || []).filter((x) => x.id !== r.id && x.llave === r.llave && (x.estado === '' || x.estado === 'no_pude'));
  const enlace = /^\d+$/.test(r.llave) ? '#/llave/' + r.llave : String(r.llave).startsWith('liga:') ? '#/ligas/' + encodeURIComponent(String(r.llave).slice(5))
    : String(r.llave).startsWith('perfil:') ? '#/r/' + encodeURIComponent(String(r.llave).slice(7)) : '';
  return (
    <>
      {r.texto ? <blockquote className="dz-cita">«{r.texto}»</blockquote> : null}
      <p className="dz-dt-tx">{r.batalla ? r.batalla + ' · ' : ''}{r.evid && r.evid.quien ? 'lo mandó ' + r.evid.quien : r.de ? 'lo mandó ' + r.de : 'quién lo mandó: lo dice el ciclo en su próxima vuelta'}
        {r.de ? <> · <BotonFicha k={r.de} n={r.de} /></> : null}{enlace ? <> · <a href={enlace}>abrirla</a></> : null}{r.estado === 'no_pude' && r.resultado ? <> · <b className="db-mal">no se pudo: {r.resultado}</b></> : null}</p>
      {r.evid && (r.evid.lineas || []).length > 1 ? <Evidencia r={r} alListo={setLista} corrige={corrige} /> : null}
      {abierto ? (String(r.llave).startsWith('liga:') ? <CorregirLiga r={r} liga={liga} alListo={setLista} />
        : <Corregir r={r} liga={liga} alListo={setLista} hermanos={hermanos} />) : null}
      {/* 🚫 la llave entera no cuenta (05/11/2026, Dlx: «como decido eso yo?»): «Corregir» sólo cambia un nombre o un ganador */}
      {seguro ? <p className="dz-dt-tx">La llave sale del ranking para todos en la próxima vuelta del ciclo, y a quien la reportó le llega el aviso. ¿Seguro?</p> : null}
      <div className="dz-acc">
        {seguro ? <>
          <button type="button" className="btn verde" disabled={ocup} onClick={() => cerrar('no_cuenta', 'organizador', r.llave)}>Sí, no cuenta</button>
          <button type="button" className="btn borde2" disabled={ocup} onClick={() => setSeguro(false)}>Cancelar</button>
        </> : <>
          {corrige && !abierto && (/^\d+$/.test(r.llave) || String(r.llave).startsWith('liga:')) ? <button type="button" className="btn verde" onClick={() => setAbierto(true)}>Corregir</button> : null}
          {corrige && !abierto && /^\d+$/.test(r.llave) ? <button type="button" className="btn borde2" onClick={() => setSeguro(true)}>No cuenta</button> : null}
          {/* 💬 un perfil reportado: su frase se quita desde acá (18/11/2026). «Quitar su frase» vivía sólo en `Reportes`, que
              la Bandeja dejó sin montar el 25/10, así que nunca se vio. Pide `reportes`, el mismo permiso que la ruta */}
          {corrige && String(r.llave).startsWith('perfil:') ? <QuitarFrase k={String(r.llave).slice(7)} /> : null}
        </>}
      </div>
      {/* cerrarlo sin corregir dice por qué: es lo que arma «qué falló» */}
      <div className="dz-cerrar" role="group" aria-label="Cerrarlo sin corregir: por qué">
        <span>Cerrarlo sin corregir, porque…</span>
        {CAUSAS.map(([c, t]) => (
          <button key={c} type="button" className="btn borde2 chico" disabled={ocup} onClick={() => cerrar(c === 'prueba' ? 'prueba' : 'listo', c)}>{t}</button>
        ))}
      </div>
      {msg ? <p className="dz-dt-msg" role="status">{msg}</p> : null}
    </>
  );
}

// 🙋 un pedido: lo que pide, lo que el bot vio de las dos cuentas y Sí / No (el mismo pedido que la lista de antes)
function DetallePedido({ p, liga, alCambiar }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const f = p.k ? liga.T[p.k] : null;
  const pr = p.prueba || {};
  const resolver = (si) => {
    setOcup(true); setMsg('');
    fetch('/api/avisos/dueno-pedido', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, si }) })
      .then(async (r) => ({ r, j: await r.json().catch(() => ({})) }))
      .then(({ r, j }) => { if (r.ok && j.pedidos) alCambiar(j.pedidos); else { setOcup(false); setMsg(j.error === 'no' ? 'No tienes permiso.' : 'No pude: ' + (j.error || r.status)); } })
      .catch(() => { setOcup(false); setMsg('No pude: la red.'); });
  };
  const filas = [
    ['Quién', f ? <Fragment key="q"><a href={'#/r/' + p.k}>{limpio(f.n)}</a> <BotonFicha k={p.k} n={f.n} /></Fragment> : p.k ? <Fragment key="q">{p.k} <BotonFicha k={p.k} /></Fragment> : '—'],
    p.cc ? ['País que pide', p.cc.toUpperCase()] : null,
    p.tipo === 'cuenta' ? ['La cuenta que pide', <Fragment key="c">{pr.usuario ? '@' + pr.usuario : 'sin nombre'}{pr.creada ? ' · creada el ' + pr.creada : ''} · {pr.en_dra === false ? 'no está en DRA'
      : 'en DRA' + (pr.apodo_dra ? ' como «' + pr.apodo_dra + '»' : '') + (pr.miembro ? ', con el Miembro' : ', sin el Miembro')}</Fragment>] : null,
    p.vid ? ['El video', <a key="v" href={'https://youtu.be/' + p.vid} target="_blank" rel="noopener noreferrer">abrirlo ↗</a>] : null,
  ].filter(Boolean);
  return (
    <>
      {p.texto ? <blockquote className="dz-cita">«{p.texto}»</blockquote> : null}
      <dl className="dz-dl">{filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {p.tipo === 'cuenta' ? <Vieja v={pr.vieja} /> : null}
      <div className="dz-acc">
        <button type="button" className="btn verde" disabled={ocup} onClick={() => resolver(true)}>{PED_SI[p.tipo] || 'Sí'}</button>
        <button type="button" className="btn borde2" disabled={ocup} onClick={() => resolver(false)}>No</button>
      </div>
      <p className="dz-dt-tx">{p.tipo === 'identidad' ? 'Éste lo arreglas tú: «Ya lo arreglé» es para cuando está hecho.' : p.tipo === 'video' ? 'El video se saca solo.' : 'Lo aplica el ciclo en su próxima vuelta.'}</p>
      {msg ? <p className="dz-dt-msg" role="alert">{msg}</p> : null}
    </>
  );
}

// ✋ «LO TOMO» Y LAS NOTAS INTERNAS (11/11/2026, la maqueta: «dos del staff no hacen el mismo»). Lo guarda el objeto
// (`duenoCaso()`); a diferencia de «lo está viendo», no vence a los 10 minutos. La nota la ve el staff, nunca la persona
function Caso({ k, casos, yo, cambiarD }) {
  const c = (casos || {})[k] || {};
  const [nota, setNota] = useState('');
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const pedir = (cuerpo) => {
    setOcup(true); setMsg('');
    fetch('/api/avisos/dueno/caso', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.assign({ k }, cuerpo)) })
      .then(async (rq) => ({ rq, j: await rq.json().catch(() => ({})) }))
      .then(({ rq, j }) => { setOcup(false); if (rq.ok && j.casos) { cambiarD({ casos: j.casos }); if (cuerpo.nota) setNota(''); } else setMsg('No se pudo: ' + (j.error || rq.status)); })
      .catch(() => { setOcup(false); setMsg('No se pudo: la red.'); });
  };
  const mio = !!c.tomo && !!yo && c.tomo.por === yo;
  return (
    <div className="dz-caso">
      <div className="dz-caso-t">
        <span>{c.tomo ? <>✋ Lo tomó <b>{mio ? 'tú' : c.tomo.por}</b> {hace(c.tomo.t)}</> : 'Nadie lo tomó todavía.'}</span>
        <button type="button" className="btn borde2 chico" disabled={ocup} onClick={() => pedir({ tomo: !mio })}>{mio ? 'Soltarlo' : c.tomo ? 'Tomarlo yo' : 'Lo tomo'}</button>
      </div>
      {(c.notas || []).map((n, i) => <p key={i} className="dz-nota"><b>{n.por}</b> <small>{hace(n.t)}</small> {n.txt}</p>)}
      <form className="dz-nota-f" onSubmit={(e) => { e.preventDefault(); if (nota.trim()) pedir({ nota }); }}>
        <input type="text" value={nota} maxLength={300} disabled={ocup} aria-label="Nota interna" placeholder="Nota interna: la ve el staff, nunca la persona"
          onChange={(e) => setNota(e.target.value)} />
        <button type="submit" className="btn borde2 chico" disabled={ocup || !nota.trim()}>Anotar</button>
      </form>
      {msg ? <small role="status">{msg}</small> : null}
    </div>
  );
}

// 🏆 EL CUADRO DEL EVENTO (la opción B de la maqueta, para alternar con la A: «muéstrame cómo se vería B también»): la
// llave entera de ese evento, y cada batalla que espera respuesta se toca para contestarla ahí mismo
const ladosDe = (p) => {
  const l = String((p && p.que) || '').split('\n').find((x) => x.includes('🆚'));
  return l ? l.split('🆚').map(sinB).filter(Boolean).sort() : [];
};
function CuadroEvento({ p, hermanas, elegir }) {
  const n = (String(p.sec || '').match(/#(\d+)/) || [])[1] || '';
  const [ll, setLl] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (n) pedirLlaves().then((t) => { if (vivo && t) setLl(t[n] || null); });
    return () => { vivo = false; };
  }, [n]);
  const rondas = ll && (ll.rondas || []).length ? ll.rondas : rondasDePistas(hermanas.map((h) => h.p));
  const porLados = new Map(hermanas.map((h) => [ladosDe(h.p).join('|'), h]));
  const esta = ladosDe(p).join('|');
  if (!rondas.length) return <p className="db-tx">Esta llave todavía no tiene cuadro: contéstala en «Una por vez».</p>;
  return (
    <div className="dz-cuadroev" aria-label={'El cuadro de ' + (p.sec || 'este evento')}>{rondas.map((r) => (
      <div key={r.r} className="dz-cu-col"><b>{r.r}</b>{(r.b || []).map((b, i) => {
        const key = (b[0] || []).map(sinB).sort().join('|');
        const h = !b[1] ? porLados.get(key) : null;
        const lados = (b[0] || []).map((x, j) => <span key={j} className={b[1] && sinB(x) === sinB(b[1]) ? 'g' : ''}>{limpio(x)}</span>);
        return h ? (
          <button key={i} type="button" className={'dz-cu-b duda' + (key === esta ? ' on' : '')} onClick={() => elegir(h)} aria-current={key === esta ? 'true' : undefined}>
            {lados}<em>{key === esta ? 'contestando' : 'contestar'}</em></button>
        ) : <div key={i} className={'dz-cu-b' + (b[1] ? '' : ' sin')}>{lados}{!b[1] ? <em>sin ganador</em> : null}</div>;
      })}</div>
    ))}</div>
  );
}

// 🔎 la llave que el bot leyó mal: el cuadro como quedó, «No cuenta» o contestarlas de a una
function DetalleMal({ it, puede, cambiarD, soltar }) {
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState('');
  const sec = String(it.p.sec || '');
  const clave = sec.split(' · ').slice(0, 3).join(' · ');
  const n = (sec.match(/#(\d+)/) || [])[1] || '';
  const noCuenta = async () => {
    setOcup(true); setMsg('');
    try {
      cambiarD({ llaves_cuenta: await pedirLlaveCuenta({ clave, n, cuenta: false, motivo: 'la llave se leyó mal: ' + it.ps.length + ' batallas en «Final»' }) });
      setMsg('Listo: sale del ranking en la próxima corrida del ciclo. Se vuelve a contar en «Llaves y fondos».');
    } catch (e) { setMsg('No se pudo: ' + e.message); }
    setOcup(false);
  };
  return (
    <>
      <p className="dz-dt-tx">El bot dejó las <b>{it.ps.length} batallas</b> de esta llave en «Final», así que a todas les «falta» ganador. No es que el
        organizador no las marcó: es la lectura. Por eso a las 48 h no se cierra ni se descarta sola.</p>
      <CuadroEvento p={it.p} hermanas={[]} elegir={() => {}} />
      <div className="dz-acc">
        {puede ? <button type="button" className="btn borde2" disabled={ocup} onClick={noCuenta}>No cuenta</button> : null}
        <button type="button" className="btn borde2" onClick={soltar}>Contestarlas de a una</button>
        {it.p.link ? <a className="dz-lnk" href={it.p.link} target="_blank" rel="noopener noreferrer">Abrirla en Discord ↗</a> : null}
      </div>
      {msg ? <p className="dz-dt-msg" role="status">{msg}</p> : null}
    </>
  );
}

// 🗓️ LOS VIEJOS, EN LOTE (la maqueta: «lo de hace más de 14 días se cierra de una, con su causa»). La fecha del evento sale
// de su sección («NOMBRE · SV · 06/10»); se contestan por tipo con el lote de siempre, con la causa ya escrita en la nota
const VIEJO_D = 14;
function diasDe(sec) {
  const m = /·\s*(\d{1,2})\/(\d{1,2})(?=\s*(?:·|$))/.exec(String(sec || ''));
  if (!m) return null;
  const hoy = new Date();
  let f = new Date(hoy.getFullYear(), Number(m[2]) - 1, Number(m[1]));
  if (f - hoy > 31 * 864e5) f = new Date(hoy.getFullYear() - 1, Number(m[2]) - 1, Number(m[1]));
  return Math.floor((hoy - f) / 864e5);
}
function ViejoGrupo({ t, ps, alListo }) {
  const [sel, setSel] = useState(() => new Set(ps.map((p) => p.id)));
  const cambiar = (id) => setSel((s) => { const o = new Set(s); if (o.has(id)) o.delete(id); else o.add(id); return o; });
  return (
    <section className="dz-vj" aria-label={t}>
      <h4>{t} · {ps.length}</h4>
      <details><summary>Ver cuáles</summary>
        <ul>{ps.map((p) => (
          <li key={p.id}><label><input type="checkbox" checked={sel.has(p.id)} onChange={() => cambiar(p.id)} /> {linea1(p.que)} <small>{p.sec}</small></label></li>
        ))}</ul>
      </details>
      <Lote ps={ps} sel={sel} setSel={setSel} alListo={alListo} visibles={ps} notaInicial={'Cerrado en lote: evento de hace más de ' + VIEJO_D + ' días'} />
    </section>
  );
}
function Viejos({ xs, alListo }) {
  const grupos = {};
  for (const x of xs) (grupos[x.p.tipo] = grupos[x.p.tipo] || []).push(x.p);
  return (
    <div className="dz-viejos">
      <p className="dz-dt-tx">Son <b>{xs.length}</b> dudas de eventos de hace más de {VIEJO_D} días. Se contestan por tipo, todas juntas, con la causa
        en la nota. Hasta que el ciclo las aplique se pueden deshacer de a una en «Ver todas las preguntas juntas».</p>
      {Object.entries(grupos).map(([t, ps]) => <ViejoGrupo key={t} t={t} ps={ps} alListo={alListo} />)}
    </div>
  );
}

// ❓ una pregunta de ✅ Decidir, con la llave al lado (la A) o con el cuadro del evento (la B)
const CUADRO = 'lg:db-cuadro';
function DetalleQuien({ it, d, alCambiar, hermanas, elegir, cambiarD }) {
  const p = it.p;
  const [cuadro, setCuadro0] = useState(() => { try { return localStorage.getItem(CUADRO) === '1'; } catch (e) { return false; } });
  const setCuadro = (v) => { setCuadro0(v); try { localStorage.setItem(CUADRO, v ? '1' : '0'); } catch (e) { /* vuelve a la A */ } };
  const bat = ladosDe(p).length >= 2;
  const enCuadro = cuadro && bat;
  return (
    <>
      {bat ? (
        <div className="dz-vista" role="group" aria-label="Cómo verla">
          <button type="button" className={'dz-sub' + (!enCuadro ? ' on' : '')} aria-pressed={!enCuadro} onClick={() => setCuadro(false)}>Una por vez</button>
          <button type="button" className={'dz-sub' + (enCuadro ? ' on' : '')} aria-pressed={enCuadro} onClick={() => setCuadro(true)}>
            Cuadro del evento{(hermanas || []).length > 1 ? <i>{hermanas.length}</i> : null}</button>
        </div>
      ) : null}
      <div className={'db-dec-cuerpo dz-quien' + (enCuadro ? ' dz-con-cuadro' : '')}>
        {enCuadro ? <CuadroEvento p={p} hermanas={hermanas || [it]} elegir={elegir} /> : null}
        <div className="dz-q-col">
          <ul className="dz-solo"><Pregunta p={p} r={null} lista={(d.decidir || {}).lista} alListo={(y) => alCambiar({ decidir: y })} /></ul>
          <Caso k={kViendo(it.k)} casos={d.casos} yo={d.yo} cambiarD={cambiarD} />
        </div>
        {!enCuadro ? <LlaveAlCostado s={{ sec: p.sec, ps: [p] }} /> : null}
      </div>
    </>
  );
}

// 💤 POSPONER «HASTA QUE CAMBIE» (25/10/2026, el research: Linear y Sentry). Un caso pospuesto se va de la lista hasta
// que cambia lo que dice (su firma: la llave que vuelve con un nombre nuevo, un fondo nuevo, otra respuesta) o hasta 24
// horas, lo que pase primero. Es de cada uno: vive en este navegador (`lg:db-pospuesto`), y nunca borra nada
const POSP = 'lg:db-pospuesto';
const firmaDe = (x) => JSON.stringify([x.titulo, x.sub, x.r && [x.r.estado, x.r.texto, x.r.evid && (x.r.evid.lineas || []).length],
  x.p && x.p.opciones, x.img && (x.img.f ? x.img.f.pend : x.img.x && x.img.x.url), x.ped && x.ped.estado]);
const leerPosp = () => { try { return JSON.parse(localStorage.getItem(POSP) || '{}') || {}; } catch (e) { return {}; } };
// la clave de un caso para «lo está viendo»: la misma de la bandeja, sin lo que el Worker no guarda
const kViendo = (k) => String(k).replace(/[^0-9A-Za-z:_.-]/g, '_').slice(0, 80);
// ⏳ la edad de un caso: un día ya es para mirar, tres es viejo
const edadDe = (t) => (!t ? '' : Date.now() - t > 3 * 864e5 ? 'mal' : Date.now() - t > 864e5 ? 'ojo' : '');

function Bandeja({ d, liga, ve, cambiarD, sub }) {
  const ver = { quien: ve('decidir'), llave: ve('reportes') || ve('reportes_cerrar'), imagen: ve('fondos'), video: ve('videos') || ve('fondos'), pedido: ve('reportes_cerrar') };
  // el cuadrado del Resumen que se tocó abre la bandeja con su filtro puesto
  const [filtro, setFiltro] = useState(SUB_A_FILTRO[sub] || '');
  useEffect(() => { if (sub) { setFiltro(SUB_A_FILTRO[sub] || ''); setSel(''); } }, [sub]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS_FONDO[0]);
  const [listaDec, setListaDec] = useState(false);
  const det = useRef(null), buscar = useRef(null);
  // lo sacado a mano (un logo, un video): el servidor no devuelve la lista entera de esos
  const [fuera, setFuera] = useState({});
  const [posp, setPosp0] = useState(leerPosp);
  const setPosp = (o) => { setPosp0(o); try { localStorage.setItem(POSP, JSON.stringify(o)); } catch (e) { /* vuelve al recargar */ } };
  // 🔎 los eventos con la llave mal leída que se pidieron contestar de a una (en este navegador, hasta recargar)
  const [sueltas, setSueltas] = useState(() => new Set());
  const todos0 = itemsBandeja(d, ver, sueltas).filter((x) => !fuera[x.k]);
  // lo pospuesto sigue pospuesto mientras no cambie y no pasen 24 h
  const dormido = (x) => { const p0 = posp[x.k]; return !!p0 && p0.f === firmaDe(x) && Date.now() < p0.hasta; };
  const todos = todos0.filter((x) => !dormido(x));
  const pospuestos = todos0.filter(dormido);
  const cuenta = {};
  for (const x of todos) cuenta[x.tipo] = (cuenta[x.tipo] || 0) + 1;
  // ✋ «Mis casos»: los que tomé yo (`duenoCaso()` del objeto)
  const casos = d.casos || {};
  const tomo = (x) => (casos[kViendo(x.k)] || {}).tomo || null;
  const mios = todos.filter((x) => d.yo && (tomo(x) || {}).por === d.yo);
  // 🗓️ los viejos: dudas de eventos de hace más de `VIEJO_D` días, que se contestan juntas, por tipo
  const viejos = todos.filter((x) => x.tipo === 'quien' && !x.mal && (diasDe(x.p.sec) || 0) > VIEJO_D);
  const xs = (filtro === 'posp' ? pospuestos : filtro === 'mios' ? mios : todos)
    .filter((x) => (!filtro || filtro === 'posp' || filtro === 'mios' || x.tipo === filtro) && contiene([x.titulo, x.sub, x.p && x.p.sec], q));
  const verViejos = filtro === 'viejos';
  const viejo = todos.reduce((m, x) => (x.t && (!m || x.t < m) ? x.t : m), 0);
  const i0 = Math.max(0, xs.findIndex((x) => x.k === sel));
  const it = xs[i0] || null;
  // 👀 «LO ESTÁ VIENDO» (25/10/2026, el research: Battlefy y Help Scout): el caso que tienes abierto se anota en el
  // objeto, y cada 30 s se lee lo que tienen abierto los demás. Un caso por persona; vence a los 10 minutos
  const [viendo, setViendo] = useState([]);
  const kAbierto = it ? kViendo(it.k) : '';
  useEffect(() => {
    let vivo = true;
    const avisar = () => fetch('/api/avisos/dueno/viendo', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ k: kAbierto }) }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j && j.viendo) setViendo(j.viendo); }).catch(() => {});
    avisar();
    const id = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') avisar(); }, 30000);
    return () => { vivo = false; clearInterval(id); };
  }, [kAbierto]);
  const quienVe = (x) => (viendo.find((v) => v.k === kViendo(x.k)) || {}).por;
  const posponer = (x) => {
    const sig = xs[i0 + 1] || xs[i0 - 1];
    setPosp(Object.assign({}, Object.fromEntries(Object.entries(posp).filter(([, v]) => Date.now() < v.hasta)), { [x.k]: { f: firmaDe(x), hasta: Date.now() + 864e5 } }));
    setSel(sig ? sig.k : '');
  };
  const despertar = (x) => { const o = Object.assign({}, posp); delete o[x.k]; setPosp(o); };
  // decidir uno: vuelve lo nuevo al panel, y el siguiente queda elegido (el que ocupa su lugar)
  const alCambiar = (o) => {
    const sig = xs[i0 + 1] || xs[i0 - 1];
    if (o._sacarLogo) setFuera((f) => Object.assign({}, f, { ['l' + o._sacarLogo]: 1 }));
    if (o._sacarVideo != null) setFuera((f) => Object.assign({}, f, { ['v' + o._sacarVideo]: 1 }));
    const limpio0 = Object.assign({}, o); delete limpio0._sacarLogo; delete limpio0._sacarVideo; delete limpio0.crews_logos;
    // 🧮 y sale también de la lista del panel (18/11/2026): `fuera` es de la Bandeja y se pierde al cambiar de área, así
    // que el menú y el Resumen lo seguían contando y, volviendo antes del refresco, reaparecía para decidirlo otra vez.
    // El `crews_logos` vacío que manda DetalleImagen no se usa: vaciaría todos los pendientes (`vistos` se conserva)
    if (o._sacarLogo) limpio0.crews_logos = Object.assign({}, d.crews_logos, { pend: ((d.crews_logos || {}).pend || []).filter((y) => y.id !== o._sacarLogo) });
    if (o._sacarVideo != null) limpio0.videos = (d.videos || []).filter((v) => Number(v[0]) !== Number(o._sacarVideo));
    if (Object.keys(limpio0).length) cambiarD(limpio0);
    setSel(sig ? sig.k : '');
  };
  // ⌨️ J/K, A/R y /
  useEffect(() => {
    const f = (e) => {
      // 🌑 lo que se tocó, con composedPath (18/11/2026): el listener está en `window` y la página vive en el shadow root,
      // así que `e.target` era el host (un DIV) y escribir «rafa» en el buscador rechazaba y aprobaba imágenes. Y `key`
      // puede no venir (el autocompletado de Chrome manda keydown sin él)
      const t0 = e.composedPath ? e.composedPath()[0] : e.target;
      const tg = t0 && t0.tagName;
      if (e.ctrlKey || e.metaKey || e.altKey || tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || (t0 && t0.isContentEditable)) return;
      const k = String(e.key || '').toLowerCase();
      if (k === 'j' || k === 'k') { const n = xs[i0 + (k === 'j' ? 1 : -1)]; if (n) { e.preventDefault(); setSel(n.k); } }
      else if (k === '/') { e.preventDefault(); if (buscar.current) buscar.current.focus(); }
      else if (k === 'h' && it && filtro !== 'posp') { e.preventDefault(); posponer(it); }
      else if ((k === 'a' || k === 'r') && it && (it.tipo === 'imagen' || it.tipo === 'video')) {
        const b = det.current && det.current.querySelectorAll('.dz-acc .btn')[k === 'a' ? 0 : 1];
        if (b && !b.disabled) { e.preventDefault(); b.click(); }
      }
    };
    W.addEventListener && W.addEventListener('keydown', f);
    return () => { W.removeEventListener && W.removeEventListener('keydown', f); };
  });
  const elegir = (x) => {
    setSel(x.k);
    // en el teléfono el detalle va abajo: se baja hasta él
    if (W.innerWidth < 900 && det.current) setTimeout(() => det.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const vivos = (d.filtro && d.filtro.vivos) || [];
  const clv = (d.crews_logos || {}).vistos || [];
  return (
    <div className="dz-band">
      <div className="dz-band-f">
        <div className="dz-subs" role="tablist" aria-label="Qué mirar">{FILTROS_B.filter(([k]) => !k || ver[k]).map(([k, t]) => (
          <button key={k || 'todo'} type="button" role="tab" aria-selected={filtro === k} className={'dz-sub' + (filtro === k ? ' on' : '')}
            onClick={() => { setFiltro(k); setSel(''); setListaDec(false); }}>{t}{(k ? cuenta[k] : todos.length) ? <i>{k ? cuenta[k] : todos.length}</i> : null}</button>
        ))}{viejos.length ? <button type="button" role="tab" aria-selected={verViejos} className={'dz-sub' + (verViejos ? ' on' : '')}
          onClick={() => { setFiltro('viejos'); setSel(''); setListaDec(false); }}>🗓️ Viejos<i>{viejos.length}</i></button> : null}{mios.length ? <button type="button" role="tab" aria-selected={filtro === 'mios'} className={'dz-sub' + (filtro === 'mios' ? ' on' : '')}
          onClick={() => { setFiltro('mios'); setSel(''); setListaDec(false); }}>✋ Mis casos<i>{mios.length}</i></button> : null}{pospuestos.length ? <button type="button" role="tab" aria-selected={filtro === 'posp'} className={'dz-sub dz-sub-posp' + (filtro === 'posp' ? ' on' : '')}
          onClick={() => { setFiltro('posp'); setSel(''); setListaDec(false); }}>💤 Pospuestos<i>{pospuestos.length}</i></button> : null}</div>
        <label className="db-buscar dz-band-q"><Ico n="buscar" t={16} />
          <input ref={buscar} type="search" value={q} placeholder="Buscar un nombre o una llave ( / )" aria-label="Buscar en los pendientes" onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      {viejo || (d.reportes_causas || []).length ? (
        <div className="dz-band-meta">
          {viejo ? <p className={'dz-viejo ' + edadDe(viejo)}>El caso más viejo espera desde <b>{hace(viejo)}</b>.</p> : null}
          <CausasLinea cs={d.reportes_causas} />
        </div>
      ) : null}
      {filtro === 'quien' && listaDec ? (
        <><button type="button" className="dz-lnk" onClick={() => setListaDec(false)}>← Volver a la bandeja</button>
          <Decisiones dec={d.decidir} liga={liga} alCambiar={(y) => cambiarD({ decidir: y })} /></>
      ) : verViejos && viejos.length ? (
        <Viejos xs={viejos} alListo={(y) => cambiarD({ decidir: y })} />
      ) : verViejos ? (
        <div className="dz-vacio"><b>✓ Sin viejos</b><span>No queda ninguna duda de hace más de {VIEJO_D} días.</span></div>
      ) : !todos.length && filtro !== 'posp' ? (
        <div className="dz-vacio"><b>✓ Al día</b><span>No hay nada esperando una decisión tuya.</span></div>
      ) : (
        <div className="dz-band-g">
          <ol className="dz-band-l" aria-label="Lo que espera">{xs.map((x, i) => (
            <Fragment key={x.k}>
              {/* 🗂️ las de ✅ Decidir, agrupadas por evento (la maqueta, opción A) */}
              {x.tipo === 'quien' && (i === 0 || xs[i - 1].tipo !== 'quien' || xs[i - 1].p.sec !== x.p.sec)
                ? <li className="dz-ev-h">{x.p.sec || 'Sin evento'}</li> : null}
              <li><button type="button" className={'dz-it' + (it && x.k === it.k ? ' on' : '') + (x.tipo === 'quien' ? (x.mal ? ' malle' : x.pts ? ' mueve' : ' quieta') : '')}
                aria-current={it && x.k === it.k ? 'true' : undefined} onClick={() => elegir(x)}>
                {x.tipo !== 'quien' ? <span className={'dz-tipo ' + TIPO_B[x.tipo][1]}>{TIPO_B[x.tipo][0]}</span> : null}
                <b>{x.titulo}</b>
                {x.sub ? <small>{x.sub}</small> : null}
                {x.tipo === 'quien' && (x.pts || x.p.igual || x.p.vence || x.p.sug || tomo(x)) ? (
                  <span className="dz-chips">
                    {x.p.sug ? <em className="dz-ch v">💡 el bot sugiere</em> : null}
                    {x.pts ? <em className="dz-ch v">mueve {num(x.pts)}</em> : null}
                    {x.p.igual ? <em className="dz-ch">no mueve puntos</em> : null}
                    {x.p.vence ? <em className="dz-ch a">{x.p.vence > Date.now() ? 'se cierra en ' + enHoras(x.p.vence) : 'se cierra ya'}</em> : null}
                    {tomo(x) ? <em className="dz-ch t">✋ {tomo(x).por === d.yo ? 'tú' : tomo(x).por}</em> : null}
                  </span>
                ) : null}
                {x.t && x.tipo !== 'quien' ? <small className={'dz-it-t ' + edadDe(x.t)}>{hace(x.t)}{edadDe(x.t) === 'mal' ? ' · VIEJO' : ''}</small> : null}
                {quienVe(x) ? <small className="dz-it-ve">👀 {quienVe(x)} lo está viendo</small> : null}
              </button></li>
            </Fragment>
          ))}{!xs.length ? <li className="dz-it-nada">Nada con este filtro{q ? ' y «' + q + '»' : ''}.</li> : null}</ol>
          <article className="dz-det" ref={det} aria-live="polite">
            {it ? <>
              <span className={'dz-tipo ' + TIPO_B[it.tipo][1]}>{TIPO_B[it.tipo][0]} · {i0 + 1} DE {xs.length}</span>
              <h3 className="dz-det-t">{it.titulo}</h3>
              {quienVe(it) ? <p className="dz-ve">👀 <b>{quienVe(it)}</b> también lo tiene abierto: fíjate antes de decidir para no hacerlo dos veces.</p> : null}
              {it.tipo === 'quien' && it.mal ? <DetalleMal key={it.k} it={it} puede={ve('reportes')} cambiarD={cambiarD}
                soltar={() => { setSueltas((s) => new Set(s).add(it.p.sec)); setSel(''); }} /> : null}
              {it.tipo === 'quien' && !it.mal ? <DetalleQuien key={it.k} it={it} d={d} alCambiar={alCambiar} cambiarD={cambiarD} elegir={elegir}
                hermanas={xs.filter((x) => x.tipo === 'quien' && x.p.sec === it.p.sec)} /> : null}
              {it.tipo === 'llave' ? <DetalleLlave key={it.k} it={it} liga={liga} d={d} alCambiar={alCambiar} corrige={ve('reportes')} /> : null}
              {it.tipo === 'imagen' ? <DetalleImagen key={it.k} it={it} alCambiar={alCambiar} motivo={motivo} setMotivo={setMotivo} /> : null}
              {it.tipo === 'video' ? <DetalleVideo key={it.k} it={it} alCambiar={alCambiar} /> : null}
              {it.tipo === 'pedido' ? <DetallePedido key={it.k} p={it.ped} liga={liga} alCambiar={(y) => alCambiar({ pedidos: y })} /> : null}
              <div className="dz-acc dz-acc-pos">{filtro === 'posp'
                ? <button type="button" className="dz-lnk" onClick={() => despertar(it)}>Devolverlo a la lista</button>
                : <button type="button" className="dz-lnk" onClick={() => posponer(it)}>💤 Posponer hasta que cambie (o 24 h)</button>}</div>
              <p className="dz-teclas">J / K para moverte · A aprobar · R rechazar · H posponer · / buscar</p>
            </> : <p className="db-tx">Elige algo de la lista.</p>}
          </article>
        </div>
      )}
      {filtro === 'quien' && !listaDec && (d.decidir || {}).preguntas && d.decidir.preguntas.length ? (
        <button type="button" className="dz-lnk" onClick={() => setListaDec(true)}>Ver todas las preguntas juntas (con filtros y para contestar varias a la vez)</button>
      ) : null}
      {/* lo que ya pasó por el filtro automático o se resolvió solo: para quitar o deshacer, plegado */}
      {(vivos.length || clv.length || ((d.decidir || {}).solas || []).length) ? (
        <details className="dz-plegado">
          <summary>Lo que ya se ve o se resolvió solo · {vivos.length + clv.length + ((d.decidir || {}).solas || []).length}</summary>
          <div className="db-llego">
            {vivos.length ? <FondosRevisar fs={[]} fcs={[]} filtro={d.filtro} alCambiar={(fs) => cambiarD({ fondos: fs })} alFiltro={(fl) => cambiarD({ filtro: fl })} alFotos={(x) => cambiarD({ fotos_carta: x })} /> : null}
            {clv.length ? <LogosCrews cl={{ pend: [], vistos: clv }} /> : null}
          </div>
          {((d.decidir || {}).solas || []).length ? <Solas x={d.decidir} alListo={(y) => cambiarD({ decidir: y })} /> : null}
        </details>
      ) : null}
    </div>
  );
}

// 📊 LOS ORGANIZADORES Y EL BOT (Dlx, 11/11/2026: «Organizadores», de las ideas para el Dashboard). Cuando el lector no
// entiende una llave, el bot le pregunta a quien la publicó (`bot/finales.py`); acá, por servidor y por organizador,
// cuánto contestan, cuánto tardan y dónde no lo dejan escribir. Es lo que decide cuánto llega a Pendientes
const pc = (a, b) => (b ? Math.round((100 * a) / b) + ' %' : '—');
const tarda = (m) => (m == null ? '—' : m < 60 ? m + ' min' : m < 48 * 60 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' días');
function Organizadores({ o }) {
  const svs = o.sv || [], orgs = (o.org || []).filter((x) => x.batallas > x.contestadas);
  const sinP = svs.filter((x) => x.sin_permiso);
  return (
    <div className="dz-org">
      {sinP.length ? (
        <p className="dz-org-alerta"><b>{sinP.map((x) => siglaDe(x.sv)).join(', ')}</b> no deja{sinP.length === 1 ? '' : 'n'} escribir al bot en su canal de
          llaves: ahí pregunta en el chat de staff, si lo encuentra, y en el panel del socio. Darle permiso de escribir ahí es lo que más baja Pendientes.</p>
      ) : null}
      <div className="dz-org-t" role="region" aria-label="Por servidor" tabIndex={0}>
        <table>
          <thead><tr><th>Servidor</th><th>Llaves</th><th>Batallas</th><th>Contestaron</th><th>Tardan</th><th>Sin permiso</th><th>Cerró el bot</th><th>No contaron</th></tr></thead>
          <tbody>{svs.map((x) => (
            <tr key={x.sv}>
              <th scope="row">{siglaDe(x.sv)}</th><td>{num(x.llaves)}</td><td>{num(x.batallas)}</td>
              <td className={x.batallas && x.contestadas / x.batallas < 0.5 ? 'mal' : ''}>{num(x.contestadas)} · {pc(x.contestadas, x.batallas)}</td>
              <td>{tarda(x.tarda_min)}</td><td className={x.sin_permiso ? 'mal' : ''}>{x.sin_permiso ? num(x.sin_permiso) : '—'}</td>
              <td>{x.nadie48 ? num(x.nadie48) : '—'}</td><td>{x.descartadas ? num(x.descartadas) : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {orgs.length ? (
        <>
          <h4 className="dz-org-h">Quiénes dejan más sin contestar</h4>
          <ol className="dz-org-l">{orgs.slice(0, 8).map((x, i) => (
            <li key={i}><b>{x.n}</b> <small>{siglaDe(x.sv)}</small>
              <span>{num(x.batallas - x.contestadas)} sin contestar de {num(x.batallas)}{x.sin_permiso ? ' · en ' + x.sin_permiso + ' el bot no pudo escribir' : ''}</span></li>
          ))}</ol>
        </>
      ) : null}
      <p className="db-tx">«Cerró el bot» son las que nadie marcó en 48 h y cuentan como «Nadie siguió»; «Tardan» se mide desde el 11/11/2026.</p>
    </div>
  );
}

// ── 🏟️ LOS SERVIDORES, EN UNA TABLA (la maqueta: «todo lo de cada servidor en una fila: se cambia ahí mismo»). Eran
// tarjetas sueltas con seis selectores cada una, y el tier y el dueño vivían en otra pestaña. Ahora una fila por servidor
// —tier, multiplicador, bot en vivo, cuánto habla, apuestas, aviso de cada evento y eventos de Discord— y «Ficha» abre
// debajo lo que mide el puntaje, lo que recibe y quién es su dueño. Guardan lo mismo que guardaban las tarjetas
function ServidoresTabla({ liga, aj, hacer, ocup, chat, T, origen }) {
  const [ficha, setFicha] = useState('');
  // 🛑 pasar a Tier 3 deja de contar sus llaves para el Competitivo y los duelos: se confirma (el resto vuelve con «Deshacer»).
  // Hasta el 19/11/2026 se confirmaba al bajar de Tier 1, cuando el Tier 2 no contaba
  // (y el texto decía «dejan de sumar», que no era cierto desde el 26/10: todos suman a la Temporada)
  const [bajar, setBajar] = useState(null);
  // la ficha, al costado: se cierra con Esc
  useEffect(() => {
    if (!ficha) return undefined;
    const f = (e) => { if (e.key === 'Escape') setFicha(''); };
    W.addEventListener && W.addEventListener('keydown', f);
    return () => { W.removeEventListener && W.removeEventListener('keydown', f); };
  }, [ficha]);
  const fichaRef = useRef(null);
  const c = chat || {};
  const tiersT = (T && T.servidores) || [];
  const svs = [...new Set([...svsDe(chat, aj), ...tiersT.map((x) => x.sv)])];
  if (!svs.length) return <p className="db-tx">Todavía no sé el chat general de ningún servidor: lo busca el lector de anuncios en su próxima vuelta.</p>;
  const dash = aj.en_vivo || {}, dashNivel = aj.en_vivo_nivel || {};
  const niveles = c.niveles || NIVELES_VIVO;
  const admin = c.admin || {};
  const nivelAdmin = (sv) => (c.nivel || {})[sv] || 'normal';
  const prendido = (sv) => dash[sv] !== false && (!!admin[sv] || dash[sv] === true);
  const ae = aj.aviso_evento || {};
  const porSv = ae.sv || {};
  const m = liga.d.mult || {};
  const man = aj.multiplicadores && aj.multiplicadores.semana === m.id ? aj.multiplicadores.sv || {} : null;
  const ref = Object.assign({}, m.sv || {}, man || {});
  const elegidos = aj.tiers || {};
  const tierDe = (sv) => { const x = tiersT.find((y) => y.sv === sv); return elegidos[sv] || (x && x.tier) || 0; };
  const YA = 'Guardado: vale desde el próximo minuto.';
  const cambiar = (cual, obj, sv, v) => { const n = Object.assign({}, obj); if (v === '') delete n[sv]; else n[sv] = v; return hacer(cual, n, siglaDe(sv) + ': ' + YA); };
  const cambiarAviso = (sv, v) => { const n = Object.assign({}, porSv); if (v) n[sv] = v; else delete n[sv]; return hacer('aviso_evento', { sv: n, resto: ae.resto || '' }, siglaDe(sv) + ': vale desde el próximo evento.'); };
  const cambiarMult = (sv, x) => hacer('multiplicadores', { semana: m.id, sv: Object.assign({}, ref, { [sv]: x }) }, siglaDe(sv) + ' pasa a ' + mult(x) + ': entra en la próxima vuelta del ciclo.');
  const cambiarTier = (sv, t) => hacer('tiers', Object.assign({}, elegidos, { [sv]: t }),
    siglaDe(sv) + ' pasa a Tier ' + t + (t === 1 ? ': vuelve a sumar al ranking.' : ': sus llaves dejan de sumar.'));
  const xFicha = tiersT.find((y) => y.sv === ficha);
  // 🔤 las siglas que ya se usan (como sigla o como código), para que no se repita una
  const usadasSig = new Set(svs.flatMap((x) => [x, siglaDe(x)]).map((x) => String(x).toUpperCase()));
  return (
    <div className="dz-svt">
      {m.id ? (
        <div className="dz-svt-c">
          <span className={'db-est' + (man ? ' ojo' : '')}>{man ? '✍ El multiplicador de esta semana va a mano' : 'El multiplicador de esta semana salió del sorteo del lunes'}</span>
          {man ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo para volver al sorteo"
            onClick={() => hacer('multiplicadores', null, 'Vuelve el sorteo en la próxima vuelta del ciclo.')}>Volver al sorteo</DosToques> : null}
        </div>
      ) : null}
      <div className="dz-tabla">
        <table>
          <thead><tr>
            <th scope="col">Servidor</th><th scope="col">Sigla</th><th scope="col">Tier</th>{m.id ? <th scope="col">Multiplicador</th> : null}<th scope="col">Bot en vivo</th>
            <th scope="col">Cuánto habla</th><th scope="col">Aviso de evento</th><th scope="col">Eventos Discord</th><th scope="col" title="De los que debutaron ahí, cuántos volvieron a jugar en 14 días">Vuelven</th><th scope="col"><span className="rk-sr">Ficha</span></th>
          </tr></thead>
          <tbody>{svs.map((sv) => {
            const vm = ref[sv] == null ? 1 : ref[sv];
            const ops = FACTORES.indexOf(vm) < 0 ? [...FACTORES, vm].sort((a, b) => a - b) : FACTORES;
            const evd = (c.evd || {})[sv];
            const t = tierDe(sv);
            const xT = tiersT.find((y) => y.sv === sv);
            return (
              <Fragment key={sv}>
                <tr className={ficha === sv ? 'on' : ''}>
                  <th scope="row"><span className="dz-svt-n"><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b><i className={prendido(sv) ? 'ok' : ''} title={prendido(sv) ? 'el bot habla ahí' : 'el bot no habla ahí'} />
                    {/* 📋 lo que recomienda el ciclo, en la fila: «Revisar» si no llega a lo que pide su tier, «Puede subir» si llega al de arriba */}
                    {xT && (xT.rec === 'revisar' || xT.rec === 'subir') ? <em className={'dz-svt-rec rec-' + xT.rec} title={xT.porque}>{xT.rec === 'revisar' ? 'Revisar' : 'Puede subir'}</em> : null}</span></th>
                  <td data-t="Sigla"><SiglaEdit sv={sv} pedida={(aj.siglas || {})[sv]} usadas={usadasSig} ocup={ocup}
                    guardar={(s) => hacer('siglas', Object.assign({}, aj.siglas || {}, { [sv]: s }), siglaDe(sv) + ' se va a leer ' + s + ': entra en la próxima vuelta del ciclo.')} /></td>
                  <td data-t="Tier"><select aria-label={'El tier de ' + siglaDe(sv)} value={bajar && bajar[0] === sv ? String(bajar[1]) : t ? String(t) : ''} disabled={ocup}
                    onChange={(e) => { const n = Number(e.target.value); if (t !== 3 && n === 3) setBajar([sv, n]); else { setBajar(null); cambiarTier(sv, n); } }}>
                    {!t ? <option value="">—</option> : null}{[1, 2, 3].map((n) => <option key={n} value={String(n)}>Tier {n}</option>)}</select></td>
                  {m.id ? <td data-t="Multiplicador"><select aria-label={'El multiplicador de ' + siglaDe(sv)} value={String(vm)} disabled={ocup} onChange={(e) => cambiarMult(sv, Number(e.target.value))}>
                    {ops.map((x) => <option key={x} value={String(x)}>{mult(x)}</option>)}</select></td> : null}
                  <td data-t="Bot en vivo"><select aria-label={'El bot en vivo en ' + siglaDe(sv)} value={dash[sv] === true ? 'si' : dash[sv] === false ? 'no' : ''} disabled={ocup}
                    onChange={(e) => cambiar('en_vivo', dash, sv, e.target.value === '' ? '' : e.target.value === 'si')}>
                    <option value="">{admin[sv] ? 'Admin: sí' : 'Admin: no'}</option><option value="si">Prendido</option><option value="no">Apagado</option></select></td>
                  <td data-t="Cuánto habla"><select aria-label={'Cuánto habla el bot en ' + siglaDe(sv)} value={niveles[dashNivel[sv]] ? dashNivel[sv] : ''} disabled={ocup || !prendido(sv)}
                    onChange={(e) => cambiar('en_vivo_nivel', dashNivel, sv, e.target.value)}>
                    <option value="">{'Admin: ' + ((niveles[nivelAdmin(sv)] || ['normal'])[0]).toLowerCase()}</option>
                    {Object.keys(niveles).map((k) => <option key={k} value={k}>{niveles[k][0]}</option>)}</select></td>
                  <td data-t="Aviso de evento"><select aria-label={'El aviso de cada evento en ' + siglaDe(sv)} value={porSv[sv] || ''} disabled={ocup} onChange={(e) => cambiarAviso(sv, e.target.value)}>
                    <option value="">Donde habla</option><option value="chat">Chat general</option><option value="no">Apagado</option></select></td>
                  <td data-t="Eventos Discord"><select aria-label={'Los eventos de Discord de ' + siglaDe(sv)} value={(aj.eventos_discord || {})[sv] === true ? 'si' : ''} disabled={ocup}
                    onChange={(e) => cambiar('eventos_discord', aj.eventos_discord || {}, sv, e.target.value === 'si' ? true : '')}>
                    <option value="">Apagados</option><option value="si">Prendidos</option></select>
                    {evd ? <small className={evd.error ? 'db-mal' : ''}>{(evd.creados || 0) + ' en 7 días' + (evd.error === 'permiso' ? ' · falta permiso' : evd.error ? ' · ' + evd.error : '')}</small> : null}</td>
                  <td className="dz-num-c" data-t="Vuelven">{(origen || {})[sv] && origen[sv][0] ? <b>{Math.round((100 * origen[sv][1]) / origen[sv][0])} %</b> : '—'}
                    {(origen || {})[sv] && origen[sv][0] ? <small>{num(origen[sv][1])}/{num(origen[sv][0])}</small> : null}</td>
                  <td className="dz-svt-fi"><button type="button" className="dz-lnk" aria-expanded={ficha === sv} disabled={!tiersT.some((y) => y.sv === sv)}
                    onClick={() => {
                      setFicha(ficha === sv ? '' : sv);
                      if (ficha !== sv) setTimeout(() => { if (fichaRef.current) fichaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60);
                    }}>{ficha === sv ? 'Cerrar' : 'Ficha'}</button>
                    {/* 🛠️ su panel, como lo ve su dueño (23/11/2026, Dlx: «configurar las páginas de los servidores yo mismo»): Dlx entra a todos */}
                    <a className="dz-lnk" href={'#/socio?sv=' + sv}>Panel</a></td>
                </tr>
              </Fragment>
            );
          })}</tbody>
        </table>
      </div>
      {/* la ficha va abajo de la tabla y no adentro: adentro heredaba el ancho de las nueve columnas y quedaba corrida de costado */}
      {bajar ? (
        <div className="dz-freno" role="alert">
          <p><b>{siglaDe(bajar[0])} pasa a Tier {bajar[1]}</b>: sus llaves dejan de contar para el Competitivo y los duelos desde la próxima vuelta del ciclo (siguen sumando a la Temporada, con 8 participantes o más){(origen || {})[bajar[0]] ? ' (ahí debutaron ' + num(origen[bajar[0]][0]) + ' personas esta temporada)' : ''}.</p>
          <div className="dz-freno-f">
            <button type="button" className="btn verde chico" disabled={ocup} onClick={() => { cambiarTier(bajar[0], bajar[1]); setBajar(null); }}>Sí, pasarlo a Tier {bajar[1]}</button>
            <button type="button" className="dz-lnk" onClick={() => setBajar(null)}>Cancelar</button>
          </div>
        </div>
      ) : null}
      {/* la ficha, en un panel al costado (el research: un registro se abre al lado, no en un acordeón que empuja la tabla) */}
      {ficha && xFicha ? (
        <div className="dz-lado-velo" onClick={(e) => { if (e.target === e.currentTarget) setFicha(''); }}>
          <aside className="dz-lado" ref={fichaRef} aria-label={'La ficha de ' + siglaDe(ficha)}>
            <div className="dz-svt-c"><b>La ficha de {siglaDe(ficha)}</b><button type="button" className="btn borde2 chico" onClick={() => setFicha('')}>Cerrar · Esc</button></div>
            {(origen || {})[ficha] ? (
              <p className="dz-origen">De la gente que <b>debutó en {siglaDe(ficha)}</b> esta temporada, <b>{num(origen[ficha][1])} de {num(origen[ficha][0])}</b>
                {' '}({Math.round((100 * origen[ficha][1]) / Math.max(1, origen[ficha][0]))} %) volvió a jugar en 14 días{origen[ficha][0] < 30 ? ' · pocos: el número se mueve mucho' : ''}.</p>
            ) : null}
            <TierCaja x={xFicha} liga={liga} tier={tierDe(ficha) || 1} cambiar={cambiarTier} ocup={ocup} i={0} aj={aj} hacer={hacer} />
          </aside>
        </div>
      ) : null}
      <p className="db-tx">El punto al lado de la sigla es verde si el bot habla en su chat. Tier 1 y 2 suman a la Temporada y al Competitivo (sólo el 1 sale en «Unirme a los Tier 1»); Tier 3 suma a la Temporada y tiene su página y sus ligas, que cuentan como duelos.</p>
    </div>
  );
}

// ── 🎛️ LA PÁGINA Y EL BOT, EN FILAS (25/10/2026, la maqueta: «cada ajuste en una fila: qué hace en una línea, cómo está
// hoy y su control»). Eran once cajas con su título, un párrafo largo y el formulario abierto, todas iguales de altas:
// para saber cómo estaba algo había que leerlas enteras. Ahora la fila dice cómo está; «Cambiar» abre el formulario de
// siempre debajo (el mismo componente, sin su cabecera). Lo de un toque —pausar la campana— se hace en la fila misma
const corte = (s, n) => (String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || ''));
// ── 💬 A QUIÉN LE PREGUNTASTE (12/11/2026, Dlx: «iré preguntando a cada gente de la liga si les molesta»). Los más
// activos primero, que son los que más van a comentar. Sólo los que tienen fila en el objeto tienen estado; el resto
// está «sin preguntar». Lo que la persona apagó en Mi cuenta dice «lo apagó él». El cambio llega al ciclo por KV en
// hasta 15 minutos, y a la página en la vuelta siguiente
async function pedirCm(ruta, cuerpo) {
  const r = await fetch('/api/avisos/dueno/' + ruta, { method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'Entra con Discord de nuevo.' : j.error || String(r.status));
  return j;
}

function CmPermisosDueno({ liga }) {
  const [filas, setFilas] = useState(null);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [ver, setVer] = useState(30);
  useEffect(() => {
    let vivo = true;
    pedirCm('cm-permisos').then((j) => { if (vivo) setFilas(Object.fromEntries((j.filas || []).map((f) => [f.k, f]))); })
      .catch((e) => { if (vivo) setMsg(e.message); });
    return () => { vivo = false; };
  }, []);
  if (!filas) return <p className="dz-nota">{msg || 'Cargando…'}</p>;
  const gente = (liga.d.tabla || []).filter((f) => f.k && f.av).slice().sort((a, b) => (b.ev || 0) - (a.ev || 0));
  const est = (k) => (filas[k] ? filas[k].estado : 'pre');
  const cu = { si: 0, pre: 0, no: 0 };
  gente.forEach((f) => { cu[est(f.k)] += 1; });
  const qq = limpio(q).toLowerCase();
  const lista = gente.filter((f) => !qq || limpio(f.n).toLowerCase().includes(qq));
  const poner = async (k, estado) => {
    setMsg('');
    const antes = filas[k];
    setFilas(Object.assign({}, filas, { [k]: estado === 'pre' ? undefined : { k, estado, yo: false } }));
    try { await pedirCm('cm-permiso', { k, estado }); } catch (e) {
      setFilas(Object.assign({}, filas, { [k]: antes }));
      setMsg(e.message);
    }
  };
  return (
    <div className="cmd">
      <div className="cmd-cu">
        <span><b>{cu.si}</b> dijeron que sí</span><span><b>{cu.pre}</b> sin preguntar</span><span><b>{cu.no}</b> dijeron que no</span>
      </div>
      <input className="cmd-bus" id="cm-buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar a alguien" aria-label="Buscar a alguien" />
      <ul className="cmd-l">
        {lista.slice(0, qq ? 60 : ver).map((f) => {
          const e = est(f.k);
          return (
            <li key={f.k}>
              <span className="cmd-n"><b>{limpio(f.n)}</b><small>{siglaDe(f.sv)} · {f.ev || 0} eventos{filas[f.k] && filas[f.k].yo ? ' · lo apagó él' : ''}</small></span>
              <span className="cmd-seg" role="group" aria-label={'Permiso de ' + limpio(f.n)}>
                {[['si', 'Sí'], ['pre', 'Sin preguntar'], ['no', 'No']].map(([v, t]) => (
                  <button key={v} type="button" className={v} aria-pressed={e === v} onClick={() => e !== v && poner(f.k, v)}>{t}</button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
      {!qq && lista.length > ver ? <button type="button" className="btn borde2 chico" onClick={() => setVer(ver + 60)}>Ver más ({lista.length - ver})</button> : null}
      {msg ? <p className="dz-nota" role="alert">{msg}</p> : null}
    </div>
  );
}

function Fila({ id, t, que, val, tono, abierta, alAbrir, accion, children }) {
  return (
    <li className={'dz-fila' + (abierta ? ' on' : '')} id={id}>
      <div className="dz-fila-c">
        <div className="dz-fila-t"><b>{t}</b><small>{que}</small></div>
        <span className={'dz-fila-v' + (tono ? ' ' + tono : '')}>{val}</span>
        <div className="dz-fila-a">
          {accion}
          {children ? <button type="button" className="btn borde2 chico" aria-expanded={!!abierta} onClick={alAbrir}>{abierta ? 'Cerrar' : 'Cambiar'}</button> : null}
        </div>
      </div>
      {abierta && children ? <div className="dz-fila-ed">{children}</div> : null}
    </li>
  );
}

function AjustesFilas({ liga, aj, hacer, ocup, chat, ir, abrir, pedido, sis }) {
  const [ab, setAb] = useState(abrir || '');
  // `pedido`: la misma fila pedida otra vez (cerrada con «Cerrar») se vuelve a abrir (18/11/2026)
  useEffect(() => { if (abrir) setAb(abrir); }, [abrir, pedido]);
  const f = (id) => ({ id, abierta: ab === id, alAbrir: () => setAb(ab === id ? '' : id) });
  const c = chat || {};
  const p = !!aj.campana_pausada;
  const vig = avisoVigente(aj);
  const nv = NIVELES_AVISO[aj.avisos_nivel] ? aj.avisos_nivel : 'normal';
  const dash = aj.en_vivo || {}, admin = c.admin || {};
  const svs = svsDe(chat, aj);
  const prendidos = svs.filter((sv) => dash[sv] !== false && (!!admin[sv] || dash[sv] === true)).length;
  const defR = (c.def || {}).ritmo || DEF_RIT, r = aj.ritmo || null;
  const s = aj.silencio || null;
  const defA = (c.def || {}).apuestas || DEF_AP, a = aj.apuestas || null;
  const S = aj.pase_sorteo || null;
  const ms = aj.mes_sacar || null;
  const promos = (aj.promos_mano || []).length;
  return (
    <div className="dz-filas">
      <h3 className="dz-h">Avisos</h3>
      <ul>
        <Fila {...f('aj-campana')} t="La campana" que="Avisa a los celulares cuando un servidor anuncia un evento."
          val={p ? '⏸ En pausa' : '● Suena'} tono={p ? 'ojo' : 'ok'}
          accion={p ? <button type="button" className="btn verde chico" disabled={ocup} onClick={() => hacer('campana_pausada', false, 'La campana vuelve a sonar.')}>Reanudar</button>
            : <DosToques className="btn borde2 chico" disabled={ocup} confirmar={sis && sis.suscripciones ? 'Toca de nuevo: ' + num(sis.suscripciones) + ' dispositivos dejan de recibir avisos' : 'Toca de nuevo para pausar'}
              onClick={() => hacer('campana_pausada', true, 'La campana quedó en pausa.')}>Pausar</DosToques>} />
        <Fila {...f('aj-aviso')} t="Aviso en la página" que="Un mensaje arriba de todas las páginas, hasta la hora que elijas."
          val={vig ? '«' + corte(vig.texto, 34) + '» · hasta ' + liga.dia(vig.hasta) : 'Ninguno'} tono={vig ? 'ojo' : ''}>
          <AjAviso liga={liga} aj={aj} hacer={hacer} ocup={ocup} /></Fila>
        <Fila {...f('aj-avisos')} t="El aviso de cada evento" que="Lo que cuenta el bot en el chat cuando el ciclo carga un evento."
          val={NIVELES_AVISO[nv][0]} tono="ok">
          <AjAvisos liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general /></Fila>
      </ul>
      <h3 className="dz-h">El bot en vivo</h3>
      <ul>
        <Fila id="aj-vivo" t="El bot en vivo" que="Cuenta en el chat cómo va un evento. Se prende servidor por servidor."
          val={prendidos + ' de ' + svs.length + ' servidores'} tono={prendidos ? 'ok' : ''}
          accion={<button type="button" className="btn borde2 chico" onClick={() => ir('servidores', 'sv-cada')}>Ir a Servidores</button>} />
        <Fila {...f('aj-ritmo')} t="El ritmo" que="Cada cuánto puede mandar un mensaje nuevo en un mismo chat."
          val={'Uno cada ' + (r || defR).normal + ' min · ' + (r || defR).batalla + ' en «Cada batalla»' + (r ? ' · ✍' : '')} tono={r ? 'ojo' : ''}>
          <AjRitmo aj={aj} hacer={hacer} ocup={ocup} chat={chat} /></Fila>
        <Fila {...f('aj-silencio')} t="Horario de silencio" que="Horas (en hora del este) en que el bot en vivo no habla en ningún chat."
          val={s ? '🌙 De ' + s.desde + ' a ' + s.hasta : 'Sin silencio'} tono={s ? 'ojo' : ''}>
          <AjSilencio aj={aj} hacer={hacer} ocup={ocup} /></Fila>
        <Fila {...f('aj-apuestas')} t="Las apuestas" que="Los botones y cuánto quedan abiertas. Salen siempre y sin tope."
          val={(a || defA).montos.map(num).join(' · ') + ' · ' + ((a || defA).minutos || 3) + ' min' + (a ? ' · ✍' : '')} tono={a ? 'ojo' : ''}>
          <AjApuestas liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={chat} general /></Fila>
      </ul>
      <h3 className="dz-h">El Pase, las crews y el Salón</h3>
      <ul>
        <Fila {...f('aj-sorteo')} t="El sorteo del premium" que="La gente entra gratis desde el Pase y se sortea solo a la hora."
          val={S ? (msDe(S.sorteo) > Date.now() ? 'Se sortea ' : 'Se sorteó ') + liga.dia(S.sorteo) : 'Sin sorteo'} tono={S && msDe(S.sorteo) > Date.now() ? 'ok' : ''}>
          <AjSorteo liga={liga} aj={aj} hacer={hacer} ocup={ocup} /></Fila>
        <Fila {...f('aj-crews')} t="Las crews" que="Cuánto cuesta crear una, cómo se arma su ranking y quién es el líder."
          val={'Crear: ' + num(aj.crew_precio ?? 2500) + ' PdT'}>
          <AjCrews liga={liga} aj={aj} hacer={hacer} ocup={ocup} /></Fila>
        <Fila {...f('aj-mes')} t="MES AWARDS" que="Los nominados de cada servidor salen solos el día 1; hasta las 6 PM puedes sacar a alguno."
          val={ms && (ms.quitar || []).length ? 'Sacaste ' + ms.quitar.length : 'Sin cambios'}>
          <MesAwardsDueno aj={aj} hacer={hacer} ocup={ocup} /></Fila>
        <Fila {...f('aj-promos')} t="Promos a mano" que="Agregar una promo que el lector no vio, o sacar una que no va."
          val={promos ? promos + ' a mano' : 'Ninguna'}>
          <PromosMano aj={aj} hacer={hacer} ocup={ocup} /></Fila>
      </ul>
      <h3 className="dz-h">Los estilos de juego</h3>
      <ul>
        <Fila {...f('aj-estilos')} t="Eventos de estilo" que="Marca un evento de DRA con un estilo: jugarlo da nivel 1 y el cuarto de arriba de la llave sube uno."
          val={Object.keys(aj.eventos_estilo || {}).length ? Object.keys(aj.eventos_estilo).length + ' marcados' : 'Ninguno'}
          tono={Object.keys(aj.eventos_estilo || {}).length ? 'ok' : ''}>
          <AjEventosEstilo liga={liga} aj={aj} hacer={hacer} ocup={ocup} /></Fila>
      </ul>
      <h3 className="dz-h">Publicaciones</h3>
      <ul>
        <Fila {...f('aj-comentarios')} t="Comentarios simulados" que="A quién le preguntaste si su cara puede comentar. Sí va sin etiqueta, sin preguntar va con «simulado» y No no aparece nunca."
          val="Por persona">
          <CmPermisosDueno liga={liga} /></Fila>
      </ul>
    </div>
  );
}

// ── 💚 LA SALUD, PIEZA POR PIEZA (25/10/2026, la maqueta). Antes eran cinco cajas de texto y para saber si algo andaba mal
// había que leerlas todas. Ahora cada pieza es un cuadro con su punto —verde anda, amarillo ojo, rojo mal— y lo que
// mide en una línea; tocarlo baja al detalle, que sigue siendo el de antes. Arriba, el cupo de escrituras de KV con su
// ritmo: lo que va, a dónde llega al ritmo de hoy y a qué hora se renueva
function piezasDe(d, q, logs) {
  const s = d.sistema || {};
  const aj = d.ajustes || {};
  const ult = (d.corridas || [])[0];
  const xs = [];
  if (ult) {
    const t = ult.empezo || ult.creada;
    const fallo = ult.estado === 'completed' && ult.fin && ult.fin !== 'success' && ult.fin !== 'skipped';
    const trabada = ult.estado !== 'completed' && t && Date.now() - Date.parse(t) > 20 * 60000;
    xs.push(['El ciclo', fallo ? 'mal' : trabada ? 'ojo' : 'ok', (ult.estado === 'completed' ? (FIN_CORRIDA[ult.fin] || 'terminó').replace(/^\S+\s/, '') : (ESTADO_CORRIDA[ult.estado] || ult.estado).replace(/^\S+\s/, '')) + (t ? ' · ' + hora(new Date(t)) : ''), 'sa-corridas']);
  }
  if (s.vigia || s.ok === false) xs.push(['El lector de anuncios', s.ok === false ? 'mal' : 'ok', (s.ok === false ? 'no contesta · ' : 'leyó ') + hace(s.vigia), 'sa-corridas']);
  xs.push(['GitHub', d.github ? 'ojo' : 'ok', d.github ? (d.github.incidente || 'anda lento') : 'normal', 'sa-corridas']);
  const w = q && q.kv ? q.kv.write : null;
  if (w != null) {
    const p = proyeccion(q);
    xs.push(['KV · escrituras', w >= 900 || (p != null && p >= 1000) ? 'mal' : w >= 700 || (p != null && p >= 850) ? 'ojo' : 'ok', num(w) + ' de 1.000' + (p != null ? ' · llega a ~' + num(p) : ''), 'sa-cuotas']);
  }
  const ob = q && q.objeto;
  if (ob) {
    const pc = Math.max(...TOPES.filter(([g]) => g === 'objeto').map(([, k, , tope]) => (100 * (ob[k] || 0)) / tope));
    xs.push(['El objeto', pc >= 90 ? 'mal' : pc >= 70 ? 'ojo' : 'ok', Math.round(pc) + ' % de lo más usado', 'sa-cuotas']);
  }
  const wk = q && q.worker;
  // 🧮 EL WORKER, POR LO QUE DE VERDAD CUENTA (25/10/2026): los pedidos que Cloudflare cortó y cuántos del Worker —no del
  // objeto, que no tiene el tope— pasaron los 10 ms. El p99 de antes mezclaba los dos y daba rojo con cero cortados
  if (wk && wk.pedidos) {
    const c = wk.cpu || null, pc = c && wk.pedidos ? (100 * c.worker_10) / wk.pedidos : null;
    xs.push(['El Worker', wk.cortados ? 'mal' : pc != null && pc >= 5 ? 'ojo' : 'ok',
      (wk.cortados ? num(wk.cortados) + ' cortados en 24 h' : 'ninguno cortado en 24 h') + (c ? ' · ' + num(c.worker_10) + ' pasaron 10 ms (' + String(Math.round(pc * 10) / 10).replace('.', ',') + ' %)' : ''), 'sa-cuotas']);
  }
  xs.push(['La campana', aj.campana_pausada ? 'ojo' : 'ok', aj.campana_pausada ? 'en pausa' : num(s.suscripciones || 0) + ' dispositivos · ' + num((s.ultimas_24h || {}).enviados || 0) + ' envíos en 24 h', 'sa-corridas']);
  if (logs && !logs.error) {
    const v = logsVistos();
    const rojos = (logs.xs || []).filter((x) => x.nivel === 'rojo' && !v.includes(x.id)).length;
    const amar = (logs.xs || []).filter((x) => x.nivel !== 'rojo' && !v.includes(x.id)).length;
    xs.push(['Logs', rojos ? 'mal' : amar ? 'ojo' : 'ok', rojos ? rojos + ' en rojo sin ver' : amar ? amar + ' en amarillo sin ver' : 'nada sin ver', 'sa-logs']);
  }
  const ep = (d.errores_pag || []).reduce((n, x) => n + (x.n || 0), 0);
  xs.push(['Errores de la página', ep >= 20 ? 'mal' : ep ? 'ojo' : 'ok', ep ? num(ep) + ' en 7 días' : 'ninguno en 7 días', 'sa-errores']);
  return xs;
}

function Cupo({ q }) {
  const w = q && q.kv ? q.kv.write : null;
  if (w == null) return null;
  const p = proyeccion(q);
  const ahora = new Date();
  const renueva = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + 1));
  const hasta = (x) => Math.min(100, x / 10).toFixed(1) + '%';
  const mal = p != null && p >= 1000;
  return (
    <div className={'dz-cupo' + (mal ? ' mal' : w >= 700 ? ' ojo' : '')}>
      <div className="dz-cupo-c"><b>El cupo de hoy · KV</b><span>{num(w)} <small>de 1.000 escrituras</small></span></div>
      <div className="dz-cupo-b" role="img" aria-label={num(w) + ' de 1.000' + (p != null ? ', al ritmo de hoy ~' + num(p) : '')}>
        {p != null ? <i className="dz-cupo-p" style={{ width: hasta(p) }} /> : null}
        <u style={{ width: hasta(w) }} />
      </div>
      <p className="db-tx">{p != null ? (mal ? '⚠️ Al ritmo de hoy llega a ~' + num(p) + ': no alcanza. Si se llena, la página y /card se quedan quietos hasta que se renueve.' : 'Al ritmo de hoy llega a ~' + num(p) + ': alcanza.') : 'Recién se renovó: todavía no hay ritmo.'} Se renueva a las {hora(renueva)}.</p>
    </div>
  );
}

// 📊 EL PROPIO DASHBOARD (25/10/2026, el research: «medir la operación, no las visitas»): cuánto tarda en cerrarse lo que
// llega, cuántas veces dos del staff miraban el mismo caso y cuántos «Deshacer» (`dashMedResumen()` del objeto)
const horasTxt = (ms) => (ms == null ? '—' : ms < 3600000 ? Math.max(1, Math.round(ms / 60000)) + ' min' : ms < 2 * 864e5 ? Math.round(ms / 3600000) + ' h' : Math.round(ms / 864e5) + ' días');
function DashMed({ m }) {
  if (!m) return <p className="pronto-p">Se empieza a medir con lo que se cierre desde hoy.</p>;
  return (
    <div className="dz-nums">
      <div className="dz-num"><span>un reporte, hasta cerrarse</span><b>{m.reportes ? horasTxt(m.reportes.mitad) : '—'}</b><small>{m.reportes ? 'la mitad; el peor 10 %: ' + horasTxt(m.reportes.p90) + ' · ' + num(m.reportes.n) + ' en 30 días' : 'ninguno cerrado con causa todavía'}</small></div>
      <div className="dz-num"><span>un pedido, hasta contestarse</span><b>{m.pedidos ? horasTxt(m.pedidos.mitad) : '—'}</b><small>{m.pedidos ? 'la mitad; el peor 10 %: ' + horasTxt(m.pedidos.p90) + ' · ' + num(m.pedidos.n) + ' en 30 días' : 'ninguno en 30 días'}</small></div>
      <div className="dz-num"><span>casos que dos miraban a la vez</span><b>{num(m.doble || 0)}</b><small>en 7 días</small></div>
      <div className="dz-num"><span>«Deshacer» usados</span><b>{num(m.deshacer || 0)}</b><small>en 7 días</small></div>
    </div>
  );
}

// 🗓️ LA SEMANA EN CUATRO LÍNEAS (25/10/2026; Dlx: «haz todas»). Sólo lunes y martes (hora del este): el resto de la
// semana ya está en Números y el Resumen es para lo que pide acción. La vuelta de la última semana cerrada, qué falló
// del bot, cuántos debutaron y no volvieron, y a cuántos se les avisó
// los lunes y martes, en hora del este: lo sabe también el tablero, para dejarle su lugar
const semanaCortaHoy = () => ['Mon', 'Tue'].includes(new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' }));
function SemanaCorta({ d, retencion, ir, clase }) {
  if (!semanaCortaHoy()) return null;
  const cs = ((retencion && retencion.cohortes) || []).filter((c) => c.completa && c.nuevos);
  const ult = cs[cs.length - 1];
  const P = d.primerizos || {};
  const hoy = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) + 'T12:00:00Z');
  const lun = new Date(hoy); lun.setUTCDate(lun.getUTCDate() - ((lun.getUTCDay() + 6) % 7) - 7);
  const dom = new Date(lun); dom.setUTCDate(dom.getUTCDate() + 6);
  const enSemana = (x) => x >= lun.toISOString().slice(0, 10) && x <= dom.toISOString().slice(0, 10);
  const nuevosSolos = (P.una || []).filter((f) => enSemana(f[2])).length;
  const avisados = Object.values(d.vuelve || {}).filter((v) => Date.now() - v[0] < 7 * 864e5).length;
  const top = (d.reportes_causas || []).filter((c) => c.n7 && c.causa !== 'prueba').sort((a, b) => b.n7 - a.n7)[0];
  // 🔤 con su singular, como CausasLinea (18/11/2026): el arreglo del 12/11 quedó en un lugar de dos, «1 nombres mal leídos»
  const lineas = [
    ult ? ['La vuelta al segundo evento', Math.round((100 * ult.volvieron) / ult.nuevos) + ' % (' + num(ult.volvieron) + ' de ' + num(ult.nuevos) + ', los que debutaron la semana del ' + corto(ult.semana) + ')', 'numeros', 'nu-vuelta'] : null,
    ['Lo que más falló del bot', top ? num(top.n7) + ' ' + (CAUSAS.find((x) => x[0] === top.causa) || [0, 0, top.causa, top.causa])[top.n7 === 1 ? 3 : 2] : 'nada reportado', 'pendientes', ''],
    ['Jugaron una sola vez', num(nuevosSolos) + ' de los que debutaron la semana pasada', 'numeros', 'nu-primerizos'],
    ['Se les avisó que vuelvan', num(avisados) + ' en 7 días', 'numeros', 'nu-primerizos'],
  ].filter(Boolean);
  return (
    <section className={(clase || 'dz-caja') + ' dz-semana'}>
      <h3 className="dz-h">La semana pasada<small>los lunes y martes</small></h3>
      <ul className="dz-lista">{lineas.map(([t, v, a, an]) => (
        <li key={t}><span><b>{t}:</b> {v}</span><button type="button" className="dz-lnk" onClick={() => ir(a, an)}>Ver</button></li>
      ))}</ul>
    </section>
  );
}

function SaludPiezas({ d, q, logs, ir }) {
  const xs = piezasDe(d, q, logs);
  const malas = xs.filter((x) => x[1] === 'mal').length, ojos = xs.filter((x) => x[1] === 'ojo').length;
  return (
    <div className="dz-sal">
      <p className={'dz-sal-r' + (malas ? ' mal' : ojos ? ' ojo' : '')}>{malas ? malas + (malas === 1 ? ' pieza anda mal' : ' piezas andan mal') : ojos ? 'Todo anda; ' + ojos + (ojos === 1 ? ' pieza para mirar' : ' piezas para mirar') : 'Todo anda.'}</p>
      <div className="dz-piezas">{xs.map(([t, e, s, an]) => (
        <button key={t} type="button" className={'dz-pieza ' + e} onClick={() => ir('salud', an)}>
          <span className="dz-pieza-t"><i aria-hidden="true" />{t}</span>
          <small>{s}</small>
          {e === 'ok' ? <em className="rk-sr">anda</em> : <em className="dz-pieza-e">{e === 'ojo' ? 'OJO' : 'MAL'}</em>}
        </button>
      ))}</div>
      <Cupo q={q} />
    </div>
  );
}

// ── 🕓 EL HISTORIAL, CON «DE → A» (25/10/2026, la maqueta). Decía «cambió» y nada más: para saber qué había que
// deshacer había que acordarse. Ahora cada fila dice cómo estaba y cómo quedó, en palabras; en los ajustes por servidor
// sólo los servidores que cambiaron. `enPalabras()` es corto a propósito: un valor que no conoce lo cuenta, no lo inventa
const VAL_SV = {
  en_vivo: (v) => (v === true ? 'prendido' : v === false ? 'apagado' : 'su admin'),
  en_vivo_nivel: (v) => ((NIVELES_VIVO[v] || [v])[0] || '').toLowerCase(),
  eventos_discord: (v) => (v ? 'prendidos' : 'apagados'),
  tiers: (v) => 'Tier ' + v,
  beneficios: () => 'a mano',
};
function enPalabras(cual, v, liga) {
  if (v === null || v === undefined) return 'lo de siempre';
  if (cual === 'campana_pausada') return v ? 'en pausa' : 'suena';
  if (cual === 'avisos_nivel') return ((NIVELES_AVISO[v] || [v])[0] || '').toLowerCase();
  if (cual === 'silencio') return 'de ' + v.desde + ' a ' + v.hasta;
  if (cual === 'aviso_web') return '«' + corte(v.texto, 40) + '»';
  if (cual === 'ritmo') return 'uno cada ' + v.normal + ' min · ' + v.batalla + ' en «Cada batalla»';
  if (cual === 'apuestas') return (v.montos || []).map(num).join(' · ') + (v.minutos ? ' · ' + v.minutos + ' min' : '');
  if (cual === 'pase_sorteo') return v.id + (v.sorteo && liga ? ' · se sortea ' + liga.dia(v.sorteo) : '');
  if (cual === 'eventos_estilo') { const n = Object.keys(v || {}).length; return n === 1 ? '1 evento marcado' : n + ' eventos marcados'; }
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'number') return num(v);
  if (typeof v === 'string') return corte(v, 40);
  if (Array.isArray(v)) return v.length === 1 ? '1 cosa' : v.length + ' cosas';
  const n = Object.keys(v).length;
  return n === 1 ? '1 ajuste' : n + ' ajustes';
}
// lo que cambió, como líneas «de → a»
function deA(x, liga) {
  const { cual } = x;
  let a = x.antes, d = x.despues;
  if (cual === 'multiplicadores') { a = a && a.sv; d = d && d.sv; }
  if (cual === 'aviso_evento') { a = a && a.sv; d = d && d.sv; }
  const porSv = VAL_SV[cual] || (cual === 'multiplicadores' ? mult : cual === 'aviso_evento' ? (v) => ({ chat: 'chat general', no: 'apagado' }[v] || v) : null);
  if (porSv && (a == null || typeof a === 'object') && (d == null || typeof d === 'object')) {
    const A = a || {}, D = d || {};
    const ks = [...new Set([...Object.keys(A), ...Object.keys(D)])].filter((k) => JSON.stringify(A[k]) !== JSON.stringify(D[k]));
    if (ks.length && ks.length <= 6) {
      const ver = (o, k) => (o[k] === undefined ? (cual === 'multiplicadores' ? '×1' : 'lo de siempre') : porSv(o[k]));
      return ks.map((k) => [siglaDe(k), ver(A, k), ver(D, k)]);
    }
  }
  // 🔎 «Sumar un servidor: 1 ajuste → 2 ajustes» no decía cuál (12/11/2026, mirándolo con Dlx): en los que se guardan
  // por servidor, qué servidor entró, salió o cambió
  if ((cual === 'altas' || cual === 'socios_duenos') && (a == null || typeof a === 'object') && (d == null || typeof d === 'object')) {
    const A = a || {}, D = d || {};
    const filas = [...new Set([...Object.keys(A), ...Object.keys(D)])].filter((k) => JSON.stringify(A[k]) !== JSON.stringify(D[k]))
      .map((k) => [siglaDe(k), k in A ? 'estaba' : '—', k in D ? (k in A ? 'cambió' : 'se sumó') : 'se sacó']);
    if (filas.length && filas.length <= 6) return filas;
  }
  // 🎲 las apuestas: lo de antes del 12/11 que cambiaba «dónde no van» se veía igual de los dos lados
  const ea = enPalabras(cual, x.antes, liga), ed = enPalabras(cual, x.despues, liga);
  if (cual === 'apuestas' && ea === ed) {
    const no = (v) => Object.keys((v && v.apagadas) || {}).map(siglaDe).join(', ') || 'ninguno';
    return [['no van en', no(x.antes), no(x.despues)]];
  }
  return [['', ea, ed]];
}

// 🗂️ LO QUE TOCARON LOS SOCIOS (Dlx, 11/11/2026: «que haya un registro para nosotros, no para ellos, de las cosas que
// cambian… así si pasa algo tenemos prueba que alguien cambió algo de alguien»). Cada cambio desde un panel del socio:
// quién (el dueño, un admin de su equipo o Dlx, con su ID), qué, lo de antes y lo de después. Lo arma `socioAnotar()` del
// objeto; se pide al abrir esta sección. ⚠️ Ningún socio lo ve
const NOMBRE_SOCIO = { vivo: 'Cómo va el evento (canal)', avisos: 'Los cambios de rango (canal)', ascenso: 'El ascenso de sus ligas (canal)',
  vivo_nivel: 'Cuánto habla el bot', apuestas: 'Apuestas', nick: '#N en el apodo', eventos_discord: 'Eventos de Discord',
  aviso_evento: 'El aviso de cada evento', canales: 'Dónde se usa /card', ligas: 'Las batallas de sus ligas (canal)', resumen: 'El resumen de la semana (canal)' };
const ROL_SOCIO = { dueno: 'el dueño', admin: 'admin', dlx: 'Dlx' };
function RegistroSocios() {
  const [r, setR] = useState(null);
  const [q, setQ] = useState('');
  const [mas, setMas] = useState(false);
  useEffect(() => {
    let vivo = true;
    fetch('/api/avisos/dueno-socios', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(async (x) => (x.ok ? x.json() : { error: x.status })).then((j) => { if (vivo) setR(j || { error: 'vacío' }); })
      .catch(() => { if (vivo) setR({ error: 'red' }); });
    return () => { vivo = false; };
  }, []);
  const accion = (sv, a) => {
    fetch('/api/avisos/dueno-socios', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sv, accion: a }) })
      .then(async (x) => (x.ok ? x.json() : null)).then((j) => { if (j) setR(j); }).catch(() => {});
  };
  if (!r) return <p className="pronto-p">Leyendo el registro…</p>;
  if (r.error) return <p className="pronto-p">No pude leer el registro ({String(r.error)}).</p>;
  const cn = r.canales || {};
  // 🏠 lo que escribió cada equipo en su página: lo que espera revisión primero, y para todos, quitarlo
  const pags = Object.entries(r.paginas || {});
  const paginas = pags.length ? (
    <ul className="db-socios-pag">{pags.map(([sv, p]) => (
      <li key={sv}>
        <b>{siglaDe(sv)}</b>
        {p.pend ? <span>Banner por revisar: <a href={p.pend} target="_blank" rel="noopener noreferrer">verlo ↗</a>{' '}
          <button type="button" className="btn verde chico" onClick={() => accion(sv, 'aprobar')}>Aprobar</button>{' '}
          <DosToques className="btn borde2 chico" confirmar="Toca de nuevo: no se aprueba" onClick={() => accion(sv, 'rechazar')}>No</DosToques></span> : null}
        {p.banner ? <span><a href={p.banner} target="_blank" rel="noopener noreferrer">Su banner ↗</a>{' '}
          <DosToques className="btn borde2 chico" confirmar="Toca de nuevo: se saca" onClick={() => accion(sv, 'quitar_banner')}>Sacarlo</DosToques></span> : null}
        {p.desc ? <span>«{p.desc}» <DosToques className="btn borde2 chico" confirmar="Toca de nuevo: se saca" onClick={() => accion(sv, 'quitar_desc')}>Sacar el texto</DosToques></span> : null}
        {(p.redes || []).length ? <span>{p.redes.map(([k]) => k).join(', ')} <DosToques className="btn borde2 chico" confirmar="Toca de nuevo: se sacan" onClick={() => accion(sv, 'quitar_redes')}>Sacar las redes</DosToques></span> : null}
      </li>
    ))}</ul>
  ) : null;
  // un canal se ve con su nombre si el objeto lo conoce; «no» y vacío, en palabras
  const val = (v) => {
    const x = String(v == null ? '' : v);
    if (!x) return 'nada';
    if (x === 'no') return 'apagado';
    if (/^\d{15,25}$/.test(x)) return cn[x] ? '#' + cn[x] : 'canal ' + x;
    if (x === 'true') return 'prendido';
    if (x === 'false') return 'apagado';
    return x.replace(/"(\d{15,25})"/g, (m, id) => (cn[id] ? '#' + cn[id] : id));
  };
  const que = (k) => NOMBRE_SOCIO[k] || (/^liga:/.test(k) ? 'Las batallas de la liga ' + k.slice(5) + ' (canal)' : k);
  const todos = r.xs || [];
  if (!todos.length) return <>{paginas}<p className="db-tx">Todavía nadie tocó nada desde un panel: el registro empezó el 11/11/2026.</p></>;
  const filas = todos.filter((x) => contiene([x.sv, siglaDe(x.sv), x.n, x.quien, que(x.que), ROL_SOCIO[x.rol]], q));
  const ver = mas ? filas : filas.slice(0, 20);
  return (
    <div className="dz-hi">
      {paginas}
      <label className="db-buscar dz-band-q"><Ico n="buscar" t={16} />
        <input type="search" value={q} placeholder="Buscar un servidor, una persona o un ajuste" aria-label="Buscar en el registro de los socios" onChange={(e) => setQ(e.target.value)} /></label>
      <ol className="dz-hi-l">{ver.map((x) => (
        <li key={x.t + x.que + x.quien}>
          <span className="dz-hora" title={new Date(x.t).toLocaleString('es', { timeZone: 'America/New_York' }) + ' ET'}>{hace(x.t)}</span>
          <div className="dz-hi-q">
            <b>{siglaDe(x.sv)} · {que(x.que)}<small> · {x.n || ROL_SOCIO[x.rol] || 'alguien'}{x.rol === 'admin' && x.n ? ' (admin)' : ''} · {x.quien}</small></b>
            {x.antes || x.despues ? <ul><li><s>{val(x.antes)}</s><span aria-hidden="true">→</span><span className="rk-sr">pasó a</span><strong>{val(x.despues)}</strong></li></ul> : null}
          </div>
        </li>
      ))}{!ver.length ? <li className="dz-it-nada">Nada con «{q}».</li> : null}</ol>
      {filas.length > 20 ? <button type="button" className="dz-lnk" onClick={() => setMas(!mas)}>{mas ? 'Ver menos' : 'Ver los ' + filas.length}</button> : null}
    </div>
  );
}

function HistorialDeA({ hist, hacer, ocup, liga }) {
  const [q, setQ] = useState('');
  const [mas, setMas] = useState(false);
  const todos = hist || [];
  if (!todos.length) return <p className="db-tx">Todavía no hay cambios anotados: el historial empezó el 13/10/2026.</p>;
  // sólo el último cambio de cada ajuste se puede deshacer: deshacer uno más viejo pisaría lo que vino después
  const ultimo = new Set();
  const filas = todos.map((x) => { const puede = !ultimo.has(x.cual); ultimo.add(x.cual); return [x, puede]; })
    .filter(([x]) => contiene([NOMBRE_AJ[x.cual] || x.cual, x.por], q));
  const ver = mas ? filas : filas.slice(0, 15);
  return (
    <div className="dz-hi">
      <label className="db-buscar dz-band-q"><Ico n="buscar" t={16} />
        <input type="search" value={q} placeholder="Buscar un ajuste o quién lo cambió" aria-label="Buscar en el historial" onChange={(e) => setQ(e.target.value)} /></label>
      <ol className="dz-hi-l">{ver.map(([x, puede]) => (
        <li key={x.t + x.cual}>
          <span className="dz-hora">{hace(x.t)}</span>
          <div className="dz-hi-q">
            <b>{NOMBRE_AJ[x.cual] || x.cual}{x.por && x.por !== 'Dlx' ? <small> · lo cambió {x.por}</small> : null}</b>
            <ul>{deA(x, liga).map(([k, de, a]) => (
              <li key={k + de + a}>{k ? <em>{k}</em> : null}<s>{de}</s><span aria-hidden="true">→</span><span className="rk-sr">pasó a</span><strong>{a}</strong></li>
            ))}</ul>
          </div>
          {puede ? <DosToques className="btn borde2 chico" disabled={ocup} confirmar="Toca de nuevo: vuelve a como estaba"
            onClick={() => hacer(x.cual, volverA(x.cual, x.antes), 'Deshecho: volvió a como estaba.', false, true)}>Deshacer</DosToques> : <small className="dz-hi-no">cambió después</small>}
        </li>
      ))}{!ver.length ? <li className="dz-it-nada">Nada con «{q}».</li> : null}</ol>
      {filas.length > 15 ? <button type="button" className="dz-lnk" onClick={() => setMas(!mas)}>{mas ? 'Ver menos' : 'Ver los ' + filas.length}</button> : null}
    </div>
  );
}

// ── 📊 LOS NÚMEROS, EN PESTAÑAS (25/10/2026, la maqueta: «la gente · la página · el Pase · las crews»). Eran diez
// secciones una abajo de la otra y la que importaba quedaba al final. Cada pestaña es una pregunta; la que no tiene
// datos no aparece (sin dato no hay pieza). La elegida se recuerda en este navegador
// 🔗 en qué pestaña vive cada sección, para que un atajo (Ctrl+K, un cuadrado del Resumen) abra la pestaña correcta: antes
// «El tutorial» llevaba a Números y no aparecía si estabas en otra pestaña (11/11/2026). `nu-uso` ya no está en ninguna:
// son los cinco cuadros de arriba (23/11/2026)
const TAB_DE = { 'nu-vuelta': 'gente', 'nu-lobby': 'gente', 'nu-embudo': 'gente', 'nu-primerizos': 'gente', 'nu-acciones': 'acciones', 'nu-drops': 'acciones',
  'nu-semanas': 'semana', 'nu-clics': 'pagina', 'nu-tuto': 'pagina', 'nu-pase': 'pase', 'nu-puntos': 'puntos', 'nu-crews': 'crews' };
// 💬 LOS CHATS GENERALES (17/11/2026, `bot/chats.py`): lo que importó en el chat general de cada socio —eventos falsos,
// fraude, raids y estafas, quejas de la Liga— con el link al mensaje, y cuánto se habló en la última lectura. Lo demás
// del chat no se guarda. Cada servidor lo apaga en su panel
const MOTIVO_CHAT = { 'evento falso': '🚩', fraude: '⚠️', seguridad: '🛡️', 'queja de la liga': '💬' };
function ChatsDueno({ c }) {
  const [filtro, setFiltro] = useState('');
  const ms = [...((c && c.marcados) || [])].reverse();
  const motivos = [...new Set(ms.map((m) => m.motivo))];
  const ver = filtro ? ms.filter((m) => m.motivo === filtro) : ms;
  const sv = Object.entries((c && c.por_sv) || {}).sort((a, b) => b[1].msgs - a[1].msgs);
  // 🔤 la sigla que se lee (18/11/2026): `bot/chats.py` manda el código interno (ACAD, CH, SR, URBF) y el resto del
  // Dashboard muestra LCW, CYH, SNK, URB. Las `key` se quedan con el código
  return (
    <div className="dch">
      {sv.length ? <p className="dch-sv">{c.dia ? 'Lectura del ' + corto(c.dia) + ': ' : ''}{sv.map(([s, x]) => <span key={s}><b>{siglaDe(s)}</b> {num(x.msgs)}</span>)}</p> : null}
      {motivos.length > 1 ? (
        <div className="dz-subs" role="tablist" aria-label="Qué mostrar">
          {['', ...motivos].map((m) => <button key={m || 'todo'} type="button" role="tab" aria-selected={filtro === m} className={'dz-sub' + (filtro === m ? ' on' : '')}
            onClick={() => setFiltro(m)}>{m ? (MOTIVO_CHAT[m] || '') + ' ' + m : 'Todo'}</button>)}
        </div>) : null}
      {ver.length ? (
        <ul className="dch-l">{ver.slice(0, 80).map((m) => (
          <li key={m.id}>
            <span className="dch-c"><b>{MOTIVO_CHAT[m.motivo] || '•'} {m.motivo}</b><small>{siglaDe(m.sv)} · {corto(diaISO(new Date(m.t)))} {hora(new Date(m.t).toISOString())}</small></span>
            <p><b>{m.k ? <BotonFicha k={m.k} n={m.n} /> : null}{limpio(m.n) || 'alguien'}:</b> {m.texto}</p>
            <a href={'https://discord.com/channels/' + m.g + '/' + m.c + '/' + m.id} target="_blank" rel="noreferrer">Ver en Discord ↗</a>
          </li>))}</ul>
      ) : <p className="pronto-p">Nada que importe todavía: se lee una vez por día, desde las 12 PM.</p>}
    </div>
  );
}

// 📁 «MÁS NÚMEROS» (23/11/2026, la A de la maqueta): las siete pestañas de antes, PLEGADAS. Arrancan cerradas —arriba
// están los cinco cuadros— y se abre una al tocarla; tocarla otra vez la cierra. Ya no se acuerda de la última abierta
// (`lg:db-num`): abierta de entrada, Números volvía a ser largo. Un atajo a una sección (Ctrl+K, el Resumen) la abre igual
// 🔤 LA SIGLA DE UN SERVIDOR, EDITABLE (23/11/2026, Dlx: «I need to edit the SIGLAS, the 3 letters… DW should be 3 letters
// always»). Siempre 3 letras o números; una que ya usa otro no se puede. Se guarda en el ajuste `siglas` y el ciclo la escribe
// en datos/servidores.json (`aplicar_siglas()`), así que se ve en la próxima vuelta. La que no tiene 3 se marca
function SiglaEdit({ sv, pedida, usadas, ocup, guardar }) {
  const actual = siglaDe(sv);
  const [v, setV] = useState(pedida || actual);
  useEffect(() => { setV(pedida || actual); }, [pedida, actual]);
  const mal = !/^[A-Z0-9]{3}$/.test(v) ? 'tienen que ser 3' : v !== actual && v !== pedida && usadas.has(v) ? 'ya la usa otro' : '';
  const cambia = v !== (pedida || actual);
  return (
    <span className="dz-sigla">
      <input aria-label={'La sigla de ' + actual} value={v} maxLength={3} disabled={ocup} spellCheck={false}
        onChange={(e) => setV(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))}
        onKeyDown={(e) => { if (e.key === 'Enter' && cambia && !mal) guardar(v); }} />
      {cambia && !mal ? <button type="button" className="btn chico" disabled={ocup} onClick={() => guardar(v)}>Guardar</button> : null}
      {cambia && mal ? <small className="db-mal">{mal}</small>
        : pedida && pedida !== actual ? <small>pasa a {pedida} en la próxima vuelta</small>
          : actual.length !== 3 ? <small className="db-mal">tiene {actual.length} letras</small> : null}
    </span>
  );
}

function NumerosTabs({ tabs, abrir, pedido }) {
  const [t, setT] = useState('');
  // `pedido`: la misma sección pedida otra vez desde otra pestaña vuelve a abrir la suya (18/11/2026)
  useEffect(() => { if (abrir && TAB_DE[abrir]) setT(TAB_DE[abrir]); }, [abrir, pedido]);
  const xs = tabs.filter(Boolean);
  const actual = xs.find(([k]) => k === t) || null;
  if (!xs.length) return null;
  return (
    <section className="nc-mas" aria-label="Más números">
      <h3 className="dz-h">Más números<small>{actual ? 'toca otra vez para cerrar' : 'toca uno para abrirlo'}</small></h3>
      <div className="dz-subs" role="tablist" aria-label="Qué números">{xs.map(([k, tt]) => (
        <button key={k} type="button" role="tab" aria-selected={t === k} aria-expanded={t === k} className={'dz-sub' + (t === k ? ' on' : '')}
          onClick={() => setT(t === k ? '' : k)}>{tt}</button>
      ))}</div>
      {actual ? actual[2] : null}
    </section>
  );
}

// ── 🗂️ LA FICHA DE UNA PERSONA (25/10/2026, el research del Dashboard: «junta en un lugar lo que hoy está en varias
// áreas»; Dlx: «constrúyelo»). Se abre al costado desde cualquier nombre del Dashboard (`BotonFicha`) o buscándolo con
// Ctrl+K. Lo público —su puesto, sus eventos, sus duelos— sale de lo que la página ya tiene (`liga.T`, `/api/perfiles`);
// lo del staff —su cuenta, sus roles, sus Puntos, lo que mandó y las notas— del objeto (`duenoFicha()` de bot/avisos.js)
const FichaCtx = createContext(null);
// la función que abre una ficha, la misma en cada render (así los `BotonFicha` no se redibujan por nada)
function useCallbackFicha(setFicha) {
  const r = useRef(null);
  if (!r.current) r.current = (k, n) => setFicha([k, n || '']);
  return r.current;
}
const ETIQUETAS = [['nota', 'Nota'], ['ayuda', 'Ayuda'], ['aviso', 'Aviso'], ['sancion', 'Sanción']];
const PED_EST_C = { '': 'esperando', si: 'aprobado', hecho: 'hecho', no: 'no', no_pude: 'no se pudo' };
function BotonFicha({ k, n }) {
  const ctx = useContext(FichaCtx);
  if (!ctx || !k) return null;
  // 🗂️ con una sanción en pie, se ve al lado del nombre (no hace falta abrir la ficha para saberlo)
  const san = (ctx.sanciones || {})[k];
  // 📅 las tres fechas de la ficha (la sanción, el alta de la cuenta, el vencimiento de una nota) pasan por diaISO
  // (18/11/2026): con `toISOString()` iban en UTC, y lo anotado de tarde o de noche salía con un día de más
  return (
    <>
      {san !== undefined ? <span className="dz-san" title={san ? 'Sanción hasta el ' + corto(diaISO(new Date(san))) : 'Sanción sin fecha de fin'}>⚠ sanción</span> : null}
      <button type="button" className="dz-fbtn" onClick={() => ctx.abrir(k, n)} aria-label={'La ficha de ' + (n || k)}>ficha</button>
    </>
  );
}
async function pedirFicha(cuerpo, ruta) {
  const r = await fetch('/api/avisos/dueno/' + ruta, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(r.status === 401 ? 'la sesión venció: entra de nuevo' : j.error === 'no' ? 'no tienes permiso' : j.error || String(r.status));
  return j;
}
function FichaPersona({ k, n, liga, cerrar, puedeNotas }) {
  const [F, setF] = useState(null);
  const [err, setErr] = useState('');
  const [et, setEt] = useState('nota');
  const [txt, setTxt] = useState('');
  const [dias, setDias] = useState(0);
  const [ocup, setOcup] = useState(false);
  const P = usePerfiles();
  useEffect(() => {
    let vivo = true;
    setF(null); setErr('');
    pedirFicha({ k }, 'ficha').then((j) => { if (vivo) setF(j); }).catch((e) => { if (vivo) setErr(e.message); });
    return () => { vivo = false; };
  }, [k]);
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') cerrar(); };
    W.addEventListener && W.addEventListener('keydown', f);
    return () => { W.removeEventListener && W.removeEventListener('keydown', f); };
  }, [cerrar]);
  const p = P && P.p ? P.p[k] : null;
  const f = liga.T[k] || (p && p.f) || null;
  const nombre = limpio((f && f.n) || n || k);
  const evs = ((p && p.ev) || []).slice(0, 8);
  const du = (p && p.du) || [];
  const nota = async (cuerpo) => {
    setOcup(true); setErr('');
    try { const j = await pedirFicha(cuerpo, 'nota'); setF((x) => Object.assign({}, x, { notas: j.notas })); setTxt(''); setDias(0); }
    catch (e) { setErr('No se pudo: ' + e.message); }
    setOcup(false);
  };
  return (
    <div className="dz-lado-velo" onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <aside className="dz-lado dz-ficha" aria-label={'La ficha de ' + nombre}>
        <div className="dz-svt-c"><b className="dz-ficha-n">{nombre}</b><button type="button" className="btn borde2 chico" onClick={cerrar}>Cerrar · Esc</button></div>
        <p className="dz-dt-tx"><a href={'#/r/' + encodeURIComponent(k)}>Su perfil ↗</a>{f && f.sv ? ' · juega más en ' + siglaDe(f.sv) : ''}{f && f.cc ? ' · ' + String(f.cc).toUpperCase() : ''}</p>
        {f ? (
          <div className="dz-nums">
            <div className="dz-num"><span>temporada</span><b>{f.o || f.pos ? '#' + (f.pos || f.o) : '—'}</b><small>{num(f.pts || 0)} pts</small></div>
            <div className="dz-num"><span>eventos</span><b>{num(f.ev || 0)}</b><small>{f.ult && f.ult[0] ? 'el último el ' + corto(f.ult[0]) : 'en la T1'}</small></div>
            <div className="dz-num"><span>rango</span><b>{f.rg || '—'}</b><small>{f.rg ? 'Score ' + String(f.sc || 0).replace('.', ',') : 'pide 10 eventos'}</small></div>
          </div>
        ) : <p className="db-tx">No está en el ranking de la temporada.</p>}
        {evs.length ? (
          <div><h4 className="dz-h4">Sus últimos eventos</h4>
            <ul className="dz-lista">{evs.map(([en, puesto, pts]) => {
              const x = ((P && P.e) || {})[en] || ((P && P.e) || {})[String(en)] || [];
              const ds = du.filter((y) => y[0] === en);
              return <li key={en}><span>{limpio(x[0] || 'Evento ' + en)}{ds.length ? ' · ' + ds.filter((y) => y[2]).length + '–' + ds.filter((y) => !y[2]).length + ' en duelos' : ''}</span><b>{puesto}{pts ? ' · ' + num(pts) : ''}</b></li>;
            })}</ul></div>
        ) : null}
        {err && !F ? <p className="dz-dt-msg">No pude leer su ficha: {err}</p> : !F ? <p className="pronto-p">Leyendo su ficha…</p> : (
          <>
            <dl className="dz-dl">
              <div><dt>Cuenta en la página</dt><dd>{F.cuenta ? 'Sí, desde el ' + corto(diaISO(new Date(F.cuenta.desde))) : 'No: no le llegan avisos de la página'}</dd></div>
              {F.roles && F.roles.length ? <div><dt>En el Dashboard</dt><dd>{F.roles.map(nombreRol).join(', ')}</dd></div> : null}
              {F.saldo != null ? <div><dt>Puntos de Tienda</dt><dd>{num(F.saldo)}</dd></div> : null}
              {F.vuelve ? <div><dt>Se le avisó que vuelva</dt><dd>{hace(F.vuelve.t)} · {F.vuelve.por}</dd></div> : null}
              {(F.reportes || []).length ? <div><dt>Reportes que mandó</dt><dd>{F.reportes.map((r) => (/^\d+$/.test(String(r.llave)) ? '#' + r.llave : etiquetaRep(r).toLowerCase()) + ' (' + (QUE_REP[r.que] || r.que) + ', ' + (ESTADO_REP[r.estado] || [r.estado || 'abierto'])[0] + ')').join(' · ')}</dd></div> : null}
              {(F.pedidos || []).length ? <div><dt>Pedidos</dt><dd>{F.pedidos.map((x) => (PED_TIPO[x.tipo] || x.tipo) + ' · ' + (PED_EST_C[x.estado] || x.estado)).join(' · ')}</dd></div> : null}
            </dl>
            <div className="dz-notas">
              <h4 className="dz-h4">Notas del staff · {(F.notas || []).length}</h4>
              {(F.notas || []).length ? <ul className="dz-notas-l">{F.notas.map((x) => (
                <li key={x.id}>
                  <span className={'dz-et ' + x.et}>{(ETIQUETAS.find((y) => y[0] === x.et) || [0, x.et])[1]}</span>
                  <p>{x.texto}</p>
                  <small>{x.por} · {hace(x.t)}{x.hasta ? (x.hasta > Date.now() ? ' · vence ' + corto(diaISO(new Date(x.hasta))) : ' · venció') : ''}</small>
                  {puedeNotas ? <DosToques className="dz-lnk" disabled={ocup} confirmar="Toca de nuevo para borrarla" onClick={() => nota({ borrar: x.id })}>Borrar</DosToques> : null}
                </li>
              ))}</ul> : <p className="db-tx">Todavía nadie anotó nada.</p>}
              {puedeNotas ? (
                <form className="dz-nota-f" onSubmit={(e) => { e.preventDefault(); if (txt.trim()) nota({ k, et, texto: txt, dias: et === 'sancion' ? dias : 0 }); }}>
                  <div className="dz-subs" role="radiogroup" aria-label="Qué es">{ETIQUETAS.map(([c, t]) => (
                    <button key={c} type="button" role="radio" aria-checked={et === c} className={'dz-sub' + (et === c ? ' on' : '')} onClick={() => setEt(c)}>{t}</button>
                  ))}</div>
                  <textarea rows={2} maxLength={300} value={txt} placeholder="Qué pasó, en una o dos frases" aria-label="La nota" onChange={(e) => setTxt(e.target.value)} />
                  <div className="dz-acc">
                    {et === 'sancion' ? <select value={dias} aria-label="Hasta cuándo" onChange={(e) => setDias(Number(e.target.value))}>
                      {[[0, 'Sin fecha de fin'], [1, '1 día'], [3, '3 días'], [7, '7 días'], [30, '30 días']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select> : null}
                    <button type="submit" className="btn verde chico" disabled={ocup || !txt.trim()}>Anotar</button>
                  </div>
                  <p className="db-tx">La ve todo el staff, con tu nombre. La sanción con fecha es para recordarla: no frena nada sola.</p>
                </form>
              ) : null}
              {err && F ? <p className="dz-dt-msg" role="alert">{err}</p> : null}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function Dashboard({ dc, liga }) {
  const [st, setSt] = useState({ cargando: true });
  // la visita anterior: se lee una vez al abrir y se anota la de ahora
  const [prev] = useState(leerVisita);
  const [actualizado, setActualizado] = useState(0);
  useEffect(() => {
    if (!dc) { setSt({ sinCuenta: true }); return undefined; }
    let vivo = true;
    pedirDueno().then((x) => { if (vivo) { setSt(x); setActualizado(Date.now()); } });
    return () => { vivo = false; };
  // ⚠️ por el id y no por el objeto: `dc` es uno nuevo en cada evento de la página (`quienMira()`), y el Dashboard
  // se volvía a pedir —con GitHub y lo en vivo— cada vez (revisión del 05/10/2026)
  }, [dc && dc.id]);
  useEffect(() => { W.scrollTo && W.scrollTo(0, 0); }, []);
  const cuotas = useCuotas(!!st.d);
  // 🔴 lo de Logs, sólo para quien puede los ajustes (el Worker también lo pide)
  const logs = useLogs(!!st.d && (!(st.d.permisos) || st.d.permisos.includes('ajustes')));
  const retencion = useRetencion(!!st.d);
  // 📊 las semanas, para «Comparar semanas» (Números)
  const semanas = useSemanas(!!st.d);
  // `ajustar()` devuelve los ajustes y el historial (ver `ajuste()` en avisos.js)
  const onAj = (r) => setSt((x) => (x.d ? { d: Object.assign({}, x.d, { ajustes: r.ajustes }, r.hist ? { ajustes_hist: r.hist } : {}) } : x));
  const { hacer, msg, ocup, aviso, deshacer, cerrarAviso } = useHacer(onAj, () => (st.d && st.d.ajustes) || {});
  // lo que cambia un área (un reporte, una respuesta) vuelve al panel: así los números de los cuadrados están al día
  const cambiarD = (o) => setSt((x) => (x.d ? { d: Object.assign({}, x.d, o) } : x));
  const [area, setArea0] = useState(leerArea);
  // 📌 lo que salió cada semana, para las marcas de Números (sólo se pide al abrir Números)
  const cambios = useCambios(!!st.d && area === 'numeros');
  // la cola que se abre: la que se eligió, o sola la primera que tiene algo
  const [sub, setSub] = useState('');
  const [abrir, setAbrir] = useState('');
  // 🔁 cuántas veces se pidió ir (18/11/2026): pedir la misma ancla dos veces no cambia `abrir`, y los efectos que abren
  // la pestaña de Números o la fila del ajuste no volvían a correr (Ctrl+K → «El tutorial», otra pestaña, otra vez)
  const [pedido, setPedido] = useState(0);
  const [buscar, setBuscar] = useState(false);
  const raiz = useRef(null);
  // ir a un área (y bajar hasta un ajuste, o abrir una cola de Pendientes)
  const ir = (a, ancla, s) => {
    setArea0(a); ponerArea(a);
    setSub(s || '');
    setAbrir(ancla || '');
    setPedido((n) => n + 1);
    setTimeout(() => {
      const el = ancla && raiz.current ? raiz.current.querySelector('#' + ancla) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (raiz.current) raiz.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };
  // ⌨️ Ctrl+K (o Cmd+K) abre el buscador
  useEffect(() => {
    const f = (e) => { if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setBuscar((b) => !b); } };
    W.addEventListener && W.addEventListener('keydown', f);
    return () => { W.removeEventListener && W.removeEventListener('keydown', f); };
  }, []);
  // 🔄 SE PONE AL DÍA SOLO en el Resumen y en Salud, cada 2 minutos y sólo con la pestaña a la vista. En las áreas donde
  // se escribe no: un formulario a medio llenar se pisaría con lo que llega
  useEffect(() => {
    if (!st.d || (area !== 'resumen' && area !== 'salud')) return undefined;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      pedirDueno().then((x) => { if (x.d) { setSt(x); setActualizado(Date.now()); } });
    }, 120000);
    return () => clearInterval(id);
  }, [area, !!st.d]); // eslint-disable-line react-hooks/exhaustive-deps
  const [, tic] = useState(0);
  useEffect(() => { const id = setInterval(() => tic((n) => n + 1), 30000); return () => clearInterval(id); }, []);
  const [panel, setPanel] = useState(() => !panelCerrado());
  // 📱 la hoja de las áreas del teléfono («<área> ▾»): se cierra al elegir, con Escape o tocando afuera
  const [hojaNav, setHojaNav] = useState(false);
  const elegirRef = useRef(null);
  const hojaRef = useRef(null);
  useEffect(() => {
    if (!hojaNav) return undefined;
    const f = (e) => { if (e.key === 'Escape') { setHojaNav(false); if (elegirRef.current) elegirRef.current.focus(); } };
    W.addEventListener && W.addEventListener('keydown', f);
    const id = setTimeout(() => { const b = hojaRef.current && (hojaRef.current.querySelector('.dz-a.on') || hojaRef.current.querySelector('.dz-a')); if (b) b.focus(); }, 30);
    return () => { clearTimeout(id); W.removeEventListener && W.removeEventListener('keydown', f); };
  }, [hojaNav]);
  // 🗂️ la ficha abierta: `[clave, nombre]`
  const [ficha, setFicha] = useState(null);
  // 🎛️ a quién abrir en «Dar o sacar un rol» cuando se toca «Cambiar» en la lista
  const [elegido, setElegido] = useState(null);
  const abrirFicha = useCallbackFicha(setFicha);

  let cuerpo;
  if (st.cargando) cuerpo = <p className="pronto-p">Cargando…</p>;
  else if (st.sinCuenta) {
    cuerpo = (<><p className="pronto-p">Esta página es del dueño de la Liga. Entra con tu cuenta de Discord.</p>
      <div className="cu-btns"><button type="button" className="btn verde chico" onClick={entrar}>Entrar con Discord</button></div></>);
  } else if (st.no) cuerpo = <p className="pronto-p">Esta página es sólo del dueño de la Liga.</p>;
  else if (st.error) cuerpo = <p className="pronto-p">No pude leerlo ({st.error}). Prueba en un rato.</p>;
  if (cuerpo) return <section className="sec db"><style>{ESTILO}</style><div className="sec-t"><h1>Dashboard</h1></div>{cuerpo}</section>;

  const d = st.d || {};
  const aj = d.ajustes || {};
  const u = d.uso || {};
  // 🔐 QUÉ PUEDE QUIEN MIRA (13/10/2026): el objeto lo dice (`permisos`); sin eso es Dlx con todo (un Worker de antes)
  const pm = d.permisos || ['panel', 'ajustes', 'ciclo', 'reportes', 'reportes_cerrar', 'decidir', 'videos', 'fondos', 'roles'];
  const ve = (k) => pm.includes(k);
  const cl0 = d.crews_logos || {};
  const nSub0 = (k) => ({ quien: sinContestar(d.decidir), llaves: (d.reportes || []).filter((x) => x.estado === '' || x.estado === 'no_pude').length,
    imagenes: (d.fondos || []).length + (d.fotos_carta || []).length + (cl0.pend || []).length + (d.videos || []).length,
    pedidos: (d.pedidos || []).filter((x) => x.estado === '').length })[k] || 0;
  const verSub = { quien: ve('decidir'), llaves: ve('reportes') || ve('reportes_cerrar'), imagenes: ve('fondos'), videos: ve('videos') || ve('fondos'), pedidos: ve('reportes_cerrar') };
  const visibles = { resumen: true, pendientes: Object.values(verSub).some(Boolean), servidores: ve('ajustes'), web: ve('ajustes'),
    numeros: ve('ajustes'), salud: ve('ajustes'), historial: ve('ajustes'), roles: ve('roles'),
    control: ve('reportes') || ve('ajustes') || ve('fondos') };
  const areaV = visibles[area] ? area : 'resumen';
  const subV = verSub[sub] ? sub : (SUBP.find(([k]) => verSub[k] && nSub0(k)) || SUBP.find(([k]) => verSub[k]) || ['quien'])[0];
  // lo que espera algo de ti, por cola
  const cl = d.crews_logos || {};
  const n = {
    quien: sinContestar(d.decidir),
    llaves: (d.reportes || []).filter((x) => x.estado === '' || x.estado === 'no_pude').length,
    imagenes: (d.fondos || []).length + (d.fotos_carta || []).length + (cl.pend || []).length,
    videos: (d.videos || []).length,
    pedidos: (d.pedidos || []).filter((x) => x.estado === '').length,
  };
  const total = n.quien + n.llaves + n.imagenes + n.videos + n.pedidos;
  const nSub = { quien: n.quien, llaves: n.llaves, imagenes: n.imagenes + n.videos, pedidos: n.pedidos };
  // una sección del Dashboard: el mismo título y la misma caja que lo nuevo (antes la barrita fina del Inicio, con el
  // subtítulo en magenta: dos estilos de título en la misma página)
  const sec = (id, titulo, em, hijo) => <section className="dz-sec" id={id || undefined}><h3 className="dz-h">{titulo}{em ? <small>{em}</small> : null}</h3>{hijo}</section>;
  const at = atencion(d, liga, cuotas, logs);
  const sal = saludDe(d, cuotas);
  const nuevo = desdeVisita(d, prev, logs);
  const prog = programado(aj, liga);
  const primeroRep = (d.reportes || []).find((x) => x.estado === '');
  const primerPed = (d.pedidos || []).find((x) => x.estado === '');
  const CUADROS = [
    ['llaves', n.llaves, 'Reportes de la gente', primeroRep ? etiquetaRep(primeroRep).toLowerCase() + (primeroRep.de ? ' · lo reportó ' + primeroRep.de : '') : 'reportados por la gente', true, 'llaves'],
    ['quien', n.quien, '¿Quién es quién?', 'nombres que el bot no reconoció', true, 'quien'],
    ['imagenes', n.imagenes, 'Imágenes', 'fondos, fotos de carta y logos', false, 'imagenes'],
    ['videos', n.videos, 'Videos', 'alguien dice «es mío»', false, 'videos'],
    ['pedidos', n.pedidos, 'Pedidos', primerPed ? PED_TIPO[primerPed.tipo] || primerPed.tipo : 'cuenta perdida, país, un video', false, 'pedidos'],
  ].filter((x) => verSub[x[5]]);
  const hora0 = new Date();
  const saludo = hora0.getHours() < 12 ? 'Buenos días' : hora0.getHours() < 20 ? 'Buenas tardes' : 'Buenas noches';

  let vista;
  if (areaV === 'resumen') {
    // ── 🧱 EL TABLERO (21/11/2026, la maqueta «Mods y paneles», opción B; Dlx: «para los dashboard me gustan los
    // tableros»). Un cuadro grande con lo que espera y, alrededor, un cuadro por pregunta: ¿anda todo?, ¿cuánto se jugó?,
    // ¿cómo están los servidores? Todo lo que tenía el Resumen sigue acá: la salud, los cuadrados de «Para decidir» (ahora
    // filas del cuadro grande), lo que pide atención, desde tu última visita, lo programado, la semana y lo en vivo.
    // Cuadros planos separados por tono (`--caja`), sin bordes adentro de bordes ni sombras; en el teléfono, una columna
    const enCola = CUADROS.filter((x) => x[1]);
    const enCero = CUADROS.filter((x) => !x[1]);
    const J = jugadosDe(liga);
    const elegidos = aj.tiers || {};
    const tiersT = ((d.tiers || {}).servidores || []).length ? d.tiers.servidores
      : Object.values(liga.svs || {}).filter((x) => x.tier).map((x) => ({ sv: x.sv, tier: x.tier }));
    const porTier = [1, 2, 3].map((t) => [t, tiersT.filter((x) => (elegidos[x.sv] || x.tier || 1) === t)]).filter(([, xs]) => xs.length);
    const corr = (d.corridas || []).slice(0, 14).reverse();
    const estCorr = (c) => (c.estado !== 'completed' ? 'va' : !c.fin || c.fin === 'success' || c.fin === 'skipped' || c.fin === 'neutral' ? 'ok' : 'mal');
    const semana = semanaCortaHoy();
    const dd = d.dias || [];
    const ultDia = dd.length ? dd[dd.length - 1] : null;
    // 🏷️ lo que pide atención, con su nombre en vez de un emoji (la regla del brain: nada de emojis como íconos)
    const ET_AT = { '🔴': ['URGENTE', 'mal'], '⏸': ['EN PAUSA', 'ojo'], '📋': ['REVISAR', 'ojo'] };
    const frase = [ve('ajustes') ? (sal.ok ? 'Todo anda' : 'Hay algo que mirar en la salud') : '',
      total ? (total === 1 ? 'hay 1 cosa para decidir' : 'hay ' + num(total) + ' cosas para decidir') : 'no hay nada para decidir'].filter(Boolean).join(' y ');
    vista = (
      <>
        <div className="dz-cab dzt-cab">
          <h2 className="dz-h1">{saludo}{d.yo ? ', ' + d.yo : ''}</h2>
          <p className="dzt-frase">{frase.replace(/^./, (c) => c.toUpperCase())}.</p>
        </div>
        <div className="dzt-g">
          {/* 🟥 lo que espera tu decisión: el total grande y las colas que tienen algo, la más urgente arriba */}
          <section className="dzt-t dzt-grande" aria-label="Para decidir">
            <h3 className="dzt-h">Para decidir{enCola.length ? <small>{enCola.length === 1 ? 'una cola' : enCola.length + ' colas'}</small> : null}</h3>
            <p className={'dzt-n' + (total ? '' : ' cero')}>{num(total)}<small>{total ? (total === 1 ? 'espera' : 'esperan') : 'nada espera'}</small></p>
            {enCola.length ? (
              <ul className="dzt-filas">{enCola.slice(0, 3).map(([k, c, t, sub, urg, a]) => (
                <li key={k}><button type="button" className="dzt-fila" onClick={() => ir('pendientes', '', a)}>
                  <b className={urg ? 'urg' : 'ojo'}>{num(c)}</b><span><em>{t}</em><small>{sub}</small></span>
                </button></li>
              ))}</ul>
            ) : null}
            {enCola.length > 3 ? <p className="dzt-mas">Y también: {enCola.slice(3).map((x) => x[2] + ' (' + num(x[1]) + ')').join(' · ')}</p> : null}
            {enCero.length ? <p className="dz-aldia">✓ Al día: {enCero.map((x) => x[2]).join(' · ')}</p> : null}
            {visibles.pendientes ? <button type="button" className="dzt-ir" onClick={() => ir('pendientes')}>Ir a Pendientes</button> : null}
          </section>
          {/* 💚 la salud: la frase de siempre y las últimas vueltas del ciclo, una por cuadrito */}
          {ve('ajustes') ? (
            <section className={'dzt-t dzt-salud' + (sal.ok ? '' : ' mal')} aria-label="Salud">
              <h3 className="dzt-h">Salud<button type="button" className="dz-lnk" onClick={() => ir('salud')}>Ver la salud</button></h3>
              <p className="dzt-est"><span className="dz-pt" aria-hidden="true" />{sal.ok ? <b>Todo anda.</b> : <b>Ojo: {sal.mal.join(' · ')}.</b>}</p>
              {corr.length ? (
                <div className="dzt-vueltas">
                  <span className="dzt-cuad" role="img" aria-label={'Las últimas ' + corr.length + ' vueltas del ciclo: ' + corr.filter((c) => estCorr(c) === 'mal').length + ' con problemas'}>
                    {corr.map((c) => <i key={c.creada} className={estCorr(c)} title={(c.empezo || c.creada ? hora(new Date(c.empezo || c.creada)) + ' · ' : '') + (c.estado === 'completed' ? (FIN_CORRIDA[c.fin] || c.fin || 'terminó') : (ESTADO_CORRIDA[c.estado] || c.estado))} />)}
                  </span>
                  <small>las últimas {corr.length} vueltas del ciclo</small>
                </div>
              ) : null}
              {sal.partes.length ? <ul className="dzt-partes">{sal.partes.map((x) => <li key={x}>{x.replace(/^./, (c) => c.toUpperCase())}</li>)}</ul> : null}
            </section>
          ) : null}
          {/* 📊 los eventos jugados, día por día (los del calendario con llave leída) */}
          <section className="dzt-t dzt-jug" aria-label="Eventos jugados">
            <h3 className="dzt-h">Jugados<small>7 días</small></h3>
            <div className="dzt-barras" role="img" aria-label={num(J.total) + ' eventos jugados en 7 días'}>
              {J.xs.map(([dia, c]) => (
                <div key={dia} className={dia === J.hoy ? 'hoy' : ''} title={corto(dia) + ' · ' + c + (c === 1 ? ' evento' : ' eventos')}>
                  <b>{c || ''}</b><i><u style={{ height: (J.tope ? (100 * c) / J.tope : 0).toFixed(1) + '%' }} /></i><span>{Number(dia.slice(8, 10))}</span>
                </div>
              ))}
            </div>
            <p className="dzt-pie">{J.total ? num(J.total) + (J.total === 1 ? ' evento' : ' eventos') + ' · ' + num(J.tope) + ' el ' + J.fuertes.map(corto).join(' y el ') : 'Ningún evento con llave en estos 7 días.'}</p>
            {ultDia ? <p className="dzt-pie">Hoy: {num(ultDia.bot || 0)} usaron el bot · {num(ultDia.visitas || 0)} abrieron la página · <button type="button" className="dz-lnk" onClick={() => ir('numeros', 'nu-uso')}>Números</button></p> : null}
          </section>
          {/* 🏟️ los socios por tier, cada uno con su color */}
          {visibles.servidores && porTier.length ? (
            <section className="dzt-t dzt-svs" aria-label="Servidores">
              <h3 className="dzt-h">Servidores<small>{num(tiersT.length)} socios</small></h3>
              <ul className="dzt-tiers">{porTier.map(([t, xs]) => (
                <li key={t}><b>Tier {t}</b><span>{xs.map((x) => {
                  const c = ((liga.svs || {})[x.sv] || {}).color || '#7E8B89';
                  return <button key={x.sv} type="button" className={'dzt-sv' + (x.rec === 'revisar' ? ' rev' : '')} style={{ background: c, color: tintaSobre(c) }}
                    title={siglaDe(x.sv) + ' · Tier ' + t + (x.rec === 'revisar' ? ' · revisar su tier' : '')} onClick={() => ir('servidores', 'sv-cada')}>{siglaDe(x.sv)}</button>;
                })}</span></li>
              ))}</ul>
              <button type="button" className="dz-lnk" onClick={() => ir('servidores')}>Ver los servidores</button>
            </section>
          ) : null}
          {/* 📅 lo que está programado o prendido a mano */}
          <section className="dzt-t dzt-prog" aria-label="Lo que está programado">
            <h3 className="dzt-h">Programado</h3>
            {prog.length ? <ul className="dz-lista">{prog.map(([t, s, a, an]) => (
              <li key={t}><span><b>{t}</b> · {s}</span><button type="button" className="dz-lnk" onClick={() => ir(a, an)}>Cambiar</button></li>
            ))}</ul> : <p className="db-tx">Nada programado ni prendido a mano.</p>}
          </section>
          {/* lo que pide atención, con un botón que lleva a donde se arregla */}
          {at.length ? (
            <section className="dzt-t dzt-todo dzt-at" aria-label="Pide atención">
              <h3 className="dzt-h">Pide atención<small>{at.length === 1 ? 'una cosa' : at.length + ' cosas'}</small></h3>
              <ul>{at.map(([ic, t, s, a, an]) => {
                const [et, cl] = ET_AT[ic] || ['OJO', 'ojo'];
                return (
                  <li key={t} className={cl}><em>{et}</em><div><b>{t}</b>{s ? <small>{s}</small> : null}</div>
                    {a ? <button type="button" className="btn borde2 chico" onClick={() => ir(a, an)}>Ir</button> : null}</li>
                );
              })}</ul>
            </section>
          ) : null}
          {(d.vivo || []).length ? (
            <section className="dzt-t dzt-todo" aria-label="En vivo ahora">
              <h3 className="dzt-h">En vivo ahora<small>se pone al día solo</small></h3>
              <EnVivo vivo={d.vivo} liga={liga} aj={aj} chat={d.chat} />
            </section>
          ) : null}
          {/* 🕓 lo que pasó mientras no estabas */}
          <section className={'dzt-t ' + (semana ? 'dzt-ancho' : 'dzt-todo')} aria-label="Desde tu última visita">
            <h3 className="dzt-h">Desde tu última visita{prev ? <small>{hace(prev)}</small> : null}</h3>
            {!nuevo ? <p className="db-tx">Es la primera vez que lo abres así: desde la próxima, acá aparece lo que pasó mientras no estabas.</p>
              : !nuevo.length ? <p className="db-tx">Nada nuevo desde entonces.</p>
                : <ul className="dz-lista">{nuevo.map(([t, tx, a, s]) => (
                  <li key={t + tx}><span className="dz-hora">{hora(new Date(t))}</span><button type="button" className="dz-lnk" onClick={() => ir(a, '', s)}>{tx}</button></li>
                ))}</ul>}
          </section>
          <SemanaCorta d={d} retencion={retencion} ir={ir} clase="dzt-t" />
        </div>
      </>
    );
  } else if (areaV === 'pendientes') {
    vista = <Bandeja d={d} liga={liga} ve={ve} cambiarD={cambiarD} sub={sub} />;
  } else if (areaV === 'servidores') {
    vista = (
      <>
        {msg ? <p className="db-msg dz-msg" role="status">{msg}</p> : null}
        {sec('sv-cada', 'LOS SERVIDORES', 'una fila cada uno: se cambia ahí mismo',
          <ServidoresTabla liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={d.chat} T={d.tiers} origen={(d.primerizos || {}).por_sv} />)}
        {sec('sv-consejo', 'EL CONSEJO DE SOCIOS', 'propones, votan los Tier 1 y 2, y tienes 48 h para vetar', <Consejo />)}
        {sec('sv-nuevo', 'LO NUEVO PRIMERO', 'lo que los Tier 1 prueban antes que el resto', <LoNuevoT1 aj={aj} hacer={hacer} ocup={ocup} />)}
        {(d.setup || []).length ? sec('sv-setup', 'LOS QUE CORRIERON /setup', 'sus puntos de Temporada esperan tu respuesta',
          <SetupNuevos lista={d.setup} aj={aj} hacer={hacer} ocup={ocup} />) : null}
        {d.tiers ? sec('sv-sumar', 'SUMAR UN SERVIDOR', d.tiers.t ? 'el puntaje, medido ' + hace(d.tiers.t) : null,
          <SumarServidor T={d.tiers} aj={aj} hacer={hacer} ocup={ocup} />) : null}
        {d.organizadores && (d.organizadores.sv || []).length ? sec('sv-org', 'LOS ORGANIZADORES Y EL BOT',
          'cuando el bot no entiende una llave, le pregunta a quien la publicó · ' + hace(d.organizadores.t),
          <Organizadores o={d.organizadores} />) : null}
      </>
    );
  } else if (areaV === 'web') {
    vista = (
      <>
        {msg ? <p className="db-msg dz-msg" role="status">{msg}</p> : null}
        <AjustesFilas liga={liga} aj={aj} hacer={hacer} ocup={ocup} chat={d.chat} ir={ir} abrir={abrir} pedido={pedido} sis={d.sistema} />
      </>
    );
  } else if (areaV === 'numeros') {
    const S = d.secciones && Object.keys(d.secciones.n || {}).length ? d.secciones : null;
    vista = (
      <>
      {/* 👥 arriba, los cinco cuadros (23/11/2026); lo demás, plegado en «Más números» */}
      <CincoCuadros uso={d.uso_semanas} S={semanas} h={d.historico} />
      {/* 👀 quién está ahora, a qué hora entra la gente, con y sin cuenta, y el staff: con nombre, sólo Dlx (23/11/2026) */}
      <AhoraYQuien liga={liga} />
      <NumerosTabs abrir={abrir} pedido={pedido} tabs={[
        // 👥 «La gente» tenía siete secciones (11/11/2026, Dlx: «Números en pestañas»): lo de quién vuelve y lo de la semana
        ['gente', 'Quién vuelve', <>
          {sec('nu-vuelta', 'LA VUELTA AL SEGUNDO EVENTO', 'el número del 42 %', <VueltaSegundo r={retencion} marcas={marcasPorSemana(cambios, d.ajustes_hist)} />)}
          {sec('nu-lobby', '¿VUELVE LA GENTE?', 'la meta del research', <MetaLobby r={retencion} />)}
          {d.primerizos ? sec('nu-embudo', 'EL EMBUDO DEL PRIMERIZO', 'dónde se queda la gente nueva', <Embudo e={d.primerizos.embudo} />) : null}
          {d.primerizos !== undefined ? sec('nu-primerizos', 'A QUIÉN TRAER DE VUELTA', 'con nombre: sólo lo ve el staff',
            <PrimerizosLista P={d.primerizos} vuelve={d.vuelve} liga={liga} alVuelve={(v) => cambiarD({ vuelve: v })} />) : null}
        </>],
        ['semana', 'Día por día y semanas', <>
          {/* 🔑 se vuelve a montar cuando llegan las semanas (18/11/2026): sus dos `useState` arrancan con las que hay, y
              abriendo directo en esta pestaña llegaban null y quedaba comparando la primera semana contra sí misma */}
          {sec('nu-semanas', 'COMPARAR SEMANAS', 'de lunes a domingo, en hora del este', <CompararSemanas key={semanas ? 'si' : 'no'} S={semanas} uso={d.uso_semanas} liga={liga} />)}
          {(d.dias || []).length ? sec('', 'DÍA POR DÍA · DOS SEMANAS', 'hasta hoy', <Dias dias={d.dias} />) : null}
          {(u.llegadas || []).length ? sec('', 'DE QUÉ LINK LLEGARON · 30 DÍAS', 'las visitas nuevas con ?de= en el link', <Llegadas l={u.llegadas} />) : null}
        </>],
        S || d.clics || (d.tutorial && Object.keys(d.tutorial.n || {}).length) ? ['pagina', 'La página', <>
          {S ? sec('nu-clics', 'QUÉ SECCIONES SE ABREN · 7 DÍAS', S.desde ? 'se cuenta desde el ' + corto(S.desde) : null, <SeccionesNumeros s={S} />) : null}
          {S && Object.keys(S.n || {}).some((k) => /^[ip]-/.test(k)) ? sec('', 'QUÉ SE TOCA EN EL INICIO · 7 DÍAS', S.desde ? 'se cuenta desde el ' + corto(S.desde) : null, <SeccionesNumeros s={S} toques />) : null}
          {d.clics ? sec('', 'QUÉ SE TOCA EN TODA LA PÁGINA · 7 DÍAS', d.clics.desde ? 'se cuenta desde el ' + corto(d.clics.desde) : null, <ClicsNumeros c={d.clics} />) : null}
          {d.tutorial && Object.keys(d.tutorial.n || {}).length ? sec('nu-tuto', 'EL TUTORIAL · DOS SEMANAS',
            d.tutorial.desde ? 'se cuenta desde el ' + corto(d.tutorial.desde) : null, <TutorialNumeros t={d.tutorial} />) : null}
        </>] : null,
        d.pase ? ['pase', 'El Pase', sec('nu-pase', 'EL PASE DE RAPERO', d.pase.semana ? 'la semana del ' + corto(d.pase.semana) : null, <PaseNumeros p={d.pase} liga={liga} />)] : null,
        d.economia !== undefined ? ['puntos', 'Los Puntos', sec('nu-puntos', 'LOS PUNTOS DE TIENDA', 'qué entra, qué sale y quién tiene cuánto', <Economia e={d.economia} liga={liga} />)] : null,
        d.crews_num ? ['crews', 'Las crews', sec('nu-crews', 'LAS CREWS · 7 DÍAS', 'contra los 7 de antes', <CrewsNumeros c={d.crews_num} />)] : null,
        d.chats ? ['chats', 'Los chats', sec('nu-chats', 'LOS CHATS GENERALES', 'lo que importó · 30 días · sólo lo ve el staff', <ChatsDueno c={d.chats} />)] : null,
        // 🧾🐉 qué hace cada uno y dónde, y los Dragón Drops (23/11/2026)
        ['acciones', 'Qué hace la gente', <>
          {sec('nu-acciones', 'QUÉ HACE LA GENTE Y DÓNDE · 7 DÍAS', 'personas distintas · nunca quién', <QueHace a={d.acciones} />)}
          {sec('nu-drops', 'LOS DRAGÓN DROPS · 7 DÍAS', 'contra los 7 de antes', <DropsNumeros r={d.drops_res} />)}
        </>],
      ]} />
      </>
    );
  } else if (areaV === 'salud') {
    vista = (
      <>
        <SaludPiezas d={d} q={cuotas} logs={logs} ir={ir} />
        {sec('sa-corridas', 'EL CICLO Y EL LECTOR', 'se pone al día solo', <><Corridas corridas={d.corridas} s={d.sistema || {}} github={d.github} /><Sistema s={d.sistema || {}} sesiones={d.sesiones} /></>)}
        {sec('sa-cuotas', 'LO QUE GASTA CLOUDFLARE HOY', 'el plan gratis · se renueva a las ' + hora(renuevaKV()), <Cuotas q={cuotas} />)}
        {sec('sa-logs', 'LO QUE AVISÓ LOGS', 'los 🔴 y ⚠️ de los últimos 3 días', <Logs l={logs} />)}
        {sec('sa-errores', 'ERRORES DE LA PÁGINA · 7 DÍAS', 'nunca de quién', <ErroresPagina e={d.errores_pag} />)}
        {d.dash_med !== undefined ? sec('sa-dash', 'EL PROPIO DASHBOARD', 'cuánto tarda lo que llega', <DashMed m={d.dash_med} />) : null}
        {sec('sa-atajos', 'ATAJOS', null, <ul className="db-atajos">{ATAJOS.map(([t, h]) => (
          <li key={h}><a href={h} target={h[0] === '/' ? undefined : '_blank'} rel={h[0] === '/' ? undefined : 'noopener noreferrer'}>{t} ↗</a></li>
        ))}</ul>)}
      </>
    );
  } else if (areaV === 'control') {
    vista = (
      <>
        {ve('reportes') ? sec('co-llaves', 'QUÉ LLAVES CUENTAN', 'sacar una del ranking, o devolverla',
          <LlavesCuentan L={d.llaves_cuenta} liga={liga} alCambiar={(x) => cambiarD({ llaves_cuenta: x })} />) : null}
        {ve('ajustes') ? sec('co-vs', 'EL FONDO DEL VS EN VIVO', 'uno por servidor: el bot lo usa desde el próximo cruce',
          <FondosVs F={d.vs_fondos || {}} svs={[...new Set([...svsDe(d.chat, aj), ...((d.tiers || {}).servidores || []).map((x) => x.sv)])]} liga={liga}
            alCambiar={(x) => cambiarD({ vs_fondos: x })} />) : null}
        {ve('fondos') ? sec('co-fondos', 'LOS FONDOS DE LA GENTE QUE YA SE VEN', 'quitar uno que no tenía que pasar',
          <FondosVistos fs={d.fondos_vistos || []} liga={liga} />) : null}
      </>
    );
  } else if (areaV === 'roles') {
    vista = (
      <>
        {sec('ro-quien', 'QUIÉN TIENE UN ROL DEL DASHBOARD', 'y qué puede hacer hoy',
          <QuienTieneRol roles={d.roles} P={d.permisos_roles} alElegir={(id) => { setElegido({ id, t: Date.now() }); ir('roles', 'ro-dar'); }} />)}
        {sec('ro-permisos', 'QUÉ PUEDE CADA ROL', 'sólo tú lo cambias',
          <TablaPermisos P={d.permisos_roles} alCambiar={(n) => cambiarD({ permisos_roles: n })} />)}
        {sec('ro-dar', 'DAR O SACAR UN ROL', 'los del Dashboard, y corregir los que salen solos',
          <Roles roles={d.roles} tabla={d.permisos_roles} elegido={elegido} alCambiar={(y) => cambiarD({ roles: y })} />)}
      </>
    );
  } else {
    vista = (
      <>
        {sec('hi-hist', 'LOS ÚLTIMOS CAMBIOS', 'deshacer vuelve a como estaba', <HistorialDeA hist={d.ajustes_hist} hacer={hacer} ocup={ocup} liga={liga} />)}
        {ve('ajustes') ? sec('hi-socios', 'LO QUE TOCARON LOS SOCIOS', 'en sus paneles · sólo lo ves tú · un año', <RegistroSocios />) : null}
      </>
    );
  }
  const titulo = (AREAS.find(([k]) => k === areaV) || [])[1];
  return (
    <FichaCtx.Provider value={{ abrir: abrirFicha, sanciones: d.sanciones }}>
    <section className="sec db dz" ref={raiz}>
      <style>{ESTILO}</style>
      {d.mis_roles && !d.mis_roles.includes('owner') ? <p className="db-rol">Entraste como <b>{(d.mis_roles || []).map((r) => ({ admin: 'Admin', asistente: 'Asistente', moderador: 'Moderador de la página' }[r] || r)).join(' y ')}</b>{d.yo ? ' (' + d.yo + ')' : ''}: lo que hagas queda con tu nombre.</p> : null}
      <div className="dz-marco">
        <nav className={'dz-nav' + (hojaNav ? ' dzn-abierta' : '')} aria-label="Áreas del Dashboard">
          <div className="dz-marca"><small>UNDER LEGENDS · {liga.temp}</small><b>Dashboard</b></div>
          {/* 📱 en el teléfono: un solo botón con el área de ahora; abre la hoja con los tres grupos */}
          <button type="button" ref={elegirRef} className="dzn-elegir" aria-expanded={hojaNav} aria-controls="dzn-hoja" onClick={() => setHojaNav(!hojaNav)}>
            <span>{titulo}</span>
            {total && areaV !== 'pendientes' ? <i aria-label={total + ' para decidir'}>{total}</i> : null}
            <b aria-hidden="true">▾</b>
          </button>
          {hojaNav ? <div className="dzn-velo" aria-hidden="true" onClick={() => setHojaNav(false)} /> : null}
          <div className="dzn-hoja" id="dzn-hoja" ref={hojaRef}>
            <span className="dzn-asa" aria-hidden="true" />
            {GRUPOS_AREA.map(([g, ks]) => {
              const xs = AREAS.filter(([k]) => ks.includes(k) && visibles[k]);
              if (!xs.length) return null;
              return (
                <div key={g} className="dzn-g" role="group" aria-label={g}>
                  <p className="dzn-gt">{g}</p>
                  {xs.map(([k, t, ic]) => {
                    const c = k === 'pendientes' ? total : 0;
                    return (
                      <button key={k} type="button" className={'dz-a' + (areaV === k ? ' on' : '')} aria-current={areaV === k ? 'page' : undefined}
                        onClick={() => { setHojaNav(false); ir(k); }}>
                        <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d={ic} /></svg>{t}</span>
                        {c ? <i>{c}</i> : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <p className="dzn-pie"><kbd>Ctrl</kbd> <kbd>K</kbd> para buscar o hacer algo</p>
        </nav>
        <div className="dz-der">
          <div className="dz-top">
            <button type="button" className="dz-bbtn" onClick={() => setBuscar(true)}><Ico n="buscar" t={16} /><span>Busca un ajuste o una acción</span><kbd>Ctrl K</kbd></button>
            <span className="dz-act">{actualizado ? 'Actualizado ' + hace(actualizado) + ((areaV === 'resumen' || areaV === 'salud') ? ' · se pone al día solo' : '') : ''}</span>
            {!panel ? <button type="button" className="btn borde2 chico" onClick={() => { panelPoner(true); setPanel(true); }}>Mostrarlo en el Inicio</button> : null}
          </div>
          {areaV !== 'resumen' ? <h2 className="dz-h1">{titulo}</h2> : null}
          {vista}
        </div>
      </div>
      <BuscarTodo abierto={buscar} cerrar={() => setBuscar(false)} ir={ir} visibles={visibles} liga={liga} abrirFicha={abrirFicha}
        extra={[...((d.primerizos || {}).una || []), ...((d.primerizos || {}).frio || [])].map((x) => [x[0], x[x.length - 1]])} />
      {ficha ? <FichaPersona k={ficha[0]} n={ficha[1]} liga={liga} cerrar={() => setFicha(null)} puedeNotas={ve('reportes_cerrar')} /> : null}
      {aviso ? (
        <div className="dz-toast" role="status">
          <span>{aviso.ok}</span>
          {aviso.puede ? <button type="button" onClick={deshacer}>Deshacer</button> : null}
          <button type="button" className="dz-tx" aria-label="Cerrar" onClick={cerrarAviso}><Ico n="cerrar" t={14} /></button>
        </div>
      ) : null}
    </section>
    </FichaCtx.Provider>
  );
}

// 🏠 EN EL INICIO, SÓLO PARA VOS (Dlx, 04/10/2026: «y que me aparezca a mí únicamente en el inicio también»). Lo
// dibuja App.jsx cuando la cuenta del navegador es la de Dlx, y se apaga solo si la puerta dice que no (otra cuenta
// con el ID copiado, o la sesión vencida): lo que se ve sale de `/avisos/dueno`, igual que el Dashboard
// ✕ Y SE CIERRA (Dlx, 07/10/2026: «crea una X para cerrar ese panel para mí»). Queda cerrado en ese navegador
// (`lg:db-ini`) y se vuelve a prender desde el Dashboard («Mostrarlo en el Inicio»)
const PANEL = 'lg:db-ini';
const panelCerrado = () => { try { return localStorage.getItem(PANEL) === 'no'; } catch (e) { return false; } };
const panelPoner = (si) => { try { if (si) localStorage.removeItem(PANEL); else localStorage.setItem(PANEL, 'no'); } catch (e) { /* sin almacenamiento */ } };
export function PanelDueno({ liga }) {
  const [st, setSt] = useState(null);
  const [cerrado, setCerrado] = useState(panelCerrado);
  useEffect(() => {
    if (cerrado) return undefined;
    let vivo = true;
    pedirDueno().then((x) => { if (vivo) setSt(x); });
    return () => { vivo = false; };
  }, [cerrado]);
  const q = useCuotas(!!(st && st.d) && !cerrado);
  if (cerrado || !st || st.no) return null;
  const d = st.d;
  const s = (d && d.uso && d.uso.semana) || {};
  const aj = (d && d.ajustes) || {};
  const m = liga.d.mult || {};
  const marcas = d ? [aj.campana_pausada ? '⏸ La campana está en pausa' : '',
    avisoVigente(aj) ? '📣 Hay un aviso publicado' : '',
    aj.multiplicadores && aj.multiplicadores.semana === m.id ? '✍ El multiplicador va a mano' : '',
    d.sistema && d.sistema.ok === false ? '⚠️ El vigía no contesta' : '',
    ...cuotasEnRojo(q).map(([, , t]) => '⚠️ ' + t + ' casi llenas hoy'),
    (d.vivo || []).length ? '🔴 ' + d.vivo.length + ' llave(s) en vivo' : ''].filter(Boolean) : [];
  return (
    <section className="db-ini" aria-label="Tu Dashboard">
      <style>{ESTILO}</style>
      <div className="db-ini-c">
        <b>TU DASHBOARD</b>
        <span className="db-ini-a">
          <a className="btn borde2 chico" href="#/dashboard">Abrir</a>
          <button type="button" className="db-ini-x" aria-label="Cerrar este panel" title="Cerrar (se vuelve a prender desde el Dashboard)"
            onClick={() => { panelPoner(false); setCerrado(true); }}><Ico n="cerrar" t={18} /></button>
        </span>
      </div>
      {d ? (
        <>
          {/* cada número dice qué cuenta y de cuándo: «visitas» sola no decía a qué */}
          <dl className="db-ini-n">
            <div><dt>Usaron el bot</dt><dd>{num(s.bot || 0)}</dd><dd className="db-ini-s">personas · 7 días</dd></div>
            <div><dt>Entraron con Discord</dt><dd>{num(s.web || 0)}</dd><dd className="db-ini-s">a la página · 7 días</dd></div>
            <div><dt>Abrieron la página</dt><dd>{num(s.visitas_dia || 0)}</dd><dd className="db-ini-s">celus o compus por día · prom. 7 días</dd></div>
          </dl>
          {marcas.length ? <p className="db-ini-m">{marcas.join(' · ')}</p> : null}
        </>
      ) : <p className="db-ini-m">{st.sinCuenta ? 'Entra con Discord para verlo.' : 'No pude leerlo ahora.'}</p>}
    </section>
  );
}
