// 🎁 LOS PREMIOS DEL PASE COMO OBJETOS (15/11/2026). Dlx, a la maqueta del Pase nuevo: «remakear cómo se ve la pista y
// cómo objeto se ve», y a la v2, «intenta mejorarlo un poco más, quizás los iconos, y también que algunos sean
// animados» → «Sí, todo». Son pegatinas: cada uno se dibuja dos veces, la silueta blanca gruesa (el borde de la
// pegatina) y encima el objeto con contorno oscuro y luces y sombras planas, sin degradés. Se leen de lejos y antes
// que el texto: monedas son Puntos de Tienda, el huevo es un Dragón Drop, el cofre es la Caja del Campeón.
//
// La animación la pone quien lo usa (`an`): el escenario anima lo que sigue siempre y el drop, la caja y el brillo
// siempre que se vean; lo que tiene candado, nunca. Con «menos movimiento», nada (ver `.po-*` en css/pase.css).
const D = '#030304';

function Peg({ sil, children }) {
  return (
    <>
      <g fill="#F6F6F6" stroke="#F6F6F6" strokeWidth="14" strokeLinejoin="round">{sil}</g>
      <g stroke={D} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">{children}</g>
    </>
  );
}

const HUEVO = 'M64 10c23 0 40 31 40 58 0 27-18 46-40 46S24 95 24 68c0-27 17-58 40-58z';
const ESTRELLA = 'M64 38l7.5 15.5 17 2.5-12.3 12 3 17L64 77l-15.2 8 3-17L39.5 56l17-2.5z';
const BRILLO = 'M64 6l11 42 43 16-43 11-11 47-11-47-43-11 43-16z';
const BRILLO_CH = 'M104 10l3 10 10 3-10 3-3 10-3-10-10-3 10-3z';

