// Instalar la página como app, paso a paso y con un dibujo por paso. Dlx, 01/10/2026, con la captura de la parte de
// Ajustes: «sé más específico, e incluso si puedes crea y saca imágenes o genera imágenes que reflejen cada paso».
//
// ⚠️ SON DIBUJOS Y NO CAPTURAS, a propósito: el menú de Chrome y el de Safari no son parte de la página —no se pueden
// fotografiar desde acá— y cambian con cada versión. Por eso en cada pantalla se escribe SÓLO lo que hay que tocar
// («Instalar app», «Compartir», «Agregar a inicio») y lo demás son barras grises: un menú dibujado entero envejece
// con la primera actualización, y un renglón gris no miente nunca.
//
// ⚠️ Los nombres de los botones van como los muestran Chrome y Safari en español de América. Donde cambian según el
// teléfono o la versión, el texto del paso lo dice («en algunos teléfonos dice…»).
import { useEffect, useId, useState } from 'react';

const ICONO = '/ul-192.png';
const W = typeof window !== 'undefined' ? window : {};

// ── las piezas de cada pantalla ──────────────────────────────────────────────────────────────────
// el teléfono, cortado: arriba (Chrome tiene la barra arriba) o abajo (Safari la tiene abajo)
const yTel = (abajo) => (abajo ? -56 : 6);
const Marco = ({ abajo }) => <rect className="pi-tel" x="14" y={yTel(abajo)} width="132" height="200" rx="20" />;
const Borde = ({ abajo }) => <rect className="pi-borde" x="14" y={yTel(abajo)} width="132" height="200" rx="20" />;
const Velo = ({ abajo }) => <rect className="pi-velo" x="14" y={yTel(abajo)} width="132" height="200" rx="20" />;
const Estado = () => (<><rect className="pi-g" x="28" y="15" width="14" height="3.5" rx="1.75" />
  <rect className="pi-g" x="114" y="15" width="18" height="3.5" rx="1.75" /></>);
const Url = ({ x, y, w, t = 6 }) => (<><rect className="pi-g" x={x} y={y} width={w} height="18" rx="9" />
  <text className="pi-url" style={{ fontSize: t }} x={x + w / 2} y={y + 11.5} textAnchor="middle">underlegends.pages.dev</text></>);
// la página de la Liga, simplificada: la cabecera negra con el logo, y renglones
function Pagina({ y = 54 }) {
  return (
    <>
      <rect x="22" y={y} width="116" height="26" fill="#030304" />
      <image href={ICONO} x="26" y={y + 3} width="20" height="20" />
      <rect x="51" y={y + 8} width="52" height="4.5" fill="#F6F6F6" />
      <rect x="51" y={y + 16} width="34" height="3" fill="#29B298" />
      {[110, 84, 100, 72, 96].map((w, i) => <rect key={i} className="pi-g" x="22" y={y + 34 + i * 12} width={w} height="6" rx="3" />)}
    </>
  );
}
// el ícono de la app, con las esquinas redondas de un ícono
function Icono({ x, y, s }) {
  const id = 'pi' + useId().replace(/[^a-z0-9]/gi, '');
  return (
    <>
      <clipPath id={id}><rect x={x} y={y} width={s} height={s} rx={s * 0.24} /></clipPath>
      <image href={ICONO} x={x} y={y} width={s} height={s} clipPath={'url(#' + id + ')'} />
    </>
  );
}
const Anillo = (p) => <rect className="pi-anillo" rx="8" {...p} />;
const Puntos = () => [31, 36.5, 42].map((cy) => <circle key={cy} className="pi-t" cx="134" cy={cy} r="1.9" />);
function Chrome() {
  return (<><Marco /><Estado /><Url x={24} y={27.5} w={98} /><Puntos /><Pagina /></>);
}
function Safari({ anillo }) {
  return (
    <>
      <Marco abajo /><Pagina y={-4} />
      <circle className="pi-g" cx="32" cy="114" r="11" />
      <path className="pi-trazo" d="M34.5 109l-5 5 5 5" />
      <Url x={48} y={105} w={68} t={5.2} />
      <circle className="pi-g" cx="130" cy="114" r="11" />
      {[125, 130, 135].map((cx) => <circle key={cx} className="pi-t" cx={cx} cy="114" r="1.7" />)}
      {anillo ? <circle className="pi-anillo" cx="130" cy="114" r="14.5" /> : null}
      <rect className="pi-t" x="62" y="136" width="36" height="3" rx="1.5" />
    </>
  );
}
const Svg = ({ children }) => <svg className="pi-svg" viewBox="0 0 160 150" aria-hidden="true">{children}</svg>;

