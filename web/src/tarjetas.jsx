// Tarjetas (`#/tarjetas` y `#/tarjetas/<carta>`). 🗂️ EL REMAKE «A · EL ÁLBUM» (Dlx, 24/10/2026: «Me gusta más A la
// verdad», a la maqueta https://claude.ai/artifact/4ngSbFMEtwAMnmtuttqUAf): arriba TU ÁLBUM —tus cartas en la mano, las
// que te faltan en gris con lo que te falta, «3 de 4» y lo que llega en la T2— y abajo la colección de la Liga en CUATRO
// ESTANTES que se deslizan de costado. Tocar una carta abre una hoja con la carta grande, y se pasa a la siguiente
// deslizando. En la compu, tu álbum y «Comparar» quedan fijos en la columna negra mientras bajas por los estantes.
// `#/tarjetas/<carta>` («Ver todas») es la galería entera de ese tipo, con el buscador y los filtros de antes.
//
// 🔴 CADA TIPO SE ORDENA POR LO QUE MIDE (lo encontró la maqueta): hasta la 3.98 las cuatro galerías salían en el orden
// de la tabla —el puesto de Temporada—, así que las cuatro mostraban a las mismas nueve personas en el mismo orden. Ahora:
// la Temporada por OVR, la Competitiva por Score, y la de Servidor y la de País, el #1 de cada uno (por Score, que es como
// la carta cuenta el puesto adentro: CLAUDE.md, «los números de los círculos se calculan por Score»).
//
// ⚠️ LOS DATOS SON LOS DE ANTES: quién aparece (`conTarjeta()` de app.js: alguna carta y su foto), lo que falta (`req` de
// /api/perfiles), las filas de «Comparar» (`CMP_FILAS` de app.js) y «Comparar conmigo» del perfil (`?a=<tú>&b=<él>`).
import { useEffect, useMemo, useRef, useState } from 'react';
import { limpio, norm, num, siglaDe, utc } from './liga.js';
import { Bandera, Carta, Compartir, FaltaLista, Ico, Sec, SinCarta, accion, enlace, nombrePais, usePerfiles } from './piezas.jsx';
import { Franja } from './ranking_a.jsx';
import { W, aPng, armarYCompartir, carta, lienzo, pie } from './historia.js';
import { usePaseDe } from './pase.js';
import { svElegido, useElegidos } from './elegidos.js';
import * as RQ from './requisitos.js';
import CSS_PAGINA from './css/tarjetas.css?inline';
import { usarCss } from './css.js';
import { pedirLigas } from './ligas_datos.js';
import { ConMarco } from './marcos.jsx';
import { usePases } from './pase.js';

// 🎨 su CSS, con su pedazo (web/src/css/tarjetas.css)
usarCss('tarjetas', CSS_PAGINA);

const ORDEN = ['temporada', 'competitivo', 'servidor', 'pais'];
// 🏟️ y la de liga (05_Liga/), que no cuenta en tu álbum de la temporada: es de cada liga que juegas
const TIPOS = [...ORDEN, 'liga'];
const NOMBRE = { temporada: 'Temporada', competitivo: 'Competitiva', servidor: 'Servidor', pais: 'País', liga: 'Liga' };
// las filas de «Comparar»: [campo de la tabla, cómo se llama, 1 = gana el más alto · -1 = el más bajo]
const FILAS = {
  temporada: [['ovr', 'OVR', 1], ['pts', 'Puntos', 1], ['ev', 'Eventos', 1], ['pod', 'Podios', 1], ['pos', 'Puesto', -1]],
  competitivo: [['sc', 'Score', 1], ['ev', 'Eventos', 1], ['wr', 'Win%', 1], ['oro', 'Títulos', 1]],
  servidor: [['pts', 'Puntos', 1], ['ev', 'Eventos', 1], ['oro', 'Títulos', 1], ['pos', 'Puesto', -1]],
  pais: [['pts', 'Puntos', 1], ['ev', 'Eventos', 1], ['pod', 'Podios', 1], ['pos', 'Puesto', -1]],
};
// 🎟️ lo que llega en la T2 (CLAUDE.md: Prime e Histórico cuelgan de la Histórica, que sale con la T2). Sólo el nombre:
// todavía no tienen diseño ni número
const T2 = ['Prime', 'Histórico'];
const movil = () => typeof matchMedia === 'function' && matchMedia('(max-width: 599.98px)').matches;
const sc = (f) => parseFloat(String(f.sc || 0).replace(',', '.')) || 0;

// ── cada tipo, ordenado por lo que mide ──
function ordenar(t, lista) {
  if (t === 'competitivo') return [...lista].sort((a, b) => sc(b) - sc(a));
  if (t === 'servidor' || t === 'pais') return [...lista].sort((a, b) => sc(b) - sc(a) || (a.o || a.pos || 999) - (b.o || b.pos || 999));
  return lista;                                                     // la Temporada: el orden de la tabla (OVR)
}
// de cada grupo (servidor o país), el que va primero; los grupos, del más grande al más chico
function grupos(t, lista) {
  const campo = t === 'servidor' ? 'sv' : 'cc';
  const m = new Map();
  ordenar(t, lista).forEach((f) => { if (f[campo]) { if (!m.has(f[campo])) m.set(f[campo], []); m.get(f[campo]).push(f); } });
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}
function pieDe(liga, f, t, i, grupo) {
  if (t === 'temporada') return (f.pos ? '#' + f.pos : 'fuera de concurso') + (f.ovr ? ' · OVR ' + f.ovr : '');
  if (t === 'competitivo') return [f.rg || '—', f.sc ? String(f.sc).replace('.', ',') : ''].filter(Boolean).join(' · ');
  const de = t === 'servidor' ? siglaDe(f.sv) : nombrePais(f.cc);
  return grupo ? '#' + (i + 1) + ' de ' + de : de;
}

