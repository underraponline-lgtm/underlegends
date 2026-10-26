// 🏆 LA SEMANA EN EL INICIO (26/10/2026). Dlx, a la maqueta del Inicio 4: «prefiero el actual pero me gustan las
// agregaciones que agregaste, eso de posiciones de los mini eventos». Así que el Inicio no cambia: se le suma esto, una
// sección, con EN QUÉ VAS en cada competencia (o, sin entrar, cómo va cada una) y el link a Competencias
import { Sec } from './piezas.jsx';
import { dondeEstoy, nombreDe, useCompetencias } from './competencias_datos.js';

export function SemanaComp({ liga, dc }) {
  const C = useCompetencias();
  if (!C || !(C.copa || []).length) return null;
  const yo = (liga && liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  const d = dondeEstoy(C, yo);
  const L = C.liga || {};
  const pct = (p) => Math.round((p || 0) * 100) + ' %';
  const cajas = d ? [
    d.copa ? ['COPA · GRUPO ' + d.copa.g.id, d.copa.pos + '.º', d.copa.falta ? 'Faltan ' + d.copa.falta + ' cruces' : 'Jugaste todos'] : ['COPA', '—', 'Esta semana no estás'],
    d.liga ? ['LIGA DE 10', d.liga.pos + '.º', d.liga.rival ? 'Contra ' + nombreDe(liga, C, d.liga.rival) + (d.liga.g ? '' : ' · ' + pct(d.liga.p)) : ''] : ['LIGA DE 10', 'J' + ((L.j || []).length || 1), 'Los 10 mejores del Competitivo'],
    ['RAPID DE HOY', d.rapid ? (C.rapid && C.rapid.campeon === yo ? 'Campeón' : 'Jugaste') : (C.rapid ? nombreDe(liga, C, C.rapid.campeon) : '—'), d.rapid ? '' : 'Campeón · hoy no te tocó'],
  ] : [
    ['COPA', String(C.copa.length), 'grupos · ' + C.activos + ' activos'],
    ['LIGA DE 10', 'J' + ((L.j || []).length || 1), 'de 9 · los 10 mejores'],
    ['RAPID DE HOY', C.rapid ? nombreDe(liga, C, C.rapid.campeon) : '—', 'campeón · todo simulado'],
  ];
  return (
    <Sec id="i-semana-comp" titulo={'La semana · día ' + C.dia + ' de 7'} enlace="Competencias" href="#/competencias">
      <div className="sc8">
        <div className="sc8-dias" aria-hidden="true">{[1, 2, 3, 4, 5, 6, 7].map((x) => <i key={x} className={x < C.dia ? 'ya' : x === C.dia ? 'hoy' : ''} />)}</div>
        <ul className="sc8-cajas">
          {cajas.map(([t, b, s]) => <li key={t}><span>{t}</span><b>{b}</b><small>{s}</small></li>)}
        </ul>
      </div>
    </Sec>
  );
}
