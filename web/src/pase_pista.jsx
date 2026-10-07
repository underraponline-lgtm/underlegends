// 🎟️ LA PISTA DEL PASE, DIBUJADA (07/10/2026). Dlx: «yo te dije hacerle un remake para que se vea más gráfico, como
// Brawl Stars, que cada nivel tiene su [premio]… en vez de simples cuadrados que se ve horrible». Cada nivel es una
// carta con su premio dibujado —las monedas de la Tienda, la tarjeta, las tres medallas, el título, el nombre dorado—,
// y abajo la barra que se llena hasta donde vas, con el número de cada nivel en su nodo. Se desliza de costado y abre
// en tu nivel. ✅ Dlx, al verla: «está mejor… ponlo arriba de todo en la parte del fondo negro… y no olvides las
// flechas»: vive en la escena del Pase, debajo del título, con las flechas también en el celular.
import { useEffect, useRef, useState } from 'react';
import { num } from './liga.js';
import { avance } from './pase.js';

const METAL = {
  bronce: ['#F2B27A', '#B8692E', '#6E3A14'],
  plata: ['#FFFFFF', '#C3C9D2', '#7D8591'],
  oro: ['#FFF1A8', '#F5C542', '#B07C0A'],
};
const metalDe = (v) => (/oro/i.test(v) ? 'oro' : /plata/i.test(v) ? 'plata' : 'bronce');

function Monedas({ id }) {
  const g = 'pgm' + id;
  const moneda = (y, k) => (
    <g key={k}>
      <ellipse cx="40" cy={y + 6} rx="22" ry="8" fill="#9A6A08" />
      <rect x="18" y={y} width="44" height="6" fill="#B8820F" />
      <ellipse cx="40" cy={y} rx="22" ry="8" fill={'url(#' + g + ')'} stroke="#8A5C05" strokeWidth="1.2" />
      <ellipse cx="40" cy={y} rx="13" ry="4.4" fill="none" stroke="#FFF3B0" strokeOpacity=".7" strokeWidth="1.4" />
    </g>
  );
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF1A8" /><stop offset=".5" stopColor="#F5C542" /><stop offset="1" stopColor="#C8901A" />
        </linearGradient>
      </defs>
      {[58, 47, 36, 25].map(moneda)}
      <path d="M61 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFF7D1" />
    </svg>
  );
}

function Tarjeta({ id }) {
  const g = 'pgt' + id;
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF4FA3" /><stop offset="1" stopColor="#8E0A47" />
        </linearGradient>
      </defs>
      <g transform="rotate(-9 40 40)">
        <rect x="19" y="8" width="42" height="62" rx="6" fill="#2A0716" transform="translate(4 4)" opacity=".55" />
        <rect x="19" y="8" width="42" height="62" rx="6" fill={'url(#' + g + ')'} stroke="#FFD6E9" strokeWidth="2" />
        <rect x="24" y="13" width="32" height="34" rx="3" fill="#1A0410" opacity=".55" />
        <circle cx="40" cy="27" r="7" fill="#FFD6E9" />
        <path d="M29 47c1-8 6-11 11-11s10 3 11 11z" fill="#FFD6E9" />
        <rect x="24" y="52" width="32" height="5" rx="2" fill="#F5C542" />
        <rect x="28" y="60" width="24" height="3" rx="1.5" fill="#FFD6E9" opacity=".7" />
      </g>
    </svg>
  );
}

function Medalla({ id, metal }) {
  const [a, b, c] = METAL[metal];
  const g = 'pgd' + id;
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <radialGradient id={g} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor={a} /><stop offset=".55" stopColor={b} /><stop offset="1" stopColor={c} />
        </radialGradient>
      </defs>
      <path d="M26 4h12l8 26H34z" fill="#E41373" />
      <path d="M54 4H42l-8 26h12z" fill="#B00E58" />
      <circle cx="40" cy="48" r="23" fill={c} />
      <circle cx="40" cy="46" r="23" fill={'url(#' + g + ')'} />
      <circle cx="40" cy="46" r="17" fill="none" stroke={a} strokeOpacity=".75" strokeWidth="2" />
      <path d="M40 33l3.8 8 8.6 1-6.4 5.9 1.7 8.5L40 52.2l-7.7 4.2 1.7-8.5-6.4-5.9 8.6-1z" fill={c} opacity=".85" />
    </svg>
  );
}