// ── Android, con Chrome ──────────────────────────────────────────────────────────────────────────
function A1() {
  return <Svg><Chrome /><circle className="pi-anillo" cx="134" cy="36.5" r="11" /><Borde /></Svg>;
}
function A2() {
  return (
    <Svg>
      <Chrome />
      <rect className="pi-menu" x="52" y="22" width="90" height="126" rx="6" />
      {[0, 1, 2, 3].map((i) => <rect key={i} className="pi-g" x={61 + i * 20} y="30" width="9" height="9" rx="2" />)}
      {[50, 64, 78].map((y) => <rect key={y} className="pi-g" x="61" y={y} width="58" height="5" rx="2.5" />)}
      <path className="pi-trazo" d="M64 92.5v6.5m-2.8-2.8 2.8 2.8 2.8-2.8M60.5 102h7" />
      <text className="pi-tx" x="72" y="100.5">Instalar app</text>
      <Anillo x="56" y="88" width="82" height="17" />
      {[114, 128].map((y) => <rect key={y} className="pi-g" x="61" y={y} width={y === 114 ? 48 : 62} height="5" rx="2.5" />)}
      <Borde />
    </Svg>
  );
}
function A3() {
  return (
    <Svg>
      <Chrome /><Velo />
      <rect className="pi-caja" x="20" y="40" width="120" height="88" rx="12" />
      <text className="pi-tx pi-tit" x="32" y="57">Instalar app</text>
      <Icono x={32} y={66} s={22} />
      <text className="pi-tx" x="60" y="76">Liga Global</text>
      <text className="pi-url" x="60" y="85">underlegends.pages.dev</text>
      <text className="pi-tx pi-gr" x="40" y="115">Cancelar</text>
      <text className="pi-tx pi-acc" x="93" y="115">Instalar</text>
      <Anillo x="86" y="104" width="50" height="17" />
      <Borde />
    </Svg>
  );
}
// la pantalla de inicio: la Liga entre las apps (el último paso de los dos)
function Listo() {
  const xs = [26, 56, 86, 116], ys = [28, 64, 100];
  return (
    <Svg>
      <Marco />
      <rect className="pi-fondo-ini" x="16" y="8" width="128" height="196" rx="18" />
      <Estado />
      {ys.map((y) => xs.map((x) => (x === 56 && y === 64 ? null : (
        <g key={x + '-' + y}><rect className="pi-app" x={x} y={y} width="18" height="18" rx="5" />
          <rect className="pi-g" x={x + 2} y={y + 22} width="14" height="3" rx="1.5" /></g>))))}
      <Icono x={56} y={64} s={18} />
      <text className="pi-tx pi-chico" x="65" y="90" textAnchor="middle">Liga Global</text>
      <Anillo x="44" y="59" width="42" height="36" />
      <Borde />
    </Svg>
  );
}

// ── iPhone, con Safari ───────────────────────────────────────────────────────────────────────────
function I1() {
  return <Svg><Safari anillo /><Borde abajo /></Svg>;
}
function I2() {
  return (
    <Svg>
      <Safari />
      <rect className="pi-menu" x="56" y="16" width="86" height="80" rx="12" />
      <path className="pi-trazo" d="M64.5 30v6.5h9V30M69 21.5v9M66.3 24.2 69 21.5l2.7 2.7" />
      <text className="pi-tx" x="80" y="33">Compartir</text>
      <Anillo x="59" y="20" width="80" height="18" />
      {[50, 64, 78].map((y) => <rect key={y} className="pi-g" x="64" y={y} width={[54, 44, 60][(y - 50) / 14]} height="5" rx="2.5" />)}
      <Borde abajo />
    </Svg>
  );
}
function I3() {
  return (
    <Svg>
      <Safari /><Velo abajo />
      <rect className="pi-caja" x="18" y="12" width="124" height="126" rx="14" />
      {[38, 62, 86, 110].map((cx) => <circle key={cx} className="pi-g" cx={cx} cy="30" r="8.5" />)}
      {[52, 70].map((y) => <g key={y}><rect className="pi-g" x="28" y={y} width={y === 52 ? 50 : 62} height="5" rx="2.5" />
        <rect className="pi-g" x="118" y={y - 2.5} width="10" height="10" rx="2" /></g>)}
      <text className="pi-tx" x="28" y="94">Agregar a inicio</text>
      <rect className="pi-trazo" x="117" y="85.5" width="11" height="11" rx="2.5" />
      <path className="pi-trazo" d="M122.5 88v6M119.5 91h6" />
      <Anillo x="23" y="81" width="114" height="18" />
      {[108, 124].map((y) => <g key={y}><rect className="pi-g" x="28" y={y} width={y === 108 ? 56 : 44} height="5" rx="2.5" />
        <rect className="pi-g" x="118" y={y - 2.5} width="10" height="10" rx="2" /></g>)}
      <Borde abajo />
    </Svg>
  );
}
function I4() {
  return (
    <Svg>
      <Marco /><Estado />
      <rect className="pi-caja" x="16" y="24" width="128" height="180" rx="12" />
      <text className="pi-tx pi-gr" x="24" y="41">Cancelar</text>
      <text className="pi-tx pi-acc" x="96" y="41">Agregar</text>
      <Anillo x="89" y="30" width="50" height="17" />
      <Icono x={26} y={58} s={26} />
      <rect className="pi-g" x="58" y="58" width="78" height="15" rx="3" />
      <text className="pi-tx" x="62" y="68.5">Liga Global</text>
      <text className="pi-url" x="58" y="82">underlegends.pages.dev</text>
      <rect className="pi-g" x="24" y="96" width="112" height="22" rx="6" />
      <text className="pi-tx pi-med" x="30" y="109.5">Abrir como app web</text>
      <rect className="pi-sw" x="112" y="101" width="20" height="12" rx="6" />
      <circle cx="126" cy="107" r="4.6" fill="#FFFFFF" />
      <Borde />
    </Svg>
  );
}