// ── tu tarjeta para historias (Dlx, 03/10/2026: «2. A»): la imagen vertical de esa carta con el marco de la Liga ──
function datoDe(liga, f, c) {
  if (c === 'temporada') return (f.pos ? '#' + f.pos + ' DE LA TEMPORADA' : 'FUERA DE CONCURSO') + (f.ovr ? ' · OVR ' + f.ovr : '');
  if (c === 'competitivo') return [f.rg ? 'RANGO ' + f.rg : '', f.sc ? 'SCORE ' + String(f.sc).replace('.', ',') : ''].filter(Boolean).join(' · ');
  if (c === 'servidor') return f.sv ? String((liga.svs[f.sv] || {}).nombre || f.sv).toUpperCase() : '';
  if (c === 'pais') return f.cc ? nombrePais(f.cc).toUpperCase() : '';
  return '';
}
async function imagenTarjeta(liga, k, c) {
  // 🧑 (18/11/2026) la fila de quien no está en la tabla también (el staff `solo`, un perfil abierto): con `liga.T` sola el
  // título y el dato salían con la clave en minúsculas
  const f = liga.persona(k) || {};
  const { c: lz, g, letra } = await lienzo();
  letra(700, 34, true); g.fillStyle = '#A5A5A0';
  g.fillText(('LIGA GLOBAL · ' + liga.temp + ' · MI TARJETA').toUpperCase(), 72, 132);
  const tit = NOMBRE[c].toUpperCase();
  let px = 116;
  letra(900, px, false);
  while (px > 60 && g.measureText(tit).width > W - 144) { px -= 6; letra(900, px, false); }
  g.fillStyle = '#F6F6F6'; g.fillText(tit, 72, 132 + 24 + px * 0.9);
  const y0 = 330;
  const ch = await carta(g, letra, liga, k, f.n || k, c, W / 2, y0, 700, 1120);
  // debajo, en verde agua, lo que dice esa carta: el puesto, el rango, el servidor o el país
  const dato = datoDe(liga, f, c);
  if (dato) {
    const ye = y0 + ch + 36;
    let pd = 40;
    letra(700, pd, true);
    while (pd > 24 && g.measureText(dato).width > 760 - 60) { pd -= 2; letra(700, pd, true); }
    g.fillStyle = '#29B298'; g.fillRect((W - 760) / 2, ye, 760, 104);
    g.fillStyle = '#030304'; g.textAlign = 'center';
    g.fillText(dato, W / 2, ye + 52 + Math.round(pd * 0.36));
  }
  await pie(g, letra);
  return aPng(lz);
}
// 🗂️ tu álbum para historias: tus cartas de a dos por fila, con «MI ÁLBUM · 3 DE 4» arriba
async function imagenAlbum(liga, k, tiene) {
  // 🧑 (18/11/2026) como en `imagenTarjeta()`: sin la fila de fuera de la tabla, el título era la clave
  const f = liga.persona(k) || {};
  const { c: lz, g, letra } = await lienzo();
  letra(700, 34, true); g.fillStyle = '#A5A5A0';
  g.fillText(('LIGA GLOBAL · ' + liga.temp + ' · MI ÁLBUM').toUpperCase(), 72, 132);
  const tit = limpio(f.n || k).toUpperCase();
  let px = 100;
  letra(900, px, false);
  while (px > 54 && g.measureText(tit).width > W - 144) { px -= 6; letra(900, px, false); }
  g.fillStyle = '#F6F6F6'; g.fillText(tit, 72, 132 + 20 + px * 0.9);
  letra(700, 40, true); g.fillStyle = '#29B298';
  g.fillText(tiene.length + ' DE ' + ORDEN.length + ' TARJETAS', 72, 132 + 20 + px * 0.9 + 64);
  const y0 = 400;
  const uno = tiene.length === 1;
  for (let i = 0; i < tiene.length; i += 1) {
    const cx = uno ? W / 2 : i % 2 ? W * 0.74 : W * 0.26;
    const y = y0 + Math.floor(i / 2) * 640;
    await carta(g, letra, liga, k, f.n || k, tiene[i], cx, y, uno ? 600 : 420, uno ? 1000 : 600); // eslint-disable-line no-await-in-loop
  }
  await pie(g, letra);
  return aPng(lz);
}
function BotonHistoria({ liga, k, c, album, cls = 'tj-hist', texto = 'Para historias' }) {
  const [est, setEst] = useState('');
  const hacer = () => {
    if (est === 'armando') return;
    armarYCompartir(() => (album ? imagenAlbum(liga, k, album) : imagenTarjeta(liga, k, c)),
      album ? 'mi-album-' + k + '.png' : 'mi-tarjeta-' + c + '-' + k + '.png',
      (album ? 'Mi álbum de la Liga Global. ' : 'Mi tarjeta de ' + NOMBRE[c] + ' de la Liga Global. ') + enlace('#/r/' + encodeURIComponent(k)),
      setEst, 'tarjetas');
  };
  const txt = est === 'armando' ? 'Armando…' : est === 'bajada' ? 'Imagen guardada' : est === 'error' ? 'No pude armarla' : texto;
  return (
    <button type="button" className={cls} onClick={hacer} aria-busy={est === 'armando'} aria-live="polite">
      <Ico n="compartir" t={14} /><span>{txt}</span>
    </button>
  );
}

// ── TU ÁLBUM: tus cartas en la mano y lo que te falta ──
// 🔑 LAS REGLAS DEL 05/10/2026 (2.41; Dlx: «C», «1. dale», «4. nivel 1»): sin verificarse, ninguna; la Servidor sale al
// verificarse; la Temporada, con el nivel 1 del Pase (tu primera Tarea); la Competitiva y la de País, verificado y con su
// requisito. Quien ya las tenía las conserva hasta la T1: eso es `tiene`
function faltaDe(c, { cs, nv, nivel, pide = [] }) {
  if (nv) return { txt: 'Primero verifícate. ' + RQ.sinVerificar(nv, true), ir: ['#/cuenta/verificar', 'Verificarme'] };
  if (c === 'servidor') return { txt: 'Se está dibujando: llega en la próxima vuelta del ciclo.' };
  if (c === 'temporada') return nivel >= 1 ? { txt: 'Se está dibujando: llega en la próxima vuelta del ciclo.' } : { txt: RQ.pase(true), ir: ['#/pase', 'Ver el Pase'] };
  if (cs.length && cs.every((q) => q[0] >= q[1])) return { txt: 'Se está dibujando: llega en la próxima vuelta del ciclo.' };
  const q = cs.filter((x) => x[0] < x[1]);
  if (q.length) return { cs: q.slice(0, 1) };
  // 🔒 SIN `req` NO QUEDA UN CUADRO VACÍO (18/11/2026): el staff `solo` no lo trae nunca, y los demás mientras baja
  // /api/perfiles (o si falla). Devolvía `{cs: []}` sin `txt` y el álbum dibujaba «TU COMPETITIVA» con un <p> vacío.
  // Lo que pide esa carta, del lobby (`requisitos`); «verificado» ya se cumple: con `nv`, salió arriba
  const p = pide.filter((x) => !/verificad/i.test(x));
  return { txt: p.length ? 'Pide ' + p.join(', ') + '.' : 'Todavía no está desbloqueada.' };
}

// 🃏 TU CARTA AUNQUE NO ESTÉS EN LA TABLA (25/10/2026): `Carta` arma la dirección con la fila de la tabla, y quien
// tiene cartas sin haber jugado esta temporada —la Servidor sale al verificarse— no tiene fila: el álbum le mostraba
// «SIN CARTA» encima de cartas que sí existen. Sin fila, la de R2 directo; si tampoco está, recién ahí «SIN CARTA»
function TuCarta({ liga, k, cual, cls, nombre }) {
  const [mal, setMal] = useState(false);
  if (liga.T[k]) return <Carta liga={liga} k={k} cual={cual} cls={cls} abre={false} />;
  if (mal) return <SinCarta liga={liga} k={k} nombre={nombre || k} cc="" cls={cls} />;
  return <img className={cls} alt={'Tu carta ' + cual} src={liga.d.r2 + '/' + encodeURIComponent(k) + '/' + cual + '.webp'} loading="lazy" onError={() => setMal(true)} />;
}

// 🏟️ LAS CARTAS DE LIGA (/api/ligas, `cartas` de 05_Liga/ciclo.py: `{clave: [[liga, versión, OVR de liga, puesto], …]}`,
// la mejor primero). Un pedido por lobby (`pedirLigas()` lo comparte con la página de Ligas). `null` mientras baja
function useLigas(liga) {
  const [x, setX] = useState(null);
  useEffect(() => {
    let vivo = true;
    pedirLigas(liga.d.sello).then((d) => { if (vivo) setX(d || {}); });
    return () => { vivo = false; };
  }, [liga.d.sello]);
  return x;
}
// el nombre y el servidor de cada liga; las de una temporada que terminó (`comp`, 11/11/2026), con cuál fue
function nombresLiga(x) {
  const nom = {}, svDe = {};
  ((x && x.lobby && x.lobby.ligas) || []).forEach((L) => { nom[L.id] = L.n; svDe[L.id] = L.sv; });
  Object.values((x && x.comp) || {}).forEach((C) => { nom[C.id] = C.n + ' · ' + (C.lt ? 'T' + C.lt : 'terminada'); svDe[C.id] = C.sv; });
  return { nom, svDe };
}
const urlLiga = (liga, k, m, chica) => liga.d.r2 + '/' + encodeURIComponent(k) + '/liga-' + m[0] + (chica ? '.chica' : '') + '.webp?v=' + m[1];
// 🏁 las de cada liga EN CURSO (las de una temporada terminada ya no cambian: viven en el Álbum de esa liga), el #1
// primero (el puesto; el dueño, sin puesto, al final) y las ligas de la más grande a la más chica: como `grupos()`
function gruposLiga(x) {
  const act = new Set(((x && x.lobby && x.lobby.ligas) || []).map((L) => L.id));
  const m = new Map();
  Object.entries((x && x.cartas) || {}).forEach(([k, ms]) => (ms || []).forEach((c) => {
    if (!act.has(c[0])) return;
    if (!m.has(c[0])) m.set(c[0], []);
    m.get(c[0]).push({ k, c });
  }));
  m.forEach((xs) => xs.sort((a, b) => (a.c[3] || 999) - (b.c[3] || 999) || (b.c[2] || 0) - (a.c[2] || 0)));
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}
const cortoLiga = (n) => String(n || '').replace('FMH ', '').replace('FMS ', '').replace('Snake League ', '').replace('Champions League ', 'Champions ').replace('Snake ', '');

