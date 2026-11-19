// 🏆 LA LLAVE, NUEVA (Dlx, 03/10/2026: «1. A 2. A 3. A» al plan de lo que falta del remake, la llave primero, y la 2:
// «arriba el podio, y abajo el cuadro de a una ronda por pantalla, deslizando —Octavos → Cuartos → Semis → Final—, como
// en las apps de fútbol. Tocás un nombre y se marca su camino»). Reemplaza la ventana de app.js (`abrirLlave()`), que
// Dlx había pedido mejorar (*«la sección de llaves tiene que mejorar bastante»*): ahora es una página, con su
// dirección (`#/llave/<n>`, y `#/llave/v:<id>` la que se está jugando), así que se comparte y el «atrás» del celular
// vuelve a donde estabas.
// ⚠️ LAS MISMAS REGLAS QUE LA DE APP.JS, una por una: el cuadro sale de `b[3]` (de qué batallas vienen los lados, lo
// arma `llaves_web.enlazar()`) y lo que no engancha se dibuja igual, en su columna; un 5 vidas es un tablero y no un
// cuadro; la nave de funa es una lista con ❌; un equipo va junto, y sin perfil si la llave no dice quiénes son
// (`L.sin`); el Clásico, el 🎯 del Most Wanted, los puntos por puesto y «¿Algo está mal?». En la compu, el cuadro
// entero con sus ramas (en espejo si entra), como antes.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PAIS, capital, esSinTitulo, limpio, norm, normNombre, num } from './liga.js';
import { Alguien, Algunos, Bandera, Cara, Compartir, Ico, Medalla, PUESTO_MEDALLA, enlace, silueta } from './piezas.jsx';
import { completar, enOrden, esArbol, esDoble, jugado, partirDoble } from './arriba.jsx';
import { usePases, vioVivo, vivoPendiente } from './pase.js';
import { ConMarco } from './marcos.jsx';
import { TEMAS_SV, leerTemas } from './temas.js';
import CSS_PAGINA from './css/llave.css?inline';
import { usarCss } from './css.js';
import { pedirLlave, pedirRoles, puede } from './panelsocio.js';

// 🎨 su CSS, con su pedazo (web/src/css/llave.css)
usarCss('llave', CSS_PAGINA);

const MEDALLA = PUESTO_MEDALLA;
const ORD_P = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos', 'Dieciseisavos', 'R32'];
const PREVIAS = ['Filtros', 'Clasificatorias', 'Preliminares'];
const BANDERAS = /[\u{1F1E6}-\u{1F1FF}]/gu;

// un lado, siempre como texto: en vivo un equipo puede venir como lista
const texto = (z) => (typeof z === 'string' ? z : (z || []).join(', '));
const normB = (b) => [(b[0] || []).map(texto), texto(b[1]), String(b[2] || ''), Array.isArray(b[3]) ? b[3] : []];
// los integrantes de un lado («a, b, c» es un equipo)
// los integrantes de un lado: la llave procesada escribe «A, B» y la en vivo «A + B» (LA REDENCION, 03/10/2026)
const partes = (s) => String(s || '').split(/\s*[,+&]\s*/).filter(Boolean);
// los nombres de una llave, una vez: la tabla y cada parte de cada lado (como `Corregir` del Dashboard)
const nombresDe = (L) => {
  const out = [];
  for (const f of (L && L.tabla) || []) if (f[0] && !out.includes(f[0])) out.push(f[0]);
  for (const ro of (L && L.rondas) || []) for (const b of ro.b || []) for (const lado of b[0] || []) for (const p of partes(lado)) if (!out.includes(p)) out.push(p);
  return out;
};
const miembros = (x) => String(x || '').split(/[,+&]/).map((s) => s.replace(BANDERAS, '').trim().toLowerCase()).filter(Boolean);
const comparten = (a, b) => { const mb = miembros(b); return miembros(a).some((x) => mb.includes(x)); };
const gana = (b, s) => !!b[1] && (b[1] === s || comparten(b[1], s));

// «Denik 🇵🇪» -> «Denik» y la bandera aparte (`conBanderas()` de app.js): en Windows el emoji son dos letras sueltas.
// Un país que la Liga no conoce no se dibuja: dos letras no dicen nada
function sinBanderas(x) {
  const ccs = [];
  let txt = '';
  let par = '';
  for (const ch of String(x || '')) {
    const c = ch.codePointAt(0);
    if (c >= 0x1F1E6 && c <= 0x1F1FF) {
      par += String.fromCharCode(c - 0x1F1E6 + 97);
      if (par.length === 2) { if (PAIS[par]) ccs.push(par); par = ''; }
    } else txt += ch;
  }
  return { txt: limpio(txt), ccs };
}
const clave = (x) => norm(sinBanderas(x).txt).replace(/[^\p{L}\p{N}]/gu, '');

// cuánto hace de algo, en palabras («hace 3 min»)
function hace(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'recién';
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.floor(m / 60);
  return 'hace ' + h + (h === 1 ? ' hora' : ' horas');
}