function Titulo({ id }) {
  const g = 'pgr' + id;
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9B7BFF" /><stop offset="1" stopColor="#4B2BB8" />
        </linearGradient>
      </defs>
      <path d="M4 34h14v22H4l6-11z" fill="#3A1F99" />
      <path d="M76 34H62v22h14l-6-11z" fill="#3A1F99" />
      <path d="M14 26h52v28H14z" fill={'url(#' + g + ')'} stroke="#D9CCFF" strokeWidth="2" />
      <path d="M14 54l6 6v-6zM66 54l-6 6v-6z" fill="#24106E" />
      <text x="40" y="46" textAnchor="middle" fill="#FFFFFF" fontFamily="Archivo, sans-serif" fontWeight="900" fontSize="17">« »</text>
    </svg>
  );
}

function Dorado({ id }) {
  const g = 'pgo' + id;
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF1A8" /><stop offset=".5" stopColor="#F5C542" /><stop offset="1" stopColor="#B07C0A" />
        </linearGradient>
      </defs>
      <text x="40" y="54" textAnchor="middle" fill={'url(#' + g + ')'} stroke="#7A5205" strokeWidth="1.2"
        fontFamily="Archivo, sans-serif" fontWeight="900" fontSize="40">Aa</text>
      <path d="M14 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM64 56l1.5 3.5 3.5 1.5-3.5 1.5L64 66l-1.5-3.5L59 61l3.5-1.5z" fill="#FFF7D1" />
    </svg>
  );
}

function Trofeo() {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <linearGradient id="pgtrofeo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF1A8" /><stop offset=".5" stopColor="#F5C542" /><stop offset="1" stopColor="#B07C0A" />
        </linearGradient>
      </defs>
      <path d="M22 14h36v14c0 12-8 20-18 20s-18-8-18-20z" fill="url(#pgtrofeo)" stroke="#8A5C05" strokeWidth="1.5" />
      <path d="M22 18H12c0 10 5 15 12 15M58 18h10c0 10-5 15-12 15" fill="none" stroke="#F5C542" strokeWidth="4" />
      <rect x="35" y="47" width="10" height="10" fill="#C8901A" />
      <rect x="26" y="57" width="28" height="9" rx="2" fill="#E41373" />
      <path d="M40 20l2.6 5.4 5.9.7-4.4 4 1.2 5.8L40 33l-5.3 2.9 1.2-5.8-4.4-4 5.9-.7z" fill="#FFF7D1" />
    </svg>
  );
}

/** Qué dibujar y qué decir de un premio `[nivel, tienda, tipo, valor]` */
function premio(p) {
  const [n, , tipo, valor] = p;
  if (tipo === 'tarjeta') return { arte: <Tarjeta id={n} />, que: 'Tu tarjeta de ' + valor, clase: 'pg-tarjeta' };
  if (tipo === 'insignia') {
    const m = metalDe(valor);
    return { arte: <Medalla id={n} metal={m} />, que: 'Insignia ' + valor, clase: 'pg-' + m };
  }
  if (tipo === 'titulo') return { arte: <Titulo id={n} />, que: 'Título «' + valor + '»', clase: 'pg-titulo' };
  if (tipo === 'color') return { arte: <Dorado id={n} />, que: 'Tu nombre en dorado', clase: 'pg-color' };
  return { arte: <Monedas id={n} />, que: null, clase: 'pg-monedas' };
}