const DIBUJOS = {
  pdt: (
    <Peg sil={<><ellipse cx="64" cy="96" rx="36" ry="12" /><rect x="28" y="34" width="72" height="62" /><ellipse cx="64" cy="34" rx="36" ry="12" /></>}>
      <ellipse cx="64" cy="96" rx="36" ry="12" fill="#8a6a10" />
      <rect x="28" y="76" width="72" height="20" fill="#C9961A" stroke="none" /><path d="M28 76v20M100 76v20" fill="none" />
      <ellipse cx="64" cy="76" rx="36" ry="12" fill="#E8B830" />
      <rect x="28" y="54" width="72" height="22" fill="#C9961A" stroke="none" /><path d="M28 54v22M100 54v22" fill="none" />
      <ellipse cx="64" cy="54" rx="36" ry="12" fill="#F5C542" />
      <rect x="28" y="34" width="72" height="20" fill="#C9961A" stroke="none" /><path d="M28 34v20M100 34v20" fill="none" />
      <ellipse cx="64" cy="34" rx="36" ry="12" fill="#FFE38A" /><ellipse cx="64" cy="34" rx="22" ry="6.5" fill="#F5C542" />
      <path d="M38 60v10M38 82v8" stroke="#FFF3C4" strokeWidth="5" />
    </Peg>
  ),
  insignia: (c) => (
    <Peg sil={<path d="M64 10l42 15v32c0 28-18 47-42 60C40 104 22 85 22 57V25z" />}>
      <path d="M64 10l42 15v32c0 28-18 47-42 60C40 104 22 85 22 57V25z" fill={c[0]} />
      <path d="M64 22l31 11v24c0 21-13 36-31 46-18-10-31-25-31-46V33z" fill={c[1]} />
      <path d={ESTRELLA} fill={c[2]} /><path d="M30 30l10-4" stroke={c[2]} strokeWidth="5" />
    </Peg>
  ),
  titulo: (
    <Peg sil={<path d="M6 44h24v-8h68v8h24l-8 18 8 18H98v8H30v-8H6l8-18z" />}>
      <path d="M6 46h22v36H6l8-18z" fill="#1d6e5f" /><path d="M122 46h-22v36h22l-8-18z" fill="#1d6e5f" />
      <rect x="22" y="36" width="84" height="52" fill="#29B298" /><rect x="30" y="44" width="68" height="36" fill="#0b211d" />
      <path d="M40 58h48M46 68h36" stroke="#29B298" strokeWidth="5" /><path d="M28 42h22" stroke="#9FE8D8" strokeWidth="4" />
    </Peg>
  ),
  carta: (
    <Peg sil={<rect x="30" y="8" width="68" height="104" rx="6" transform="rotate(-7 64 60)" />}>
      <g transform="rotate(-7 64 60)">
        <rect x="30" y="8" width="68" height="104" rx="6" fill="#F5C542" /><rect x="37" y="15" width="54" height="90" rx="3" fill="#1a1405" />
        <path d="M45 30h14v22H45z" fill="#F5C542" stroke="none" /><circle cx="78" cy="38" r="8" fill="#E41373" />
        <path d="M44 82h40" stroke="#F5C542" strokeWidth="5" /><path d="M44 92h26" stroke="#8a6a10" strokeWidth="5" />
      </g>
    </Peg>
  ),
  drop: (
    <Peg sil={<path d={HUEVO} />}>
      <path d={HUEVO} fill="#E41373" /><path d="M64 22c10 2 20 14 25 30" fill="none" stroke="#FF8FC2" strokeWidth="6" />
      <path d="M42 64l11 8-6 12M86 58l-9 12 10 9" fill="none" stroke="#5b0830" strokeWidth="5" />
      <path d="M40 92c8 10 30 12 46 0" fill="none" stroke="#9e0c50" strokeWidth="5" />
    </Peg>
  ),
  star: (
    <Peg sil={<path d={HUEVO} />}>
      <path d={HUEVO} fill="#3aa6e0" /><path d="M64 22c10 2 20 14 25 30" fill="none" stroke="#BFE9FF" strokeWidth="6" />
      <path d="M64 42l7.5 15.5 17 2.5-12.3 12 3 17L64 81l-15.2 8 3-17L39.5 60l17-2.5z" fill="#E8F7FF" />
    </Peg>
  ),
  caja: (
    <Peg sil={<path d="M14 56c0-24 22-38 50-38s50 14 50 38v54H14z" />}>
      <rect x="14" y="56" width="100" height="54" fill="#B8860B" /><path d="M14 56c0-24 22-38 50-38s50 14 50 38z" fill="#F5C542" />
      <rect x="34" y="20" width="10" height="90" fill="#7a5a08" /><rect x="84" y="20" width="10" height="90" fill="#7a5a08" />
      <rect x="54" y="48" width="20" height="26" fill="#3d2a03" /><rect x="60" y="56" width="8" height="10" fill="#FFE38A" stroke="none" />
      <path d="M22 44c4-10 14-16 24-18" fill="none" stroke="#FFF3C4" strokeWidth="5" />
    </Peg>
  ),
  color: (
    <Peg sil={<><rect x="40" y="36" width="44" height="78" rx="8" /><rect x="50" y="14" width="24" height="24" /><circle cx="98" cy="22" r="10" /></>}>
      <rect x="40" y="36" width="44" height="78" rx="8" fill="#E41373" /><rect x="40" y="58" width="44" height="26" fill="#F6F6F6" />
      <rect x="52" y="24" width="20" height="14" fill="#9AA4B2" /><rect x="56" y="14" width="12" height="10" fill="#C9C9C4" />
      <path d="M48 44v8" stroke="#FF8FC2" strokeWidth="5" />
      <circle cx="92" cy="20" r="5" fill="#F5C542" /><circle cx="104" cy="30" r="4" fill="#29B298" /><circle cx="102" cy="12" r="3" fill="#5CC8FF" />
    </Peg>
  ),
  brillo: (
    <Peg sil={<><path d={BRILLO} /><path d={BRILLO_CH} /></>}>
      <path d={BRILLO} fill="#F5C542" /><path d="M64 34l5 20 20 9-20 5-5 22-5-22-20-5 20-9z" fill="#FFF3C4" stroke="none" />
      <path d={BRILLO_CH} fill="#F5C542" />
    </Peg>
  ),
  marco: (
    <Peg sil={<rect x="12" y="10" width="104" height="108" />}>
      <rect x="16" y="14" width="96" height="100" fill="#C9C9C4" /><rect x="30" y="28" width="68" height="72" fill="#18181b" />
      <path d="M16 14h28v12H28v18H16zM112 14H84v12h16v18h12zM16 114h28v-12H28V84H16zM112 114H84v-12h16V84h12z" fill="#F5C542" />
      <path d="M40 92l14-18 10 12 8-8 12 14" fill="none" stroke="#6c6c68" strokeWidth="4" />
    </Peg>
  ),
  reaccion: (
    <Peg sil={<path d="M10 18h108v68H60l-28 26V86H10z" />}>
      <path d="M10 18h108v68H60l-28 26V86H10z" fill="#E41373" />
      <path d="M64 30c12 12 16 19 16 28a16 16 0 01-32 0c0-7 4-12 9-18 2 7 5 9 7 9 0-7-1-12 0-19z" fill="#F5C542" />
      <path d="M64 52c4 4 6 7 6 10a6 6 0 01-12 0c0-3 2-5 6-10z" fill="#FFF3C4" />
    </Peg>
  ),
  fondo: (
    <Peg sil={<rect x="8" y="18" width="112" height="92" />}>
      <rect x="10" y="20" width="108" height="88" fill="#5CC8FF" /><path d="M10 108l36-44 22 26 16-16 34 34z" fill="#1d5b86" />
      <circle cx="90" cy="42" r="11" fill="#F5C542" /><path d="M10 20h108v88H10z" fill="none" />
    </Peg>
  ),
};