// ── TU MANO: las cuatro en su lugar (la que falta, gris y con candado) y la de liga al lado ──
function Mano({ liga, k, f, tiene, bl, onAbrir, nombre, x }) {
  return (
    <ol className="ta-mano" aria-label="Tu mano">
      {ORDEN.map((c) => {
        const la = tiene.includes(c);
        let img;
        if (la) img = <TuCarta liga={liga} k={k} cual={c} cls="tj-c" nombre={nombre} />;
        else if (bl.includes(c)) img = <img className="tj-c" alt="" src={liga.d.r2 + '/' + encodeURIComponent(k) + '/bloq-' + c + '.webp'} loading="lazy" />;
        else img = <span className="tj-c ta-hueco"><b>?</b></span>;
        return (
          <li key={c} className={'ta-m tj-' + c + (la ? '' : ' bloq')}>
            {la ? (
              <button type="button" className="sin-boton" onClick={() => onAbrir(c)} aria-label={'Tu carta de ' + NOMBRE[c]}>{img}</button>
            ) : <span className="ta-m-c">{img}<span className="ta-cand" aria-label={'Tu ' + NOMBRE[c] + ', bloqueada'}><Ico n="candado" t={22} /></span></span>}
            <b>{NOMBRE[c]}</b>
            <small>{la ? (f ? pieDe(liga, f, c, 0, false) : 'la tienes') : 'todavía no'}</small>
          </li>
        );
      })}
      <LigaCelda liga={liga} k={k} x={x} />
    </ol>
  );
}

// 🏟️ TU CARTA DE LIGA (27/10/2026). Dlx: «que todas las personas de las ligas tengan su tarjeta de ligas… que les
// aparezca el botón», y con más de una «un dropdown menu para elegir… pero por default verían la mejor». Sin ninguna, la
// celda dice cómo se consigue (6.84: «asegúrate que estén todos los tipos de tarjetas»)
function LigaCelda({ liga, k, x }) {
  const [sel, setSel] = useState(0);
  const pub = usePases();
  if (!x) return null;
  const mias = (x.cartas && x.cartas[k]) || [];
  if (!mias.length) {
    return (
      <li className="ta-m tj-liga bloq">
        <a className="ta-m-c" href="#/ligas" aria-label="Las ligas: tu carta de liga sale al jugar una">
          <span className="tj-c ta-hueco"><span>Sale al jugar una liga de un servidor</span></span>
          <span className="ta-cand"><Ico n="candado" t={22} /></span>
        </a>
        <b>{NOMBRE.liga}</b><small>todavía no</small>
      </li>
    );
  }
  const { nom, svDe } = nombresLiga(x);
  const c = mias[Math.min(sel, mias.length - 1)];
  const de = nom[c[0]] || c[0];
  // 👑 la del dueño no tiene puesto ni OVR (no juega): va «—»
  const txt = (m) => cortoLiga(nom[m[0]] || m[0]) + (m[3] ? ' · ' + m[3] + '.º' : ' · —');
  // 🖼️ con su marco del Pase, si lo tiene («el afiche pegado», web/src/marcos.jsx)
  const mk = pub && pub.m && pub.m[k];
  const src = urlLiga(liga, k, c, false);
  const img = <img className="tj-c" src={src} alt={'Tu carta de liga de ' + de} loading="lazy" />;
  return (
    <li className="ta-m tj-liga">
      <a className="ta-lcarta" href={'#/ligas/' + encodeURIComponent(c[0])} aria-label={'Tu carta de ' + de + ': ver la liga'}>
        {mk ? <ConMarco m={mk} cual="liga" ancho={160} src={src} sigla={siglaDe(svDe[c[0]] || '')}>{img}</ConMarco> : img}
      </a>
      <b>{NOMBRE.liga}{mias.length > 1 ? ' · ' + mias.length : ''}</b>
      {mias.length > 1 ? (
        <select className="ta-lsel" value={sel} onChange={(e) => setSel(+e.target.value)} aria-label="Elige la liga">
          {mias.map((m, i) => <option key={m[0]} value={i}>{txt(m) + (i === 0 ? ' · la mejor' : '')}</option>)}
        </select>
      ) : <small>{txt(c)}{c[3] ? ' · OVR ' + c[2] : ''}</small>}
    </li>
  );
}