const PASOS = {
  android: [
    [A1, <>Abrí <b>underlegends.pages.dev</b> en <b>Chrome</b> y tocá los <b>tres puntos ⋮</b>, arriba a la derecha.</>],
    [A2, <>Tocá <b>«Instalar app»</b>. En algunos teléfonos dice <b>«Agregar a la pantalla principal»</b>.</>],
    [A3, <>Confirmá con <b>«Instalar»</b>.</>],
    [Listo, <>Listo: la Liga queda en tu <b>pantalla de inicio</b>. Se abre desde ahí, como cualquier app.</>],
  ],
  ios: [
    [I1, <>Abrí <b>underlegends.pages.dev</b> en <b>Safari</b> y tocá <b>«•••»</b>, abajo a la derecha. Si no lo ves, tocá directo el botón <b>Compartir</b> (un cuadrado con una flecha) y seguí en el paso 3.</>],
    [I2, <>Tocá <b>«Compartir»</b>.</>],
    [I3, <>Bajá en la lista y tocá <b>«Agregar a inicio»</b>.</>],
    [I4, <>Si aparece <b>«Abrir como app web»</b>, dejalo prendido. Tocá <b>«Agregar»</b>.</>],
    [Listo, <>Abrila desde el <b>ícono nuevo</b>: en el iPhone, así es como se pueden activar los avisos de eventos.</>],
  ],
};

export function esIphone() {
  const n = W.navigator || {};
  return /iphone|ipad|ipod/i.test(n.userAgent || '') || (n.platform === 'MacIntel' && n.maxTouchPoints > 1);
}

export function PasosInstalar() {
  const [cual, setCual] = useState(() => (esIphone() ? 'ios' : 'android'));
  const [ev, setEv] = useState(() => W.__instalar || null);
  useEffect(() => {
    const f = () => setEv(W.__instalar || null);
    W.addEventListener('lg:instalar', f);
    return () => W.removeEventListener('lg:instalar', f);
  }, []);
  const app = !!(W.matchMedia && W.matchMedia('(display-mode: standalone)').matches) || (W.navigator || {}).standalone === true;
  const instalar = async () => {
    const e = ev;
    W.__instalar = null;
    setEv(null);
    try { e.prompt(); await e.userChoice; } catch (err) { /* el navegador no quiso */ }
  };
  if (app) return <p className="cu-d">Ya la estás usando como app ✅</p>;
  return (
    <>
      {ev ? (
        <div className="pi-ya">
          <span><b>Tu teléfono la instala de un toque.</b><small>Si preferís hacerlo a mano, abajo están los pasos.</small></span>
          <button type="button" className="btn verde chico" onClick={instalar}>Instalar</button>
        </div>
      ) : null}
      <div className="x-seg cu-seg pi-cual" role="group" aria-label="Tu teléfono">
        {[['android', 'Android'], ['ios', 'iPhone']].map(([v, n]) => (
          <button type="button" key={v} aria-pressed={cual === v} onClick={() => setCual(v)}>{n}</button>
        ))}
      </div>
      <ol className="pi-pasos" aria-label={cual === 'ios' ? 'En el iPhone, con Safari' : 'En Android, con Chrome'}>
        {PASOS[cual].map(([Dibujo, texto], i) => (
          <li className="pi-paso" key={cual + i}>
            <div className="pi-fig"><span className="pi-n" aria-hidden="true">{i + 1}</span><Dibujo /></div>
            <p>{texto}</p>
          </li>
        ))}
      </ol>
      {cual === 'android' ? <p className="cu-nota">¿Usás Samsung Internet? Menú <b>≡</b> → <b>«Agregar página a»</b> → <b>«Pantalla de inicio»</b>.</p> : null}
    </>
  );
}
