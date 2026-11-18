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
//: el diseño de esta miniatura: el mismo `d` que pone bot/og_links.py en la huella. Si la página publicada dice otro, el ciclo
//: no saca la foto (sería la vieja con la huella nueva) y la reintenta en la corrida siguiente
export const DISENO_REF = 'ref-4b-mas';
const SIN_PAIS = new Set(['ae', 'br', 'no']);
const BANDERAS = 11;                                      // y la 12.ª casilla es la del «+N»              // Dlx, 22/09: Emiratos y Brasil «no se les toma en cuenta»
const nro = (x) => Number(x) || 0;
const miles = (x) => String(Math.trunc(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** `{t, m, b, p}`: torneos de los últimos 7 días (para abajo a la decena), personas en los servidores (al millar), los 11
 *  países con más raperos y cuántos hay en total (el «+N» de la banderita del final: Dlx, 18/11/2026, «una banderita con un
 *  más, o sea que hay más países, no sólo esos»). La misma regla que `_vitrina()` de bot/og_links.py */
export function vitrinaRef(d, q) {
  const D = d || {};
  const ahora = Date.now(), desde = ahora - 7 * 864e5;
  const t = q && q.get('t') != null ? nro(q.get('t'))
    : Math.floor((D.calendario || []).filter((c) => { const x = Date.parse((c && (c.t || c.cuando)) || ''); return x >= desde && x <= ahora; }).length / 10) * 10;
  const m = q && q.get('m') != null ? nro(q.get('m')) : Math.floor(nro(D.comunidad && D.comunidad.personas) / 1000) * 1000;
  const todos = (D.paises || []).filter((p) => p && p.cc && !SIN_PAIS.has(p.cc)).sort((a, c) => nro(c.n) - nro(a.n));
  const b = q && q.get('b') != null ? String(q.get('b')).split(',').filter((x) => /^[a-z]{2}$/.test(x)).slice(0, BANDERAS)
    : todos.slice(0, BANDERAS).map((p) => p.cc);
  const p = q && q.get('p') != null ? nro(q.get('p')) : todos.length;
  return { t, m, b, p: Math.max(p, b.length) };
}

// 🔠 «¡MAKMAH TE INVITÓ!» EN UNA CABECERA, COMO LA BARRA DE ABAJO (Dlx, 17/11/2026: «o podríamos hacer una cabecera parecida
// a la de abajo que diga X te invitó, centrado»). Antes era una etiqueta en la columna de la carta: la 4b guardada sólo
// entraba con nombres de hasta 3 letras, y achicarla para que entrara le comía lugar a la carta. A lo ancho entra casi
// cualquier nombre: de 42 a 28 px hasta entrar en 1.120 (franja de 64 px desde el 18/11: «sus líneas menos altas»), y si ni
// así (el más largo de la Liga tiene 48 letras), «…».
// Se mide con las fuentes ya cargadas: con la de reemplazo, las medidas salían de otro ancho.
const ANCHO_CAB = 1120;
function anchoTxt(txt, px) {
  const c = anchoTxt.c || (anchoTxt.c = document.createElement('canvas').getContext('2d'));
  c.font = '900 ' + px + 'px Archivo, sans-serif';
  return c.measureText(String(txt).toUpperCase()).width;
}
export function encajeCabecera(nombre, medir = anchoTxt) {
  const t = '¡' + nombre + ' te invitó!';
  for (let px = 42; px >= 28; px -= 1) if (medir(t, px) <= ANCHO_CAB) return px;
  return 28;
}

function Ref({ liga, k }) {
  const [ok, setOk] = useState(false);
  const [mala, setMala] = useState(false);
  const [enc, setEnc] = useState(null);
  const [banderas, setBanderas] = useState(0);
  const [ul, setUl] = useState(false);
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
    const medir = () => { if (vivo) setEnc(encajeCabecera(nombre)); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir); else medir();
    return () => { vivo = false; };
  }, [nombre]);
  const listo = liga && liga.d && enc && ul && (!src || ok) && banderas >= V.b.length;
  const una = (n) => () => setBanderas((x) => x + n);
  return (
    <div className="og og-r4" data-d={DISENO_REF} data-listo={listo ? '1' : ''}>
      <div className="og-r4-cab"><span style={enc ? { fontSize: enc + 'px' } : null}>¡<b>{nombre}</b> te invitó!</span></div>
      <div className="og-r4-izq">
        {src && !mala ? <span className="og-r4-carta"><img src={src} alt="" onLoad={() => setOk(true)} onError={() => { setMala(true); setOk(true); }} /></span> : null}
      </div>
      <div className="og-r4-med">
        {V.t >= 10 ? <><b className="og-r4-num">+{V.t}</b><span className="og-r4-bc og-r4-tor">torneos<br />por semana</span></>
          : <span className="og-r4-bc og-r4-tor">torneos<br />todas las<br />semanas</span>}
        <span className="og-r4-bc og-r4-caja">Todos los niveles</span>
      </div>
      <div className="og-r4-der">
        {V.b.length ? (
          <span className="og-r4-flags">
            {V.b.map((cc) => <img key={cc} src={'/banderas/g/' + cc + '.webp'} alt="" onLoad={una(1)} onError={una(1)} />)}
            {V.p > V.b.length ? <span className="og-r4-mas">+{V.p - V.b.length}</span> : null}
          </span>
        ) : null}
        {V.m >= 1000 ? (
          <span className="og-r4-miem"><span className="og-r4-bc">Más de</span><b>{miles(V.m)}</b><span className="og-r4-bc og-r4-m">miembros</span></span>
        ) : null}
      </div>
      {/* Dlx, 17/11/2026: «entra ahora y gana un premio, y abajo a los costados la temporada y el logo de UL en negrito»; «el T1, no temporada 1» */}
      <div className="og-r4-barra">
        <span className="og-r4-temp">{liga && liga.temp}</span>
        <span className="og-r4-cta">Entra ahora y gana un premio</span>
        <img className="og-r4-ul" src="/ul-blanco.png" alt="Under Legends" onLoad={() => setUl(true)} onError={() => setUl(true)} />
      </div>
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