function Album({ liga, dc, perf, onAbrir, x }) {
  const k = (liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  // 🔢 la fila de la tabla manda sobre lo que dijo la sesión al entrar: `dc.cs` es de ESE momento, y con la fila ya sin
  // tarjetas el álbum decía «2 de 4» con dos «SIN CARTA» y el perfil «todavía ninguna» (Dlx, 25/10/2026)
  const f = liga.yo || (k && liga.T[k]) || null;
  const tiene = (f ? f.c : dc && dc.cs) || [];
  const bl = (dc && dc.clave === k && dc.bl) || [];
  const p = (perf && perf.p && perf.p[k]) || null;
  const req = (p && p.req) || {};
  const nv = (f && f.nv) || (dc && dc.nv) || '';
  const pase = usePaseDe(k);
  const nivel = (pase && pase.nivel) || 0;
  const dra = ((liga.svs || {}).DRA || {}).invita;
  const mira = !!(f || (dc && (dc.clave || dc.id)));
  if (!mira) {
    return (
      <div className="rka-caja ta-alb" data-tuto="tj-album">
        <h2 className="rka-h">Tu mano<small>{liga.temp}</small></h2>
        <h3 className="ta-h">¿Y las tuyas?</h3>
        <p className="ta-p">Entra con Discord y te mostramos tus tarjetas, y lo que te falta para las que no tienes.</p>
        <div className="ta-acc"><button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button></div>
      </div>
    );
  }
  if (!k) {
    // entró con Discord, pero su cuenta no es (todavía) de nadie de la Lista
    return (
      <div className="rka-caja ta-alb" data-tuto="tj-album">
        <h2 className="rka-h">Tu mano<small>{liga.temp}</small></h2>
        <h3 className="ta-h">Todavía no tienes tarjetas</h3>
        <p className="ta-p">Son dos pasos: verifícate —estar en Discord Rap Español con el rol Miembro y tu país— y se desbloquea
          tu Servidor; cumple tu primera Tarea del Pase de rapero y se desbloquea tu Temporada. Escribe <code>/verificar</code> en
          Discord y el bot te dice qué te falta.</p>
        <div className="ta-acc">
          {dra ? <a className="btn verde chico" href={dra} target="_blank" rel="noopener noreferrer">Entrar a Discord Rap Español ↗</a> : null}
          <a className="btn borde2 chico" href="#/guia">Cómo funciona</a>
        </div>
      </div>
    );
  }
  const faltan = ORDEN.filter((c) => !tiene.includes(c));
  // de las que faltan, la primera que dice CUÁNTO falta (la Competitiva o la de País); si no, la primera
  const fc = faltan.find((c) => (c === 'competitivo' || c === 'pais') && !nv) || faltan[0];
  const fx = fc ? faltaDe(fc, { cs: req[fc] || [], nv, nivel, pide: ((liga.d.requisitos || []).find((r) => r.id === fc) || {}).pide || [] }) : null;
  const nombre = limpio((f && f.n) || (dc && (dc.rapero || dc.n)) || k);
  const cc = (f && f.cc) || (dc && dc.cc) || '';
  const sv = (f && f.sv) || (dc && dc.sv) || '';
  // 🃏 TU FILA PARA LA IMAGEN DE HISTORIAS Y EL VISOR (18/11/2026): el staff `solo` no está en la tabla y App.jsx no la
  // registra (`yoFila` sólo sin `solo`), así que `cartaUrl()` daba null si /api/perfiles no había llegado —o no traía esa
  // carta— y la historia salía con la inicial en cada casilla. Como hace el perfil (`liga.fuera()`): con lo de tu cuenta
  // (`tiene`) y la versión de la imagen de tu perfil, si llegó. ⚠️ Nunca encima de una fila de verdad (la de `yoFila`):
  // sólo la que puso el álbum (`album`), que se rehace cuando llegan los perfiles
  // 🃏 con las cartas de los DOS juntas (18/11/2026, la revisión): esta fila tapa la del perfil en `persona()` y frena la
  // de tags_inv.jsx, así que `c: tiene` solo le sacaba a `cartaUrl()` la carta que el perfil ya traía y tu cuenta no
  // (lo mismo que perfil.jsx: «JUNTAS, NO UNA U OTRA»)
  if (!f && !liga.T[k] && tiene.length && (!liga.X[k] || liga.X[k].album)) {
    liga.fuera(Object.assign({ k, n: nombre, cc, sv }, p && p.f, { c: [...new Set([...((p && p.f && p.f.c) || []), ...tiene])], album: 1 }));
  }
  const nl = ((x && x.cartas && x.cartas[k]) || []).length;
  return (
    <div className="rka-caja ta-alb" data-tuto="tj-album">
      <h2 className="rka-h">Tu mano<small>{tiene.length + ' de ' + ORDEN.length + (nl ? ' + ' + nl + ' de liga' : '') + ' · ' + T2.join(' e ') + ' llegan en la T2'}</small></h2>
      <p className="ta-n">{cc ? <Bandera cc={cc} cls="ta-fl" /> : null}<b>{nombre}</b>{cc ? ' · ' + nombrePais(cc) : ''}{sv ? ' · ' + siglaDe(sv) : ''}</p>
      <Mano liga={liga} k={k} f={f} tiene={tiene} bl={bl} onAbrir={onAbrir} nombre={nombre} x={x} />
      {fc ? (
        <div className="ta-falta">
          <small><Ico n="candado" t={13} />TU {NOMBRE[fc].toUpperCase()}{faltan.length > 1 ? ' · Y ' + (faltan.length - 1) + ' MÁS' : ''}</small>
          {fx.cs && fx.cs.length ? <FaltaLista q={fx.cs} tu /> : <p>{fx.txt}</p>}
          {fx.ir ? <a className="tj-lnk" href={fx.ir[0]}>{fx.ir[1]}</a> : null}
        </div>
      ) : null}
      <div className="ta-acc">
        {fc ? null : <p className="ta-p ta-todas">Tienes las cuatro de la {liga.temp}.</p>}
        {tiene.length ? <BotonHistoria liga={liga} k={k} album={ORDEN.filter((c) => tiene.includes(c))} cls="btn verde chico ta-bh" texto="Mi álbum para historias" /> : null}
        {/* 🪪 `liga.existe(k)` y no `liga.T[k]` (18/11/2026): quien está fuera de las 200 filas también tiene perfil, y el botón no le salía */}
        {liga.existe(k) ? <a className="btn borde2 chico" href={'#/r/' + encodeURIComponent(k)}>Ver mi perfil</a> : null}
      </div>
    </div>
  );
}

// ── 🃏 LAS QUE SALIERON ESTA SEMANA (del muro, como las «NUEVA» de abajo): la más nueva de cada tipo primero, una por
// persona y tipo. Sin ninguna esta semana no se dibuja ──
function nuevasDeLaSemana(liga) {
  const d = liga.desdeLunes();
  const vistos = new Set();
  return liga.muro.filter((it) => it.tipo === 'tarjeta' && ORDEN.includes(it.carta) && utc(it.t) >= d)
    .sort((a, b) => utc(b.t) - utc(a.t))
    .filter((it) => { const k = (it.ks || [])[0]; if (!k || !liga.T[k] || vistos.has(k + it.carta)) return false; vistos.add(k + it.carta); return true; });
}
function Nuevas({ liga, us, onAbrir }) {
  // seis (cuatro en el celular, tarjetas.css): la más nueva de cada tipo y, si sobra lugar, las siguientes. Seis llenan
  // la columna al lado de tu mano y Comparar
  const vis = useMemo(() => {
    const una = ORDEN.map((c) => us.find((it) => it.carta === c)).filter(Boolean);
    return una.concat(us.filter((it) => !una.includes(it))).slice(0, 6);
  }, [us]);
  return (
    <div className="rka-caja ta-nue" aria-label="Las que salieron esta semana">
      <h2 className="rka-h">Salieron esta semana<small>{num(us.length) + ' · desde el lunes'}</small></h2>
      <ul className="ta-nue-l">
        {vis.map((it) => {
          const k = it.ks[0];
          return (
            <li key={k + it.carta}>
              <em className="ta-nueva">NUEVA</em>
              <button type="button" className="sin-boton" onClick={() => onAbrir(it.carta, [liga.T[k]], 0, false)} aria-label={'La ' + NOMBRE[it.carta] + ' de ' + limpio(liga.T[k].n)}>
                <Carta liga={liga} k={k} cual={it.carta} cls="tj-c" abre={false} />
              </button>
              <b>{limpio(liga.T[k].n)}</b><small>{NOMBRE[it.carta]}</small>
            </li>
          );
        })}
      </ul>
      <a className="ta-lnk" href="#/publicaciones">{us.length > vis.length ? 'Las ' + num(us.length) + ' en Publicaciones' : 'En Publicaciones'} <Ico n="flecha" t={14} /></a>
    </div>
  );
}

// ── 🗂️ LAS DE TODA LA LIGA, EN PESTAÑAS (6.84; Dlx: «A con algo de B pero asegúrate que estén todos los tipos de
// tarjetas»). De la B, que cada tipo se ve con su #1: cada pestaña lleva la carta del #1 de ese tipo, así los cinco
// tipos se ven de una sin tocar nada. Adentro, el podio (el #1 en la pieza blanca, como la final de la llave) y los seis
// siguientes. La Servidor, la de País y la de Liga muestran el #1 de cada grupo; tocar un grupo muestra los de ese ──
const MIDE_LIGA = 'Tu carta en cada liga de servidor que juegas: el OVR de liga y tu puesto en la tabla.';
function Vitrina({ liga, x, porTipo, nuevas, onAbrir, yoK }) {
  const [t, setT] = useState('temporada');
  const [g, setG] = useState('');
  const gl = useMemo(() => gruposLiga(x), [x]);
  const { nom } = useMemo(() => nombresLiga(x), [x]);
  const gsDe = useMemo(() => ({ servidor: grupos('servidor', porTipo.servidor || []), pais: grupos('pais', porTipo.pais || []) }), [porTipo]);
  const nLiga = gl.reduce((s, y) => s + y[1].length, 0);
  const tipos = TIPOS.filter((c) => (c === 'liga' ? gl.length : (porTipo[c] || []).length));
  if (!tipos.length) return null;
  const tt = tipos.includes(t) ? t : tipos[0];
  const cambiar = (c) => { setT(c); setG(''); };
  // el #1 de cada tipo, para su pestaña
  const primero = (c) => (c === 'liga' ? gl[0] && gl[0][1][0] : c === 'servidor' || c === 'pais' ? gsDe[c][0] && gsDe[c][0][1][0] : ordenar(c, porTipo[c])[0]);
  const miniDe = (c) => {
    const p = primero(c);
    if (!p) return <span className="ta-pes-c" />;
    return c === 'liga' ? <img className="ta-pes-c" alt="" src={urlLiga(liga, p.k, p.c, true)} loading="lazy" />
      : <Carta liga={liga} k={p.k} cual={c} cls="ta-pes-c" abre={false} />;
  };
  const cuantas = (c) => (c === 'liga' ? nLiga : (porTipo[c] || []).length);
  // lo que se muestra: `it` = {k, n, el, pie, gr (el grupo, sin grupo elegido), abrir | href}
  let its = [];
  let orden = '';
  let chips = null;
  const lbl = (c, id) => (c === 'servidor' ? siglaDe(id) : c === 'pais' ? nombrePais(id) : cortoLiga(nom[id] || id));
  if (tt === 'liga') {
    const de = g ? ((gl.find((y) => y[0] === g) || [0, []])[1]).map((y) => [y, g]) : gl.map((y) => [y[1][0], y[0], y[1].length]);
    its = de.map(([y, lid, ng]) => ({
      k: y.k, n: liga.nombreDe(y.k), href: '#/ligas/' + encodeURIComponent(lid),
      el: <img className="tj-c" alt={'La carta de liga de ' + liga.nombreDe(y.k)} src={urlLiga(liga, y.k, y.c, true)} loading="lazy" />,
      gr: g ? '' : lbl('liga', lid), pie: g ? (y.c[3] ? 'OVR de liga ' + y.c[2] : 'dueño de la liga') : ng + (ng === 1 ? ' carta' : ' cartas'),
    }));
    orden = g ? 'por puesto' : 'el #1 de cada liga, de la más grande a la más chica';
    if (gl.length > 1) chips = gl.map(([id, v]) => [id, <>{cortoLiga(nom[id] || id)} · {v.length}</>]);
  } else {
    const gs = gsDe[tt];
    let fs;
    let grupo = false;
    if (gs && g) {
      fs = (gs.find((y) => y[0] === g) || [0, []])[1];
      grupo = true;
      orden = 'por Score';
    } else if (gs) {
      fs = gs.map((y) => y[1][0]);
      orden = 'el #1 de cada ' + (tt === 'servidor' ? 'servidor' : 'país') + ', del más grande al más chico';
    } else {
      fs = ordenar(tt, porTipo[tt] || []);
      orden = tt === 'competitivo' ? 'por Score' : 'por OVR';
    }
    its = fs.map((f, i) => {
      const ng = gs && !g ? (gs.find((y) => y[0] === (tt === 'servidor' ? f.sv : f.cc)) || [0, []])[1].length : 0;
      return {
        k: f.k, n: limpio(f.n), abrir: () => onAbrir(tt, fs, i, grupo), nueva: nuevas[tt] && nuevas[tt].has(f.k),
        el: <Carta liga={liga} k={f.k} cual={tt} cls="tj-c" abre={false} />,
        gr: gs && !g ? lbl(tt, tt === 'servidor' ? f.sv : f.cc) : '',
        // el puesto ya va en la etiqueta (#1, #2…): abajo, sólo lo que mide
        pie: gs && !g ? ng + (ng === 1 ? ' carta' : ' cartas')
          : tt === 'temporada' ? (f.ovr ? 'OVR ' + f.ovr : 'fuera de concurso') : g ? 'Score ' + String(f.sc || '—').replace('.', ',') : pieDe(liga, f, tt, i, grupo),
      };
    });
    if (gs && gs.length > 1) {
      chips = gs.map(([id, v]) => [id, <>{tt === 'servidor' ? <img alt="" src={liga.logo(id)} /> : <Bandera cc={id} cls="ta-fl" />}{tt === 'servidor' ? siglaDe(id) + ' · ' : ''}{v.length}</>]);
    }
  }
  const req = (liga.d.requisitos || []).find((r) => r.id === tt) || {};
  const mide = tt === 'liga' ? MIDE_LIGA : req.mide || '';
  const todas = tt === 'liga' ? ['#/ligas', 'Ver las ligas'] : ['#/tarjetas/' + tt, 'Ver las ' + num(cuantas(tt)) + ' cartas de ' + NOMBRE[tt]];
  // 🏆 el podio: el 2, el 1 y el 3 (con menos de tres, los que haya)
  const pod = [[its[1], 'p2', 2], [its[0], 'p1', 1], [its[2], 'p3', 3]].filter((y) => y[0]);
  const etq = (it, n) => it.gr || '#' + n;
  const toque = (it, cl, cuerpo) => (it.href
    ? <a className={cl} href={it.href} aria-label={'La carta de ' + it.n}>{cuerpo}</a>
    : <button type="button" className={'sin-boton ' + cl} onClick={it.abrir} aria-label={'La ' + NOMBRE[tt] + ' de ' + it.n}>{cuerpo}</button>);
  return (
    <>
      <div className="ta-pes" role="tablist" aria-label="Qué tarjeta" data-tuto="tj-gal" style={{ '--n': tipos.length }}>
        {tipos.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={tt === c} className={tt === c ? 'on' : ''} onClick={() => cambiar(c)}>
            {miniDe(c)}<span><b>{NOMBRE[c]}</b><small>{num(cuantas(c))}</small></span>
          </button>
        ))}
      </div>
      <div className="ta-mide">
        <p>{mide}{mide ? ' ' : ''}<span>{orden.charAt(0).toUpperCase() + orden.slice(1)}.</span></p>
        <a className="ta-lnk" href={todas[0]}>{todas[1]} <Ico n="flecha" t={14} /></a>
      </div>
      {chips ? (
        <div className="rk-chips ta-chips" role="group" aria-label={tt === 'servidor' ? 'Por servidor' : tt === 'pais' ? 'Por país' : 'Por liga'}>
          <button type="button" className={!g ? 'on' : ''} aria-pressed={!g} onClick={() => setG('')}>El #1 de cada uno</button>
          {chips.map(([id, cuerpo]) => <button type="button" key={id} className={g === id ? 'on' : ''} aria-pressed={g === id} onClick={() => setG(g === id ? '' : id)}>{cuerpo}</button>)}
        </div>
      ) : null}
      <div className={'ta-tipo tj-' + tt}>
        <div className="ta-podio">
          {pod.map(([it, cl, n]) => (
            <div key={it.k + n} className={'ta-pd ' + cl + (it.k === yoK ? ' tu' : '')}>
              {toque(it, 'ta-pd-c', it.el)}
              {it.nueva ? <em className="ta-nueva">NUEVA</em> : null}
              <div className="ta-ped">
                {it.k === yoK ? <span className="ta-yo">TÚ</span> : null}
                <b className={it.gr ? 'gr' : ''}>{etq(it, n)}</b><span>{it.gr ? '#1 · ' : ''}{it.n}</span><small>{it.pie}</small>
              </div>
            </div>
          ))}
        </div>
        {its.length > 3 ? (
          <ul className="ta-resto">
            {its.slice(3, 9).map((it, i) => (
              <li key={it.k + i} className={it.k === yoK ? 'tu' : ''}>
                {toque(it, 'ta-rc', it.el)}
                {it.nueva ? <em className="ta-nueva">NUEVA</em> : null}
                <span className="ta-rn">{etq(it, i + 4)}</span>
                <b>{it.gr ? '#1 · ' : ''}{it.n}</b><small>{it.pie}</small>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <a className="btn borde2 chico ta-todas-b" href={todas[0]}>{todas[1]}</a>
    </>
  );
}

// ── LA HOJA: la carta grande, y deslizar para pasar a la siguiente del mismo estante ──
function Hoja({ liga, yoK, h, setH, onComparar, enCmp }) {
  const { t, lista, i, grupo } = h;
  const f = lista[i];
  const cerrar = () => setH(null);
  const cerrarB = useRef(null);
  const toque = useRef(null);
  const ir = (d) => setH({ ...h, i: (i + d + lista.length) % lista.length });
  // las teclas leen siempre la hoja de ahora; el efecto corre una vez (si corriera en cada carta, el foco saltaría al ✕)
  const teclas = useRef(null);
  teclas.current = { cerrar, ir };
  useEffect(() => {
    // 🎯 adentro del shadow root (18/11/2026): document.activeElement es el host #inicio-nuevo; al cerrar el foco caía al body
    let antes = document.activeElement;
    while (antes && antes.shadowRoot && antes.shadowRoot.activeElement) antes = antes.shadowRoot.activeElement;
    const tecla = (e) => {
      if (e.key === 'Escape') teclas.current.cerrar();
      if (e.key === 'ArrowRight') teclas.current.ir(1);
      if (e.key === 'ArrowLeft') teclas.current.ir(-1);
    };
    window.addEventListener('keydown', tecla);
    const o = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    if (cerrarB.current) cerrarB.current.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', tecla);
      document.documentElement.style.overflow = o;
      if (antes && antes.focus) { try { antes.focus({ preventScroll: true }); } catch (e) { /* ya no está */ } }
    };
  }, []);
  if (!f) return null;
  const nombre = limpio(f.n);
  const sv = f.sv && liga.svs[f.sv];
  const url = liga.cartaUrl(f.k, t);
  const mia = yoK && f.k === yoK;
  return (
    <div className="ta-velo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className="ta-hoja" role="dialog" aria-modal="true" aria-label={'La ' + NOMBRE[t] + ' de ' + nombre}
        onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const d = toque.current == null ? 0 : e.changedTouches[0].clientX - toque.current;
          toque.current = null;
          if (Math.abs(d) > 50 && lista.length > 1) ir(d < 0 ? 1 : -1);
        }}>
        <i className="ta-asa" aria-hidden="true" />
        <div className="ta-h-top">
          <small>{NOMBRE[t].toUpperCase()} · {i + 1} DE {lista.length}</small>
          <button type="button" className="ta-x" ref={cerrarB} onClick={cerrar} aria-label="Cerrar">×</button>
        </div>
        <div className={'ta-h-c tj-' + t}>
          {lista.length > 1 ? <button type="button" className="ta-fl-n" onClick={() => ir(-1)} aria-label="La anterior">‹</button> : <span />}
          <Carta key={f.k + t} liga={liga} k={f.k} cual={t} cls="tj-c" abre={false} />
          {lista.length > 1 ? <button type="button" className="ta-fl-n" onClick={() => ir(1)} aria-label="La siguiente">›</button> : <span />}
        </div>
        {liga.cartaVieja(f.k, t) ? <p className="ta-h-d tj-dib"><Ico n="reloj" t={13} /> se está redibujando con los datos de ahora</p> : null}
        <b className="ta-h-n">{nombre}</b>
        <p className="ta-h-d">
          {pieDe(liga, f, t, i, grupo)}
          {f.cc ? <> · <Bandera cc={f.cc} cls="ta-fl" />{nombrePais(f.cc)}</> : null}
          {sv ? ' · ' + siglaDe(f.sv) : ''}
        </p>
        <div className="ta-h-acc">
          {/* 🪪 `liga.existe()` y no `liga.T[…]` (18/11/2026): el botón no salía para quien está fuera de las 200 filas */}
          {liga.existe(f.k) ? <a className="btn verde chico" href={'#/r/' + encodeURIComponent(f.k)} onClick={cerrar}>{mia ? 'Ver mi perfil' : 'Ver su perfil'}</a> : null}
          {/* ⇄ sólo si los DOS están en «Comparar» de esta carta (18/11/2026), la regla del mismo botón del perfil
              (`enComparar()` de perfil.jsx): sin tu carta —o sin tu cara— «Comparar» ponía al #1 en tu lugar sin avisar, y
              el Abanico abre cartas sin mirar `fo` */}
          {yoK && !mia && enCmp(t, yoK) && enCmp(t, f.k) ? <button type="button" className="btn borde2 chico" onClick={() => { cerrar(); onComparar(t, f.k); }}>⇄ Comparar conmigo</button> : null}
          {mia ? <BotonHistoria liga={liga} k={f.k} c={t} cls="btn borde2 chico ta-bh" /> : url ? <Compartir cls="btn borde2 chico" url={url} texto={'La ' + NOMBRE[t] + ' de ' + nombre} etiqueta="Compartir" /> : null}
        </div>
        {lista.length > 1 ? <p className="ta-h-t">Desliza para pasar a la siguiente</p> : null}
      </div>
    </div>
  );
}

// ── «Ver todas» (`#/tarjetas/<carta>`): la galería entera de un tipo, con el buscador y los filtros (Dlx, 03/10/2026:
// «3. A»): las Nuevas —las de este tipo que salieron esta semana, del muro—, A quién sigues y por servidor. Un filtro
// que no filtra nada no se dibuja ──
function Galeria({ liga, t, lista, nuevas, onAbrir }) {
  const [q, setQ] = useState('');
  const [ver, setVer] = useState(false);
  const [sv, setSv] = useState('');
  const [soloNuevas, setSoloNuevas] = useState(false);
  const [soloSigo, setSoloSigo] = useState(false);
  useEffect(() => { setVer(false); }, [t]);
  const sigo = useMemo(() => new Set(liga.sigue || []), [liga]);
  // 🏠 de dónde es cada uno, sólo si lo eligió (Dlx, 12/10/2026). Ver elegidos.js
  const eleg = useElegidos();
  const orden = useMemo(() => ordenar(t, lista), [t, lista]);
  const svs = useMemo(() => [...new Set(lista.map((f) => f.sv).filter(Boolean))].sort(), [lista]);
  const nNuevas = lista.filter((f) => nuevas.has(f.k)).length;
  const nSigo = lista.filter((f) => sigo.has(f.k)).length;
  const qn = norm(q).trim();
  const filtra = !!(sv || soloNuevas || soloSigo);
  const fs = orden.filter((f) => (!qn || norm(limpio(f.n)).includes(qn)) && (!sv || f.sv === sv)
    && (!soloNuevas || nuevas.has(f.k)) && (!soloSigo || sigo.has(f.k)));
  const tope = movil() ? 12 : 24;
  const vis = ver || qn || filtra ? fs : fs.slice(0, tope);
  const sacar = () => { setQ(''); setSv(''); setSoloNuevas(false); setSoloSigo(false); };
  return (
    <section className="sec tj-gal" id="tj-gal">
      <div className="sec-t"><h2>{NOMBRE[t]}</h2><span className="tj-n">{num(lista.length)} · {t === 'competitivo' ? 'por Score' : t === 'temporada' ? 'por OVR' : 'por Score'}</span></div>
      {lista.length ? (
        <div className="rk-fil tj-fil">
          <label className="rk-buscar"><Ico n="buscar" t={18} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar rapero" aria-label="Buscar rapero" enterKeyHint="search" />
          </label>
          {nNuevas || nSigo || svs.length > 1 ? (
            <div className="rk-chips" role="group" aria-label="Filtrar">
              <button type="button" className={!filtra ? 'on' : ''} aria-pressed={!filtra} onClick={() => { setSv(''); setSoloNuevas(false); setSoloSigo(false); }}>Todas · {num(lista.length)}</button>
              {nNuevas ? <button type="button" className={'rk-chip-nuevo' + (soloNuevas ? ' on' : '')} aria-pressed={soloNuevas}
                onClick={() => setSoloNuevas(!soloNuevas)} title="Las que salieron esta semana">Nuevas · {nNuevas}</button> : null}
              {nSigo ? <button type="button" className={soloSigo ? 'on' : ''} aria-pressed={soloSigo} onClick={() => setSoloSigo(!soloSigo)}>A quién sigues · {nSigo}</button> : null}
              {svs.length > 1 ? svs.map((s) => (
                <button type="button" key={s} className={sv === s ? 'on' : ''} aria-pressed={sv === s} onClick={() => setSv(sv === s ? '' : s)}>
                  <img alt="" src={liga.logo(s)} />{siglaDe(s)} · {lista.filter((f) => f.sv === s).length}
                </button>
              )) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!lista.length ? <p className="rk-vacio">Todavía nadie tiene la de {NOMBRE[t]}. La primera aparece acá apenas alguien la desbloquee.</p>
        : !fs.length ? <p className="rk-vacio">Nadie con {qn ? 'ese nombre' : 'ese filtro'}. <button type="button" className="rk-lnk" onClick={sacar}>{qn && !filtra ? 'Borrar la búsqueda' : 'Sacar los filtros'}</button></p>
          : (
            <ul className={'tj-grilla aparece tj-' + t}>
              {vis.map((f, i) => (
                <li key={f.k}>
                  <button type="button" className="sin-boton" onClick={() => onAbrir(t, fs, i, false)} aria-label={'La ' + NOMBRE[t] + ' de ' + limpio(f.n)}>
                    <Carta liga={liga} k={f.k} cual={t} cls="tj-c" abre={false} />
                  </button>
                  {nuevas.has(f.k) ? <em className="ta-nueva">NUEVA</em> : null}
                  <div className="tj-pie">
                    <b>{limpio(f.n)}</b>
                    <small>{pieDe(liga, f, t, i, false)}{svElegido(liga, eleg, f.k) ? ' · ' + siglaDe(svElegido(liga, eleg, f.k)) : ''}</small>
                    {liga.cartaVieja(f.k, t) ? <small className="tj-dib"><Ico n="reloj" t={13} />se está redibujando</small> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
      {fs.length > vis.length ? <button type="button" className="btn borde2 chico tj-mas" onClick={() => setVer(true)}>Ver las {num(fs.length)}</button> : null}
    </section>
  );
}

// ── «Comparar»: tú contra alguien, fila por fila, con una barra por lado; el que gana cada fila, en verde ──
const valor = (f, campo) => {
  const v = f[campo];
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return isNaN(n) ? null : n;
};
const mostrar = (campo, n) => (n == null ? '—' : campo === 'pos' ? '#' + n : campo === 'wr' ? String(n).replace('.', ',') + '%'
  : campo === 'sc' ? String(n).replace('.', ',') : num(n));

function Elegir({ lista, f, onElegir, et, id }) {
  const [txt, setTxt] = useState(limpio(f.n));
  const [mal, setMal] = useState(false);
  useEffect(() => { setTxt(limpio(f.n)); setMal(false); }, [f.k]); // eslint-disable-line react-hooks/exhaustive-deps
  const resolver = (v) => {
    const qn = norm(v).trim();
    if (!qn) { setTxt(limpio(f.n)); return; }
    const x = lista.find((g) => norm(limpio(g.n)) === qn) || lista.find((g) => norm(limpio(g.n)).startsWith(qn))
      || lista.find((g) => norm(limpio(g.n)).includes(qn));
    if (x) { onElegir(x.k); setTxt(limpio(x.n)); setMal(false); } else setMal(true);
  };
  return (
    <label className={'rk-buscar tj-elegir' + (mal ? ' mal' : '')}>
      <Ico n="buscar" t={16} />
      <input list={id} value={txt} aria-label={et} placeholder="Buscar rapero" enterKeyHint="search"
        onFocus={(e) => e.target.select()}
        onChange={(e) => { const v = e.target.value; setTxt(v); setMal(false); if (lista.some((g) => limpio(g.n) === v)) resolver(v); }}
        onBlur={(e) => resolver(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolver(e.currentTarget.value); } }} />
    </label>
  );
}

function Comparar({ liga, porTipo, perf, cmp, setCmp, yoK }) {
  const [elige, setElige] = useState(false);
  const t = cmp.t;
  const lista = useMemo(() => ordenar(t, porTipo[t] || []), [t, porTipo]);
  if (lista.length < 2) return null;
  // 🔑 sin par elegido: tú y el que tienes justo adelante en ese tipo; si no tienes esa carta, los dos primeros
  const iyo = lista.findIndex((f) => f.k === yoK);
  const def = iyo > 0 ? [yoK, lista[iyo - 1].k] : iyo === 0 ? [yoK, lista[1].k] : [lista[0].k, lista[1].k];
  const A = lista.find((f) => f.k === (cmp.a || def[0])) || lista[0];
  const B = lista.find((f) => f.k === (cmp.b || def[1]) && f.k !== A.k) || lista.find((f) => f.k !== A.k);
  const filas = FILAS[t].map(([campo, et, dir]) => {
    const a = valor(A, campo);
    const b = valor(B, campo);
    const gana = a == null || b == null || a === b ? 0 : (dir > 0 ? a > b : a < b) ? 1 : 2;
    // cada barra mide contra el mejor de los dos; en Puesto, el mejor es el número más bajo
    const w = (x, y) => (x == null || y == null ? 0 : dir > 0 ? (Math.max(x, y) ? (100 * x) / Math.max(x, y) : 0) : (x ? (100 * Math.min(x, y)) / x : 0));
    return { campo, et, a, b, gana, wa: w(a, b), wb: w(b, a) };
  });
  // cara a cara: sus duelos, de /api/perfiles (los mismos del perfil)
  const du = ((perf && perf.p && perf.p[A.k]) || {}).du || [];
  const cc = du.filter((d) => { const r = liga.fila(d[1]); return r && r.k === B.k; });
  const g = cc.filter((d) => d[2]).length;
  const tipos = ORDEN.filter((c) => (porTipo[c] || []).length >= 2);
  const quien = (f) => (f.k === yoK ? 'Tú' : limpio(f.n));
  // de quién contra quién, en palabras (sin par elegido: tú y el que tienes justo arriba)
  const de = cmp.a || cmp.b ? quien(A) + ' contra ' + quien(B) : iyo > 0 ? 'tú contra el que está justo arriba' : iyo === 0 ? 'tú contra el que te sigue' : 'los dos primeros';
  return (
    <section data-tuto="tj-cmp" className="rka-caja ta-cmp" id="tj-cmp">
      <h2 className="rka-h">Comparar<small>{de + ' · ' + NOMBRE[t]}</small></h2>
      <div className="ta-cmp-t">
        {tipos.length > 1 ? (
          <div className="rk-chips ta-chips" role="group" aria-label="Qué tarjeta">
            {tipos.map((c) => <button type="button" key={c} className={c === t ? 'on' : ''} aria-pressed={c === t} onClick={() => setCmp({ t: c, a: cmp.a, b: cmp.b })}>{NOMBRE[c]}</button>)}
          </div>
        ) : <span />}
        <button type="button" className="btn borde2 chico" onClick={() => setElige(!elige)} aria-expanded={elige}>{elige ? 'Listo' : 'Comparar con otro'}</button>
      </div>
      {elige ? (
        <div className="ta-cmp-el">
          <datalist id="tj-nombres">{lista.map((f) => <option key={f.k} value={limpio(f.n)} />)}</datalist>
          <Elegir lista={lista} f={A} et="El primero" id="tj-nombres" onElegir={(k) => setCmp({ t, a: k, b: k === B.k ? A.k : B.k })} />
          <Elegir lista={lista} f={B} et="El segundo" id="tj-nombres" onElegir={(k) => setCmp({ t, a: k === A.k ? B.k : A.k, b: k })} />
        </div>
      ) : null}
      <div className={'ta-vs tj-' + t}>
        <figure><Carta liga={liga} k={A.k} cual={t} cls="tj-c" /><figcaption>{quien(A)}</figcaption></figure>
        <b className="ta-vs-x">VS</b>
        <figure><Carta liga={liga} k={B.k} cual={t} cls="tj-c" /><figcaption>{quien(B)}</figcaption></figure>
      </div>
      <ul className="ta-barras">
        {cc.length ? (
          <li className="ta-cara"><span className={g > cc.length - g ? 'gana' : ''}>{g}</span><em>Cara a cara · {cc.length === 1 ? 'una vez' : cc.length + ' veces'}</em><span className={cc.length - g > g ? 'gana' : ''}>{cc.length - g}</span></li>
        ) : null}
        {filas.map((x) => (
          <li key={x.campo}>
            <span className={x.gana === 1 ? 'gana' : ''}>{mostrar(x.campo, x.a)}</span>
            <i className="ba"><u className={x.gana === 1 ? 'g' : ''} style={{ width: x.wa + '%' }} /></i>
            <em>{x.et}</em>
            <i className="bb"><u className={x.gana === 2 ? 'g' : ''} style={{ width: x.wb + '%' }} /></i>
            <span className={x.gana === 2 ? 'gana' : ''}>{mostrar(x.campo, x.b)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// 🔑 «Comparar conmigo» (Dlx, 03/10/2026: «2. A»): el perfil de otro trae `?a=<tú>&b=<él>`, y «Comparar» arranca con los
// dos puestos y la página baja hasta ahí
export function Tarjetas({ liga, dc, tipo, q = '' }) {
  const pq = new URLSearchParams(q);
  const t = ORDEN.includes(tipo) ? tipo : '';
  const perf = usePerfiles();
  const yoK = (liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  const [h, setH] = useState(null);
  const [cmp, setCmp] = useState({ t: 'temporada', a: pq.get('a') || '', b: pq.get('b') || '' });
  useEffect(() => {
    if (!(pq.get('a') && pq.get('b'))) return undefined;
    setCmp({ t: 'temporada', a: pq.get('a'), b: pq.get('b') });
    const r = setTimeout(() => accion.ir('tj-cmp'), 400);
    return () => clearTimeout(r);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  // quién aparece: alguna carta y su foto (`conTarjeta()` de app.js), en el orden de la tabla
  const con = useMemo(() => (liga.d.tabla || []).filter((f) => (f.c || []).length && f.fo !== 0), [liga]);
  const porTipo = useMemo(() => Object.fromEntries(ORDEN.map((c) => [c, con.filter((f) => f.c.includes(c))])), [con]);
  // las Nuevas: las de cada tipo que salieron esta semana, del muro
  const nuevas = useMemo(() => {
    const d = liga.desdeLunes();
    return Object.fromEntries(ORDEN.map((c) => [c, new Set(liga.muro.filter((it) => it.tipo === 'tarjeta' && it.carta === c && utc(it.t) >= d).flatMap((it) => it.ks || []))]));
  }, [liga]);
  // 🏟️ las cartas de liga y 🃏 las que salieron esta semana (antes del `if (t)`: son hooks)
  const x = useLigas(liga);
  const us = useMemo(() => nuevasDeLaSemana(liga), [liga]);
  const nLiga = useMemo(() => gruposLiga(x).reduce((s, y) => s + y[1].length, 0), [x]);
  const abrir = (tt, lista, i, grupo) => setH({ t: tt, lista, i, grupo });
  // 🔁 EN «VER TODAS» NO HAY «COMPARAR» (18/11/2026): la rama de la galería no lo dibuja, así que `accion.ir('tj-cmp')` no
  // encontraba nada y el botón sólo cerraba la hoja. Se vuelve al álbum —la misma `Tarjetas`, así `cmp` se queda— y se
  // baja con el plazo del efecto de `?a=&b=` (sin `?a=&b=` en la dirección: ese efecto pone la Temporada)
  const comparar = (tt, k) => {
    setCmp({ t: tt, a: yoK, b: k });
    if (t) location.hash = '#/tarjetas';
    setTimeout(() => accion.ir('tj-cmp'), t ? 400 : 150);
  };
  // ¿está en «Comparar» de esa carta? (`porTipo`: con la carta y con su cara)
  const enCmp = (tt, k) => !!k && (porTipo[tt] || []).some((x) => x.k === k);
  // tocar una de tus cartas en la mano: la hoja con las tuyas
  const abrirMia = (c) => {
    const f = liga.T[yoK];
    if (!f) { accion.carta(yoK, c); return; }
    setH({ t: c, lista: [f], i: 0, grupo: false });
  };
  const hoja = h ? <Hoja liga={liga} yoK={yoK} h={h} setH={setH} onComparar={comparar} enCmp={enCmp} /> : null;
  if (t) {
    return (
      <>
        <nav className="rk-subs" aria-label="Tarjetas">
          <div className="rk-subs-in">
            <a href="#/tarjetas">← Tu álbum</a>
            {ORDEN.map((c) => (
              <a key={c} href={'#/tarjetas/' + c} className={c === t ? 'on' : ''} aria-current={c === t ? 'page' : undefined}>
                {NOMBRE[c]}<i>{num(porTipo[c].length)}</i>
              </a>
            ))}
          </div>
        </nav>
        <Galeria liga={liga} t={t} lista={porTipo[t]} nuevas={nuevas[t]} onAbrir={abrir} />
        {hoja}
      </>
    );
  }
  // 🏁 6.84, LA ESTRUCTURA DE LA LLAVE (Dlx: «A con algo de B pero asegúrate que estén todos los tipos de tarjetas», a la
  // maqueta https://claude.ai/artifact/N6sCTwawfAHEZowetjKWs3). Arriba, en la escena: la franja, tu mano (las cuatro y
  // la de liga) con Comparar abajo, y al lado las que salieron esta semana. Abajo, en el papel, los cinco tipos en
  // pestañas con su #1 a la vista
  const fila = yoK ? liga.T[yoK] : null;
  const franja = [];
  if (fila && fila.pos && (porTipo.temporada || []).some((f) => f.k === yoK)) {
    franja.push({ l: 'Tu puesto', v: '#' + fila.pos, em: 'de ' + num(porTipo.temporada.length), c: 'en la Temporada' + (fila.ovr ? ', con ' + fila.ovr + ' de OVR' : '') });
  } else if (us.length) {
    franja.push({ l: 'Salieron esta semana', v: num(us.length), em: us.length === 1 ? 'carta' : 'cartas', c: 'desde el lunes, de los cuatro tipos' });
  }
  franja.push({ l: 'En la Liga', v: num(TIPOS.reduce((s, c) => s + (c === 'liga' ? nLiga : (porTipo[c] || []).length), 0)), em: 'cartas',
    c: TIPOS.filter((c) => (c === 'liga' ? nLiga : (porTipo[c] || []).length)).map((c) => num(c === 'liga' ? nLiga : porTipo[c].length) + ' ' + NOMBRE[c]).join(' · ') });
  franja.push({ l: 'Raperos con carta', v: num(con.length), c: 'con alguna de las cuatro y su foto' });
  const nSv = new Set((porTipo.servidor || []).map((f) => f.sv).filter(Boolean)).size;
  const nPa = new Set((porTipo.pais || []).map((f) => f.cc).filter(Boolean)).size;
  const nLg = gruposLiga(x).length;
  franja.push(nLg ? { l: 'Servidores, países y ligas', v: nSv + ' · ' + nPa + ' · ' + nLg, c: 'cada uno con su #1, abajo' }
    : { l: 'Servidores y países', v: nSv + ' y ' + nPa, c: 'cada uno con su #1, abajo' });
  const cmpEl = <Comparar liga={liga} porTipo={porTipo} perf={perf} cmp={cmp} setCmp={setCmp} yoK={yoK} />;
  return (
    <>
      <div className="escena ta-esc" style={{ '--mo-c': '#29B298', '--mo-o': 0.9, '--mo-c2': '#E41373' }}>
        <section className="ta-cab rka" id="tj-cab">
          <div className="ta-cab-tx">
            <span className="tag">TARJETAS · {liga.temp}</span>
            <h1 className="hero-ev">Tarjetas</h1>
            <p className="hero-p">Las cartas de la Liga: cada una mide algo distinto y se consigue distinto. Toca una para verla grande.</p>
          </div>
          <Franja items={franja} />
          <div className={'rka-dos ta-dos' + (us.length ? '' : ' sin-rail')}>
            <div className="rka-izq">
              <Album liga={liga} dc={dc} perf={perf} onAbrir={abrirMia} x={x} />
              {us.length ? cmpEl : null}
            </div>
            <div className="rka-rail">{us.length ? <Nuevas liga={liga} us={us} onAbrir={abrir} /> : cmpEl}</div>
          </div>
        </section>
      </div>
      <Sec id="tj-tipos" titulo="Las de toda la Liga" extra="rka-papel ta-papel">
        <Vitrina liga={liga} x={x} porTipo={porTipo} nuevas={nuevas} onAbrir={abrir} yoK={yoK} />
      </Sec>
      {hoja}
    </>
  );
}
