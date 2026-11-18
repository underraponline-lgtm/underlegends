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

// 🎁 LA MINIATURA DEL LINK DE INVITACIÓN, LA «4b» (17/11/2026). Dlx eligió, de ocho ganchos y cinco versiones hechas con su
// brain, 21st, Taste y la crítica de Impeccable (el lienzo: https://claude.ai/artifact/9EZdEof3J7tLiisKuzXspF, guardada en
// docs/remake/miniatura_invita/): «me gusta como se ve ahora… guarda este preset», «más de 21000 miembros», la barra de
// abajo con «entra ahora y gana una recompensa» y «quita liga global de freestyle, eso estará en el link».
// Tres columnas y una barra: quien invita y su carta · «+40 torneos por semana» y «todos los niveles» en magenta · las
// banderas y «más de 21.000 miembros». Los números y las banderas los manda bot/og_links.py en la ruta (`t`, `m`, `b`),
// así la huella sabe cuándo rearmar; sin ellos se calculan acá con la misma regla.
// ⚠️ «Miembros» son las personas de los servidores donde está el bot (`comunidad.personas`), no gente anotada en la Liga.
const SIN_PAIS = new Set(['ae', 'br', 'no']);              // Dlx, 22/09: Emiratos y Brasil «no se les toma en cuenta»
const nro = (x) => Number(x) || 0;
const miles = (x) => String(Math.trunc(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** `{t, m, b}`: torneos de los últimos 7 días (para abajo a la decena), personas en los servidores (al millar) y los 12
 *  países con más raperos. La misma regla que `_vitrina()` de bot/og_links.py */
export function vitrinaRef(d, q) {
  const D = d || {};
  const ahora = Date.now(), desde = ahora - 7 * 864e5;
  const t = q && q.get('t') != null ? nro(q.get('t'))
    : Math.floor((D.calendario || []).filter((c) => { const x = Date.parse((c && (c.t || c.cuando)) || ''); return x >= desde && x <= ahora; }).length / 10) * 10;
  const m = q && q.get('m') != null ? nro(q.get('m')) : Math.floor(nro(D.comunidad && D.comunidad.personas) / 1000) * 1000;
  const b = q && q.get('b') != null ? String(q.get('b')).split(',').filter((x) => /^[a-z]{2}$/.test(x)).slice(0, 12)
    : (D.paises || []).filter((p) => p && p.cc && !SIN_PAIS.has(p.cc)).sort((a, c) => nro(c.n) - nro(a.n)).slice(0, 12).map((p) => p.cc);
  return { t, m, b };
}

// 🔠 EL NOMBRE DE QUIEN INVITA: la 4b guardada sólo entraba con nombres de hasta 3 letras («MAKMAH TE INVITA» ya invadía
// el magenta). Medido sobre los nombres de la Liga (mediana 6, el 90 % ≤ 10, el más largo 48): si «NOMBRE TE INVITA» entra
// en una etiqueta a 54 px, va así; si no, el nombre en la suya (de 54 a 44 px), en dos líneas por palabras si hace falta, y
// con «…» si una palabra sola no entra. Nunca menos de 44 px: a 300 px de ancho (el celular) son 11.
const ANCHO_Q = 342;
function anchoTxt(txt, px) {
  const c = anchoTxt.c || (anchoTxt.c = document.createElement('canvas').getContext('2d'));
  c.font = '700 ' + px + 'px "Barlow Condensed", sans-serif';
  const T = String(txt).toUpperCase();
  let w = c.measureText(T).width;
  if ('letterSpacing' in c) { c.letterSpacing = '2px'; w = c.measureText(T).width; c.letterSpacing = '0px'; } else w += 2 * T.length;
  return w + 32;                                           // el relleno de la etiqueta
}
export function encajeNombre(nombre, medir = anchoTxt) {
  if (medir(nombre + ' te invita', 54) <= ANCHO_Q) return { una: true, px: 54 };
  for (let px = 54; px >= 44; px -= 1) if (medir(nombre, px) <= ANCHO_Q) return { una: false, px, dos: false };
  return { una: false, px: 44, dos: /\s/.test(nombre.trim()) };
}

function Ref({ liga, k }) {
  const [ok, setOk] = useState(false);
  const [mala, setMala] = useState(false);
  const [enc, setEnc] = useState(null);
  const [banderas, setBanderas] = useState(0);
  const q = deLaRuta();
  const f = liga && ((liga.T && liga.T[k]) || (liga.X && liga.X[k]));
  const nombre = limpio(q.get('n') || (f && f.n) || k);
  const carta = f && ORDEN_CARTA.find((x) => (f.c || []).includes(x));
  const deRuta = R2.test(q.get('c') || '') ? q.get('c') : '';
  const src = deRuta || (carta && liga.d && liga.d.r2 ? liga.d.r2 + '/' + encodeURIComponent(k) + '/' + carta + '.webp' : '');
  const V = vitrinaRef(liga && liga.d, q);
  // el nombre se mide con las fuentes ya cargadas: con la de reemplazo «DLX TE INVITA» parecía no entrar
  useLayoutEffect(() => {
    let vivo = true;
    const medir = () => { if (vivo) setEnc(encajeNombre(nombre)); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir); else medir();
    return () => { vivo = false; };
  }, [nombre]);
  const listo = liga && liga.d && enc && (!src || ok) && banderas >= V.b.length;
  const una = (n) => () => setBanderas((x) => x + n);
  return (
    <div className="og og-r4" data-listo={listo ? '1' : ''}>
      <div className="og-r4-izq">
        {!enc || enc.una ? <span className="og-r4-tag">{nombre} te invita</span> : (
          <>
            <span className={'og-r4-tag og-r4-nom' + (enc.dos ? ' dos' : '')} style={{ fontSize: enc.px + 'px' }}>{nombre}</span>
            <span className="og-r4-tag">te invita</span>
          </>
        )}
        {src && !mala ? <span className="og-r4-carta"><img src={src} alt="" onLoad={() => setOk(true)} onError={() => { setMala(true); setOk(true); }} /></span> : null}
      </div>
      <div className="og-r4-med">
        {V.t >= 10 ? <><b className="og-r4-num">+{V.t}</b><span className="og-r4-bc og-r4-tor">torneos<br />por semana</span></>
          : <span className="og-r4-bc og-r4-tor">torneos<br />todas las<br />semanas</span>}
        <span className="og-r4-bc og-r4-caja">Todos los niveles</span>
      </div>
      <div className="og-r4-der">
        {V.b.length ? <span className="og-r4-flags">{V.b.map((cc) => <img key={cc} src={'/banderas/g/' + cc + '.webp'} alt="" onLoad={una(1)} onError={una(1)} />)}</span> : null}
        {V.m >= 1000 ? (
          <span className="og-r4-miem"><span className="og-r4-bc">Más de</span><b>{miles(V.m)}</b><span className="og-r4-bc og-r4-m">miembros</span></span>
        ) : null}
      </div>
      <div className="og-r4-barra">Entra ahora y gana una recompensa</div>
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
