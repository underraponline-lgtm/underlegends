// 🎁 LA MINIATURA DE UN LINK CORTO (#/og/crew/<id> y #/og/ref/<clave>, 17/11/2026). Dlx: «que tenga un thumbnail
// personalizable… de la crew en este caso, y en este caso el referral también», «armada sola». `bot/og_links.py` abre esta
// ruta con Chromium, le saca una foto de 1200 × 630 y la sube a R2 (`og/<tipo>/<slug>.jpg`); `bot/paginas/_worker.js` se la
// da a los bots de vista previa. Es la MISMA pieza de la página —el escudo armado de la crew (escudo.jsx), su logo, la
// tarjeta de quien invita—: dibujarla otra vez en Python sería el bug de «un default que no es la decisión».
// Sin cabecera ni nada alrededor; `data-listo` le dice al fotógrafo cuándo.
import { useLayoutEffect, useRef, useState } from 'react';
import { limpio } from './liga.js';
import { useCrews } from './crews.js';
import { Escudo, escudoDe } from './escudo.jsx';
import CSS_PAGINA from './css/og_link.css?inline';
import { usarCss } from './css.js';
import { Bandera, nombrePais } from './piezas.jsx';
import { fondoEn, fondoOpcion, useFondos } from './fondos.js';

usarCss('og_link', CSS_PAGINA);

const ORDEN_CARTA = ['temporada', 'servidor', 'competitivo', 'pais'];
const R2 = /^https:\/\/pub-[a-z0-9]+\.r2\.dev\/[\w.%-]+\/[a-z]+\.webp(\?v=[\w]+)?$/;

/** 🔠 EL NOMBRE, DEL TAMAÑO QUE ENTRE (17/11/2026): por largo de letras salía «METRICO / S», cortado en medio de la
 *  palabra (una palabra de 8 en Archivo ancha no entraba a 92 px). Se achica de a 4 hasta que entra entero en dos líneas */
function Nombre({ texto }) {
  const el = useRef(null);
  const [px, setPx] = useState(92);
  // ⚠️ y otra vez cuando llegan las fuentes: medido con la del sistema (más angosta) entraba, y con Archivo la «S» se salía
  // 30 px de su columna. La foto espera a `document.fonts.ready` (bot/og_links.py)
  useLayoutEffect(() => {
    const medir = () => {
      const e = el.current;
      if (!e) return;
      let t = 92;
      e.style.fontSize = t + 'px';
      while (t > 36 && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > t * 0.95 * 2 + 4)) { t -= 4; e.style.fontSize = t + 'px'; }
      setPx(t);
    };
    medir();
    let vivo = true;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (vivo) medir(); });
    return () => { vivo = false; };
  }, [texto]);
  return <h1 ref={el} className="og-n" style={{ fontSize: px + 'px' }}>{texto}</h1>;
}

/** Lo que manda bot/og_links.py en la dirección (`?n=` el nombre, `?c=` la carta): quien invita puede no estar en la tabla */
function deLaRuta() {
  try {
    const q = window.location.search || ('?' + ((window.location.hash || '').split('?')[1] || ''));
    return new URLSearchParams(q);
  } catch (e) { return new URLSearchParams(); }
}

function Crew({ id }) {
  const { todas } = useCrews('lista');
  const [img, setImg] = useState(false);
  const c = todas && (todas.crews || []).find((x) => x && x.id === id);
  if (!todas) return <div className="og" />;
  if (!c) return <div className="og" data-listo="1" data-falta="1" />;
  const nombre = limpio(c.nombre || c.id), sigla = String(c.sigla || '').toUpperCase();
  const e = escudoDe(c.logo, nombre);
  const n = (c.gente || []).length;
  const desc = String(c.desc || '').trim();
  const acento = e ? '#' + e.a : '#E41373';
  return (
    <div className="og og-crew" data-listo={e || img || !c.logo ? '1' : ''} style={{ '--og-c': acento }}>
      <div className="og-izq">
        {e ? <Escudo e={e} sigla={sigla} /> : <img src={c.logo} alt="" onLoad={() => setImg(true)} onError={() => setImg(true)} />}
      </div>
      <div className="og-der">
        <span className="og-k">Crew · Liga Global de Freestyle</span>
        <Nombre texto={nombre} />
        <div className="og-fila">{sigla ? <span className="og-pill">{sigla}</span> : null}<b>{n} {n === 1 ? 'integrante' : 'integrantes'}</b></div>
        {desc ? <p className="og-p">{desc.length > 110 ? desc.slice(0, 107).replace(/\s+\S*$/, '') + '…' : desc}</p> : null}
      </div>
      <span className="og-pie">underlegends.pages.dev · únete con el link</span>
      <div className="og-barra"><i /><i /></div>
    </div>
  );
}