//: el metal de cada insignia: [borde, centro, estrella]
const METAL = {
  bronce: ['#CD7F32', '#8a5220', '#FFD9A8'], plata: ['#C9C9C4', '#6c6c68', '#F6F6F6'], oro: ['#F5C542', '#8a6a10', '#FFF3C4'],
  platino: ['#BFE9FF', '#3d6f86', '#F6F6F6'], diamante: ['#5CC8FF', '#1d5b86', '#E8F7FF'], premium: ['#E41373', '#5b0830', '#F5C542'],
};

/** De qué objeto es un premio del Pase (`[nivel, puntos, tipo, valor]`) */
export function objetoDe(p) {
  const tipo = p && p[2];
  if (!tipo) return 'pdt';
  if (tipo === 'tarjeta' || tipo === 'carta') return 'carta';
  if (tipo === 'llave') return 'brillo';
  if (tipo === 'emblema') return 'insignia';
  return DIBUJOS[tipo] ? tipo : 'pdt';
}

//: lo que se mueve siempre que se vea, porque es lo que más vale
export const SIEMPRE_ANIMA = new Set(['drop', 'caja', 'brillo']);
//: la animación de cada uno (las clases están en css/pase.css)
const ANIM = { pdt: 'po-flota', drop: 'po-late', star: 'po-late', caja: 'po-salta', brillo: 'po-gira', carta: 'po-ladea' };

/**
 * Un premio dibujado. `p`: el premio del Pase (o `tipo` directo); `t`: el tamaño; `an`: si se mueve; `gris`: con candado
 */
export function Objeto({ p, tipo, t = 64, an = false, gris = false, cls = '' }) {
  const k = tipo || objetoDe(p);
  let dib = DIBUJOS[k] || DIBUJOS.pdt;
  if (typeof dib === 'function') {
    const v = String((p && p[3]) || '').toLowerCase();
    dib = dib(METAL[Object.keys(METAL).find((m) => v.includes(m)) || (p && p[2] === 'emblema' ? 'premium' : 'bronce')]);
  }
  return (
    <svg className={'po' + (an && !gris && ANIM[k] ? ' ' + ANIM[k] : '') + (gris ? ' po-gris' : '') + (cls ? ' ' + cls : '')}
      width={t} height={t} viewBox="-6 -6 140 140" aria-hidden="true">{dib}</svg>
  );
}