export function PistaGrafica({ P, cfg }) {
  const ps = cfg.premios || [];
  const caja = useRef(null);
  const miembro = !!(P && P.miembro);
  const n = (miembro && P.nivel) || 0;
  const u = cfg.umbrales || [];
  const av = miembro ? avance(P) : null;
  const donde = miembro ? n + (n >= ps.length ? 0.5 : av ? av.lleva / av.de : 0) : 0;
  // abre en tu nivel: el siguiente queda cerca del centro
  // las flechas se apagan en las puntas
  const [puntas, setPuntas] = useState([true, false]);
  const medir = () => {
    const el = caja.current;
    if (el) setPuntas([el.scrollLeft < 4, el.scrollLeft + el.clientWidth > el.scrollWidth - 4]);
  };
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const sig = n ? el.querySelector('.pg-sig') || el.querySelector('.pg-ya:last-of-type') : null;
    if (sig) el.scrollLeft = Math.max(0, sig.offsetLeft - el.clientWidth / 2 + sig.clientWidth / 2);
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [n, ps.length]);
  if (!ps.length) return null;
  // de a casi una pantalla, y siempre de a cartas enteras (el scroll-snap la acomoda)
  const mover = (k) => { const el = caja.current; if (el) el.scrollBy({ left: k * Math.max(120, el.clientWidth * 0.8), behavior: 'smooth' }); };
  const ult = ps.length;
  return (
    <div className="pg">
      <div className="pg-cab">
        <span className="pg-tag">{miembro ? 'VAS EN EL NIVEL ' + n + ' DE ' + ult : 'LOS ' + ult + ' NIVELES Y SUS PREMIOS'}</span>
        <div className="pg-flechas">
          <button type="button" onClick={() => mover(-1)} disabled={puntas[0]} aria-label="Niveles anteriores">‹</button>
          <button type="button" onClick={() => mover(1)} disabled={puntas[1]} aria-label="Niveles siguientes">›</button>
        </div>
      </div>
      <ol className="pg-pista" ref={caja} onScroll={medir} aria-label="Los niveles del Pase y lo que da cada uno">
        {ps.map((p) => {
          const k = p[0];
          const ya = miembro && k <= n;
          const sig = miembro && k === n + 1;
          const { arte, que, clase } = premio(p);
          // la barra va de nodo a nodo: cada tramo cubre de medio nivel antes a medio después, así que se llena hasta
          // `n + lo que llevás del siguiente`, medido desde el centro
          const lleno = Math.round(Math.max(0, Math.min(1, donde - k + 0.5)) * 100);
          return (
            <li key={k} className={['pg-n', clase, que ? 'pg-esp' : '', ya ? 'pg-ya' : '', sig ? 'pg-sig' : '',
              miembro && !ya && !sig ? 'pg-no' : ''].join(' ').replace(/\s+/g, ' ').trim()}>
              <div className="pg-carta">
                {sig ? <span className="pg-cinta">SIGUIENTE</span> : null}
                {ya ? <span className="pg-check" aria-label="ganado">✓</span> : null}
                <div className="pg-arte">{arte}</div>
                <div className="pg-texto">
                  {que ? <b>{que}</b> : null}
                  <span className="pg-tienda"><i aria-hidden="true" />+{num(p[1])}</span>
                </div>
              </div>
              <div className="pg-riel"><i style={{ width: lleno + '%' }} /><span className="pg-nodo">{k}</span></div>
              {u[k - 1] ? <small className="pg-xp">{num(u[k - 1])} XP</small> : null}
            </li>
          );
        })}
        <li className="pg-n pg-salon">
          <div className="pg-carta">
            <div className="pg-arte"><Trofeo /></div>
            <div className="pg-texto"><b>Salón del Pase</b><span className="pg-tienda">para siempre</span></div>
          </div>
          <div className="pg-riel"><span className="pg-nodo">★</span></div>
        </li>
      </ol>
      {cfg.cola ? <p className="pg-nota">Después del {ult}: cada {num(cfg.cola[0])} XP que sumes, {num(cfg.cola[1])} Puntos de Tienda más.</p> : null}
    </div>
  );
}