// 🎬 LA MINIATURA DEL LINK DE INVITACIÓN, TIPO CINE (18/11/2026). Dlx, de las miniaturas de las páginas: «en general me
// gusta más eso de estilo cine», y de las dos de la invitación (https://claude.ai/artifact/AB6H3Gn4nU7GK8iy12wwPL): «depende
// de si el usuario tiene una carta o no». Con carta va la A (`og-c-a`): su nombre, «te invitó» y la carta a la derecha. Sin
// carta, la B (`og-c-b`): el nombre gigante a lo ancho. Las dos con un momento real de batalla en blanco y negro con grano
// —el lenguaje de la intro y de la pantalla de carga: la marca UL | T1, el sello magenta con su sombra verde, el título
// blanco y magenta—, «Entra ahora y gana un premio» y los números: «más de 40 eventos por semana» (Dlx: «que aparezca que
// hay más de 40 eventos por semana»), los miembros y, en la B, los socios («14 servidores se vuelven 14 socios»).
// Los fondos están en R2 (`og/fondos/<temporada>/invita_a.webp` y `_b`), ya encuadrados con la cara arriba y fuera del texto;
// salen de batallas que ya pasan en la intro. La «4b» de antes (columnas y franjas) quedó en docs/remake/miniatura_invita/.
// ⚠️ «Miembros» son las personas de los servidores donde está el bot (`comunidad.personas`), no gente anotada en la Liga.
//: el diseño de esta miniatura: el mismo `d` que pone bot/og_links.py en la huella. Si la página publicada dice otro, el ciclo
//: no saca la foto (sería la vieja con la huella nueva) y la reintenta en la corrida siguiente
export const DISENO_REF = 'ref-cine-1';
const nro = (x) => Number(x) || 0;
const miles = (x) => String(Math.trunc(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/** El número de «más de N» que es VERDAD: 42 → 40, pero 40 justos → 30. El mismo `_mas_de()` de bot/og_links.py */
const masDe = (n, paso) => (n > 0 ? Math.max(0, Math.floor((n - 1) / paso) * paso) : 0);

/** `{t, m, s}`: los eventos de los últimos 7 días (para «más de», a la decena), las personas de los servidores (al millar)
 *  y los socios. Los manda bot/og_links.py en la ruta (así entran en la huella); sin ellos se calculan acá con la misma
 *  regla que `_vitrina()` */
export function vitrinaRef(d, q) {
  const D = d || {};
  const ahora = Date.now(), desde = ahora - 7 * 864e5;
  const t = q && q.get('t') != null ? nro(q.get('t'))
    : masDe((D.calendario || []).filter((c) => { const x = Date.parse((c && (c.t || c.cuando)) || ''); return x >= desde && x <= ahora; }).length, 10);
  const m = q && q.get('m') != null ? nro(q.get('m')) : masDe(nro(D.comunidad && D.comunidad.personas), 1000);
  const s = q && q.get('s') != null ? nro(q.get('s')) : nro(D.comunidad && D.comunidad.servidores);
  return { t, m, s };
}

/** 🔠 EL NOMBRE Y LOS DATOS, DEL TAMAÑO QUE ENTRE EN SU COLUMNA (600 px en la A, que tiene la carta; 1.088 en la B). Se
 *  achican de a 2 px hasta su mínimo (`data-min`); un NOMBRE con espacios pasa a dos renglones antes de bajar de 84 px, y si
 *  ni así entra a 60, «…» (el más largo de la Liga tiene 48 letras). Se mide el TEXTO (un Range), no la caja: la caja de un
 *  hijo de grilla se estira con el más ancho. Con las fuentes ya cargadas: con la de reemplazo las medidas son de otro ancho */
function encajarCine(caja) {
  if (!caja) return;
  const w = caja.getBoundingClientRect().width;
  const rango = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r; };
  const ancho = (el) => rango(el).getBoundingClientRect().width;
  const lineas = (el) => new Set([...rango(el).getClientRects()].map((x) => Math.round(x.top))).size;
  caja.querySelectorAll('[data-px]').forEach((el) => {
    const max = Number(el.dataset.px), min = Number(el.dataset.min || 40);
    const barra = el.classList.contains('og-c-dato') ? 28 : 0;      // la barrita de color y su hueco
    let f = max;
    el.classList.remove('og-c-dos', 'og-c-corto');
    el.style.fontSize = f + 'px';
    while (ancho(el) + barra > w + 1 && f > min) { f -= 2; el.style.fontSize = f + 'px'; }
    if (el.dataset.nombre == null || ancho(el) <= w + 1) return;
    if (/\s/.test(el.textContent.trim())) {
      el.classList.add('og-c-dos');
      f = Math.min(max, Math.round(f * 1.5));
      el.style.fontSize = f + 'px';
      while ((ancho(el) > w + 1 || lineas(el) > 2) && f > 60) { f -= 2; el.style.fontSize = f + 'px'; }
      if (ancho(el) <= w + 1 && lineas(el) <= 2) return;
      el.classList.remove('og-c-dos');
    }
    el.classList.add('og-c-corto');
    el.style.fontSize = '60px';
  });
}

function Ref({ liga, k }) {
  const [ok, setOk] = useState(false);
  const [mala, setMala] = useState(false);
  const [fondo, setFondo] = useState('');
  const [ul, setUl] = useState(false);
  const [medido, setMedido] = useState('');
  const txt = useRef(null);
  const q = deLaRuta();
  const f = liga && ((liga.T && liga.T[k]) || (liga.X && liga.X[k]));
  const nombre = limpio(q.get('n') || (f && f.n) || k);
  const carta = f && ORDEN_CARTA.find((x) => (f.c || []).includes(x));
  const deRuta = R2.test(q.get('c') || '') ? q.get('c') : '';
  const src = deRuta || (carta && liga.d && liga.d.r2 ? liga.d.r2 + '/' + encodeURIComponent(k) + '/' + carta + '.webp' : '');
  const V = vitrinaRef(liga && liga.d, q);
  // 🃏 Dlx: «depende de si tiene carta». Si la carta no carga, también va la B: mejor el nombre gigante que un hueco
  const conCarta = !!src && !mala;
  const D = (liga && liga.d) || {};
  const bg = D.r2 ? D.r2 + '/og/fondos/' + String(D.temporada || 't1').toLowerCase() + '/invita_' + (conCarta ? 'a' : 'b') + '.webp' : '';
  const clave = [nombre, conCarta ? 'a' : 'b', V.t, V.m, V.s].join('|');
  useLayoutEffect(() => {
    let vivo = true;
    const medir = () => { if (vivo) { encajarCine(txt.current); setMedido(clave); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir); else medir();
    return () => { vivo = false; };
  }, [clave]);
  const listo = !!(liga && liga.d && bg && fondo === bg && ul && medido === clave && (!src || ok));
  return (
    <div className={'og og-c ' + (conCarta ? 'og-c-a' : 'og-c-b')} data-d={DISENO_REF} data-listo={listo ? '1' : ''}>
      {bg ? <img key={bg} className="og-c-bg" src={bg} alt="" onLoad={() => setFondo(bg)} onError={() => setFondo(bg)} /> : null}
      <i className="og-c-velo" />
      <i className="og-c-vineta" />
      {conCarta ? <img className="og-c-carta" src={src} alt="" onLoad={() => setOk(true)} onError={() => { setMala(true); setOk(true); }} /> : null}
      <span className="og-c-marca">
        <img src="/ul-blanco.png" alt="Under Legends" onLoad={() => setUl(true)} onError={() => setUl(true)} /><i /><b>{liga && liga.temp}</b>
      </span>
      <div className="og-c-txt" ref={txt}>
        <span className="og-c-sello">Invitación</span>
        <span className="og-c-t">
          <span className="og-c-t1" data-px={conCarta ? 130 : 150} data-min="84" data-nombre="">{conCarta ? nombre : '¡' + nombre}</span>
          <span className="og-c-t2" data-px={conCarta ? 70 : 72} data-min="40">{conCarta ? 'te invitó' : 'te invitó a la Liga!'}</span>
        </span>
        <span className="og-c-dato" data-px="46" data-min="40">Entra ahora y gana un premio</span>
        <span className="og-c-dato og-c-d2" data-px="46" data-min="40">{V.t >= 10 ? 'Más de ' + V.t + ' eventos por semana' : 'Eventos todas las semanas'}</span>
        {V.m >= 1000 ? (
          <span className="og-c-dato og-c-d2" data-px="46" data-min="40">{'Más de ' + miles(V.m) + ' miembros' + (!conCarta && V.s ? ' · ' + V.s + ' socios' : '')}</span>
        ) : null}
      </div>
      {/* el grano de la intro (bienvenida.css, `.bv-grano`) */}
      <svg className="og-c-grano" aria-hidden="true">
        <filter id="og-c-gr"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#og-c-gr)" />
      </svg>
    </div>
  );
}

// 🖼️ EL CARTEL DEL LINK DE TU PERFIL (#/og/perfil/<clave>, 17/11/2026, la tanda 2 de Tu cuenta). Dlx, de la vista previa
// del link: «debería ser prebuilded». Hasta hoy el link de un perfil mostraba la carta sola; ahora es un cartel de 1200 ×
// 630 con lo que eligió para «Tu perfil» en Tus fondos (sin elegir: su servidor o su bandera), su carta y su nombre
const primerUrl = (bg) => { const m = /url\("([^"]+)"\)/.exec(bg || ''); return m ? m[1] : ''; };
function Perfil({ liga, k }) {
  const fondos = useFondos();
  const [listas, setListas] = useState(0);
  const f = liga && ((liga.T && liga.T[k]) || (liga.X && liga.X[k]));
  if (!liga || !liga.d || !fondos) return <div className="og" />;
  if (!f) return <div className="og" data-listo="1" data-falta="1" />;
  const nombre = limpio(f.n || k);
  const carta = ORDEN_CARTA.find((x) => (f.c || []).includes(x));
  const i = carta ? (liga.d.cartas || []).indexOf(carta) : -1;
  const v = carta && typeof f.cv === 'string' && i >= 0 ? f.cv.split('.')[i] : '';
  const src = carta && liga.d.r2 ? liga.d.r2 + '/' + encodeURIComponent(k) + '/' + carta + '.webp' + (v ? '?v=' + v : '') : '';
  const q = { cc: f.cc, sv: f.sv };
  const fo = fondos[k];
  const bg = primerUrl(fondoEn(fo, 'perfil', q)) || primerUrl(fondoOpcion(fo, 'servidor', q)) || primerUrl(fondoOpcion(fo, 'bandera', q));
  const faltan = (src ? 1 : 0) + (bg ? 1 : 0);
  const sv = f.sv && liga.svs && liga.svs[f.sv];
  const rgc = /^#[0-9a-f]{3,8}$/i.test(f.rgc || '') ? f.rgc : '#29B298';
  const listo = () => setListas((n) => n + 1);
  return (
    <div className={'og og-pf' + (src ? ' con' : '')} data-listo={listas >= faltan ? '1' : ''}>
      {bg ? <img className="og-pf-f" src={bg} alt="" onLoad={listo} onError={listo} /> : null}
      <div className="og-pf-velo" />
      <div className="og-der">
        <span className="og-k">Liga Global de Freestyle</span>
        <Nombre texto={nombre} />
        <div className="og-fila">
          {f.cc ? <span className="og-pf-pais"><Bandera cc={f.cc} cls="og-pf-flag" />{nombrePais(f.cc)}</span> : null}
          {sv ? <span>{f.cc ? '· ' : ''}{limpio(sv.nombre || f.sv)}</span> : null}
        </div>
        <div className="og-fila">
          {f.pos ? <span className="og-pill og-pf-pos">#{f.pos} de la {String(liga.temp || 'T1').toUpperCase()}</span> : null}
          {f.ovr ? <b>OVR {f.ovr}</b> : null}
          {f.rg ? <span className="og-pill" style={{ background: rgc, color: '#030304' }}>Rango {f.rg}</span> : null}
        </div>
        <span className="og-url">underlegends.pages.dev</span>
      </div>
      {src ? <img className="og-carta" src={src} alt="" onLoad={listo} onError={listo} /> : null}
      <div className="og-barra"><i /><i /></div>
    </div>
  );
}

export function OgLink({ liga, tipo, id }) {
  return tipo === 'crew' ? <Crew id={id} /> : tipo === 'ref' ? <Ref liga={liga} k={id} /> : tipo === 'perfil' ? <Perfil liga={liga} k={id} />
    : <div className="og" data-listo="1" data-falta="1" />;
}