// ── las llaves que no viajan en el lobby (las más viejas): se piden todas una vez, como `llaveVieja()` de app.js ──
let TODAS = null;
function pedirTodas() {
  if (!TODAS) {
    // ⚠️ lo que falla NO se guarda (revisión del 04/10/2026): un pedido que no llegó quedaba como respuesta para toda la
    // visita, y cada llave vieja que se abría después decía «link mal copiado». La próxima vez se pide de nuevo
    TODAS = fetch('/api/llaves', { headers: { accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((t) => (t && t.llaves) || t || {})
      .catch(() => { TODAS = null; return null; });
  }
  return TODAS;
}

// 📦 UNA SOLA, SUELTA, DE R2 (Dlx, 17/11/2026: «que cuando son llaves antiguas que tome tiempo cargar… para q no cargue
// toda la data»): `<r2>/llaves/<n>.json` pesa ~1,5 KB contra los 75 KB comprimidos de todas. La sube el ciclo
// (`subir_web.subir_llaves_sueltas()`); si todavía no está o R2 no contesta, la de siempre
const UNA = {};
// 📶 'error' si no se pudo bajar NADA (18/11/2026): sin red fallaban R2 y /api/llaves, y el null de «no la bajé» se
// leía como «no existe»: «Esa llave no está… el link está mal copiado», de una llave que existe y sin reintentar
const deTodas = (n) => pedirTodas().then((t) => (t ? (t[n] || null) : 'error'));
function pedirUna(n, r2) {
  if (!/^\d+$/.test(String(n)) || !r2) return deTodas(n);
  if (!UNA[n]) {
    UNA[n] = fetch(r2 + '/llaves/' + n + '.json', { headers: { accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(() => { delete UNA[n]; return deTodas(n); });
  }
  return UNA[n];
}

// 🏟️ las clases del tema de la llave: las de su servidor si quien mira no eligió uno (y si ese servidor tiene tema)
function temaLlave(sv) {
  const s = String(sv || '').toUpperCase();
  return !leerTemas().sv && TEMAS_SV.some(([x]) => x === s) ? ' lk-tsv t-' + s.toLowerCase() : '';
}

// ── el ancho de la pantalla: en la compu el cuadro entero, en el celular de a una ronda ──
function useCompu() {
  const q = () => (window.matchMedia ? window.matchMedia('(min-width: 900px)').matches : true);
  const [si, setSi] = useState(q);
  useEffect(() => {
    const f = () => setSi(q());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return si;
}

// ── un nombre: su cara, su nombre y su bandera. Tocarlo marca su camino ──
function Nombre({ x, f }) {
  if (f) return <><span className="lk-n">{capital(limpio(f.n))}</span><Bandera cc={f.cc} cls="lk-flag" /></>;
  const { txt, ccs } = sinBanderas(x);
  return <><span className="lk-n">{capital(txt || x)}</span>{ccs.map((cc) => <Bandera key={cc} cc={cc} cls="lk-flag" />)}</>;
}
function Persona({ ctx, x, conCara = true, perdio = false }) {
  const f = ctx.fila(x);
  if (!f && ctx.esSin(x)) {
    return <span className="lk-p lk-eqn" title="Un equipo de este evento: la llave no dice quiénes son, así que no suma puntos">{sinBanderas(x).txt}<small>equipo</small></span>;
  }
  const id = ctx.idDe(x);
  const on = ctx.sigo === id;
  return (
    <button type="button" className={'lk-p' + (on ? ' on' : '')} aria-pressed={on} onClick={() => ctx.seguir(id)}>
      {conCara ? <Mini ctx={ctx} f={f} nombre={f ? f.n : sinBanderas(x).txt} /> : null}
      <Nombre x={x} f={f} />
      {ctx.marca(x, f, perdio)}
    </button>
  );
}

// 🃏 LA CARTA EN VEZ DEL CIRCULITO (Dlx, 18/10/2026: «en vez del cuadrado, la tarjeta del participante… y los que no
// están verificados, simplemente su cuadrado», y a la pregunta: «carta chica + Pase»). Quien tiene carta lleva la suya
// en miniatura —la de Servidor si es de ESE servidor, si no la de Temporada (`liga.cartaDe()`)—; quien no, su cara. Y
// desde el nivel 8 del Pase, brilla
const urlCarta = (ctx, f, chica = false) => {
  const cual = f ? ctx.liga.cartaDe(f.k, { sv: ctx.L && ctx.L.sv }) : null;
  return cual ? ctx.liga.cartaUrl(f.k, cual, chica) : null;
};
// 🃏 LA CARTA CHICA (Dlx, 19/10/2026: «si»): en la llave se dibuja a ~80–150 px y bajaba la de Discord, ~150 KB cada una
// (una llave de 16, ~2,4 MB en el celular). La chica pesa ~22 KB; si todavía no existe (una carta recién dibujada antes
// de que el ciclo la complete), vuelve a la grande sola, una vez
// 🖼️ Y CON SU MARCO DEL PASE, SI LO TIENE (Dlx, 17/11/2026: «asegúrate que cada tarjeta tenga su efecto y brillo… sólo si
// es que lo tienen»): la llave dibujaba la imagen pelada, sin el marco (Premium, Plata, Oro y su brillo) que `Carta` de
// piezas.jsx le pone en el resto de la página. `ConMarco` decide por el ancho en pantalla: menos de 130 px sólo el
// contorno, menos de 200 el anillo y la pieza principal. `ancho`: el que ya se sabe (MiniP); si no, se mide
function ImgCarta({ ctx, f, cls, grande = false, ancho = 0 }) {
  const pub = usePases();
  const mk = f && pub && pub.m && pub.m[f.k];
  const ref = useRef(null);
  const [w, setW] = useState(ancho);
  // ⚡ sólo se mide la que lleva marco (revisión del 17/11/2026): medir obliga al navegador a calcular el layout, y una
  // llave de 32 tiene hasta 64 cartas y una decena de marcos en toda la Liga
  useLayoutEffect(() => {
    if (!mk || ancho || w || !ref.current) return;
    const x = ref.current.getBoundingClientRect().width;
    if (x > 0) setW(x);
  });
  const chica = grande ? null : urlCarta(ctx, f, true);
  const full = urlCarta(ctx, f);
  const img = <img ref={ref} className={cls} alt="" src={chica || full} loading="lazy" decoding="async"
    onError={chica ? (e) => { if (e.currentTarget.src !== full) e.currentTarget.src = full; } : undefined} />;
  const W = ancho || w;
  if (!mk || !W) return img;
  const liga = ctx.liga;
  const cual = liga.cartaDe(f.k, { sv: ctx.L && ctx.L.sv });
  const svc = f.sv && liga.svs && liga.svs[f.sv] ? liga.svs[f.sv].color : '';
  return <span className="lk-mk"><ConMarco m={mk} cual={cual} ancho={W} svColor={svc} cc={f.cc} src={full}>{img}</ConMarco></span>;
}

// ⭐ LA NOTA DE CADA UNO EN LA LLAVE, COMO LA DE LOS FUTBOLISTAS AL TERMINAR EL PARTIDO (Dlx, 17/11/2026: «quizás poner
// en cada tarjeta una puntuación así como los futbolistas al final de cada partido»; a la vista previa, «sí»). NO SE
// CALCULA ACÁ: viaja en la llave (`L.notas`, de `llaves_web.notas()`), que es lo mismo que lee el aviso del bot. La
// vista previa la calculaba en la página y con el OVR de hoy; ver allá por qué ya no. Una llave en vivo no tiene nota:
// es la de después del partido. Se busca a cada integrante como `clave_nota()`: sin banderas, en minúsculas
const kNota = (m) => String(m || '').replace(BANDERAS, '').trim().toLowerCase();
// «Ezias🥈✒️🧢🐍» y «Ezias» son el mismo nombre escrito: el «se anotó como» sólo cuando cambian las letras
const soloLetras = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const tonoNota = (v) => (v >= 9 ? 'n9' : v >= 8 ? 'n8' : v >= 7 ? 'n7' : v >= 6 ? 'n6' : 'n5');
function Nota({ ctx, s }) {
  const N = ctx.L && ctx.L.notas;
  if (!N || !N.v) return null;
  const ks = partes(s).map(kNota);
  const v = N.v[ks[0]];
  if (v == null) return null;
  const mvp = !!N.mvp && ks.includes(N.mvp);
  // 🔥 EL BATACAZO DE LA NOCHE (Dlx, 18/11/2026, «Dos premios»: el MVP es la nota más alta y el que ganó con 35 % de chance
  // o menos lleva su propio sello; «Batacazo en la página»). Viaja en `L.notas.bat`, sólo en los eventos desde el #661
  const bat = !!N.bat && ks.includes(N.bat);
  return <span className={'lk-nota ' + tonoNota(v) + (mvp ? ' mvp' : '') + (bat ? ' bat' : '')}
    title={(mvp ? 'La figura de la llave · ' : '') + (bat ? 'El batacazo de la noche · ' : '') + 'Nota en esta llave: ' + v.toFixed(1)}>
    {mvp ? <i aria-hidden="true">★</i> : null}{bat ? <i aria-hidden="true">🔥</i> : null}{v.toFixed(1)}</span>;
}
function Mini({ ctx, f, nombre }) {
  const liga = ctx.liga;
  // 🅰️ en el remake A (18/11/2026) las filas de la llave van con la cara: la carta grande queda para la final
  const url = ctx.caras ? null : urlCarta(ctx, f);
  if (!url) return <Cara liga={liga} k={f ? f.k : ''} nombre={nombre} cls="lk-cara" />;
  return <span className={'lk-carta' + (liga.brilla(f.k) ? ' brilla' : '')}><ImgCarta ctx={ctx} f={f} /></span>;
}

// 🃏 SÓLO LA CARTA (Dlx, 18/10/2026: «el objetivo de la carta es quitar ese espacio… en la carta aparece el nombre, la
// bandera… no necesitaríamos el nombre, la bandera o el cuadro, sólo la tarjeta, si está disponible»). Una batalla de
// uno contra uno donde alguno tiene carta se dibuja como un VERSUS: los dos lados lado a lado, cada uno con su carta
// —que ya trae nombre y bandera—; quien no tiene, una ficha del mismo tamaño con su cara, su nombre y su bandera. Los
// equipos y las batallas sin ninguna carta siguen en filas, que ocupan menos. ⚠️ SIN ✓: en la esquina de arriba la
// carta de Temporada lleva su puesto (#4) y la tapaba; quien pasó se ve en color y quien quedó afuera, en gris
const enCartas = (ctx, ls) => !ctx.caras && ls.length > 0 && ls.every((s) => partes(s).length === 1 && (ctx.fila(s) || !ctx.esSin(s)))
  && ls.some((s) => !!urlCarta(ctx, ctx.fila(s)));
//: la proporción de las cartas (300 × 438): la Servidor es un poco más baja y entra entera, centrada
const CARTA_AR = 438 / 300;
// de a cuántas por fila: de a dos, y de a tres en los grupos de tres o más de cuatro (uno de tres dejaba una carta sola
// abajo y un hueco al lado)
const colsVs = (n) => (n === 3 || n >= 5 ? 3 : 2);
//: el hueco entre las cartas de un versus y el alto del renglón de sus etiquetas (los de `.lk-vs` y `.lk-b.cartas .lk-et`)
const VS_GAP = 6;
const ET_H = 26;

function Ficha({ ctx, b, s, copa, pasa, llega, grande = false }) {
  const f = ctx.fila(s);
  const url = urlCarta(ctx, f);
  const g = gana(b, s) || pasa;
  const perdio = !!b[1] && !g;
  const id = ctx.idDe(s);
  const on = ctx.sigo === id;
  const sb = sinBanderas(s);
  const nombre = f ? capital(limpio(f.n)) : capital(sb.txt || s);
  const cls = 'lk-fc' + (g ? (copa ? ' copa' : ' g') : (b[1] ? ' x' : '')) + (on ? ' on' : '') + (url && ctx.liga.brilla(f.k) ? ' brilla' : '')
    + (llega ? ' llega' : '');
  return (
    <button type="button" className={cls} aria-pressed={on} title={nombre} onClick={() => ctx.seguir(id)}
      aria-label={nombre + (g ? (copa ? ', campeón' : ', pasó') : perdio ? ', quedó afuera' : '')}>
      {url ? <ImgCarta ctx={ctx} f={f} cls="lk-fc-img" grande={grande} />
        : <span className="lk-fc-sin">
          <Cara liga={ctx.liga} k={f ? f.k : ''} nombre={nombre} cls="lk-cara" />
          <span className="lk-n">{nombre}</span>
          {f ? <Bandera cc={f.cc} cls="lk-flag" /> : sb.ccs.map((cc) => <Bandera key={cc} cc={cc} cls="lk-flag" />)}
        </span>}
      {ctx.marca(s, f, perdio)}
      <Nota ctx={ctx} s={s} />
    </button>
  );
}

// 🎤 UN LADO EN GRANDE (lo de AHORA y el campeón): su carta, o su cara y su nombre; un equipo, las caras y los nombres
function Grande({ ctx, b, s, cls = 'lk-gr' }) {
  // (en grande, la carta grande: la chica se vería borrosa)
  if (partes(s).length === 1) return <div className={cls}><Ficha ctx={ctx} b={b} s={s} copa={false} pasa={false} grande /></div>;
  return (
    <div className={cls + ' lk-gr-eq'}>
      <span className="lk-fc-sin">
        <span className="lk-caras">{partes(s).map((m, i) => { const f = ctx.fila(m); return <Cara key={i} liga={ctx.liga} k={f ? f.k : ''} nombre={f ? f.n : sinBanderas(m).txt} cls="lk-cara" />; })}</span>
        <span className="lk-n">{partes(s).map((m) => { const f = ctx.fila(m); return f ? capital(limpio(f.n)) : capital(sinBanderas(m).txt); }).join(' · ')}</span>
      </span>
    </div>
  );
}

// ⚔️ LA BATALLA DE AHORA, ARRIBA Y EN GRANDE (Dlx, 18/10/2026: «all of them»): las dos cartas enfrentadas y la que sigue
function AhoraVs({ ctx }) {
  const k = (ctx.pend || [])[0];
  if (!k) return null;
  const [i, j] = k.split(':').map(Number);
  const R = ctx.prin[i];
  const b = R && R.b[j];
  if (!b || b[0].length < 2) return null;
  const sig = (ctx.pend || [])[1] ? ctx.pend[1].split(':').map(Number) : null;
  const bs = sig && ctx.prin[sig[0]] ? ctx.prin[sig[0]].b[sig[1]] : null;
  const nom = (s) => partes(s).map((m) => { const f = ctx.fila(m); return f ? limpio(f.n) : sinBanderas(m).txt; }).join(' y ');
  return (
    <section className="lk-ahora" aria-label={'Se juega ahora: ' + b[0].map(nom).join(' contra ')}>
      <span className="lk-ahora-t"><b>● AHORA</b> · {R.r}</span>
      <div className="lk-ahora-vs">
        {b[0].map((s, x) => [x ? <span key={'v' + x} className="lk-ahora-x" aria-hidden="true">VS</span> : null, <Grande key={x} ctx={ctx} b={b} s={s} />])}
      </div>
      {bs && bs[0].length >= 2 ? <p className="lk-ahora-sig">Después: {bs[0].map(nom).join(' vs ')}</p> : null}
    </section>
  );
}

// 🏆 EL CAMPEÓN, EN GRANDE (Dlx, 18/10/2026: «all of them»): su carta —o la de cada uno, si fue un equipo—, la copa y lo
// que cobró
function CampeonG({ ctx }) {
  const fin = ctx.final;
  if (!fin || !fin[1]) return null;
  const quien = partes(fin[1]);
  return (
    <section className="lk-camp" aria-label={'Campeón: ' + quien.join(', ')}>
      <span className="lk-camp-t"><Ico n="copa" t={18} />{quien.length > 1 ? 'Campeones' : 'Campeón'}</span>
      <div className="lk-camp-cs">{quien.map((m, i) => <Grande key={i} ctx={ctx} b={fin} s={m} cls="lk-gr lk-camp-c" />)}</div>
      {ctx.ptsCamp ? <small className="lk-camp-p">+{ctx.ptsCamp} pts{quien.length > 1 ? ' cada uno' : ''}</small> : null}
    </section>
  );
}

// 🃏 UNA PERSONA EN CHICO (remake del 17/11/2026, Dlx: «me gusta la C… y podríamos usar el A de vs… la idea era usar acá
// las tarjetas en vez de nombres… pero minis, tampoco tan grandes»). Su carta en miniatura —ya trae nombre y bandera—;
// sin carta, una ficha del MISMO tamaño con su cara, su nombre y su bandera (nunca una caja vacía: eso era el campeón sin
// carta de antes, un rectángulo negro gigante). Un equipo: las caras juntas y los nombres
function MiniP({ ctx, s, ancho = 64, apagado = false, sinNombre = false, sinNota = false }) {
  const ms = partes(s);
  const alto = Math.round(ancho * CARTA_AR);
  const st = { width: ancho, height: alto };
  if (ms.length > 1) {
    return (
      <span className={'lk-mp eq' + (apagado ? ' x' : '')} style={st}>
        <span className="lk-caras">{ms.map((m, i) => { const f = ctx.fila(m); return <Cara key={i} liga={ctx.liga} k={f ? f.k : ''} nombre={f ? f.n : sinBanderas(m).txt} cls="lk-cara" />; })}</span>
        <span className="lk-n">{ms.map((m) => { const f = ctx.fila(m); return f ? capital(limpio(f.n)) : capital(sinBanderas(m).txt); }).join(' · ')}</span>
        {sinNota ? null : <Nota ctx={ctx} s={s} />}
      </span>
    );
  }
  const f = ctx.fila(s);
  const url = urlCarta(ctx, f);
  const sb = sinBanderas(s);
  const nombre = f ? capital(limpio(f.n)) : capital(sb.txt || s);
  if (url) return <span className={'lk-mp c' + (apagado ? ' x' : '') + (ctx.liga.brilla(f.k) ? ' brilla' : '')} style={st} title={nombre}><ImgCarta ctx={ctx} f={f} cls="lk-mp-img" grande={ancho > 110} ancho={ancho} />{sinNota ? null : <Nota ctx={ctx} s={s} />}</span>;
  return (
    <span className={'lk-mp s' + (apagado ? ' x' : '')} style={st} title={nombre}>
      <Cara liga={ctx.liga} k={f ? f.k : ''} nombre={nombre} cls="lk-cara" />
      {sinNombre ? null : <span className="lk-n">{nombre}</span>}
      {f ? <Bandera cc={f.cc} cls="lk-flag" /> : sb.ccs.map((cc) => <Bandera key={cc} cc={cc} cls="lk-flag" />)}
      {sinNota ? null : <Nota ctx={ctx} s={s} />}
    </span>
  );
}
const nombreDe = (ctx, s) => partes(s).map((m) => { const f = ctx.fila(m); return f ? capital(limpio(f.n)) : capital(sinBanderas(m).txt); }).join(' y ');

// 👥 LOS INSCRITOS Y EL JURADO DE LA LLAVE (Dlx, 17/11/2026: «mostrar cada llave… quiénes se inscribieron y alumbrar a
// los que finalmente participaron» y «los staff que había, quiénes votaban y si cambiaron en qué ronda»). Sale de
// `L.gente` (bot/gente_evento.py), que se guarda al verse: el canal de inscripciones lo vacían. Sin nada, no se dibuja
// 🔒 el mensaje de inscripción viaja crudo (18/11/2026): «<@1358539185778327612> 🇦🇷» de la #521 dejaba un Discord ID a la
// vista. Sin menciones, canales ni emojis propios de Discord; lo que queda vacío y sin `es` no se dibuja
const sinMenciones = (t) => limpio(String(t || '').replace(/<a?:\w+:\d+>|<@[!&]?\d+>|<#\d+>/g, ''));


// 🥊 EL VERSUS DE LA FINAL, ARRIBA (la A de la maqueta: la página de evento de UFC). El campeón en blanco, el subcampeón al
// lado y el resto del podio debajo, en chico. Sale de la tabla de la llave —campeón y subcampeón—, así sirve también para
// la doble y las vidas, donde la última batalla no es «la final»
// ⚠️ LADOS, NO FILAS (revisión del 17/11/2026): la tabla trae una fila por integrante, y en las 51 llaves de equipos el
// versus mostraba «Campeón: Hassan» solo, sin Neo ni PichulaMc. El campeón y el subcampeón son los lados de la final (como
// el `CampeonG` de antes); los que llegaron lejos, el lado de la llave de cada uno, agrupando a los de un mismo equipo.
// Agrupar por PUESTO no sirve: los dos semifinalistas comparten puesto y no son un equipo
function ladosDe(ctx, L, re, tope) {
  const ladoDe = (m) => {
    const id = ctx.idDe(m);
    let x = '';
    (L.rondas || []).forEach((R) => (R.b || []).forEach((b) => (b[0] || []).forEach((s) => {
      if (partes(texto(s)).some((q) => ctx.idDe(q) === id)) x = texto(s);
    })));
    return x || m;
  };
  const out = [];
  const vistos = new Set();
  (L.tabla || []).filter((r) => re.test(r[1])).forEach((r) => {
    const s = ladoDe(partes(r[0])[0]);
    const k = partes(s).map((q) => ctx.idDe(q)).sort().join('|');
    if (vistos.has(k) || out.length >= tope) return;
    vistos.add(k);
    out.push([s, r[1], r[2], partes(s).length > 1]);
  });
  return out;
}
// 💰 LOS PUNTOS DE UN LADO, LOS DE TODOS SUS INTEGRANTES (18/11/2026): se escribían los de la PRIMERA fila de la tabla con
// ese puesto como si fueran de todos: «+4.250 pts cada uno» en la #360, donde Abyssus y Hassan sacaron 2.500 (un equipo
// no siempre cobra parejo, como dice el podio). Parejos, «cada uno»; si no, el rango. Sin ninguna fila del lado en la
// tabla, la que vino, como antes. Sin puntos, nada (nunca «+0 pts»)
const ptsLado = (ctx, L, r, cu) => {
  const ids = partes(r[0]).map((m) => ctx.idDe(m));
  const idsFila = (f) => partes(f[0]).map((m) => ctx.idDe(m)).concat(f[3] && partes(f[0]).length === 1 ? ['k:' + f[3]] : []);
  const ps = (L.tabla || []).filter((f) => f[1] === r[1] && idsFila(f).some((id) => ids.includes(id))).map((f) => +f[2] || 0);
  const xs = ps.length ? ps : [+r[2] || 0];
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  if (!hi) return '';
  return lo === hi ? num(hi) + ' pts' + (r[3] ? cu : '') : num(lo) + ' a ' + num(hi) + ' pts';
};


// ⚖️ EL VOTO DE CADA JUEZ, AL LADO DE A QUIÉN VOTÓ (el remake A, 18/11/2026: la maqueta que eligió Dlx, «Pestañas»). Una
// marca por juez con su inicial; el nombre entero en la ayuda. Sale de `L.gente.jur` (bot/gente_evento.py)
const inicial = (q) => (limpio(q)[0] || '?').toUpperCase();
function Votos({ j, li, b }) {
  const qs = j ? j.v.filter((v) => v[1] === li).map((v) => v[0]) : [];
  if (!qs.length) return null;
  const a = sinBanderas(b[0][li] || '').txt;
  return <span className="lk-vts">{qs.map((q, i) => <i key={i} className="lk-vt" title={limpio(q) + ' votó a ' + a} aria-label={limpio(q) + ' votó a ' + a}>{inicial(q)}</i>)}</span>;
}

// 🔥 UNA DE 3 A 5 MCs, EN CHICO (el remake A): quién pasó, en su fila, y los demás en un renglón con sus caras. Sólo ya
// decidida: en vivo se ven todos
const RESTO_H = 30;
const compacta = (b, pasan) => {
  if ((b[0] || []).length <= 2 || !b[1]) return null;
  const g = b[0].filter((s) => gana(b, s) || (!!pasan && pasan(s)));
  const x = b[0].filter((s) => !g.includes(s));
  return g.length && x.length ? { g, x } : null;
};
function Resto({ ctx, b, xs, ronda, alto }) {
  const j = ctx.votoDe ? ctx.votoDe(ronda, b) : null;
  return (
    <div className="lk-l x lk-resto" style={alto ? { height: alto } : undefined}>
      <span className="lk-caras">{xs.flatMap((s) => partes(s)).map((m, i) => {
        const f = ctx.fila(m);
        const nom = f ? capital(limpio(f.n)) : capital(sinBanderas(m).txt);
        return <button key={i} type="button" className="lk-rf" onClick={() => ctx.seguir(ctx.idDe(m))} title={'Ver el camino de ' + nom}>
          <Cara liga={ctx.liga} k={f ? f.k : ''} nombre={nom} cls="lk-cara" /></button>;
      })}</span>
      <span className="lk-resto-n">{xs.map((s) => nombreDe(ctx, s)).join(', ')}</span>
      {xs.map((s) => <Votos key={s} j={j} li={b[0].indexOf(s)} b={b} />)}
    </div>
  );
}

// ── un lado de una batalla: una persona o un equipo (las caras juntas, adelante) ──
// 🅰️ en el remake A, con su nota, el voto de cada juez y cómo lo escribió el jurado (sólo la primera vez que aparece)
function Lado({ ctx, b, s, copa, alto, pasa, li, ronda }) {
  const ms = partes(s);
  const eq = ms.length > 1;
  const g = gana(b, s) || pasa;
  const perdio = !!b[1] && !g;
  const sigue = !!ctx.sigo && ms.some((m) => ctx.idDe(m) === ctx.sigo);
  const cls = 'lk-l' + (g ? (copa ? ' copa' : ' g') : (b[1] ? ' x' : '')) + (eq ? ' eq' : '') + (sigue ? ' sigue' : '');
  const j = ronda != null && ctx.votoDe ? ctx.votoDe(ronda, b) : null;
  const w = ronda != null && ctx.escritoDe ? ctx.escritoDe(ronda, b, li) : '';
  return (
    <div className={cls} style={alto ? { height: alto } : undefined}>
      {eq ? <span className="lk-caras">{ms.map((m, i) => { const f = ctx.fila(m); return <Cara key={i} liga={ctx.liga} k={f ? f.k : ''} nombre={f ? f.n : sinBanderas(m).txt} cls="lk-cara" />; })}</span> : null}
      <span className="lk-ns">{ms.map((m, i) => <Persona key={i} ctx={ctx} x={m} conCara={!eq} perdio={perdio} />)}
        {w ? <em className="lk-wn" title="Así lo escribió el jurado">«{limpio(w)}»</em> : null}</span>
      {ctx.caras ? <Nota ctx={ctx} s={s} /> : null}
      <Votos j={j} li={li} b={b} />
      {g && (copa || !ctx.caras) ? <span className="lk-ok" aria-label={copa ? 'Campeón' : 'Pasó'}>{copa ? <Ico n="copa" t={14} /> : '✓'}</span> : null}
    </div>
  );
}

// 🔑 LO QUE LA LLAVE NO DICE CON UN NOMBRE, CON UNA ETIQUETA (`etiquetasNota()` de app.js): revivido, walk-in,
// pokémon, refuerzo, el tercero que dio el podio, cuántos pasan de un grupo y el Clásico. Y el estado: AHORA, SIGUE
function etiquetas(ctx, b, est, copa) {
  const out = [];
  if (est === 'ahora') out.push(['AHORA', 'ahora']);
  else if (est === 'sigue') out.push(['SIGUE', 'sig']);
  else if (est === 'singan') out.push(['SIN GANADOR', 'sg']);
  const s = b[2];
  const t = /pasan (\d+)/.exec(s);
  if (t) out.push([t[1] === '0' ? 'No pasó nadie' : 'Pasan ' + t[1], '']);
  if (/revivid/i.test(s)) out.push(['Revivido', '']);
  if (/walk-?in/i.test(s)) out.push(['Walk-in', '']);
  if (/pok[eé]mon/i.test(s)) out.push(['Pokémon', '']);
  if (/refuerzo/i.test(s)) out.push(['Refuerzo', '']);
  if (/^podio/i.test(s)) out.push(['Por el podio', '']);
  const c = ctx.clasico(b);
  if (c) out.push(['Clásico ' + c[2] + '–' + c[3], 'cl', 'Ya se cruzaron ' + (c[2] + c[3]) + ' veces (' + ctx.liga.aka(c[0]) + ' ' + c[2] + '–' + c[3] + ' ' + ctx.liga.aka(c[1]) + '). El que gana suma +10 %.']);
  if (copa && b[1]) out.push(['Campeón', 'copa']);
  return out;
}

// ── una batalla: sus lados, quién pasó y sus etiquetas ──
// 🎬 EN VIVO, LO QUE SE ACABA DE DECIDIR SE VE PASAR (Dlx, 18/10/2026, a «la carta del que pierde se apaga en vivo y la
// del que pasa salta a la ronda siguiente»: «all of them»). `pos` es el lugar de la batalla (`ronda:batalla`) y `ctx.anim`
// lo que cambió en la última vuelta: la batalla que se decidió (`recien`) y quien acaba de llegar a otra (`llega`)
function Batalla({ ctx, b, est, copa, style, altos, pasan, pos, ronda }) {
  const ls = b[0];
  const cp = ctx.caras ? compacta(b, pasan) : null;
  const et = etiquetas(ctx, b, est, copa);
  const sigue = !!ctx.sigo && ls.some((s) => partes(s).some((m) => ctx.idDe(m) === ctx.sigo));
  const an = ctx.anim && pos != null ? ctx.anim : null;
  const recien = !!an && an.b.has(pos);
  if (enCartas(ctx, ls)) {
    return (
      <div className={'lk-b cartas' + (est ? ' ' + est : '') + (sigue ? ' sigue' : '') + (copa ? ' fin' : '') + (recien ? ' recien' : '')} style={style} title={b[2] || undefined}>
        {et.length ? <div className="lk-et">{et.map((x, i) => <span key={i} className={x[1]} title={x[2]}>{x[0]}</span>)}</div> : null}
        <div className={'lk-vs' + (colsVs(ls.length) === 3 ? ' lk-vs3' : '')}>
          {ls.map((s, i) => <Ficha key={i} ctx={ctx} b={b} s={s} copa={copa} pasa={!!pasan && pasan(s)} llega={!!an && an.s.has(pos + ':' + clave(s))} />)}
          {ls.length === 1 ? <div className="lk-fc vac"><em>{b[1] ? 'pasa directo' : 'por definir'}</em></div> : null}
        </div>
      </div>
    );
  }
  return (
    <div className={'lk-b' + (est ? ' ' + est : '') + (sigue ? ' sigue' : '') + (ls.length ? '' : ' vacio') + (copa ? ' fin' : '') + (recien ? ' recien' : '')}
      style={style} title={b[2] || undefined}>
      {et.length ? <div className="lk-et">{et.map((x, i) => <span key={i} className={x[1]} title={x[2]}>{x[0]}</span>)}</div> : null}
      {cp ? <>{cp.g.map((s, i) => <Lado key={i} ctx={ctx} b={b} s={s} copa={copa} alto={altos ? altos[i] : 0} pasa li={ls.indexOf(s)} ronda={ronda} />)}
        <Resto ctx={ctx} b={b} xs={cp.x} ronda={ronda} alto={altos ? altos[altos.length - 1] : 0} /></>
        : ls.map((s, i) => <Lado key={i} ctx={ctx} b={b} s={s} copa={copa} alto={altos ? altos[i] : 0} pasa={!!pasan && pasan(s)} li={i} ronda={ronda} />)}
      {ls.length === 1 ? <div className="lk-l vac" style={altos ? { height: altos[1] } : undefined}><em>{b[1] ? 'pasa directo' : 'por definir'}</em></div> : null}
      {!ls.length ? <><div className="lk-l vac" style={altos ? { height: altos[0] } : undefined}><em>{ctx.cerrada ? '—' : 'por jugarse'}</em></div>
        <div className="lk-l vac" style={altos ? { height: altos[1] } : undefined}><em /></div></> : null}
    </div>
  );
}

// ── EN EL CELULAR: una ronda por pantalla, deslizando, con las pestañas arriba ──
// 🔴 EL ALTO ES EL DE LA RONDA QUE SE MIRA: con el de la más alta (los Octavos), la Final quedaba con un hueco enorme
// abajo (Dlx no quiere huecos grandes)
function Pista({ ctx, rondas, ter, inicial, vale, copaUlt = true }) {
  const pista = useRef(null);
  const cols = useRef([]);
  const [act, setAct] = useState(inicial);
  const [alto, setAlto] = useState(null);
  const ir = useCallback((i, suave) => {
    const el = pista.current;
    const c = cols.current[i];
    if (el && c) el.scrollTo({ left: c.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0'), behavior: suave ? 'smooth' : 'auto' });
  }, []);
  useLayoutEffect(() => { ir(inicial, false); setAct(inicial); }, [inicial, ir]);
  // la pestaña de la ronda a la vista, a la vista en su fila (la de la Final quedaba cortada a la derecha)
  const tabs = useRef(null);
  useEffect(() => {
    const t = tabs.current;
    const b = t && t.children[act];
    if (b && t.scrollWidth > t.clientWidth) t.scrollTo({ left: Math.max(0, b.offsetLeft - t.offsetLeft - 16), behavior: 'smooth' });
  }, [act]);
  // la ronda que quedó a la vista
  useEffect(() => {
    const el = pista.current;
    if (!el) return undefined;
    let r = 0;
    const f = () => {
      cancelAnimationFrame(r);
      r = requestAnimationFrame(() => {
        const x = el.scrollLeft;
        let mejor = 0;
        let d0 = Infinity;
        cols.current.forEach((c, i) => {
          if (!c) return;
          const d = Math.abs(c.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0') - x);
          if (d < d0) { d0 = d; mejor = i; }
        });
        setAct(mejor);
      });
    };
    el.addEventListener('scroll', f, { passive: true });
    return () => { el.removeEventListener('scroll', f); cancelAnimationFrame(r); };
  }, []);
  // el alto de la ronda a la vista (y si cambia: una llave en vivo que se completa)
  useEffect(() => {
    const c = cols.current[act];
    if (!c) return undefined;
    const medir = () => setAlto(c.offsetHeight);
    medir();
    if (!window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(c);
    return () => ro.disconnect();
  }, [act, rondas]);
  const tiene = (R) => !!ctx.sigo && R.b.some((b) => b[0].some((s) => partes(s).some((m) => ctx.idDe(m) === ctx.sigo)));
  const ult = rondas.length - 1;
  return (
    <>
      <div className="lk-tabs" role="tablist" aria-label="Rondas" ref={tabs}>
        {rondas.map((R, i) => {
          const v = vale[i];
          return (
            <button key={i} type="button" role="tab" aria-selected={i === act} className={(i === act ? 'on' : '') + (tiene(R) || (i === ult && ter && tiene(ter)) ? ' mio' : '')}
              onClick={() => { setAct(i); ir(i, true); }}>
              <b>{R.r}</b>{v ? <small>{v}</small> : null}
            </button>
          );
        })}
      </div>
      <div className={'lk-pista' + (ctx.sigo ? ' siguiendo' : '')} ref={pista} style={alto ? { height: alto } : undefined}>
        {rondas.map((R, i) => (
          <div key={i} className="lk-col" ref={(el) => { cols.current[i] = el; }} role="tabpanel" aria-label={R.r}>
            {R.b.map((b, j) => <Batalla key={j} ctx={ctx} b={b} est={ctx.est(i, j)} copa={copaUlt && i === ult && R.b.length === 1} pasan={ctx.pasan(i)} pos={i + ':' + j} ronda={R.r} />)}
            {i === ult && ter ? (
              <>
                <h4 className="lk-ter">Tercer puesto</h4>
                {ter.b.map((b, j) => <Batalla key={'t' + j} ctx={ctx} b={b} est={!b[1] && b[0].length >= 2 && ctx.cerrada ? 'singan' : ''} ronda={ter.r} />)}
              </>
            ) : null}
          </div>
        ))}
      </div>
      {rondas.length > 1 ? <p className="lk-guia">{act < ult ? 'Desliza para ver ' + rondas[act + 1].r + ' →' : '← Desliza para ver las rondas de antes'}</p> : null}
    </>
  );
}

// ── EN LA COMPU: el cuadro entero, con sus ramas (`cuadro()` de app.js, con las mismas cuentas) ──
// ⚠️ EN ESPEJO SÓLO SI SE PUEDE: la final en el medio y una mitad de cada lado pide una final con dos ramas. Si no,
// de izquierda a derecha. Y lo que no engancha (un walk-in, un revivido) se dibuja igual, en su columna, sin rama.
// `plano`: nunca en espejo; `oro`: el campeón del evento (en la doble, la última ronda de una llave no es la final);
// `copaUlt`: la última ronda lleva la copa
function Arbol({ ctx, rondas: rs, ter, vale, plano = false, oro, copaUlt = true }) {
  const caja = useRef(null);
  const [ancho, setAncho] = useState(1100);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return undefined;
    const medir = () => setAncho(el.clientWidth || 1100);
    medir();
    if (!window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // en espejo la final va en el medio: si no entra, se arranca mirándola (una vez)
  const centrar = useRef(true);
  const enEspejo = useRef(false);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!centrar.current || !el || el.scrollWidth <= el.clientWidth) return;
    centrar.current = false;
    if (enEspejo.current) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  });
  const n = rs.length;
  const G = 34;
  const FILA = 32;
  const LINEA = 24;
  const PAD = 3;
  const SEP = 22;
  const nm = (s) => partes(s).length || 1;
  const altoLado = (s) => Math.max(FILA, 8 + LINEA * nm(s));
  // 🔥 en el remake A, una de 3 a 5 ya decidida: sus filas de quien pasó y un renglón con los demás (`compacta()`)
  const altos = (b, r) => {
    const cp = ctx.caras ? compacta(b, r == null ? null : ctx.pasan(r)) : null;
    if (cp) return cp.g.map(altoLado).concat([RESTO_H]);
    return b[0].length ? b[0].map(altoLado).concat(b[0].length < 2 ? [FILA] : []) : [FILA, FILA];
  };
  // 🃏 un versus: las cartas sueltas, sin caja (Dlx, 18/10/2026: «no necesitamos el cuadro blanco que limita la tarjeta»),
  // del ancho de la columna, y arriba sus etiquetas (PASAN 2, REVIVIDO…) si tiene: van en su renglón y no encima de la carta
  const copaDe = (r) => copaUlt && r === n - 1 && rs[n - 1].b.length === 1;
  const conEt = (b, r, i) => etiquetas(ctx, b, r == null ? '' : ctx.est(r, i), r != null && copaDe(r)).length > 0;
  const altoVs = (b, r, i) => {
    const k = Math.max(2, b[0].length);
    const c = colsVs(k);
    const f = Math.ceil(k / c);
    return f * ((W - VS_GAP * (c - 1)) / c) * CARTA_AR + (f - 1) * VS_GAP + (conEt(b, r, i) ? ET_H : 0);
  };
  const alto = (b, r, i) => (enCartas(ctx, b[0]) ? altoVs(b, r, i) : PAD * 2 + altos(b, r).reduce((a, x) => a + x, 0));
  const hijos = (r, i) => (r ? ((rs[r].b[i] || [])[3] || []).filter((j) => rs[r - 1].b[j]) : []);
  const conPadre = {};
  rs.forEach((R, r) => R.b.forEach((b, i) => hijos(r, i).forEach((j) => { conPadre[(r - 1) + ':' + j] = 1; })));
  const pos = {};
  const colocar = (r, i, cur, lado) => {
    // ⚠️ UNA VEZ: de un grupo donde pasan dos salen dos ramas; la segunda no lo vuelve a dibujar
    if (pos[r + ':' + i]) return null;
    const ys = hijos(r, i).map((j) => colocar(r - 1, j, cur, lado)).filter((v) => v != null);
    let y;
    if (!ys.length) {
      const h = alto(rs[r].b[i], r, i);
      y = cur.y + h / 2;
      cur.y += h + SEP;
    } else y = (Math.min(...ys) + Math.max(...ys)) / 2;
    pos[r + ':' + i] = { r, i, y, lado };
    return y;
  };
  const fin = hijos(n - 1, 0);
  // 🔴 Y SÓLO SI ENTRA: una de octavos en espejo son siete columnas, y a 1.333 px los filtros y la otra punta quedaban
  // cortados a los costados. De izquierda a derecha es más alta pero se ve entera, y bajar es lo natural
  const anchoDe = (cols) => Math.floor((ancho + G) / cols - G);
  const espejo = !plano && n >= 3 && rs[n - 1].b.length === 1 && fin.length === 2 && anchoDe(2 * n - 1) >= 150;
  enEspejo.current = espejo;
  const ncol = espejo ? 2 * n - 1 : n;
  const W = Math.max(156, Math.min(232, anchoDe(ncol)));
  const curI = { y: 0 };
  const curD = { y: 0 };
  if (espejo) {
    colocar(n - 2, fin[0], curI, 'i');
    colocar(n - 2, fin[1], curD, 'd');
  } else rs[n - 1].b.forEach((b, i) => colocar(n - 1, i, curI, 'i'));
  rs.forEach((R, r) => R.b.forEach((b, i) => {
    const k = r + ':' + i;
    if (pos[k] || conPadre[k] || (espejo && r === n - 1)) return;
    const cur = espejo && curD.y < curI.y ? curD : curI;
    colocar(r, i, cur, cur === curD ? 'd' : 'i');
  }));
  const HI = Math.max(0, curI.y - SEP);
  const HD = Math.max(0, curD.y - SEP);
  const H = Math.max(HI, HD);
  Object.values(pos).forEach((p) => { p.y += espejo ? (H - (p.lado === 'd' ? HD : HI)) / 2 : 0; });
  if (espejo) pos[(n - 1) + ':0'] = { r: n - 1, i: 0, lado: 'c', y: (pos[(n - 2) + ':' + fin[0]].y + pos[(n - 2) + ':' + fin[1]].y) / 2 };
  const TOPE = 54;
  const col = (p) => (p.lado === 'd' ? 2 * (n - 1) - p.r : p.r);
  const X = (p) => col(p) * (W + G);
  const campeon = oro !== undefined ? oro : (rs[n - 1].b[0] || [])[1] || '';
  const conSigo = (b) => !!ctx.sigo && b[0].some((s) => partes(s).some((m) => ctx.idDe(m) === ctx.sigo));
  const cajas = [];
  const lineas = [];
  let fondo = TOPE + H;
  Object.keys(pos).forEach((k) => {
    const p = pos[k];
    const b = rs[p.r].b[p.i];
    const copa = copaUlt && p.r === n - 1 && rs[n - 1].b.length === 1;
    const h = alto(b, p.r, p.i);
    cajas.push(<Batalla key={k} ctx={ctx} b={b} est={ctx.est(p.r, p.i)} copa={copa} altos={altos(b, p.r)} pasan={ctx.pasan(p.r)} pos={p.r + ':' + p.i} ronda={rs[p.r].r}
      style={{ position: 'absolute', left: X(p), top: Math.round(TOPE + p.y - h / 2), width: W, height: h }} />);
    hijos(p.r, p.i).forEach((j) => {
      const c = pos[(p.r - 1) + ':' + j];
      if (!c) return;
      const x1 = c.lado === 'd' ? X(c) : X(c) + W;
      const x2 = c.lado === 'd' ? X(p) + W : X(p);
      const y1 = TOPE + c.y;
      const y2 = TOPE + p.y;
      const xm = (x1 + x2) / 2;
      const hijo = rs[c.r].b[c.i];
      const oro = !!campeon && comparten(hijo[1], campeon) && comparten(b[1], campeon);
      const sig = conSigo(hijo) && conSigo(b) && ctx.sigoPasa(hijo);
      lineas.push(<path key={c.r + ':' + c.i + '>' + k} className={(oro ? 'oro' : '') + (sig ? ' sigue' : '')} d={'M' + x1 + ' ' + y1 + 'H' + xm + 'V' + y2 + 'H' + x2} />);
    });
  });
  const pf = pos[(n - 1) + ':0'];
  if (ter && pf) {
    const bt = ter.b[0];
    const ht = alto(bt);
    const yt = TOPE + pf.y + alto(rs[n - 1].b[0], n - 1, 0) / 2 + 64 + ht / 2;
    cajas.push(<span key="tl" className="lk-rl sub" style={{ left: X(pf), width: W, top: Math.round(yt - ht / 2 - 30) }}>Tercer puesto</span>);
    cajas.push(<Batalla key="t" ctx={ctx} b={bt} est={!bt[1] && bt[0].length >= 2 && ctx.cerrada ? 'singan' : ''} altos={altos(bt)} ronda={ter.r}
      style={{ position: 'absolute', left: X(pf), top: Math.round(yt - ht / 2), width: W, height: ht }} />);
    fondo = Math.max(fondo, yt + ht / 2);
  }
  for (let c = 0; c < ncol; c += 1) {
    const r = espejo && c > n - 1 ? 2 * (n - 1) - c : c;
    cajas.push(<span key={'r' + c} className="lk-rl" style={{ left: c * (W + G), width: W }}><b>{rs[r].r}</b>{vale[r] ? <small>{vale[r]}</small> : null}</span>);
  }
  const anchoT = ncol * (W + G) - G;
  const altoT = Math.ceil(fondo + 12);
  return (
    <div className="lk-arbol-caja" ref={caja}>
      <div className={'lk-arbol' + (ctx.sigo ? ' siguiendo' : '')} style={{ width: anchoT, height: altoT }}>
        <svg width={anchoT} height={altoT} aria-hidden="true">{lineas}</svg>
        {cajas}
      </div>
    </div>
  );
}

// 🔑 LA DOBLE ELIMINACIÓN (Dlx, 08/10/2026: «sí, dale»): la llave de ganadores, la de perdedores y la gran final, una
// abajo de la otra, cada una con sus rondas. En la compu cada llave es un cuadro de izquierda a derecha —en espejo no:
// su última ronda no es la final—; en el celular, cada una con sus pestañas. El camino del campeón va en verde en las
// dos. ⚠️ SIN «AHORA»: las dos llaves se juegan intercaladas y la llave no dice en qué orden
function Doble({ ctx, d, compu }) {
  const singan = (rs) => (i, j) => { const b = rs[i] && rs[i].b[j]; return b && ctx.cerrada && !b[1] && b[0].length >= 2 ? 'singan' : ''; };
  const secs = [
    ['g', 'Llave de ganadores', 'Quien pierde acá pasa a la de perdedores', d.G, d.valeG, d.iniG],
    ['p', 'Llave de perdedores', 'Quien pierde acá queda afuera', d.P, d.valeP, d.iniP],
  ].filter((x) => x[3].length);
  return (
    <div className="lk-doble">
      {secs.map(([k, t, sub, rs, vale, ini]) => {
        const c = Object.assign({}, ctx, { est: singan(rs), pasan: () => null, anim: null });
        return (
          <div key={k} className={'lk-db ' + k}>
            <h3 className="lk-h">{t}<small>{sub}</small></h3>
            {compu ? <Arbol ctx={c} rondas={rs} ter={null} vale={vale} plano oro={d.campeon} copaUlt={false} />
              : <Pista ctx={c} rondas={rs} ter={null} inicial={ini} vale={vale} copaUlt={false} />}
          </div>
        );
      })}
      {d.F.length ? (
        <div className="lk-db f">
          <h3 className="lk-h">Gran final<small>{'El mejor de cada llave' + (d.ptsF ? ' · el campeón, ' + d.ptsF + ' pts' : '')}</small></h3>
          <div className="lk-gf">
            {d.F.map((b, j) => <Batalla key={j} ctx={ctx} b={b} est={ctx.cerrada && !b[1] && b[0].length >= 2 ? 'singan' : ''} copa={j === d.F.length - 1} />)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// 🔑 UN EVENTO DE VIDAS NO ES UNA LLAVE (Dlx, 28/09/2026: «formato tipo 5 vidas, como la Red Bull 5 Vidas»): cada
// batalla le saca una vida al que pierde y el que gana se queda. Arriba las vidas de cada uno; abajo, las batallas en
// el orden en que se pelearon. ⚠️ EL LUGAR LO DA EL MOTOR (`L.tabla`); en vivo, los que siguen en pie primero
function vidasDe(L) {
  const rs = ((L && L.rondas) || []).filter((R) => (R.b || []).length);
  const m = rs.length === 1 && /^(\d+)\s*vidas?$/i.exec(String(rs[0].r || '').trim());
  return m ? +m[1] : 0;
}
function Vidas({ ctx, L, N }) {
  const bs = ((L.rondas || []).find((R) => (R.b || []).length).b || []).map(normB);
  const perd = {};
  const cae = {};
  const sale = [];
  const perdedor = (b) => {
    if (!b[1] || b[0].length !== 2) return null;
    const p = b[0].filter((s) => !gana(b, s));
    return p.length === 1 ? p[0] : null;
  };
  bs.forEach((b, i) => {
    b[0].forEach((s) => { if (!(s in perd)) perd[s] = 0; });
    const p = perdedor(b);
    if (p == null) { sale.push(null); return; }
    perd[p] += 1;
    if (perd[p] === N) cae[p] = i + 1;
    sale.push([p, perd[p]]);
  });
  const gente = Object.keys(perd);
  const lugar = {};
  (L.tabla || []).forEach((r, i) => gente.forEach((s) => { if (!(s in lugar) && comparten(r[0], s)) lugar[s] = i; }));
  const ordenVivo = (s) => (cae[s] ? 1000 - cae[s] : perd[s]);
  gente.sort((a, b) => ((L.tabla || []).length ? (a in lugar ? lugar[a] : 99) - (b in lugar ? lugar[b] : 99) : ordenVivo(a) - ordenVivo(b)));
  return (
    <div className={'lk-vd' + (ctx.sigo ? ' siguiendo' : '')}>
      <ol className="lk-vd-t">
        {/* 🔴 «lk-vd-pie» y no «pie» (18/11/2026): las clases son globales en el shadow root y `.pie` es el pie del sitio
            (estilo.css): la fila de quien sigue en pie salía con margen, raya arriba y otro relleno. Ningún CSS la usa */}
        {gente.map((s, i) => (
          <li key={s} className={(cae[s] ? '' : 'lk-vd-pie') + (partes(s).some((m) => ctx.idDe(m) === ctx.sigo) ? ' sigue' : '')}>
            <b className="lk-vd-l">{i + 1}.º</b>
            <span className="lk-vd-n"><Persona ctx={ctx} x={s} /></span>
            <span className="lk-vd-cs" aria-label={(N - perd[s]) + ' de ' + N + ' vidas'}>
              {Array.from({ length: N }, (_, k) => <i key={k} className={k < N - perd[s] ? '' : 'x'}>{k < N - perd[s] ? '♥' : '♡'}</i>)}
            </span>
            <small>{cae[s] ? 'cayó en la batalla ' + cae[s] : 'en pie'}</small>
          </li>
        ))}
      </ol>
      <h3 className="lk-h">Batalla por batalla<small>{bs.length} batallas</small></h3>
      <div className="lk-vd-bs">
        {bs.map((b, i) => {
          const x = sale[i];
          const ult = x && x[1] === N;
          const sigue = !!ctx.sigo && b[0].some((s) => partes(s).some((m) => ctx.idDe(m) === ctx.sigo));
          return (
            <div key={i} className={'lk-b' + (sigue ? ' sigue' : '')} title={b[2] || undefined}>
              <div className="lk-et"><span className="num">Batalla {i + 1}</span>{L.veredictos && b[2] ? <span>{b[2]}</span> : null}</div>
              {b[0].map((s, j) => (
                <div key={j} className={'lk-l' + (gana(b, s) ? ' g' : (b[1] ? ' x' : ''))}>
                  <span className="lk-ns"><Persona ctx={ctx} x={s} perdio={!!b[1] && !gana(b, s)} /></span>
                  {gana(b, s) ? <span className="lk-ok" aria-label="Ganó y se queda">✓</span>
                    // 🔴 «lk-vd-ult» y no «ult» (18/11/2026): `.ult` es el bloque del Inicio (estilo.css:455), global en el
                    // shadow root, y a «sin vidas» le sumaba margin-top 22px, borde arriba, padding y display:grid. El gris va en llave.css
                    : x && x[0] === s ? <span className={'lk-vd-m' + (ult ? ' lk-vd-ult' : '')}>{ult ? 'sin vidas' : '−1 ♥ · le quedan ' + (N - x[1])}</span> : null}
                </div>
              ))}
              {x ? null : <p className="lk-vd-sin">{/réplica/.test(b[2] || '') ? 'Réplica: se vuelve a pelear.' : L.vivo && i === bs.length - 1 ? 'Se está votando.' : 'Sin ganador: no le sacó vida a nadie.'}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 🔑 LA FASE DE UNA NAVE DE FUNA (cypher; Dlx, 29/09/2026): una lista con ❌ en los que cayeron, sin orden
function Funa({ ctx, L }) {
  const fs = (L && L.funa) || [];
  if (!fs.length) return null;
  const quedan = fs.filter((x) => !x[1]).length;
  // 🔑 RONDA POR RONDA, SI LA LLAVE LO DICE (Dlx, 03/10/2026, con la NAVE DE EXTERMINACIÓN: «¿podrías dar más detalles?
  // no siempre va a haber muchos detalles, pero en este caso sí»). «ELIMINADO #3» es en qué ronda cayó: cada ronda con
  // los suyos, y al final los que siguen. Sin números, la lista de siempre
  const rs = [...new Set(fs.filter((x) => x[1] && x[2]).map((x) => x[2]))].sort((a, b) => a - b);
  if (rs.length) {
    const sinNum = fs.filter((x) => x[1] && !x[2]);
    const siguen = fs.filter((x) => !x[1]);
    const fila = (et, xs, cls) => (
      <li key={et} className={'lk-fr ' + (cls || '')}>
        <b className="lk-fr-n">{et}<small>{cls === 'siguen' ? xs.length + (xs.length === 1 ? ' sigue' : ' siguen') : xs.length + (xs.length === 1 ? ' cayó' : ' cayeron')}</small></b>
        <ul>{xs.map((x, i) => <li key={i} className={x[1] ? 'cae' : ''}><Persona ctx={ctx} x={x[0]} perdio={!!x[1]} /></li>)}</ul>
      </li>
    );
    return (
      <div className="lk-funa con-rondas">
        <h3 className="lk-h">Fase de eliminación<small>{fs.length} raperos · {rs.length} rondas · {quedan === 1 ? 'queda 1' : 'quedan ' + quedan}</small></h3>
        <ol>
          {rs.map((r) => fila('Ronda ' + r, fs.filter((x) => x[1] && x[2] === r)))}
          {sinNum.length ? fila('Sin ronda', sinNum) : null}
          {siguen.length ? fila('A la llave', siguen, 'siguen') : null}
        </ol>
      </div>
    );
  }
  return (
    <div className="lk-funa">
      <h3 className="lk-h">Fase de eliminación<small>{fs.length} raperos · {quedan === fs.length ? 'se juega' : 'quedan ' + quedan}</small></h3>
      <ul>
        {fs.map((x, i) => (
          <li key={i} className={x[1] ? 'cae' : ''}><Persona ctx={ctx} x={x[0]} perdio={!!x[1]} />{x[1] ? <i className="lk-cae" title="Cayó en la fase"><Ico n="falta" t={14} /></i> : null}</li>
        ))}
      </ul>
    </div>
  );
}

// ── quien se sigue: abajo, fija, con cómo le fue y su perfil ──
function Barra({ ctx, tb }) {
  if (!ctx.sigo) return null;
  const k = ctx.sigo.indexOf('k:') === 0 ? ctx.sigo.slice(2) : '';
  const f = k ? ctx.liga.T[k] : null;
  const nombre = f ? limpio(f.n) : ctx.nombres[ctx.sigo] || '';
  const p = ctx.pts[ctx.sigo];
  // 🏁 una en vivo con la final decidida no «se juega ahora» (18/11/2026): la cabecera ya decía «TERMINÓ» y la barra no
  const res = p ? <><Medalla p={MEDALLA[p[0]]} />{(MEDALLA[p[0]] ? p[0] : 'Quedó en ' + p[0]) + ' · ' + num(p[1]) + ' pts'}</>
    : ctx.L.vivo ? (ctx.L.terminada ? 'Terminó: los puntos llegan cuando se procese' : 'Se juega ahora') : 'Sin puntos en esta llave';
  return (
    <aside className="lk-barra" style={{ '--lk-tb': tb + 'px' }} aria-live="polite">
      <Cara liga={ctx.liga} k={k} nombre={nombre} cls="lk-bcara" />
      <span className="lk-bt"><b>{nombre}</b><small>{res}</small></span>
      {k ? <a className="btn verde chico" href={'#/r/' + encodeURIComponent(k)}>Perfil</a> : null}
      <button type="button" className="lk-bx" onClick={() => ctx.seguir('')} aria-label="Dejar de seguir">×</button>
    </aside>
  );
}

// ── ¿algo está mal en esta llave? Lo revisa la Liga, nunca por DM (Dlx, 28/09/2026: «ok») ──
const REP_QUE = [['ganador', 'El ganador está mal'], ['gente', 'Falta o sobra alguien'], ['nombre', 'Un nombre está mal'], ['otro', 'Otra cosa']];
// 🏷️ «UN NOMBRE ESTÁ MAL» PIDE CUÁL Y QUIÉN ES (Dlx, 12/11/2026, al reporte de Forza «no esta en la liga xd»: *«he
// didn't specify who is not but who really is then»*). Llegaba sin decir qué nombre ni de quién era, y no había nada
// que corregir. Ahora se elige el nombre de la llave (va en `batalla`, como el de las ligas) y se escribe quién es
function Reporte({ n, nombres }) {
  const [abierto, setAbierto] = useState(false);
  const [que, setQue] = useState('');
  const [nombre, setNombre] = useState('');
  const [txt, setTxt] = useState('');
  const [est, setEst] = useState('');
  const [va, setVa] = useState(false);
  const [ok, setOk] = useState(false);
  if (ok) return <p className="lk-rep-ok">✓ ¡Gracias! Lo revisa la Liga.</p>;
  if (!abierto) return <button type="button" className="btn borde2 chico" onClick={() => setAbierto(true)}>¿Algo está mal en esta llave?</button>;
  const enviar = () => {
    const t = txt.replace(/\s+/g, ' ').trim();
    if (!que || va) return;
    if (que === 'otro' && t.length < 3) { setEst('Cuenta qué pasó.'); return; }
    if (que === 'nombre' && nombres.length && !nombre) { setEst('Elige el nombre que está mal.'); return; }
    if (que === 'nombre' && t.length < 2) { setEst('Escribe quién es en realidad.'); return; }
    if (!window.conCuenta) { setEst('No pude mandarlo. Prueba de nuevo en un rato.'); return; }
    setVa(true);
    setEst('');
    window.conCuenta('/api/avisos/reportar', Object.assign({ llave: String(n), que, texto: t }, que === 'nombre' && nombre ? { batalla: nombre } : {})).then((j) => {
      setVa(false);
      if (j && j.ok) { setOk(true); return; }
      const e = (j && j.error) || '';
      setEst((window.errorCuenta && window.errorCuenta(e)) || (j && j.status === 401 ? 'Para reportar, entra con Discord desde Mi cuenta.'
        : e === 'nueva' ? 'Tu cuenta de Discord es muy nueva para reportar.'
          : e === 'tope' ? 'Ya mandaste varios hoy: prueba mañana.' : 'No pude mandarlo. Prueba de nuevo en un rato.'));
    }).catch(() => { setVa(false); setEst('No pude mandarlo. Prueba de nuevo en un rato.'); });
  };
  return (
    <div className="lk-rep">
      <p className="lk-rep-t">Cuéntanos qué está mal y lo revisa la Liga.</p>
      <div className="lk-rep-q" role="group" aria-label="Qué está mal">
        {REP_QUE.map(([id, et]) => <button key={id} type="button" aria-pressed={que === id} className={que === id ? 'on' : ''} onClick={() => setQue(id)}>{et}</button>)}
      </div>
      {que === 'nombre' && nombres.length ? <>
        <p className="lk-rep-t">¿Qué nombre está mal?</p>
        <div className="lk-rep-q" role="group" aria-label="El nombre que está mal">
          {nombres.map((x) => <button key={x} type="button" aria-pressed={nombre === x} className={nombre === x ? 'on' : ''} onClick={() => setNombre(x)}>{limpio(x)}</button>)}
        </div>
      </> : null}
      {que === 'nombre'
        ? <textarea aria-label="Quién es en realidad" maxLength={300} rows={2} value={txt} onChange={(e) => setTxt(e.target.value)}
          placeholder={nombre ? '¿Quién es en realidad «' + limpio(nombre) + '»? Su nombre en la Liga o su Discord (o «soy yo»)' : '¿Qué nombre está mal y quién es en realidad?'} />
        : <textarea aria-label="Qué está mal en la llave" maxLength={300} rows={3} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={'Qué batalla y qué pasó' + (que === 'otro' ? '' : ' (si quieres)')} />}
      <div className="lk-rep-pie">
        <button type="button" className="btn verde chico" disabled={!que || va || (que === 'nombre' && ((nombres.length && !nombre) || txt.trim().length < 2))} onClick={enviar}>{va ? 'Enviando…' : 'Enviar'}</button>
        <span aria-live="polite">{est}</span>
      </div>
      {/* 14 y no 30 (18/11/2026): `REPORTE_VIDA_DIAS` de avisos.js bajó a 14 el 13/10, como dicen privacidad y las ligas */}
      <p className="lk-rep-nota">Se guarda con tu cuenta de Discord 14 días, para revisarlo.</p>
    </div>
  );
}

// 🛡️ EL STAFF DEL SERVIDOR DE ESTA LLAVE (Dlx, 16/11/2026: «todo»; Trelok: «que podamos tocar las llaves directamente, o
// sugerir»). Sólo lo ve quien es del staff de ESE servidor (`pedirRoles()`): el moderador, el admin y el dueño corrigen
// directo —lo mismo que el Dashboard: el ganador de una batalla, un nombre, «no cuenta»—, y el asistente lo sugiere. Lo
// valida el Worker (`socioLlave()`) y lo aplica el ciclo en la próxima media hora; la Liga se entera y lo puede rehacer
function StaffLlave({ n, L }) {
  const [rol, setRol] = useState('');
  const [perm, setPerm] = useState({});
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState('ganador');
  const [bi, setBi] = useState(-1);
  const [gana, setGana] = useState('');
  const [nom, setNom] = useState('');
  const [es, setEs] = useState('');
  const [va, setVa] = useState(false);
  const [est, setEst] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => {
    let vivo = true;
    if (!L || !L.sv || !/^\d+$/.test(String(n))) return undefined;
    pedirRoles().then((r) => { if (vivo) { setRol(((r && r.roles) || {})[L.sv] || ''); setPerm((r && r.permisos) || {}); } });
    return () => { vivo = false; };
  }, [n, L && L.sv]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rol || !puede(rol, 'sugerir', perm)) return null;
  const directo = puede(rol, 'llaves', perm);
  if (ok) return <p className="lk-rep-ok">✓ {ok}</p>;
  if (!abierto) return <button type="button" className="btn verde chico" onClick={() => setAbierto(true)}>{directo ? 'Corregir' : 'Sugerir'} (staff de {L.sv})</button>;
  const bats = [];
  (L.rondas || []).forEach((R) => (R.b || []).forEach((b) => { if ((b[0] || []).length >= 2) bats.push({ ronda: R.r, lados: b[0], ganador: b[1] }); }));
  const b = bats[bi];
  const nombres = nombresDe(L);
  const listo = modo === 'ganador' ? !!b && !!gana && gana !== b.ganador : modo === 'nombre' ? !!nom && es.trim().length >= 2 : true;
  const mandar = () => {
    if (!listo || va) return;
    const fix = modo === 'ganador' ? { accion: 'ganador', n: String(n), ronda: b.ronda, lados: b.lados, ganador: gana }
      : modo === 'nombre' ? { accion: 'nombre', n: String(n), nombre: nom, es: es.trim() } : { accion: 'no_cuenta', n: String(n) };
    setVa(true); setEst('');
    pedirLlave(L.sv, directo ? 'corregir' : 'sugerir', { fix }).then((j) => {
      setVa(false);
      if (j && j.ok) { setOk(directo ? 'Corregido: entra al ranking en la próxima media hora.' : 'Sugerido: lo aprueba un moderador, un admin o el dueño de tu servidor.'); return; }
      const e = (j && j.error) || '';
      setEst(e === 'no_es_tuya' ? 'Esta llave no es de tu servidor.' : e === 'no_rol' ? 'Tu rol no puede hacer eso.' : e === 'tope' ? 'Llegaste al tope de hoy.'
        : e === 'falta la batalla' ? 'Elige la batalla y quién ganó.' : 'No se pudo: prueba de nuevo en un rato.');
    }).catch(() => { setVa(false); setEst('No se pudo: prueba de nuevo en un rato.'); });
  };
  return (
    <div className="lk-rep">
      <p className="lk-rep-t">{directo ? 'Eres del staff de ' + L.sv + ': lo que corrijas acá entra al ranking en la próxima media hora, y la Liga se entera.'
        : 'Eres asistente de ' + L.sv + ': lo que sugieras lo aprueba un moderador, un admin o el dueño.'}</p>
      <div className="lk-rep-q" role="group" aria-label="Qué corregir">
        {[['ganador', 'El ganador'], ['nombre', 'Un nombre'], ['no_cuenta', 'La llave no cuenta']].map(([k, t]) => (
          <button key={k} type="button" aria-pressed={modo === k} className={modo === k ? 'on' : ''} onClick={() => { setModo(k); setEst(''); }}>{t}</button>))}
      </div>
      {modo === 'ganador' ? <>
        <p className="lk-rep-t">¿Qué batalla?</p>
        <div className="lk-rep-q" role="group" aria-label="La batalla">
          {bats.map((x, i) => <button key={i} type="button" aria-pressed={bi === i} className={bi === i ? 'on' : ''}
            onClick={() => { setBi(i); setGana(''); }}>{capital(String(x.ronda || '').toLowerCase())}: {x.lados.map(limpio).join(' vs ')}</button>)}
        </div>
        {b ? <>
          <p className="lk-rep-t">¿Quién ganó?</p>
          <div className="lk-rep-q" role="group" aria-label="Quién ganó">
            {b.lados.map((x) => <button key={x} type="button" aria-pressed={gana === x} className={gana === x ? 'on' : ''} onClick={() => setGana(x)}>{limpio(x)}{x === b.ganador ? ' (lo que dice ahora)' : ''}</button>)}
          </div>
        </> : null}
      </> : modo === 'nombre' ? <>
        <p className="lk-rep-t">¿Qué nombre está mal?</p>
        <div className="lk-rep-q" role="group" aria-label="El nombre">
          {nombres.map((x) => <button key={x} type="button" aria-pressed={nom === x} className={nom === x ? 'on' : ''} onClick={() => setNom(x)}>{limpio(x)}</button>)}
        </div>
        <textarea aria-label="Quién es" maxLength={60} rows={1} value={es} onChange={(e) => setEs(e.target.value)}
          placeholder={nom ? '¿Quién es «' + limpio(nom) + '»? Su nombre en la Liga' : 'Elige el nombre de arriba'} />
      </> : <p className="lk-rep-t">La llave entera deja de sumar para el ranking: para una llave de prueba, repetida o que no se jugó.</p>}
      <div className="lk-rep-pie">
        <button type="button" className="btn verde chico" disabled={!listo || va} onClick={mandar}>{va ? 'Guardando…' : directo ? 'Corregir' : 'Sugerir'}</button>
        <span aria-live="polite">{est}</span>
      </div>
    </div>
  );
}

// ── la página ──
// ── 🅰️ EL REMAKE A DE LA PÁGINA DE UNA LLAVE (Dlx, 18/11/2026: «Pestañas», de la maqueta privada «La llave, remake»).
//    Arriba, en el escenario: el evento, sus números, la final con las cazas y, al costado, el podio y el camino. Abajo,
//    sobre la piel (Dlx, 03/10/2026: ni toda blanca ni toda negra): cuatro pestañas, la llave abierta, el jurado, los
//    inscritos y los puntos. En el celular, el podio, el camino y las cazas van después de las pestañas ──
const juecesDe = (G) => [...new Set(((G && G.jur) || []).flatMap((x) => x.v.map((v) => v[0])))];
const insDe = (G) => ((G && G.ins) || []).filter(([t, es]) => es || sinMenciones(t));
// la batalla de la llave de un voto del jurado: la misma ronda y los mismos lados (como `votoDe`)
const batallaDe = (ctx, x) => {
  for (const R of ctx.prin.concat(ctx.ter ? [ctx.ter] : [])) {
    if (R.r !== x.r) continue;
    const b = R.b.find((y) => y[0].join('|') === (x.l || []).join('|'));
    if (b) return b;
  }
  return null;
};
function CaraCtx({ ctx, m }) {
  const f = ctx.fila(m);
  return <Cara liga={ctx.liga} k={f ? f.k : ''} nombre={f ? f.n : sinBanderas(m).txt} cls="lk-cara" />;
}

// 🔢 LA LLAVE EN NÚMEROS: la figura, los raperos, las batallas y el jurado. Sin dato no hay pieza, y con menos de dos no
// hay tira
function Numeros({ ctx, L, G }) {
  const N = L.notas || {};
  const bats = ctx.prin.reduce((a, R) => a + R.b.filter((b) => b[0].length >= 2).length, 0) + (ctx.ter ? ctx.ter.b.length : 0);
  const multi = ctx.prin.reduce((a, R) => a + R.b.filter((b) => b[0].length > 2).length, 0);
  const js = juecesDe(G);
  const nIns = insDe(G).length;
  const nVot = ((G && G.jur) || []).length;
  const t = [];
  if (N.mvp && N.v && N.v[N.mvp] != null) {
    t.push(['La figura', <><i className="lk-nu-star" aria-hidden="true">★</i>{N.v[N.mvp].toFixed(1)}</>, <>{nombreDe(ctx, N.mvp)}{', la nota más alta'}</>]);
  }
  if (N.bat) t.push(['El batacazo', <><i aria-hidden="true">🔥</i>{nombreDe(ctx, N.bat)}</>, 'ganó con 35 % de chance o menos']);
  if (L.participantes) t.push(['Raperos', L.participantes, nIns ? nIns + ' se anotaron en el canal' : '']);
  if (bats) t.push(['Batallas', bats, multi && bats > multi ? multi + ' de 3 a 5 MCs, ' + (bats - multi) + ' mano a mano' : multi ? 'todas de 3 a 5 MCs' : '']);
  if (js.length) {
    t.push(['El jurado', <>{js.length === 1 ? <CaraCtx ctx={ctx} m={js[0]} /> : null}{js.length === 1 ? nombreDe(ctx, js[0]) : js.length + ' jueces'}</>,
      nVot + ' de ' + bats + ' batallas votadas']);
  }
  if (t.length < 2) return null;
  return (
    <ul className={'lk-nu n' + t.length} aria-label="La llave en números">
      {t.map(([k, v, c]) => <li key={k}><small>{k}</small><b>{v}</b>{c ? <span>{c}</span> : null}</li>)}
    </ul>
  );
}

// 🥊 LA FINAL: el campeón y el subcampeón con su carta, sus puntos y su nota, y abajo cómo votó el jurado
function FinalA({ ctx, L }) {
  const fin = ctx.final;
  const c0 = (L.tabla || []).find((r) => r[1] === 'Campeón');
  if (!c0) return null;
  const sub0 = (L.tabla || []).find((r) => r[1] === 'Subcampeón');
  const deFinal = (s, r) => (s ? [texto(s), r ? r[1] : '', r ? r[2] : 0, partes(texto(s)).length > 1] : null);
  const ganador = fin && fin[1] ? fin[0].find((x) => gana(fin, x)) : null;
  const c = (ganador && deFinal(ganador, c0)) || ladosDe(ctx, L, /^Campeón$/, 1)[0];
  const s = (ganador && sub0 && deFinal(fin[0].find((x) => x !== ganador), sub0)) || ladosDe(ctx, L, /^Subcampeón$/, 1)[0] || null;
  const fr = ctx.prin.length ? ctx.prin[ctx.prin.length - 1].r : '';
  const j = fin && ctx.votoDe ? ctx.votoDe(fr, fin) : null;
  const nj = j ? new Set(j.v.map((v) => v[0])).size : 0;
  const lado = (r, w) => {
    const id = ctx.idDe(partes(r[0])[0]);
    const pl = ptsLado(ctx, L, r, ' cada uno');
    return (
      <button type="button" className={'lk-fa-l' + (w ? ' w' : '') + (ctx.sigo === id ? ' on' : '')} onClick={() => ctx.seguir(id)}
        aria-label={nombreDe(ctx, r[0]) + ', ' + (w ? 'campeón' : r[1].toLowerCase())}>
        <span className="lk-fa-et">{w ? 'Campeón' : r[1]}</span>
        <MiniP ctx={ctx} s={r[0]} ancho={ctx.compu ? 228 : 132} apagado={!w} sinNota />
        <b className="lk-fa-n">{nombreDe(ctx, r[0])}</b>
        <span className="lk-fa-p">{pl ? '+' + pl : null}<Nota ctx={ctx} s={r[0]} /></span>
      </button>
    );
  };
  return (
    // 🫀 en las vidas no hay final (`ctx.final` es null): el primero y el segundo, sin «VS» entre los dos
    <section className="lk-box lk-fa" aria-label={fin ? 'La final' : 'Campeón y subcampeón'}>
      <div className="lk-bh"><h3>{fin ? 'La final' : 'Campeón y subcampeón'}</h3>{nj ? <small>{nj === 1 ? 'un juez' : nj + ' jueces'}</small> : null}</div>
      <div className={'lk-fa-in' + (s ? '' : ' solo')}>
        {lado(c, true)}
        {s ? <span className="lk-fa-x" aria-hidden="true">{fin ? 'VS' : ''}</span> : null}
        {s ? lado(s, false) : null}
      </div>
      {j ? (
        <p className="lk-fa-pie">{j.v.map(([q, li], i) => (
          <span key={i}>{limpio(q)} votó a <b>{nombreDe(ctx, fin[0][li] || '')}</b>{(j.e || [])[li] ? ' («' + limpio(j.e[li]) + '»)' : ''}</span>
        ))}</p>
      ) : null}
    </section>
  );
}

// 🏅 EL PODIO, AL COSTADO: campeón, subcampeón y los que llegaron a semis, con sus puntos
function PodioA({ ctx, L }) {
  const filas = [...ladosDe(ctx, L, /^Campeón$/, 1), ...ladosDe(ctx, L, /^Subcampeón$/, 1), ...ladosDe(ctx, L, /^(Tercero|Cuarto|Semifinal)$/, 4)];
  if (filas.length < 2) return null;
  const pos = (p) => (p === 'Campeón' ? 1 : p === 'Subcampeón' ? 2 : p === 'Cuarto' ? 4 : 3);
  return (
    <section className="lk-box lk-po" aria-label="El podio">
      <div className="lk-bh"><h3>El podio</h3><small>{(L.tabla || []).length} con puntos</small></div>
      <ol>
        {filas.map((r, i) => {
          const id = ctx.idDe(partes(r[0])[0]);
          const pl = ptsLado(ctx, L, r, ' c/u');
          return (
            <li key={i}><button type="button" className={ctx.sigo === id ? 'on' : ''} onClick={() => ctx.seguir(id)}>
              <span className="lk-po-p">{pos(r[1])}</span>
              <span className="lk-caras">{partes(r[0]).map((m, k) => <CaraCtx key={k} ctx={ctx} m={m} />)}</span>
              <span className="lk-po-n"><b>{nombreDe(ctx, r[0])}</b><small>{r[1]}</small></span>
              {pl ? <span className="lk-po-pts">+{pl}</span> : null}
            </button></li>
          );
        })}
      </ol>
    </section>
  );
}

// 🧭 EL CAMINO, AL COSTADO: ronda por ronda, a quién le ganó y con quién cayó. Arranca con el campeón —o con quien tocaste,
// o contigo si jugaste—, y el selector lleva al de cualquiera de la llave
function CaminoA({ ctx, L }) {
  const camp = (L.tabla || []).find((r) => r[1] === 'Campeón');
  const idCamp = camp ? ctx.idDe(partes(camp[0])[0]) : '';
  const rondas = ctx.prin.concat(ctx.ter ? [ctx.ter] : []);
  const pasosDe = (id) => {
    const xs = [];
    rondas.forEach((R) => R.b.forEach((b) => {
      const mio = b[0].find((s) => partes(s).some((m) => ctx.idDe(m) === id));
      if (!mio) return;
      xs.push({ r: R.r, rivales: b[0].filter((s) => s !== mio), gano: gana(b, mio), cayo: !!b[1] && !gana(b, mio) });
    }));
    return xs;
  };
  let id = ctx.sigo || idCamp;
  let pasos = id ? pasosDe(id) : [];
  if (!pasos.length && id !== idCamp && idCamp) { id = idCamp; pasos = pasosDe(id); }
  if (!pasos.length) return null;
  const ids = [];
  (L.tabla || []).forEach((r) => partes(r[0]).forEach((m) => { const x = ctx.idDe(m); if (!ids.includes(x)) ids.push(x); }));
  Object.keys(ctx.nombres).forEach((x) => { if (!ids.includes(x)) ids.push(x); });
  const esCamp = id === idCamp && pasos.length && pasos[pasos.length - 1].gano;
  return (
    <section className="lk-box lk-ca" aria-label={'El camino de ' + (ctx.nombres[id] || '')}>
      <div className="lk-bh"><h3>El camino</h3>
        <select className="lk-ca-sel" aria-label="Ver el camino de" value={id} onChange={(e) => ctx.elegir(e.target.value)}>
          {ids.map((x) => <option key={x} value={x}>{capital(limpio(ctx.nombres[x] || ''))}</option>)}
        </select>
      </div>
      <ol className="lk-ca-ps">
        {pasos.map((p, i) => (
          <li key={i} className={p.gano ? 'g' : p.cayo ? 'x' : ''}>
            <span className="lk-ca-r">{p.r} · {p.gano ? (p.rivales.length ? 'le ganó' : 'pasó') : p.cayo ? 'cayó' : (ctx.cerrada ? 'sin ganador' : 'por jugarse')}</span>
            <span className="lk-ca-x">
              {p.rivales.length > 2 ? (
                <><span className="lk-caras">{p.rivales.slice(0, 5).map((s, j) => <CaraCtx key={j} ctx={ctx} m={partes(s)[0]} />)}</span><span>{'a ' + p.rivales.length}</span></>
              ) : p.rivales.length ? p.rivales.map((s, j) => (
                <button key={j} type="button" onClick={() => ctx.elegir(ctx.idDe(partes(s)[0]))} title={'Ver el camino de ' + nombreDe(ctx, s)}>
                  <CaraCtx ctx={ctx} m={partes(s)[0]} /><b>{nombreDe(ctx, s)}</b></button>
              )) : <em>pasó directo</em>}
            </span>
          </li>
        ))}
        {esCamp ? <li className="fin"><span className="lk-ca-r">Campeón</span></li> : null}
      </ol>
    </section>
  );
}

// 🎯 LAS CAZAS DEL MOST WANTED, EN SU CAJA
function CazasA({ ctx }) {
  const liga = ctx.liga;
  if (!ctx.cazas.length && !ctx.aca.length) return null;
  return (
    <section className="lk-box lk-cz" aria-label="Cazas">
      <div className="lk-bh"><h3>Cazas</h3><small>Most Wanted</small></div>
      {ctx.cazas.map((c, i) => (
        <p key={i}><CaraCtx ctx={ctx} m={c[0]} /><span>Acá cazaron a <b><Alguien liga={liga} nombre={c[0]} /></b> ({c[1]}): {c[2].length ? <>cobró <b><Algunos liga={liga} nombres={c[2]} /></b></> : 'no cobró nadie'}.</span></p>
      ))}
      {ctx.aca.length ? <p><Ico n="mira" t={15} /><span>{ctx.aca.length === 1 ? 'Juega un buscado' : 'Juegan ' + ctx.aca.length + ' buscados'}: {ctx.aca.map((y, i) => <span key={i}>{i ? ', ' : ''}<b><Alguien liga={liga} nombre={y.n} k={y.k} /></b> ({y.cn}, {num(y.v)} pts)</span>)}. Quien le gane, cobra.</span></p> : null}
    </section>
  );
}

// 🗂️ LAS PESTAÑAS: subrayadas, con cuántos tiene cada una
function Pestanas({ tabs, tab, setTab }) {
  return (
    <div className="lk-pes" role="tablist" aria-label="La llave">
      {tabs.map(([k, t, n]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
          {t}{n ? <small>{n}</small> : null}</button>
      ))}
    </div>
  );
}

// 🔑 QUÉ ES CADA COSA DE LA LLAVE, ANTES DE LA LLAVE: la marca del juez, la nota, la figura y cómo se escribió
function Ley({ ctx, L, G }) {
  const jur = (G && G.jur) || [];
  const js = juecesDe(G);
  const N = L.notas || {};
  const todos = js.length === 1 && jur.length > 0 && jur.every((x) => { const b = batallaDe(ctx, x); return b && b[1] && x.v.every(([, li]) => gana(b, x.l[li])); });
  const hayE = jur.some((x) => (x.e || []).some(Boolean));
  const xs = [];
  if (js.length === 1) {
    xs.push(<span key="v"><i className="lk-vt">{inicial(js[0])}</i>{'el voto de '}{nombreDe(ctx, js[0])}{todos ? ': en las ' + jur.length + ' votó al que pasó' : null}</span>);
  } else if (js.length) xs.push(<span key="v"><i className="lk-vt">{inicial(js[0])}</i>la inicial de cada juez, al lado de a quién votó</span>);
  if (N.v) xs.push(<span key="n"><span className="lk-nota">6.0</span>la nota de cada uno en esta llave</span>);
  if (N.mvp && N.v && N.v[N.mvp] != null) xs.push(<span key="m"><span className="lk-nota mvp"><i>★</i>{N.v[N.mvp].toFixed(1)}</span>la figura</span>);
  if (hayE) xs.push(<span key="e">«…» como lo escribió el jurado</span>);
  xs.push(<span key="t">Toca un nombre y se marca su camino.</span>);
  return <p className="lk-ley">{xs}</p>;
}

// ⚖️ EL JURADO: cada juez con cuántas votó y en cuántas votó al que pasó; cómo se escribió cada nombre en los veredictos;
// y ronda por ronda, cada batalla con la marca de cada juez al lado de a quién votó (y si el jurado cambió de una ronda a
// otra, como pidió Dlx el 17/11: «quiénes votaban y si cambiaron en qué ronda»)
function JuradoA({ ctx, G }) {
  const jur = (G && G.jur) || [];
  if (!jur.length) return null;
  const porJ = {};
  jur.forEach((x) => {
    const b = batallaDe(ctx, x);
    x.v.forEach(([q, li]) => {
      const p = porJ[q] || (porJ[q] = { n: 0, bien: 0, cuenta: 0 });
      p.n += 1;
      if (b && b[1]) { p.cuenta += 1; if (gana(b, x.l[li])) p.bien += 1; }
    });
  });
  const escr = [];
  const vistos = new Set();
  jur.forEach((x) => (x.e || []).forEach((w, li) => { if (w && !vistos.has(w)) { vistos.add(w); escr.push([w, x.l[li]]); } }));
  const orden = ctx.prin.concat(ctx.ter ? [ctx.ter] : []).map((R) => R.r);
  const rondas = [];
  jur.forEach((x) => {
    let R = rondas.find((y) => y.r === x.r);
    if (!R) { R = { r: x.r, j: new Set(), b: [] }; rondas.push(R); }
    x.v.forEach(([q]) => R.j.add(q));
    R.b.push(x);
  });
  rondas.sort((a, b) => orden.indexOf(a.r) - orden.indexOf(b.r));
  const claveJ = (st) => [...st].sort().join('|');
  const varios = Object.keys(porJ).length > 1;
  return (
    <div className="lk-ja">
      <ul className="lk-ja-js">
        {Object.entries(porJ).map(([q, p]) => (
          <li key={q}><CaraCtx ctx={ctx} m={q} /><span className="lk-ja-q"><b>{nombreDe(ctx, q)}</b><small>{p.n + (p.n === 1 ? ' batalla votada' : ' batallas votadas')}</small></span>
            {p.cuenta ? <span className="lk-ja-ac"><b>{p.bien + '/' + p.cuenta}</b><small>votó al que pasó</small></span> : null}</li>
        ))}
      </ul>
      {escr.length ? (
        <>
          <h4 className="lk-ja-h">Así se escribieron en los veredictos</h4>
          <ul className="lk-ja-es">{escr.map(([w, x]) => <li key={w}><span className="w">«{limpio(w)}»</span><span aria-hidden="true">→</span><span className="p"><CaraCtx ctx={ctx} m={partes(x)[0]} />{nombreDe(ctx, x)}</span></li>)}</ul>
        </>
      ) : null}
      {rondas.map((R, i) => {
        const cambio = i > 0 && claveJ(R.j) !== claveJ(rondas[i - 1].j);
        return (
          <div key={R.r} className="lk-ja-r">
            <h4 className="lk-ja-h">{R.r}{varios ? <span>{' · ' + [...R.j].map((q) => nombreDe(ctx, q)).join(', ')}</span> : null}{cambio ? <em> · cambió el jurado</em> : null}</h4>
            <ul>
              {R.b.map((x, k) => (
                <li key={k}>{x.l.map((s, li) => {
                  const vs = x.v.filter((v) => v[1] === li);
                  return [li ? <span key={'v' + li} className="lk-ja-vs" aria-hidden="true">vs</span> : null,
                    <span key={li} className={'lk-ja-m' + (vs.length ? ' v' : '')}><CaraCtx ctx={ctx} m={partes(s)[0]} />{nombreDe(ctx, s)}
                      {(x.e || [])[li] ? <em>«{limpio(x.e[li])}»</em> : null}
                      {vs.length ? <i className="lk-vt" title={vs.map((v) => limpio(v[0])).join(', ') + ' votó a ' + nombreDe(ctx, s)}>{vs.map((v) => inicial(v[0])).join('')}</i> : null}</span>];
                })}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// 👥 LOS INSCRITOS: quienes jugaron, con su cara y cómo se anotaron; y los que se anotaron y no jugaron
function InscritosA({ ctx, G }) {
  const liga = ctx.liga;
  const ins = insDe(G);
  if (!ins.length) return null;
  const si = ins.filter((x) => x[1]);
  const no = ins.filter((x) => !x[1]);
  const jugaron = new Set(si.flatMap((x) => partes(x[1]).map((m) => { const f = liga.quien(m); return f ? f.k : norm(limpio(m)); }))).size;
  return (
    <div className="lk-ia">
      <p className="lk-ia-t"><b>{jugaron + ' jugaron'}</b>{' de los ' + ins.length + ' que se anotaron. «Se anotó» es el nombre que escribió: su cuenta de Discord dice quién es.'}</p>
      {si.length ? (
        <ul className="lk-ia-g">
          {si.map(([t, es, por], i) => {
            const ms = partes(es);
            const f = ctx.fila(ms[0]);
            const dif = por === 'cuenta' && sinMenciones(t) && soloLetras(sinMenciones(t)) !== soloLetras(es);
            const cont = (
              <>
                <CaraCtx ctx={ctx} m={ms[0]} />
                <span><b>{ms.map((m) => nombreDe(ctx, m)).join(' + ')}</b>
                  <small>{dif ? <>se anotó «{sinMenciones(t)}»</> : por === 'cuenta' ? 'por su cuenta' : 'por el nombre'}</small></span>
              </>
            );
            return <li key={i}>{f && ms.length === 1 ? <a href={'#/r/' + encodeURIComponent(f.k)}>{cont}</a> : <div>{cont}</div>}</li>;
          })}
        </ul>
      ) : null}
      {no.length ? (
        <>
          <h4 className="lk-ja-h">{no.length + (no.length === 1 ? ' se anotó y no jugó' : ' se anotaron y no jugaron')}</h4>
          <ul className="lk-ia-no">{no.map(([t], i) => <li key={i}>{sinMenciones(t)}</li>)}</ul>
        </>
      ) : null}
    </div>
  );
}

// 💰 LOS PUNTOS, POR PUESTO: una barra por puesto (el campeón marcado) y debajo quiénes, si son varios
function PuntosA({ ctx, L, orden, grupos }) {
  if (!orden.length) return null;
  const max = Math.max(1, ...(L.tabla || []).map((r) => +r[2] || 0));
  return (
    <ol className="lk-pu">
      {orden.map((g, i) => {
        const rs = grupos[g];
        const vals = rs.map((r) => +r[2] || 0);
        const hi = Math.max(...vals);
        const lo = Math.min(...vals);
        const fil = (r) => (r[3] ? ctx.liga.T[r[3]] : ctx.fila(r[0]));
        return (
          <li key={g} className={i === 0 ? 'p1' : ''}>
            <span className="lk-pu-q"><Medalla p={MEDALLA[g]} />{g}</span>
            <span className="lk-pu-bar"><i style={{ width: (100 * hi / max).toFixed(1) + '%' }} />
              <span><span className="lk-caras">{rs.slice(0, 6).map((r, k) => <CaraCtx key={k} ctx={ctx} m={r[0]} />)}</span>
                {rs.length === 1 ? nombreDe(ctx, rs[0][0]) : rs.length + ' raperos'}</span></span>
            <span className="lk-pu-v">{lo === hi ? num(hi) : num(lo) + '–' + num(hi)}<small>{rs.length > 1 ? 'cada uno' : 'pts'}</small></span>
            {rs.length > 1 ? (
              <ul className="lk-pu-ns">
                {rs.map((r, k) => { const f = fil(r); return <li key={k}>{f ? <a href={'#/r/' + encodeURIComponent(f.k)}><Nombre x={r[0]} f={f} /></a> : <span><Nombre x={r[0]} /></span>}{lo !== hi ? <b>{num(r[2])}</b> : null}</li>; })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function Llave({ liga, vivoL, n: n0, raiz, dc }) {
  let n = n0;
  try { n = decodeURIComponent(n0); } catch (e) { /* tal cual */ }
  const enVivo = String(n).indexOf('v:') === 0;
  const deLobby = enVivo ? (vivoL || {})[String(n).slice(2)] : (liga.d.llaves || {})[n];
  const [vieja, setVieja] = useState(undefined);
  // 📶 «Prueba de nuevo» cuando no se pudo bajar (18/11/2026): `vieja === 'error'` nunca llega a `L`
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    if (deLobby || enVivo) return undefined;
    let vivo = true;
    setVieja(undefined);
    pedirUna(n, liga.d && liga.d.r2).then((x) => { if (vivo) setVieja(x === 'error' ? 'error' : (x || null)); });
    return () => { vivo = false; };
  }, [n, deLobby, enVivo, intento]);
  const L = deLobby || (vieja && vieja !== 'error' ? vieja : null) || null;
  // 🏷️ EL NOMBRE QUE SE LEE (18/11/2026): el lector guarda «(sin titulo)» y el h1, la pestaña y Compartir lo mostraban
  // crudo, aunque el calendario supiera cómo se llama el evento (la #651, «RED BULL INTERNACIONAL»). El suyo; si es
  // «(sin titulo)», el del calendario para ese número; si tampoco, '' (y cada uno pone lo suyo)
  const calN = L && esSinTitulo(L.nombre) ? (liga.d.calendario || []).find((c) => String(c.ll) === String(n)) : null;
  const nomL = !L ? '' : !esSinTitulo(L.nombre) ? limpio(L.nombre) : calN && !esSinTitulo(calN.n) ? limpio(calN.n) : '';
  // 🎟️ «MIRÁ UNA LLAVE EN VIVO», la Tarea del Pase (05/10/2026): con tu cuenta y después de 20 segundos con la llave
  // abierta —tocarla y volver no es mirarla—. Si no sos miembro de DRA, el servidor no la cuenta
  const seJuega = enVivo && !!L && !!L.vivo && !L.terminada;
  // ✅ Y DICE SI CONTÓ (Dlx, 07/10/2026: «ya lo hice pero no recibo nada»): una llave terminada y una que se juega se
  // veían igual, y la Tarea no decía nada en ninguno de los dos casos
  const [contoPase, setContoPase] = useState(false);
  useEffect(() => {
    setContoPase(false);
    if (!dc || !seJuega) return undefined;
    const t = setTimeout(() => vioVivo(String(n).slice(2)).then((r) => { if (r && r.cuenta) setContoPase(true); }), 20000);
    return () => clearTimeout(t);
  }, [dc && dc.id, seJuega, n]);
  const tareaVivo = dc && !seJuega ? vivoPendiente() : null;
  const [sigo, setSigo] = useState('');
  useEffect(() => { window.scrollTo(0, 0); setSigo(''); }, [n]);
  // 🗂️ la pestaña de abajo (el remake A): arranca en la llave, también al pasar a otra
  const [tab, setTab] = useState('llave');
  useEffect(() => { setTab('llave'); }, [n]);
  useEffect(() => {
    if (!L) return undefined;
    const poner = () => { document.title = (nomL || 'La llave') + ' · Liga Global de Freestyle'; };
    poner();
    const r = setTimeout(poner, 0);
    return () => clearTimeout(r);
  }, [L, nomL]);
  // el alto de la barra de abajo del celular: la de quien se sigue va justo encima (como «tu lugar» del Ranking)
  const [tb, setTb] = useState(0);
  useEffect(() => {
    const medir = () => {
      const r = raiz && raiz.current;
      const b = r && r.querySelector('.tabbar');
      setTb(b && b.offsetParent !== null ? b.offsetHeight : 0);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [raiz]);
  const compu = useCompu();
  const seguir = useCallback((id) => setSigo((s) => (s === id || !id ? '' : id)), []);

  // todo lo que sale de la llave, una vez por llave (y por quién se sigue)
  const base = useMemo(() => {
    if (!L) return null;
    // 🧭 Y TÚ, AUNQUE ESTÉS FUERA DE LAS 200 (18/11/2026): `quien()` sin clave te encuentra fuera de la tabla sólo con tu
    // nombre exacto, y escrito con otro espacio, otra puntuación o tu alias quedabas 'n:<clave>': tu camino no arrancaba
    // marcado (`juegoAca`), y la barra no te daba tu perfil ni la llave tu carta
    const yo = liga.yo && liga.yo.k && !liga.T[liga.yo.k] ? liga.yo : null;
    const yoC = yo ? clave(yo.n) : '';
    // 🔑 el alias va con la clave del lobby (`normNombre`, NFKD) y no con la de acá, que también pliega ø, ł o ß (18/11/2026)
    const esYo = (x) => !!yo && ((!!yoC && clave(x) === yoC) || (liga.d.alias || {})[normNombre(x)] === yo.k);
    const fila = (x) => liga.quien(x) || (esYo(x) ? yo : null);
    const idDe = (x) => { const f = fila(x); return f ? 'k:' + f.k : 'n:' + clave(x); };
    // 🪪 el nombre de cada uno: el oficial si se sabe quién es (17/11/2026, Dlx: «si alguien escribe velatzzzz, debería
    // mostrarse con su aka oficial, Velatz»); si no, como lo escribieron
    const nombres = {};
    const nomDe = (id, m) => { const f = /^k:/.test(id) ? liga.T[id.slice(2)] || liga.X[id.slice(2)] : null; return f ? limpio(f.n) : sinBanderas(m).txt; };
    // 🔑 EL EQUIPO QUE LA LLAVE NOMBRA CON UN SOLO NOMBRE Y NADIE SABE QUIÉNES SON (`sin`, del lector; Dlx, 29/09/2026:
    // «TEAM VENECIA no es un participante… es un equipo»): sin cara, sin perfil y sin puntos. Sin el paréntesis
    const sinP = (x) => clave(String(x || '').replace(/[(（][^()（）]*[)）]/g, ''));
    const sinK = new Set((L.sin || []).map(sinP));
    const esSin = (x) => sinK.has(sinP(x));
    // los puntos y el lugar de cada uno en esta llave (la barra de quien se sigue)
    const pts = {};
    (L.tabla || []).forEach((r) => partes(r[0]).forEach((m) => {
      const id = r[3] && partes(r[0]).length === 1 ? 'k:' + r[3] : idDe(m);
      pts[id] = [r[1], r[2]];
      nombres[id] = nomDe(id, m);
    }));
    // 🔑 MOST WANTED EN LA LLAVE (Dlx, 27/09/2026): el que cazaron ACÁ lleva 🎯 en la batalla que perdió; en una en
    // vivo, el buscado suelto lleva 🎯 y su recompensa
    const mw = liga.d.mw || {};
    const cazas = (mw.ce && mw.ce[String(n)]) || [];
    const cazado = {};
    cazas.forEach((c) => { const f = fila(c[0]); cazado[f ? f.k : c[0]] = c; });
    const mwDe = (x) => { const f = fila(x); return (mw.b || []).find((y) => y.n === x || (f && y.k === f.k)) || null; };
    const marca = (x, f, perdio) => {
      const k = f ? f.k : x;
      if (cazado[k]) return perdio ? <i className="lk-mw cz" title={'Lo cazaron acá (' + cazado[k][1] + ')'}><Ico n="mira" t={14} /></i> : null;
      const y = L.vivo && mwDe(x);
      return y && y.e === 'suelto' ? <i className="lk-mw" title={'Buscado · ' + y.cn + ' · ' + num(y.v) + ' pts'}><Ico n="mira" t={14} /></i> : null;
    };
    // en una en vivo, quiénes de los buscados juegan: es la invitación a cazar
    const aca = [];
    if (L.vivo) {
      const visto = {};
      (L.rondas || []).forEach((R) => (R.b || []).forEach((b) => (b[0] || []).map(texto).forEach((s) => partes(s).forEach((m) => {
        const y = mwDe(m);
        if (y && y.e === 'suelto' && !visto[y.n]) { visto[y.n] = 1; aca.push(y); }
      }))));
    }
    // 🔑 EL CLÁSICO: los mismos dos, cruzándose en su tercer evento o más. En vivo, con lo que llevan
    const clasico = (b) => {
      const ls = b[0] || [];
      if (ls.length !== 2 || /[,+]/.test(ls[0] + ls[1])) return null;
      const [a, c] = ls;
      const x = (L.clasicos || []).find((y) => (y[0] === a && y[1] === c) || (y[0] === c && y[1] === a));
      if (x) return x[0] === a ? [a, c, x[2], x[3]] : [a, c, x[3], x[2]];
      const R = liga.d.rivales;
      if (L.vivo && R) {
        const fa = fila(a);
        const fc = fila(c);
        const r = fa && fc && R[[fa.k, fc.k].sort().join('|')];
        if (r) return [a, c, r[fa.k] || 0, r[fc.k] || 0];
      }
      return null;
    };
    // las rondas: la principal (sin el tercer puesto) y el tercer puesto aparte
    const rs = (L.rondas || []).map((R) => ({ r: R.r, b: (R.b || []).map(normB) })).filter((R) => R.b.length);
    const ter = rs.find((R) => R.r === 'Tercer puesto') || null;
    let prin = rs.filter((R) => R.r !== 'Tercer puesto');
    const cerrada = !L.vivo || !!L.terminada;
    // 🔑 EN VIVO, LA LLAVE COMPLETA: las rondas que faltan y los cruces que no se jugaron, vacíos (`completar()` del
    // escenario), con sus ramas. Sólo si se arma como árbol: si no, cada cruce en el orden en que vino
    if (!cerrada && !esDoble(prin)) {
      const previas = prin.filter((R) => PREVIAS.includes(R.r));
      const cuadro = prin.filter((R) => !PREVIAS.includes(R.r));
      const todas = completar(cuadro);
      if (todas !== cuadro && esArbol(todas)) {
        const llenas = todas.map((R, i) => ({ r: R.r, b: R.b.map((b, j) => { const x = normB(b); if (i) x[3] = [2 * j, 2 * j + 1]; return x; }) }));
        prin = previas.concat(llenas);
      }
    }
    // los puntos de quedar afuera en cada ronda: el mismo número para todos, o nada
    const ptsM = {};
    (L.tabla || []).forEach((t) => miembros(t[0]).forEach((m) => { ptsM[m] = t[2]; }));
    const valeR = (R) => {
      const vs = [];
      R.b.forEach((b) => b[0].forEach((s) => { if (b[1] && gana(b, s)) return; miembros(s).forEach((m) => { if (ptsM[m] != null) vs.push(ptsM[m]); }); }));
      return vs.length && vs.every((v) => v === vs[0]) ? vs[0] : null;
    };
    const ult = prin.length - 1;
    // 🔴 UNA FINAL DE VERDAD (pasada del 19/10/2026): «la última ronda tiene una batalla» también es la primera batalla de
    // una llave de vidas o una en vivo que recién arranca, y salía «CAMPEÓN» en grande con el ganador de la primera
    const final = !vidasDe(L) && ult >= 0 && prin[ult].b.length === 1 && (ult > 0 || /final/i.test(prin[ult].r)) ? prin[ult].b[0] : null;
    const ptsCamp = (() => {
      if (!final || !final[1]) return '';
      const ps = miembros(final[1]).map((m) => ptsM[m]).filter((v) => v != null);
      if (!ps.length) return '';
      const lo = Math.min(...ps);
      const hi = Math.max(...ps);
      return lo === hi ? num(hi) : num(lo) + '–' + num(hi);
    })();
    const vale = prin.map((R, i) => {
      const v = valeR(R);
      const t = v != null ? num(v) + ' pts' : '';
      return i === ult && final && ptsCamp ? (t ? t + ' · ' : '') + 'campeón ' + ptsCamp : t;
    });
    // 🔑 LA DOBLE: sus dos llaves y la gran final, con sus rondas y sus ramas (`partirDoble()`). La rama sale de quién
    // ganó: la batalla de la ronda de antes cuyo ganador pelea en ésta. En la de perdedores, el otro lado viene de la
    // de ganadores y no lleva rama. Los puntos sólo en la de perdedores: ahí quien pierde queda afuera
    let dob = null;
    if (esDoble(prin)) {
      const d = partirDoble(prin);
      const ramas = (rs) => rs.map((R, k) => ({ r: R.r, b: R.b.map((b) => {
        const x = b.slice();
        x[3] = k ? rs[k - 1].b.map((p, j) => (p[1] && b[0].some((s) => comparten(p[1], s)) ? j : -1)).filter((j) => j >= 0) : [];
        return x;
      }) }));
      const G = ramas(d.G);
      const P = ramas(d.P);
      const ini = (rs) => { const i = rs.findIndex((R) => R.b.some((b) => !b[1] && b[0].length >= 2)); return !cerrada && i >= 0 ? i : 0; };
      const gf = d.F[d.F.length - 1];
      const pc = gf && gf[1] ? miembros(gf[1]).map((m) => ptsM[m]).filter((v) => v != null) : [];
      dob = { G, P, F: d.F, valeG: G.map(() => ''), valeP: P.map((R) => { const v = valeR(R); return v != null ? num(v) + ' pts' : ''; }),
        iniG: ini(G), iniP: ini(P), campeon: (gf && gf[1]) || '', ptsF: pc.length ? num(Math.max(...pc)) : '' };
    }
    // quiénes pasaron de un grupo donde pasan varios: los que aparecen en la ronda siguiente
    const pasanDe = prin.map((R, i) => {
      if (!prin[i + 1] || !R.b.some((b) => /pasan [2-9]/.test(b[2]))) return null;
      const sig = new Set();
      prin[i + 1].b.forEach((b) => b[0].forEach((s) => miembros(s).forEach((m) => sig.add(m))));
      return (s) => miembros(s).some((m) => sig.has(m));
    });
    // AHORA y SIGUE, sólo si se juega en orden (`enOrden()`): si no, no se sabe cuál se está jugando. Jugado es con
    // ganador o con alguno de sus lados ya en la ronda siguiente (`jugado()`: en un grupo de tres pueden pasar dos)
    const pend = [];
    // (en la doble no: las dos llaves se juegan intercaladas y no se sabe cuál va, como dice `Doble`)
    if (!cerrada && enOrden(prin) && !esDoble(prin)) prin.forEach((R, i) => R.b.forEach((b, j) => { if (!jugado(prin, i, b) && b[0].length >= 2) pend.push(i + ':' + j); }));
    const est = (i, j) => {
      const b = prin[i] && prin[i].b[j];
      if (!b) return '';
      if (pend[0] === i + ':' + j) return 'ahora';
      if (pend[1] === i + ':' + j) return 'sigue';
      return cerrada && !jugado(prin, i, b) && b[0].length >= 2 ? 'singan' : '';
    };
    // la ronda con la que abre el celular: la que se está jugando; terminada, la primera
    const enJuego = prin.findIndex((R, i) => R.b.some((b) => !jugado(prin, i, b) && b[0].length >= 2));
    const inicial = !cerrada && enJuego >= 0 ? enJuego : 0;
    // el nombre de cada uno, para la barra de quien se sigue (también los que no están en la tabla de la llave)
    prin.concat(ter ? [ter] : []).forEach((R) => R.b.forEach((b) => b[0].forEach((s) => partes(s).forEach((m) => {
      const id = idDe(m);
      if (!nombres[id]) nombres[id] = nomDe(id, m);
    }))));
    (L.funa || []).forEach((x) => { const id = idDe(x[0]); if (!nombres[id]) nombres[id] = nomDe(id, x[0]); });
    // ⚖️ EL JURADO DE CADA BATALLA (el remake A, 18/11/2026): `L.gente.jur` trae la ronda y los lados tal como los escribe
    // la llave, así que se cruza por eso mismo. Y cómo escribió el jurado a cada uno («KIBAK» es Valen), sólo la primera
    // vez que aparece en el orden de las rondas: repetido en cada fila no dejaba leer los nombres
    const jurM = {};
    ((L.gente || {}).jur || []).forEach((j) => { jurM[j.r + '|' + (j.l || []).join('|')] = j; });
    const votoDe = (r, b) => jurM[r + '|' + b[0].join('|')] || null;
    const escrito = {};
    const vistoE = new Set();
    prin.concat(ter ? [ter] : []).forEach((R) => R.b.forEach((b) => {
      const j = votoDe(R.r, b);
      ((j && j.e) || []).forEach((w, li) => {
        const kk = clave(b[0][li] || '');
        if (w && kk && !vistoE.has(kk)) { vistoE.add(kk); escrito[R.r + '|' + b[0].join('|') + '|' + li] = w; }
      });
    }));
    const escritoDe = (r, b, li) => escrito[r + '|' + b[0].join('|') + '|' + li] || '';
    return { fila, idDe, nombres, esSin, pts, marca, cazas, aca, clasico, prin, ter, cerrada, vale, pasanDe, est, inicial, final, dob,
      pend, ptsCamp, votoDe, escritoDe };
  }, [L, liga, n]);

  // 🧭 TU CAMINO, ENCENDIDO DESDE QUE ABRÍS (Dlx, 18/10/2026: «all of them»): si jugás en esta llave, arranca marcado
  const mioId = liga.yo && liga.yo.k ? 'k:' + liga.yo.k : '';
  const juegoAca = !!(base && mioId && base.nombres[mioId]);
  useEffect(() => { if (juegoAca) setSigo((s) => s || mioId); }, [juegoAca, mioId, n]);
  // 🎬 lo que cambió desde la vuelta anterior (la llave en vivo se actualiza sola cada minuto): las batallas que se
  // decidieron y quién llegó a una batalla nueva. La primera vez no se anima nada
  const [anim, setAnim] = useState(null);
  const antes = useRef(null);
  useEffect(() => {
    if (!base) return undefined;
    const g = {};
    const ss = new Set();
    base.prin.forEach((R, i) => R.b.forEach((b, j) => {
      if (b[1]) g[i + ':' + j] = b[1];
      b[0].forEach((s) => { if (s) ss.add(i + ':' + j + ':' + clave(s)); });
    }));
    const prev = antes.current;
    antes.current = { g, ss, n };
    if (!prev || prev.n !== n) return undefined;
    const nb = new Set(Object.keys(g).filter((k) => !prev.g[k]));
    const ns = new Set([...ss].filter((k) => !prev.ss.has(k)));
    if (nb.size || ns.size) setAnim({ b: nb, s: ns });
    return undefined;
  }, [base, n]);
  // 🔴 el apagado, aparte (pasada del 19/10/2026): adentro del efecto de arriba lo cancelaba cualquier vuelta de `base` (cada
  // minuto, al entrar con la cuenta), y la animación quedaba prendida y se repetía
  useEffect(() => {
    if (!anim) return undefined;
    const t = setTimeout(() => setAnim(null), 2600);
    return () => clearTimeout(t);
  }, [anim]);

  if (!L) {
    if (!enVivo && vieja === undefined) return <div className="cargando">Buscando la llave…</div>;
    // 📶 no se pudo bajar (sin red): no es «no está», y se puede volver a pedir (18/11/2026)
    if (!enVivo && vieja === 'error') {
      return (
        <section className="sec lk-sec">
          <div className="sec-t"><h2>No pude bajar la llave</h2></div>
          <p className="pronto-p">Puede ser la conexión. <button type="button" className="btn verde chico" onClick={() => setIntento((i) => i + 1)}>Prueba de nuevo</button></p>
        </section>
      );
    }
    return (
      <section className="sec lk-sec">
        <div className="sec-t"><h2>{enVivo ? 'Esa llave ya no se está jugando' : 'Esa llave no está'}</h2></div>
        <p className="pronto-p">{enVivo ? 'Terminó o se borró: cuando el ciclo la procese, va a estar en Eventos con sus puntos.'
          : 'Puede ser de otra temporada, o el link está mal copiado.'} <a className="te-link" href="#/eventos">Ver los eventos</a></p>
      </section>
    );
  }
  const ctx = Object.assign({}, base, {
    liga, L, n, sigo, seguir, anim, compu,
    // 🅰️ el remake A (18/11/2026): las filas de la llave con caras, nota y votos (`Lado`, `compacta()`)
    caras: true, elegir: (id) => setSigo(id || ''),
    pasan: (i) => base.pasanDe[i] || null,
    // una rama es del camino de quien se sigue si esa persona pasó de la batalla de abajo
    sigoPasa: (b) => !!b[1] && partes(b[1]).some((m) => base.idDe(m) === sigo),
  });

  // ── la ficha: formato, rango, cuándo, cuántos, quién organizó y el premio (Dlx, 25/09/2026: «mostrar el formato…
  // pandillas, 1v1, el rango») ──
  const sv = liga.svs[L.sv] || {};
  const inf = L.info || {};
  const pas = (liga.d.pasados || []).find((p) => String(p.llave) === String(n));
  const cal = (liga.d.calendario || []).find((c) => String(c.ll) === String(n));
  const mod = inf.mod || (pas && pas.modalidad) || '';
  const rgo = inf.rg || (pas && pas.rango) || '';
  // ⚖️ y la en vivo, del anuncio que le toca (`liga.anuncioDeLlave()`). Sin «Organiza:» escrito, quien lo publicó
  const evV = L.vivo && !inf.org ? liga.anuncioDeLlave(L) : null;
  const org = inf.org || (pas && pas.org) || (evV && evV.org) || inf.aut || (evV && evV.aut) || '';
  // 👥 de a uno, con su cara y su perfil (Dlx, 14/10/2026): de lo mismo que dio `org`, con sus `os` si los trae
  // 👥 Y SI EL ANUNCIO YA NO VIAJA (las llaves viejas), LO QUE SE GUARDÓ DE ÉL (`L.gente`, de bot/gente_evento.py)
  const G = L.gente || {};
  const GS = G.staff || {};
  const deOrg = [inf, pas, evV].find((x) => x && ((x.os && x.os.length) || x.org)) || (!org && GS.org ? { os: GS.org } : { org });
  const orgsL = org || GS.org ? liga.orgsDe(deOrg) : [];
  const st = inf.st || (evV && evV.st) || (GS.host || GS.jurado || GS.dj ? { h: GS.host, j: GS.jurado, d: GS.dj } : {});
  // en UN span: el `gap` del renglón separaba la coma del nombre
  // 🪪 con su cara, como los organizadores (17/11/2026, Dlx: «hazlo más bonito con su foto y su cuenta»)
  const gente = (xs) => <span className="lk-orgs lk-st">{(xs || []).map((x, i) => {
    const f = liga.quien(x);
    return [i ? ', ' : '', f ? <a key={x} href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cara lk-oc" />{limpio(f.n)}</a> : <b key={x}>{limpio(x)}</b>];
  })}</span>;
  const mR = /^Rango (\w+)$/.exec(String(rgo || ''));
  const asc = sv.rangos && mR && sv.rangos[mR[1]] ? sv.rangos[mR[1]].map((p, i) => (i < 3 ? (i + 1) + '°' : '4°') + ' ' + num(p)).join(' · ') : '';
  const mult = L.vivo ? liga.multSv(L.sv) : null;
  const cuando = cal ? liga.dia(cal.t) : L.vivo ? '' : L.fecha;
  const dia = cal ? liga.diaClave(cal.t) : (L.dia || '');
  // ── el podio ──
  const puesto = (p) => (L.tabla || []).filter((r) => r[1] === p);
  const podio = [['Campeón', 1, 'p1'], ['Subcampeón', 2, 'p2'], ['Tercero', 3, 'p3']].map(([p, m, c]) => {
    const rs = puesto(p);
    if (!rs.length) return null;
    // ⚠️ UN EQUIPO NO SIEMPRE SUMA PAREJO: en GENESIS el revivido se llevó 3000 y sus compañeros 2500
    const ps = rs.map((r) => +r[2] || 0);
    const lo = Math.min(...ps);
    const hi = Math.max(...ps);
    return { p, m, c, rs, pts: lo === hi ? num(hi) : num(lo) + ' a ' + num(hi) };
  }).filter(Boolean);
  // ── los puntos, por puesto ──
  const grupos = {};
  const orden = [];
  (L.tabla || []).forEach((r) => { if (!grupos[r[1]]) { grupos[r[1]] = []; orden.push(r[1]); } grupos[r[1]].push(r); });
  orden.sort((a, b) => { const x = ORD_P.indexOf(a); const y = ORD_P.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
  // con el campeón en grande arriba, el podio sigue con los demás
  const podioSin = base.final && base.final[1] ? podio.filter((x) => x.m !== 1) : podio;
  const N = vidasDe(L);
  const hayR = base.prin.length > 0;
  const conVs = base.cerrada && (L.tabla || []).some((r) => r[1] === 'Campeón');
  // 🚩 «¿Algo está mal?» y «Corregir» sólo donde el Worker los acepta (18/11/2026): una llave que no suma (n de nueve
  // cifras, `llaves_a_entrada.BASE_N`) o una de vidas de #veredictos (`v:ver:…`) volvían siempre con error, y la página
  // decía «prueba de nuevo en un rato». ⚠️ Es la regla de `validarReporte()` de bot/avisos.js: se cambian juntas
  const reportable = enVivo ? /^v:\d{15,22}$/.test(String(n)) : /^\d{1,6}$/.test(String(n)) && !L.ns;
  const fechaEv = cal ? '#/eventos/' + liga.diaClave(cal.t) : dia ? '#/eventos/' + dia : '#/eventos';
  // 🅰️ LAS PESTAÑAS (el remake A, 18/11/2026): la llave siempre; el jurado, los inscritos y los puntos si hay
  const jsJ = juecesDe(G);
  const juradoL = st.j && st.j.length ? st.j : jsJ;
  // «organizó y juzgó» cuando el jurado es quien organizó (en NEW GENESIS, Erian): un renglón y no dos con la misma cara
  const orgYJ = orgsL.length > 0 && juradoL.length === orgsL.length
    && juradoL.every((x) => { const f = liga.quien(x); return orgsL.some((o) => (o.f && f ? o.f.k === f.k : clave(o.n) === clave(x))); });
  const tabs = [['llave', N ? N + ' vidas' : base.dob ? 'Doble eliminación' : 'La llave',
    base.prin.reduce((a, R) => a + R.b.length, 0) + (base.ter ? base.ter.b.length : 0)]];
  if ((G.jur || []).length) tabs.push(['jurado', 'El jurado', G.jur.length]);
  if (insDe(G).length) tabs.push(['ins', 'Inscritos', insDe(G).length]);
  if (orden.length) tabs.push(['pts', 'Puntos', (L.tabla || []).length]);
  const tabV = tabs.some((x) => x[0] === tab) ? tab : 'llave';
  const rail = conVs ? <><PodioA ctx={ctx} L={L} />{!N ? <CaminoA ctx={ctx} L={L} /> : null}</> : null;
  return (
    <>
      <div className="escena lk-esc lk-a" style={{ '--mo-c': sv.color || '#E41373', '--mo-o': 0.85, '--mo-c2': '#29B298', ...silueta(L.sv, sv.color) }}>
        <section className="lk-cab">
          <a className="lk-volver" href={fechaEv}>‹ Eventos</a>
          <div className="lk-cab-g">
            {L.sv && liga.logo(L.sv) ? <img className="lk-logo" src={liga.logo(L.sv)} alt="" width="64" height="64" /> : null}
            <div className="lk-cab-tx">
              <span className="lk-meta">{L.vivo ? <b>{L.terminada ? 'Terminó · ' : '● En vivo · '}</b> : null}{cuando ? <>{cuando}{' · '}</> : null}{sv.nombre || L.sv || ''}</span>
              {/* una palabra muy larga («EXTERMINACION») se partía en el celular («EXTERMINAC / ION»): más chica */}
              <h1 className={'hero-ev largo lk-tit' + (Math.max(0, ...String(nomL).split(/\s+/).map((w) => w.length)) >= 11 ? ' pal-larga' : '')}>{nomL || 'La llave'}</h1>
              <ul className="lk-datos">
                {mod ? <li><b>{mod}</b></li> : null}
                {rgo ? <li title={asc ? 'Puntos de ascenso en ' + (sv.nombre || L.sv) + ' (no en la Liga): ' + asc : undefined}>{rgo}{asc ? <small> · {asc}</small> : null}</li> : null}
                {L.participantes ? <li><b>{L.participantes}</b> raperos</li> : null}
                {/* 👀 la llave de un servidor que no suma (Tier 2 y 3): se ve, pero no cuenta (`llaves_a_entrada.para_ver()`) */}
                {L.ns ? <li>No suma al ranking</li> : null}
                {orgsL.length ? <li className="lk-orgs">{L.vivo && !L.terminada ? 'organiza' : 'organizó'}{orgYJ ? ' y juzgó' : ''}{' '}
                  {orgsL.map(({ n: on, f }, i) => [i ? ', ' : '', f
                    ? <a key={on} href={'#/r/' + encodeURIComponent(f.k)}><Cara liga={liga} k={f.k} nombre={f.n} cls="cara lk-oc" />{limpio(f.n)}</a>
                    : <b key={on}>{limpio(on)}</b>])}</li> : null}
                {juradoL.length && !orgYJ ? <li><Ico n="jurado" t={16} />jurado {gente(juradoL)}</li> : null}
                {st.h ? <li><Ico n="micro" t={16} />host {gente(st.h)}</li> : null}
                {st.d ? <li><Ico n="auris" t={16} />DJ {gente(st.d)}</li> : null}
                {inf.pre ? <li><Ico n="premio" t={16} />{inf.pre}</li> : null}
                {mult && mult !== 1 ? <li className="lk-mult">×{String(mult).replace('.', ',')} esta semana</li> : null}
              </ul>
              {/* 🔎 LO QUE SE PUDO COMPROBAR DE LA LLAVE (Dlx, 11/11/2026: «construye la verificación de llaves»): lo arma el
                  ciclo (`bot/verificar_llaves.py`) y viaja como `ver`. Sólo informa —lo que retiene, lo retiene antes de sumar—
                  y no dice nunca si un organizador está observado: eso es de la Liga. Las llaves de antes no la traen */}
              {L.ver && !L.vivo ? (
                <ul className="lk-ver" aria-label="Lo que se comprobó de esta llave">
                  <li className={inf.anuncio ? 'si' : ''}>{inf.anuncio ? '✓ Anunciada antes' : '· Sin anuncio leído'}</li>
                  {L.ver.min != null ? <li>· Completa en {L.ver.min < 60 ? L.ver.min + ' min' : Math.floor(L.ver.min / 60) + ' h ' + (L.ver.min % 60) + ' min'}</li> : null}
                  <li className={L.ver.org ? (L.ver.org === 'gana' ? 'ojo' : '') : 'si'}>{L.ver.org === 'gana' ? '⚠ La ganó quien la organizó' : L.ver.org === 'juega' ? '· Quien la organizó también jugó' : '✓ Quien la organizó no jugó'}</li>
                  <li className={L.ver.copia ? 'ojo' : 'si'}>{L.ver.copia ? '⚠ Se parece a la llave #' + L.ver.copia : '✓ No es copia de otra llave'}</li>
                  {L.ver.rev ? <li className="si">✓ Revisada por la Liga</li> : null}
                </ul>
              ) : null}
              {L.vivo ? (
                <p className="lk-vivo">{L.terminada ? 'Terminó: los puntos llegan cuando el ciclo la procese' : (L.enJuego || 'En juego') + ' en juego'}
                  {' · se actualiza sola cada minuto · último cambio ' + hace(L.ed || L.pub || Date.now())}</p>
              ) : null}
              {contoPase ? <p className="lk-pase si" role="status">✓ Contó para tu Pase: miraste esta llave en vivo</p> : null}
              {tareaVivo ? <p className="lk-pase">Tu Tarea «{tareaVivo.t}» cuenta con una llave que se esté jugando, y ésta ya terminó. Las que se juegan están en <a href="#/">En vivo, en el Inicio</a>.</p> : null}
            </div>
            {/* 🔝 ARRIBA DE TODO (Dlx, 03/10/2026: «estas cosas dentro de la llave deberían estar arriba de todo, no
                debajo»): compartir —la acción principal, en blanco—, ir a Discord y avisar si algo está mal */}
            {(L.links || []).length || !L.vivo || reportable ? (
              <div className="lk-acc-b">
                {L.vivo ? null : <Compartir cls="btn chico lk-pri" url={enlace('#/llave/' + encodeURIComponent(n))} texto={'La llave de ' + (nomL || 'este evento')} etiqueta="Compartir" />}
                {(L.links || []).map((u, i, t) => <a key={u} className="btn borde2 chico" href={u} target="_blank" rel="noopener noreferrer">{t.length > 1 ? 'Llave ' + (i + 1) : 'La llave en Discord'} ↗</a>)}
                {reportable ? <Reporte n={n} nombres={nombresDe(L)} /> : null}
                {!enVivo && reportable ? <StaffLlave n={n} L={L} /> : null}
              </div>
            ) : null}
          </div>
        </section>
        {/* ⚔️ lo que se juega ahora, en grande */}
        {!base.cerrada ? <AhoraVs ctx={ctx} /> : null}
        <Numeros ctx={ctx} L={L} G={G} />
        {/* 🥊 terminada y con campeón: la final y las cazas; al costado, el podio y el camino (en el celular, después de las
            pestañas). Sin campeón —una a medias, una en vivo—, el campeón en grande y el podio de antes */}
        {conVs ? (
          <div className="lk-dos">
            <div className="lk-dos-m"><FinalA ctx={ctx} L={L} />{compu ? <CazasA ctx={ctx} /> : null}</div>
            {compu ? <aside className="lk-rail">{rail}</aside> : null}
          </div>
        ) : <CampeonG ctx={ctx} />}
        {!conVs && podioSin.length ? (
          <ol className={'lk-podio n' + podioSin.length + (podioSin !== podio ? ' sin1' : '')} aria-label="El podio">
            {podioSin.map((x) => (
              <li key={x.p} className={'lk-pd ' + x.c}>
                <span className="lk-pd-caras">{x.rs.map((r, i) => { const f = base.fila(r[0]); return <Cara key={i} liga={liga} k={f ? f.k : ''} nombre={f ? f.n : sinBanderas(r[0]).txt} cls="lk-pd-cara" />; })}</span>
                <span className="lk-pd-ns">{x.rs.map((r, i) => <Persona key={i} ctx={ctx} x={r[0]} conCara={false} />)}</span>
                <small><Medalla p={x.m} />{x.p} · {x.pts} pts</small>
              </li>
            ))}
          </ol>
        ) : null}
        {!conVs ? <div className="lk-dos-m"><CazasA ctx={ctx} /></div> : null}
      </div>

      {/* 🎨 LAS PESTAÑAS, SOBRE LA PIEL (Dlx, 03/10/2026: el escenario negro arriba y el cuadro sobre la piel, con las
          casillas encima; «ni toda blanca ni toda negra»). Su fondo, el de su servidor si quien mira no eligió un tema
          (`.lk-tsv.t-xxx`, en vivo.css junto a los temas) */}
      <section className={'sec lk-sec piel lk-a-sec' + temaLlave(L.sv)}>
        <Pestanas tabs={tabs} tab={tabV} setTab={setTab} />
        <div className="lk-pes-p" role="tabpanel" aria-label={(tabs.find((x) => x[0] === tabV) || [])[1]}>
          {tabV === 'llave' ? (
            <>
              {N || base.dob ? <p className="lk-ayuda">{N ? 'Cada batalla le saca una vida al que pierde y el que gana se queda. Con ' + N + ' derrotas quedas afuera.'
                : 'Nadie queda afuera a la primera: quien pierde en la llave de ganadores sigue en la de perdedores.'}</p> : null}
              {hayR ? <Ley ctx={ctx} L={L} G={G} /> : null}
              <Funa ctx={ctx} L={L} />
              {N ? <Vidas ctx={ctx} L={L} N={N} />
                : !hayR ? ((L.funa || []).length ? null : <p className="pronto-p">Esta llave todavía no tiene batallas.</p>)
                  : base.dob ? <Doble ctx={ctx} d={base.dob} compu={compu} />
                  : compu ? <Arbol ctx={ctx} rondas={base.prin} ter={base.ter} vale={base.vale} />
                    : <Pista ctx={ctx} rondas={base.prin} ter={base.ter} inicial={base.inicial} vale={base.vale} />}
            </>
          ) : null}
          {tabV === 'jurado' ? <JuradoA ctx={ctx} G={G} /> : null}
          {tabV === 'ins' ? <InscritosA ctx={ctx} G={G} /> : null}
          {tabV === 'pts' ? <PuntosA ctx={ctx} L={L} orden={orden} grupos={grupos} /> : null}
        </div>
        <Barra ctx={ctx} tb={tb} />
      </section>
      {/* 📱 en el celular, el podio, el camino y las cazas después de las pestañas: así la llave queda más arriba */}
      {conVs && !compu ? <div className="escena lk-esc lk-a lk-a-cola">{rail}<CazasA ctx={ctx} /></div> : null}
    </>
  );
}
